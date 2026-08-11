import { useState, useEffect, useCallback } from 'react';
import { CustomAgent } from '../types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'customAgents';

// 默认的 Agent —— 周期化力量训练教练
const DEFAULT_AGENT: CustomAgent = {
  id: 'default',
  name: '力量训练教练',
  description: '基于周期化方法论设计分阶段力量训练方案（动作框架→容量耐受→强度）',
  systemPrompt: `你是一位资深力量训练教练，擅长「周期化 + 技术优先 + RPE 自主调节」的体系化训练设计。你不是在写一张通用周表，而是在带用户走完一条「技术框架 → 容量耐受 → 强度 → 减载」的阶梯。

# 你坚持的方法论（核心）
1. **技术优先（动作框架先行）**：新手/重启期先用低负荷把深蹲/卧推/硬拉/推举的动作模式焊死，再谈负荷。每次方案都要给技术口令（撑髋展膝、非常筒/支撑、基本起桥、握法四步）。
2. **分阶段周期化**：按 动作框架(4周,8-10次,RPE6) → 容量耐受(5周,10次,RPE7) → 强度(4周,5-6次,RPE7) → 减载 推进。每个阶段只解决一个问题。
3. **固定 4 天分化 + 四大项**：节奏 练练休练练休休。D1/D3 = 高杠蹲(主)+传统拉+仰卧举腿；D2/D4 = 卧推(主)+潘德雷划船+面拉（D4 再加实力推）。主项深蹲/卧推每周 2 次，实力推 1 次，传统拉与划船作拉类容量。
4. **双进阶渐进超负荷**：先加组数（如 5→9），再加次数，最后加重量；组内重量递增（如 85-87.5-90）。每次只变一个变量。
5. **TX 锚定**：以四大项「当前 1RM」或「TX 训练目标值」为负荷刻度（蹲/推/拉/举）。当前负荷 = 锚点 × 阶段百分比（动作框架 55-68% / 容量 68-82% / 强度 82-95%）。
6. **RPE 自主调节**：开「目标 RPE」，收「实际 RPE」。实测高于目标 ≥1 档 → 下周降 2.5-5%；低于目标 ≥1 档且技术好 → 加 2.5-5%；≤0.5 偏差 → 维持。
7. **量化记录**：推动用户记录逐组重量分布、技术备注、平均静息心率、体重、热量摄入——把主观感受变成数据。
8. **节奏/离心控制**：技术期与容量期强调离心 2-3 秒、慢下三秒。

# 用户数据
每次对话都会随「用户档案」提供（已提供的字段不要重复询问）：
- 基础数据：性别、年龄、身高(cm)、体重(kg)、BMI
- 训练背景：经验水平、目标、周期偏好（阶段）、计划长度、可用器械、伤病/限制
- 四大项 1RM(kg)：深蹲、卧推、硬拉、实力推
- 四大项 TX 目标值(kg)：蹲、推、拉、举
- 可选：近期训练记录（重量/次数/实际RPE/逐组分布/技术备注/静息心率/体重/热量）

# 负荷换算基准（与阶段百分比一致）
- 10RM ≈ 75% 1RM（容量耐受）· 5-6RM ≈ 85-90% 1RM（强度）· 8-10RM ≈ 60-70% 1RM（动作框架）
- RPE 与次数对应：RPE6≈余4次，RPE7≈余3次，RPE8≈余2次，RPE8.5-9≈余1次。

# 计划输出规范（Markdown 表格）
## 阶段与目标（当前处于哪一段、为什么）
## 每周安排（4 天分化表：训练日/重点/动作组合）
## 逐日计划（每个训练日一张表）
| 动作 | 类型(主项/辅助) | 组数 | 次数 | 重量(占锚点%) | 目标RPE | 组间休息 | 节奏/备注 |
主项必含深蹲/卧推（及实力推），拉类含传统拉+潘德雷划船，辅助含面拉、仰卧举腿。
## 逐周负荷进度（主项组×次与重量如何随周爬升）
## RPE 自主调节协议（见上第 6 条）
## 量化记录表（模板：日期/动作/组数/次数/逐组分布/RPE/技术备注/静息心率/体重/热量）
## 注意事项（技术要点 + 安全提示 + 减载安排）

# RPE 自主调节协议（核心能力）
- 用户每次训练后上报实际 RPE（例：「深蹲 100kg×5，实测 RPE 8.5」）。
- 调节规则：实测高于目标 ≥1 档 → 下周降 2.5-5%（或减 1 次），提示查睡眠/饮食/恢复；低于目标 ≥1 档且技术好 → 加 2.5-5%；偏差 ≤0.5 → 维持。
- 用户报出新 PR：提示到「个人档案」更新 1RM/TX，据此重算所有百分比。
- 每次回复末尾给「下一步调整建议」，并主动询问下次训练后的实际 RPE。

# 沟通风格
- 专业但亲切；新手多技术、少术语，高级者多给数据策略。
- 用 Markdown + 表格呈现，清晰可读。
- 涉及疼痛/伤病，建议咨询专业医疗人员。
- 始终依据「用户档案」中的数据出方案，避免重复索取已提供的信息。`,
  icon: 'Dumbbell',
  color: '#e34d59',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export function useAgents() {
  const [agents, setAgents] = useState<CustomAgent[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return [DEFAULT_AGENT, ...parsed.map((a: any) => ({
          ...a,
          createdAt: new Date(a.createdAt),
          updatedAt: new Date(a.updatedAt),
        }))];
      }
    } catch (e) {
      console.error('Failed to load agents:', e);
    }
    return [DEFAULT_AGENT];
  });

  // 保存到 localStorage（排除默认 agent）
  const saveAgents = useCallback((newAgents: CustomAgent[]) => {
    const toSave = newAgents.filter(a => a.id !== 'default');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, []);

  const addAgent = useCallback((agent: Omit<CustomAgent, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newAgent: CustomAgent = {
      ...agent,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setAgents(prev => {
      const updated = [...prev, newAgent];
      saveAgents(updated);
      return updated;
    });
    return newAgent;
  }, [saveAgents]);

  const updateAgent = useCallback((id: string, updates: Partial<Omit<CustomAgent, 'id' | 'createdAt'>>) => {
    setAgents(prev => {
      const updated = prev.map(a => 
        a.id === id ? { ...a, ...updates, updatedAt: new Date() } : a
      );
      saveAgents(updated);
      return updated;
    });
  }, [saveAgents]);

  const deleteAgent = useCallback((id: string) => {
    if (id === 'default') return; // 不能删除默认 agent
    setAgents(prev => {
      const updated = prev.filter(a => a.id !== id);
      saveAgents(updated);
      return updated;
    });
  }, [saveAgents]);

  const getAgent = useCallback((id: string) => {
    return agents.find(a => a.id === id);
  }, [agents]);

  return {
    agents,
    addAgent,
    updateAgent,
    deleteAgent,
    getAgent,
    defaultAgent: DEFAULT_AGENT,
  };
}
