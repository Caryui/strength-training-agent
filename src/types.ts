/**
 * 类型定义
 */

export type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';

export interface Model {
  modelId: string;
  name: string;
  description?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input?: Record<string, unknown>;
  status: 'running' | 'completed' | 'error';
  result?: string;
  isError?: boolean;
}

/**
 * 内容块类型 - 支持文字和工具调用按顺序排列
 */
export type ContentBlock = 
  | { type: 'text'; text: string }
  | { type: 'tool_use'; toolCall: ToolCall };

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;  // 保留用于兼容，存储纯文本摘要
  model?: string;
  timestamp: Date;
  isStreaming?: boolean;
  isError?: boolean;  // 标记该助手消息为错误信息（如 SDK 鉴权失败）
  toolCalls?: ToolCall[];  // 保留用于兼容
  contentBlocks?: ContentBlock[];  // 新增：按顺序排列的内容块
}

export interface Session {
  id: string;
  title: string;
  model: string;
  agentId?: string;
  cwd?: string;
  permissionMode?: PermissionMode;
  createdAt: Date;
  messages: Message[];
}

export interface CustomAgent {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  icon?: string;
  color?: string;
  permissionMode?: PermissionMode;
  createdAt: Date;
  updatedAt: Date;
}

// Agent 是 CustomAgent 的别名
export type Agent = CustomAgent;

export type Theme = 'light' | 'dark';

/**
 * 用户个人基础数据 + 三大项极限重量（1RM）
 */
export interface UserProfile {
  /** 身高 (cm) */
  height: number | null;
  /** 体重 (kg) */
  weight: number | null;
  /** 年龄 */
  age: number | null;
  /** 性别 */
  gender: 'male' | 'female' | 'other' | '';
  /** 训练经验 */
  experience: 'beginner' | 'intermediate' | 'advanced' | '';
  /** 训练目标（自由文本，如：增肌/最大力量/减脂） */
  goal: string;
  /** 每周训练天数 */
  frequency: number | null;
  /** 可用器械描述 */
  equipment: string;
  /** 伤病 / 动作限制 */
  injuries: string;
  /** 深蹲 1RM (kg) */
  squat1RM: number | null;
  /** 卧推 1RM (kg) */
  bench1RM: number | null;
  /** 硬拉 1RM (kg) */
  deadlift1RM: number | null;
  /** 实力推 1RM (kg) —— 四大项之「举」 */
  press1RM: number | null;
  /** TX 训练目标值：深蹲 (kg) */
  txSquat: number | null;
  /** TX 训练目标值：卧推 (kg) */
  txBench: number | null;
  /** TX 训练目标值：传统拉 (kg) */
  txDeadlift: number | null;
  /** TX 训练目标值：实力推 (kg) */
  txPress: number | null;
  /** 周期偏好：从哪个阶段开始（auto=完整周期） */
  phase: 'auto' | 'foundation' | 'volume' | 'strength' | '';
  /** 计划周期长度（周，可选） */
  programWeeks: number | null;
  /** 最后更新时间 (ISO) */
  updatedAt: string;
}

/**
 * 训练记录条目（用于 RPE 自主调节）
 */
export interface TrainingLogEntry {
  id: string;
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 动作名称（深蹲/卧推/硬拉/实力推/...） */
  lift: string;
  /** 完成重量 (kg) */
  weight: number;
  /** 完成次数 */
  reps: number;
  /** 实际 RPE (1-10) */
  rpe: number;
  /** 逐组重量分布，如 "85-87.5-90" */
  setDistribution?: string;
  /** 技术备注 */
  techniqueNote?: string;
  /** 平均静息心率 (bpm) */
  restingHR?: number;
  /** 热量摄入 (kcal) */
  calories?: number;
  /** 体重 (kg) */
  bodyweight?: number;
  /** 备注（可选） */
  note?: string;
}

/** 周期阶段 */
export type PhaseKey = 'foundation' | 'volume' | 'strength';

/**
 * 训练打卡记录 —— 服务端持久化的量化记录
 * 是 TrainingLogEntry 的超集，可直接喂给 RPE 调节引擎
 */
export interface CheckinEntry {
  id: string;
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 所属周期标识，如 C1 / C2 / C3 */
  cycle?: string;
  /** 所属阶段 */
  phase?: PhaseKey | '';
  /** 周次（阶段内，1-based） */
  week?: number;
  /** 训练日 D1-D4 */
  day?: string;
  /** 动作名称 */
  lift: string;
  /** 组数 */
  sets?: number;
  /** 每组次数 */
  reps: number;
  /** 顶组重量 (kg) */
  weight: number;
  /** 实际 RPE (1-10) */
  rpe: number;
  /** 计划目标 RPE */
  targetRpe?: number;
  /** 逐组重量分布，如 "85-87.5-90" */
  setDistribution?: string;
  /** 技术备注 */
  techniqueNote?: string;
  /** 平均静息心率 (bpm) */
  restingHR?: number;
  /** 热量摄入 (kcal) */
  calories?: number;
  /** 当日体重 (kg) */
  bodyweight?: number;
  /** 其他备注 */
  note?: string;
  /** 日期是否为推断值（表格未标注日期时） */
  dateInferred?: boolean;
  /** 记录创建时间 (ISO) */
  createdAt?: string;
  /** 同一训练场次标识：一次「保存本次训练」内的所有动作共享，便于按场次聚合展示 */
  sessionId?: string;
}

/** 单个动作的下次训练调节建议 */
export interface AdviceItem {
  /** 主项键 */
  lift: 'squat' | 'bench' | 'deadlift' | 'press';
  /** 中文名 */
  liftName: string;
  /** 是否有可用记录 */
  found: boolean;
  loggedWeight?: number;
  loggedReps?: number;
  loggedRPE?: number;
  loggedDate?: string;
  /** Epley 估算 1RM */
  est1RM?: number;
  targetRPE: number;
  /** 调节系数（0.95 / 1 / 1.025） */
  factor: number;
  /** 建议下次负荷 */
  suggestedLoad?: number | null;
  /** 调节方向 */
  direction: 'up' | 'down' | 'hold' | 'none';
  note: string;
}

/**
 * 权限请求 - 用于工具调用确认
 */
export interface PermissionRequest {
  requestId: string;
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
  sessionId: string;
  timestamp: number;
}

/**
 * 权限响应
 */
export interface PermissionResponse {
  requestId: string;
  behavior: 'allow' | 'deny';
  message?: string;
}
