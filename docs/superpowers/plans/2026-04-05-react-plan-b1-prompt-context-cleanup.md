# ReAct Plan B1: Prompt、上下文管理与旧代码清理

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建 ReAct system prompt 和上下文管理模块，清理被替代的旧代码（planning-worker、execution-worker、buildPlannerPrompt）。

**Architecture:** react-prompt.ts 构建 ReAct agent 的 system prompt；react-context.ts 管理消息列表的滑动窗口压缩。旧的 planning/execution worker 和相关 prompt 函数被删除。

**Tech Stack:** Next.js 15 + TypeScript + Prisma 7

---

## Task 1: 创建 react-prompt.ts

**Files:**
- Create: `lib/llm/react-prompt.ts`

- [ ] **Step 1: 创建文件并实现 buildReactSystemPrompt**

```typescript
// lib/llm/react-prompt.ts
import type { PentestPhase, AssetKind } from "@/lib/generated/prisma"
import { PHASE_LABELS } from "@/lib/domain/phases"
import { loadSystemPrompt } from "./system-prompt"

export type ReactContext = {
  projectName: string
  targets: Array<{ value: string; type: string }>
  currentPhase: PentestPhase
  round: number
  maxRounds: number
  maxSteps: number
  stepIndex: number
  scopeDescription: string
  assets: Array<{ kind: AssetKind; value: string; label: string }>
  findings: Array<{ title: string; severity: string; affectedTarget: string; status: string }>
}

export async function buildReactSystemPrompt(ctx: ReactContext): Promise<string> {
  const basePrompt = await loadSystemPrompt("pentest-agent")

  const assetLines = ctx.assets.length > 0
    ? ctx.assets.map(a => `- [${a.kind}] ${a.value} (${a.label})`).join("\n")
    : "(暂无)"

  const findingLines = ctx.findings.length > 0
    ? ctx.findings.map(f => `- [${f.severity}] ${f.title} → ${f.affectedTarget} (${f.status})`).join("\n")
    : "(暂无)"

  return `${basePrompt ?? ""}

# 角色
你是一个专业的渗透测试 AI agent。你通过调用工具来执行渗透测试，每一步都能看到工具的完整输出并决定下一步行动。

# 项目信息
- 项目名称：${ctx.projectName}
- 目标：${ctx.targets.map(t => t.value).join(", ")}
- 当前阶段：${PHASE_LABELS[ctx.currentPhase] ?? ctx.currentPhase}
- 当前轮次：${ctx.round}/${ctx.maxRounds}
- 已用步数：${ctx.stepIndex}/${ctx.maxSteps}

# Scope 规则
${ctx.scopeDescription}

# 已发现资产
${assetLines}

# 已发现漏洞
${findingLines}

# 行为准则
1. 每一步先思考（在 content 中写出推理），再选择工具
2. 根据工具返回的实际结果决定下一步，不要假设结果
3. 发现新的高价值目标时，立即展开测试
4. 当你认为当前阶段的测试已充分，调用 done() 结束本轮
5. 如果发现明确的安全问题，调用 report_finding() 记录
6. 不要重复已经做过的测试（检查已发现资产和漏洞列表）
7. 优先测试高价值目标（开放的管理端口、未授权服务等）
8. 对非 HTTP 服务先用 tcp_banner_grab 确认协议，不要假设端口对应特定服务
9. 对 execute_code 工具，action 参数必须是完整可执行的 Node.js 代码
`.trim()
}
```

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add lib/llm/react-prompt.ts
git commit -m "feat: add ReAct system prompt builder"
```

---

## Task 2: 创建 react-context.ts

**Files:**
- Create: `lib/workers/react-context.ts`

- [ ] **Step 1: 创建上下文管理器**

```typescript
// lib/workers/react-context.ts

/**
 * ReAct 循环的上下文管理器。
 * 维护 LLM messages 列表，实现滑动窗口压缩防止 context overflow。
 */

export type ReactMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; function_call?: { name: string; arguments: string } }
  | { role: "function"; name: string; content: string }

type StepRecord = {
  stepIndex: number
  toolName: string
  target: string
  status: "succeeded" | "failed" | "timeout"
  summary: string        // 一行摘要
  fullOutput: string     // 完整输出
  thought?: string
}

