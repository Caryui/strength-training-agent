/**
 * Excel 真实数据种子 —— 还原自 F:/Desktop/力量训练计划.xlsx
 * ----------------------------------------------------------------------------
 * 数据来源：教练手工维护的三个训练周期表
 *   C1 «动作框架»   2026-03-25 ~ 2026-04-27   高杠蹲 5×5 线性爬坡 70 → 107.5kg
 *   C2 «容量耐受»   2026-05-06 ~ 2026-06-11   双进阶 5→10 组，蹲 65 → 100kg / 推 50 → 65kg
 *   C3 «强度»       2026-06-17 ~ 2026-06-28   降次数至 6×6，重新爬坡
 *
 * 表格明确写死的长期北极星（教练备注2）：
 *   TX 取： 蹲 160 / 推 100 / 拉 180 / 举 55
 *
 * 日期处理：表格中部分行未标注日期。依据教练写明的训练节奏「练练休练练休休」
 * （D1 D2 休 D3 D4 休 休）与已知锚点日期（0518 / 0523 / 0527 / 0529 / 0531 /
 * 0602 / 0606 / 0607 / 0610 / 0611）反推，推断出的日期以 dateInferred 标记，
 * 不与原始数据混淆。
 */

import type { UserProfile, CheckinEntry } from '../types';

/** 种子记录（尚未分配 id / createdAt） */
export type SeedCheckin = Omit<CheckinEntry, 'id' | 'createdAt'>;

interface SeedItem {
  lift: string;
  sets: number;
  reps: number;
  /** 顶组重量 */
  weight: number;
  rpe?: number;
  dist?: string;
  tech?: string;
  note?: string;
}

interface SeedSession {
  date: string;
  inferred?: boolean;
  cycle: string;
  phase: 'foundation' | 'volume' | 'strength';
  week: number;
  day: string;
  /** 当日全局指标 */
  restingHR?: number;
  bodyweight?: number;
  calories?: number;
  items: SeedItem[];
}

// ============================================================================
// C1 «动作框架» —— 技术优先，5×5 低 RPE 线性爬坡
// ============================================================================

