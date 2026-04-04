# V2 稳定性加固 + 可观测性设计

## 目标

解决 V2 流水线的三大问题：数据流断裂（MCP↔平台↔LLM 之间信息丢失）、故障不可恢复（worker 崩溃项目卡死）、问题不可见（只有 console.log，无法在前端调试）。

## 范围

8 个交付单元，按依赖顺序：

1. Pino 结构化日志
2. PipelineLog 数据模型 + API
3. 前端调试日志 tab
4. 分层重试策略
5. 数据流断点修复（3 个方向）
6. Stale job 恢复
7. Worker 单元测试
8. 端到端实跑验证

## 技术栈

- Pino 9.x（结构化 JSON 日志）
- Prisma 7（PipelineLog model）
- pg-boss（retry/expireIn/deadLetter 配置）
- Vitest（worker 单测）
- Docker Compose（靶场验证）

---

## 1. Pino 结构化日志

### 问题

当前所有 worker 用 `console.log/console.error`，输出非结构化文本，无法过滤、无法关联项目/轮次、无法持久化。

### 方案

引入 Pino 作为全局 logger，替换所有 `console.log`。

**创建 `lib/infra/logger.ts`：**

```typescript
import pino from "pino"

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: process.env.NODE_ENV === "development"
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
})

// 创建带上下文的子 logger
export function createJobLogger(jobType: string, projectId: string, extra?: Record<string, unknown>) {
  return logger.child({ jobType, projectId, ...extra })
}
```

**使用方式：**

```typescript
// 替换前
console.log(`[lifecycle] Round ${round} completed for project ${projectId}`)

// 替换后
const log = createJobLogger("round_completed", projectId, { round })
log.info("round completed")
```

**规则：**
- 每个 worker handler 入口创建一个 child logger，自动携带 jobType + projectId + round
- level 使用：`debug`=详细数据、`info`=流程节点、`warn`=可恢复异常、`error`=不可恢复异常
- 开发环境用 pino-pretty 彩色输出，生产环境 JSON 输出

### 影响文件

- 新建：`lib/infra/logger.ts`
- 修改：`lib/workers/planning-worker.ts`、`execution-worker.ts`、`analysis-worker.ts`、`verification-worker.ts`、`lifecycle-worker.ts`
- 修改：`worker.ts`（主进程日志）
- 修改：`lib/mcp/registry.ts`、`lib/mcp/stdio-connector.ts`（MCP 层日志）

---

## 2. PipelineLog 数据模型 + API

### 问题

Pino 日志输出到终端/文件，前端看不到。需要把关键流水线事件存入数据库，供前端查询。

### 方案

**新增 Prisma model：**

```prisma
model PipelineLog {
  id        String   @id @default(cuid())
  projectId String
  round     Int?
  jobType   String   // plan_round, execute_tool, analyze_result, verify_finding, round_completed, settle_closure
  jobId     String?  // pg-boss job id
  stage     String   // started, llm_call, llm_response, mcp_call, mcp_response, parse_result, state_transition, completed, failed
  level     String   // debug, info, warn, error
  message   String
  data      Json?    // 任意结构化数据（rawOutput 片段、错误堆栈、LLM 响应摘要等）
  duration  Int?     // 该阶段耗时 ms
  createdAt DateTime @default(now())

  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, createdAt])
  @@index([projectId, round])
  @@index([level])
}
```

**新增 repository：`lib/repositories/pipeline-log-repo.ts`**

```typescript
export async function create(data: {
  projectId: string
  round?: number
  jobType: string
  jobId?: string
  stage: string
  level: string
  message: string
  data?: unknown
  duration?: number
}): Promise<PipelineLog>

export async function findByProject(projectId: string, options?: {
  round?: number
  level?: string  // 最低 level 过滤
  limit?: number
  offset?: number
}): Promise<PipelineLog[]>

export async function countByProject(projectId: string, level?: string): Promise<number>

// 清理 30 天前的 debug 级别日志
export async function cleanupOld(daysToKeep: number): Promise<number>
```

**Pipeline logger helper：`lib/infra/pipeline-logger.ts`**

同时写 Pino + DB 的便捷函数：

