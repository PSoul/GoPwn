# Plan 4: Worker 单元测试

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 5 个 worker 补充单元测试，覆盖正常路径、LLM/MCP 失败、超时、abort 场景，确保 Plan 1-3 的改动正确工作。

**Architecture:** 使用 Vitest mock 隔离外部依赖（LLM provider、MCP callTool、Prisma repositories），验证状态转换和日志记录。

**Tech Stack:** Vitest + vi.mock

**依赖:** Plan 1-3 应先完成（测试验证这些改动的正确性）

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `tests/lib/workers/planning-worker.test.ts` | planning-worker 5 个用例 |
| Create | `tests/lib/workers/execution-worker.test.ts` | execution-worker 5 个用例 |
| Create | `tests/lib/workers/analysis-worker.test.ts` | analysis-worker 4 个用例 |
| Create | `tests/lib/workers/verification-worker.test.ts` | verification-worker 4 个用例 |
| Create | `tests/lib/workers/lifecycle-worker.test.ts` | lifecycle-worker 4 个用例 |
| Create | `tests/lib/workers/_helpers.ts` | 共享 mock factory |

---

### Task 1: 共享 mock helpers

**Files:**
- Create: `tests/lib/workers/_helpers.ts`

- [ ] **Step 1: 创建共享 helper**

```typescript
import { vi } from "vitest"

/** 创建 mock project */
export function mockProject(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "proj-test-001",
    code: "proj-20260405-abc",
    name: "Test Project",
    description: "",
    lifecycle: "planning",
    currentPhase: "recon",
    currentRound: 0,
    maxRounds: 10,
    targets: [{ value: "http://127.0.0.1:8080", type: "url", normalized: "http://127.0.0.1:8080" }],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/** 创建 mock McpRun */
export function mockMcpRun(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "run-test-001",
    projectId: "proj-test-001",
    toolName: "fscan_port_scan",
    target: "127.0.0.1",
    requestedAction: "扫描目标端口",
    capability: "port_scanning",
    riskLevel: "low",
    status: "scheduled",
    phase: "recon",
    round: 1,
    rawOutput: null,
    error: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/** 创建 mock LLM provider */
export function mockLlmProvider(response: string) {
  return {
    chat: vi.fn().mockResolvedValue({
      content: response,
      provider: "test-provider",
      model: "test-model",
      durationMs: 1000,
    }),
  }
}

/** 创建 mock Finding */
export function mockFinding(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "finding-test-001",
    projectId: "proj-test-001",
    evidenceId: "evidence-001",
    status: "suspected",
    severity: "high",
    title: "SQL Injection",
    summary: "Found SQL injection in login form",
    affectedTarget: "http://127.0.0.1:8080/login",
    recommendation: "Use parameterized queries",
    evidence: {
      rawOutput: "HTTP/1.1 200 OK\nerror in SQL syntax",
      toolName: "curl_http_request",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/** 标准 mock LLM plan 响应 */
export const MOCK_PLAN_RESPONSE = JSON.stringify({
  summary: "执行端口扫描和服务探测",
  phase: "recon",
  items: [
    {
      toolName: "fscan_port_scan",
      target: "127.0.0.1",
      action: "扫描常见端口",
      rationale: "首轮信息收集",
      phase: "recon",
      riskLevel: "low",
    },
  ],
})

/** 标准 mock LLM analysis 响应 */
export const MOCK_ANALYSIS_RESPONSE = JSON.stringify({
  assets: [
    { kind: "port", value: "127.0.0.1:80", label: "HTTP (80)", fingerprints: [] },
  ],
  findings: [
    {
      title: "Open HTTP Port",
      summary: "Port 80 is open with nginx",
      severity: "info",
      affectedTarget: "127.0.0.1:80",
      recommendation: "Review exposed services",
    },
  ],
  evidenceSummary: "Found 1 open port with nginx web server",
})

/** 标准 mock LLM review 响应 */
export const MOCK_REVIEW_RESPONSE = JSON.stringify({
  decision: "continue",
  nextPhase: "discovery",
  reasoning: "第一轮已完成信息收集，继续进入发现阶段",
})
```

- [ ] **Step 2: Commit**

```bash
git add tests/lib/workers/_helpers.ts
git commit -m "test: add shared mock helpers for worker tests"
```

