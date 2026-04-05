# ReAct Plan D: 前端 + API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提供 ReAct 步骤的 API 查询接口和前端实时展示，让用户能看到 LLM 的逐步推理和工具执行过程。

**Architecture:** 新增步骤查询 API，修改 operations 和 orchestrator 面板以按 step 展示，通过 SSE 实现实时更新。

**Tech Stack:** Next.js 15 + React 19 + TypeScript

**Dependencies:** Plan A (数据模型 — McpRun 新增 stepIndex/thought/functionArgs, OrchestratorRound 新增 maxSteps/actualSteps/stopReason), Plan B (react-worker 核心), Plan C (function-calling / react-prompt / context)

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `app/api/projects/[projectId]/rounds/[round]/steps/route.ts` | ReAct 步骤查询 API |
| Modify | `app/api/projects/[projectId]/orchestrator/route.ts` | 返回 ReAct 新字段 |
| Modify | `components/projects/project-mcp-runs-panel.tsx` | 按 round→step 分组展示 |
| Modify | `components/projects/project-orchestrator-panel.tsx` | ReAct 摘要展示 |
| Modify | `app/(console)/projects/[projectId]/operations/page.tsx` | 传递 rounds 数据、接入 orchestrator panel |
| Create | `lib/hooks/use-react-steps.ts` | SSE 事件监听 hook（react_step_started/completed, react_round_progress） |
| Modify | `lib/types/labels.ts` | 新增 stopReason 标签映射 |

---

### Task 1: 新增 stopReason 标签映射

**Files:**
- Modify: `lib/types/labels.ts`

- [ ] **Step 1: 在 labels.ts 末尾新增 STOP_REASON_LABELS**

在 `lib/types/labels.ts` 文件末尾（`ASSET_KIND_LABELS` 之后）追加：

```typescript
export const STOP_REASON_LABELS: Record<string, string> = {
  llm_done: "LLM 主动停止",
  max_steps: "达到步数上限",
  aborted: "用户中止",
  error: "执行错误",
}
```

- [ ] **Step 2: 验证 — 确认 TypeScript 编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

---

### Task 2: 创建步骤查询 API

**Files:**
- Create: `app/api/projects/[projectId]/rounds/[round]/steps/route.ts`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p "app/api/projects/[projectId]/rounds/[round]/steps"
```

- [ ] **Step 2: 创建 route.ts**

```typescript
import { apiHandler, json } from "@/lib/infra/api-handler"
import { prisma } from "@/lib/infra/prisma"

export const GET = apiHandler(async (_req, ctx) => {
  const { projectId, round } = await ctx.params
  const roundNum = parseInt(round, 10)

  if (isNaN(roundNum) || roundNum < 1) {
    return json({ error: "Invalid round number" }, 400)
  }

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  })
  if (!project) {
    return json({ error: "Project not found" }, 404)
  }

  // Fetch all McpRun records for this round, ordered by stepIndex
  const steps = await prisma.mcpRun.findMany({
    where: {
      projectId,
      round: roundNum,
    },
    orderBy: [
      { stepIndex: { sort: "asc", nulls: "last" } },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      stepIndex: true,
      thought: true,
      functionArgs: true,
      toolName: true,
      capability: true,
      target: true,
      requestedAction: true,
      status: true,
      riskLevel: true,
      phase: true,
      round: true,
      rawOutput: true,
      error: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
  })

  // Also fetch the round metadata
  const roundMeta = await prisma.orchestratorRound.findUnique({
    where: {
      projectId_round: { projectId, round: roundNum },
    },
  })

  return json({
    round: roundNum,
    meta: roundMeta
      ? {
          phase: roundMeta.phase,
          status: roundMeta.status,
          maxSteps: (roundMeta as Record<string, unknown>).maxSteps ?? null,
          actualSteps: (roundMeta as Record<string, unknown>).actualSteps ?? null,
          stopReason: (roundMeta as Record<string, unknown>).stopReason ?? null,
          newAssetCount: roundMeta.newAssetCount,
          newFindingCount: roundMeta.newFindingCount,
          startedAt: roundMeta.startedAt,
          completedAt: roundMeta.completedAt,
        }
      : null,
    steps,
  })
})
```

> **注意:** `maxSteps`、`actualSteps`、`stopReason` 是 Plan A 新增字段。如果 Plan A 的 migration 尚未生效，这些字段会返回 null，不影响功能。使用 `as Record<string, unknown>` 做安全访问，后续 Plan A 合并后可改为直接访问。

- [ ] **Step 3: 验证 — TypeScript 编译**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 4: 验证 — 手动 curl 测试（可选，需运行中的 dev server）**

```bash
# 替换为实际的 projectId 和 round
curl -s http://localhost:3000/api/projects/<projectId>/rounds/1/steps | jq '.steps | length'
```

---

### Task 3: 修改 orchestrator API 返回 ReAct 字段

**Files:**
- Modify: `app/api/projects/[projectId]/orchestrator/route.ts`

- [ ] **Step 1: 扩展 orchestrator route 返回 ReAct 字段**

将 `app/api/projects/[projectId]/orchestrator/route.ts` 的内容替换为：

```typescript
import { apiHandler, json } from "@/lib/infra/api-handler"
import { prisma } from "@/lib/infra/prisma"

