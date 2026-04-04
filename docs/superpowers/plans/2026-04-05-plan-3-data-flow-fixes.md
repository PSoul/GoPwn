# Plan 3: 数据流断点修复 — MCP↔平台↔LLM

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复三个数据流断点：(a) MCP 工具输出失败/超时时丢失 rawOutput，(b) planner 看不到上一轮工具的原始输出，(c) LLM 返回非法 JSON 直接崩溃。

**Architecture:** execution-worker 无论成败都存 rawOutput；planner prompt 增加上轮 rawOutput 摘要；parseLlmJson 增加容错（code fence/trailing comma/提取 JSON 对象）。

**Tech Stack:** TypeScript

**依赖:** Plan 1（pipeline logger）应先完成，但本 plan 也可独立执行

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `lib/workers/execution-worker.ts` | 失败/超时时保留 rawOutput |
| Modify | `lib/llm/prompts.ts` | planner prompt 包含上轮 rawOutput |
| Modify | `lib/workers/planning-worker.ts` | 传递 rawOutput 到 planner context |

---

### Task 1: execution-worker — 失败时也存 rawOutput

**Files:**
- Modify: `lib/workers/execution-worker.ts`

- [ ] **Step 1: 修改 withTimeout 函数支持捕获部分输出**

当前 `withTimeout` 超时时直接 reject，丢失了已收到的部分输出。修改为在 catch 块中保存已知信息。

实际上 `callTool` 返回的是一个 Promise，超时时我们无法获取部分输出（MCP stdio 是完整返回的）。但我们可以在超时错误信息中包含更多上下文。

保持 `withTimeout` 不变，重点修改 catch 块：

在 catch 块中，工具执行失败时的 `updateStatus` 调用已经包含 `error` 字段。但缺少 `rawOutput`。当 catch 到的是超时错误时，rawOutput 确实没有。但如果是 `result.isError` 的情况（line 64-76），rawOutput 已经存了 `result.content`。

所以主要问题是：**超时异常** 和 **其他异常** 时没有 rawOutput。这种情况确实无法获取输出，保持现状即可。

真正的问题在于：在 `result.isError` 分支中，rawOutput 存了但没有触发 `analyze_result`。失败的工具输出也可能包含有用信息（比如部分扫描结果）。

**修改：工具返回 isError 时，如果 rawOutput 非空，仍然触发分析**

在 `result.isError` 分支（line 64-76 之后）添加：

```typescript
// 即使工具报告错误，如果有输出内容，仍然尝试分析（可能包含部分结果）
if (result.content && result.content.length > 50) {
  const queue = createPgBossJobQueue()
  await queue.publish("analyze_result", {
    projectId,
    mcpRunId,
    rawOutput: result.content,
    toolName: mcpRun.toolName,
    target: mcpRun.target,
  })
  log.info("mcp_response", `工具报告错误但有输出 (${result.content.length} 字符)，已提交分析`)
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/workers/execution-worker.ts
git commit -m "fix: analyze tool output even when tool reports isError"
```

---

### Task 2: planner prompt 包含上轮 rawOutput

**Files:**
- Modify: `lib/workers/planning-worker.ts`
- Modify: `lib/llm/prompts.ts`

- [ ] **Step 1: 修改 PlannerContext 类型**

在 `lib/llm/prompts.ts` 中，给 `PlannerContext` 添加更丰富的上轮信息：

将 `previousRoundSummary?: string` 改为：

```typescript
previousRoundDetails?: Array<{
  toolName: string
  target: string
  status: string
  rawOutput?: string  // 截断到 2000 字符
  error?: string
}>
```

- [ ] **Step 2: 修改 buildPlannerPrompt 使用新字段**

在 `buildPlannerPrompt` 函数中，找到使用 `ctx.previousRoundSummary` 的地方，替换为遍历 `ctx.previousRoundDetails`：