---

### Task 2: planning-worker 测试

**Files:**
- Create: `tests/lib/workers/planning-worker.test.ts`

- [ ] **Step 1: 创建测试文件**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockProject, mockLlmProvider, MOCK_PLAN_RESPONSE } from "./_helpers"

// Mock all external dependencies
vi.mock("@/lib/repositories/project-repo", () => ({
  findById: vi.fn(),
  updateLifecycle: vi.fn(),
  updatePhaseAndRound: vi.fn(),
}))
vi.mock("@/lib/repositories/asset-repo", () => ({ findByProject: vi.fn().mockResolvedValue([]) }))
vi.mock("@/lib/repositories/finding-repo", () => ({ findByProject: vi.fn().mockResolvedValue([]) }))
vi.mock("@/lib/repositories/mcp-run-repo", () => ({
  findByProjectAndRound: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue({ id: "run-001" }),
  updateStatus: vi.fn(),
}))
vi.mock("@/lib/repositories/mcp-tool-repo", () => ({
  findEnabled: vi.fn().mockResolvedValue([{ toolName: "fscan_port_scan", capability: "port_scanning", description: "Scan ports" }]),
  findByToolName: vi.fn().mockResolvedValue({ id: "tool-001", capability: "port_scanning", requiresApproval: false }),
}))
vi.mock("@/lib/repositories/approval-repo", () => ({ create: vi.fn() }))
vi.mock("@/lib/repositories/audit-repo", () => ({ create: vi.fn() }))
vi.mock("@/lib/infra/prisma", () => ({
  prisma: {
    orchestratorRound: { upsert: vi.fn(), update: vi.fn() },
    orchestratorPlan: { upsert: vi.fn() },
    globalConfig: { findUnique: vi.fn().mockResolvedValue({ approvalEnabled: false, autoApproveLowRisk: true, autoApproveMediumRisk: false }) },
  },
}))
vi.mock("@/lib/infra/event-bus", () => ({ publishEvent: vi.fn() }))
vi.mock("@/lib/infra/job-queue", () => ({
  createPgBossJobQueue: vi.fn().mockReturnValue({ publish: vi.fn().mockResolvedValue("job-001") }),
}))
vi.mock("@/lib/infra/abort-registry", () => ({ registerAbort: vi.fn(), unregisterAbort: vi.fn() }))
vi.mock("@/lib/infra/pipeline-logger", () => ({
  createPipelineLogger: vi.fn().mockReturnValue({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    startTimer: () => ({ elapsed: () => 1000 }),
  }),
}))

const mockLlm = mockLlmProvider(MOCK_PLAN_RESPONSE)
vi.mock("@/lib/llm", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    getLlmProvider: vi.fn().mockResolvedValue(mockLlm),
  }
})

import * as projectRepo from "@/lib/repositories/project-repo"
import { handlePlanRound } from "@/lib/workers/planning-worker"

describe("planning-worker", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("正常路径：生成计划并发布 execute_tool job", async () => {
    vi.mocked(projectRepo.findById).mockResolvedValue(mockProject({ lifecycle: "planning" }) as never)

    await handlePlanRound({ projectId: "proj-test-001", round: 1 })

    expect(projectRepo.updateLifecycle).toHaveBeenCalled()
    expect(mockLlm.chat).toHaveBeenCalledTimes(1)
  })

  it("项目已停止：跳过规划", async () => {
    vi.mocked(projectRepo.findById).mockResolvedValue(mockProject({ lifecycle: "stopped" }) as never)

    await handlePlanRound({ projectId: "proj-test-001", round: 1 })

    expect(mockLlm.chat).not.toHaveBeenCalled()
  })

  it("项目不存在：静默返回", async () => {
    vi.mocked(projectRepo.findById).mockResolvedValue(null as never)

    await handlePlanRound({ projectId: "non-existent", round: 1 })

    expect(mockLlm.chat).not.toHaveBeenCalled()
  })

  it("LLM 失败：抛出异常让 pg-boss 重试", async () => {
    vi.mocked(projectRepo.findById).mockResolvedValue(mockProject({ lifecycle: "planning" }) as never)
    mockLlm.chat.mockRejectedValueOnce(new Error("LLM timeout"))

    await expect(handlePlanRound({ projectId: "proj-test-001", round: 1 })).rejects.toThrow("LLM timeout")
  })

  it("LLM 返回空计划：发布 round_completed", async () => {
    vi.mocked(projectRepo.findById).mockResolvedValue(mockProject({ lifecycle: "planning" }) as never)
    mockLlm.chat.mockResolvedValueOnce({
      content: JSON.stringify({ summary: "无需执行", phase: "recon", items: [] }),
      provider: "test", model: "test", durationMs: 500,
    })

    await handlePlanRound({ projectId: "proj-test-001", round: 1 })

    const { createPgBossJobQueue } = await import("@/lib/infra/job-queue")
    const queue = createPgBossJobQueue()
    expect(queue.publish).toHaveBeenCalledWith("round_completed", expect.objectContaining({ projectId: "proj-test-001" }))
  })
})
```

- [ ] **Step 2: 运行测试**

Run: `npx vitest run tests/lib/workers/planning-worker.test.ts`

Expected: 5 tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/lib/workers/planning-worker.test.ts
git commit -m "test: add planning-worker unit tests (5 cases)"
```

