# 当前架构问题分析

> 日期: 2026-04-04
> 分析基础: 完整阅读 lib/ 全部后端代码、prisma schema、API 路由、文档

---

## 一、架构概述

当前系统是一个 Next.js 15 (App Router) 全栈单体应用，前后端同进程部署。核心技术栈：

- **前端**: React 19 + Tailwind CSS + shadcn/ui (Radix) + Recharts
- **后端**: Next.js API Routes (app/api/) + TypeScript
- **数据库**: PostgreSQL + Prisma 7 ORM
- **LLM**: OpenAI-compatible HTTP API（自建 provider 适配层）
- **MCP**: 自建 MCP SDK 集成（stdio + streamable_http 传输）

---

## 二、核心架构缺陷

### 2.1 同步长阻塞请求模型 — 最严重的架构问题

**问题**: `runProjectLifecycleKickoff()` 在一个 HTTP 请求中同步执行整个多轮 AI 编排循环。该函数：

1. 生成第一轮 LLM 计划（1个 LLM 调用 ~10-120s）
2. 执行所有计划项（每个工具 ~5-60s）
3. 进入 `while (currentRound < maxRounds)` 循环
4. 每轮：LLM 生成新计划 → 执行 → 记录 → 判断是否继续

**根因**: Next.js API Route 是 HTTP 请求处理函数，设计初衷是短生命周期。将一个可能持续 5-30 分钟的多轮编排循环放在单个请求中，导致：

- **HTTP 超时**: 客户端/代理/CDN 超时断开，但后端函数继续在内存中运行（僵尸进程）
- **Scheduler task 卡在 running**: 如果请求被杀死（OOM、超时、进程重启），scheduler task 的 `status` 永远停留在 `running`，lease 永远不会被清理
- **无法暂停/恢复**: 虽然有 `preCheck` 检查 lifecycle，但两次检查之间的工具执行无法被中断
- **无法水平扩展**: 状态绑定在单个进程的内存中（`activeExecutionControllers` Map）

**涉及文件**:
- `lib/orchestration/orchestrator-service.ts` — `runProjectLifecycleKickoff()`
- `lib/orchestration/orchestrator-execution.ts` — `executePlanItems()`
- `lib/mcp/mcp-scheduler-service.ts` — `drainStoredSchedulerTasks()`

### 2.2 LLM Call Log 卡在 streaming 状态

**问题**: `openai-compatible-provider.ts` 中，如果 SSE 流中途断开或 JSON 解析失败：

```typescript
// 行 312-355: streaming 读取逻辑
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  // ...chunk 解析
}
```

如果 reader 抛出网络异常或 chunk 解析全部静默跳过（catch 为空块），`completeLlmCallLog()` 永远不会被调用，日志状态停留在 `streaming`。

更严重的是：如果 `content` 始终为空字符串（所有 chunk 都是 malformed），下面会抛出 `"LLM provider returned an empty assistant message."`，虽然进了 catch 会调 `failLlmCallLog`，但 catch 块中的 `clearTimeout` 如果 handle 已经 fire 了 abort，abort 异常可能再次穿透。

**涉及文件**:
- `lib/llm-provider/openai-compatible-provider.ts` — `generatePlan()` streaming 分支

### 2.3 Auto-Replan 循环因异常崩溃 — 无恢复机制

**问题**: `runProjectLifecycleKickoff()` 中的 while 循环：

```typescript
while (currentRound < maxRounds) {
  // ...
  let nextPlan = null
  try {
    nextPlan = await generateMultiRoundPlan(...)
  } catch (planError) {
    // log + break
  }
  // ...
  execution = await executePlanItems(projectId, nextPlan.plan.items)
  // ...
}
```

关键问题：
1. `executePlanItems` 中的 `Promise.allSettled` 虽然不会抛异常，但内部 `dispatchProjectMcpRunAndDrain` 如果数据库连接断开，会抛出 Prisma 异常，导致整个 `executePlanItems` 崩溃
2. 循环 break 后，`settleProjectLifecycleClosure()` 依赖 `execution.status === "completed"`，如果是异常 break，项目停留在 `running` 状态，永远无法自动收尾
3. 没有持久化的断点/检查点机制，进程重启后无法恢复到中断的轮次继续执行