const C1: SeedSession[] = [
  {
    date: '2026-03-25', cycle: 'C1', phase: 'foundation', week: 1, day: 'D1',
    items: [
      { lift: '高杠蹲', sets: 5, reps: 5, weight: 70, rpe: 7, tech: '动作学习' },
      { lift: '卧推', sets: 5, reps: 5, weight: 50, rpe: 5, tech: '基本起桥' },
      { lift: '潘德雷划船', sets: 3, reps: 8, weight: 50, rpe: 6, tech: '筒式支撑训练' },
    ],
  },
  {
    date: '2026-03-27', cycle: 'C1', phase: 'foundation', week: 1, day: 'D2',
    items: [
      { lift: '高杠蹲', sets: 5, reps: 5, weight: 72.5, rpe: 5, tech: '动作学习' },
      { lift: '实力推', sets: 5, reps: 5, weight: 30, rpe: 5, tech: '握法四步', note: '区间 25~30kg' },
      { lift: '反手引体', sets: 3, reps: 15, weight: 0, rpe: 8, dist: '15-5(负重5kg)-8(负重5kg)', note: 'amrap' },
    ],
  },
  {
    date: '2026-03-29', cycle: 'C1', phase: 'foundation', week: 1, day: 'D3',
    items: [
      { lift: '高杠蹲', sets: 5, reps: 5, weight: 75, rpe: 6, tech: '动作学习' },
      { lift: '传统拉', sets: 1, reps: 5, weight: 75, rpe: 5 },
      { lift: '罗马尼亚硬拉（哑铃）', sets: 2, reps: 8, weight: 20, rpe: 6 },
      { lift: '二头弯举', sets: 3, reps: 10, weight: 12.5, rpe: 7 },
    ],
  },
  {
    date: '2026-04-05', cycle: 'C1', phase: 'foundation', week: 2, day: 'D1',
    items: [
      { lift: '高杠蹲', sets: 5, reps: 5, weight: 77.5, rpe: 6, tech: '动作学习', note: '先奠定基础动作，压制 RPE' },
      { lift: '传统拉', sets: 1, reps: 5, weight: 75, rpe: 5 },
      { lift: '罗马尼亚硬拉（哑铃）', sets: 2, reps: 8, weight: 20, rpe: 6 },
      { lift: '二头弯举', sets: 3, reps: 10, weight: 12.5, rpe: 7 },
    ],
  },
  {
    date: '2026-04-08', cycle: 'C1', phase: 'foundation', week: 3, day: 'D1',
    items: [
      { lift: '高杠蹲', sets: 5, reps: 5, weight: 85, rpe: 5, tech: '动作质量优先', note: '区间 80~85kg，限制 RPE7' },
      { lift: '卧推', sets: 5, reps: 5, weight: 60, rpe: 5, tech: '基本起桥' },
      { lift: '潘德雷划船', sets: 3, reps: 8, weight: 55, rpe: 10, tech: '筒式支撑训练', note: '趴拉（动作失误）' },
    ],
  },
  {
    date: '2026-04-10', inferred: true, cycle: 'C1', phase: 'foundation', week: 3, day: 'D2',
    items: [
      { lift: '高杠蹲', sets: 5, reps: 5, weight: 90, rpe: 7, tech: '动作学习' },
      { lift: '实力推', sets: 5, reps: 5, weight: 35, rpe: 6, tech: '握法四步' },
      { lift: '反手引体', sets: 3, reps: 15, weight: 5, rpe: 8, dist: '10(5kg)-7(5kg)-8(5kg)', note: 'amrap' },
    ],
  },
  {
    date: '2026-04-12', inferred: true, cycle: 'C1', phase: 'foundation', week: 3, day: 'D3',
    items: [
      { lift: '高杠蹲', sets: 5, reps: 5, weight: 92.5, rpe: 7, tech: '撑髋展膝做好' },
      { lift: '传统拉', sets: 1, reps: 5, weight: 80, rpe: 5 },
      { lift: '罗马尼亚硬拉（哑铃）', sets: 2, reps: 8, weight: 20, rpe: 5 },
      { lift: '二头弯举', sets: 3, reps: 10, weight: 12.5, rpe: 7 },
    ],
  },
  {
    date: '2026-04-15', cycle: 'C1', phase: 'foundation', week: 4, day: 'D1',
    items: [
      { lift: '高杠蹲', sets: 5, reps: 5, weight: 95, rpe: 7, dist: '90-92.5-95-95-95', tech: '下腹兜住不够，展膝加强，上胸尚需含住' },
      { lift: '卧推', sets: 5, reps: 5, weight: 65, rpe: 5, tech: '基本起桥' },
      { lift: '潘德雷划船', sets: 3, reps: 8, weight: 55, rpe: 7, tech: '务必不能趴拉，实际臀位偏高', note: '前 2 组重量加错至 65kg，动作发力尚不顺畅' },
    ],
  },
  {
    date: '2026-04-17', cycle: 'C1', phase: 'foundation', week: 4, day: 'D2',
    items: [
      { lift: '高杠蹲', sets: 5, reps: 5, weight: 97.5, rpe: 7, dist: '90-92.5-95-97.5-97.5' },
      { lift: '实力推', sets: 5, reps: 5, weight: 37.5, rpe: 6, tech: '握法四步' },
      { lift: '反手引体', sets: 3, reps: 15, weight: 0, rpe: 8, dist: '10-6-5', note: 'amrap' },
    ],
  },
  {
    date: '2026-04-19', cycle: 'C1', phase: 'foundation', week: 4, day: 'D3',
    items: [
      { lift: '高杠蹲', sets: 5, reps: 5, weight: 100, rpe: 7, dist: '90-95-97.5-100-100' },
      { lift: '传统拉', sets: 1, reps: 5, weight: 90, rpe: 5 },
      { lift: '罗马尼亚硬拉（哑铃）', sets: 2, reps: 8, weight: 20, rpe: 5, tech: '屈髋不够，臀位需要再低一点' },
      { lift: '二头弯举', sets: 3, reps: 12, weight: 12.5, rpe: 7 },
    ],
  },
  {
    date: '2026-04-21', cycle: 'C1', phase: 'foundation', week: 5, day: 'D1',
    items: [
      { lift: '高杠蹲', sets: 5, reps: 5, weight: 102.5, rpe: 8, dist: '95-100-100-102.5-102.5' },
      { lift: '卧推', sets: 5, reps: 5, weight: 70, rpe: 9, tech: '基本起桥' },
      { lift: '潘德雷划船', sets: 3, reps: 8, weight: 55, rpe: 10, note: '未完成' },
    ],
  },
  {
    date: '2026-04-23', cycle: 'C1', phase: 'foundation', week: 5, day: 'D2',
    items: [
      { lift: '高杠蹲', sets: 5, reps: 5, weight: 105, rpe: 8, dist: '95-100-102.5-105-105' },
      { lift: '实力推', sets: 5, reps: 5, weight: 40, rpe: 7, tech: '握法四步' },
      { lift: '反手引体', sets: 3, reps: 15, weight: 0, rpe: 8, dist: '10-9-6', note: 'amrap' },
    ],
  },
  {
    date: '2026-04-27', cycle: 'C1', phase: 'foundation', week: 6, day: 'D1',
    items: [
      { lift: '高杠蹲', sets: 5, reps: 5, weight: 107.5, rpe: 8, dist: '100-100-102.5-105-107.5' },
      { lift: '传统拉', sets: 2, reps: 5, weight: 100, rpe: 6, dist: '95-100', tech: '臀位过高' },
      { lift: '潘德雷划船', sets: 3, reps: 8, weight: 50, rpe: 6, tech: '动作学习，压制重量', note: '本周期结束，停训一周开新周期' },
    ],
  },
];

