# ReAct Plan A: 基础设施层

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 ReAct 引擎所需的数据库模型、LLM function calling 适配、scope 策略和工具输入映射。

**Architecture:** 在现有架构基础上扩展 Prisma schema、LLM provider 和领域模块，为 Plan B 的 ReAct 核心引擎提供基础。

**Tech Stack:** Next.js 15 + TypeScript + Prisma 7 + PostgreSQL 16

---

## Task 1: Prisma Schema 变更 — McpRun 新增字段

**文件**: `prisma/schema.prisma`

- [ ] 1.1 在 `McpRun` model 中（`mcp_runs` 表），在 `updatedAt` 行之前、`approval` 行之前，新增三个可选字段：

```prisma
model McpRun {
  // ... 现有字段 ...
  updatedAt       DateTime     @updatedAt

  // ReAct 迭代执行支持
  stepIndex       Int?         // ReAct 步骤序号（0-based），null 表示非 ReAct 模式
  thought         String?      // LLM 在此步骤的推理内容（assistant message content）
  functionArgs    Json?        // LLM 输出的 function call arguments（原始 JSON）

  approval        Approval?
  // ...
}
```

- [ ] 1.2 验证：运行 `npx prisma validate` 确认 schema 无语法错误

---

## Task 2: Prisma Schema 变更 — OrchestratorRound 新增字段

**文件**: `prisma/schema.prisma`

- [ ] 2.1 在 `OrchestratorRound` model 中，在 `completedAt` 行之后新增三个字段：

```prisma
model OrchestratorRound {
  // ... 现有字段 ...
  startedAt       DateTime     @default(now())
  completedAt     DateTime?

  // ReAct 迭代执行支持
  maxSteps        Int          @default(30)    // 本轮最大步数
  actualSteps     Int          @default(0)     // 实际执行步数
  stopReason      String?      // "llm_done" | "max_steps" | "aborted" | "error"

  @@unique([projectId, round])
  @@map("orchestrator_rounds")
}
```

- [ ] 2.2 验证：运行 `npx prisma validate` 确认 schema 无语法错误

---

## Task 3: 数据库迁移

- [ ] 3.1 生成迁移文件：

```bash
npx prisma migrate dev --name react_iteration_fields
```

这会生成一个 SQL 迁移文件，内容大致为：
```sql
ALTER TABLE "mcp_runs" ADD COLUMN "stepIndex" INTEGER;
ALTER TABLE "mcp_runs" ADD COLUMN "thought" TEXT;
ALTER TABLE "mcp_runs" ADD COLUMN "functionArgs" JSONB;
ALTER TABLE "orchestrator_rounds" ADD COLUMN "maxSteps" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "orchestrator_rounds" ADD COLUMN "actualSteps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orchestrator_rounds" ADD COLUMN "stopReason" TEXT;
```

- [ ] 3.2 验证迁移文件已生成在 `prisma/migrations/` 目录下
- [ ] 3.3 运行 `npx prisma generate` 重新生成 Prisma Client 类型
- [ ] 3.4 验证：在 `lib/generated/prisma/` 中确认新字段出现在生成的类型中（搜索 `stepIndex`）

---

## Task 4: mcp-run-repo.ts 适配新字段

**文件**: `lib/repositories/mcp-run-repo.ts`

- [ ] 4.1 扩展 `create` 函数的 `data` 参数类型，接受新的可选字段：

```typescript
export async function create(data: {
  projectId: string
  toolId?: string
  capability: string
  toolName: string
  target: string
  requestedAction: string
  riskLevel: RiskLevel
  phase: PentestPhase
  round: number
  // ReAct 新增
  stepIndex?: number
  thought?: string
  functionArgs?: unknown  // Prisma Json type accepts unknown
}) {
  return prisma.mcpRun.create({ data })
}
```

- [ ] 4.2 新增 `findByProjectRoundOrdered` 函数，支持按 stepIndex 排序查询（ReAct 步骤展示用）：

```typescript
export async function findByProjectRoundOrdered(projectId: string, round: number) {
  return prisma.mcpRun.findMany({
    where: { projectId, round },
    include: { approval: true, tool: true },
    orderBy: [{ stepIndex: "asc" }, { createdAt: "asc" }],
  })
}
```

- [ ] 4.3 新增 `updateReactFields` 函数，用于 ReAct worker 更新步骤结果：