---

### Task 3: execution-worker 测试

**Files:**
- Create: `tests/lib/workers/execution-worker.test.ts`

- [ ] **Step 1: 创建测试文件**

测试用例：
1. 正常路径：工具成功 → 存 rawOutput → 发布 analyze_result
2. 工具返回 isError → 标记 failed，但仍尝试分析
3. 超时 → 标记 failed，不抛异常
4. 项目已停止 → 取消执行
5. McpRun 不存在 → 静默返回

（代码结构与 Task 2 类似，mock `callTool`、`mcpRunRepo`、`projectRepo`）

- [ ] **Step 2: 运行测试**

Run: `npx vitest run tests/lib/workers/execution-worker.test.ts`

- [ ] **Step 3: Commit**

```bash
git add tests/lib/workers/execution-worker.test.ts
git commit -m "test: add execution-worker unit tests (5 cases)"
```

---

### Task 4: analysis-worker 测试

**Files:**
- Create: `tests/lib/workers/analysis-worker.test.ts`

- [ ] **Step 1: 创建测试文件**

测试用例：
1. 正常路径：LLM 分析 → 创建 assets + findings + evidence
2. LLM 失败 → 仍保存 raw evidence（fallback）
3. 项目已停止 → 跳过分析
4. LLM 返回空结果 → 只创建 evidence，0 assets/findings

- [ ] **Step 2: 运行测试**

Run: `npx vitest run tests/lib/workers/analysis-worker.test.ts`

- [ ] **Step 3: Commit**

```bash
git add tests/lib/workers/analysis-worker.test.ts
git commit -m "test: add analysis-worker unit tests (4 cases)"
```

---

### Task 5: verification-worker + lifecycle-worker 测试

**Files:**
- Create: `tests/lib/workers/verification-worker.test.ts`
- Create: `tests/lib/workers/lifecycle-worker.test.ts`

- [ ] **Step 1: verification-worker 测试**

测试用例：
1. 正常路径：LLM 生成 PoC → 执行 → verified
2. PoC 执行失败 → finding 回退为 suspected
3. 项目已停止 → 跳过
4. Finding 非 suspected → 跳过

- [ ] **Step 2: lifecycle-worker 测试**

测试用例：
1. reviewer 决定 continue → 发布 plan_round
2. reviewer 决定 settle → 发布 settle_closure
3. 最后一轮强制 settle
4. handleSettleClosure → 生成报告 → 项目 completed

- [ ] **Step 3: 运行所有 worker 测试**

Run: `npx vitest run tests/lib/workers/`

Expected: 全部通过

- [ ] **Step 4: Commit**

```bash
git add tests/lib/workers/verification-worker.test.ts tests/lib/workers/lifecycle-worker.test.ts
git commit -m "test: add verification + lifecycle worker unit tests"
```

---

### Task 6: 全量测试回归

- [ ] **Step 1: 运行所有测试**

Run: `npx vitest run`

Expected: 全部通过（包含原有测试 + 新增 worker 测试）

- [ ] **Step 2: 修复任何回归**

- [ ] **Step 3: Commit（如有修复）**

```bash
git add -A
git commit -m "fix: resolve test regressions from worker test additions"
```
