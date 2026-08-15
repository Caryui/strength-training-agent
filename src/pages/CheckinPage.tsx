import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Select, InputNumber, Input, Tag, Tooltip, MessagePlugin, Popconfirm, Loading } from 'tdesign-react';
import {
  Dumbbell, TrendingUp, TrendingDown, Minus, Check, Trash2,
  RefreshCw, Activity, Upload, ClipboardList, Info,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { CheckinEntry, AdviceItem, UserProfile, PhaseKey } from '../types';
import { PrescriptionRow, DayPrescription, PhaseMeta } from '../hooks/useCheckins';

interface CheckinPageProps {
  profile: UserProfile;
  checkins: CheckinEntry[];
  advice: AdviceItem[];
  prescription: DayPrescription | null;
  phases: PhaseMeta[];
  loading: boolean;
  onFetchPrescription: (q: { phase?: PhaseKey | 'auto' | ''; week?: number; day?: string }) => Promise<DayPrescription | null>;
  onAddCheckin: (entry: Omit<CheckinEntry, 'id'>) => Promise<{ checkin: CheckinEntry; advice: AdviceItem[] }>;
  onDeleteCheckin: (id: string) => Promise<void>;
  onImportSeed: () => Promise<void>;
}

const DAYS = ['D1', 'D2', 'D3', 'D4'];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 打卡草稿：每行动作的实际完成情况 */
interface RowDraft {
  enabled: boolean;
  sets?: number;
  reps?: number;
  weight?: number;
  rpe?: number;
  dist: string;
  tech: string;
}

// ============================================================================
// 小组件
// ============================================================================

function SectionCard({
  title, icon, extra, children, hint,
}: {
  title: string;
  icon: React.ReactNode;
  extra?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: 'var(--td-bg-color-container)',
        border: '1px solid var(--td-component-stroke)',
      }}
    >
      <div
        className="px-4 py-3 flex items-center justify-between gap-3"
        style={{ borderBottom: '1px solid var(--td-component-stroke)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ color: 'var(--td-brand-color)' }} className="flex-shrink-0">{icon}</span>
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--td-text-color-primary)' }}>
            {title}
          </span>
          {hint && (
            <Tooltip content={hint}>
              <span style={{ color: 'var(--td-text-color-placeholder)' }} className="flex-shrink-0">
                <Info size={14} />
              </span>
            </Tooltip>
          )}
        </div>
        {extra}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/** 负荷 / RPE 双轴趋势图（纯 SVG，跟随主题） */
function TrendChart({ data }: { data: { date: string; weight: number; rpe: number }[] }) {
  const W = 640, H = 190, PL = 44, PR = 36, PT = 16, PB = 28;

  if (data.length < 2) {
    return (
      <div className="text-center py-8 text-sm" style={{ color: 'var(--td-text-color-placeholder)' }}>
        该动作至少需要 2 条记录才能绘制趋势
      </div>
    );
  }

  const weights = data.map(d => d.weight);
  const wMin = Math.min(...weights), wMax = Math.max(...weights);
  const wLo = wMin === wMax ? wMin - 5 : wMin - (wMax - wMin) * 0.15;
  const wHi = wMin === wMax ? wMax + 5 : wMax + (wMax - wMin) * 0.15;

  const x = (i: number) => PL + (i / (data.length - 1)) * (W - PL - PR);
  const yW = (v: number) => PT + (1 - (v - wLo) / (wHi - wLo)) * (H - PT - PB);
  const yR = (v: number) => PT + (1 - (v - 4) / (10 - 4)) * (H - PT - PB);

  const wPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${yW(d.weight)}`).join(' ');
  const rPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${yR(d.rpe)}`).join(' ');
  const areaPath = `${wPath} L${x(data.length - 1)},${H - PB} L${PL},${H - PB} Z`;

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map(t => wLo + (wHi - wLo) * t);
  const tickIdx = data.length <= 6
    ? data.map((_, i) => i)
    : [0, Math.floor(data.length / 3), Math.floor((2 * data.length) / 3), data.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 210 }}>
      <defs>
        <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--td-brand-color)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--td-brand-color)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {gridVals.map((v, i) => (
        <g key={i}>
          <line
            x1={PL} y1={yW(v)} x2={W - PR} y2={yW(v)}
            stroke="var(--td-component-stroke)" strokeWidth="1" strokeDasharray="3 3"
          />
          <text
            x={PL - 6} y={yW(v) + 3} textAnchor="end"
            fontSize="9" fill="var(--td-text-color-placeholder)"
          >
            {Math.round(v)}
          </text>
        </g>
      ))}

      {[6, 8, 10].map(v => (
        <text
          key={v} x={W - PR + 6} y={yR(v) + 3}
          fontSize="9" fill="var(--td-warning-color)" opacity="0.75"
        >
          {v}
        </text>
      ))}

      <path d={areaPath} fill="url(#wfill)" />
      <path d={wPath} fill="none" stroke="var(--td-brand-color)" strokeWidth="2" strokeLinejoin="round" />
      <path d={rPath} fill="none" stroke="var(--td-warning-color)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.85" />

      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={yW(d.weight)} r="2.8" fill="var(--td-brand-color)" />
      ))}

      {tickIdx.map(i => (
        <text
          key={i} x={x(i)} y={H - 8} textAnchor="middle"
          fontSize="9" fill="var(--td-text-color-placeholder)"
        >
          {data[i].date.slice(5)}
        </text>
      ))}
    </svg>
  );
}

