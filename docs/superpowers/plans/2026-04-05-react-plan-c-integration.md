# ReAct Plan C: 对接层

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 ReAct 引擎接入现有的 worker 注册、项目启动、生命周期管理和审批服务。

**Architecture:** 修改 worker.ts 的 job 注册、project-service 的启动流程、lifecycle-worker 的 round 衔接，完成端到端的 ReAct 集成。

**Tech Stack:** Next.js 15 + TypeScript + Prisma 7 + PostgreSQL 16

**Prerequisites:** Plan A（ReAct Worker 核心 + function-calling + react-prompt + react-context）和 Plan B（数据模型变更 + lifecycle 状态机更新）已完成。

---

## File Structure

| Action | File | Change Summary |
|--------|------|---------------|
| Modify | `worker.ts` | 删除 `plan_round`/`execute_tool` 注册，新增 `react_round`；适配 stale recovery |
| Modify | `lib/services/project-service.ts` | `startProject()` 发布 `react_round` 替换 `plan_round` |
| Modify | `lib/workers/lifecycle-worker.ts` | reviewer CONTINUE 发布 `react_round`；reviewer 上下文加入 stopReason/thought |
| Modify | `lib/services/approval-service.ts` | 注释 `execute_tool` 发布逻辑 |
| Modify | `scripts/publish-job.ts` | 更新调试脚本为 `react_round` |

---

### Task 1: worker.ts — 删除旧 job 注册，新增 react_round

**File:** `worker.ts`

- [ ] **Step 1: 删除 `plan_round` 和 `execute_tool` 订阅，新增 `react_round` 订阅**

找到 `worker.ts` 中的 job handler 注册区域（约第 89-97 行），将 `plan_round` 和 `execute_tool` 替换为 `react_round`。

```typescript
// ---- 删除以下两个订阅 ----
// await queue.subscribe("plan_round", async (data) => {
//   const { handlePlanRound } = await import("@/lib/workers/planning-worker")
//   await handlePlanRound(data as { projectId: string; round: number })
// })
//
// await queue.subscribe("execute_tool", async (data) => {
//   const { handleExecuteTool } = await import("@/lib/workers/execution-worker")
//   await handleExecuteTool(data as { projectId: string; mcpRunId: string })
// })

// ---- 新增以下订阅 ----
await queue.subscribe("react_round", async (data) => {
  const { handleReactRound } = await import("@/lib/workers/react-worker")
  await handleReactRound(data as { projectId: string; round: number })
}, {
  // ReAct round 可能运行很长时间（30步 × 工具执行），不需要并发
  localConcurrency: 1,
})
```

**保留不变的订阅**：`analyze_result`、`verify_finding`、`round_completed`、`settle_closure`。

- [ ] **Step 2: 验证编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

确认 `worker.ts` 无类型错误。如果报 `react-worker` 找不到，确认 Plan A 已创建该文件。

---

### Task 2: worker.ts — 适配 stale recovery 逻辑

**File:** `worker.ts`

- [ ] **Step 1: 修改 `recoverStaleProjects` 中的 `planning` 分支**

当前代码（约第 22-24 行）在 `planning` 状态下发布 `plan_round`，需改为发布 `react_round`。同时，由于 Plan B 新增了 `idle → executing` 直接转换，新的 ReAct 流程不再经过 `planning` 状态。但 `planning` 分支仍需保留以恢复旧数据或边缘情况：

```typescript
case "planning":
  log.warn("stale_recovery", `恢复卡死项目: planning → 重新发起第 ${project.currentRound + 1} 轮 ReAct`)
  await queue.publish("react_round", {
    projectId: project.id,
    round: project.currentRound + 1,
  }, { expireInSeconds: 1800 })
  break
```

- [ ] **Step 2: 修改 `executing` 分支，适配 ReAct 单 job 模式**

当前 `executing` 分支检查 pending mcp_run 数量来判断是否完成。ReAct 模式下，一个 round 只有一个 `react_round` job，所有工具执行内联在该 job 内。stale recovery 需要改为：如果 `executing` 状态超时，直接重新发布 `react_round`（ReAct worker 会检测并从头开始当前 round）：