const RECENT_FULL_STEPS = 5
const MAX_OUTPUT_PER_STEP = 3000
const MAX_ESTIMATED_TOKENS = 80000  // 粗估阈值

export class ReactContextManager {
  private messages: ReactMessage[] = []
  private steps: StepRecord[] = []
  private systemPrompt: string

  constructor(systemPrompt: string, initialUserMessage: string) {
    this.systemPrompt = systemPrompt
    this.messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: initialUserMessage },
    ]
  }

  /** 获取当前 messages（传给 LLM） */
  getMessages(): ReactMessage[] {
    return this.messages
  }

  /** 更新 system prompt（注入最新 assets/findings） */
  updateSystemPrompt(newPrompt: string): void {
    this.systemPrompt = newPrompt
    if (this.messages.length > 0 && this.messages[0].role === "system") {
      this.messages[0] = { role: "system", content: newPrompt }
    }
  }

  /** 添加 assistant 消息（LLM 的 thought + function_call） */
  addAssistantMessage(content: string, functionCall?: { name: string; arguments: string }): void {
    this.messages.push({ role: "assistant", content, function_call: functionCall })
  }

  /** 添加 function result 并记录步骤 */
  addToolResult(step: {
    stepIndex: number
    toolName: string
    target: string
    functionName: string
    output: string
    status: "succeeded" | "failed" | "timeout"
    thought?: string
  }): void {
    const truncatedOutput = step.output.length > MAX_OUTPUT_PER_STEP
      ? step.output.slice(0, MAX_OUTPUT_PER_STEP) + "...(truncated)"
      : step.output

    this.steps.push({
      stepIndex: step.stepIndex,
      toolName: step.toolName,
      target: step.target,
      status: step.status,
      summary: step.output.slice(0, 200).replace(/\n/g, " "),
      fullOutput: truncatedOutput,
      thought: step.thought,
    })

    this.messages.push({
      role: "function",
      name: step.functionName,
      content: truncatedOutput,
    })

    this.compressIfNeeded()
  }

  /** 估算当前 token 数 */
  private estimateTokens(): number {
    return this.messages.reduce((sum, m) => {
      const text = m.role === "assistant" && m.function_call
        ? m.content + m.function_call.arguments
        : m.content
      return sum + Math.ceil(text.length / 3)
    }, 0)
  }

  /** 压缩旧步骤 */
  private compressIfNeeded(): void {
    if (this.estimateTokens() <= MAX_ESTIMATED_TOKENS) return

    // 找到最旧的未压缩 function message 并替换为摘要
    // 保留 system[0] + user[1]，从 index 2 开始扫描
    const recentStepIndices = new Set(
      this.steps.slice(-RECENT_FULL_STEPS).map(s => s.stepIndex)
    )

    for (let i = 2; i < this.messages.length; i++) {
      const msg = this.messages[i]
      if (msg.role !== "function") continue

      // 找到对应的 step record
      const step = this.steps.find(s => s.toolName === msg.name || true) // 按顺序匹配
      if (!step || recentStepIndices.has(step.stepIndex)) continue

      // 已经是摘要了（很短）
      if (msg.content.length < 300) continue

      // 压缩为摘要
      msg.content = `[Step ${step.stepIndex}] ${step.toolName}(${step.target}) → ${step.status}: ${step.summary}`

      // 同时压缩前面的 assistant message
      if (i > 0 && this.messages[i - 1].role === "assistant") {
        const prev = this.messages[i - 1] as { role: "assistant"; content: string; function_call?: { name: string; arguments: string } }
        if (prev.content.length > 100) {
          prev.content = prev.content.slice(0, 100) + "..."
        }
      }

      if (this.estimateTokens() <= MAX_ESTIMATED_TOKENS) break
    }
  }
}
```

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add lib/workers/react-context.ts
git commit -m "feat: add ReAct context manager with sliding window compression"
```

---

## Task 3: 清理 prompts.ts — 删除 buildPlannerPrompt

**Files:**
- Modify: `lib/llm/prompts.ts`

- [ ] **Step 1: 读取 prompts.ts 找到 buildPlannerPrompt 函数范围**

