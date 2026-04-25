# Todo Vibe 后续任务清单

## 当前状态

任务基础能力已经到位：Inbox/Today 语义、共享任务访问层、完整任务编辑、项目/分组/子任务、labels/reminders/recurrences、快速录入、RLS 文档与 demo seed 都已落地。

这不代表产品已经达到生产可用级别。当前真实缺口仍然是测试基线、提醒触发链路、RLS 实测、项目路由语义和高数据量验证。

## P0：必须继续补的工程风险

1. 建立真正的测试框架，而不是只靠脚本检查。
   - 覆盖 `taskModel`、`quickAdd`、recurrence 计算、metadata helper。
   - 覆盖任务筛选、任务更新、标签和提醒的基础行为。

2. 做 RLS 实测。
   - 使用两个 Clerk 用户验证跨用户读、写、删失败。
   - 验证 `task_labels`、`reminders`、`recurrences` 的跨表 ownership policy。

3. 把 reminders 从“可设置字段”推进到“可触发提醒”。
   - 第一版只做站内提醒扫描器。
   - 邮件和 push 不在当前阶段内。

## P1：产品语义和结构收口

1. 新增项目独立路由。
   - 用 `/projects/[id]` 承载项目级筛选。
   - 让全局页面不再继承 `project` / `section` 查询参数。

2. 收口高风险写路径。
   - AI 拆解和 reminder 轮询至少要有稳定错误结构。
   - 批量写入或自动化逻辑不应长期散在页面组件里。

3. AI 实用增强。
   - 建议 project、section、priority、due date。
   - 检测重复任务。
   - 识别模糊目标并提示改写成可执行动作。

## P2：生产可用性

1. 大任务量性能验证。
   - 至少用 1k、10k 任务量验证列表、筛选、统计页面。

2. 错误观测。
   - 增加可读错误码和失败上下文，避免只在 UI 上显示 Supabase 原始错误。

## 不建议优先做

- 继续堆视觉效果。
- 继续做 AI 展示动画。
- 在没有提醒触发链路前包装 reminders。
- 在没有 RLS 实测前宣称生产安全。

这些方向会让项目看起来更完整，但不会解决可靠性问题。