**涉及文件**:
- `lib/orchestration/orchestrator-service.ts` — 整个 `runProjectLifecycleKickoff`

### 2.4 进程内状态管理 — 无法重启恢复

**问题**: 多个关键状态存储在 Node.js 进程内存中：

1. **`activeExecutionControllers`** (`Map<string, AbortController>`) — 进程重启后全部丢失，无法取消正在执行的工具
2. **`EventEmitter` 事件总线** — 进程内 SSE 订阅，重启后断开
3. **LLM streaming 中间状态** — 无持久化，重启后 LLM call log 永久卡在 streaming
4. **Scheduler task lease** — 基于时间戳比较，但如果进程崩溃时 lease 还没过期，任务会在 lease 过期前无法被重新认领

**涉及文件**:
- `lib/mcp/mcp-execution-runtime.ts` — 进程内 Map
- `lib/infra/project-event-bus.ts` — 进程内 EventEmitter

### 2.5 Scheduler Task 生命周期管理缺陷

**问题**: `processStoredSchedulerTask()` 中有多处状态不一致的风险：

1. **Claim 和 Execute 之间无事务保证**: 先 claim task（设置 leaseToken），然后调用 `executeStoredMcpRun`。如果 execute 过程中 claim 被其他 worker 抢走（理论上不应发生，但 lease 过期时可能），结果会写入但 task 状态不一致
2. **heartbeat 和 work 并发**: `withTaskHeartbeat` 中 heartbeat 循环和实际工作并行，如果 heartbeat 失败（数据库抖动），不会影响正在执行的工作，但 lease 可能过期被其他 worker 抢走
3. **Lease 过期恢复**: `recoverExpiredStoredSchedulerTasks` 只是把 status 重置为 `ready`，但不清理可能已经半完成的副作用（已创建的 assets、evidence 等）

**涉及文件**:
- `lib/mcp/mcp-scheduler-service.ts` — `processStoredSchedulerTask()`、`withTaskHeartbeat()`
- `lib/mcp/mcp-scheduler-repository.ts` — `recoverExpiredStoredSchedulerTasks()`

### 2.6 数据库 Schema 设计问题

1. **大量 JSON 列**: `ProjectDetail` 模型中 13 个 JSON 列（timeline, tasks, discoveredInfo, serviceSurface, fingerprints, entries, scheduler, activity, resultMetrics, assetGroups, currentStage, approvalControl, closureStatus），完全丧失了关系数据库的查询和约束优势
2. **缺少外键约束**: `McpRun.toolId` 是 String 而非外键关系，`SchedulerTask.runId` 也不是外键，数据一致性完全依赖应用层
3. **冗余字段**: `projectName` 在 Approval、Asset、Evidence、Finding、McpRun、SchedulerTask 中都有存储（非规范化），更新项目名时需要同步更新所有关联表
4. **prisma-transforms.ts 870 行**: 存在一个巨大的双向转换层，将 Prisma 模型转换为应用层类型，说明应用层类型和数据库模型严重不一致

### 2.7 错误处理模式问题

1. **吞异常**: 多处 `catch {}` 空块（如 SSE chunk 解析、事件发射、auto-discovery），隐藏了真实错误
2. **返回 null 代替抛异常**: 大量函数返回 `null` 表示失败（如 `executeStoredMcpRun`、`processStoredSchedulerTask`），调用方需要层层检查 null，容易遗漏
3. **状态字符串硬编码**: "待处理"、"已批准"、"已拒绝"、"已延后"、"运行中"、"已执行"、"已阻塞" 等中文状态散布在代码各处，没有统一的 enum，拼写错误会导致逻辑分支静默失效

### 2.8 缺少并发控制和幂等性

