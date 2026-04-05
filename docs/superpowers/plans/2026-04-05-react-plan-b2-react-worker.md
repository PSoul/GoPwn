# ReAct Plan B2: ReAct Worker 核心循环

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 ReAct 循环核心——handleReactRound 函数，串联 LLM function calling、MCP 工具执行、上下文管理、异步分析。

**Architecture:** react-worker.ts 是唯一新建文件。它依赖 Plan A 的 function-calling.ts、tool-input-mapper.ts、scope-policy.ts，以及 Plan B1 的 react-prompt.ts、react-context.ts。

**Tech Stack:** Next.js 15 + TypeScript + Prisma 7 + PostgreSQL 16

**前置条件:** Plan A 和 Plan B1 已完成。

---

## Task 1: 创建 react-worker.ts 骨架

**Files:**
- Create: `lib/workers/react-worker.ts`

- [ ] **Step 1: 创建文件，写入 imports 和常量**

```typescript
// lib/workers/react-worker.ts
/**
 * ReAct worker — handles "react_round" jobs.
 * Runs a ReAct loop: LLM function call → MCP tool execution → result feedback → repeat.
 */

import * as projectRepo from "@/lib/repositories/project-repo"
import * as assetRepo from "@/lib/repositories/asset-repo"
import * as findingRepo from "@/lib/repositories/finding-repo"
import * as mcpRunRepo from "@/lib/repositories/mcp-run-repo"
import * as mcpToolRepo from "@/lib/repositories/mcp-tool-repo"
import * as auditRepo from "@/lib/repositories/audit-repo"
import { prisma } from "@/lib/infra/prisma"
import { publishEvent } from "@/lib/infra/event-bus"
import { createPgBossJobQueue } from "@/lib/infra/job-queue"
import { registerAbort, unregisterAbort } from "@/lib/infra/abort-registry"
import { createPipelineLogger } from "@/lib/infra/pipeline-logger"
import { transition } from "@/lib/domain/lifecycle"
import { callTool } from "@/lib/mcp/registry"
import { getLlmProvider } from "@/lib/llm"
import { buildReactSystemPrompt, type ReactContext } from "@/lib/llm/react-prompt"
import { mcpToolsToFunctions, getControlFunctions, isControlFunction } from "@/lib/llm/function-calling"
import { buildToolInputFromFunctionArgs } from "@/lib/llm/tool-input-mapper"
import { createScopePolicy } from "@/lib/domain/scope-policy"
import { ReactContextManager } from "./react-context"
import type { RiskLevel, PentestPhase } from "@/lib/generated/prisma"

const MAX_STEPS_PER_ROUND = 30
const TOOL_TIMEOUT_MS = 300_000  // 5 min per tool
const ANALYSIS_WAIT_MS = 30_000  // wait for pending analyses at round end

export async function handleReactRound(data: {
  projectId: string
  round: number
}): Promise<void> {
  const { projectId, round } = data
  const log = createPipelineLogger(projectId, "react_round", { round })
  log.info("started", `开始 ReAct 第 ${round} 轮`)

  // Will be implemented in next steps
  throw new Error("TODO: implement ReAct loop")
}
```

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add lib/workers/react-worker.ts
git commit -m "feat: react-worker skeleton with imports"
```

---

## Task 2: 实现 ReAct 循环初始化

**Files:**
- Modify: `lib/workers/react-worker.ts`

- [ ] **Step 1: 替换 handleReactRound 函数体——初始化部分**

替换 `throw new Error("TODO")` 为：

```typescript
  const project = await projectRepo.findById(projectId)
  if (!project) {
    log.error("failed", `项目 ${projectId} 不存在`)
    return
  }

  if (project.lifecycle === "stopped" || project.lifecycle === "stopping") {
    log.info("skipped", `项目已 ${project.lifecycle}，跳过`)
    return
  }

  const abortController = new AbortController()
  registerAbort(projectId, abortController)

  try {
    // Transition to executing
    await projectRepo.updateLifecycle(projectId, transition(project.lifecycle, "START_REACT"))

    // Create/update round record
    await prisma.orchestratorRound.upsert({
      where: { projectId_round: { projectId, round } },
      create: { projectId, round, phase: project.currentPhase, status: "executing", maxSteps: MAX_STEPS_PER_ROUND },
      update: { status: "executing", maxSteps: MAX_STEPS_PER_ROUND },
    })

    // Gather context
    const assets = await assetRepo.findByProject(projectId)
    const findings = await findingRepo.findByProject(projectId)
    const enabledTools = await mcpToolRepo.findEnabled()

    // Build scope policy
    const scopePolicy = createScopePolicy(project.targets.map(t => ({ value: t.value, type: t.type })))

    // Convert MCP tools to OpenAI functions
    const mcpFunctions = mcpToolsToFunctions(enabledTools)
    const controlFunctions = getControlFunctions()
    const allFunctions = [...mcpFunctions, ...controlFunctions]

    // Build initial context
    const reactCtx: ReactContext = {
      projectName: project.name,
      targets: project.targets.map(t => ({ value: t.value, type: t.type })),
      currentPhase: project.currentPhase,
      round,
      maxRounds: project.maxRounds,
      maxSteps: MAX_STEPS_PER_ROUND,
      stepIndex: 0,
      scopeDescription: scopePolicy.describe(),
      assets: assets.map(a => ({ kind: a.kind, value: a.value, label: a.label })),
      findings: findings.map(f => ({ title: f.title, severity: f.severity, affectedTarget: f.affectedTarget, status: f.status })),
    }

    const systemPrompt = await buildReactSystemPrompt(reactCtx)
    const initialMessage = `开始第 ${round} 轮渗透测试。目标: ${project.targets.map(t => t.value).join(", ")}。请分析当前状态并选择第一个工具。`

    const ctxManager = new ReactContextManager(systemPrompt, initialMessage)
    const llm = await getLlmProvider(projectId, "react")
    const queue = createPgBossJobQueue()
    const pendingAnalyses: Promise<unknown>[] = []

    let stopReason: string = "max_steps"
    let lastThought: string = ""

    // === ReAct Loop (Task 3) ===

  } catch (err) {
    // Error handling (Task 4)
    throw err
  } finally {
    unregisterAbort(projectId, abortController)
  }