// ============================================================================
// C2 «容量耐受» —— 双进阶：组数 5 → 10，负荷同步爬坡
// ============================================================================

const C2: SeedSession[] = [
  {
    date: '2026-05-06', inferred: true, cycle: 'C2', phase: 'volume', week: 1, day: 'D1',
    items: [
      { lift: '高杠蹲', sets: 5, reps: 8, weight: 65, rpe: 6, tech: '要非常筒', note: '极低开，按流程口令慢速做' },
      { lift: '传统拉', sets: 2, reps: 6, weight: 65, rpe: 6, tech: '筒式支撑' },
      { lift: '仰卧举腿', sets: 3, reps: 12, weight: 0, rpe: 7, tech: '慢下三秒' },
    ],
  },
  {
    date: '2026-05-07', inferred: true, cycle: 'C2', phase: 'volume', week: 1, day: 'D2',
    items: [
      { lift: '卧推', sets: 5, reps: 8, weight: 50, rpe: 6, tech: '握法四步' },
      { lift: '潘德雷划船', sets: 3, reps: 8, weight: 45, rpe: 6, tech: '筒式支撑' },
      { lift: '面拉', sets: 3, reps: 15, weight: 5, rpe: 6, tech: '慢速离心' },
    ],
  },
  {
    date: '2026-05-09', inferred: true, cycle: 'C2', phase: 'volume', week: 1, day: 'D3',
    items: [
      { lift: '高杠蹲', sets: 5, reps: 10, weight: 70, rpe: 7, tech: '要非常筒', note: '极低开，按流程口令慢速做' },
      { lift: '传统拉', sets: 2, reps: 6, weight: 70, rpe: 6, tech: '筒式支撑' },
      { lift: '仰卧举腿', sets: 3, reps: 12, weight: 0, rpe: 7, tech: '慢下三秒' },
    ],
  },
  {
    date: '2026-05-11', inferred: true, cycle: 'C2', phase: 'volume', week: 1, day: 'D4',
    items: [
      { lift: '卧推', sets: 6, reps: 10, weight: 55, rpe: 8, dist: '50-50-52.5-52.5-55-55', tech: '握法四步' },
      { lift: '实力推', sets: 3, reps: 8, weight: 35, rpe: 10, tech: '握法四步', note: '最后一组没做完，只做 6 个' },
      { lift: '潘德雷划船', sets: 3, reps: 8, weight: 50, rpe: 7, tech: '筒式支撑' },
    ],
  },
  {
    date: '2026-05-13', inferred: true, cycle: 'C2', phase: 'volume', week: 2, day: 'D1',
    items: [
      { lift: '高杠蹲', sets: 6, reps: 10, weight: 72.5, rpe: 7, dist: '70-70-70-70-72.5-72.5', tech: '要非常筒' },
      { lift: '传统拉', sets: 2, reps: 6, weight: 70, rpe: 6 },
      { lift: '仰卧举腿', sets: 3, reps: 15, weight: 0, rpe: 7, tech: '慢下三秒' },
    ],
  },
  {
    date: '2026-05-14', inferred: true, cycle: 'C2', phase: 'volume', week: 2, day: 'D2',
    items: [
      { lift: '卧推', sets: 6, reps: 10, weight: 45, rpe: 7, tech: '握法四步' },
      { lift: '潘德雷划船', sets: 3, reps: 8, weight: 50, rpe: 7, dist: '45-50-50', tech: '筒式支撑' },
      { lift: '面拉', sets: 3, reps: 18, weight: 5, rpe: 6, tech: '慢速离心' },
    ],
  },
  {
    date: '2026-05-16', inferred: true, cycle: 'C2', phase: 'volume', week: 2, day: 'D3',
    items: [
      { lift: '高杠蹲', sets: 6, reps: 10, weight: 75, rpe: 7, dist: '70-70-72.5-72.5-75-75', tech: '要非常筒' },
      { lift: '传统拉', sets: 2, reps: 6, weight: 72.5, rpe: 6 },
      { lift: '仰卧举腿', sets: 3, reps: 16, weight: 0, rpe: 7, tech: '慢下三秒' },
    ],
  },
  {
    date: '2026-05-18', cycle: 'C2', phase: 'volume', week: 2, day: 'D4', restingHR: 7,
    items: [
      { lift: '卧推', sets: 7, reps: 10, weight: 50, rpe: 7, dist: '45-45-47.5-47.5-50-50-50', tech: '握法四步' },
      { lift: '实力推', sets: 3, reps: 8, weight: 25, rpe: 6, tech: '注意进肩', note: '动作好就行' },
      { lift: '潘德雷划船', sets: 3, reps: 8, weight: 50, rpe: 7, tech: '筒式支撑' },
    ],
  },
  {
    date: '2026-05-20', inferred: true, cycle: 'C2', phase: 'volume', week: 3, day: 'D1',
    items: [
      { lift: '高杠蹲', sets: 7, reps: 10, weight: 77.5, rpe: 7, dist: '72.5-72.5-75-75-77.5-77.5-77.5', tech: '要非常筒' },
      { lift: '传统拉', sets: 2, reps: 6, weight: 75, rpe: 6 },
      { lift: '仰卧举腿', sets: 3, reps: 18, weight: 0, rpe: 8, tech: '慢下三秒', note: '一口气做到 12 个后需要注意后才能完成一组' },
    ],
  },
  {
    date: '2026-05-21', inferred: true, cycle: 'C2', phase: 'volume', week: 3, day: 'D2', restingHR: 6,
    items: [
      { lift: '卧推', sets: 8, reps: 10, weight: 52.5, rpe: 7, dist: '47.5-47.5-50-50-50-52.5-52.5-52.5', tech: '握法四步' },
      { lift: '潘德雷划船', sets: 3, reps: 8, weight: 50, rpe: 7, tech: '筒式支撑' },
      { lift: '面拉', sets: 3, reps: 18, weight: 5, rpe: 6, tech: '慢速离心' },
    ],
  },
  {
    date: '2026-05-23', cycle: 'C2', phase: 'volume', week: 3, day: 'D3',
    items: [
      { lift: '高杠蹲', sets: 8, reps: 10, weight: 80, rpe: 7, dist: '75-75-77.5-77.5-77.5-80-80-80', tech: '要非常筒' },
      { lift: '传统拉', sets: 2, reps: 6, weight: 77.5, rpe: 6 },
      { lift: '仰卧举腿', sets: 3, reps: 20, weight: 0, rpe: 8, tech: '慢下三秒' },
    ],
  },
  {
    date: '2026-05-24', inferred: true, cycle: 'C2', phase: 'volume', week: 3, day: 'D4',
    items: [
      { lift: '卧推', sets: 8, reps: 10, weight: 55, rpe: 7, dist: '50-50-52.5-52.5-52.5-55-55-55', tech: '握法四步' },
      { lift: '实力推', sets: 3, reps: 8, weight: 27.5, rpe: 6, tech: '注意进肩', note: '动作好就行' },
      { lift: '潘德雷划船', sets: 3, reps: 8, weight: 55, rpe: 7, dist: '50-50-55', tech: '筒式支撑' },
    ],
  },
  {
    date: '2026-05-27', cycle: 'C2', phase: 'volume', week: 4, day: 'D1',
    items: [
      { lift: '高杠蹲', sets: 8, reps: 10, weight: 85, rpe: 7.5, dist: '77.5-77.5-80-80-80-82.5-85-85', tech: '要非常筒' },
      { lift: '传统拉', sets: 2, reps: 6, weight: 80, rpe: 6 },
      { lift: '仰卧举腿', sets: 3, reps: 8, weight: 3, rpe: 8, tech: '慢下三秒，负重 3kg' },
    ],
  },
  {
    date: '2026-05-29', cycle: 'C2', phase: 'volume', week: 4, day: 'D2', restingHR: 6,
    items: [
      { lift: '卧推', sets: 9, reps: 10, weight: 57.5, rpe: 7.5, dist: '52.5-52.5-52.5-55-55-55-55-55-57.5', tech: '握法四步', note: '组间休息时间短，影响 RPE' },
      { lift: '潘德雷划船', sets: 3, reps: 8, weight: 55, rpe: 7.5, tech: '筒式支撑' },
      { lift: '面拉', sets: 3, reps: 20, weight: 5, rpe: 6, tech: '慢速离心' },
    ],
  },
  {
    date: '2026-05-31', cycle: 'C2', phase: 'volume', week: 4, day: 'D3',
    items: [
      { lift: '高杠蹲', sets: 9, reps: 10, weight: 90, rpe: 7, dist: '80-80-82.5-82.5-85-85-87.5-90-90', tech: '要非常筒', note: '观察 RPE，蹲腿 2 小时' },
      { lift: '传统拉', sets: 2, reps: 6, weight: 82.5, rpe: 6 },
      { lift: '仰卧举腿', sets: 3, reps: 10, weight: 3, rpe: 8, tech: '慢下三秒，负重 3kg' },
    ],
  },
  {
    date: '2026-06-02', cycle: 'C2', phase: 'volume', week: 4, day: 'D4',
    items: [
      { lift: '卧推', sets: 9, reps: 10, weight: 60, rpe: 7, dist: '55-55-55-57.5-57.5-57.5-60-60-60', tech: '握法四步' },
      { lift: '实力推', sets: 3, reps: 8, weight: 30, rpe: 7, tech: '注意进肩', note: '动作好就行' },
      { lift: '潘德雷划船', sets: 4, reps: 8, weight: 55, rpe: 7, tech: '筒式支撑' },
    ],
  },
  {
    date: '2026-06-06', cycle: 'C2', phase: 'volume', week: 5, day: 'D1', restingHR: 6,
    items: [
      { lift: '高杠蹲', sets: 9, reps: 10, weight: 92.5, rpe: 8, dist: '85-87.5-87.5-90-90-92.5-92.5-92.5-92.5', tech: '要非常筒' },
      { lift: '传统拉', sets: 2, reps: 5, weight: 95, rpe: 6 },
      { lift: '仰卧举腿', sets: 3, reps: 10, weight: 3, rpe: 8, tech: '慢下三秒，负重 3kg', note: '也要记 RPE' },
    ],
  },
  {
    date: '2026-06-07', cycle: 'C2', phase: 'volume', week: 5, day: 'D2',
    items: [
      { lift: '卧推', sets: 9, reps: 10, weight: 62.5, rpe: 7.5, dist: '55-55-55-57.5-57.5-60-60-62.5-62.5', tech: '握法四步' },
      { lift: '潘德雷划船', sets: 3, reps: 7, weight: 57.5, rpe: 7.5, tech: '筒式支撑' },
      { lift: '面拉', sets: 3, reps: 7, weight: 10, rpe: 6, tech: '慢速离心', note: '个人时间紧张，没来及做完' },
    ],
  },
  {
    date: '2026-06-10', cycle: 'C2', phase: 'volume', week: 5, day: 'D3',
    items: [
      { lift: '高杠蹲', sets: 10, reps: 10, weight: 100, rpe: 8, dist: '90-90-90-90-90-92.5-95-97.5-98.5-100', tech: '要非常筒', note: '本周期蹲最高容量日' },
      { lift: '仰卧举腿', sets: 3, reps: 10, weight: 3, rpe: 8, tech: '慢下三秒，负重 3kg' },
    ],
  },
  {
    date: '2026-06-11', cycle: 'C2', phase: 'volume', week: 5, day: 'D4',
    items: [
      { lift: '卧推', sets: 10, reps: 10, weight: 65, rpe: 10, dist: '57.5-57.5-57.5-60-60-62.5-62.5-62.5-65-65', tech: '握法四步', note: '最后一组只做了 9 个 —— 明确力竭信号' },
      { lift: '潘德雷划船', sets: 3, reps: 7, weight: 57.5, rpe: 7, tech: '筒式支撑' },
    ],
  },
];