```typescript
export async function updateReactFields(id: string, data: {
  thought?: string
  functionArgs?: unknown
}) {
  return prisma.mcpRun.update({
    where: { id },
    data,
  })
}
```

- [ ] 4.4 验证：运行 `npx tsc --noEmit` 确认无类型错误

---

## Task 5: LLM Provider 类型扩展

**文件**: `lib/llm/provider.ts`

- [ ] 5.1 扩展 `LlmMessage` 类型，支持 function/tool 消息角色和 function_call 内容：

```typescript
export type LlmMessage = {
  role: "system" | "user" | "assistant" | "function"
  content: string | null
  name?: string           // function name（role=function 时必填）
  function_call?: {       // assistant 消息中的 function call
    name: string
    arguments: string     // JSON string
  }
}
```

- [ ] 5.2 扩展 `LlmCallOptions`，新增 function calling 相关选项：

```typescript
export type OpenAIFunctionDef = {
  name: string
  description: string
  parameters: Record<string, unknown>  // JSON Schema object
}

export type LlmCallOptions = {
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
  jsonMode?: boolean
  signal?: AbortSignal
  // ReAct function calling 支持
  functions?: OpenAIFunctionDef[]
  function_call?: "auto" | "none" | { name: string }
}
```

- [ ] 5.3 扩展 `LlmResponse`，新增 `functionCall` 字段：

```typescript
export type LlmResponse = {
  content: string
  model: string
  provider: string
  inputTokens?: number
  outputTokens?: number
  durationMs: number
  // ReAct function calling 支持
  functionCall?: {
    name: string
    arguments: string  // JSON string
  }
}
```

- [ ] 5.4 验证：运行 `npx tsc --noEmit` 确认无类型错误

---

## Task 6: openai-provider.ts 扩展 function calling 支持

**文件**: `lib/llm/openai-provider.ts`

- [ ] 6.1 在 `chat` 方法中，构建 `body` 后，追加 functions 和 function_call 参数：

```typescript
// 在 body 构建之后、fetch 之前添加：
if (options?.functions && options.functions.length > 0) {
  body.functions = options.functions
  if (options.function_call) {
    body.function_call = options.function_call
  }
}
```

- [ ] 6.2 修改响应解析的类型定义，扩展 `choices` 内的 `message` 类型：

```typescript
const data = (await res.json()) as {
  choices: Array<{
    message: {
      content: string | null
      function_call?: {
        name: string
        arguments: string
      }
    }
  }>
  model: string
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}
```

- [ ] 6.3 在返回 `LlmResponse` 时，提取 `function_call` 字段：

```typescript
const message = data.choices?.[0]?.message
const content = message?.content ?? ""
const functionCall = message?.function_call
const durationMs = Date.now() - start

return {
  content,
  model: data.model ?? model,
  provider: "openai-compatible",
  inputTokens: data.usage?.prompt_tokens,
  outputTokens: data.usage?.completion_tokens,
  durationMs,
  ...(functionCall ? { functionCall } : {}),
}
```

- [ ] 6.4 验证：运行 `npx tsc --noEmit` 确认无类型错误

---

## Task 7: 新建 lib/llm/function-calling.ts — MCP 工具→OpenAI function 转换

**文件**: `lib/llm/function-calling.ts`（新建）

- [ ] 7.1 创建文件，实现 `mcpToolToFunction` 转换函数：