```

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add lib/workers/react-worker.ts
git commit -m "feat: react-worker initialization — context, scope, functions"
```

---

## Task 3: 实现 ReAct 主循环

**Files:**
- Modify: `lib/workers/react-worker.ts`

- [ ] **Step 1: 在 `// === ReAct Loop ===` 位置插入循环代码**

```typescript
    for (let stepIndex = 0; stepIndex < MAX_STEPS_PER_ROUND; stepIndex++) {
      // Check abort
      if (abortController.signal.aborted) {
        stopReason = "aborted"
        log.info("aborted", `项目被停止，结束循环`)
        break
      }

      // Call LLM with function calling
      const timer = log.startTimer()
      log.info("llm_call", `Step ${stepIndex}: 调用 LLM`)

      const response = await llm.chat(ctxManager.getMessages(), {
        functions: allFunctions,
        function_call: "auto",
        signal: abortController.signal,
      })

      // Parse LLM response
      if (!response.functionCall) {
        // No function call — LLM finished reasoning
        lastThought = response.content
        stopReason = "llm_done"
        log.info("llm_done", `LLM 结束推理: ${response.content.slice(0, 200)}`, null, timer.elapsed())
        break
      }

      const { name: fnName, arguments: fnArgsStr } = response.functionCall
      const thought = response.content || ""
      lastThought = thought

      log.info("function_call", `Step ${stepIndex}: ${fnName}`, { thought: thought.slice(0, 200) }, timer.elapsed())

      // Handle control functions
      if (fnName === "done") {
        stopReason = "llm_done"
        const doneArgs = JSON.parse(fnArgsStr) as { summary?: string; phase_suggestion?: string }
        log.info("llm_done", `LLM 主动停止: ${doneArgs.summary ?? ""}`)

        // Update phase if suggested
        if (doneArgs.phase_suggestion) {
          await projectRepo.updatePhaseAndRound(projectId, doneArgs.phase_suggestion as PentestPhase, round)
        }

        ctxManager.addAssistantMessage(thought, { name: fnName, arguments: fnArgsStr })
        ctxManager.addToolResult({
          stepIndex, toolName: "done", target: "", functionName: fnName,
          output: "Round ended by LLM decision.", status: "succeeded", thought,
        })
        break
      }

      if (fnName === "report_finding") {
        const findingArgs = JSON.parse(fnArgsStr) as {
          title: string; severity: string; target: string; detail: string; recommendation?: string
        }
        await findingRepo.create({
          projectId,
          severity: findingArgs.severity as RiskLevel,
          title: findingArgs.title,
          summary: findingArgs.detail,
          affectedTarget: findingArgs.target,
          recommendation: findingArgs.recommendation,
        })
        log.info("finding_reported", `LLM 直接报告: ${findingArgs.title}`)

        ctxManager.addAssistantMessage(thought, { name: fnName, arguments: fnArgsStr })
        ctxManager.addToolResult({
          stepIndex, toolName: "report_finding", target: findingArgs.target, functionName: fnName,
          output: `Finding reported: ${findingArgs.title}`, status: "succeeded", thought,
        })

        await publishEvent({
          type: "react_step_completed",
          projectId,
          timestamp: new Date().toISOString(),
          data: { round, stepIndex, toolName: "report_finding", status: "succeeded", outputPreview: findingArgs.title },
        })
        continue
      }

      // === MCP Tool Execution (Task 3.5) ===
      // ... see Step 2
    }
```

