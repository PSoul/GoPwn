# Plan 1: Pipeline Logging — Pino + PipelineLog + 前端调试 Tab

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 V2 流水线建立双层日志体系 — Pino 结构化终端日志 + PipelineLog DB 存储 + 前端调试面板，让流水线每个环节可观测。

**Architecture:** Pino 替换所有 console.log（终端/文件调试），PipelineLog Prisma model 存储关键节点到 DB（前端展示），pipeline-logger helper 同时写两层。前端新增调试日志 tab。

**Tech Stack:** Pino 9.x + pino-pretty + Prisma 7 + Next.js 15 App Router + React 19

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `lib/infra/logger.ts` | Pino 全局 logger + child factory |
| Create | `lib/infra/pipeline-logger.ts` | 双层 logger（Pino + DB） |
| Create | `lib/repositories/pipeline-log-repo.ts` | PipelineLog CRUD |
| Create | `app/api/projects/[projectId]/pipeline-logs/route.ts` | API endpoint |
| Create | `components/projects/project-pipeline-log-panel.tsx` | 前端调试日志面板 |
| Modify | `prisma/schema.prisma` | 新增 PipelineLog model |
| Modify | `worker.ts` | 替换 console.log → Pino |
| Modify | `lib/workers/planning-worker.ts` | 接入 pipeline logger |
| Modify | `lib/workers/execution-worker.ts` | 接入 pipeline logger |
| Modify | `lib/workers/analysis-worker.ts` | 接入 pipeline logger |
| Modify | `lib/workers/verification-worker.ts` | 接入 pipeline logger |
| Modify | `lib/workers/lifecycle-worker.ts` | 接入 pipeline logger |
| Modify | `lib/mcp/registry.ts` | MCP 层日志 |
| Modify | `components/projects/project-live-dashboard.tsx` | 添加调试 tab |

---

### Task 1: 安装依赖

**Files:** `package.json`

- [ ] **Step 1: 安装 pino 和 pino-pretty**

Run: `npm install pino && npm install -D pino-pretty`

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add pino and pino-pretty dependencies"
```

---

### Task 2: Pino 全局 logger

**Files:**
- Create: `lib/infra/logger.ts`

- [ ] **Step 1: 创建 logger.ts**

```typescript
import pino from "pino"

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
      : undefined,
})

/**
 * Create a child logger with job context.
 * All log lines from this child automatically include jobType + projectId.
 */
