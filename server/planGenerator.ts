/**
 * 离线力量训练计划生成器 v2 —— 周期化力量训练引擎
 * ----------------------------------------------------------------------------
 * 方法论（还原自 F:/Desktop/力量训练计划.xlsx）：
 *  1. 分阶段周期化：动作框架 → 容量耐受 → 强度 → 减载
 *  2. 固定 4 天分化 + 四大项（蹲 / 推 / 拉 / 举）
 *  3. 双进阶渐进超负荷（先加组数 → 再加次数 → 最后加重量）+ 组内递增
 *  4. TX（训练目标值）锚定负荷
 *  5. RPE 自主调节（目标 RPE 处方，实际 RPE 驱动下周加减）
 *  6. 量化记录（逐组分布 / 技术备注 / 静息心率 / 体重 / 热量）
 *
 * 完全本地计算，不依赖任何外部模型 / API。
 */

// ===================== 类型 =====================

export interface PlanProfile {
  gender?: 'male' | 'female' | 'other' | '';
  age?: number | null;
  height?: number | null;   // cm
  weight?: number | null;   // kg
  experience?: 'beginner' | 'intermediate' | 'advanced' | '';
  goal?: string;
  frequency?: number | null;
  equipment?: string;
  injuries?: string;
  // 四大项当前 1RM（可选）
  squat1RM?: number | null;
  bench1RM?: number | null;
  deadlift1RM?: number | null;
  press1RM?: number | null;
  // 四大项 TX 训练目标值（可选，长期北极星）
  txSquat?: number | null;
  txBench?: number | null;
  txDeadlift?: number | null;
  txPress?: number | null;
  // 周期偏好
  phase?: 'auto' | 'foundation' | 'volume' | 'strength';
  programWeeks?: number | null;
  updatedAt?: string;
}

export interface PlanLogEntry {
  id?: string;
  date?: string;
  lift?: string;
  weight?: number;
  reps?: number;
  rpe?: number;
  // 扩展（可选）
  setDistribution?: string;   // 逐组重量分布，如 "85-87.5-90"
  techniqueNote?: string;     // 技术备注
  restingHR?: number;         // 平均静息心率
  calories?: number;          // 热量摄入
  bodyweight?: number;        // 体重
  note?: string;
}

export type PhaseKey = 'foundation' | 'volume' | 'strength';
export type PlanMode = 'program' | 'weekly' | 'rpe';

export interface GenerateOptions {
  mode: PlanMode;
  phase?: PhaseKey | 'auto';
  startWeek?: number;   // 1-based，weekly 模式使用
}

// ===================== 阶段定义（源自表格还原） =====================

interface PhaseDef {
  key: PhaseKey;
  label: string;
  weeks: number;
  reps: [number, number];
  targetRPE: number;
  rpeRange: [number, number];
  startPct: number;   // 占锚点 %
  endPct: number;
  setsStart: number;  // 双进阶：起始组数
  setsEnd: number;    // 双进阶：末周组数
  tempo: string;
  rest: string;
  deload: boolean;
  desc: string;
}

const PHASES: Record<PhaseKey, PhaseDef> = {
  foundation: {
    key: 'foundation', label: '动作框架', weeks: 4, reps: [8, 10], targetRPE: 6, rpeRange: [5, 7],
    startPct: 55, endPct: 68, setsStart: 3, setsEnd: 4, tempo: '慢速，重技术口令（撑髋展膝 / 非常筒 / 基本起桥）',
    rest: '2-3 分钟', deload: true,
    desc: '低负荷、低 RPE，把深蹲/卧推/硬拉/推举的动作模式焊死。容量与强度必须等技术框架就绪后再上。',
  },
  volume: {
    key: 'volume', label: '容量耐受', weeks: 5, reps: [10, 10], targetRPE: 7, rpeRange: [6, 8],
    startPct: 68, endPct: 82, setsStart: 5, setsEnd: 9, tempo: '受控向心，离心 2-3 秒',
    rest: '2 分钟', deload: true,
    desc: '双进阶：先把组数从 5 加到 9，再把次数与重量推高。高训练量刺激肌肥大与肌腱适应。',
  },
  strength: {
    key: 'strength', label: '强度', weeks: 4, reps: [5, 6], targetRPE: 7, rpeRange: [6.5, 8],
    startPct: 82, endPct: 95, setsStart: 4, setsEnd: 5, tempo: '爆发式向心，受控离心',
    rest: '3 分钟', deload: true,
    desc: '把积累的容量转化为最大力量。次数降下来，负荷逼近锚点高位，仍受 RPE 约束不冲力竭。',
  },
};

const PHASE_ORDER: PhaseKey[] = ['foundation', 'volume', 'strength'];

// ===================== 固定分化模板（四大项） =====================

type LiftKey = 'squat' | 'bench' | 'deadlift' | 'press' | 'row' | 'facepull' | 'core';
type MainLiftKey = 'squat' | 'bench' | 'deadlift' | 'press';

interface ExItem {
  name: string;
  lift: LiftKey;
  role: 'main' | 'pull' | 'accessory';
}

