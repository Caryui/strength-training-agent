import { useState, useEffect } from 'react';
import {
  Dialog,
  InputNumber,
  Input,
  Select,
  Button,
  Tag,
  Divider,
} from 'tdesign-react';
import { DeleteIcon, AddIcon, FileImportIcon } from 'tdesign-icons-react';
import { UserProfile, TrainingLogEntry } from '../types';
import { estimate1RM } from '../utils/profileContext';

interface ProfileDialogProps {
  visible: boolean;
  profile: UserProfile;
  log: TrainingLogEntry[];
  onClose: () => void;
  onSaveProfile: (p: UserProfile) => void;
  onAddLog: (e: Omit<TrainingLogEntry, 'id'>) => void;
  onDeleteLog: (id: string) => void;
  onImportSeed: () => Promise<void>;
}

const today = () => new Date().toISOString().slice(0, 10);

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm" style={{ color: 'var(--td-text-color-primary)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function ProfileDialog({
  visible,
  profile,
  log,
  onClose,
  onSaveProfile,
  onAddLog,
  onDeleteLog,
  onImportSeed,
}: ProfileDialogProps) {
  const [form, setForm] = useState<UserProfile>(profile);

  // 打开时同步外部档案
  useEffect(() => {
    if (visible) setForm(profile);
  }, [visible, profile]);

  // 1RM 估算器状态
  const [estLift, setEstLift] = useState<'squat1RM' | 'bench1RM' | 'deadlift1RM'>('squat1RM');
  const [estWeight, setEstWeight] = useState<number | undefined>(undefined);
  const [estReps, setEstReps] = useState<number | undefined>(undefined);

  // 训练记录草稿
  const [logDate, setLogDate] = useState(today());
  const [logLift, setLogLift] = useState('深蹲');
  const [logWeight, setLogWeight] = useState<number | undefined>(undefined);
  const [logReps, setLogReps] = useState<number | undefined>(undefined);
  const [logRpe, setLogRpe] = useState<number | undefined>(undefined);
  const [logSetDist, setLogSetDist] = useState('');
  const [logTech, setLogTech] = useState('');
  const [logHR, setLogHR] = useState<number | undefined>(undefined);
  const [logCal, setLogCal] = useState<number | undefined>(undefined);
  const [logBW, setLogBW] = useState<number | undefined>(undefined);
  const [logNote, setLogNote] = useState('');

  const toNum = (v: number | string | undefined): number | null => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };

  const setNum = (key: keyof UserProfile, v: number | string | undefined) => {
    setForm((f) => ({ ...f, [key]: toNum(v) }));
  };

  const applyEstimate = () => {
    const v = estimate1RM(estWeight ?? 0, estReps ?? 0);
    if (v > 0) {
      setForm((f) => ({ ...f, [estLift]: v }));
    }
  };

  const handleAddLog = () => {
    if (!logWeight || !logReps || !logRpe) return;
    onAddLog({
      date: logDate || today(),
      lift: logLift,
      weight: Number(logWeight),
      reps: Number(logReps),
      rpe: Number(logRpe),
      setDistribution: logSetDist || undefined,
      techniqueNote: logTech || undefined,
      restingHR: logHR,
      calories: logCal,
      bodyweight: logBW,
      note: logNote,
    });
    setLogWeight(undefined);
    setLogReps(undefined);
    setLogRpe(undefined);
    setLogSetDist('');
    setLogTech('');
    setLogHR(undefined);
    setLogCal(undefined);
    setLogBW(undefined);
    setLogNote('');
  };

  const handleSave = () => {
    onSaveProfile(form);
    onClose();
  };

  return (
    <Dialog
      header="个人档案"
      visible={visible}
      onClose={onClose}
      onConfirm={handleSave}
      confirmBtn="保存"
      cancelBtn="取消"
      width={560}
    >
      <div className="max-h-[70vh] overflow-y-auto pr-1">
        <p className="text-xs mb-4" style={{ color: 'var(--td-text-color-placeholder)' }}>
          数据仅保存在本机浏览器，并会自动注入到训练方案设计中（每次对话都会作为上下文提供给教练）。
        </p>

        {/* 一键回填 Excel 真实数据 */}
        <div
          className="mb-4 p-3 rounded-lg flex items-center justify-between gap-3"
          style={{ backgroundColor: 'var(--td-brand-color-light)', border: '1px solid var(--td-brand-color-light-active)' }}
        >
          <div className="min-w-0">
            <div className="text-sm font-medium" style={{ color: 'var(--td-brand-color)' }}>
              回填 Excel 真实训练数据
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--td-text-color-secondary)' }}>
              一键写入 TX（蹲160/推100/拉180/举55）、四大项 1RM 与三个周期全量记录，生成你的专属计划
            </div>
          </div>
          <Button theme="primary" icon={<FileImportIcon />} onClick={() => onImportSeed()} block={false}>
            导入
          </Button>
        </div>

        {/* 基础数据 */}
        <div className="text-sm font-semibold mb-3" style={{ color: 'var(--td-brand-color)' }}>
          基础数据
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="性别">
            <Select
              value={form.gender}
              onChange={(v) => setForm((f) => ({ ...f, gender: v as UserProfile['gender'] }))}
              placeholder="选择"
            >
              <Select.Option value="male" label="男" />
              <Select.Option value="female" label="女" />
              <Select.Option value="other" label="其他" />
            </Select>
          </Field>
          <Field label="年龄">
            <InputNumber value={form.age ?? undefined} onChange={(v) => setNum('age', v)} min={10} max={100} theme="normal" placeholder="岁" />
          </Field>
          <Field label="身高 (cm)">
            <InputNumber value={form.height ?? undefined} onChange={(v) => setNum('height', v)} min={120} max={230} theme="normal" placeholder="cm" />
          </Field>
          <Field label="体重 (kg)">
            <InputNumber value={form.weight ?? undefined} onChange={(v) => setNum('weight', v)} min={30} max={250} theme="normal" placeholder="kg" />
          </Field>
        </div>

        <Divider />

        {/* 训练背景 */}
        <div className="text-sm font-semibold mb-3" style={{ color: 'var(--td-brand-color)' }}>
          训练背景
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="训练经验">
            <Select
              value={form.experience}
              onChange={(v) => setForm((f) => ({ ...f, experience: v as UserProfile['experience'] }))}
              placeholder="选择"
            >
              <Select.Option value="beginner" label="新手 (<6个月)" />
              <Select.Option value="intermediate" label="中级 (6个月-2年)" />
              <Select.Option value="advanced" label="高级 (>2年)" />
            </Select>
          </Field>
          <Field label="每周训练天数">
            <InputNumber value={form.frequency ?? undefined} onChange={(v) => setNum('frequency', v)} min={1} max={7} theme="normal" placeholder="天" />
          </Field>
          <Field label="训练目标">
            <Input value={form.goal} onChange={(v) => setForm((f) => ({ ...f, goal: (v as string) ?? '' }))} placeholder="如：增肌 / 最大力量 / 减脂" />
          </Field>
          <Field label="可用器械">
            <Input value={form.equipment} onChange={(v) => setForm((f) => ({ ...f, equipment: (v as string) ?? '' }))} placeholder="如：商业健身房 / 家庭杠铃" />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="伤病 / 动作限制">
            <Input value={form.injuries} onChange={(v) => setForm((f) => ({ ...f, injuries: (v as string) ?? '' }))} placeholder="如：右肩旧伤，避免过顶推举" />
          </Field>
        </div>

        <Divider />

        {/* 四大项 1RM */}
        <div className="text-sm font-semibold mb-3" style={{ color: 'var(--td-brand-color)' }}>
          四大项极限重量 1RM (kg)
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="深蹲">
            <InputNumber value={form.squat1RM ?? undefined} onChange={(v) => setNum('squat1RM', v)} min={0} max={500} theme="normal" placeholder="kg" />
          </Field>
          <Field label="卧推">
            <InputNumber value={form.bench1RM ?? undefined} onChange={(v) => setNum('bench1RM', v)} min={0} max={500} theme="normal" placeholder="kg" />
          </Field>
          <Field label="硬拉">
            <InputNumber value={form.deadlift1RM ?? undefined} onChange={(v) => setNum('deadlift1RM', v)} min={0} max={500} theme="normal" placeholder="kg" />
          </Field>
          <Field label="实力推">
            <InputNumber value={form.press1RM ?? undefined} onChange={(v) => setNum('press1RM', v)} min={0} max={500} theme="normal" placeholder="kg" />
          </Field>
        </div>

        {/* TX 训练目标值 */}
        <div className="text-sm font-semibold mb-3 mt-4" style={{ color: 'var(--td-brand-color)' }}>
          TX 训练目标值 (kg，长期锚点)
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Field label="蹲">
            <InputNumber value={form.txSquat ?? undefined} onChange={(v) => setNum('txSquat', v)} min={0} max={500} theme="normal" placeholder="如160" />
          </Field>
          <Field label="推(卧推)">
            <InputNumber value={form.txBench ?? undefined} onChange={(v) => setNum('txBench', v)} min={0} max={500} theme="normal" placeholder="如100" />
          </Field>
          <Field label="拉(传统拉)">
            <InputNumber value={form.txDeadlift ?? undefined} onChange={(v) => setNum('txDeadlift', v)} min={0} max={500} theme="normal" placeholder="如180" />
          </Field>
          <Field label="举(实力推)">
            <InputNumber value={form.txPress ?? undefined} onChange={(v) => setNum('txPress', v)} min={0} max={500} theme="normal" placeholder="如55" />
          </Field>
        </div>

        {/* 周期偏好 */}
        <div className="text-sm font-semibold mb-3 mt-4" style={{ color: 'var(--td-brand-color)' }}>
          周期偏好
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="起始阶段">
            <Select
              value={form.phase}
              onChange={(v) => setForm((f) => ({ ...f, phase: v as UserProfile['phase'] }))}
              placeholder="选择"
            >
              <Select.Option value="" label="完整周期（自动）" />
              <Select.Option value="foundation" label="动作框架" />
              <Select.Option value="volume" label="容量耐受" />
              <Select.Option value="strength" label="强度" />
            </Select>
          </Field>
          <Field label="计划长度 (周，可选)">
            <InputNumber value={form.programWeeks ?? undefined} onChange={(v) => setNum('programWeeks', v)} min={1} max={52} theme="normal" placeholder="周" />
          </Field>
        </div>

        {/* 1RM 估算器 */}
        <div
          className="mt-3 p-3 rounded-lg flex flex-wrap items-end gap-2"
          style={{ backgroundColor: 'var(--td-bg-color-component)' }}
        >
          <span className="text-xs w-full mb-1" style={{ color: 'var(--td-text-color-secondary)' }}>
            不知道 1RM？用「重量 × 次数」估算（Epley 公式）：
          </span>
          <Select
            value={estLift}
            onChange={(v) => setEstLift(v as typeof estLift)}
            style={{ width: 110 }}
          >
            <Select.Option value="squat1RM" label="深蹲" />
            <Select.Option value="bench1RM" label="卧推" />
            <Select.Option value="deadlift1RM" label="硬拉" />
          </Select>
          <InputNumber value={estWeight} onChange={(v) => setEstWeight(toNum(v) ?? undefined)} min={0} theme="normal" placeholder="重量" style={{ width: 100 }} />
          <span className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>kg ×</span>
          <InputNumber value={estReps} onChange={(v) => setEstReps(toNum(v) ?? undefined)} min={1} max={20} theme="normal" placeholder="次数" style={{ width: 90 }} />
          <span className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>次</span>
          <Button theme="primary" variant="outline" onClick={applyEstimate} icon={<AddIcon />}>
            估算填入
          </Button>
          {estWeight && estReps && (
            <Tag theme="success" variant="light">
              ≈ {estimate1RM(estWeight, estReps)} kg
            </Tag>
          )}
        </div>

        <Divider />

        {/* 训练记录 */}
        <div className="text-sm font-semibold mb-3" style={{ color: 'var(--td-brand-color)' }}>
          训练记录（用于 RPE 自主调节）
        </div>
        {log.length === 0 ? (
          <p className="text-xs mb-3" style={{ color: 'var(--td-text-color-placeholder)' }}>
            暂无记录。每次训练后上报实际 RPE，教练会据此动态调整后续负荷。
          </p>
        ) : (
          <div className="mb-3 flex flex-col gap-2">
            {log.slice(0, 8).map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-2 p-2 rounded-lg"
                style={{ backgroundColor: 'var(--td-bg-color-component)' }}
              >
                <span className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
                  <b style={{ color: 'var(--td-text-color-primary)' }}>{e.date}</b> · {e.lift} · {e.weight}kg × {e.reps} · RPE {e.rpe}
                  {e.note ? ` · ${e.note}` : ''}
                </span>
                <Button
                  size="small"
                  variant="text"
                  theme="danger"
                  icon={<DeleteIcon />}
                  onClick={() => onDeleteLog(e.id)}
                />
              </div>
            ))}
          </div>
        )}

        {/* 新增记录 */}
        <div
          className="p-3 rounded-lg flex flex-wrap items-end gap-2"
          style={{ backgroundColor: 'var(--td-bg-color-component)' }}
        >
          <input
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            style={{
              height: 32,
              borderRadius: 6,
              border: '1px solid var(--td-component-stroke)',
              backgroundColor: 'var(--td-bg-color-container)',
              color: 'var(--td-text-color-primary)',
              padding: '0 8px',
              fontSize: 13,
            }}
          />
          <Input value={logLift} onChange={(v) => setLogLift((v as string) ?? '')} placeholder="动作" style={{ width: 90 }} />
          <InputNumber value={logWeight} onChange={(v) => setLogWeight(toNum(v) ?? undefined)} min={0} theme="normal" placeholder="kg" style={{ width: 80 }} />
          <InputNumber value={logReps} onChange={(v) => setLogReps(toNum(v) ?? undefined)} min={1} max={30} theme="normal" placeholder="次" style={{ width: 70 }} />
          <InputNumber value={logRpe} onChange={(v) => setLogRpe(toNum(v) ?? undefined)} min={1} max={10} step={0.5} theme="normal" placeholder="RPE" style={{ width: 80 }} />
          <Input value={logSetDist} onChange={(v) => setLogSetDist((v as string) ?? '')} placeholder="逐组分布" style={{ width: 110 }} />
          <Button theme="primary" onClick={handleAddLog} icon={<AddIcon />}>
            添加
          </Button>
        </div>
        <div
          className="p-3 rounded-lg flex flex-wrap items-end gap-2 mt-2"
          style={{ backgroundColor: 'var(--td-bg-color-component)' }}
        >
          <Input value={logTech} onChange={(v) => setLogTech((v as string) ?? '')} placeholder="技术备注" style={{ width: 150 }} />
          <InputNumber value={logHR} onChange={(v) => setLogHR(toNum(v) ?? undefined)} min={30} max={120} theme="normal" placeholder="静息心率" style={{ width: 100 }} />
          <InputNumber value={logBW} onChange={(v) => setLogBW(toNum(v) ?? undefined)} min={30} max={250} theme="normal" placeholder="体重kg" style={{ width: 90 }} />
          <InputNumber value={logCal} onChange={(v) => setLogCal(toNum(v) ?? undefined)} min={0} max={6000} theme="normal" placeholder="热量kcal" style={{ width: 100 }} />
          <Input value={logNote} onChange={(v) => setLogNote((v as string) ?? '')} placeholder="其他备注" style={{ width: 120 }} />
        </div>
      </div>
    </Dialog>
  );
}

export default ProfileDialog;