```typescript
// 上轮执行结果
if (ctx.previousRoundDetails && ctx.previousRoundDetails.length > 0) {
  const detailLines = ctx.previousRoundDetails.map((run) => {
    const icon = run.status === "succeeded" ? "✓" : "✗"
    const output = run.rawOutput
      ? `\n  原始输出:\n${run.rawOutput}`
      : run.error
        ? `\n  错误: ${run.error}`
        : ""
    return `### ${icon} ${run.toolName}(${run.target}) — ${run.status}${output}`
  }).join("\n\n")

  userContent += `\n\n## 上一轮执行结果\n\n${detailLines}`
}
```

- [ ] **Step 3: 修改 planning-worker 传递 rawOutput**

在 `lib/workers/planning-worker.ts` 中，将 line 57-65 的 `previousSummary` 构建改为：

```typescript
const previousRoundDetails = round > 1
  ? (await mcpRunRepo.findByProjectAndRound(projectId, round - 1)).map((r) => ({
      toolName: r.toolName,
      target: r.target,
      status: r.status,
      rawOutput: r.rawOutput?.slice(0, 2000) ?? undefined,
      error: r.error?.slice(0, 500) ?? undefined,
    }))
  : undefined
```

并修改 `plannerCtx` 赋值：

```typescript
const plannerCtx: PlannerContext = {
  // ... 其他字段不变 ...
  previousRoundDetails,  // 替换 previousRoundSummary
}
```

- [ ] **Step 4: 确保总上下文不超 LLM context window**

添加总长度限制：如果所有 rawOutput 加起来超过 10000 字符，按比例截断每个：

```typescript
// 总量控制
const MAX_TOTAL_OUTPUT = 10000
if (previousRoundDetails) {
  const totalLength = previousRoundDetails.reduce((sum, r) => sum + (r.rawOutput?.length ?? 0), 0)
  if (totalLength > MAX_TOTAL_OUTPUT) {
    const ratio = MAX_TOTAL_OUTPUT / totalLength
    for (const r of previousRoundDetails) {
      if (r.rawOutput) {
        r.rawOutput = r.rawOutput.slice(0, Math.floor(r.rawOutput.length * ratio)) + "...(truncated)"
      }
    }
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/llm/prompts.ts lib/workers/planning-worker.ts
git commit -m "feat: planner receives previous round rawOutput for better context"
```

---

### Task 3: parseLlmJson 容错增强

**Files:**
- Modify: `lib/llm/prompts.ts`（parseLlmJson 函数所在位置）

- [ ] **Step 1: 找到当前 parseLlmJson 实现**

在 `lib/llm/prompts.ts` 中搜索 `export function parseLlmJson`。

- [ ] **Step 2: 替换为容错版本**

```typescript
/**
 * Parse LLM JSON response with tolerance for common formatting issues:
 * - Markdown code fences (```json ... ```)
 * - Trailing commas
 * - Extra text before/after JSON
 */
export function parseLlmJson<T>(raw: string): T {
  let cleaned = raw.trim()

  // Strip markdown code fence
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "")
  cleaned = cleaned.trim()

  // Try direct parse first (fast path)
  try {
    return JSON.parse(cleaned)
  } catch {
    // continue to recovery attempts
  }

  // Remove trailing commas before } or ]
  const noTrailingComma = cleaned.replace(/,\s*([\]}])/g, "$1")
  try {
    return JSON.parse(noTrailingComma)
  } catch {
    // continue
  }

  // Try to extract first JSON object from mixed text
  const objMatch = cleaned.match(/\{[\s\S]*\}/)
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0])
    } catch {
      // Try with trailing comma fix on extracted object
      try {
        return JSON.parse(objMatch[0].replace(/,\s*([\]}])/g, "$1"))
      } catch {
        // continue
      }
    }
  }

  // Try to extract JSON array
  const arrMatch = cleaned.match(/\[[\s\S]*\]/)
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0])
    } catch {
      // continue
    }
  }

  // All recovery attempts failed
  throw new Error(
    `LLM JSON 解析失败，所有恢复尝试均失败。\n原始内容前 500 字符: ${raw.slice(0, 500)}`,
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/llm/prompts.ts
git commit -m "fix: parseLlmJson tolerates code fences, trailing commas, mixed text"
```

---

### Task 4: 验证

- [ ] **Step 1: TypeScript 编译检查**

Run: `npx tsc --noEmit`

Expected: 0 errors

- [ ] **Step 2: Commit（如有修复）**

```bash
git add -A
git commit -m "fix: resolve any issues from plan-3 integration"
```
