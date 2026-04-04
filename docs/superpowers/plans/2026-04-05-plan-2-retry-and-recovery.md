# Plan 2: 分层重试策略 + Stale Job 恢复

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让流水线具备自愈能力 — LLM 调用失败自动重试，MCP 工具失败不阻塞流程，worker 崩溃重启后自动恢复卡死项目。

**Architecture:** pg-boss 原生 retryLimit/retryDelay 控制重试，execution-worker 失败降级（不抛异常），worker 启动时扫描 stale 项目重新发布 job。

**Tech Stack:** pg-boss + Prisma 7

**依赖:** Plan 1（pipeline logger）必须先完成

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `lib/infra/job-queue.ts` | subscribe 支持 per-job 配置 |
| Modify | `worker.ts` | 传入 job 配置 + 启动恢复扫描 |
| Modify | `lib/workers/execution-worker.ts` | 失败降级不抛异常 |
| Modify | `lib/workers/planning-worker.ts` | 重试前 abort 检查 |
| Modify | `lib/workers/analysis-worker.ts` | 重试前 abort 检查 |
| Modify | `lib/workers/verification-worker.ts` | 重试前 abort 检查 |
| Modify | `lib/workers/lifecycle-worker.ts` | 重试前 abort 检查 |
| Modify | `lib/repositories/project-repo.ts` | 新增 findByLifecycles |
| Modify | `lib/repositories/mcp-run-repo.ts` | 新增 countPendingByProject |

---

### Task 1: 扩展 JobQueue subscribe 支持 per-job 配置

**Files:**
- Modify: `lib/infra/job-queue.ts`

- [ ] **Step 1: 新增 SubscribeOptions 类型**

在 `JobOptions` 类型之后添加：

```typescript
export type SubscribeOptions = {
  teamSize?: number      // pg-boss: how many jobs to fetch at once
  teamConcurrency?: number
  newJobCheckIntervalSeconds?: number
}
```

- [ ] **Step 2: 修改 subscribe 方法签名**

将 `subscribe<T>` 方法的签名改为：

```typescript
async subscribe<T = unknown>(
  jobName: string,
  handler: (data: T) => Promise<void>,
  options?: SubscribeOptions,
)
```

实现改为：

```typescript
async subscribe<T = unknown>(
  jobName: string,
  handler: (data: T) => Promise<void>,
  options?: SubscribeOptions,
) {
  await ensureStarted(boss)
  await boss.createQueue(jobName).catch(() => {})
  await boss.work<T>(
    jobName,
    {
      teamSize: options?.teamSize ?? 1,
      teamConcurrency: options?.teamConcurrency ?? 1,
      newJobCheckIntervalSeconds: options?.newJobCheckIntervalSeconds ?? 2,
    },
    async (jobs) => {
      for (const job of jobs) {
        await handler(job.data)
      }
    },
  )
},
```

- [ ] **Step 3: Commit**

```bash
git add lib/infra/job-queue.ts
git commit -m "feat: job-queue subscribe supports per-job options"
```

---

### Task 2: worker.ts 配置分层重试

**Files:**
- Modify: `worker.ts`

- [ ] **Step 1: 修改每个 subscribe 调用，通过 publish 时的 retryLimit 控制重试**

pg-boss 的重试由 publish 时的 `retryLimit` 和 `retryDelay` 控制。当前 `publish()` 默认已经是 `retryLimit: 3, retryDelay: 5`。需要在各 worker 内部根据 job 类型调整发布参数。

在 `worker.ts` 中，修改 `plan_round` 和 `round_completed` 的 publish 配置不在这里做（它们在各自的 worker 中发布）。但我们需要在 `worker.ts` 中为 `execute_tool` 设置不同的 subscribe 参数。

实际上重试策略的主要修改在 **publish 端**（各 worker 发布下游 job 时），以及 **handler 端**（是否 throw 让 pg-boss 重试）。

保持 worker.ts 的 subscribe 不变，重试逻辑在各 worker handler 中控制。

- [ ] **Step 2: Commit**（如有改动）

---

### Task 3: execution-worker 失败降级（不重试）

**Files:**
- Modify: `lib/workers/execution-worker.ts`

- [ ] **Step 1: 修改 catch 块 — 不再 throw（pg-boss 不会重试）**