interface DayTemplate {
  day: string;
  focus: string;
  items: ExItem[];
}

// 节奏：练练休练练休休（D1 D2 休 D3 D4 休 休）
const SPLIT: DayTemplate[] = [
  {
    day: 'D1', focus: '下肢主项（蹲）+ 拉',
    items: [
      { name: '高杠蹲（要非常筒）', lift: 'squat', role: 'main' },
      { name: '传统拉（筒式支撑）', lift: 'deadlift', role: 'pull' },
      { name: '仰卧举腿（慢下 3 秒）', lift: 'core', role: 'accessory' },
    ],
  },
  {
    day: 'D2', focus: '上肢推（卧推）+ 拉',
    items: [
      { name: '卧推（基本起桥）', lift: 'bench', role: 'main' },
      { name: '潘德雷划船（筒式支撑）', lift: 'row', role: 'pull' },
      { name: '面拉（慢速离心）', lift: 'facepull', role: 'accessory' },
    ],
  },
  {
    day: 'D3', focus: '下肢主项（蹲）+ 拉',
    items: [
      { name: '高杠蹲（要非常筒）', lift: 'squat', role: 'main' },
      { name: '传统拉（筒式支撑）', lift: 'deadlift', role: 'pull' },
      { name: '仰卧举腿（慢下 3 秒）', lift: 'core', role: 'accessory' },
    ],
  },
  {
    day: 'D4', focus: '上肢推（卧推+实力推）+ 拉',
    items: [
      { name: '卧推（基本起桥）', lift: 'bench', role: 'main' },
      { name: '实力推（握法四步）', lift: 'press', role: 'main' },
      { name: '潘德雷划船（筒式支撑）', lift: 'row', role: 'pull' },
    ],
  },
];

// 辅助项固定参数（不随双进阶变组数，负荷随阶段 % 走）
const ACCESSORY_SPEC: Partial<Record<LiftKey, { sets: number; reps: [number, number]; rpe: number; scaleOf: LiftKey; scale: number; note?: string }>> = {
  deadlift: { sets: 2, reps: [6, 6], rpe: 6, scaleOf: 'deadlift', scale: 0.9 },
  row: { sets: 3, reps: [8, 8], rpe: 7, scaleOf: 'bench', scale: 0.6 },
  facepull: { sets: 3, reps: [15, 20], rpe: 6, scaleOf: 'bench', scale: 0.08 },
  core: { sets: 3, reps: [12, 20], rpe: 7, scaleOf: 'squat', scale: 0.03, note: '慢下 3 秒' },
};

// ===================== 工具函数 =====================