```typescript
/**
 * MCP tool → OpenAI function definition conversion.
 * Bridges MCP tool schemas (stored in DB as JSON Schema) to the
 * OpenAI chat completion `functions` parameter format.
 */

import type { OpenAIFunctionDef } from "./provider"

type McpToolRecord = {
  toolName: string
  description: string
  inputSchema: unknown  // JSON Schema stored as Prisma Json
}

/**
 * Convert a single MCP tool record to an OpenAI function definition.
 */
export function mcpToolToFunction(tool: McpToolRecord): OpenAIFunctionDef {
  const schema = (tool.inputSchema ?? {}) as Record<string, unknown>

  // Ensure we have a valid JSON Schema object for parameters
  const parameters: Record<string, unknown> = {
    type: "object",
    properties: schema.properties ?? {},
    ...(schema.required ? { required: schema.required } : {}),
  }

  return {
    name: tool.toolName,
    description: tool.description || `MCP tool: ${tool.toolName}`,
    parameters,
  }
}

/**
 * Convert an array of MCP tool records to OpenAI function definitions.
 */
export function mcpToolsToFunctions(tools: McpToolRecord[]): OpenAIFunctionDef[] {
  return tools.map(mcpToolToFunction)
}

/**
 * Get the built-in control functions for the ReAct loop.
 * - done: LLM calls this to end the current round
 * - report_finding: LLM calls this to directly report a security finding
 */
export function getControlFunctions(): OpenAIFunctionDef[] {
  return [
    {
      name: "done",
      description:
        "结束当前轮次的测试。当你认为当前阶段的测试已充分完成，或没有更多有价值的测试可做时调用。",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "本轮测试的总结：做了什么、发现了什么、建议下一步方向",
          },
          phase_suggestion: {
            type: "string",
            enum: ["recon", "discovery", "assessment", "verification", "reporting"],
            description: "建议下一轮进入的测试阶段（可选）",
          },
        },
        required: ["summary"],
      },
    },
    {
      name: "report_finding",
      description:
        "直接报告一个安全发现/漏洞。当你确认发现了一个安全问题时调用。",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "发现的标题，简洁描述问题",
          },
          severity: {
            type: "string",
            enum: ["critical", "high", "medium", "low", "info"],
            description: "严重程度",
          },
          target: {
            type: "string",
            description: "受影响的目标（IP、域名、URL 等）",
          },
          detail: {
            type: "string",
            description: "详细描述：问题是什么、如何发现的、潜在影响",
          },
          recommendation: {
            type: "string",
            description: "修复建议",
          },
        },
        required: ["title", "severity", "target", "detail"],
      },
    },
  ]
}

/**
 * Check if a function call name is a control function (not an MCP tool).
 */
export function isControlFunction(name: string): boolean {
  return name === "done" || name === "report_finding"
}
```

- [ ] 7.2 验证：运行 `npx tsc --noEmit` 确认无类型错误

---

## Task 8: 新建 lib/llm/tool-input-mapper.ts — 从 execution-worker 提取 buildToolInput

**文件**: `lib/llm/tool-input-mapper.ts`（新建）

- [ ] 8.1 从 `lib/workers/execution-worker.ts` 中提取以下函数和常量到新文件：
  - `buildToolInput` 函数（第 150-213 行）
  - `TARGET_PARAM_NAMES`, `HOST_PARAM_NAMES`, `ACTION_PARAM_NAMES` 常量（第 215-217 行）
  - `ParsedTarget` 类型和 `parseTarget` 函数（第 219-252 行）
  - `looksLikeCode` 函数（第 255-264 行）
  - `buildFallbackScript` 函数（第 267-313 行）

```typescript
/**
 * Tool input mapper — builds MCP tool input from target/action descriptions.
 * Extracted from execution-worker.ts for reuse by both the legacy execution
 * worker and the new ReAct worker.
 */

/**
 * Build MCP tool input from the action description and tool schema.
 * Parses the tool's inputSchema to map target/action to expected parameter names and types.
 */
export async function buildToolInput(
  toolName: string,
  target: string,
  action: string,
): Promise<Record<string, unknown>> {
  // ... 完整内容从 execution-worker.ts 第 150-213 行复制 ...
}

// ... 其余辅助函数和常量 ...
```

- [ ] 8.2 在新文件顶部添加必要的 import：

```typescript
// 无外部依赖，findByToolName 使用动态 import（保持与原代码一致）
```

- [ ] 8.3 新增 `buildToolInputFromFunctionArgs` 函数，供 ReAct worker 使用（LLM 直接给出 function args 时，合并/校验 schema）：

```typescript
/**
 * Build MCP tool input from LLM's function call arguments.
 * In ReAct mode, the LLM directly provides structured arguments via function calling.
 * This function validates and normalizes the arguments against the tool's input schema.
 *
 * Falls back to buildToolInput() if the LLM arguments are empty/invalid.
 */
export async function buildToolInputFromFunctionArgs(
  toolName: string,
  functionArgs: Record<string, unknown>,
  target: string,
  action: string,
): Promise<Record<string, unknown>> {
  // If LLM provided non-empty arguments, use them directly
  // (OpenAI function calling already constrains to the schema)
  if (functionArgs && Object.keys(functionArgs).length > 0) {
    return functionArgs
  }
  // Fallback to heuristic mapping
  return buildToolInput(toolName, target, action)
}
```