1. **dispatchStoredMcpRun**: 没有防重复机制，同一个 plan item 可能被 dispatch 两次（重试或并发请求）
2. **approval reorder**: 每次创建审批后都全量读取所有审批重新排序，高并发下会出现丢失更新
3. **project status 更新**: 多处使用 `updateMany` 而非带乐观锁的 `update`，并发更新会互相覆盖

---

## 三、设计反模式

### 3.1 "胖 API Route" 模式

API Route 直接调用底层仓库函数，没有统一的 Service 层。例如：
- `app/api/projects/[projectId]/operations/route.ts` 直接编排多个仓库调用
- 审批决策的 API route 需要协调 approval repository + mcp run + scheduler task + orchestrator execution

### 3.2 "Mega Repository" 模式

- `project-mutation-repository.ts` (17124 行概览中看到的大文件) 承担了太多职责
- `prisma-transforms.ts` (870 行) 是一个巨大的映射函数集合
- `project-results-core.ts` (600 行) 混合了查询、聚合、更新

### 3.3 循环依赖和深层调用链

典型的一次工具执行调用链：
```
API Route
→ dispatchProjectMcpRunAndDrain (project/)
  → dispatchStoredMcpRun (gateway/) — 创建 run + approval + scheduler task
  → drainStoredSchedulerTasks (mcp/)
    → processStoredSchedulerTask (mcp/)
      → executeStoredMcpRun (mcp/)
        → resolveMcpConnector (mcp-connectors/)
        → connector.execute()
        → normalizeExecutionArtifacts (mcp/) — 内含 LLM 调用
          → analyzeAndWriteback (llm/)
        → upsertStoredAssets, upsertStoredEvidence, etc.
        → refreshStoredProjectResults (results/)
```

这个 7 层嵌套调用链在一个请求中同步完成，任何一层异常都可能导致数据不一致。

### 3.4 无法测试的编排逻辑

编排核心（orchestrator-service.ts）直接依赖：
- Prisma 数据库连接
- LLM HTTP 调用
- MCP 工具执行
- 文件系统（截图存储）

没有接口抽象或依赖注入，无法单独测试编排逻辑。

---

## 四、已知 BUG 根因总结

| BUG 现象 | 根因 | 涉及代码 |
|---------|------|---------|
| Scheduler task 卡在 running | 请求超时/进程重启后 lease 未清理，`recoverExpiredStoredSchedulerTasks` 只按时间判断 | mcp-scheduler-service.ts, mcp-scheduler-repository.ts |
| LLM call log 卡在 streaming | SSE 流中途断开时 `completeLlmCallLog` 未被调用 | openai-compatible-provider.ts |
| Auto-replan 循环异常崩溃 | 无 try-catch 包裹 `executePlanItems`，数据库异常直接穿透 while 循环 | orchestrator-service.ts |
| 项目卡在"运行中"无法收尾 | `settleProjectLifecycleClosure` 依赖 `execution.status === "completed"`，异常退出时 status 不是 completed | orchestrator-service.ts, orchestrator-execution.ts |
| 工具执行结果丢失 | `executeStoredMcpRun` 返回 null 时调用方静默跳过 | mcp-execution-service.ts, mcp-scheduler-service.ts |
| 审批通过后工具不执行 | `syncStoredSchedulerTaskAfterApprovalDecision` 只更新 task 状态为 ready，但没有触发 drain | mcp-scheduler-service.ts |
| 并发创建审批时排序丢失 | 全量读取 + 重新排序没有事务保护 | mcp-dispatch-service.ts |

---

## 五、总结

当前架构的根本问题是：**将一个需要分布式任务队列 + 持久化状态机 + 异步事件驱动的系统，实现为了同步 HTTP 请求驱动的单体应用**。

核心矛盾：
- **渗透测试流程** 是长时运行、可中断、可恢复、需要人工介入的
- **当前实现** 是同步、不可中断、不可恢复、绑定单个 HTTP 请求生命周期的

这不是通过局部修补能解决的，需要从后端架构层面重新设计任务编排模型。
