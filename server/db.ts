import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JSON 数据文件路径
const dataPath = path.join(__dirname, '..', 'data', 'chat.json');

// 确保 data 目录存在
const dataDir = path.dirname(dataPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 内存数据结构
interface DataStore {
  sessions: Record<string, DbSession>;
  messages: Record<string, DbMessage>;
  /** 训练打卡记录 */
  checkins: Record<string, DbCheckin>;
  /** 用户训练档案（单例） */
  profile: DbProfile | null;
}

// 加载数据
function loadData(): DataStore {
  if (fs.existsSync(dataPath)) {
    try {
      const raw = fs.readFileSync(dataPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<DataStore>;
      // 向后兼容：老数据文件没有 checkins / profile 字段
      return {
        sessions: parsed.sessions || {},
        messages: parsed.messages || {},
        checkins: parsed.checkins || {},
        profile: parsed.profile ?? null,
      };
    } catch {
      // 文件损坏，返回空数据
    }
  }
  return { sessions: {}, messages: {}, checkins: {}, profile: null };
}

// 保存数据
function saveData(data: DataStore): void {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
}

// 全局数据实例
let store: DataStore = loadData();

// 类型定义
export interface DbSession {
  id: string;
  title: string;
  model: string;
  sdk_session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  model: string | null;
  created_at: string;
  tool_calls: string | null;
}

/** 训练打卡记录 —— 量化记录的持久化载体 */
export interface DbCheckin {
  id: string;
  date: string;
  cycle?: string;
  phase?: 'foundation' | 'volume' | 'strength' | '';
  week?: number;
  day?: string;
  lift: string;
  sets?: number;
  reps: number;
  weight: number;
  rpe: number;
  targetRpe?: number;
  setDistribution?: string;
  techniqueNote?: string;
  restingHR?: number;
  calories?: number;
  bodyweight?: number;
  note?: string;
  dateInferred?: boolean;
  createdAt: string;
}

/** 训练档案（单例） */
export interface DbProfile {
  [key: string]: unknown;
  updatedAt?: string;
}

// ============= 会话操作 =============

// 获取所有会话
export function getAllSessions(): DbSession[] {
  return Object.values(store.sessions).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

// 获取单个会话
export function getSession(id: string): DbSession | undefined {
  return store.sessions[id];
}

// 创建会话
export function createSession(session: DbSession): DbSession {
  store.sessions[session.id] = session;
  saveData(store);
  return session;
}

// 更新会话
export function updateSession(id: string, updates: Partial<Pick<DbSession, 'title' | 'model' | 'sdk_session_id'>>): boolean {
  const session = store.sessions[id];
  if (!session) return false;

  if (updates.title !== undefined) session.title = updates.title;
  if (updates.model !== undefined) session.model = updates.model;
  if (updates.sdk_session_id !== undefined) session.sdk_session_id = updates.sdk_session_id;
  session.updated_at = new Date().toISOString();

  saveData(store);
  return true;
}

// 删除会话
export function deleteSession(id: string): boolean {
  if (!store.sessions[id]) return false;

  delete store.sessions[id];
  // 删除关联的消息
  for (const msgId of Object.keys(store.messages)) {
    if (store.messages[msgId].session_id === id) {
      delete store.messages[msgId];
    }
  }
  saveData(store);
  return true;
}

// ============= 消息操作 =============

// 获取会话的所有消息
export function getMessagesBySession(sessionId: string): DbMessage[] {
  return Object.values(store.messages)
    .filter(msg => msg.session_id === sessionId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

// 创建消息
export function createMessage(message: DbMessage): DbMessage {
  store.messages[message.id] = message;
  // 更新会话的 updated_at
  const session = store.sessions[message.session_id];
  if (session) {
    session.updated_at = new Date().toISOString();
  }
  saveData(store);
  return message;
}

// 更新消息内容
export function updateMessage(id: string, updates: Partial<Pick<DbMessage, 'content' | 'tool_calls'>>): boolean {
  const msg = store.messages[id];
  if (!msg) return false;

  if (updates.content !== undefined) msg.content = updates.content;
  if (updates.tool_calls !== undefined) msg.tool_calls = updates.tool_calls;

  saveData(store);
  return true;
}

// 删除消息
export function deleteMessage(id: string): boolean {
  if (!store.messages[id]) return false;
  delete store.messages[id];
  saveData(store);
  return true;
}

// 批量创建消息（用于保存对话）
export function createMessages(messages: DbMessage[]): void {
  for (const msg of messages) {
    store.messages[msg.id] = msg;
  }
  saveData(store);
}

// ============= 训练打卡操作 =============

/** 按日期正序返回全部打卡记录 */
export function getAllCheckins(): DbCheckin[] {
  return Object.values(store.checkins).sort((a, b) => {
    const d = (a.date || '').localeCompare(b.date || '');
    if (d !== 0) return d;
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });
}

/** 创建一条打卡记录 */
export function createCheckin(entry: DbCheckin): DbCheckin {
  store.checkins[entry.id] = entry;
  saveData(store);
  return entry;
}

/** 批量创建（用于导入历史数据） */
export function createCheckins(entries: DbCheckin[]): DbCheckin[] {
  for (const e of entries) {
    store.checkins[e.id] = e;
  }
  saveData(store);
  return entries;
}

/** 更新一条打卡记录 */
export function updateCheckin(id: string, updates: Partial<DbCheckin>): DbCheckin | null {
  const cur = store.checkins[id];
  if (!cur) return null;
  const next = { ...cur, ...updates, id };
  store.checkins[id] = next;
  saveData(store);
  return next;
}

/** 删除一条打卡记录 */
export function deleteCheckin(id: string): boolean {
  if (!store.checkins[id]) return false;
  delete store.checkins[id];
  saveData(store);
  return true;
}

/** 清空全部打卡记录 */
export function clearCheckins(): void {
  store.checkins = {};
  saveData(store);
}

// ============= 训练档案操作 =============

export function getProfile(): DbProfile | null {
  return store.profile;
}

export function saveProfile(profile: DbProfile): DbProfile {
  const next: DbProfile = { ...profile, updatedAt: new Date().toISOString() };
  store.profile = next;
  saveData(store);
  return next;
}

// 清空所有数据
export function clearAllData(): void {
  store = { sessions: {}, messages: {}, checkins: {}, profile: null };
  saveData(store);
}

// 默认导出（兼容性）
export default {
  getAllSessions, getSession, createSession, updateSession, deleteSession,
  getMessagesBySession, createMessage, updateMessage, deleteMessage, createMessages,
  getAllCheckins, createCheckin, createCheckins, updateCheckin, deleteCheckin, clearCheckins,
  getProfile, saveProfile,
  clearAllData,
};