export const GET = apiHandler(async (_req, ctx) => {
  const { projectId } = await ctx.params

  const [plans, rounds] = await Promise.all([
    prisma.orchestratorPlan.findMany({
      where: { projectId },
      orderBy: { round: "desc" },
    }),
    prisma.orchestratorRound.findMany({
      where: { projectId },
      orderBy: { round: "desc" },
    }),
  ])

  // Enrich rounds with ReAct fields (safe access for pre-migration data)
  const enrichedRounds = rounds.map((round) => {
    const raw = round as Record<string, unknown>
    return {
      ...round,
      maxSteps: raw.maxSteps ?? null,
      actualSteps: raw.actualSteps ?? null,
      stopReason: raw.stopReason ?? null,
    }
  })

  return json({ plans, rounds: enrichedRounds })
})
```

- [ ] **Step 2: 验证 — TypeScript 编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

---

### Task 4: 创建 SSE 事件监听 hook

**Files:**
- Create: `lib/hooks/use-react-steps.ts`

- [ ] **Step 1: 创建 use-react-steps.ts**

```typescript
"use client"

import { useCallback, useRef, useState } from "react"
import { useProjectEvents, type ProjectEvent } from "./use-project-events"

export type ReactStepEvent = {
  round: number
  stepIndex: number
  thought?: string
  toolName?: string
  target?: string
  status?: string
  outputPreview?: string
}

export type ReactRoundProgress = {
  round: number
  currentStep: number
  maxSteps: number
  phase?: string
}

/**
 * Hook that listens to SSE events for ReAct step updates.
 * Maintains a local list of in-progress steps and round progress.
 */
export function useReactSteps(projectId: string | null) {
  const [activeSteps, setActiveSteps] = useState<ReactStepEvent[]>([])
  const [roundProgress, setRoundProgress] = useState<ReactRoundProgress | null>(null)
  const stepsRef = useRef<ReactStepEvent[]>([])

  const handleEvent = useCallback((event: ProjectEvent) => {
    switch (event.type) {
      case "react_step_started": {
        const step: ReactStepEvent = {
          round: event.data.round as number,
          stepIndex: event.data.stepIndex as number,
          thought: event.data.thought as string | undefined,
          toolName: event.data.toolName as string | undefined,
          target: event.data.target as string | undefined,
          status: "running",
        }
        stepsRef.current = [...stepsRef.current, step]
        setActiveSteps(stepsRef.current)
        break
      }
      case "react_step_completed": {
        const updated = stepsRef.current.map((s) =>
          s.round === (event.data.round as number) &&
          s.stepIndex === (event.data.stepIndex as number)
            ? {
                ...s,
                status: event.data.status as string,
                outputPreview: event.data.outputPreview as string | undefined,
              }
            : s,
        )
        stepsRef.current = updated
        setActiveSteps(updated)
        break
      }
      case "react_round_progress": {
        setRoundProgress({
          round: event.data.round as number,
          currentStep: event.data.currentStep as number,
          maxSteps: event.data.maxSteps as number,
          phase: event.data.phase as string | undefined,
        })
        break
      }
      case "round_reviewed":
      case "lifecycle_changed": {
        // Round ended — clear active steps
        stepsRef.current = []
        setActiveSteps([])
        setRoundProgress(null)
        break
      }
    }
  }, [])

  const { connected } = useProjectEvents(projectId, handleEvent)

  return { activeSteps, roundProgress, connected }
}
```

- [ ] **Step 2: 验证 — TypeScript 编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

---

### Task 5: 重构 MCP Runs 面板 — 按 round/step 分组展示

**Files:**
- Modify: `components/projects/project-mcp-runs-panel.tsx`

这是最大的改动。面板需要从"平铺列表"变为"按 round→step 分组的树状展示"，并支持 SSE 实时更新。

- [ ] **Step 1: 新增类型定义和工具函数**

在文件顶部 import 区域后，新增以下类型和分组函数。在 `import { apiFetch } ...` 行之后追加：

```typescript
import { useReactSteps, type ReactStepEvent } from "@/lib/hooks/use-react-steps"
import { STOP_REASON_LABELS } from "@/lib/types/labels"