- [ ] 8.4 在 `lib/workers/execution-worker.ts` 中，将 `buildToolInput` 的本地实现替换为从新模块导入：

```typescript
// 在文件顶部添加：
import { buildToolInput } from "@/lib/llm/tool-input-mapper"

// 删除 execution-worker.ts 中的以下内容（约第 150-313 行）：
// - buildToolInput 函数
// - TARGET_PARAM_NAMES, HOST_PARAM_NAMES, ACTION_PARAM_NAMES
// - ParsedTarget, parseTarget
// - looksLikeCode, buildFallbackScript
```

- [ ] 8.5 验证：运行 `npx tsc --noEmit` 确认无类型错误
- [ ] 8.6 验证：如果存在 `execution-worker.test.ts`，运行其测试确认功能不变：

```bash
npx vitest run tests/lib/workers/execution-worker.test.ts 2>/dev/null || echo "no test file"
```

---

## Task 9: 新建 lib/domain/scope-policy.ts — Scope 边界判断

**文件**: `lib/domain/scope-policy.ts`（新建）

- [ ] 9.1 创建文件，实现 `ScopePolicy` 接口和 `createScopePolicy` 工厂函数：

```typescript
/**
 * Scope policy — determines whether a discovered asset or target
 * falls within the authorized testing scope.
 *
 * Rules:
 * 1. Same-domain: target "example.com" → *.example.com is in scope
 * 2. Same-subnet: target "192.168.1.100" → 192.168.1.0/24 is in scope
 * 3. Same-host: same IP/hostname on different ports is in scope
 * 4. Everything else → out of scope (record but don't test)
 */

export interface ScopePolicy {
  /** Check if a value (domain, IP, URL, etc.) is within the authorized scope */
  isInScope(value: string): boolean
  /** Get a human-readable description of the scope for LLM prompts */
  describe(): string
}

type TargetEntry = { value: string; type: string }

/**
 * Create a ScopePolicy from the project's target list.
 */
export function createScopePolicy(targets: TargetEntry[]): ScopePolicy {
  const domains = new Set<string>()    // root domains for same-domain rule
  const subnets = new Set<string>()    // /24 prefixes for same-subnet rule
  const hosts = new Set<string>()      // exact hosts (IP or hostname)

  for (const t of targets) {
    const val = t.value.trim().toLowerCase()
    const host = extractHost(val)

    hosts.add(host)

    if (isIPv4(host)) {
      // Add /24 subnet
      const parts = host.split(".")
      subnets.add(parts.slice(0, 3).join("."))
    } else {
      // Add root domain (last two labels, or full if already two)
      domains.add(extractRootDomain(host))
      domains.add(host)  // also add the exact hostname
    }
  }

  return {
    isInScope(value: string): boolean {
      const normalized = value.trim().toLowerCase()
      const host = extractHost(normalized)

      // Exact match
      if (hosts.has(host)) return true

      // Same-host different port: strip port and check
      const hostOnly = host.replace(/:\d+$/, "")
      if (hosts.has(hostOnly)) return true

      // Same-domain rule
      if (!isIPv4(hostOnly)) {
        const root = extractRootDomain(hostOnly)
        if (domains.has(root)) return true
        // Check if it's a subdomain of any target domain
        for (const d of domains) {
          if (hostOnly === d || hostOnly.endsWith(`.${d}`)) return true
        }
      }

      // Same-subnet rule (/24)
      if (isIPv4(hostOnly)) {
        const parts = hostOnly.split(".")
        const prefix = parts.slice(0, 3).join(".")
        if (subnets.has(prefix)) return true
      }

      return false
    },

    describe(): string {
      const parts: string[] = []
      if (domains.size > 0) parts.push(`域名: ${[...domains].join(", ")} 及其子域名`)
      if (subnets.size > 0) parts.push(`网段: ${[...subnets].map((s) => `${s}.0/24`).join(", ")}`)
      if (hosts.size > 0) parts.push(`主机: ${[...hosts].join(", ")} 的所有端口`)
      return parts.join("；")
    },
  }
}

/** Extract hostname from a URL, host:port, or plain string */
function extractHost(value: string): string {
  try {
    const url = new URL(value)
    return url.hostname
  } catch {
    // Not a URL — strip port if present
    return value.replace(/:\d+$/, "")
  }
}

/** Check if a string looks like an IPv4 address */
function isIPv4(value: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)
}

/**
 * Extract root domain (e.g., "sub.example.com" → "example.com").
 * Simplified — does not handle public suffix list edge cases.
 */
function extractRootDomain(hostname: string): string {
  const parts = hostname.split(".")
  if (parts.length <= 2) return hostname
  return parts.slice(-2).join(".")
}
```