// ============================================================================
// C3 «强度» —— 次数降至 6，重新低开爬坡
// ============================================================================

const C3: SeedSession[] = [
  {
    date: '2026-06-17', inferred: true, cycle: 'C3', phase: 'strength', week: 1, day: 'D1',
    items: [
      { lift: '高杠蹲', sets: 6, reps: 6, weight: 70, rpe: 6.5, dist: '60-62.5-65-67.5-70-70', tech: '要非常筒', note: '清空疲劳' },
      { lift: '传统拉', sets: 2, reps: 6, weight: 65, rpe: 6, tech: '筒式支撑' },
      { lift: '仰卧举腿', sets: 3, reps: 12, weight: 3, rpe: 8.5, tech: '慢下三秒，负重 3kg' },
    ],
  },
  {
    date: '2026-06-18', inferred: true, cycle: 'C3', phase: 'strength', week: 1, day: 'D2',
    items: [
      { lift: '卧推', sets: 6, reps: 6, weight: 60, rpe: 6.5, dist: '50-52.5-55-57.5-60-60', tech: '握法四步' },
      { lift: '潘德雷划船', sets: 3, reps: 8, weight: 50, rpe: 7, tech: '筒式支撑' },
      { lift: '面拉', sets: 3, reps: 8, weight: 10, rpe: 6, tech: '慢速离心' },
    ],
  },
  {
    date: '2026-06-20', inferred: true, cycle: 'C3', phase: 'strength', week: 1, day: 'D3',
    items: [
      { lift: '高杠蹲', sets: 6, reps: 8, weight: 65, rpe: 7, dist: '60-60-62.5-62.5-65-65', tech: '要非常筒' },
      { lift: '传统拉', sets: 2, reps: 6, weight: 70, rpe: 6.5, tech: '筒式支撑' },
      { lift: '仰卧举腿', sets: 3, reps: 15, weight: 3, rpe: 9.5, tech: '慢下三秒，负重 3kg' },
    ],
  },
  {
    date: '2026-06-21', inferred: true, cycle: 'C3', phase: 'strength', week: 1, day: 'D4',
    items: [
      { lift: '卧推', sets: 6, reps: 8, weight: 50, rpe: 6.5, tech: '握法四步' },
      { lift: '实力推', sets: 3, reps: 8, weight: 30, rpe: 7, tech: '注意进肩', note: '动作好就行' },
      { lift: '潘德雷划船', sets: 3, reps: 8, weight: 55, rpe: 7, tech: '筒式支撑' },
    ],
  },
  {
    date: '2026-06-24', inferred: true, cycle: 'C3', phase: 'strength', week: 2, day: 'D1',
    items: [
      { lift: '高杠蹲', sets: 6, reps: 6, weight: 90, rpe: 7, dist: '75-80-85-90-90-90', tech: '要非常筒' },
      { lift: '传统拉', sets: 2, reps: 6, weight: 75, rpe: 6, tech: '筒式支撑' },
      { lift: '仰卧举腿', sets: 3, reps: 15, weight: 3, rpe: 9, tech: '慢下三秒，负重 3kg' },
    ],
  },
  {
    date: '2026-06-25', inferred: true, cycle: 'C3', phase: 'strength', week: 2, day: 'D2',
    items: [
      { lift: '卧推', sets: 6, reps: 6, weight: 60, rpe: 7, dist: '55-55-57.5-57.5-60-60', tech: '握法四步' },
      { lift: '潘德雷划船', sets: 3, reps: 8, weight: 55, rpe: 7, tech: '筒式支撑' },
      { lift: '面拉', sets: 3, reps: 10, weight: 10, rpe: 6, tech: '慢速离心' },
    ],
  },
  {
    date: '2026-06-27', inferred: true, cycle: 'C3', phase: 'strength', week: 2, day: 'D3',
    items: [
      { lift: '高杠蹲', sets: 6, reps: 8, weight: 70, rpe: 7, tech: '要非常筒', note: '区间 65~70kg' },
      { lift: '传统拉', sets: 2, reps: 6, weight: 80, rpe: 6, tech: '筒式支撑' },
      { lift: '仰卧举腿', sets: 3, reps: 16, weight: 3, rpe: 9, tech: '慢下三秒，负重 3kg' },
    ],
  },
  {
    date: '2026-06-28', inferred: true, cycle: 'C3', phase: 'strength', week: 2, day: 'D4',
    items: [
      { lift: '卧推', sets: 6, reps: 8, weight: 55, rpe: 7, tech: '握法四步', note: '区间 50~55kg' },
      { lift: '实力推', sets: 3, reps: 8, weight: 32.5, rpe: 7, tech: '注意进肩', note: '动作好就行' },
      { lift: '潘德雷划船', sets: 3, reps: 8, weight: 57.5, rpe: 7, tech: '筒式支撑' },
    ],
  },
];

