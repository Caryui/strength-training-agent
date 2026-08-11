import { UserProfile, TrainingLogEntry } from '../types';

/**
 * Epley 公式估算 1RM：1RM = w * (1 + r/30)
 */
export function estimate1RM(weight: number, reps: number): number {
  if (!weight || weight <= 0) return 0;
  if (reps <= 1) return Math.round(weight);
  return Math.round(weight * (1 + reps / 30));
}

/**
 * 判断档案是否已填写了可用于出方案的关键数据
 */
export function isProfileFilled(p: UserProfile): boolean {
  return !!(
    p.height ||
    p.weight ||
    p.age ||
    p.gender ||
    p.goal ||
    p.squat1RM ||
    p.bench1RM ||
    p.deadlift1RM
  );
}

const GENDER_MAP: Record<string, string> = {
  male: '男',
  female: '女',
  other: '其他',
  '': '未填写',
};

const EXP_MAP: Record<string, string> = {
  beginner: '新手 (<6个月)',
  intermediate: '中级 (6个月-2年)',
  advanced: '高级 (>2年)',
  '': '未填写',
};

/**
 * 将用户档案与训练记录拼装成注入 systemPrompt 的 Markdown 段
 */
export function buildProfileContext(profile: UserProfile, log: TrainingLogEntry[]): string {
  const lines: string[] = [];
  lines.push('## 用户档案（以下数据已由「个人档案」提供，请勿重复询问）');

  lines.push(`- 性别：${GENDER_MAP[profile.gender] ?? '未填写'}`);
  if (profile.age) lines.push(`- 年龄：${profile.age} 岁`);
  if (profile.height) lines.push(`- 身高：${profile.height} cm`);
  if (profile.weight) {
    lines.push(`- 体重：${profile.weight} kg`);
    if (profile.height) {
      const h = profile.height / 100;
      const bmi = (profile.weight / (h * h)).toFixed(1);
      lines.push(`- BMI：${bmi}`);
    }
  }
  lines.push(`- 训练经验：${EXP_MAP[profile.experience] ?? '未填写'}`);
  if (profile.goal) lines.push(`- 训练目标：${profile.goal}`);
  if (profile.frequency) lines.push(`- 每周训练频率：${profile.frequency} 天`);
  if (profile.equipment) lines.push(`- 可用器械：${profile.equipment}`);
  if (profile.injuries) lines.push(`- 伤病 / 动作限制：${profile.injuries}`);

  const fmt = (v: number | null) => (v != null ? `${v} kg` : '—');
  lines.push(
    `- 四大项极限重量 (1RM)：深蹲 ${fmt(profile.squat1RM)} / 卧推 ${fmt(profile.bench1RM)} / 硬拉 ${fmt(profile.deadlift1RM)} / 实力推 ${fmt(profile.press1RM)}`
  );
  lines.push(
    `- 四大项 TX 训练目标值：深蹲 ${fmt(profile.txSquat)} / 卧推 ${fmt(profile.txBench)} / 传统拉 ${fmt(profile.txDeadlift)} / 实力推 ${fmt(profile.txPress)}`
  );
  if (profile.phase) {
    const phaseLabel: Record<string, string> = {
      auto: '完整周期（动作框架→容量耐受→强度）',
      foundation: '动作框架',
      volume: '容量耐受',
      strength: '强度',
    };
    lines.push(`- 周期偏好：${phaseLabel[profile.phase] || profile.phase}`);
    if (profile.programWeeks) lines.push(`- 计划周期长度：${profile.programWeeks} 周`);
  }

  if (log.length > 0) {
    lines.push('');
    lines.push('### 近期训练记录（用于 RPE 自主调节）');
    lines.push('| 日期 | 动作 | 重量(kg) | 次数 | 实际RPE | 逐组分布 | 技术/备注 | 静息心率 | 体重 | 热量 |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const e of log.slice(0, 15)) {
      lines.push(
        `| ${e.date} | ${e.lift} | ${e.weight} | ${e.reps} | ${e.rpe} | ${e.setDistribution || ''} | ${e.techniqueNote || e.note || ''} | ${e.restingHR ?? ''} | ${e.bodyweight ?? ''} | ${e.calories ?? ''} |`
      );
    }
    lines.push('');
    lines.push(
      '请基于上述记录中「实际 RPE」与计划「目标 RPE」的差异，按 RPE 自主调节协议动态调整后续负荷（±2.5-5%）。'
    );
  }

  return lines.join('\n');
}