```typescript
import { createJobLogger } from "./logger"
import * as pipelineLogRepo from "@/lib/repositories/pipeline-log-repo"

export function createPipelineLogger(projectId: string, jobType: string, options?: { round?: number; jobId?: string }) {
  const log = createJobLogger(jobType, projectId, { round: options?.round })

  return {
    debug(stage: string, message: string, data?: unknown) {
      log.debug({ stage, data }, message)
      // debug 级别只在 LOG_PIPELINE_DEBUG=1 时写 DB
      if (process.env.LOG_PIPELINE_DEBUG === "1") {
        pipelineLogRepo.create({ projectId, round: options?.round, jobType, jobId: options?.jobId, stage, level: "debug", message, data }).catch(() => {})
      }
    },
    info(stage: string, message: string, data?: unknown) {
      log.info({ stage, data }, message)
      pipelineLogRepo.create({ projectId, round: options?.round, jobType, jobId: options?.jobId, stage, level: "info", message, data }).catch(() => {})
    },
    warn(stage: string, message: string, data?: unknown) {
      log.warn({ stage, data }, message)
      pipelineLogRepo.create({ projectId, round: options?.round, jobType, jobId: options?.jobId, stage, level: "warn", message, data }).catch(() => {})
    },
    error(stage: string, message: string, data?: unknown) {
      log.error({ stage, data }, message)
      pipelineLogRepo.create({ projectId, round: options?.round, jobType, jobId: options?.jobId, stage, level: "error", message, data }).catch(() => {})
    },
    // 计时辅助
    startTimer() {
      const start = Date.now()
      return { elapsed: () => Date.now() - start }
    },
  }
}
```

**新增 API route：`GET /api/projects/[projectId]/pipeline-logs`**

Query params: `round`, `level`, `limit`, `offset`

### 影响文件

- 新建：`lib/repositories/pipeline-log-repo.ts`
- 新建：`lib/infra/pipeline-logger.ts`
- 新建：`app/api/projects/[projectId]/pipeline-logs/route.ts`
- 修改：`prisma/schema.prisma`

---

## 3. 前端调试日志 Tab

### 问题

当前前端只能看到 MCP runs 和 LLM logs，看不到流水线级别的调试信息。

### 方案

在项目 live dashboard 新增"调试日志"tab。

**组件：`components/projects/project-pipeline-log-panel.tsx`**

功能：
- 按轮次分组显示日志条目
- Level 过滤按钮（debug/info/warn/error），默认 info+
- 错误行红色高亮
- 每行可展开查看完整 `data` JSON
- 自动接收 SSE 事件 `pipeline_log` 实时追加新日志
- 分页加载（每页 100 条）

**布局：**

```
[轮次: 全部 | R1 | R2 | R3]  [级别: INFO+ ▾]  [自动滚动 ✓]

R2 | 14:03:21 | plan_round    | started      | INFO  | 开始规划第 2 轮
R2 | 14:03:21 | plan_round    | llm_call     | INFO  | 调用 planner LLM (gpt-4o)
R2 | 14:03:25 | plan_round    | llm_response | INFO  | LLM 返回 3 个计划项 [3.8s]
R2 | 14:03:25 | execute_tool  | started      | INFO  | 执行 fscan_port_scan(127.0.0.1)
R2 | 14:03:30 | execute_tool  | mcp_response | INFO  | 工具返回 1.2KB 输出 [5.1s]
R2 | 14:03:30 | execute_tool  | failed       | ERROR | 工具执行超时 (300s)     ← 红色高亮
                                                        ▼ 展开查看详情
                                                        { "error": "timeout", "partialOutput": "..." }
```

### 影响文件

- 新建：`components/projects/project-pipeline-log-panel.tsx`
- 修改：`components/projects/project-live-dashboard.tsx`（添加 tab）
- 修改：`lib/infra/event-bus.ts`（添加 `pipeline_log` 事件类型）

---

## 4. 分层重试策略

### 问题

当前所有 job 失败直接报错，没有重试。LLM 偶尔超时或返回格式错误，一次失败就中断整个流程。

### 方案

**pg-boss job 配置：**

| Job 类型 | 重试次数 | 退避策略 | 超时 | 失败行为 |
|----------|---------|---------|------|---------|
| plan_round | 3 | 指数退避 2s→4s→8s | 120s | 3 次全败 → 项目 failed |
| execute_tool | 0 | 不重试 | 300s | 标记该 run failed，继续同轮其他工具 |
| analyze_result | 3 | 指数退避 2s→4s→8s | 60s | 3 次全败 → 跳过该分析，不阻塞轮次 |
| verify_finding | 2 | 指数退避 2s→4s→8s | 60s | 全败 → finding 保持 suspected 状态 |
| round_completed | 2 | 固定 5s | 120s | 全败 → 项目 failed |
| settle_closure | 2 | 固定 5s | 120s | 全败 → 项目 failed |