/** 调节方向徽标 */
function DirectionTag({ item }: { item: AdviceItem }) {
  if (!item.found) {
    return <Tag theme="default" variant="light" size="small">暂无记录</Tag>;
  }
  if (item.direction === 'up') {
    return (
      <Tag theme="danger" variant="light" size="small" icon={<TrendingUp size={12} />}>
        加重
      </Tag>
    );
  }
  if (item.direction === 'down') {
    return (
      <Tag theme="success" variant="light" size="small" icon={<TrendingDown size={12} />}>
        减重
      </Tag>
    );
  }
  return (
    <Tag theme="primary" variant="light" size="small" icon={<Minus size={12} />}>
      维持
    </Tag>
  );
}

/** 移动端历史记录卡片（sm 以下显示） */
function CheckinCard({ c, onDelete }: { c: CheckinEntry; onDelete: (id: string) => void }) {
  const rpeColor =
    c.targetRpe && c.rpe - c.targetRpe >= 1
      ? 'var(--td-error-color)'
      : c.targetRpe && c.rpe - c.targetRpe <= -1
        ? 'var(--td-success-color)'
        : 'inherit';
  return (
    <div
      className="rounded-lg p-3 flex items-start justify-between gap-2"
      style={{ backgroundColor: 'var(--td-bg-color-container-hover)', border: '1px solid var(--td-component-stroke)' }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate" style={{ color: 'var(--td-text-color-primary)' }}>
            {c.lift}
          </span>
          <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
            {c.date}{c.dateInferred ? ' *' : ''}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
          <span>{c.cycle || '—'} · {c.day || '—'}</span>
          <span>{c.sets || '—'}×{c.reps}</span>
          <span>{c.weight}kg</span>
          {c.rpe ? <span style={{ color: rpeColor }}>RPE {c.rpe}</span> : null}
        </div>
        {(c.setDistribution || c.techniqueNote || c.note) && (
          <div className="mt-1 text-xs truncate" style={{ color: 'var(--td-text-color-placeholder)' }} title={c.setDistribution || c.techniqueNote || c.note}>
            {c.setDistribution ? `逐组 ${c.setDistribution}　` : ''}{c.techniqueNote || c.note}
          </div>
        )}
      </div>
      <Popconfirm content="删除这条记录？" onConfirm={() => onDelete(c.id)}>
        <Button variant="text" size="small" shape="circle" icon={<Trash2 size={13} />} />
      </Popconfirm>
    </div>
  );
}

// ============================================================================
// 场次聚合辅助
// ============================================================================

/** 取一条记录所属场次的唯一键：优先用 sessionId，旧数据/导入数据回退到 日期|周期|日 */
function sessionKeyOf(c: CheckinEntry): string {
  return c.sessionId ?? `${c.date}|${c.cycle ?? ''}|${c.day ?? ''}`;
}

/** 计算单场训练的汇总：动作数 / 总容量 / 平均 RPE / 身体指标 */
function summarizeSession(items: CheckinEntry[]) {
  const head = items[0] || ({} as CheckinEntry);
  const withRpe = items.filter(c => (c.rpe ?? 0) > 0);
  const volume = items.reduce((s, c) => s + (c.sets || 1) * c.reps * c.weight, 0);
  return {
    date: head.date || '',
    cycle: head.cycle || '',
    day: head.day || '',
    actions: items.length,
    volume: volume >= 1000 ? `${(volume / 1000).toFixed(1)} 吨` : `${Math.round(volume)} kg`,
    avgRpe: withRpe.length ? (withRpe.reduce((s, c) => s + c.rpe, 0) / withRpe.length).toFixed(1) : '—',
    bodyweight: items.map(c => c.bodyweight).find(v => v != null),
    restingHR: items.map(c => c.restingHR).find(v => v != null),
    calories: items.map(c => c.calories).find(v => v != null),
  };
}

// ============================================================================
// 主页面
// ============================================================================

export function CheckinPage({
  profile,
  checkins,
  advice,
  prescription,
  phases,
  loading,
  onFetchPrescription,
  onAddCheckin,
  onDeleteCheckin,
  onImportSeed,
}: CheckinPageProps) {
  const [phase, setPhase] = useState<PhaseKey>((profile.phase && profile.phase !== 'auto' ? profile.phase : 'volume') as PhaseKey);
  const [week, setWeek] = useState<number>(1);
  const [day, setDay] = useState<string>('');
  const [date, setDate] = useState<string>(today());

  // 全局身体指标
  const [restingHR, setRestingHR] = useState<number | undefined>(undefined);
  const [bodyweight, setBodyweight] = useState<number | undefined>(undefined);
  const [calories, setCalories] = useState<number | undefined>(undefined);

  const [drafts, setDrafts] = useState<Record<number, RowDraft>>({});
  const [saving, setSaving] = useState(false);
  const [trendLift, setTrendLift] = useState<string>('高杠蹲');

  // 拉取处方
  const refresh = useCallback(async () => {
    const p = await onFetchPrescription({ phase, week, day: day || undefined });
    if (p && !day) setDay(p.day);
  }, [onFetchPrescription, phase, week, day]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, week, day]);

  // 处方变化时，用处方值预填打卡草稿
  useEffect(() => {
    if (!prescription) return;
    const next: Record<number, RowDraft> = {};
    prescription.rows.forEach((r, i) => {
      next[i] = {
        enabled: true,
        sets: r.sets,
        reps: r.reps,
        weight: r.adjustedWeight ?? r.topWeight ?? undefined,
        rpe: undefined,
        dist: '',
        tech: '',
      };
    });
    setDrafts(next);
  }, [prescription]);

  const setDraft = (i: number, patch: Partial<RowDraft>) => {
    setDrafts(prev => ({ ...prev, [i]: { ...prev[i], ...patch } }));
  };

  // 保存本次训练的全部打卡
  const handleSaveAll = async () => {
    if (!prescription) return;
    // 同一场训练的所有动作共享一个 sessionId，便于历史按场次聚合展示
    const sessionId = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    // 记录「本次处方的全部已启用动作」——只要动作被勾选（默认全勾），就必定记录；
    // 用户没手填的字段自动回退到处方计划值（组/次/重量），从根本上杜绝
    // 「某个动作因漏填字段而被静默丢弃、历史里看不到」的问题（如深蹲/硬拉失踪）。
    const toSave = prescription.rows
      .map((r, i) => {
        const d = drafts[i];
        if (d && d.enabled === false) return null; // 用户明确「跳过」的动作不记
        const sets = d?.sets != null ? d.sets! : r.sets;
        const reps = d?.reps != null ? d.reps! : r.reps;
        const weight = d?.weight != null ? d.weight! : (r.adjustedWeight ?? r.topWeight ?? 0);
        const rpe = d?.rpe != null ? d.rpe! : 0;
        return { row: r, sets, reps, weight, rpe, d };
      })
      .filter(Boolean) as Array<{ row: PrescriptionRow; sets: number; reps: number; weight: number; rpe: number; d?: RowDraft }>;

    if (toSave.length === 0) {
      MessagePlugin.warning('当前处方没有可记录的动作');
      return;
    }

    setSaving(true);
    try {
      for (const { row, sets, reps, weight, rpe, d } of toSave) {
        await onAddCheckin({
          date,
          cycle: `${prescription.phase}-W${prescription.week}`,
          phase: prescription.phase,
          week: prescription.week,
          day: prescription.day,
          lift: row.name.replace(/（.*?）/g, '').trim(),
          sets,
          reps,
          weight,
          rpe,
          targetRpe: row.targetRPE,
          setDistribution: d?.dist || undefined,
          techniqueNote: d?.tech || undefined,
          restingHR,
          bodyweight,
          calories,
          sessionId,
          createdAt: new Date().toISOString(),
        });
      }
      MessagePlugin.success(`已打卡 ${toSave.length} 个动作（含全部训练动作），RPE 调节已更新`);
      await refresh();
    } catch (e: any) {
      MessagePlugin.error('保存失败：' + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  // 趋势数据
  const liftOptions = useMemo(() => {
    const set = new Set(checkins.map(c => c.lift));
    return Array.from(set).map(l => ({ label: l, value: l }));
  }, [checkins]);

  const trendData = useMemo(() => {
    return checkins
      .filter(c => c.lift === trendLift && c.weight > 0)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(c => ({ date: c.date, weight: c.weight, rpe: c.rpe || 0 }));
  }, [checkins, trendLift]);

  useEffect(() => {
    if (liftOptions.length > 0 && !liftOptions.some(o => o.value === trendLift)) {
      setTrendLift(liftOptions[0].value);
    }
  }, [liftOptions, trendLift]);

  // 按训练场次聚合（session）：每场训练 = 一组动作，保证「每次全部动作」成组显示
  const sessions = useMemo(() => {
    const map = new Map<string, CheckinEntry[]>();
    for (const c of checkins) {
      const key = sessionKeyOf(c);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    const list = Array.from(map.values());
    list.sort((a, b) => {
      const da = a[0]?.date || '';
      const db = b[0]?.date || '';
      if (da !== db) return db.localeCompare(da); // 日期新的在前
      return (b[0]?.createdAt || '').localeCompare(a[0]?.createdAt || ''); // 同日则新场次在前
    });
    list.forEach(s => s.sort((x, y) => (x.createdAt || '').localeCompare(y.createdAt || '')));
    return list;
  }, [checkins]);

  // 场次折叠状态（默认全部展开）
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleSession = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const stats = useMemo(() => {
    const dates = new Set(checkins.map(c => c.date));
    const withRpe = checkins.filter(c => c.rpe > 0);
    const avgRpe = withRpe.length
      ? (withRpe.reduce((s, c) => s + c.rpe, 0) / withRpe.length).toFixed(1)
      : '—';
    const volume = checkins.reduce((s, c) => s + (c.sets || 1) * c.reps * c.weight, 0);
    return {
      sessions: dates.size,
      records: checkins.length,
      avgRpe,
      volume: volume >= 1000 ? `${(volume / 1000).toFixed(1)} 吨` : `${Math.round(volume)} kg`,
    };
  }, [checkins]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-3 sm:p-5 space-y-4">
        {/* 概览 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '训练场次', value: stats.sessions },
            { label: '量化记录', value: stats.records },
            { label: '平均 RPE', value: stats.avgRpe },
            { label: '累计容量', value: stats.volume },
          ].map(s => (
            <div
              key={s.label}
              className="rounded-xl px-4 py-3"
              style={{
                backgroundColor: 'var(--td-bg-color-container)',
                border: '1px solid var(--td-component-stroke)',
              }}
            >
              <div className="text-xs mb-1" style={{ color: 'var(--td-text-color-placeholder)' }}>
                {s.label}
              </div>
              <div className="text-xl font-semibold" style={{ color: 'var(--td-text-color-primary)' }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* 阶段控制 */}
        <SectionCard
          title="训练定位"
          icon={<ClipboardList size={16} />}
          hint="选择当前所处的阶段、周次与训练日，处方会按双进阶规则自动换算负荷"
          extra={
            <div className="flex gap-2">
              <Button size="small" variant="outline" icon={<Upload size={14} />} onClick={onImportSeed}>
                导入 Excel 历史
              </Button>
              <Button size="small" variant="text" icon={<RefreshCw size={14} />} onClick={refresh}>
                刷新
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <div className="text-xs mb-1.5" style={{ color: 'var(--td-text-color-secondary)' }}>阶段</div>
              <Select
                value={phase}
                onChange={(v) => setPhase(v as PhaseKey)}
                options={(phases.length ? phases : []).map(p => ({
                  label: `${p.label}（${p.weeks}周 · ${p.reps[0]}-${p.reps[1]}次 · RPE${p.targetRPE}）`,
                  value: p.key,
                }))}
              />
            </div>
            <div>
              <div className="text-xs mb-1.5" style={{ color: 'var(--td-text-color-secondary)' }}>周次</div>
              <InputNumber
                value={week}
                onChange={(v) => setWeek(Number(v) || 1)}
                min={1}
                max={12}
                theme="normal"
              />
            </div>
            <div>
              <div className="text-xs mb-1.5" style={{ color: 'var(--td-text-color-secondary)' }}>训练日</div>
              <Select
                value={day}
                onChange={(v) => setDay(v as string)}
                options={DAYS.map(d => ({ label: d, value: d }))}
                placeholder="自动推断"
              />
            </div>
            <div>
              <div className="text-xs mb-1.5" style={{ color: 'var(--td-text-color-secondary)' }}>训练日期</div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 rounded"
                style={{
                  height: 32,
                  border: '1px solid var(--td-component-border)',
                  backgroundColor: 'var(--td-bg-color-container)',
                  color: 'var(--td-text-color-primary)',
                }}
              />
            </div>
          </div>
          {prescription && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <Tag theme="primary" variant="light">{prescription.phaseLabel}</Tag>
              <Tag variant="light">第 {prescription.week} / {prescription.totalWeeks} 周</Tag>
              <Tag variant="light">{prescription.day} · {prescription.focus}</Tag>
              <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
                节奏：练练休练练休休
              </span>
            </div>
          )}
        </SectionCard>

        {/* RPE 自主调节 */}
        <SectionCard
          title="RPE 自主调节（由打卡记录自动驱动）"
          icon={<Activity size={16} />}
          hint="实测 RPE 高于目标 ≥1 档自动减重 5%；低于目标 ≥1 档自动加重 2.5%；否则维持"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {advice.map(a => (
              <div
                key={a.lift}
                className="rounded-lg px-3 py-2.5"
                style={{
                  backgroundColor: 'var(--td-bg-color-container-hover)',
                  border: '1px solid var(--td-component-stroke)',
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                    {a.liftName}
                  </span>
                  <DirectionTag item={a} />
                </div>
                {a.found ? (
                  <>
                    <div className="text-xs mb-1" style={{ color: 'var(--td-text-color-secondary)' }}>
                      上次 {a.loggedWeight}kg × {a.loggedReps} · 实测 RPE {a.loggedRPE} / 目标 {a.targetRPE}
                      {a.est1RM ? ` · 估算 1RM ${a.est1RM}kg` : ''}
                    </div>
                    {a.suggestedLoad != null && (
                      <div className="text-sm font-semibold" style={{ color: 'var(--td-brand-color)' }}>
                        建议下次：{a.suggestedLoad} kg
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
                    {a.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 今日处方 + 打卡 */}
        <SectionCard
          title="今日处方与打卡"
          icon={<Dumbbell size={16} />}
          hint="重量已按阶段百分比换算，并叠加最近一次 RPE 调节；填写实际完成情况后保存"
          extra={
            <Button
              theme="primary"
              size="small"
              icon={<Check size={14} />}
              loading={saving}
              onClick={handleSaveAll}
            >
              保存本次训练
            </Button>
          }
        >
          {loading && !prescription ? (
            <div className="py-10 text-center"><Loading /></div>
          ) : !prescription ? (
            <div className="py-8 text-center text-sm" style={{ color: 'var(--td-text-color-placeholder)' }}>
              暂无处方，请先在「个人档案」填写 1RM / TX 锚点
            </div>
          ) : (
            <div className="space-y-3">
              {prescription.rows.map((row, i) => {
                const d = drafts[i] || { enabled: true, dist: '', tech: '' };
                const planned = row.adjustedWeight ?? row.topWeight;
                return (
                  <div
                    key={i}
                    className="rounded-lg p-3"
                    style={{
                      backgroundColor: 'var(--td-bg-color-container-hover)',
                      border: `1px solid ${row.role === 'main' ? 'var(--td-brand-color-light-active)' : 'var(--td-component-stroke)'}`,
                      opacity: d.enabled ? 1 : 0.5,
                    }}
                  >
                    {/* 处方行 */}
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                            {row.name}
                          </span>
                          <Tag size="small" variant="light" theme={row.role === 'main' ? 'primary' : 'default'}>
                            {row.role === 'main' ? '主项' : row.role === 'pull' ? '拉' : '辅助'}
                          </Tag>
                          <span className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
                            {row.sets} 组 × {row.reps} 次 · 目标 RPE {row.targetRPE} · 休息 {row.rest}
                          </span>
                        </div>
                        <div className="text-xs mt-1" style={{ color: 'var(--td-text-color-placeholder)' }}>
                          {row.distribution
                            ? `建议逐组：${row.distribution}${row.pct ? `（占锚点 ${row.pct}%）` : ''}`
                            : row.topWeight != null
                              ? `建议负荷：${row.topWeight}kg`
                              : `按目标 RPE ${row.targetRPE} 自选重量`}
                          {row.tempo ? ` · ${row.tempo}` : ''}
                        </div>
                        {row.adjustNote && (
                          <div
                            className="text-xs mt-1 px-2 py-1 rounded inline-block"
                            style={{
                              color: row.adjustedWeight! < (row.topWeight || 0) ? 'var(--td-success-color)' : 'var(--td-error-color)',
                              backgroundColor: 'var(--td-bg-color-page)',
                            }}
                          >
                            RPE 调节：{row.topWeight}kg → <b>{row.adjustedWeight}kg</b>　{row.adjustNote}
                          </div>
                        )}
                      </div>
                      <Button
                        size="small"
                        variant={d.enabled ? 'outline' : 'text'}
                        theme={d.enabled ? 'primary' : 'default'}
                        onClick={() => setDraft(i, { enabled: !d.enabled })}
                      >
                        {d.enabled ? '已选' : '跳过'}
                      </Button>
                    </div>

                    {/* 打卡输入 */}
                    {d.enabled && (
                      <div className="grid grid-cols-2 sm:grid-cols-12 gap-2">
                        <div className="col-span-1 sm:col-span-1">
                          <InputNumber
                            value={d.sets} onChange={(v) => setDraft(i, { sets: Number(v) || undefined })}
                            min={1} max={20} theme="column" placeholder="组"
                          />
                        </div>
                        <div className="col-span-1 sm:col-span-1">
                          <InputNumber
                            value={d.reps} onChange={(v) => setDraft(i, { reps: Number(v) || undefined })}
                            min={1} max={50} theme="column" placeholder="次"
                          />
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                          <InputNumber
                            value={d.weight} onChange={(v) => setDraft(i, { weight: Number(v) ?? undefined })}
                            min={0} max={500} step={2.5} theme="column"
                            placeholder={planned != null ? `${planned}kg` : 'kg'}
                          />
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                          <InputNumber
                            value={d.rpe} onChange={(v) => setDraft(i, { rpe: Number(v) || undefined })}
                            min={1} max={10} step={0.5} theme="column"
                            placeholder={`RPE ${row.targetRPE}`}
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-3">
                          <Input
                            value={d.dist} onChange={(v) => setDraft(i, { dist: (v as string) || '' })}
                            placeholder="逐组分布 85-87.5-90"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-3">
                          <Input
                            value={d.tech} onChange={(v) => setDraft(i, { tech: (v as string) || '' })}
                            placeholder="技术备注"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 全局身体指标 */}
              <div
                className="rounded-lg p-3 grid grid-cols-1 sm:grid-cols-3 gap-3"
                style={{ backgroundColor: 'var(--td-bg-color-page)', border: '1px dashed var(--td-component-stroke)' }}
              >
                <div>
                  <div className="text-xs mb-1.5" style={{ color: 'var(--td-text-color-secondary)' }}>平均静息心率 (bpm)</div>
                  <InputNumber value={restingHR} onChange={(v) => setRestingHR(Number(v) || undefined)} min={30} max={140} theme="normal" placeholder="选填" />
                </div>
                <div>
                  <div className="text-xs mb-1.5" style={{ color: 'var(--td-text-color-secondary)' }}>当日体重 (kg)</div>
                  <InputNumber value={bodyweight} onChange={(v) => setBodyweight(Number(v) || undefined)} min={30} max={200} step={0.1} theme="normal" placeholder="选填" />
                </div>
                <div>
                  <div className="text-xs mb-1.5" style={{ color: 'var(--td-text-color-secondary)' }}>热量摄入 (kcal)</div>
                  <InputNumber value={calories} onChange={(v) => setCalories(Number(v) || undefined)} min={0} max={8000} step={50} theme="normal" placeholder="选填" />
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        {/* 趋势 */}
        <SectionCard
          title="负荷与 RPE 趋势"
          icon={<TrendingUp size={16} />}
          hint="实线为顶组负荷（左轴 kg），虚线为实测 RPE（右轴）"
          extra={
            <Select
              value={trendLift}
              onChange={(v) => setTrendLift(v as string)}
              options={liftOptions}
              style={{ width: 180 }}
              size="small"
            />
          }
        >
          <TrendChart data={trendData} />
        </SectionCard>

        {/* 历史记录（按训练场次聚合，每场显示全部动作） */}
        <SectionCard
          title={`历史打卡记录（${sessions.length} 场训练 · ${checkins.length} 条动作，本地持久化）`}
          icon={<ClipboardList size={16} />}
          extra={
            <span className="text-xs sm:hidden" style={{ color: 'var(--td-text-color-placeholder)' }}>
              卡片视图
            </span>
          }
        >
          {sessions.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'var(--td-text-color-placeholder)' }}>
              还没有记录。点击右上角「导入 Excel 历史」可回填三个周期的真实数据。
            </div>
          ) : (
            <>
              {/* 桌面：按场次分组表格（点击场次行可折叠/展开，全部动作可见） */}
              <div className="hidden sm:block overflow-auto" style={{ maxHeight: '60vh' }}>
                <table className="w-full text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--td-component-stroke)' }}>
                      {['场次 / 动作', '组×次', '重量', 'RPE', '逐组分布', '技术备注', ''].map(h => (
                        <th key={h} className="text-left py-2 px-2 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  {sessions.map(session => {
                    const key = sessionKeyOf(session[0]);
                    const sum = summarizeSession(session);
                    const isCollapsed = collapsed.has(key);
                    return (
                      <tbody key={key} style={{ borderBottom: '2px solid var(--td-component-stroke)' }}>
                        {/* 场次汇总行 */}
                        <tr
                          onClick={() => toggleSession(key)}
                          className="cursor-pointer hover:bg-[var(--td-bg-color-container-hover)]"
                          style={{ backgroundColor: 'var(--td-bg-color-container-hover)' }}
                        >
                          <td colSpan={7} className="py-2 px-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="flex-shrink-0"
                                style={{ color: 'var(--td-brand-color)' }}
                                onClick={(e) => { e.stopPropagation(); toggleSession(key); }}
                              >
                                {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                              </span>
                              <span className="text-sm font-semibold" style={{ color: 'var(--td-text-color-primary)' }}>
                                {sum.date}
                              </span>
                              {sum.cycle && <Tag size="small" variant="light">{sum.cycle}</Tag>}
                              {sum.day && <Tag size="small" variant="light">{sum.day}</Tag>}
                              <Tag size="small" variant="light" theme="primary">{sum.actions} 个动作</Tag>
                              <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
                                总容量 {sum.volume} · 均 RPE {sum.avgRpe}
                              </span>
                              {sum.bodyweight != null && (
                                <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>体重 {sum.bodyweight}kg</span>
                              )}
                              {sum.restingHR != null && (
                                <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>静息 {sum.restingHR}</span>
                              )}
                              {sum.calories != null && (
                                <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>{sum.calories}kcal</span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* 该场次全部动作 */}
                        {!isCollapsed && session.map(c => (
                          <tr key={c.id} style={{ borderTop: '1px solid var(--td-component-stroke)' }}>
                            <td className="py-1.5 px-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium" style={{ color: 'var(--td-text-color-primary)' }}>{c.lift}</span>
                                {c.dateInferred && (
                                  <Tooltip content="表格未标注日期，依训练节奏推断">
                                    <span style={{ color: 'var(--td-warning-color)' }}> *</span>
                                  </Tooltip>
                                )}
                              </div>
                            </td>
                            <td className="py-1.5 px-2 whitespace-nowrap">{c.sets || '—'}×{c.reps}</td>
                            <td className="py-1.5 px-2 whitespace-nowrap">{c.weight}kg</td>
                            <td className="py-1.5 px-2 whitespace-nowrap">
                              {c.rpe > 0 ? (
                                <span style={{
                                  color: c.targetRpe && c.rpe - c.targetRpe >= 1
                                    ? 'var(--td-error-color)'
                                    : c.targetRpe && c.rpe - c.targetRpe <= -1
                                      ? 'var(--td-success-color)'
                                      : 'inherit',
                                }}>
                                  {c.rpe}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="py-1.5 px-2 max-w-[200px] truncate" title={c.setDistribution}>{c.setDistribution || '—'}</td>
                            <td className="py-1.5 px-2 max-w-[200px] truncate" title={c.techniqueNote || c.note}>
                              {c.techniqueNote || c.note || '—'}
                            </td>
                            <td className="py-1.5 px-2">
                              <Popconfirm content="删除这条记录？" onConfirm={() => onDeleteCheckin(c.id)}>
                                <Button variant="text" size="small" shape="circle" icon={<Trash2 size={13} />} />
                              </Popconfirm>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    );
                  })}
                </table>
              </div>

              {/* 移动：按场次分组卡片（每场一个卡片，展开显示全部动作） */}
              <div className="sm:hidden space-y-3">
                {sessions.map(session => {
                  const key = sessionKeyOf(session[0]);
                  const sum = summarizeSession(session);
                  const isCollapsed = collapsed.has(key);
                  return (
                    <div
                      key={key}
                      className="rounded-lg p-3"
                      style={{ backgroundColor: 'var(--td-bg-color-container-hover)', border: '1px solid var(--td-component-stroke)' }}
                    >
                      <div onClick={() => toggleSession(key)} className="flex items-center justify-between gap-2 cursor-pointer">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="text-sm font-semibold" style={{ color: 'var(--td-text-color-primary)' }}>{sum.date}</span>
                          {sum.cycle && <Tag size="small" variant="light">{sum.cycle}</Tag>}
                          {sum.day && <Tag size="small" variant="light">{sum.day}</Tag>}
                          <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
                            {sum.actions} 动作 · {sum.volume} · RPE {sum.avgRpe}
                          </span>
                        </div>
                        <span className="flex-shrink-0" style={{ color: 'var(--td-brand-color)' }}>
                          {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                        </span>
                      </div>
                      {!isCollapsed && (
                        <div className="mt-2 space-y-2">
                          {session.map(c => (
                            <CheckinCard key={c.id} c={c} onDelete={onDeleteCheckin} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