const ALL_SESSIONS: SeedSession[] = [...C1, ...C2, ...C3];

/** 各阶段的目标 RPE（用于回填 targetRpe，与引擎 PHASES 保持一致） */
const PHASE_TARGET_RPE: Record<'foundation' | 'volume' | 'strength', number> = {
  foundation: 6,
  volume: 7,
  strength: 7,
};

/** 展平为打卡记录（按时间正序） */
export function buildSeedCheckins(): SeedCheckin[] {
  const out: SeedCheckin[] = [];
  for (const s of ALL_SESSIONS) {
    for (const it of s.items) {
      out.push({
        date: s.date,
        dateInferred: s.inferred,
        cycle: s.cycle,
        phase: s.phase,
        week: s.week,
        day: s.day,
        lift: it.lift,
        sets: it.sets,
        reps: it.reps,
        weight: it.weight,
        rpe: it.rpe ?? 0,
        targetRpe: PHASE_TARGET_RPE[s.phase],
        setDistribution: it.dist,
        techniqueNote: it.tech,
        restingHR: s.restingHR,
        bodyweight: s.bodyweight,
        calories: s.calories,
        note: it.note,
      });
    }
  }
  return out;
}

// ============================================================================
// 由真实顶组反推的档案
// ============================================================================

/** Epley：1RM = w × (1 + r/30) */
function epley(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

function roundTo2p5(v: number): number {
  return Math.round(v / 2.5) * 2.5;
}

/** 从种子记录中反推某主项的最佳估算 1RM */
export function derive1RM(matches: string[], entries: SeedCheckin[] = buildSeedCheckins()): number | null {
  let best = 0;
  for (const e of entries) {
    if (!e.weight || !e.reps) continue;
    if (!matches.some(m => e.lift.includes(m))) continue;
    const est = epley(e.weight, e.reps);
    if (est > best) best = est;
  }
  return best > 0 ? roundTo2p5(best) : null;
}

/**
 * 「我的专属档案」—— 全部字段来自 Excel 真实数据
 * - TX 四项：教练备注2 明确写死
 * - 四项 1RM：由各周期真实顶组用 Epley 反推
 * - 频率 4 天：教练写明的「练练休练练休休」
 * - 阶段 strength：C3 已进入 6×6 强度周期
 */
export function buildSeedProfile(): UserProfile {
  const entries = buildSeedCheckins();
  return {
    // 身体数据：Excel 的「体重 / 热量摄入」两列全为空，未采集 → 留空待补
    height: null,
    weight: null,
    age: null,
    gender: '',
    experience: 'intermediate',
    goal: '向 TX 目标推进（蹲160 / 推100 / 拉180 / 举55），技术不塌陷的前提下抬高最大力量',
    frequency: 4,
    equipment: '杠铃 + 深蹲架 + 卧推凳 + 哑铃 + 引体架 + 龙门架（面拉）',
    injuries: '',
    squat1RM: derive1RM(['高杠蹲', '深蹲'], entries),
    bench1RM: derive1RM(['卧推'], entries),
    deadlift1RM: derive1RM(['传统拉'], entries),
    press1RM: derive1RM(['实力推'], entries),
    // 教练备注2：TX 取 蹲:160 推:100 拉:180 举:55
    txSquat: 160,
    txBench: 100,
    txDeadlift: 180,
    txPress: 55,
    phase: 'strength',
    programWeeks: 4,
    updatedAt: '',
  };
}

/** 种子概览，用于 UI 提示 */
export function seedSummary() {
  const entries = buildSeedCheckins();
  const dates = entries.map(e => e.date).sort();
  return {
    sessions: ALL_SESSIONS.length,
    records: entries.length,
    from: dates[0],
    to: dates[dates.length - 1],
    cycles: ['C1 动作框架', 'C2 容量耐受', 'C3 强度'],
  };
}