**重试前检查 abort signal：**

```typescript
// 每次重试前检查项目是否已停止
const project = await projectRepo.findById(projectId)
if (project?.lifecycle === "stopped" || project?.lifecycle === "stopping") {
  log.info("retry_skipped", "项目已停止，跳过重试")
  return // 不重试
}
```

**execute_tool 失败降级：**

同轮所有 execute_tool 完成后（无论成败），仍然发布 round_completed。reviewer 能看到失败工具列表，决定是否继续。

### 影响文件

- 修改：`lib/infra/job-queue.ts`（pg-boss subscribe 配置）
- 修改：5 个 worker 文件（重试前 abort 检查）
- 修改：`worker.ts`（subscribe 配置传参）

---

## 5. 数据流断点修复

### 5a. MCP → 平台（工具输出完整存储）

**当前问题：** 工具失败时 rawOutput 为 null，超时时部分输出丢失。

**修复：**
- execution-worker：无论成功/失败/超时，都把已获取的输出存入 `McpRun.rawOutput`
- 超时时捕获已接收的部分输出
- 解析失败时 rawOutput 原样保留，error 字段记录解析错误

### 5b. 平台 → LLM（上下文完整传递）

**当前问题：** planner prompt 只包含 asset/finding 摘要，不包含工具原始输出。LLM 第 2 轮看不到第 1 轮工具发现了什么具体内容。

**修复：** 修改 `buildPlannerPrompt`，在上一轮总结中包含每个工具的 rawOutput（截断到 2000 字符/工具，总共最多 10000 字符）：

```
## 上一轮执行结果

### fscan_port_scan(127.0.0.1) — 成功
原始输出:
[*] 端口开放 127.0.0.1:80
[*] 端口开放 127.0.0.1:6379
[+] Redis 127.0.0.1:6379 发现未授权访问

### httpx_probe(http://127.0.0.1:80) — 成功
原始输出:
HTTP/1.1 200 OK
Server: nginx/1.21.0
Content-Type: text/html
...

### dirsearch(http://127.0.0.1:80) — 失败
错误: 连接超时 (300s)
```

### 5c. LLM → 平台（JSON 容错解析）

**当前问题：** LLM 返回的 JSON 偶尔带 markdown code fence 或 trailing comma，`JSON.parse` 直接报错中断流程。

**修复：** 增强 `parseLlmJson` 函数：

```typescript
export function parseLlmJson<T>(raw: string): T {
  let cleaned = raw.trim()

  // 去除 markdown code fence
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "")

  // 去除 trailing comma（对象和数组末尾）
  cleaned = cleaned.replace(/,\s*([\]}])/g, "$1")

  // 尝试解析
  try {
    return JSON.parse(cleaned)
  } catch (e) {
    // 尝试提取第一个 JSON 对象
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      return JSON.parse(match[0])
    }
    throw new Error(`LLM JSON 解析失败: ${(e as Error).message}\n原始内容: ${raw.slice(0, 500)}`)
  }
}
```

### 影响文件

- 修改：`lib/workers/execution-worker.ts`（5a：完整存储输出）
- 修改：`lib/llm/prompts.ts`（5b：planner 上下文增强）
- 修改：`lib/llm/index.ts` 或 `lib/llm/prompts.ts`（5c：JSON 容错，取决于 parseLlmJson 所在位置）

---

## 6. Stale Job 恢复

### 问题

如果 worker 进程崩溃重启，之前正在执行的项目会卡在 planning/executing/reviewing 状态，没有新 job 能推动它继续。

### 方案

**worker 启动时执行恢复扫描：**

```typescript
async function recoverStaleProjects() {
  const staleStates = ["planning", "executing", "reviewing", "settling"] as const
  const staleProjects = await projectRepo.findByLifecycles(staleStates)

  for (const project of staleProjects) {
    // 检查是否有活跃的 pg-boss job
    const hasActiveJob = await queue.hasActiveJobForProject(project.id)
    if (hasActiveJob) continue // 有活跃 job，不需要恢复

    log.warn("stale_recovery", `恢复卡死项目 ${project.id} (${project.lifecycle})`, { projectId: project.id })

    // 根据当前状态决定恢复动作
    switch (project.lifecycle) {
      case "planning":
        await queue.publish("plan_round", { projectId: project.id, round: project.currentRound + 1 })
        break
      case "executing":
        // 检查是否所有 run 都完成了
        const pendingRuns = await mcpRunRepo.countPendingByProject(project.id)
        if (pendingRuns === 0) {
          await queue.publish("round_completed", { projectId: project.id, round: project.currentRound })
        }
        // 有 pending run 的情况：重新发布 execute_tool job
        break
      case "reviewing":
        await queue.publish("round_completed", { projectId: project.id, round: project.currentRound })
        break
      case "settling":
        await queue.publish("settle_closure", { projectId: project.id })
        break
    }

    await pipelineLogRepo.create({
      projectId: project.id,
      jobType: "recovery",
      stage: "stale_recovery",
      level: "warn",
      message: `从 ${project.lifecycle} 状态恢复`,
    })
  }
}
```

