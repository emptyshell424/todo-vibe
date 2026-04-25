# Todo Vibe 去 Todoist 化与稳定性推进计划

更新日期：2026-04-22

## 执行原则

- 每个阶段结束后更新本文档，并运行对应验证命令。
- 只有遇到破坏性操作、外部凭据、产品取舍冲突或验证失败时暂停并请求确认。
- 不再把产品目标定义为 Todoist 迁移；优先补齐测试、提醒触发、项目路由和安全验证。
- 当前脏工作区就是执行基线；不回滚与本计划无关的现有改动。

## 当前基线

- 2026-04-22 已复核通过：`npm run check:encoding`、`npm run check:task-logic`、`npx tsc --noEmit`、`npm run lint`、`npm run build`。

## 阶段 1：方向纠偏与导入能力下线

状态：已完成

验证命令：

- `npm run check:encoding`
- `npm run check:task-logic`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

任务：

- [x] 重写计划、README、后续文档，移除 Todoist 迁移叙事。
- [x] 删除用户可见的 `/import` 路由与导航入口。
- [x] 删除 Todoist JSON 解析器和相关翻译文案。
- [x] 清理 demo seed 中的 Todoist 导入表述。
- [x] 保留现有 `P1..P4` 快速录入语法，但不再把它包装成兼容 Todoist 的能力。
- [x] 运行阶段验证并记录结果。

## 阶段 2：建立真正的测试基线

状态：已完成

验证命令：

- `npm run test`
- `npm run check:task-logic`
- `npx tsc --noEmit`
- `npm run lint`

任务：

- [x] 引入 Vitest，新增 `npm run test`。
- [x] 覆盖任务过滤与可见性逻辑。
- [x] 覆盖 `quickAdd` 的日期、优先级和 recurrence 解析。
- [x] 覆盖 recurrence 计算和 metadata helper 行为。
- [x] 保留 `check:task-logic` 作为 smoke check。
- [x] 运行阶段验证并记录结果。

## 阶段 3：把 reminders 从字段变成可触发能力

状态：已完成

验证命令：

- `npm run test`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

任务：

- [x] 新增认证后的 `POST /api/reminders/poll`。
- [x] 查询当前用户已到期且未发送的 `in_app` reminders，并标记为已发送。
- [x] 在应用壳层增加单一提醒轮询，不允许页面各自轮询。
- [x] 统一 reminder API 与 AI breakdown API 的错误格式为 `{ code, message }`。
- [x] 运行阶段验证并记录结果。

## 阶段 4：项目路由与页面状态语义收口

状态：已完成

验证命令：

- `npm run test`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

任务：

- [x] 新增 `/projects/[projectId]` 独立项目视图。
- [x] 保留 `?section=` 作为项目页的局部分组过滤。
- [x] 让 Today、Inbox、Scheduled、Completed、Stats 的导航切换不再继承 `project`/`section` 参数。
- [x] 抽出最小必要的共享任务页数据加载与 mutation 逻辑。
- [x] 运行阶段验证并记录结果。

## 阶段 5：安全与规模验证

状态：阻塞：等待双用户 RLS 凭据

验证命令：

- `npm run test`
- `npm run check:task-logic`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

任务：

- [x] 准备可重复执行的 RLS 验证步骤或脚本。
- [ ] 覆盖 tasks、projects、sections、task_labels、reminders、recurrences 的跨用户隔离。
- [x] 增加本地高数据量逻辑 smoke check。
- [ ] 若环境可用，再补 1k/10k 任务量的真实查询与页面渲染验证。
- [x] 把验证结论写回本文档。

## 验证记录

- 2026-04-22：执行前基线复核，`npm run check:encoding`、`npm run check:task-logic`、`npx tsc --noEmit`、`npm run lint`、`npm run build` 均通过。
- 2026-04-22：阶段 1 完成；首次 `npx tsc --noEmit` 因 `.next` 中残留的 `/import` 类型缓存失败，清理 `.next` 后重跑 `npx tsc --noEmit` 与 `npm run build` 通过；`npm run check:encoding`、`npm run check:task-logic`、`npm run lint` 通过。
- 2026-04-22：阶段 2 完成；安装 `vitest` 时先后遇到网络沙箱限制和 Windows `rolldown` binding 缺失，补装 `@rolldown/binding-win32-x64-msvc` 并把 `npm run test` 固定为 `vitest run --pool=threads` 后，`npm run test`、`npm run check:task-logic`、`npx tsc --noEmit`、`npm run lint` 通过。
- 2026-04-22：阶段 3 完成；首次 `npx tsc --noEmit` 因 `.next/types/validator.ts` 中缺少新增 `/api/reminders/poll` 的路由类型而失败，先由 `npm run build` 刷新路由类型，再修正 `ReminderNotifier` 的 `useEffectEvent` 依赖警告后，`npm run test`、`npx tsc --noEmit`、`npm run lint`、`npm run build` 通过。
- 2026-04-22：阶段 4 完成；首次验证因项目页中的 `createdTasks` 缺少显式类型导致 `npm run build` 和 `npx tsc --noEmit` 一并失败，补上 `DisplayTask[]` 标注并重跑后，`npm run test`、`npx tsc --noEmit`、`npm run lint`、`npm run build` 通过。
- 2026-04-22：阶段 5 当前可执行部分完成；新增 `npm run check:task-scale` 与 `npm run check:rls`。本地 `npm run check:task-scale` 结果：1k 任务下 `todayScope` 2.04ms、`projectFilter` 0.21ms、`scheduledGroups` 0.82ms、`statsAggregation` 0.21ms；10k 任务下分别为 7.78ms、0.70ms、4.69ms、0.53ms。`npm run test`、`npm run check:task-logic`、`npx tsc --noEmit`、`npm run lint`、`npm run build` 通过。真实双用户 RLS 实测尚未运行，原因是缺少 `RLS_TOKEN_USER_A` / `RLS_TOKEN_USER_B`。