- [ ] 9.2 验证：运行 `npx tsc --noEmit` 确认无类型错误

---

## Task 10: lifecycle.ts 新增 idle→executing 转换

**文件**: `lib/domain/lifecycle.ts`

- [ ] 10.1 在 `TRANSITIONS` 表的 `idle` 行中，新增 `START` 直接到 `executing` 的路径。由于 ReAct 模式下 planning 和 executing 合并，需要新增一个专用事件 `START_REACT`：

```typescript
type LifecycleEvent =
  | "START"
  | "START_REACT"    // 新增：ReAct 模式直接进入 executing
  | "PLAN_READY"
  | "PLAN_FAILED"
  // ... 其余不变 ...

const TRANSITIONS: Record<string, Partial<Record<LifecycleEvent, ProjectLifecycle>>> = {
  idle:             { START: "planning", START_REACT: "executing" },
  planning:         { PLAN_READY: "executing", PLAN_FAILED: "failed", STOP: "stopping" },
  executing:        { ALL_DONE: "reviewing", APPROVAL_NEEDED: "waiting_approval", STOP: "stopping" },
  waiting_approval: { RESOLVED: "executing", STOP: "stopping" },
  reviewing:        { CONTINUE: "planning", CONTINUE_REACT: "executing", SETTLE: "settling", STOP: "stopping" },
  // ... 其余不变 ...
}
```

- [ ] 10.2 同时在 `reviewing` 行新增 `CONTINUE_REACT` 事件（reviewer 决定继续时直接进入 executing 而非 planning）。将 `CONTINUE_REACT` 添加到 `LifecycleEvent` union type 中：

```typescript
type LifecycleEvent =
  | "START"
  | "START_REACT"
  | "PLAN_READY"
  | "PLAN_FAILED"
  | "ALL_DONE"
  | "APPROVAL_NEEDED"
  | "RESOLVED"
  | "CONTINUE"
  | "CONTINUE_REACT"    // 新增：reviewer 继续时直接进入 executing
  | "SETTLE"
  | "SETTLED"
  | "FAILED"
  | "STOP"
  | "STOPPED"
  | "RETRY"
```

- [ ] 10.3 在 `failed` 行也新增 `RETRY` 到 `executing` 的路径（ReAct 模式重试）。更新 `failed` 行：

```typescript
  failed:           { RETRY: "planning", RETRY_REACT: "executing", STOP: "stopping" },
```

并在 `LifecycleEvent` 中添加 `RETRY_REACT`。

- [ ] 10.4 验证：运行 `npx tsc --noEmit` 确认无类型错误

---

## Task 11: 更新 lib/llm/index.ts 导出

**文件**: `lib/llm/index.ts`

- [ ] 11.1 新增 function-calling 模块的导出：

```typescript
export {
  mcpToolToFunction,
  mcpToolsToFunctions,
  getControlFunctions,
  isControlFunction,
} from "./function-calling"
```

- [ ] 11.2 新增 tool-input-mapper 模块的导出：

```typescript
export {
  buildToolInput,
  buildToolInputFromFunctionArgs,
} from "./tool-input-mapper"
```

- [ ] 11.3 在 `getLlmProvider` 函数的 `role` 参数类型中，新增 `"react"` 角色：

```typescript
export async function getLlmProvider(
  projectId: string,
  role: "planner" | "analyzer" | "reviewer" | "react",
): Promise<LlmProvider> {
  // ...
  const phaseMap = {
    planner: "planning",
    analyzer: "analyzing",
    reviewer: "reviewing",
    react: "executing",
  } as const
  return createLoggedProvider(base, { projectId, role, phase: phaseMap[role] })
}
```

- [ ] 11.4 验证：运行 `npx tsc --noEmit` 确认无类型错误

---

## Task 12: 单元测试 — function-calling.ts

**文件**: `tests/lib/llm/function-calling.test.ts`（新建）

- [ ] 12.1 编写 `mcpToolToFunction` 测试：