**调用时机：** `worker.ts` 的 `main()` 函数中，在 `queue.start()` 之后、`subscribe` 之前调用。

### 影响文件

- 修改：`worker.ts`
- 修改：`lib/repositories/project-repo.ts`（新增 `findByLifecycles`）

---

## 7. Worker 单元测试

### 策略

为每个 worker 编写单元测试，mock 外部依赖（LLM provider、MCP callTool、Prisma repositories）。

**测试覆盖矩阵：**

| Worker | 正常路径 | LLM 失败 | MCP 失败 | 超时 | Abort |
|--------|---------|---------|---------|------|-------|
| planning-worker | ✓ | ✓ | — | ✓ | ✓ |
| execution-worker | ✓ | — | ✓ | ✓ | — |
| analysis-worker | ✓ | ✓ | — | ✓ | ✓ |
| verification-worker | ✓ | ✓ | — | ✓ | ✓ |
| lifecycle-worker | ✓ | ✓ | — | ✓ | ✓ |

**每个 worker 至少 5 个测试用例：**

1. 正常流程：输入 → 状态转换 → 输出 job（验证完整 happy path）
2. LLM/MCP 失败：验证错误被记录到 PipelineLog，状态正确降级
3. 超时：验证 5 分钟超时触发，部分输出被保留
4. Abort：验证项目停止时 AbortSignal 生效，不继续执行
5. 幂等性：同一 job 重复执行不会产生重复数据

### 影响文件

- 新建：`tests/lib/workers/planning-worker.test.ts`
- 新建：`tests/lib/workers/execution-worker.test.ts`
- 新建：`tests/lib/workers/analysis-worker.test.ts`
- 新建：`tests/lib/workers/verification-worker.test.ts`
- 新建：`tests/lib/workers/lifecycle-worker.test.ts`

---

## 8. 端到端实跑验证

### 前置条件

- Docker 靶场运行中（至少 DVWA `localhost:8081`）
- PostgreSQL 运行中
- LLM provider 已配置（settings 页面）
- MCP server 已注册（settings 页面）

### 验证流程

1. 启动 worker 进程：`npm run worker`
2. 创建项目，目标 `http://localhost:8081`
3. 启动项目
4. 观察调试日志 tab，验证每个阶段：
   - plan_round → 应看到 LLM 返回的计划项
   - execute_tool → 应看到工具执行结果
   - analyze_result → 应看到提取的 asset/finding
   - round_completed → 应看到 reviewer 决策
5. 等待完成或手动停止
6. 检查：assets 列表有数据、findings 列表有数据、调试日志完整

### 验证清单

| 检查项 | 验证方式 |
|--------|---------|
| 项目能从 idle → completed | 观察 lifecycle 变化 |
| 每轮的工具输出都存入了 DB | 查 McpRun.rawOutput 非 null |
| LLM 第 2 轮能看到第 1 轮结果 | 查 LlmCallLog 的 prompt 包含上轮输出 |
| 工具失败不阻塞流程 | 手动让一个工具超时，观察其他工具继续 |
| 停止项目能中断 LLM 调用 | 在 LLM 调用中点停止，观察 abort 日志 |
| 调试日志前端能看到 | 打开调试日志 tab |
| worker 重启能恢复 | 杀掉 worker 进程再启动，观察恢复日志 |

---

## 实现计划拆分

按依赖顺序拆成 5 个独立 plan：

1. **plan-1-pipeline-logging** — Pino + PipelineLog + 前端 tab（§1-3）
2. **plan-2-retry-and-recovery** — 分层重试 + stale job 恢复（§4, §6）
3. **plan-3-data-flow-fixes** — MCP→平台→LLM 三个断点修复（§5）
4. **plan-4-worker-tests** — 5 个 worker 的单元测试（§7）
5. **plan-5-e2e-validation** — Docker 靶场端到端验证（§8）

每个 plan 独立可交付、可测试、可提交。