```typescript
case "executing": {
  // ReAct 模式：一个 round 是一个 react_round job
  // 检查是否有活跃的 react_round job（通过 pg-boss 查询）
  // 如果没有活跃 job，说明 job 已丢失，重新发布
  const pending = await mcpRunRepo.countPendingByProject(project.id)
  if (pending === 0) {
    // 没有 pending run 说明 ReAct 循环可能已结束但 round_completed 丢失
    log.warn("stale_recovery", `恢复卡死项目: executing → 无 pending run，触发轮次审阅`)
    await queue.publish("round_completed", {
      projectId: project.id,
      round: project.currentRound,
    }, { singletonKey: `round-complete-${project.id}-${project.currentRound}` })
  } else {
    // 有 pending run 说明 ReAct 循环中途崩溃，force-fail 后重发 react_round
    const forceFailed = await mcpRunRepo.failStaleRunningRuns(project.id, 10 * 60 * 1000)
    if (forceFailed > 0) {
      log.warn("stale_recovery", `强制终止 ${forceFailed} 个超时 running run`)
    }
    log.warn("stale_recovery", `恢复卡死项目: executing → 重新发起第 ${project.currentRound} 轮 ReAct`)
    await queue.publish("react_round", {
      projectId: project.id,
      round: project.currentRound,
    }, {
      expireInSeconds: 1800,
      singletonKey: `react-round-${project.id}-${project.currentRound}`,
    })
  }
  break
}
```

- [ ] **Step 3: 验证编译 + 确认 stale recovery 逻辑覆盖所有分支**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

人工审查：`planning`、`executing`、`reviewing`、`settling` 四个分支全部使用新 job name。

---

### Task 3: project-service.ts — 启动时发布 react_round

**File:** `lib/services/project-service.ts`

- [ ] **Step 1: 修改 `startProject()` 中的 job 发布**

找到 `startProject` 函数中的 `queue.publish("plan_round", ...)` 调用（约第 70-73 行），替换为 `react_round` 并增加超时配置：

```typescript
export async function startProject(projectId: string) {
  const project = await getProject(projectId)
  const event = project.lifecycle === "failed" ? "RETRY" as const : "START" as const
  const nextLifecycle = transition(project.lifecycle, event)

  await projectRepo.updateLifecycle(projectId, nextLifecycle)

  const queue = createPgBossJobQueue()
  await queue.publish("react_round", {
    projectId,
    round: project.currentRound + 1,
  }, {
    expireInSeconds: 1800,  // ReAct round 最长 30 分钟
  })

  await publishEvent({
    type: "lifecycle_changed",
    projectId,
    timestamp: new Date().toISOString(),
    data: { lifecycle: nextLifecycle },
  })

  await auditRepo.create({
    projectId,
    category: "project",
    action: "started",
    actor: "user",
  })

  return { lifecycle: nextLifecycle }
}
```

**注意**：`transition(project.lifecycle, "START")` 当前返回 `"planning"`（因为 lifecycle.ts 中 `idle → START → planning`）。Plan B 应该已经将这个转换改为 `idle → START → executing`。如果 Plan B 尚未修改 lifecycle.ts，需要在此确认。如果 `transition` 仍返回 `planning`，则这里暂时可以工作（stale recovery 会兜底），但应该在 Task 6 的验证步骤中确认 Plan B 的 lifecycle 改动已就位。

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

---

### Task 4: lifecycle-worker.ts — reviewer CONTINUE 时发布 react_round 并适配上下文

**File:** `lib/workers/lifecycle-worker.ts`

- [ ] **Step 1: 修改 CONTINUE 分支——将 `plan_round` 改为 `react_round`**

找到 `handleRoundCompleted` 中 `decision.decision !== "settle"` 的分支（约第 108-114 行）：

```typescript
// ---- 修改前 ----
// await queue.publish("plan_round", { projectId, round: round + 1 })

// ---- 修改后 ----
await queue.publish("react_round", {
  projectId,
  round: round + 1,
}, {
  expireInSeconds: 1800,
})
```

- [ ] **Step 2: 修改错误恢复中的 `plan_round` 引用**

同一文件中有两处错误恢复也发布 `plan_round`（约第 163 行和可能的其他位置）。全部改为 `react_round`：

```typescript
// 约第 163 行，reviewer 失败后的恢复分支
// ---- 修改前 ----
// await queue.publish("plan_round", { projectId, round: round + 1 })

// ---- 修改后 ----
await queue.publish("react_round", {
  projectId,
  round: round + 1,
}, {
  expireInSeconds: 1800,
})
```

**用全局搜索确认**：在 `lifecycle-worker.ts` 中搜索所有 `plan_round` 引用并替换为 `react_round`。

- [ ] **Step 3: 丰富 reviewer 上下文——加入 ReAct 特有信息**

在 `handleRoundCompleted` 的 reviewer 上下文构建区域（约第 57-83 行），增加 ReAct 上下文字段。先从 OrchestratorRound 读取 `stopReason` 和 `actualSteps`，再从最后一个 McpRun 读取 `thought`：

