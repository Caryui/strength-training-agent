import { useState, useCallback } from 'react';
import { UserProfile, TrainingLogEntry } from '../types';

const PROFILE_KEY = 'st_profile';
const LOG_KEY = 'st_log';
const MAX_LOG = 100;

export const EMPTY_PROFILE: UserProfile = {
  height: null,
  weight: null,
  age: null,
  gender: '',
  experience: '',
  goal: '',
  frequency: null,
  equipment: '',
  injuries: '',
  squat1RM: null,
  bench1RM: null,
  deadlift1RM: null,
  press1RM: null,
  txSquat: null,
  txBench: null,
  txDeadlift: null,
  txPress: null,
  phase: '',
  programWeeks: null,
  updatedAt: '',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save', key, e);
  }
}

/**
 * 个人档案 + 训练记录 的本地存储 Hook
 */
export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile>(() => load(PROFILE_KEY, EMPTY_PROFILE));
  const [log, setLog] = useState<TrainingLogEntry[]>(() => load(LOG_KEY, []));

  const saveProfile = useCallback((p: UserProfile) => {
    const next: UserProfile = { ...p, updatedAt: new Date().toISOString() };
    setProfile(next);
    save(PROFILE_KEY, next);
  }, []);

  const addLogEntry = useCallback((entry: Omit<TrainingLogEntry, 'id'>) => {
    const full: TrainingLogEntry = { ...entry, id: crypto.randomUUID() };
    setLog(prev => {
      const next = [full, ...prev].slice(0, MAX_LOG);
      save(LOG_KEY, next);
      return next;
    });
  }, []);

  const deleteLogEntry = useCallback((id: string) => {
    setLog(prev => {
      const next = prev.filter(e => e.id !== id);
      save(LOG_KEY, next);
      return next;
    });
  }, []);

  const clearLog = useCallback(() => {
    setLog([]);
    try {
      localStorage.removeItem(LOG_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { profile, log, saveProfile, addLogEntry, deleteLogEntry, clearLog };
}