- [ ] **Step 2: 在循环内 MCP tool execution 位置插入**

```typescript
      // MCP tool execution
      const fnArgs = JSON.parse(fnArgsStr) as Record<string, unknown>

      // Check scope
      const targetValue = (fnArgs.target ?? fnArgs.url ?? fnArgs.host ?? "") as string
      if (targetValue && !scopePolicy.isInScope({ kind: "domain", value: targetValue })) {
        log.warn("scope_exceeded", `目标 ${targetValue} 超出 scope`)
        ctxManager.addAssistantMessage(thought, { name: fnName, arguments: fnArgsStr })
        ctxManager.addToolResult({
          stepIndex, toolName: fnName, target: targetValue, functionName: fnName,
          output: `目标 "${targetValue}" 超出 scope 范围，已记录但未执行。Scope: ${scopePolicy.describe()}`,
          status: "failed", thought,
        })
        await publishEvent({
          type: "scope_exceeded",
          projectId,
          timestamp: new Date().toISOString(),
          data: { target: targetValue, reason: "out of scope" },
        })
        continue
      }

      // Publish step started event
      await publishEvent({
        type: "react_step_started",
        projectId,
        timestamp: new Date().toISOString(),
        data: { round, stepIndex, thought: thought.slice(0, 300), toolName: fnName, target: targetValue },
      })

      // Create mcp_run record
      const tool = await mcpToolRepo.findByToolName(fnName)
      const mcpRun = await mcpRunRepo.create({
        projectId,
        toolId: tool?.id,
        capability: tool?.capability ?? "general",
        toolName: fnName,
        target: targetValue,
        requestedAction: thought,
        riskLevel: (tool?.riskLevel ?? "low") as RiskLevel,
        phase: project.currentPhase,
        round,
        stepIndex,
        thought,
        functionArgs: fnArgs,
      })
      await mcpRunRepo.updateStatus(mcpRun.id, "running")

      // Execute MCP tool
      let toolOutput: string
      let toolStatus: "succeeded" | "failed" = "succeeded"

      try {
        // Use function args directly if tool has inputSchema, otherwise use buildToolInput
        const toolInput = tool?.inputSchema
          ? buildToolInputFromFunctionArgs(fnArgs, tool.inputSchema as Record<string, unknown>)
          : fnArgs

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Tool execution timeout")), TOOL_TIMEOUT_MS)
        )
        const result = await Promise.race([
          callTool(fnName, toolInput),
          timeoutPromise,
        ])
        toolOutput = result.isError ? `Error: ${result.content}` : result.content
        toolStatus = result.isError ? "failed" : "succeeded"
      } catch (err) {
        toolOutput = `Error: ${err instanceof Error ? err.message : String(err)}`
        toolStatus = "failed"
      }

      // Save result
      await mcpRunRepo.updateStatus(mcpRun.id, toolStatus, {
        rawOutput: toolOutput.slice(0, 100_000),
        error: toolStatus === "failed" ? toolOutput.slice(0, 500) : undefined,
      })

      // Add to context
      ctxManager.addAssistantMessage(thought, { name: fnName, arguments: fnArgsStr })
      ctxManager.addToolResult({
        stepIndex, toolName: fnName, target: targetValue, functionName: fnName,
        output: toolOutput, status: toolStatus, thought,
      })

      // Async analysis
      if (toolStatus === "succeeded" && toolOutput.length > 10) {
        pendingAnalyses.push(
          queue.publish("analyze_result", {
            projectId,
            mcpRunId: mcpRun.id,
            rawOutput: toolOutput.slice(0, 50_000),
            toolName: fnName,
            target: targetValue,
          })
        )
      }

      // Update round stats
      await prisma.orchestratorRound.update({
        where: { projectId_round: { projectId, round } },
        data: { actualSteps: stepIndex + 1, executedCount: { increment: 1 } },
      }).catch(() => {})

      // Publish step completed event
      await publishEvent({
        type: "react_step_completed",
        projectId,
        timestamp: new Date().toISOString(),
        data: { round, stepIndex, toolName: fnName, status: toolStatus, outputPreview: toolOutput.slice(0, 300) },
      })

      // Refresh assets/findings for next step's system prompt (every 3 steps)
      if ((stepIndex + 1) % 3 === 0) {
        const freshAssets = await assetRepo.findByProject(projectId)
        const freshFindings = await findingRepo.findByProject(projectId)
        reactCtx.stepIndex = stepIndex + 1
        reactCtx.assets = freshAssets.map(a => ({ kind: a.kind, value: a.value, label: a.label }))
        reactCtx.findings = freshFindings.map(f => ({ title: f.title, severity: f.severity, affectedTarget: f.affectedTarget, status: f.status }))
        const updatedPrompt = await buildReactSystemPrompt(reactCtx)
        ctxManager.updateSystemPrompt(updatedPrompt)
      }

      // Progress event
      await publishEvent({
        type: "react_round_progress",
        projectId,
        timestamp: new Date().toISOString(),
        data: { round, currentStep: stepIndex + 1, maxSteps: MAX_STEPS_PER_ROUND, phase: project.currentPhase },
      })
```