```typescript
// 在 "Gather round summary for reviewer" 区域之后，reviewer LLM 调用之前，新增：

// Fetch ReAct-specific round metadata
const orchestratorRound = await prisma.orchestratorRound.findUnique({
  where: { projectId_round: { projectId, round } },
})
const lastThought = runs.length > 0
  ? runs
      .filter((r) => r.thought)
      .sort((a, b) => (b.stepIndex ?? 0) - (a.stepIndex ?? 0))[0]?.thought ?? null
  : null

// 将 ReAct 上下文追加到 roundSummary
const reactContext = [
  `ReAct 循环: ${orchestratorRound?.actualSteps ?? runs.length} 步`,
  `停止原因: ${orchestratorRound?.stopReason ?? "unknown"}`,
  lastThought ? `LLM 最后推理: ${lastThought.slice(0, 300)}` : null,
].filter(Boolean).join("\n")

const fullRoundSummary = `${roundSummary}\n\n${reactContext}`
```

然后将 `reviewerCtx.roundSummary` 赋值改为 `fullRoundSummary`：

```typescript
const reviewerCtx: ReviewerContext = {
  projectName: project.name,
  currentPhase: project.currentPhase,
  round,
  maxRounds: project.maxRounds,
  roundSummary: fullRoundSummary,  // <-- 使用增强后的摘要
  totalAssets,
  totalFindings: findings.length,
  unverifiedFindings: unverified.length,
}
```

**注意**：`r.thought` 和 `r.stepIndex` 是 Plan B 在 Prisma schema 中新增的字段。如果 Prisma client 尚未重新生成，需要先运行 `npx prisma generate`。

- [ ] **Step 4: 修改 lifecycle 转换——CONTINUE 后跳过 planning 直接到 executing**

当前 `transition("reviewing", "CONTINUE")` 返回 `"planning"`。Plan B 应该已将其改为返回 `"executing"`。如果 Plan B 尚未修改，需要在 `lib/domain/lifecycle.ts` 中：

```typescript
// ---- 修改前 ----
// reviewing: { CONTINUE: "planning", SETTLE: "settling", STOP: "stopping" },

// ---- 修改后 ----
reviewing: { CONTINUE: "executing", SETTLE: "settling", STOP: "stopping" },
```

但如果 Plan B 已经处理了 lifecycle.ts 的改动，跳过此步。**务必确认** lifecycle.ts 中 `reviewing → CONTINUE` 的目标状态为 `executing`。

- [ ] **Step 5: 验证编译**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

---

### Task 5: approval-service.ts — 注释 execute_tool 发布逻辑

**File:** `lib/services/approval-service.ts`

- [ ] **Step 1: 注释 `execute_tool` 发布代码，添加 TODO 标记**

找到 `decide()` 函数中 `decision === "approved"` 分支（约第 22-28 行），注释掉 `execute_tool` 发布并添加注释说明：

```typescript
if (decision === "approved" && approval.mcpRunId) {
  // TODO(react): ReAct 模式下审批逻辑待重新设计。
  // ReAct 循环内工具执行是内联的，不再通过独立 execute_tool job 派发。
  // 未来审批将暂停 ReAct 循环，审批通过后恢复。
  // 当前初版为全自动模式，此分支不会触发。
  //
  // const queue = createPgBossJobQueue()
  // await mcpRunRepo.updateStatus(approval.mcpRunId, "scheduled")
  // await queue.publish("execute_tool", {
  //   projectId: approval.projectId,
  //   mcpRunId: approval.mcpRunId,
  // })

  // 临时：仅更新状态，不派发执行
  await mcpRunRepo.updateStatus(approval.mcpRunId, "scheduled")
} else if (decision === "rejected" && approval.mcpRunId) {
  await mcpRunRepo.updateStatus(approval.mcpRunId, "cancelled")
}
```

- [ ] **Step 2: 清理未使用的 import（如果有的话）**

检查 `createPgBossJobQueue` 在文件中是否还有其他使用处。如果注释掉 `execute_tool` 后，`createPgBossJobQueue` 不再被任何代码引用，则也注释掉顶部的 import：

```typescript
// TODO(react): 审批恢复 ReAct 循环时取消注释
// import { createPgBossJobQueue } from "@/lib/infra/job-queue"
```

**注意**：当前文件中 `createPgBossJobQueue` 只在 `execute_tool` 发布处使用，注释后 import 变成 unused，TypeScript 不会报错但 lint 可能警告。

- [ ] **Step 3: 验证编译**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

---

### Task 6: scripts/publish-job.ts — 更新调试脚本

**File:** `scripts/publish-job.ts`

- [ ] **Step 1: 将调试脚本从 `plan_round` 改为 `react_round`**

全面替换脚本中的 job name、lifecycle 状态和日志输出：