当前 `handleExecuteTool` 的 catch 块末尾有 `throw err`，这会触发 pg-boss 重试。MCP 工具执行不应重试（可能有副作用）。

将 catch 块末尾的 `throw err` 删除，改为：

```typescript
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error("failed", `执行失败: ${message}`, { error: message })

    await mcpRunRepo.updateStatus(mcpRunId, "failed", {
      error: message.slice(0, 1000),
      completedAt: new Date(),
    })

    await publishEvent({
      type: "tool_failed",
      projectId,
      timestamp: new Date().toISOString(),
      data: { mcpRunId, toolName: mcpRun.toolName, error: message.slice(0, 500) },
    })

    // 不 throw — MCP 工具有副作用，不应自动重试
    // 轮次完成检查仍然执行，让其他工具继续
    await checkRoundCompletion(projectId, mcpRun.round)
  }
```

- [ ] **Step 2: Commit**

```bash
git add lib/workers/execution-worker.ts
git commit -m "fix: execution-worker degrades gracefully on failure (no retry)"
```

---

### Task 4: LLM worker 重试前 abort 检查

**Files:**
- Modify: `lib/workers/planning-worker.ts`
- Modify: `lib/workers/analysis-worker.ts`
- Modify: `lib/workers/verification-worker.ts`
- Modify: `lib/workers/lifecycle-worker.ts`

这 4 个 worker 的 catch 块都有 `throw err` 触发 pg-boss 重试。需要在重试时检查项目是否已停止。

- [ ] **Step 1: 在每个 worker 的 handler 开头添加 abort 检查**

在每个 handler 函数体最开始（创建 logger 之后，业务逻辑之前）添加：

```typescript
// 重试时检查项目是否已停止
const project = await projectRepo.findById(projectId)
if (!project || project.lifecycle === "stopped" || project.lifecycle === "stopping") {
  log.info("skipped", `项目已 ${project?.lifecycle ?? "deleted"}，跳过`)
  return
}
```

注意：planning-worker 已经有类似检查（line 39），但检查的是 `planning` 状态。需要扩展为同时检查 stopped/stopping。

对 planning-worker，将 line 39-42 的检查改为：

```typescript
if (project.lifecycle === "stopped" || project.lifecycle === "stopping") {
  log.info("skipped", `项目已 ${project.lifecycle}，跳过规划`)
  return
}
if (project.lifecycle !== "planning") {
  log.warn("skipped", `项目处于 ${project.lifecycle} 状态，跳过规划`)
  return
}
```

对 analysis-worker（line 39-42）和 verification-worker（line 43-46），它们已有类似检查，保持不变。

对 lifecycle-worker 的 `handleRoundCompleted`（line 34-37），它已有 stopped/stopping 检查，保持不变。

- [ ] **Step 2: 确认 planning-worker 的 catch 块保留 throw err**

planning-worker 失败应该重试（LLM 调用是幂等的），保留 `throw err`。但在 catch 块中，将 `await projectRepo.updateLifecycle(projectId, "failed")` 改为只在最后一次重试时才标记 failed。

实际上 pg-boss 默认 retryLimit=3，只有 3 次都失败后 job 才进入 failed 状态。但当前代码在第一次失败时就把项目标记为 failed，导致后续重试时项目已经是 failed 状态而跳过。

**修复 planning-worker catch 块：** 不要在 catch 中设置 lifecycle=failed，让 pg-boss 处理重试。只在最终失败时（通过 pg-boss onComplete 或 deadLetter）标记。

将 planning-worker catch 块的 `await projectRepo.updateLifecycle(projectId, "failed")` 删除，替换为：

```typescript
log.error("failed", `规划失败 (pg-boss 将重试): ${message}`, { error: message })

await prisma.orchestratorRound.update({
  where: { projectId_round: { projectId, round } },
  data: { status: "failed" },
}).catch(() => {})

await publishEvent({
  type: "plan_failed",
  projectId,
  timestamp: new Date().toISOString(),
  data: { round, error: message.slice(0, 500) },
})

throw err // pg-boss will retry
```

- [ ] **Step 3: 同样修复 lifecycle-worker catch 块**

`handleRoundCompleted` 的 catch 块中，不要立即 `projectRepo.updateLifecycle(projectId, "failed")`，让 pg-boss 先重试。

- [ ] **Step 4: Commit**

