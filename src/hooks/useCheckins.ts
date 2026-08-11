import { useState, useCallback, useEffect } from 'react';
import { CheckinEntry, AdviceItem, TrainingLogEntry, UserProfile, PhaseKey } from '../types';
// 引擎是纯 TypeScript，无任何 Node 依赖，可直接在浏览器内运行
import {
  adviseNextSession,
  getDayPrescription,
  listPhases,
  generatePlan,
} from '../../server/planGenerator';

/** 处方中的一行动作（与后端 PrescriptionRow 对齐） */
export type PrescriptionRow = import('../../server/planGenerator').PrescriptionRow;
/** 某一训练日的处方（与后端 DayPrescription 对齐） */
export type DayPrescription = import('../../server/planGenerator').DayPrescription;
/** 阶段元信息（直接取自 listPhases 返回值，保证字段一致） */
export type PhaseMeta = ReturnType<typeof listPhases>[number];

interface PrescriptionQuery {
  phase?: PhaseKey | 'auto' | '';
  week?: number;
  day?: string;
}

const LS_KEY = 'st_checkins_v1';

function loadCheckins(): CheckinEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as CheckinEntry[]) : [];
  } catch {
    return [];
  }
}

function saveCheckins(list: CheckinEntry[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {
    /* 隐私模式 / 配额满时静默失败，不影响 UI */
  }
}

/**
 * 训练打卡 —— 纯浏览器本地持久化 + 引擎直驱的量化记录 Hook
 *
 * 与早期「服务端 JSON」版本不同，这里：
 *  - 记录存在浏览器 localStorage（刷新、关页都不丢，且每个用户各自独立）；
 *  - 处方与 RPE 调节由 planGenerator 引擎在本地实时计算，无需任何后端；
 *  - 因此整个「计划生成 + 训练打卡 + RPE 调节」都是离线可用的，
 *    可以打包成静态网页直接分享（Vercel / Netlify / CloudStudio / GitHub Pages）。
 */
export function useCheckins(profile: UserProfile) {
  const [checkins, setCheckins] = useState<CheckinEntry[]>(() => loadCheckins());
  const [advice, setAdvice] = useState<AdviceItem[]>([]);
  const [prescription, setPrescription] = useState<DayPrescription | null>(null);
  const [phases] = useState<PhaseMeta[]>(() => listPhases());
  const [query, setQuery] = useState<PrescriptionQuery>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 重新计算处方 + 调节建议（checkins / profile / query 任一变化时调用） */
  const recompute = useCallback(
    (q: PrescriptionQuery, list: CheckinEntry[], prof: UserProfile) => {
      const phase = (q.phase && q.phase !== 'auto' ? q.phase : 'auto') as PhaseKey | 'auto';
      const presc = getDayPrescription(prof as any, list as any, { ...q, phase });
      setPrescription(presc);
      setAdvice(adviseNextSession(prof as any, list as any, phase) as AdviceItem[]);
    },
    [],
  );

  useEffect(() => {
    recompute(query, checkins, profile);
  }, [query, checkins, profile, recompute]);

  /** 拉取全部打卡记录（兼容旧调用，本地即内存态） */
  const fetchCheckins = useCallback(async () => checkins, [checkins]);

  /** 计算下次训练处方（已叠加 RPE 调节），同步返回供 CheckinPage 自动推断训练日 */
  const fetchPrescription = useCallback(
    async (q: PrescriptionQuery = {}) => {
      const merged = { ...query, ...q };
      setQuery(merged);
      const phase = (merged.phase && merged.phase !== 'auto' ? merged.phase : 'auto') as PhaseKey | 'auto';
      const presc = getDayPrescription(profile as any, checkins as any, { ...merged, phase });
      setPrescription(presc);
      setAdvice(adviseNextSession(profile as any, checkins as any, phase) as AdviceItem[]);
      return presc;
    },
    [profile, checkins, query],
  );

  const makeId = () => 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

  /** 新增一条打卡记录 */
  const addCheckin = useCallback(
    async (entry: Omit<CheckinEntry, 'id'>) => {
      setLoading(true);
      try {
        const full: CheckinEntry = { ...entry, id: makeId() };
        const next = [...checkins, full];
        setCheckins(next);
        saveCheckins(next);
        const phase = (query.phase && query.phase !== 'auto' ? query.phase : 'auto') as PhaseKey | 'auto';
        const adv = adviseNextSession(profile as any, next as any, phase) as AdviceItem[];
        setAdvice(adv);
        return { checkin: full, advice: adv };
      } finally {
        setLoading(false);
      }
    },
    [checkins, profile, query],
  );

  /** 批量导入历史记录 */
  const bulkImport = useCallback(
    async (entries: Array<Omit<CheckinEntry, 'id'>>, replace = false) => {
      setLoading(true);
      try {
        const withId: CheckinEntry[] = entries.map(e => ({ ...e, id: makeId() }));
        const next = replace ? withId : [...checkins, ...withId];
        setCheckins(next);
        saveCheckins(next);
        const phase = (query.phase && query.phase !== 'auto' ? query.phase : 'auto') as PhaseKey | 'auto';
        setAdvice(adviseNextSession(profile as any, next as any, phase) as AdviceItem[]);
        return { imported: withId.length, total: next.length } as { imported: number; total: number };
      } finally {
        setLoading(false);
      }
    },
    [checkins, profile, query],
  );

  /** 删除一条记录 */
  const deleteCheckin = useCallback(
    async (id: string) => {
      const next = checkins.filter(c => c.id !== id);
      setCheckins(next);
      saveCheckins(next);
    },
    [checkins],
  );

  /** 清空全部记录 */
  const clearAll = useCallback(async () => {
    setCheckins([]);
    saveCheckins([]);
  }, []);

  /**
   * 档案同步 —— 本地版档案由 useUserProfile 存 localStorage，这里无需再写后端，
   * 保留为空操作以保证 handleImportSeed 的调用形态不变。
   */
  const syncProfile = useCallback(async (_profile: unknown) => {
    /* no-op：档案已在浏览器本地持久化 */
  }, []);

  /**
   * 兼容旧的 TrainingLogEntry 接口 —— 让 ProfileDialog 等既有组件
   * 无需改造即可读取打卡数据
   */
  const log: TrainingLogEntry[] = checkins
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .map(c => ({
      id: c.id,
      date: c.date,
      lift: c.lift,
      weight: c.weight,
      reps: c.reps,
      rpe: c.rpe,
      setDistribution: c.setDistribution,
      techniqueNote: c.techniqueNote,
      restingHR: c.restingHR,
      calories: c.calories,
      bodyweight: c.bodyweight,
      note: c.note,
    }));

  return {
    checkins,
    log,
    advice,
    prescription,
    phases,
    loading,
    error,
    fetchCheckins,
    fetchPrescription,
    addCheckin,
    bulkImport,
    deleteCheckin,
    clearAll,
    syncProfile,
    generatePlan,
  };
}