```typescript
import { describe, it, expect } from "vitest"
import {
  mcpToolToFunction,
  mcpToolsToFunctions,
  getControlFunctions,
  isControlFunction,
} from "@/lib/llm/function-calling"

describe("mcpToolToFunction", () => {
  it("converts MCP tool record to OpenAI function definition", () => {
    const tool = {
      toolName: "fscan_port_scan",
      description: "Scan ports on a target host",
      inputSchema: {
        type: "object",
        properties: {
          target: { type: "string", description: "Target IP or hostname" },
          ports: { type: "string", description: "Port range" },
        },
        required: ["target"],
      },
    }

    const fn = mcpToolToFunction(tool)
    expect(fn.name).toBe("fscan_port_scan")
    expect(fn.description).toBe("Scan ports on a target host")
    expect(fn.parameters).toEqual({
      type: "object",
      properties: {
        target: { type: "string", description: "Target IP or hostname" },
        ports: { type: "string", description: "Port range" },
      },
      required: ["target"],
    })
  })

  it("handles empty inputSchema gracefully", () => {
    const tool = { toolName: "noop", description: "", inputSchema: {} }
    const fn = mcpToolToFunction(tool)
    expect(fn.parameters).toEqual({ type: "object", properties: {} })
  })
})

describe("getControlFunctions", () => {
  it("returns done and report_finding functions", () => {
    const fns = getControlFunctions()
    expect(fns).toHaveLength(2)
    expect(fns.map((f) => f.name)).toEqual(["done", "report_finding"])
  })

  it("done function requires summary parameter", () => {
    const done = getControlFunctions().find((f) => f.name === "done")!
    expect((done.parameters as any).required).toContain("summary")
  })
})

describe("isControlFunction", () => {
  it("returns true for control function names", () => {
    expect(isControlFunction("done")).toBe(true)
    expect(isControlFunction("report_finding")).toBe(true)
  })
  it("returns false for MCP tool names", () => {
    expect(isControlFunction("fscan_port_scan")).toBe(false)
  })
})
```

- [ ] 12.2 运行测试：`npx vitest run tests/lib/llm/function-calling.test.ts`

---

## Task 13: 单元测试 — scope-policy.ts

**文件**: `tests/lib/domain/scope-policy.test.ts`（新建）

- [ ] 13.1 编写 scope 策略测试：

```typescript
import { describe, it, expect } from "vitest"
import { createScopePolicy } from "@/lib/domain/scope-policy"

describe("createScopePolicy", () => {
  describe("same-domain rule", () => {
    const policy = createScopePolicy([{ value: "example.com", type: "domain" }])

    it("allows the exact target", () => {
      expect(policy.isInScope("example.com")).toBe(true)
    })
    it("allows subdomains", () => {
      expect(policy.isInScope("api.example.com")).toBe(true)
      expect(policy.isInScope("dev.api.example.com")).toBe(true)
    })
    it("allows URLs on the domain", () => {
      expect(policy.isInScope("https://example.com/admin")).toBe(true)
    })
    it("rejects different domains", () => {
      expect(policy.isInScope("evil.com")).toBe(false)
      expect(policy.isInScope("notexample.com")).toBe(false)
    })
  })

  describe("same-subnet rule", () => {
    const policy = createScopePolicy([{ value: "192.168.1.100", type: "ip" }])

    it("allows the exact IP", () => {
      expect(policy.isInScope("192.168.1.100")).toBe(true)
    })
    it("allows IPs in the same /24", () => {
      expect(policy.isInScope("192.168.1.1")).toBe(true)
      expect(policy.isInScope("192.168.1.254")).toBe(true)
    })
    it("allows same IP with port", () => {
      expect(policy.isInScope("192.168.1.100:8080")).toBe(true)
    })
    it("rejects IPs in different subnets", () => {
      expect(policy.isInScope("192.168.2.100")).toBe(false)
      expect(policy.isInScope("10.0.0.1")).toBe(false)
    })
  })

  describe("same-host rule", () => {
    const policy = createScopePolicy([{ value: "http://target.local:8080", type: "url" }])

    it("allows same host on different ports", () => {
      expect(policy.isInScope("target.local:9090")).toBe(true)
      expect(policy.isInScope("http://target.local:3000")).toBe(true)
    })
  })

  describe("describe()", () => {
    it("returns human-readable scope description", () => {
      const policy = createScopePolicy([
        { value: "example.com", type: "domain" },
        { value: "192.168.1.100", type: "ip" },
      ])
      const desc = policy.describe()
      expect(desc).toContain("example.com")
      expect(desc).toContain("192.168.1")
    })
  })
})
```