Run: 查找 `buildPlannerPrompt` 函数的起止行。同时确认 `PlannerContext`、`LlmPlanResponse` 类型定义位置。

- [ ] **Step 2: 删除 PlannerContext 类型**

删除 `export type PlannerContext = { ... }` 整个块（约 lines 15-32）。

- [ ] **Step 3: 删除 LlmPlanResponse 类型**

查找并删除 `LlmPlanResponse` 类型定义。

- [ ] **Step 4: 删除 buildPlannerPrompt 函数**

删除整个 `buildPlannerPrompt` 函数体。

- [ ] **Step 5: 编译验证**

Run: `npx tsc --noEmit`
预期：可能有其他文件引用 PlannerContext/LlmPlanResponse/buildPlannerPrompt 报错，在下一步修复。

---

## Task 4: 更新 llm/index.ts 导出

**Files:**
- Modify: `lib/llm/index.ts`

- [ ] **Step 1: 删除 buildPlannerPrompt 导出，删除 PlannerContext/LlmPlanResponse 类型导出**

从 export 列表中移除：
```typescript
// 删除这些
export { buildPlannerPrompt } from "./prompts"
export type { LlmPlanResponse, PlannerContext } from "./prompts"
```

- [ ] **Step 2: 新增 react-prompt 和 function-calling 导出**

```typescript
export { buildReactSystemPrompt } from "./react-prompt"
export type { ReactContext } from "./react-prompt"
```

- [ ] **Step 3: 新增 react agent role 支持**

在 `getLlmProvider` 函数中，扩展 role 参数支持 `"react"`：
```typescript
export async function getLlmProvider(
  projectId: string,
  role: "planner" | "analyzer" | "reviewer" | "react",
): Promise<LlmProvider> {
  // react role 使用 planner 的 LLM profile（复用同一个配置）
  const profileId = role === "react" ? "planner" : role
  const profile = await prisma.llmProfile.findUnique({ where: { id: profileId } })
  // ...
```

- [ ] **Step 4: 编译验证**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add lib/llm/prompts.ts lib/llm/index.ts
git commit -m "refactor: remove buildPlannerPrompt, add react-prompt exports"
```

---

## Task 5: 删除 planning-worker.ts

**Files:**
- Delete: `lib/workers/planning-worker.ts`
- Delete: `tests/lib/workers/planning-worker.test.ts`

- [ ] **Step 1: 确认没有其他文件引用 planning-worker**

Run: `grep -r "planning-worker" lib/ worker.ts app/ --include="*.ts"`
预期：只有 `worker.ts` 中的 import（将在 Plan C 中修改）。

- [ ] **Step 2: 删除文件**

```bash
rm lib/workers/planning-worker.ts
rm tests/lib/workers/planning-worker.test.ts 2>/dev/null
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: delete planning-worker (replaced by react-worker)"
```

---

## Task 6: 删除 execution-worker.ts

**Files:**
- Delete: `lib/workers/execution-worker.ts`

- [ ] **Step 1: 确认 buildToolInput 已提取到 tool-input-mapper.ts（Plan A 前置条件）**

Run: `test -f lib/llm/tool-input-mapper.ts && echo "OK" || echo "MISSING — run Plan A first"`

- [ ] **Step 2: 确认没有其他文件引用 execution-worker**

Run: `grep -r "execution-worker" lib/ worker.ts app/ --include="*.ts"`
预期：只有 `worker.ts`（Plan C 修改）。

- [ ] **Step 3: 删除文件**

```bash
rm lib/workers/execution-worker.ts
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: delete execution-worker (inlined into react-worker)"
```

---

## Task 7: 编译验证（全量）

- [ ] **Step 1: 运行 tsc**

Run: `npx tsc --noEmit`

预期错误：`worker.ts` 中引用了已删除的 planning-worker 和 execution-worker。这是预期的——将在 Plan C Task 1 中修复。

暂时在 worker.ts 中注释掉相关 import 和 subscribe 以通过编译：

```bash
# 仅为验证 B1 的独立完整性，临时注释
```

- [ ] **Step 2: 如果有非预期错误，逐个修复**

- [ ] **Step 3: Commit（如有修复）**