type StepRun = McpRun & {
  stepIndex?: number | null
  thought?: string | null
  functionArgs?: unknown
}

type RoundGroup = {
  round: number
  phase: string
  runs: StepRun[]
  maxSteps?: number | null
  actualSteps?: number | null
  stopReason?: string | null
}

function groupByRound(runs: StepRun[]): RoundGroup[] {
  const map = new Map<number, StepRun[]>()
  for (const run of runs) {
    const r = run.round ?? 0
    if (!map.has(r)) map.set(r, [])
    map.get(r)!.push(run)
  }
  const groups: RoundGroup[] = []
  for (const [round, roundRuns] of map) {
    // Sort by stepIndex within each round
    roundRuns.sort((a, b) => (a.stepIndex ?? 999) - (b.stepIndex ?? 999))
    groups.push({
      round,
      phase: roundRuns[0]?.phase ?? "recon",
      runs: roundRuns,
    })
  }
  // Sort rounds descending (newest first)
  groups.sort((a, b) => b.round - a.round)
  return groups
}
```

- [ ] **Step 2: 重构组件 — 添加 SSE hook 和 round 分组状态**

替换组件函数签名和 state 区域。将现有的 `export function ProjectMcpRunsPanel` 组件的 state 部分修改。

在已有 state 下方新增：

```typescript
  const { activeSteps, roundProgress, connected } = useReactSteps(projectId)
  const roundGroups = groupByRound(runs as StepRun[])
```

- [ ] **Step 3: 重构右侧面板 — "最近 MCP 运行" 改为 "ReAct 执行步骤"**

将右侧 `SectionCard`（title="最近 MCP 运行"）的整个内容替换为按 round→step 分组的展示：

```tsx
      <SectionCard
        title="ReAct 执行步骤"
        description={connected ? "实时更新中" : "每一轮 ReAct 循环的工具调用步骤。"}
      >
        <div className="space-y-4">
          {/* Live round progress bar */}
          {roundProgress && (
            <div className="rounded-xl border border-sky-200/80 bg-sky-50/80 px-4 py-3 dark:border-sky-900/60 dark:bg-sky-950/30">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-sky-700 dark:text-sky-300">
                  R{roundProgress.round} 执行中
                </span>
                <span className="text-sky-600 dark:text-sky-400">
                  {roundProgress.currentStep}/{roundProgress.maxSteps} 步
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sky-100 dark:bg-sky-900">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, (roundProgress.currentStep / roundProgress.maxSteps) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Live active steps (from SSE, not yet in DB) */}
          {activeSteps.filter((s) => s.status === "running").map((step) => (
            <div
              key={`live-${step.round}-${step.stepIndex}`}
              className="animate-pulse rounded-xl border border-sky-200/80 bg-white/90 p-4 dark:border-sky-800 dark:bg-slate-950/70"
            >
              <div className="flex items-center gap-2 text-xs text-sky-600 dark:text-sky-400">
                <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
                Step {step.stepIndex} — {step.toolName}({step.target}) 执行中...
              </div>
              {step.thought && (
                <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">
                  {step.thought}
                </p>
              )}
            </div>
          ))}

          {/* Round groups from DB */}
          {roundGroups.length > 0 ? (
            (expanded ? roundGroups : roundGroups.slice(0, 3)).map((group) => (
              <RoundStepGroup key={group.round} group={group} />
            ))
          ) : (
            <div className="rounded-panel border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
              当前项目还没有 MCP 运行记录。
            </div>
          )}
          {roundGroups.length > 3 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <>收起 <ChevronUp className="ml-1.5 h-3.5 w-3.5" /></>
              ) : (
                <>展开全部 {roundGroups.length} 轮 <ChevronDown className="ml-1.5 h-3.5 w-3.5" /></>
              )}
            </Button>
          )}
        </div>
      </SectionCard>