/** Epley 公式估算 1RM：1RM = w * (1 + r/30) */
export function estimate1RM(weight: number, reps: number): number {
  if (!weight || weight <= 0) return 0;
  if (reps <= 1) return Math.round(weight);
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

function roundTo(val: number, step = 2.5): number {
  return Math.round(val / step) * step;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/** 组内递增分布：从 low 到 high 均分到 sets 组，四舍五入到 2.5 */
function rampLoads(low: number, high: number, sets: number): number[] {
  if (sets <= 1) return [roundTo(high)];
  const out: number[] = [];
  for (let i = 0; i < sets; i++) {
    const t = i / (sets - 1);
    out.push(roundTo(low + (high - low) * t));
  }
  return out;
}

function distStr(loads: number[]): string {
  return loads.join('-');
}

/** 辅助项（如传统拉）在某阶段某周的负荷，与日表中的辅助参数保持一致 */
function accessoryLoad(specKey: LiftKey, phase: PhaseDef, weekIndex: number, anchor: number | null, deload: boolean): { sets: number; reps: number; high: number | null; pct: number; rpe: number } {
  const spec = ACCESSORY_SPEC[specKey]!;
  const frac = phase.weeks > 1 ? weekIndex / (phase.weeks - 1) : 1;
  let pct = lerp(phase.startPct, phase.endPct, frac);
  if (deload) pct = phase.endPct * 0.85;
  const reps = spec.reps[0];
  if (!anchor) return { sets: spec.sets, reps, high: null, pct: Math.round(pct), rpe: spec.rpe };
  return { sets: spec.sets, reps, high: roundTo(anchor * pct / 100 * spec.scale), pct: Math.round(pct), rpe: spec.rpe };
}

function fmtWeight(v: number): string {
  const r = roundTo(v);
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

const LIFT_CN: Record<LiftKey, string> = {
  squat: '深蹲', bench: '卧推', deadlift: '传统拉', press: '实力推', row: '潘德雷划船', facepull: '面拉', core: '仰卧举腿',
};

interface AnchorInfo { anchor: number | null; source: string; }

function pickAnchor(oneRM?: number | null, tx?: number | null): AnchorInfo {
  if (oneRM && oneRM > 0) return { anchor: oneRM, source: '1RM' };
  if (tx && tx > 0) return { anchor: tx, source: 'TX目标值' };
  return { anchor: null, source: '未提供' };
}

function resolveAnchors(p: PlanProfile): Record<'squat' | 'bench' | 'deadlift' | 'press', AnchorInfo> {
  return {
    squat: pickAnchor(p.squat1RM, p.txSquat),
    bench: pickAnchor(p.bench1RM, p.txBench),
    deadlift: pickAnchor(p.deadlift1RM, p.txDeadlift),
    press: pickAnchor(p.press1RM, p.txPress),
  };
}

function getExperienceLabel(e?: string): string {
  switch (e) {
    case 'beginner': return '新手 (<6 个月)';
    case 'intermediate': return '中级 (6 个月-2 年)';
    case 'advanced': return '高级 (>2 年)';
    default: return '未填写';
  }
}

// 主项在某阶段某周的负荷参数
interface MainLoad {
  sets: number;
  reps: number;
  pct: number;
  high: number | null;
  low: number | null;
  loads: number[] | null;
  rpe: number;
}

function computeMainLoad(phase: PhaseDef, weekIndex: number, anchor: number | null, deload: boolean): MainLoad {
  const frac = phase.weeks > 1 ? weekIndex / (phase.weeks - 1) : 1;
  const sets = Math.round(lerp(phase.setsStart, phase.setsEnd, frac));
  const reps = Math.round(lerp(phase.reps[0], phase.reps[1], frac));
  let pct = lerp(phase.startPct, phase.endPct, frac);
  let rpe = phase.targetRPE;
  if (deload) { pct = phase.endPct * 0.85; rpe = 5.5; }
  if (!anchor) {
    return { sets, reps, pct: Math.round(pct), high: null, low: null, loads: null, rpe };
  }
  const high = roundTo(anchor * pct / 100);
  const low = roundTo(high * 0.95);
  return { sets, reps, pct: Math.round(pct), high, low, loads: rampLoads(low, high, sets), rpe };
}

// ===================== RPE 调节（按日志） =====================

interface RpeAdj {
  lift: MainLiftKey;
  found: boolean;
  loggedWeight?: number;
  loggedReps?: number;
  loggedRPE?: number;
  est1RM?: number;
  targetRPE: number;
  factor: number;
  suggestedLoad?: number | null;
  note: string;
}

const LOG_LIFT_KEYS: { key: MainLiftKey; match: string[] }[] = [
  { key: 'squat', match: ['深蹲', 'squat', '蹲'] },
  { key: 'bench', match: ['卧推', 'bench', '推'] },
  { key: 'deadlift', match: ['硬拉', 'deadlift', '拉', '传统'] },
  { key: 'press', match: ['推举', 'press', '实力推', '举'] },
];

function latestLogForLift(log: PlanLogEntry[], key: LiftKey): PlanLogEntry | undefined {
  const m = LOG_LIFT_KEYS.find(l => l.key === key)!.match;
  const entries = log
    .filter(e => e.lift && m.some(k => (e.lift || '').toLowerCase().includes(k.toLowerCase())))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  return entries[entries.length - 1];
}

function computeRpeAdjustments(
  profile: PlanProfile,
  log: PlanLogEntry[],
  targetRPE: number,
  planned?: Partial<Record<MainLiftKey, number | null>>
): Record<MainLiftKey, RpeAdj> {
  const anchors = resolveAnchors(profile);
  const result = {} as Record<MainLiftKey, RpeAdj>;
  for (const { key } of LOG_LIFT_KEYS) {
    const entry = latestLogForLift(log, key);
    const adj: RpeAdj = { lift: key, found: false, targetRPE, factor: 1, note: '' };
    // 实际重量 + 次数 为核心要素；RPE 选填（不填也能仅按重量调节）
    if (entry && entry.weight && entry.reps) {
      adj.found = true;
      adj.loggedWeight = entry.weight;
      adj.loggedReps = entry.reps;
      adj.loggedRPE = entry.rpe || undefined;
      adj.est1RM = estimate1RM(entry.weight, entry.reps);

      const plannedW = planned ? (planned[key] ?? null) : null;
      const ratio = plannedW && plannedW > 0 ? entry.weight / plannedW : null;

      let factor = 1;
      const notes: string[] = [];
      let decidedByRpe = false;

      // ① RPE 信号（安全优先，一旦判定则不再被重量信号反超）
      if (entry.rpe) {
        const delta = entry.rpe - targetRPE;
        if (delta >= 1) {
          factor = 0.95;
          decidedByRpe = true; // RPE 偏高 → 直接下调，即便举到了计划重量也回退
          notes.push(`实测 RPE ${entry.rpe} 高于目标 ${targetRPE}（≥1 档），主项重量下调约 5%`);
        } else if (delta <= -1) {
          factor = 1.05;
          decidedByRpe = true;
          notes.push(`实测 RPE ${entry.rpe} 低于目标 ${targetRPE}（≥1 档），主项重量上调约 5%`);
        }
      }

      // ② 实际重量 vs 计划重量 信号（仅当 RPE 未做判定时启用）
      if (!decidedByRpe && ratio != null) {
        if (ratio >= 1.0) {
          factor = 1.025;
          notes.push(`实际 ${entry.weight}kg 达到/超过计划 ${plannedW}kg，下次主项重量上调约 2.5%`);
        } else if (ratio < 0.95) {
          factor = 1.0;
          notes.push(`实际 ${entry.weight}kg 低于计划 ${plannedW}kg，维持当前负荷并优先排查技术与恢复`);
        }
      }

      if (notes.length === 0) notes.push(`实测 RPE 接近目标且重量达标，维持当前负荷继续推进`);

      adj.factor = factor;
      adj.note = notes.join('；');
      // 建议负荷：基于实测重量 × factor
      adj.suggestedLoad = roundTo(entry.weight * factor);
    } else {
      const a = anchors[key];
      if (a.anchor) adj.note = `暂无近期「${LIFT_CN[key]}」记录，按目标 RPE ${targetRPE} 执行（锚点 ${a.anchor}kg/${a.source}），上报 RPE 后可自动调节`;
      else adj.note = `未填写 ${LIFT_CN[key]} 的 1RM/TX 且无训练记录，建议先测 1RM 或按 RPE 自选重量`;
    }
    result[key] = adj;
  }
  return result;
}

// ===================== 逐日表格 =====================

function buildDayRows(day: DayTemplate, phase: PhaseDef, weekIndex: number, anchors: Record<'squat' | 'bench' | 'deadlift' | 'press', AnchorInfo>, deload: boolean): string[] {
  const rows: string[] = [];
  for (const item of day.items) {
    if (item.role === 'main') {
      const a = anchors[item.lift as 'squat' | 'bench' | 'deadlift' | 'press'];
      const ml = computeMainLoad(phase, weekIndex, a.anchor, deload);
      const weightCell = ml.loads
        ? `${distStr(ml.loads)}（${ml.pct}%）`
        : `RPE ${ml.rpe}（占锚点 ${ml.pct}%，未填 1RM/TX）`;
      rows.push(`| ${item.name} | 主项 | ${ml.sets} | ${ml.reps} | ${weightCell} | ${ml.rpe} | ${phase.rest} | ${phase.tempo} |`);
    } else {
      const spec = ACCESSORY_SPEC[item.lift];
      if (!spec) continue;
      const baseAnchor = anchors[spec.scaleOf as 'squat' | 'bench' | 'deadlift' | 'press'].anchor;
      let weightCell: string;
      if (baseAnchor) {
        const pct = deload ? phase.endPct * 0.85 : lerp(phase.startPct, phase.endPct, phase.weeks > 1 ? weekIndex / (phase.weeks - 1) : 1);
        const w = roundTo(baseAnchor * pct / 100 * spec.scale);
        weightCell = `${w}kg`;
      } else {
        weightCell = `RPE ${spec.rpe}`;
      }
      const reps = spec.reps[0] === spec.reps[1] ? String(spec.reps[0]) : `${spec.reps[0]}-${spec.reps[1]}`;
      rows.push(`| ${item.name} | 辅助 | ${spec.sets} | ${reps} | ${weightCell} | ${spec.rpe} | 60-90 秒 | ${spec.note || '受控'} |`);
    }
  }
  return rows;
}

function buildDayTable(day: DayTemplate, phase: PhaseDef, weekIndex: number, anchors: any, deload: boolean): string {
  const lines: string[] = [];
  lines.push(`**${day.day}（${day.focus}）**`);
  lines.push('');
  lines.push('| 动作 | 类型 | 组数 | 次数 | 重量（占锚点%） | 目标 RPE | 组间休息 | 节奏/备注 |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  lines.push(...buildDayRows(day, phase, weekIndex, anchors, deload));
  lines.push('');
  return lines.join('\n');
}

// ===================== 模式一：完整周期化计划 =====================

function buildProgram(profile: PlanProfile, log: PlanLogEntry[], opts: GenerateOptions): string {
  const anchors = resolveAnchors(profile);
  const chosen: PhaseKey[] = opts.phase && opts.phase !== 'auto'
    ? [opts.phase]
    : PHASE_ORDER;

  const lines: string[] = [];
  lines.push('# 🏋️ 周期化力量训练计划（动作框架 → 容量耐受 → 强度）');
  lines.push('');
  lines.push('> 方法论：分阶段周期化 + 固定 4 天分化（蹲/推/拉/举）+ 双进阶超负荷 + TX 锚定 + RPE 自主调节 + 量化记录。');
  lines.push('');

  // 一、基本情况
  lines.push('## 一、基本情况与锚点');
  lines.push('');
  const info: string[] = [];
  if (profile.gender) info.push(`- 性别：${profile.gender === 'male' ? '男' : profile.gender === 'female' ? '女' : '其他'}`);
  if (profile.age) info.push(`- 年龄：${profile.age} 岁`);
  if (profile.height && profile.weight) {
    const bmi = (profile.weight / Math.pow(profile.height / 100, 2)).toFixed(1);
    info.push(`- 身高/体重：${profile.height}cm / ${profile.weight}kg（BMI ${bmi}）`);
  }
  info.push(`- 训练水平：${getExperienceLabel(profile.experience)}`);
  if (profile.goal) info.push(`- 目标：${profile.goal}`);
  lines.push(info.join('\n'));
  lines.push('');
  lines.push('**四大项锚点（负荷刻度）：**');
  lines.push('| 动作 | 当前 1RM | TX 目标值 | 采用锚点 |');
  lines.push('| --- | --- | --- | --- |');
  for (const k of ['squat', 'bench', 'deadlift', 'press'] as const) {
    const a = anchors[k];
    lines.push(`| ${LIFT_CN[k]} | ${profile[(k + '1RM') as keyof PlanProfile] || '—'} | ${profile[('tx' + k[0].toUpperCase() + k.slice(1)) as keyof PlanProfile] || '—'} | ${a.anchor ? `${a.anchor}kg（${a.source}）` : '需补充'} |`);
  }
  lines.push('');
  if (Object.values(anchors).every(a => !a.anchor)) {
    lines.push('⚠️ 未填写任何 1RM 或 TX，以下主项将以「目标 RPE + 次数」处方，请按当天能稳做该 RPE 的重量执行；建议补全锚点以获得精确负荷。');
    lines.push('');
  }

  // 二、周期总览
  lines.push('## 二、周期总览（训练节奏：练练休练练休休）');
  lines.push('');
  lines.push('| 阶段 | 周数 | 主项次数 | 目标 RPE | 占锚点 % | 组数(双进阶) | 减载 |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const k of chosen) {
    const ph = PHASES[k];
    lines.push(`| ${ph.label} | ${ph.weeks} | ${ph.reps[0]}-${ph.reps[1]} | ${ph.targetRPE} | ${ph.startPct}-${ph.endPct}% | ${ph.setsStart}→${ph.setsEnd} | ${ph.deload ? '阶段后减载' : '—'} |`);
  }
  lines.push('');

  // 三、固定分化模板
  lines.push('## 三、固定 4 天分化模板（四大项）');
  lines.push('');
  lines.push('| 训练日 | 重点 | 动作组合 |');
  lines.push('| --- | --- | --- |');
  for (const d of SPLIT) {
    const combo = d.items.map(i => `${i.name}`).join(' + ');
    lines.push(`| ${d.day} | ${d.focus} | ${combo} |`);
  }
  lines.push('');

  // 四、逐阶段详细计划
  let weekCounter = 0;
  for (const k of chosen) {
    const ph = PHASES[k];
    lines.push(`## 四、阶段：${ph.label}（第 ${weekCounter + 1}–${weekCounter + ph.weeks} 周）`);
    lines.push('');
    lines.push(`> ${ph.desc}`);
    lines.push(`> 节奏：${ph.tempo}；组间休息：${ph.rest}；目标 RPE ${ph.targetRPE}（区间 ${ph.rpeRange[0]}-${ph.rpeRange[1]}）。`);
    lines.push('');

    // 第 1 周完整表格（模板）
    lines.push(`### 第 ${weekCounter + 1} 周（模板，后续周按下方进度表加量）`);
    lines.push('');
    for (const d of SPLIT) lines.push(buildDayTable(d, ph, 0, anchors, false));

    // 逐周主项负荷进度表
    lines.push(`### 主项逐周负荷进度（${ph.label}）`);
    lines.push('');
    lines.push('| 周 | 深蹲(组×次) | 卧推(组×次) | 实力推(组×次) | 传统拉(组×次) | 目标RPE |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (let w = 0; w < ph.weeks; w++) {
      const sq = computeMainLoad(ph, w, anchors.squat.anchor, false);
      const bn = computeMainLoad(ph, w, anchors.bench.anchor, false);
      const pr = computeMainLoad(ph, w, anchors.press.anchor, false);
      const dl = accessoryLoad('deadlift', ph, w, anchors.deadlift.anchor, false);
      const sqC = sq.high ? `${sq.high}kg` : `RPE${sq.rpe}`;
      const bnC = bn.high ? `${bn.high}kg` : `RPE${bn.rpe}`;
      const prC = pr.high ? `${pr.high}kg` : `RPE${pr.rpe}`;
      const dlC = dl.high ? `${dl.high}kg` : `RPE${dl.rpe}`;
      lines.push(`| W${w + 1} | ${sqC}（${sq.sets}×${sq.reps}） | ${bnC}（${bn.sets}×${bn.reps}） | ${prC}（${pr.sets}×${pr.reps}） | ${dlC}（${dl.sets}×${dl.reps}） | ${sq.rpe} |`);
    }
    lines.push('');

    // 减载周
    if (ph.deload) {
      lines.push(`### 减载周（${ph.label}后）`);
      lines.push('');
      lines.push(`> 清空疲劳：负荷降至阶段末的 ~85%，组数不变，目标 RPE 5-6，促进超量恢复。`);
      lines.push('');
      for (const d of SPLIT) lines.push(buildDayTable(d, ph, ph.weeks - 1, anchors, true));
    }

    weekCounter += ph.weeks;
  }

  // 五、RPE 自主调节
  lines.push('## 五、RPE 自主调节协议（核心）');
  lines.push('');
  lines.push('- 每次训练后记录**实际 RPE**（1-10，10=力竭）。');
  lines.push('- 实测 RPE 高于目标 ≥1 档 → 下次主项重量降 2.5-5%（或减 1 次），并检查睡眠/饮食/恢复。');
  lines.push('- 实测 RPE 低于目标 ≥1 档 且技术良好 → 下次加重 2.5-5%（或加 1 次）。');
  lines.push('- 相差 ≤0.5 → 维持，按计划推进。');
  lines.push('- 在「个人档案 → 训练记录」上报后，点「按 RPE 调整」可自动给出下周精确负荷。');
  lines.push('');

  // 六、量化记录表（训练日志模板）
  lines.push('## 六、量化记录表（每次训练填写）');
  lines.push('');
  lines.push('| 日期 | 动作 | 组数 | 次数 | 逐组重量分布 | 实际RPE | 技术备注 | 静息心率 | 体重 | 热量 |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  lines.push('| | | | | 如 85-87.5-90 | | | | | |');
  lines.push('');
  lines.push('> 逐组重量分布能看出是否前重后轻；静息心率与体重是恢复与能量平衡的客观指标。把主观感受变成数据，才能长期做决策。');
  lines.push('');

  // 七、注意事项
  lines.push('## 七、注意事项');
  lines.push('');
  if (profile.injuries && profile.injuries.trim()) {
    lines.push(`- ⚠️ 伤病限制：${profile.injuries.trim()} — 相关动作降强度或替换，必要时咨询专业医疗人员。`);
  }
  lines.push('- 技术优先于重量；RPE 控制在目标区间内，避免过早力竭。');
  lines.push('- 每次训练前 5-10 分钟动态热身，主项先做 2 组递增热身组。');
  lines.push('- 保证每晚 7-9 小时睡眠与每日 1.6-2.2g/kg 蛋白质；恢复决定进步。');
  lines.push('- 本计划由本地规则引擎生成（周期化 + TX + RPE），无需联网；自由对话问答可在设置中配置 API Key 使用 AI 教练。');
  lines.push('');

  return lines.join('\n');
}

// ===================== 模式二：本周计划 =====================

function buildWeekly(profile: PlanProfile, _log: PlanLogEntry[], opts: GenerateOptions): string {
  const anchors = resolveAnchors(profile);
  const phaseKey: PhaseKey = (opts.phase && opts.phase !== 'auto') ? opts.phase : 'volume';
  const ph = PHASES[phaseKey];
  const weekIndex = Math.max(0, Math.min(ph.weeks - 1, (opts.startWeek || 1) - 1));

  const lines: string[] = [];
  lines.push(`# 📅 本周训练计划（阶段：${ph.label} · 第 ${weekIndex + 1} 周）`);
  lines.push('');
  lines.push(`> 节奏：练练休练练休休（D1 D2 休 D3 D4 休 休）。目标 RPE ${ph.targetRPE}，次数 ${ph.reps[0]}-${ph.reps[1]}。`);
  lines.push('');
  for (const d of SPLIT) lines.push(buildDayTable(d, ph, weekIndex, anchors, false));

  lines.push('**RPE 自主调节**：实测 RPE 高于目标 ≥1 档 → 下周降 2.5-5%；低于目标 ≥1 档且技术好 → 加 2.5-5%。训练后到「个人档案」上报 RPE。');
  lines.push('');

  // 本周主项负荷速览
  lines.push('| 主项 | 本周负荷（组×次） | 占锚点% | 目标RPE |');
  lines.push('| --- | --- | --- | --- |');
  for (const k of ['squat', 'bench', 'press', 'deadlift'] as const) {
    const ml = k === 'deadlift'
      ? accessoryLoad('deadlift', ph, weekIndex, anchors[k].anchor, false)
      : computeMainLoad(ph, weekIndex, anchors[k].anchor, false);
    const load = ml.high ? `${ml.high}kg（${ml.pct}%）` : `RPE${ml.rpe}`;
    lines.push(`| ${LIFT_CN[k]} | ${ml.sets}×${ml.reps} | ${ml.pct}% | ${ml.rpe} |`);
  }
  lines.push('');
  return lines.join('\n');
}

// ===================== 模式三：RPE 调整 =====================

function buildRpeAdjust(profile: PlanProfile, log: PlanLogEntry[], _opts: GenerateOptions): string {
  // RPE 调整默认以容量耐受阶段目标 RPE 为基准（若用户处于其他阶段可扩展）
  const targetRPE = PHASES.volume.targetRPE;
  const adjs = computeRpeAdjustments(profile, log, targetRPE);
  const anchors = resolveAnchors(profile);
  const lines: string[] = [];
  lines.push('# 📊 基于 RPE 的训练调整方案');
  lines.push('');
  lines.push(`基准目标 RPE：**${targetRPE}**（容量耐受阶段）。`);
  lines.push('');

  const found = Object.values(adjs).filter(a => a.found);
  if (found.length === 0) {
    lines.push('尚未检测到有效训练记录（需包含：动作、重量、次数、RPE）。');
    lines.push('');
    lines.push('请在「个人档案 → 训练记录」中上报最近一次训练，例如：');
    lines.push('- 深蹲 100kg × 5，RPE 8');
    lines.push('- 卧推 70kg × 6，RPE 9');
    lines.push('- 传统拉 90kg × 5，RPE 7');
    lines.push('- 实力推 40kg × 8，RPE 7');
    lines.push('');
    lines.push('上报后我将据此给出每个主项下周精确调整负荷。');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('| 动作 | 近期最佳 | 估算1RM | 目标RPE | 实测RPE | 偏差 | 下周建议 |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const a of found) {
    const best = a.loggedWeight && a.loggedReps ? `${a.loggedWeight}kg×${a.loggedReps}` : '-';
    const est = a.est1RM ? `${a.est1RM}kg` : '-';
    const delta = (a.loggedRPE! - a.targetRPE);
    const dev = delta >= 1 ? `+${(a.loggedRPE! - a.targetRPE).toFixed(1)} 偏高` : delta <= -1 ? `${(a.loggedRPE! - a.targetRPE).toFixed(1)} 偏低` : '≈达标';
    let sug = '维持当前负荷';
    if (a.suggestedLoad != null) sug = `${a.suggestedLoad}kg（×${a.loggedReps}）`;
    else if (anchors[a.lift].anchor) sug = `按锚点 ${anchors[a.lift].anchor}kg 的 ${PHASES.volume.startPct}-${PHASES.volume.endPct}% 执行`;
    lines.push(`| ${LIFT_CN[a.lift]} | ${best} | ${est} | ${a.targetRPE} | ${a.loggedRPE} | ${dev} | ${sug} |`);
  }
  lines.push('');
  lines.push('**说明**：');
  for (const a of found) lines.push(`- ${LIFT_CN[a.lift]}：${a.note}`);
  lines.push('');
  lines.push('**执行要点**：');
  lines.push('- 每周固定测一次主项 RPE，连续 2 周偏差同向则加大调节幅度。');
  lines.push('- 若多个动作同时「偏高」，优先安排减载周或检查睡眠/饮食。');
  lines.push('- 达到新 PR 后请在档案更新 1RM/TX，所有百分比将自动重算。');
  lines.push('');
  return lines.join('\n');
}

// ===================== 打卡页公开 API =====================
//
// 以下接口把引擎内部的「阶段处方」与「RPE 自主调节」暴露给训练打卡页，
// 使打卡记录能够直接驱动下一次训练的负荷，而不必重新生成整份计划。

/** 单个主项的下次训练调节建议 */
export interface AdviceItem {
  lift: MainLiftKey;
  liftName: string;
  found: boolean;
  loggedWeight?: number;
  loggedReps?: number;
  loggedRPE?: number;
  loggedDate?: string;
  est1RM?: number;
  targetRPE: number;
  factor: number;
  suggestedLoad?: number | null;
  direction: 'up' | 'down' | 'hold' | 'none';
  note: string;
}

/** 阶段元信息（供前端下拉框使用） */
export function listPhases() {
  return PHASE_ORDER.map(k => {
    const p = PHASES[k];
    return {
      key: p.key, label: p.label, weeks: p.weeks, reps: p.reps,
      targetRPE: p.targetRPE, startPct: p.startPct, endPct: p.endPct,
      setsStart: p.setsStart, setsEnd: p.setsEnd, desc: p.desc,
      tempo: p.tempo, rest: p.rest,
    };
  });
}

/** 固定 4 天分化模板（供前端展示训练日） */
export function listSplit() {
  return SPLIT.map(d => ({ day: d.day, focus: d.focus, items: d.items.map(i => i.name) }));
}

/**
 * 基于最近打卡记录，计算四大项的下次训练调节建议。
 * 这就是「量化记录自动驱动 RPE 调节」的核心：
 *   实测 RPE − 目标 RPE ≥ 1  → ×0.95（减重 5%）
 *   实测 RPE − 目标 RPE ≤ −1 → ×1.025（加重 2.5%）
 *   其余                      → 维持
 */
export function adviseNextSession(
  profile: PlanProfile,
  log: PlanLogEntry[],
  phaseKey?: PhaseKey | 'auto',
  planned?: Partial<Record<MainLiftKey, number | null>>
): AdviceItem[] {
  const key: PhaseKey = phaseKey && phaseKey !== 'auto'
    ? phaseKey
    : (profile.phase && profile.phase !== 'auto' ? profile.phase : 'volume');
  const phase = PHASES[key];
  const raw = computeRpeAdjustments(profile, log, phase.targetRPE, planned);

  return (['squat', 'bench', 'deadlift', 'press'] as MainLiftKey[]).map(k => {
    const a = raw[k];
    const entry = latestLogForLift(log, k);
    let direction: AdviceItem['direction'] = 'none';
    if (a.found) {
      direction = a.factor > 1 ? 'up' : a.factor < 1 ? 'down' : 'hold';
    }
    return {
      lift: k,
      liftName: LIFT_CN[k],
      found: a.found,
      loggedWeight: a.loggedWeight,
      loggedReps: a.loggedReps,
      loggedRPE: a.loggedRPE,
      loggedDate: entry?.date,
      est1RM: a.est1RM,
      targetRPE: a.targetRPE,
      factor: a.factor,
      suggestedLoad: a.suggestedLoad ?? null,
      direction,
      note: a.note,
    };
  });
}

/** 处方中的一行动作 */
export interface PrescriptionRow {
  name: string;
  lift: LiftKey;
  liftName: string;
  role: 'main' | 'pull' | 'accessory';
  sets: number;
  reps: number;
  pct: number | null;
  topWeight: number | null;
  distribution: string | null;
  targetRPE: number;
  rest: string;
  tempo: string;
  /** 经 RPE 调节后的建议顶组重量（仅主项） */
  adjustedWeight?: number | null;
  adjustNote?: string;
}

/** 某一训练日的完整处方 */
export interface DayPrescription {
  phase: PhaseKey;
  phaseLabel: string;
  week: number;
  totalWeeks: number;
  day: string;
  focus: string;
  deload: boolean;
  rows: PrescriptionRow[];
}

/**
 * 依据「最后一次打卡」推断下一个训练日（D1→D2→D3→D4→D1 循环）。
 * 若无记录则从 D1 开始。
 */
export function inferNextDay(log: PlanLogEntry[] & { day?: string }[]): string {
  const withDay = (log as Array<PlanLogEntry & { day?: string }>)
    .filter(e => e.day)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const last = withDay[withDay.length - 1];
  if (!last?.day) return 'D1';
  const idx = SPLIT.findIndex(d => d.day === last.day);
  if (idx < 0) return 'D1';
  return SPLIT[(idx + 1) % SPLIT.length].day;
}

/**
 * 生成指定训练日的处方，并把 RPE 调节结果直接叠加到主项负荷上。
 */
export function getDayPrescription(
  profile: PlanProfile,
  log: PlanLogEntry[],
  opts: { phase?: PhaseKey | 'auto'; week?: number; day?: string } = {}
): DayPrescription {
  const key: PhaseKey = opts.phase && opts.phase !== 'auto'
    ? opts.phase
    : (profile.phase && profile.phase !== 'auto' ? profile.phase : 'volume');
  const phase = PHASES[key];
  const anchors = resolveAnchors(profile);

  const weekNum = Math.max(1, opts.week || 1);
  const deload = weekNum > phase.weeks;
  const weekIndex = Math.min(weekNum, phase.weeks) - 1;

  const dayName = opts.day || inferNextDay(log as any);
  const day = SPLIT.find(d => d.day === dayName) || SPLIT[0];

  // 计算每个主项本周的「计划顶组重量」，用于和实际重量比对（判断举到/超过/未达计划）
  const plannedMap: Partial<Record<MainLiftKey, number | null>> = {};
  for (const { key: mk } of LOG_LIFT_KEYS) {
    plannedMap[mk] = computeMainLoad(phase, weekIndex, anchors[mk].anchor, deload).high;
  }

  const advice = adviseNextSession(profile, log, key, plannedMap);
  const adviceMap = new Map(advice.map(a => [a.lift, a]));

  const rows: PrescriptionRow[] = [];
  for (const item of day.items) {
    if (item.role === 'main') {
      const mk = item.lift as MainLiftKey;
      const ml = computeMainLoad(phase, weekIndex, anchors[mk].anchor, deload);
      const adj = adviceMap.get(mk);
      let adjustedWeight: number | null = null;
      let adjustNote: string | undefined;
      if (ml.high && adj && adj.found && adj.factor !== 1) {
        adjustedWeight = roundTo(ml.high * adj.factor);
        adjustNote = adj.note;
      }
      rows.push({
        name: item.name,
        lift: item.lift,
        liftName: LIFT_CN[item.lift],
        role: 'main',
        sets: ml.sets,
        reps: ml.reps,
        pct: ml.pct,
        topWeight: ml.high,
        distribution: ml.loads ? distStr(ml.loads) : null,
        targetRPE: ml.rpe,
        rest: phase.rest,
        tempo: phase.tempo,
        adjustedWeight,
        adjustNote,
      });
    } else {
      const spec = ACCESSORY_SPEC[item.lift];
      if (!spec) continue;
      const baseAnchor = anchors[spec.scaleOf as MainLiftKey]?.anchor ?? null;
      const al = accessoryLoad(item.lift, phase, weekIndex, baseAnchor, deload);
      rows.push({
        name: item.name,
        lift: item.lift,
        liftName: LIFT_CN[item.lift],
        role: item.role,
        sets: al.sets,
        reps: al.reps,
        pct: al.pct,
        topWeight: al.high,
        distribution: null,
        targetRPE: al.rpe,
        rest: '60-90 秒',
        tempo: spec.note || '受控',
      });
    }
  }

  return {
    phase: key,
    phaseLabel: phase.label + (deload ? '（减载周）' : ''),
    week: weekNum,
    totalWeeks: phase.weeks,
    day: day.day,
    focus: day.focus,
    deload,
    rows,
  };
}

// ===================== 入口 =====================

export function generatePlan(profile: PlanProfile, trainingLog: PlanLogEntry[], opts: GenerateOptions): string {
  switch (opts.mode) {
    case 'rpe': return buildRpeAdjust(profile, trainingLog, opts);
    case 'weekly': return buildWeekly(profile, trainingLog, opts);
    case 'program':
    default: return buildProgram(profile, trainingLog, opts);
  }
}