```bash
git add lib/workers/planning-worker.ts lib/workers/analysis-worker.ts lib/workers/verification-worker.ts lib/workers/lifecycle-worker.ts
git commit -m "fix: LLM workers check abort before retry, defer failure marking"
```

---

### Task 5: 新增 repository 辅助方法

**Files:**
- Modify: `lib/repositories/project-repo.ts`
- Modify: `lib/repositories/mcp-run-repo.ts`

- [ ] **Step 1: project-repo.ts 新增 findByLifecycles**

```typescript
export async function findByLifecycles(
  states: readonly string[],
): Promise<Project[]> {
  return prisma.project.findMany({
    where: { lifecycle: { in: states as ProjectLifecycle[] } },
    include: { targets: true },
  })
}
```

- [ ] **Step 2: mcp-run-repo.ts 新增 countPendingByProject**

```typescript
export async function countPendingByProject(projectId: string): Promise<number> {
  return prisma.mcpRun.count({
    where: {
      projectId,
      status: { in: ["pending", "scheduled", "running"] },
    },
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/repositories/project-repo.ts lib/repositories/mcp-run-repo.ts
git commit -m "feat: add findByLifecycles and countPendingByProject queries"
```

---

### Task 6: Stale job 恢复

**Files:**
- Modify: `worker.ts`

- [ ] **Step 1: 在 worker.ts 中添加 recoverStaleProjects 函数**

在 `main()` 函数之前添加：

```typescript
import * as projectRepo from "@/lib/repositories/project-repo"
import * as mcpRunRepo from "@/lib/repositories/mcp-run-repo"
import { createPipelineLogger } from "@/lib/infra/pipeline-logger"

async function recoverStaleProjects(queue: JobQueue) {
  const staleStates = ["planning", "executing", "reviewing", "settling"] as const
  const staleProjects = await projectRepo.findByLifecycles(staleStates)

  if (staleProjects.length === 0) return

  logger.info({ count: staleProjects.length }, "found stale projects, attempting recovery")

  for (const project of staleProjects) {
    const log = createPipelineLogger(project.id, "recovery")

    switch (project.lifecycle) {
      case "planning":
        log.warn("stale_recovery", `恢复卡死项目: planning → 重新规划第 ${project.currentRound + 1} 轮`)
        await queue.publish("plan_round", { projectId: project.id, round: project.currentRound + 1 })
        break

      case "executing": {
        const pending = await mcpRunRepo.countPendingByProject(project.id)
        if (pending === 0) {
          log.warn("stale_recovery", `恢复卡死项目: executing → 所有 run 已完成，触发轮次审阅`)
          await queue.publish("round_completed", {
            projectId: project.id,
            round: project.currentRound,
          }, { singletonKey: `round-complete-${project.id}-${project.currentRound}` })
        } else {
          log.warn("stale_recovery", `恢复卡死项目: executing → 还有 ${pending} 个 pending run，等待完成`)
        }
        break
      }

      case "reviewing":
        log.warn("stale_recovery", `恢复卡死项目: reviewing → 重新触发轮次审阅`)
        await queue.publish("round_completed", {
          projectId: project.id,
          round: project.currentRound,
        }, { singletonKey: `round-complete-${project.id}-${project.currentRound}` })
        break

      case "settling":
        log.warn("stale_recovery", `恢复卡死项目: settling → 重新触发结算`)
        await queue.publish("settle_closure", { projectId: project.id })
        break
    }
  }
}
```

- [ ] **Step 2: 在 main() 中，subscribe 之后调用恢复**

在 `console.log("[worker] All handlers registered...")` 之后（改为 `logger.info(...)` 之后）添加：

```typescript
// Recover stale projects from previous crashes
await recoverStaleProjects(queue)
```

需要将 `import type { JobQueue } from "@/lib/infra/job-queue"` 加到顶部，并且需要引入 `JobQueue` 类型。实际上 `queue` 变量已经是 `JobQueue` 类型，直接传入即可。

- [ ] **Step 3: Commit**

```bash
git add worker.ts
git commit -m "feat: stale project recovery on worker startup"
```

---

### Task 7: 验证

- [ ] **Step 1: TypeScript 编译检查**

Run: `npx tsc --noEmit`

Expected: 0 errors

- [ ] **Step 2: Commit（如有修复）**

```bash
git add -A
git commit -m "fix: resolve any issues from plan-2 integration"
```
