/**
 * 生成「我的专属计划」Markdown —— 用 Excel 真实数据回填后的档案驱动引擎
 * 运行：tsx genMyPlan.ts   （仅生成一次，产物写入 我的专属计划.md）
 */
import { writeFileSync } from 'fs';
import { generatePlan } from './server/planGenerator';
import { buildSeedProfile, buildSeedCheckins, derive1RM, seedSummary } from './src/data/excelSeed';

const profile = buildSeedProfile();
const summary = seedSummary();

// 反推的四大项 1RM（用于计划头部说明）
const entries = buildSeedCheckins();
const squat1 = derive1RM(['高杠蹲', '深蹲'], entries);
const bench1 = derive1RM(['卧推'], entries);
const dl1 = derive1RM(['传统拉'], entries);
const press1 = derive1RM(['实力推'], entries);

// 完整周期化计划（动作框架 → 容量耐受 → 强度）
const program = generatePlan(profile as any, [], { mode: 'program', phase: 'auto', startWeek: 1 });

const header = `# 我的专属力量训练计划（真实数据回填 · 1RM 锚定负荷 · TX 长期目标）

> 本计划由 Excel《力量训练计划.xlsx》的真实数据自动回填生成：
> - **负荷刻度锚点（当前 1RM，由三个周期真实顶组 Epley 反推）**：深蹲 ~${squat1} / 卧推 ~${bench1} / 传统拉 ~${dl1} / 实力推 ~${press1} kg
> - **TX 长期目标值（教练备注2 写死）**：蹲 160 / 推 100 / 拉 180 / 举 55 kg
> - **已回填量化记录**：${summary.records} 条（覆盖 ${summary.sessions} 场训练，时间 ${summary.from} ~ ${summary.to}，周期 ${summary.cycles.join(' / ')}）
>
> 方法论：分阶段周期化（动作框架 → 容量耐受 → 强度）+ 固定 4 天分化（练练休练练休休）+ 双进阶超负荷 + 当前 1RM 锚定负荷 + TX 长期目标 + RPE 自主调节 + 量化记录。
> 全部为本地规则引擎计算，无需联网；每次训练后在「训练打卡」页上报实际 RPE，负荷会自动调节。

---

`;

const out = header + program;
writeFileSync('我的专属计划.md', out, 'utf-8');
console.log('已生成 我的专属计划.md （' + out.length + ' 字符）');
console.log('档案锚点：', {
  squat1RM: profile.squat1RM, bench1RM: profile.bench1RM,
  deadlift1RM: profile.deadlift1RM, press1RM: profile.press1RM,
  txSquat: profile.txSquat, txBench: profile.txBench,
  txDeadlift: profile.txDeadlift, txPress: profile.txPress,
});