export function createJobLogger(
  jobType: string,
  projectId: string,
  extra?: Record<string, unknown>,
) {
  return logger.child({ jobType, projectId, ...extra })
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/infra/logger.ts
git commit -m "feat: add Pino structured logger"
```

---

### Task 3: PipelineLog Prisma model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 在 schema.prisma 末尾（`GlobalConfig` model 之后）添加 PipelineLog model**

```prisma
// ──────────────────────────────────────────────
// Pipeline Logs (debug/observability)
// ──────────────────────────────────────────────

model PipelineLog {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  round     Int?
  jobType   String   // plan_round, execute_tool, analyze_result, verify_finding, round_completed, settle_closure
  jobId     String?  // pg-boss job id
  stage     String   // started, llm_call, llm_response, mcp_call, mcp_response, state_transition, completed, failed
  level     String   // debug, info, warn, error
  message   String
  data      Json?
  duration  Int?     // ms
  createdAt DateTime @default(now())

  @@index([projectId, createdAt])
  @@index([projectId, round])
  @@index([level])
  @@map("pipeline_logs")
}
```

- [ ] **Step 2: 在 Project model 的 relations 区域添加 pipelineLogs 关系**

在 `prisma/schema.prisma` 的 `Project` model 中，`auditEvents` 行之后加：

```prisma
  pipelineLogs  PipelineLog[]
```

- [ ] **Step 3: 运行 migration**

Run: `npx prisma migrate dev --name add-pipeline-log`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add PipelineLog model for pipeline observability"
```

---

### Task 4: PipelineLog repository

**Files:**
- Create: `lib/repositories/pipeline-log-repo.ts`

- [ ] **Step 1: 创建 pipeline-log-repo.ts**

```typescript
import { prisma } from "@/lib/infra/prisma"
import type { PipelineLog } from "@/lib/generated/prisma"

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
}): Promise<PipelineLog> {
  return prisma.pipelineLog.create({
    data: {
      projectId: data.projectId,
      round: data.round,
      jobType: data.jobType,
      jobId: data.jobId,
      stage: data.stage,
      level: data.level,
      message: data.message,
      data: data.data ?? undefined,
      duration: data.duration,
    },
  })
}

const LEVEL_ORDER = ["debug", "info", "warn", "error"]

export async function findByProject(
  projectId: string,
  options?: { round?: number; level?: string; limit?: number; offset?: number },
): Promise<PipelineLog[]> {
  const minLevel = options?.level ?? "info"
  const minIndex = LEVEL_ORDER.indexOf(minLevel)
  const levels = LEVEL_ORDER.slice(minIndex)

  return prisma.pipelineLog.findMany({
    where: {
      projectId,
      ...(options?.round != null ? { round: options.round } : {}),
      level: { in: levels },
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 100,
    skip: options?.offset ?? 0,
  })
}

export async function countByProject(projectId: string, level?: string): Promise<number> {
  const minLevel = level ?? "info"
  const minIndex = LEVEL_ORDER.indexOf(minLevel)
  const levels = LEVEL_ORDER.slice(minIndex)

  return prisma.pipelineLog.count({
    where: { projectId, level: { in: levels } },
  })
}

export async function cleanupOld(daysToKeep: number = 30): Promise<number> {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)
  const result = await prisma.pipelineLog.deleteMany({
    where: { level: "debug", createdAt: { lt: cutoff } },
  })
  return result.count
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/repositories/pipeline-log-repo.ts
git commit -m "feat: add PipelineLog repository"
```

---

### Task 5: Pipeline logger helper（双层写入）

**Files:**
- Create: `lib/infra/pipeline-logger.ts`

- [ ] **Step 1: 创建 pipeline-logger.ts**

```typescript
import { createJobLogger } from "./logger"
import * as pipelineLogRepo from "@/lib/repositories/pipeline-log-repo"

export type PipelineLogger = ReturnType<typeof createPipelineLogger>

export function createPipelineLogger(
  projectId: string,
  jobType: string,
  options?: { round?: number; jobId?: string },
) {
  const log = createJobLogger(jobType, projectId, { round: options?.round })

  function write(level: "debug" | "info" | "warn" | "error", stage: string, message: string, data?: unknown, duration?: number) {
    // Always write to Pino (stdout)
    log[level]({ stage, data, duration }, message)

    // Write to DB: debug only when LOG_PIPELINE_DEBUG=1, others always
    if (level === "debug" && process.env.LOG_PIPELINE_DEBUG !== "1") return

    pipelineLogRepo
      .create({
        projectId,
        round: options?.round,
        jobType,
        jobId: options?.jobId,
        stage,
        level,
        message,
        data: data ?? undefined,
        duration,
      })
      .catch(() => {}) // best-effort, never block pipeline
  }

  return {
    debug: (stage: string, message: string, data?: unknown) => write("debug", stage, message, data),
    info: (stage: string, message: string, data?: unknown, duration?: number) => write("info", stage, message, data, duration),
    warn: (stage: string, message: string, data?: unknown) => write("warn", stage, message, data),
    error: (stage: string, message: string, data?: unknown) => write("error", stage, message, data),

    /** Returns a timer — call timer.elapsed() to get ms since creation */
    startTimer() {
      const start = Date.now()
      return { elapsed: () => Date.now() - start }
    },
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/infra/pipeline-logger.ts
git commit -m "feat: add dual-layer pipeline logger (Pino + DB)"
```

---

### Task 6: 替换 worker.ts 的 console.log

**Files:**
- Modify: `worker.ts`

- [ ] **Step 1: 替换 worker.ts 中的所有 console.log/console.error**

在文件顶部添加导入：
```typescript
import { logger } from "@/lib/infra/logger"
```

替换规则（逐行）：

| 原始 | 替换 |
|------|------|
| `console.log("[worker] Starting worker process...")` | `logger.info("starting worker process")` |
| `console.log(\`[worker] Cleaned up ${cleaned.count} stale LLM call logs\`)` | `logger.info({ cleaned: cleaned.count }, "cleaned stale LLM call logs")` |
| `console.log(\`[worker] MCP bootstrap: ${mcp.servers.loaded} servers, ${mcp.tools.synced} tools\`)` | `logger.info({ servers: mcp.servers.loaded, tools: mcp.tools.synced }, "MCP bootstrap complete")` |
| `console.log("[worker] pg-boss started")` | `logger.info("pg-boss started")` |
| `console.log("[worker] All handlers registered. Waiting for jobs...")` | `logger.info("all handlers registered, waiting for jobs")` |
| `console.log(\`[worker] ${signal} received, shutting down...\`)` | `logger.info({ signal }, "shutting down")` |
| `console.error("[worker] Error closing MCP connectors:", err)` | `logger.error({ err }, "error closing MCP connectors")` |
| `console.error("[worker] Fatal error:", err)` | `logger.fatal({ err }, "fatal error")` |

- [ ] **Step 2: Commit**

```bash
git add worker.ts
git commit -m "refactor: replace console.log with Pino in worker.ts"
```

---

### Task 7: 接入 planning-worker

**Files:**
- Modify: `lib/workers/planning-worker.ts`

- [ ] **Step 1: 在顶部添加导入**

```typescript
import { createPipelineLogger } from "@/lib/infra/pipeline-logger"
```

- [ ] **Step 2: 在 handlePlanRound 函数体开头创建 logger**

在 `const { projectId, round } = data` 之后，替换 `console.log(...)` 为：

```typescript
const log = createPipelineLogger(projectId, "plan_round", { round })
log.info("started", `开始规划第 ${round} 轮`)
```

- [ ] **Step 3: 替换函数内所有 console.log/warn/error**

| 位置 | 原始 | 替换 |
|------|------|------|
| project not found | `console.error(...)` | `log.error("failed", \`项目 ${projectId} 不存在\`)` |
| wrong lifecycle | `console.warn(...)` | `log.warn("skipped", \`项目处于 ${project.lifecycle} 状态，跳过规划\`)` |
| LLM 调用前 | （新增） | `const timer = log.startTimer(); log.info("llm_call", "调用 planner LLM")` |
| LLM 调用后 | （新增） | `log.info("llm_response", \`LLM 返回 ${items.length} 个计划项\`, { summary: plan.summary, phase: plan.phase }, timer.elapsed())` |
| 成功末尾 | `console.log(\`[planning] Round ${round} planned...\`)` | `log.info("completed", \`规划完成: ${items.length} 个任务 (${plan.phase})\`)` |
| catch 块 | `console.error(\`[planning] Failed...\`)` | `log.error("failed", \`规划失败: ${message}\`, { error: message })` |

- [ ] **Step 4: Commit**

```bash
git add lib/workers/planning-worker.ts
git commit -m "refactor: planning-worker uses pipeline logger"
```

---

### Task 8: 接入 execution-worker

**Files:**
- Modify: `lib/workers/execution-worker.ts`

- [ ] **Step 1: 在顶部添加导入**

```typescript
import { createPipelineLogger } from "@/lib/infra/pipeline-logger"
```

- [ ] **Step 2: 在 handleExecuteTool 开头创建 logger**

在 `const { projectId, mcpRunId } = data` 之后：

```typescript
const log = createPipelineLogger(projectId, "execute_tool")
log.info("started", `执行工具 run ${mcpRunId}`)
```

- [ ] **Step 3: mcpRun 加载后补充 round 信息到 logger**

在获取 `mcpRun` 后，重新创建带 round 的 logger（因为 round 需要从 mcpRun 获取）：

```typescript
const mcpRun = await mcpRunRepo.findById(mcpRunId)
// ... null check ...
const log = createPipelineLogger(projectId, "execute_tool", { round: mcpRun.round })
```

（覆盖前面的 log 变量即可）

- [ ] **Step 4: 替换所有 console.log/warn/error**

| 位置 | 原始 | 替换 |
|------|------|------|
| mcpRun not found | `console.error(...)` | `log.error("failed", \`McpRun ${mcpRunId} 不存在\`)` |
| project stopped | `console.warn(...)` | `log.warn("cancelled", \`项目已 ${project?.lifecycle}，取消执行\`)` |
| MCP 调用前 | （新增） | `const timer = log.startTimer(); log.info("mcp_call", \`调用 ${mcpRun.toolName}(${mcpRun.target})\`, { input })` |
| tool failed (isError) | `console.warn(...)` | `log.warn("mcp_response", \`工具返回错误\`, { error: result.content.slice(0, 500) }, timer.elapsed())` |
| tool succeeded | `console.log(...)` | `log.info("mcp_response", \`工具返回 ${result.content.length} 字符\`, { durationMs: result.durationMs }, timer.elapsed())` |
| catch 块 | `console.error(...)` | `log.error("failed", \`执行失败: ${message}\`, { error: message })` |
| round complete | `console.log(...)` | `log.info("round_check", \`第 ${round} 轮全部 ${runs.length} 个 run 完成\`)` |

- [ ] **Step 5: Commit**

```bash
git add lib/workers/execution-worker.ts
git commit -m "refactor: execution-worker uses pipeline logger"
```

---

### Task 9: 接入 analysis-worker

**Files:**
- Modify: `lib/workers/analysis-worker.ts`

- [ ] **Step 1: 添加导入并创建 logger**

顶部添加：
```typescript
import { createPipelineLogger } from "@/lib/infra/pipeline-logger"
```

在 `handleAnalyzeResult` 开头：
```typescript
const log = createPipelineLogger(projectId, "analyze_result")
log.info("started", `分析 ${toolName} → ${target} 的输出`)
```

- [ ] **Step 2: 替换所有 console.log/warn/error**

| 位置 | 替换 |
|------|------|
| project stopped | `log.warn("skipped", ...)` |
| LLM 调用前 | `const timer = log.startTimer(); log.info("llm_call", "调用 analyzer LLM")` |
| LLM 调用后 | `log.info("llm_response", \`提取 ${analysis.assets?.length ?? 0} 资产, ${analysis.findings?.length ?? 0} 发现\`, null, timer.elapsed())` |
| asset 创建失败 | `log.warn("parse_result", \`创建资产 ${asset.value} 失败\`, { error: ... })` |
| finding 创建失败 | `log.warn("parse_result", \`创建发现 "${finding.title}" 失败\`, { error: ... })` |
| 成功末尾 | `log.info("completed", \`+${newAssetCount} 资产, +${newFindingCount} 发现\`)` |
| catch 块 | `log.error("failed", \`分析失败: ${message}\`, { error: message })` |

- [ ] **Step 3: Commit**

```bash
git add lib/workers/analysis-worker.ts
git commit -m "refactor: analysis-worker uses pipeline logger"
```

---

### Task 10: 接入 verification-worker

**Files:**
- Modify: `lib/workers/verification-worker.ts`

- [ ] **Step 1: 添加导入并创建 logger**

```typescript
import { createPipelineLogger } from "@/lib/infra/pipeline-logger"
```

在 `handleVerifyFinding` 开头：
```typescript
const log = createPipelineLogger(projectId, "verify_finding")
log.info("started", `验证发现 ${findingId}`)
```

- [ ] **Step 2: 替换所有 console.log/warn/error**

与前面 worker 同理：finding not found、project stopped、LLM 调用前后、PoC 执行、verified/false_positive 结果、catch 块。

- [ ] **Step 3: Commit**

```bash
git add lib/workers/verification-worker.ts
git commit -m "refactor: verification-worker uses pipeline logger"
```

---

### Task 11: 接入 lifecycle-worker

**Files:**
- Modify: `lib/workers/lifecycle-worker.ts`

- [ ] **Step 1: 添加导入**

```typescript
import { createPipelineLogger } from "@/lib/infra/pipeline-logger"
```

- [ ] **Step 2: handleRoundCompleted — 创建 logger 并替换所有 console.log/warn/error**

在函数开头：
```typescript
const log = createPipelineLogger(projectId, "round_completed", { round })
log.info("started", `第 ${round} 轮完成，开始审阅`)
```

关键替换点：
- LLM reviewer 调用前后
- decision: settle / continue 日志
- catch 块错误日志
- 恢复尝试日志

- [ ] **Step 3: handleSettleClosure — 同样替换**

```typescript
const log = createPipelineLogger(projectId, "settle_closure")
log.info("started", `开始结算项目`)
```

- [ ] **Step 4: Commit**

```bash
git add lib/workers/lifecycle-worker.ts
git commit -m "refactor: lifecycle-worker uses pipeline logger"
```

---

### Task 12: PipelineLog API endpoint

**Files:**
- Create: `app/api/projects/[projectId]/pipeline-logs/route.ts`

- [ ] **Step 1: 创建 route.ts**

```typescript
import { apiHandler, json } from "@/lib/infra/api-handler"
import * as pipelineLogRepo from "@/lib/repositories/pipeline-log-repo"

export const GET = apiHandler(async (req, { params }: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await params
  const url = new URL(req.url)

  const round = url.searchParams.get("round")
  const level = url.searchParams.get("level") ?? "info"
  const limit = parseInt(url.searchParams.get("limit") ?? "100", 10)
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10)

  const [logs, total] = await Promise.all([
    pipelineLogRepo.findByProject(projectId, {
      round: round != null ? parseInt(round, 10) : undefined,
      level,
      limit: Math.min(limit, 200),
      offset,
    }),
    pipelineLogRepo.countByProject(projectId, level),
  ])

  return json({ logs, total })
})
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/projects/[projectId]/pipeline-logs/route.ts"
git commit -m "feat: add pipeline-logs API endpoint"
```

---

### Task 13: 前端调试日志面板

**Files:**
- Create: `components/projects/project-pipeline-log-panel.tsx`

- [ ] **Step 1: 创建面板组件**

```tsx
"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/infra/api-client"

type PipelineLogEntry = {
  id: string
  round: number | null
  jobType: string
  stage: string
  level: string
  message: string
  data: unknown
  duration: number | null
  createdAt: string
}

const LEVEL_COLORS: Record<string, string> = {
  debug: "text-slate-400",
  info: "text-sky-600 dark:text-sky-400",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
}

const LEVEL_OPTIONS = ["debug", "info", "warn", "error"] as const

export function ProjectPipelineLogPanel({ projectId }: { projectId: string }) {
  const [logs, setLogs] = useState<PipelineLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [level, setLevel] = useState<string>("info")
  const [round, setRound] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams({ level, limit: "200" })
    if (round != null) params.set("round", String(round))

    const res = await apiFetch(`/api/projects/${projectId}/pipeline-logs?${params}`)
    const body = await res.json()
    setLogs(body.logs.reverse()) // API returns desc, we want asc
    setTotal(body.total)
  }, [projectId, level, round])

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 5000) // poll every 5s
    return () => clearInterval(interval)
  }, [fetchLogs])

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs, autoScroll])

  // Extract unique rounds from logs
  const rounds = [...new Set(logs.map((l) => l.round).filter((r): r is number => r != null))].sort()

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2 dark:border-slate-800">
        <span className="text-xs font-medium text-slate-500">轮次:</span>
        <Button
          size="sm"
          variant={round === null ? "default" : "outline"}
          className="h-6 rounded-full px-2 text-xs"
          onClick={() => setRound(null)}
        >
          全部
        </Button>
        {rounds.map((r) => (
          <Button
            key={r}
            size="sm"
            variant={round === r ? "default" : "outline"}
            className="h-6 rounded-full px-2 text-xs"
            onClick={() => setRound(r)}
          >
            R{r}
          </Button>
        ))}

        <span className="ml-4 text-xs font-medium text-slate-500">级别:</span>
        {LEVEL_OPTIONS.map((l) => (
          <Button
            key={l}
            size="sm"
            variant={level === l ? "default" : "outline"}
            className="h-6 rounded-full px-2 text-xs"
            onClick={() => setLevel(l)}
          >
            {l.toUpperCase()}
          </Button>
        ))}

        <label className="ml-auto flex items-center gap-1 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="h-3 w-3"
          />
          自动滚动
        </label>

        <span className="text-xs text-slate-400">{total} 条</span>
      </div>

      {/* Log lines */}
      <div className="max-h-[500px] overflow-y-auto px-4 py-2 font-mono text-xs">
        {logs.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">暂无日志</p>
        )}
        {logs.map((entry) => {
          const time = new Date(entry.createdAt).toLocaleTimeString("zh-CN", { hour12: false })
          const isExpanded = expandedId === entry.id
          const isError = entry.level === "error"

          return (
            <div
              key={entry.id}
              className={`border-b border-slate-50 py-1 dark:border-slate-900 ${isError ? "bg-red-50/50 dark:bg-red-950/20" : ""}`}
            >
              <div
                className="flex cursor-pointer items-start gap-2"
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
              >
                <span className="shrink-0 text-slate-400">{time}</span>
                <span className="w-12 shrink-0 text-slate-500">R{entry.round ?? "-"}</span>
                <span className="w-28 shrink-0 truncate text-slate-500">{entry.jobType}</span>
                <span className="w-24 shrink-0 truncate text-slate-400">{entry.stage}</span>
                <span className={`w-10 shrink-0 font-semibold ${LEVEL_COLORS[entry.level] ?? ""}`}>
                  {entry.level.toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
                  {entry.message}
                  {entry.duration != null && (
                    <span className="ml-1 text-slate-400">[{(entry.duration / 1000).toFixed(1)}s]</span>
                  )}
                </span>
              </div>
              {isExpanded && entry.data && (
                <pre className="mt-1 ml-10 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  {JSON.stringify(entry.data, null, 2)}
                </pre>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/projects/project-pipeline-log-panel.tsx
git commit -m "feat: add frontend pipeline log debug panel"
```

---

### Task 14: 将调试 Tab 集成到 Live Dashboard

**Files:**
- Modify: `components/projects/project-live-dashboard.tsx`

- [ ] **Step 1: 添加导入**

在文件顶部导入区域添加：

```typescript
import { ProjectPipelineLogPanel } from "./project-pipeline-log-panel"
```

- [ ] **Step 2: 在 Tabs 组件中添加调试 tab**

在 `<TabsTrigger value="assets">资产</TabsTrigger>` 之后添加：

```tsx
<TabsTrigger value="logs">调试日志</TabsTrigger>
```

在 `<TabsContent value="assets">...</TabsContent>` 之后添加：

```tsx
<TabsContent value="logs">
  <ProjectPipelineLogPanel projectId={project.id} />
</TabsContent>
```

- [ ] **Step 3: Commit**

```bash
git add components/projects/project-live-dashboard.tsx
git commit -m "feat: integrate pipeline log tab into live dashboard"
```

---

### Task 15: 验证

- [ ] **Step 1: TypeScript 编译检查**

Run: `npx tsc --noEmit`

Expected: 0 errors

- [ ] **Step 2: 启动开发服务器确认无运行时错误**

Run: `npm run dev`

验证：访问项目详情页，能看到"调试日志" tab，面板能加载（空数据状态）。

- [ ] **Step 3: Final commit（如有修复）**

```bash
git add -A
git commit -m "fix: resolve any issues from plan-1 integration"
```