```typescript
import "dotenv/config"
import { prisma } from "../lib/infra/prisma"
import { createPgBossJobQueue } from "../lib/infra/job-queue"

const projectId = process.argv[2] ?? "cmnkc4cxd0000tguyn0si4ey1"

async function main() {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) {
    console.error("Project not found:", projectId)
    process.exit(1)
  }
  console.log("Project:", project.name, "| lifecycle:", project.lifecycle)

  // ReAct 模式直接进入 executing 状态（跳过 planning）
  if (project.lifecycle !== "executing") {
    await prisma.project.update({
      where: { id: projectId },
      data: { lifecycle: "executing", currentRound: 1, currentPhase: "recon" },
    })
    console.log("Updated to executing state")
  }

  const queue = createPgBossJobQueue()
  await queue.start()
  console.log("pg-boss started")

  const jobId = await queue.publish("react_round", {
    projectId,
    round: 1,
  }, {
    expireInSeconds: 1800,
  })
  console.log("Published react_round job:", jobId)

  // Wait for pg-boss to flush
  await new Promise((r) => setTimeout(r, 3000))
  await queue.stop()
  await prisma.$disconnect()
  console.log("Done")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 2: 验证脚本编译**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

---

### Task 7: react_round Job 超时配置统一检查

**Files:** `worker.ts`, `lib/services/project-service.ts`, `lib/workers/lifecycle-worker.ts`, `scripts/publish-job.ts`

- [ ] **Step 1: 搜索所有 `react_round` 发布点，确认 `expireInSeconds: 1800`**

所有发布 `react_round` 的位置必须统一设置 30 分钟超时：

```bash
grep -rn "react_round" worker.ts lib/services/project-service.ts lib/workers/lifecycle-worker.ts scripts/publish-job.ts
```

确认每个 `queue.publish("react_round", ...)` 调用都包含 `{ expireInSeconds: 1800 }`。

如果某处遗漏，补上。

- [ ] **Step 2: 搜索残留的 `plan_round` 和 `execute_tool` 引用**

```bash
grep -rn "plan_round\|execute_tool" worker.ts lib/services/ lib/workers/ scripts/
```

除了注释中的引用外，不应有任何活跃代码仍引用旧 job name。如果发现遗漏，回到对应 Task 修复。

---

### Task 8: 端到端手动验证

**Prerequisites:** Plan A 和 Plan B 已完成且编译通过，数据库已迁移（`npx prisma migrate dev`）。

- [ ] **Step 1: 完整编译检查**

```bash
npx tsc --noEmit --pretty
```

零错误通过。

- [ ] **Step 2: 启动 worker 进程，验证 handler 注册**

```bash
npx tsx worker.ts
```

确认日志输出中包含：
- `MCP bootstrap complete`
- `all handlers registered, waiting for jobs`
- **不包含** `plan_round` 或 `execute_tool` 相关的错误

用 `Ctrl+C` 停止。

- [ ] **Step 3: 使用调试脚本发布 react_round job**

```bash
npx tsx scripts/publish-job.ts <projectId>
```

确认输出：
- `Updated to executing state`（而非 `planning`）
- `Published react_round job: <jobId>`

- [ ] **Step 4: 启动 worker 并观察 react_round 被消费**

在一个终端启动 worker：

```bash
npx tsx worker.ts
```

在另一个终端发布 job：

```bash
npx tsx scripts/publish-job.ts <projectId>
```

确认 worker 日志中出现 `handleReactRound` 被调用的日志（来自 Plan A 的 react-worker.ts 实现）。

- [ ] **Step 5: 通过前端 UI 触发完整流程**

1. 打开浏览器，进入项目页面
2. 点击 "Start" 按钮
3. 确认项目 lifecycle 变为 `executing`（而非 `planning`）
4. 观察 worker 日志，确认 `react_round` job 被消费
5. 等待 round 完成，确认 reviewer 被调用
6. 如果 reviewer 决定 CONTINUE，确认下一轮 `react_round` 被发布

- [ ] **Step 6: 验证 stale recovery**

1. 启动 worker
2. 发布一个 `react_round` job
3. 在 ReAct 循环执行中途，`kill -9` worker 进程
4. 重新启动 worker
5. 等待 5 分钟（或手动调用 `recoverStaleProjects`），确认 stale 项目被恢复

---

### Task 9: 清理与代码审查

- [ ] **Step 1: 确认不再有对 planning-worker / execution-worker 的引用**

```bash
grep -rn "planning-worker\|execution-worker\|handlePlanRound\|handleExecuteTool" worker.ts lib/ app/ scripts/ --include="*.ts" --include="*.tsx"
```

除了注释和测试文件外，不应有活跃引用。

- [ ] **Step 2: 确认 approval-service.ts 的 TODO 注释清晰**

审查 `lib/services/approval-service.ts`，确认：
- `execute_tool` 发布代码已被注释
- TODO 注释清晰说明了未来 ReAct 审批的设计方向
- 文件仍能编译通过

- [ ] **Step 3: 最终编译确认**

```bash
npx tsc --noEmit --pretty && echo "Plan C complete - all clear"
```