- [ ] 13.2 运行测试：`npx vitest run tests/lib/domain/scope-policy.test.ts`

---

## Task 14: 单元测试 — lifecycle.ts 新转换

**文件**: `tests/lib/domain/lifecycle.test.ts`（已有则追加，不存在则新建）

- [ ] 14.1 为新增的生命周期转换编写测试：

```typescript
import { describe, it, expect } from "vitest"
import { transition } from "@/lib/domain/lifecycle"

describe("lifecycle ReAct transitions", () => {
  it("idle → executing via START_REACT", () => {
    expect(transition("idle", "START_REACT")).toBe("executing")
  })

  it("reviewing → executing via CONTINUE_REACT", () => {
    expect(transition("reviewing", "CONTINUE_REACT")).toBe("executing")
  })

  it("failed → executing via RETRY_REACT", () => {
    expect(transition("failed", "RETRY_REACT")).toBe("executing")
  })

  it("idle → planning via START still works", () => {
    expect(transition("idle", "START")).toBe("planning")
  })

  it("reviewing → planning via CONTINUE still works", () => {
    expect(transition("reviewing", "CONTINUE")).toBe("planning")
  })
})
```

- [ ] 14.2 运行测试：`npx vitest run tests/lib/domain/lifecycle.test.ts`

---

## Task 15: 集成验证

- [ ] 15.1 运行全量类型检查：`npx tsc --noEmit`
- [ ] 15.2 运行所有相关测试：

```bash
npx vitest run tests/lib/llm/ tests/lib/domain/ tests/lib/workers/ tests/lib/repositories/
```

- [ ] 15.3 如果有 lint 配置，运行 lint：`npx next lint` 或 `npx eslint lib/llm/ lib/domain/ lib/repositories/`
- [ ] 15.4 验证数据库迁移可以回滚（可选）：`npx prisma migrate reset --skip-seed` 然后重新 `npx prisma migrate dev`

---

## 文件变更总结

| 操作 | 文件路径 | 说明 |
|------|----------|------|
| 修改 | `prisma/schema.prisma` | McpRun +3 字段, OrchestratorRound +3 字段 |
| 新建 | `prisma/migrations/xxx_react_iteration_fields/` | 数据库迁移 |
| 修改 | `lib/repositories/mcp-run-repo.ts` | create 扩展参数 + 新增查询/更新函数 |
| 修改 | `lib/llm/provider.ts` | LlmMessage/LlmCallOptions/LlmResponse 扩展 |
| 修改 | `lib/llm/openai-provider.ts` | functions/function_call 请求+响应 |
| 新建 | `lib/llm/function-calling.ts` | MCP→OpenAI function 转换 + 控制函数 |
| 新建 | `lib/llm/tool-input-mapper.ts` | 从 execution-worker 提取 buildToolInput |
| 修改 | `lib/workers/execution-worker.ts` | 删除内联 buildToolInput，改为 import |
| 新建 | `lib/domain/scope-policy.ts` | Scope 边界判断策略 |
| 修改 | `lib/domain/lifecycle.ts` | +3 事件: START_REACT, CONTINUE_REACT, RETRY_REACT |
| 修改 | `lib/llm/index.ts` | 新增导出 + react 角色 |
| 新建 | `tests/lib/llm/function-calling.test.ts` | 单元测试 |
| 新建 | `tests/lib/domain/scope-policy.test.ts` | 单元测试 |
| 新建/修改 | `tests/lib/domain/lifecycle.test.ts` | 单元测试 |

## 依赖关系

```
Task 1-2 (schema) → Task 3 (migration) → Task 4 (repo)
Task 5 (provider types) → Task 6 (openai-provider) → Task 7 (function-calling)
Task 8 (tool-input-mapper) — 独立
Task 9 (scope-policy) — 独立
Task 10 (lifecycle) — 独立
Task 11 (index exports) — 依赖 Task 5, 7, 8
Task 12-14 (tests) — 依赖对应实现 task
Task 15 (集成验证) — 依赖全部
```

**预估总时间**: 约 60-90 分钟（15 个 task，平均 4-6 分钟/task）

**下一步**: 完成 Plan A 后，进入 Plan B（ReAct 核心引擎：react-worker.ts, react-context.ts, react-prompt.ts）。