- [ ] **Step 3: 编译验证**

Run: `npx tsc --noEmit`

---

## Task 4: 实现 Round 结束逻辑和错误处理

**Files:**
- Modify: `lib/workers/react-worker.ts`

- [ ] **Step 1: 在循环后、catch 前插入 round 结束逻辑**

```typescript
    // === Round Completion ===

    // Wait for pending analyses
    if (pendingAnalyses.length > 0) {
      log.info("waiting_analyses", `等待 ${pendingAnalyses.length} 个分析完成`)
      await Promise.race([
        Promise.allSettled(pendingAnalyses),
        new Promise(resolve => setTimeout(resolve, ANALYSIS_WAIT_MS)),
      ])
    }

    // Update round record
    await prisma.orchestratorRound.update({
      where: { projectId_round: { projectId, round } },
      data: { status: "completed", stopReason, completedAt: new Date() },
    }).catch(() => {})

    // Publish round completed → triggers reviewer
    await queue.publish("round_completed", { projectId, round })

    await publishEvent({
      type: "react_round_completed",
      projectId,
      timestamp: new Date().toISOString(),
      data: { round, stopReason, lastThought: lastThought.slice(0, 500) },
    })

    await auditRepo.create({
      projectId,
      category: "orchestration",
      action: "react_round_completed",
      actor: "system",
      detail: `Round ${round}: ${stopReason}, last thought: ${lastThought.slice(0, 200)}`,
    })

    log.info("completed", `ReAct 循环结束: ${stopReason}`)
```

- [ ] **Step 2: 实现 catch 块**

```typescript
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error("failed", `ReAct 循环失败: ${message}`, { error: message })

    try {
      await prisma.orchestratorRound.update({
        where: { projectId_round: { projectId, round } },
        data: { status: "failed", stopReason: "error" },
      }).catch(() => {})

      await publishEvent({
        type: "react_round_failed",
        projectId,
        timestamp: new Date().toISOString(),
        data: { round, error: message.slice(0, 500) },
      })
    } catch {
      // swallow
    }

    throw err  // pg-boss will retry
  }
```

- [ ] **Step 3: 编译验证**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add lib/workers/react-worker.ts
git commit -m "feat: complete react-worker ReAct loop implementation"
```

---

## Task 5: 单元测试

**Files:**
- Create: `tests/lib/workers/react-worker.test.ts`

- [ ] **Step 1: 编写基础测试**

测试要点：
- `handleReactRound` 在项目不存在时返回（不抛错）
- `handleReactRound` 在项目 stopped 时跳过
- Mock LLM 返回 `done()` function call → 循环应在 1 步后结束
- Mock LLM 返回 MCP tool call → 验证 callTool 被调用
- Mock LLM 返回 `report_finding()` → 验证 findingRepo.create 被调用

```typescript
// tests/lib/workers/react-worker.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock all dependencies before import
vi.mock("@/lib/repositories/project-repo")
vi.mock("@/lib/repositories/asset-repo")
vi.mock("@/lib/repositories/finding-repo")
vi.mock("@/lib/repositories/mcp-run-repo")
vi.mock("@/lib/repositories/mcp-tool-repo")
vi.mock("@/lib/repositories/audit-repo")
vi.mock("@/lib/infra/prisma")
vi.mock("@/lib/infra/event-bus")
vi.mock("@/lib/infra/job-queue")
vi.mock("@/lib/infra/abort-registry")
vi.mock("@/lib/infra/pipeline-logger")
vi.mock("@/lib/mcp/registry")
vi.mock("@/lib/llm")

describe("handleReactRound", () => {
  it("should skip if project not found", async () => {
    const { handleReactRound } = await import("@/lib/workers/react-worker")
    const projectRepo = await import("@/lib/repositories/project-repo")
    vi.mocked(projectRepo.findById).mockResolvedValue(null)

    await handleReactRound({ projectId: "nonexistent", round: 1 })
    // Should not throw
  })
})
```

- [ ] **Step 2: 运行测试**

Run: `npx vitest run tests/lib/workers/react-worker.test.ts`

- [ ] **Step 3: Commit**

```bash
git add tests/lib/workers/react-worker.test.ts
git commit -m "test: add react-worker basic tests"
```