```

- [ ] **Step 4: 新增 RoundStepGroup 子组件**

在同一文件底部（`ProjectMcpRunsPanel` 组件之后，文件 export 之前）新增：

```tsx
function RoundStepGroup({ group }: { group: RoundGroup }) {
  const [open, setOpen] = useState(false)
  const isReact = group.runs.some((r) => (r as StepRun).stepIndex != null)

  const headerLabel = isReact
    ? `Round ${group.round} — ReAct — ${group.runs.length} 步${group.stopReason ? ` — ${STOP_REASON_LABELS[group.stopReason] ?? group.stopReason}` : ""}`
    : `Round ${group.round} — ${group.runs.length} 次运行`

  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <StatusBadge tone="info">{PHASE_LABELS[group.phase as keyof typeof PHASE_LABELS] ?? group.phase}</StatusBadge>
          <span className="font-medium text-slate-900 dark:text-white">{headerLabel}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-200/80 px-4 py-3 dark:border-slate-800">
          <div className="space-y-2">
            {group.runs.map((run, idx) => (
              <StepItem key={run.id} run={run} index={idx} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StepItem({ run, index }: { run: StepRun; index: number }) {
  const [showOutput, setShowOutput] = useState(false)
  const stepLabel = run.stepIndex != null ? `Step ${run.stepIndex}` : `#${index + 1}`
  const statusIcon = run.status === "succeeded" ? "✅" : run.status === "failed" ? "❌" : run.status === "running" ? "⏳" : "⬜"

  return (
    <div className="rounded-lg border border-slate-200/60 bg-white/90 p-3 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-xs">{statusIcon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-900 dark:text-white">{stepLabel}</span>
            <span className="text-sky-600 dark:text-sky-400">{run.toolName}</span>
            <span className="text-slate-500 dark:text-slate-400">→ {run.target}</span>
            <StatusBadge tone={statusTone[run.status]}>{MCP_RUN_STATUS_LABELS[run.status]}</StatusBadge>
          </div>

          {/* Thought (LLM reasoning) */}
          {run.thought && (
            <p className="mt-1.5 text-xs italic leading-5 text-slate-500 dark:text-slate-400">
              💭 {run.thought}
            </p>
          )}

          {/* Output toggle */}
          {run.rawOutput && (
            <div className="mt-2">
              <button
                type="button"
                className="text-xs text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
                onClick={() => setShowOutput((v) => !v)}
              >
                {showOutput ? "收起输出" : "查看输出"}
              </button>
              {showOutput && (
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {run.rawOutput}
                </pre>
              )}
            </div>
          )}

          {/* Error */}
          {run.error && (
            <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
              错误: {run.error}
            </p>
          )}

          {/* Timing */}
          {run.completedAt && run.startedAt && (
            <p className="mt-1 text-xs text-slate-400">
              耗时 {((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(1)}s
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 验证 — TypeScript 编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

---

### Task 6: 重构 Orchestrator 面板 — ReAct 摘要展示

**Files:**
- Modify: `components/projects/project-orchestrator-panel.tsx`

- [ ] **Step 1: 更新 import 和类型**

将文件顶部 import 区域替换为：

```typescript
"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Sparkles, Zap } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { OrchestratorPlan, OrchestratorRound } from "@/lib/generated/prisma"
import { PHASE_LABELS } from "@/lib/types/labels"
import { STOP_REASON_LABELS } from "@/lib/types/labels"
```

- [ ] **Step 2: 扩展 props 类型和 round 类型**

在 `PlanItem` 类型定义之后，新增扩展 round 类型：

```typescript
type EnrichedRound = OrchestratorRound & {
  maxSteps?: number | null
  actualSteps?: number | null
  stopReason?: string | null
}
```

修改组件 props 中的 `rounds` 类型：

```typescript
export function ProjectOrchestratorPanel({
  plans,
  rounds,
}: {
  plans: OrchestratorPlan[]
  rounds: EnrichedRound[]
}) {
```

- [ ] **Step 3: 重构左侧 "AI 规划轮次" 为 "ReAct 执行轮次"**

替换左侧 `SectionCard`（title="AI 规划轮次"）的内容。将 title 改为 "ReAct 执行轮次"，description 改为 "每一轮由 LLM 通过 ReAct 循环逐步推理并执行工具。"

替换 round 列表项的渲染，将每个 round 的展示修改为：

```tsx
              <div key={round.id} className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-12 shrink-0 font-medium text-slate-900 dark:text-white">R{round.round}</span>
                  <StatusBadge tone="info">{PHASE_LABELS[round.phase]}</StatusBadge>
                  <div className="flex flex-wrap gap-2">
                    {round.actualSteps != null && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Zap className="h-3 w-3" />
                        {round.actualSteps}{round.maxSteps ? `/${round.maxSteps}` : ""} 步
                      </span>
                    )}
                    {round.actualSteps == null && (
                      <>
                        <span className="text-xs text-slate-500">计划 {round.planItemCount}</span>
                        <span className="text-xs text-slate-500">执行 {round.executedCount}</span>
                      </>
                    )}
                    {round.newAssetCount > 0 && <span className="text-xs text-sky-600 dark:text-sky-400">+{round.newAssetCount} 资产</span>}
                    {round.newFindingCount > 0 && <span className="text-xs text-amber-600 dark:text-amber-400">+{round.newFindingCount} 发现</span>}
                  </div>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  {round.stopReason && (
                    <span className="text-xs text-slate-400">
                      {STOP_REASON_LABELS[round.stopReason] ?? round.stopReason}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-slate-400">
                    {round.completedAt ? new Date(round.completedAt).toLocaleString("zh-CN") : round.status}
                  </span>
                </div>
              </div>
```

- [ ] **Step 4: 保留右侧 "最近一次 AI 规划" 面板并添加 ReAct 兼容**

右侧面板保留现有的 plan item 展示（兼容旧数据），但在顶部新增一个条件判断——如果最新 round 有 `actualSteps`（即 ReAct 模式），优先展示 ReAct 摘要：

在 `lastPlan` 定义之后新增：

```typescript
  const latestRound = rounds.length > 0 ? rounds[0] : null
  const isReactMode = latestRound?.actualSteps != null
```

在右侧 `SectionCard` 内部，`{lastPlan ? (` 之前新增 ReAct 摘要展示：

```tsx
        {isReactMode && latestRound ? (
          <div className="space-y-4">
            <div className="rounded-panel border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="info">{PHASE_LABELS[latestRound.phase]}</StatusBadge>
                <StatusBadge tone="neutral">R{latestRound.round}</StatusBadge>
                <StatusBadge tone={latestRound.stopReason === "llm_done" ? "success" : latestRound.stopReason === "error" ? "danger" : "warning"}>
                  {STOP_REASON_LABELS[latestRound.stopReason ?? ""] ?? latestRound.status}
                </StatusBadge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-lg font-semibold text-slate-950 dark:text-white">{latestRound.actualSteps ?? 0}</p>
                  <p className="text-xs text-slate-500">执行步数</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-sky-600 dark:text-sky-400">{latestRound.newAssetCount}</p>
                  <p className="text-xs text-slate-500">新资产</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">{latestRound.newFindingCount}</p>
                  <p className="text-xs text-slate-500">新发现</p>
                </div>
              </div>
            </div>
          </div>
        ) : lastPlan ? (
```

将原来的 `{lastPlan ? (` 改为 `) : lastPlan ? (`（即变成 else-if 分支）。

最后的空状态 `) : (` 保持不变。

- [ ] **Step 5: 验证 — TypeScript 编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

---

### Task 7: 修改 Operations 页面 — 接入 Orchestrator 面板和 rounds 数据

**Files:**
- Modify: `app/(console)/projects/[projectId]/operations/page.tsx`

- [ ] **Step 1: 添加 orchestrator 相关 import**

在文件顶部 import 区域追加：

```typescript
import { ProjectOrchestratorPanel } from "@/components/projects/project-orchestrator-panel"
import { prisma } from "@/lib/infra/prisma"
```

- [ ] **Step 2: 获取 orchestrator 数据**

在 `Promise.all` 中新增 plans 和 rounds 查询。将现有的：

```typescript
  const [mcpRuns, approvals, llmProfiles, globalConfig] = await Promise.all([
    mcpRunRepo.findByProject(projectId),
    listApprovals(projectId),
    getLlmProfiles(),
    getGlobalConfig(),
  ])
```

改为：

```typescript
  const [mcpRuns, approvals, llmProfiles, globalConfig, plans, rounds] = await Promise.all([
    mcpRunRepo.findByProject(projectId),
    listApprovals(projectId),
    getLlmProfiles(),
    getGlobalConfig(),
    prisma.orchestratorPlan.findMany({
      where: { projectId },
      orderBy: { round: "desc" },
    }),
    prisma.orchestratorRound.findMany({
      where: { projectId },
      orderBy: { round: "desc" },
    }),
  ])
```

- [ ] **Step 3: 在页面 JSX 中添加 OrchestratorPanel**

在 `<ProjectMcpRunsPanel>` 之前添加：

```tsx
      <ProjectOrchestratorPanel plans={plans} rounds={rounds} />
```

- [ ] **Step 4: 验证 — TypeScript 编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

---

### Task 8: 集成测试 — 验证完整数据流

- [ ] **Step 1: 验证 steps API 返回空数据不报错**

```bash
# 启动 dev server 后
curl -s http://localhost:3000/api/projects/nonexistent/rounds/1/steps | jq .
# 应返回 404
```

- [ ] **Step 2: 验证 orchestrator API 返回 enriched rounds**

```bash
# 替换为实际的 projectId
curl -s http://localhost:3000/api/projects/<projectId>/orchestrator | jq '.rounds[0] | keys'
# 应包含 maxSteps, actualSteps, stopReason
```

- [ ] **Step 3: 验证前端页面不报错**

访问 `http://localhost:3000/projects/<projectId>/operations`，确认：
1. Orchestrator 面板正常渲染（旧数据兼容 — 显示 "计划 N / 执行 N" 格式）
2. MCP Runs 面板正常渲染（按 round 分组）
3. 无 console 错误

- [ ] **Step 4: 验证 SSE 连接正常**

在浏览器 DevTools Network tab 中确认 `/api/projects/<projectId>/events` SSE 连接已建立。

- [ ] **Step 5: 全量 TypeScript 编译检查**

```bash
npx tsc --noEmit --pretty
```

---

### Task 9: 提交

- [ ] **Step 1: Git add 和 commit**

```bash
git add \
  lib/types/labels.ts \
  "app/api/projects/[projectId]/rounds/[round]/steps/route.ts" \
  "app/api/projects/[projectId]/orchestrator/route.ts" \
  lib/hooks/use-react-steps.ts \
  components/projects/project-mcp-runs-panel.tsx \
  components/projects/project-orchestrator-panel.tsx \
  "app/(console)/projects/[projectId]/operations/page.tsx"

git commit -m "feat(react): Plan D — frontend panels and API for ReAct step display

- Add GET /api/projects/[projectId]/rounds/[round]/steps endpoint
- Enrich orchestrator API with ReAct fields (maxSteps, actualSteps, stopReason)
- Refactor MCP runs panel to group by round→step with thought/output display
- Refactor orchestrator panel for ReAct round summaries
- Add useReactSteps SSE hook for real-time step updates
- Add STOP_REASON_LABELS to labels.ts
- Integrate orchestrator panel into operations page"
```

---

## Summary

| Task | 预估时间 | 文件数 |
|------|---------|--------|
| Task 1: stopReason 标签 | 2 min | 1 |
| Task 2: Steps API | 5 min | 1 (新建) |
| Task 3: Orchestrator API | 3 min | 1 |
| Task 4: SSE hook | 4 min | 1 (新建) |
| Task 5: MCP Runs 面板重构 | 10 min | 1 |
| Task 6: Orchestrator 面板重构 | 8 min | 1 |
| Task 7: Operations 页面集成 | 3 min | 1 |
| Task 8: 集成测试 | 5 min | 0 |
| Task 9: 提交 | 2 min | 0 |
| **Total** | **~42 min** | **7 files** |

## Key Design Decisions

1. **安全访问 Plan A 新字段**: 使用 `as Record<string, unknown>` 做安全访问，确保即使 Plan A migration 未执行也不会 crash。后续可改为直接字段访问。
2. **向后兼容旧数据**: 通过 `stepIndex != null` 判断是否为 ReAct 模式，旧数据仍以"计划 N / 执行 N"格式展示。
3. **SSE 实时更新**: `useReactSteps` hook 维护一个 activeSteps 列表，新步骤通过 SSE 事件追加，面板自动更新。round 结束时清空 active 列表。
4. **面板共存**: Orchestrator 面板的 ReAct 摘要和旧 Plan 展示共存，通过 `isReactMode` 自动切换。
