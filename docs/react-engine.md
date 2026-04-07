# ReAct 迭代执行引擎

> 最后更新: 2026-04-07
> 本文档是 ReAct（Reason+Act）执行引擎的完整技术参考。

---

## 1. 概述

### 什么是 ReAct？

ReAct（Reason+Act）是一种让 LLM 逐步推理并行动的执行模式。在每一步中，LLM：
1. **Thought** — 分析当前状态，决定下一步策略
2. **Action** — 通过 Function Calling 选择一个 MCP 工具并指定参数
3. **Observation** — 获取工具的真实执行结果

这个循环持续进行，直到 LLM 主动调用 `done()` 结束本轮，或达到步数上限。

### 为什么用 ReAct 替代批量规划？

旧模型的问题：

| 旧模型（批量规划） | 问题 |
|-------------------|------|
| 一次规划 5 个工具 | 无法根据中间结果调整策略 |
| 执行完才能看结果 | 浪费在无效工具上的时间 |
| JSON 输出解析 | 格式不标准、解析脆弱 |
| 空计划 = 结束 | 需要复杂的 anti-termination 机制 |

ReAct 模型的优势：

| ReAct 模型 | 优势 |
|-----------|------|
| 每步实时决策 | LLM 看到每个工具的真实输出后再决定下一步 |
| 原生 Function Calling | 利用 LLM 原生能力，无需 JSON 解析 |
| 显式终止 | 必须调用 `done()` 才能结束，不会意外终止 |
| 单步失败不致命 | 一个工具失败不影响其余步骤 |

---

## 2. 架构设计

### 2.1 整体流程

```
┌─────────────────────────────────────────────────────────────┐
│                    ReAct 单轮循环                             │
│                                                               │
│  ┌───────┐    tool_calls        ┌──────────┐    callTool     │
│  │  LLM  │ ──────────────────→ │  平台调度  │ ────────────→  │
│  │       │                      │          │               MCP│
│  │       │ ←────────────────── │          │ ←────────────  工具│
│  └───────┘    role: tool        └──────────┘   rawOutput     │
│                                                               │
│  重复直到: done() / report_finding() / 30 步上限 / 错误       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 轮次与步骤

```
项目 (Project)
└── 轮次 (Round) — 由 react_round job 处理
    ├── Step 1: LLM 选择 httpx_probe → 执行 → 获取结果
    ├── Step 2: LLM 选择 dirsearch_scan → 执行 → 获取结果
    ├── Step 3: LLM 选择 execute_code → 执行 → 获取结果
    ├── ...
    └── Step N: LLM 调用 done(summary="侦察完成，发现3个入口点")
        ↓
    轮次审阅 (Reviewer LLM)
        ├── continue → 下一轮 react_round
        └── settle → 收尾 → 项目完成
```

### 2.3 与平台其他组件的关系

```
┌──────────────────────────────────────────────────┐
│  Next.js 进程                                     │
│  ├─ API Routes → 项目管理、步骤查询、SSE 事件推送  │
│  └─ SSR → 操作面板（按 round→step 分组展示）       │
└──────────────┬───────────────────────────────────┘
               │ pg-boss 任务队列 + PostgreSQL NOTIFY
┌──────────────▼───────────────────────────────────┐
│  Worker 进程                                      │
│  ├─ react-worker    — ReAct 循环（LLM → 工具 → 循环）│
│  ├─ analysis-worker — LLM 语义分析（提取 asset/finding）│
│  ├─ verification-worker — PoC 验证               │
│  └─ lifecycle-worker — 轮次审阅 + 项目收尾        │
└──────────────────────────────────────────────────┘
```

---

## 3. 核心组件详解

### 3.1 react-worker.ts

**文件**: `lib/workers/react-worker.ts`
**入口**: `handleReactRound(data: { projectId, round })`

这是 ReAct 引擎的核心。处理 `react_round` 作业，运行 Thought→Action→Observation 循环。

**常量配置**:

| 常量 | 值 | 说明 |
|------|------|------|
| `MAX_STEPS_PER_ROUND` | 30 | 单轮最大步数硬限制 |
| `MAX_EMPTY_RETRIES` | 3 | LLM 连续空响应最大重试次数 |
| `TOOL_TIMEOUT_MS` | 300,000 (5 min) | 单个 MCP 工具执行超时 |
| `ANALYSIS_WAIT_MS` | 30,000 (30 s) | 轮末等待异步分析完成 |

**执行流程**:

```
handleReactRound({ projectId, round })
│
├─ 1. 加载项目、资产、发现、工具列表
├─ 2. 构建 ReactContext → buildReactSystemPrompt()
├─ 3. 构建 MCP 工具 → OpenAI functions 列表
├─ 4. 创建 ReactContextManager（系统提示 + 初始用户消息）
├─ 5. 创建 OrchestratorRound 记录
│
├─ 6. 进入 ReAct 循环 (step = 1..MAX_STEPS)
│   │
│   ├─ 6a. 调用 LLM（带 tools 参数）
│   │       → 返回 tool_calls[0].function: { name, arguments }
│   │
│   ├─ 6b. 判断调用类型:
│   │   ├─ done(summary, phase_suggestion)
│   │   │   → 记录 stopReason="llm_done"，跳出循环
│   │   │
│   │   ├─ report_finding(title, severity, target, detail)
│   │   │   → 创建 Finding 记录，继续循环
│   │   │
│   │   └─ MCP 工具 (e.g. httpx_probe, execute_code)
│   │       ├─ 检查 scope policy（目标是否在范围内）
│   │       ├─ 构建 MCP 输入参数 (buildToolInputFromFunctionArgs)
│   │       ├─ 创建 McpRun 记录（pending → running）
│   │       ├─ callTool() 执行（5 分钟超时）
│   │       ├─ 更新 McpRun（succeeded/failed + rawOutput）
│   │       ├─ 异步入队 analyze_result 作业
│   │       └─ 将结果以 role: tool + tool_call_id 回填上下文
│   │
│   ├─ 6c. 发布 SSE 事件 (react_step_completed)
│   │
│   ├─ 6d. 每 5 步: 刷新系统提示（更新资产/发现列表）
│   │
│   └─ 6e. 检查中止信号 (AbortRegistry)
│
├─ 7. 更新 OrchestratorRound（actualSteps, stopReason）
├─ 8. 等待待处理的分析作业（最多 30 秒）
└─ 9. 发布 round_completed 作业 → 触发 lifecycle-worker 审阅
```

**LLM 空响应重试**:

如果 LLM 返回完全空的响应（`content: null` 且无 tool_calls），react-worker 会：
1. 将空响应作为 assistant 消息加入上下文
2. 注入 tool 消息提示 LLM 重新选择工具
3. 最多重试 `MAX_EMPTY_RETRIES`（3 次），超过则向上抛出错误

**LLM 无 tool_calls 的处理**:

如果 LLM 返回纯文本而非 tool_calls（部分模型可能如此），react-worker 会：
1. 将文本作为 assistant 消息加入上下文
2. 记录 `stopReason = "llm_no_action"`
3. 结束本轮

**MCP 工具执行日志**:

每次 MCP 工具执行完成后，react-worker 记录详细日志：
- 成功：`mcp_result` INFO 日志，含执行耗时（ms）、输出长度、输出预览（前 200 字符）
- 失败：`mcp_error` ERROR 日志，含执行耗时、参数 JSON、错误详情（前 300 字符）

### 3.2 ReactContextManager (react-context.ts)

**文件**: `lib/workers/react-context.ts`

管理 ReAct 循环中的 LLM 对话历史，实现滑动窗口压缩以控制 token 使用。

**API**:

| 方法 | 说明 |
|------|------|
| `constructor(systemPrompt, initialUserMessage)` | 初始化：system + user 两条消息 |
| `getMessages()` | 返回当前消息列表的副本（用于 LLM 调用） |
| `updateSystemPrompt(newPrompt)` | 替换 index 0 处的系统提示 |
| `addAssistantMessage(content, functionCall?, toolCallId?)` | 追加 assistant 消息，含 `tool_calls` 数组 |
| `addToolResult(step)` | 追加 `role: "tool"` 消息（含 `tool_call_id`），并触发压缩检查 |

**消息格式**（使用 OpenAI 现代 `tools` 格式）:

```
[0] { role: "system", content: "你是一个渗透测试 ReAct Agent..." }
[1] { role: "user", content: "开始第 1 轮测试..." }
[2] { role: "assistant", tool_calls: [{ id: "tc_1", type: "function", function: { name: "httpx_probe", arguments: "..." } }] }
[3] { role: "tool", tool_call_id: "tc_1", content: "HTTP/200 ..." }
[4] { role: "assistant", tool_calls: [{ id: "tc_2", type: "function", function: { name: "dirsearch_scan", arguments: "..." } }] }
[5] { role: "tool", tool_call_id: "tc_2", content: "/login, /admin, /api ..." }
...
```

> **注意**: Phase 24c 将消息格式从废弃的 `function_call` + `role: "function"` 升级为现代 `tool_calls` + `role: "tool"` 格式。`openai-provider.ts` 同步将请求中的 `functions` 参数转换为 `tools` 格式。

**滑动窗口压缩**:

```
┌─────────────────────────────────────────────────┐
│  TOKEN_BUDGET = 80,000 (≈ 240,000 字符)         │
│  RECENT_WINDOW = 5 (保留全量输出的最近步数)       │
│  MAX_OUTPUT_CHARS = 3,000 (单工具输出截断长度)    │
│                                                   │
│  Token 估算: 总字符数 / 3                         │
│                                                   │
│  当 estimateTokens() > TOKEN_BUDGET 时触发压缩:   │
│  ├─ 最近 5 步: 保留完整 assistant + function 消息  │
│  ├─ 更早的步骤: 压缩为单行摘要                     │
│  │   "[Step 2] nmap → 10.0.0.1 (succeeded)"      │
│  └─ 所有压缩摘要合并为一条 user 消息插入 index 2   │
└─────────────────────────────────────────────────┘
```

### 3.3 react-prompt.ts

**文件**: `lib/llm/react-prompt.ts`

**导出**:
- `ReactContext` 类型
- `buildReactSystemPrompt(ctx: ReactContext): Promise<string>`

**ReactContext 类型定义**:

```typescript
type ReactContext = {
  projectName: string
  projectDescription?: string                // 项目描述，用于智能 scope 判断
  targets: Array<{ value: string; type: string }>
  currentPhase: PentestPhase
  round: number
  maxRounds: number
  maxSteps: number
  stepIndex: number
  scopeDescription: string
  assets: Array<{ kind: AssetKind; value: string; label: string }>
  findings: Array<{ title: string; severity: string; affectedTarget: string; status: string }>
  availableTools?: Array<{                   // MCP 工具列表（含参数提示）
    name: string
    description: string
    parameterHints?: string                  // 从 inputSchema 提取的参数摘要
  }>
}
```

**提示词结构（9 个区块）**:

1. **共享方法论** — 从 `mcps/pentest-agent-prompt.md` 动态加载（loadSystemPrompt）
2. **角色定义** — ReAct Agent 核心执行规则：每次响应必须调用 tool，禁止纯文本
3. **项目信息** — 项目名称、项目描述（若有）、阶段、轮次、步数进度
4. **目标列表** — 所有渗透目标及类型
5. **作用域规则** — scopeDescription + 组织关联资产的软性 scope 指导
6. **已发现资产** — 按 kind 分组列出
7. **已发现漏洞** — 按 severity 排序列出
8. **可用工具** — MCP 工具列表（含参数提示：必填/可选、枚举值、描述）
9. **行为准则** — 9 条核心规则：
   - 每步必须调用工具
   - 根据实际结果决策
   - 发现新目标先判断关联性再测试（强关联深入、弱关联跳过）
   - 充分时调用 done()
   - 不重复测试
   - 优先高价值目标
   - 阶段意识
   - 工具参数准确（可选参数使用工具默认值，仅项目描述要求时覆盖）
   - 错误恢复

### 3.4 function-calling.ts

**文件**: `lib/llm/function-calling.ts`

**导出**:
- `mcpToolsToFunctions(tools: McpTool[])` — 将 MCP 工具列表转换为 OpenAI Function Calling 格式
- `getControlFunctions()` — 返回控制函数定义

**MCP 工具转换**:

每个 McpTool 转换为一个 OpenAI function:

```typescript
{
  name: "httpx_probe",           // 工具名
  description: "Web 存活探测",    // 工具描述
  parameters: {                   // 从 inputSchema 转换
    type: "object",
    properties: { target: { type: "string" }, ... },
    required: ["target"]
  }
}
```

**控制函数**:

| 函数名 | 参数 | 用途 |
|--------|------|------|
| `done` | `summary: string`, `phase_suggestion?: PentestPhase` | LLM 主动结束本轮，提供摘要和下一阶段建议 |
| `report_finding` | `title: string`, `severity: Severity`, `target: string`, `detail: string` | LLM 直接报告发现（不经过 MCP 工具） |

### 3.5 tool-input-mapper.ts

**文件**: `lib/llm/tool-input-mapper.ts`

**导出**: `buildToolInputFromFunctionArgs(toolName, functionArgs, context)`

将 LLM function call 的参数映射为 MCP 工具的输入格式。处理：

- **目标注入**: 如果 LLM 未指定 target，自动注入项目的默认目标
- **参数标准化**: 不同工具的参数格式不同，统一转换
- **rawRequest 构造**: 对 `execute_code`/`execute_command` 等工具，自动构建 `rawRequest` 字段

### 3.6 scope-policy.ts

**文件**: `lib/domain/scope-policy.ts`

**导出**: `createScopePolicy(targets: string[])`

作用域策略，防止 LLM 选择的工具目标超出授权范围。

**规则**:
- 解析项目所有目标为 host/domain/IP/CIDR
- `isInScope(target)` 检查目标是否匹配:
  - 完全匹配（same host）
  - 同域（子域 ↔ 主域）
  - 同子网（同 /24 段）
  - 明确的 CIDR 包含
- 超出范围的工具调用被拒绝，LLM 收到 "target out of scope" 反馈

---

## 4. 生命周期集成

### 4.1 状态机

ReAct 引擎引入 3 个新的生命周期事件，允许跳过 `planning` 状态：

```
                    START_REACT
        idle ──────────────────→ executing
                                    │
                              (轮次循环完成)
                                    │
                                    ▼
                               reviewing
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
              CONTINUE_REACT      SETTLE          STOP
                    │               │               │
                    ▼               ▼               ▼
               executing        settling        stopping
                                    │               │
                                    ▼               ▼
                               completed         stopped

                    RETRY_REACT
        failed ────────────────→ executing
```

**关键区别**: 旧事件 `START`/`CONTINUE`/`RETRY` 经过 `planning` 状态；新事件 `START_REACT`/`CONTINUE_REACT`/`RETRY_REACT` 直接进入 `executing`。

### 4.2 项目启动流程

```typescript
// lib/services/project-service.ts
async function startProject(projectId) {
  const event = project.lifecycle === "failed"
    ? "RETRY_REACT"
    : "START_REACT"

  await updateLifecycle(projectId, transition(project.lifecycle, event))
  await queue.publish("react_round", {
    projectId,
    round: project.currentRound + 1
  }, { expireInSeconds: 1800 })
}
```

### 4.3 轮次审阅流程

```typescript
// lib/workers/lifecycle-worker.ts
async function handleRoundCompleted({ projectId, round }) {
  // 1. Reviewer LLM 决策
  const decision = await reviewRound(projectId, round)

  if (decision === "continue" && round < maxRounds) {
    // 直接进入下一轮执行（跳过 planning）
    await updateLifecycle(projectId, transition("reviewing", "CONTINUE_REACT"))
    await queue.publish("react_round", { projectId, round: round + 1 })
  } else {
    await queue.publish("settle_closure", { projectId })
  }
}
```

### 4.4 Worker 注册

```typescript
// worker.ts
boss.subscribe("react_round", handleReactRound)     // ReAct 循环
boss.subscribe("analyze_result", handleAnalyzeResult) // 语义分析
boss.subscribe("verify_finding", handleVerifyFinding)  // PoC 验证
boss.subscribe("round_completed", handleRoundCompleted) // 轮次审阅
boss.subscribe("settle_closure", handleSettleClosure)   // 项目收尾
```

### 4.5 僵尸恢复

Worker 启动时检查卡住的项目：

| 状态 | 恢复策略 |
|------|---------|
| `planning` | 发布 `react_round`（旧状态兼容） |
| `executing` | 检查是否有 pending/running 的 McpRun；无则触发 `round_completed`；有则强制失败并重发 `react_round` |

---

## 5. 数据模型

### 5.1 新增/修改的 Prisma 字段

**McpRun 新增字段**（Plan A migration）:

| 字段 | 类型 | 说明 |
|------|------|------|
| `stepIndex` | `Int?` | ReAct 循环中的步骤序号（从 1 开始） |
| `thought` | `String?` | LLM 在该步的推理内容 |
| `functionArgs` | `Json?` | LLM function call 的原始参数 |

**OrchestratorRound 新增字段**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `maxSteps` | `Int?` | 本轮步数上限（通常 30） |
| `actualSteps` | `Int?` | 本轮实际执行步数 |
| `stopReason` | `String?` | 停止原因 |

### 5.2 stopReason 值

| 值 | 说明 | 中文标签 |
|----|------|---------|
| `llm_done` | LLM 主动调用 `done()` | LLM 主动停止 |
| `llm_no_action` | LLM 返回纯文本无 tool_calls | LLM 结束推理 |
| `max_steps` | 达到 MAX_STEPS_PER_ROUND 上限 | 达到步数上限 |
| `aborted` | 用户手动停止或中止信号 | 用户中止 |
| `error` | 不可恢复的执行错误 | 执行错误 |

---

## 6. 前端展示

### 6.1 SSE 实时事件

**Hook**: `lib/hooks/use-react-steps.ts`

监听 `GET /api/projects/[id]/events` SSE 端点，处理以下事件：

| 事件类型 | 数据字段 | 触发时机 |
|----------|---------|---------|
| `react_step_started` | round, stepIndex, thought, toolName, target | MCP 工具开始执行 |
| `react_step_completed` | round, stepIndex, status, outputPreview | MCP 工具执行完成 |
| `react_round_progress` | round, currentStep, maxSteps, phase | 每步更新进度 |
| `round_reviewed` | round, decision | 轮次审阅完成 |
| `lifecycle_changed` | lifecycle | 生命周期状态变更 |

**Hook 返回值**:

```typescript
const { activeSteps, roundProgress, connected } = useReactSteps(projectId)
// activeSteps: ReactStepEvent[] — 当前活跃的步骤列表
// roundProgress: { round, currentStep, maxSteps, phase } — 当前轮次进度
// connected: boolean — SSE 连接状态
```

### 6.2 操作面板 (Operations Page)

**MCP Runs 面板** (`components/projects/project-mcp-runs-panel.tsx`):

- 从平铺列表改为按 **round → step** 分组展示
- 每个 RoundStepGroup 可折叠，显示 phase 标签、步数、stopReason
- 每个 StepItem 显示: stepIndex、toolName、target、status、thought（推理内容）、rawOutput（可展开）、耗时
- 实时进度条: 显示当前轮次的 currentStep/maxSteps
- 正在执行的步骤带 pulse 动画

**Orchestrator 面板** (`components/projects/project-orchestrator-panel.tsx`):

- 左侧 "ReAct 执行轮次": 每轮显示 phase、actualSteps/maxSteps、stopReason、新资产/发现数
- 右侧: ReAct 模式显示最新轮次摘要（三栏统计：执行步数、新资产、新发现）；旧模式兼容显示 plan items

### 6.3 Steps API

**端点**: `GET /api/projects/[projectId]/rounds/[round]/steps`

**响应**:

```json
{
  "round": 1,
  "meta": {
    "phase": "recon",
    "status": "completed",
    "maxSteps": 30,
    "actualSteps": 12,
    "stopReason": "llm_done",
    "newAssetCount": 5,
    "newFindingCount": 2,
    "startedAt": "2026-04-05T...",
    "completedAt": "2026-04-05T..."
  },
  "steps": [
    {
      "id": "...",
      "stepIndex": 1,
      "thought": "先探测目标Web服务存活状态",
      "toolName": "httpx_probe",
      "target": "http://localhost:8081",
      "status": "succeeded",
      "rawOutput": "...",
      "startedAt": "...",
      "completedAt": "..."
    }
  ]
}
```

---

## 7. 异步任务流

### 7.1 五种异步任务

| 任务名 | 触发 | 处理器 | 产出 |
|--------|------|--------|------|
| `react_round` | 项目启动/轮次继续 | react-worker | McpRun 记录 + 分析任务 |
| `analyze_result` | 工具执行成功 | analysis-worker | Asset + Finding + Evidence |
| `verify_finding` | 发现非 info 级问题 | verification-worker | PoC 验证结果 |
| `round_completed` | 本轮所有 run 完成 | lifecycle-worker | 审阅决策(continue/settle) |
| `settle_closure` | 审阅决定结束 | lifecycle-worker | 最终报告 + completed |

### 7.2 任务流图

```
react_round
    │
    ├─ step 1: callTool() → McpRun (succeeded)
    │   └─ analyze_result → Asset + Finding
    │       └─ verify_finding → PoC (verified/false_positive)
    │
    ├─ step 2: callTool() → McpRun (succeeded)
    │   └─ analyze_result → ...
    │
    ├─ ...
    │
    └─ done() → round_completed (延迟 30s 等待分析)
        │
        ├─ continue → react_round (round+1)
        └─ settle → settle_closure → completed
```

---

## 8. 配置参数总览

| 参数 | 位置 | 默认值 | 说明 |
|------|------|--------|------|
| `MAX_STEPS_PER_ROUND` | react-worker.ts | 30 | 单轮最大步数 |
| `TOOL_TIMEOUT_MS` | react-worker.ts | 300,000 (5 min) | 单工具执行超时 |
| `ANALYSIS_WAIT_MS` | react-worker.ts | 30,000 (30 s) | 轮末等待分析完成 |
| `TOKEN_BUDGET` | react-context.ts | 80,000 | 上下文 token 预算 |
| `RECENT_WINDOW` | react-context.ts | 5 | 保留全量输出的最近步数 |
| `MAX_OUTPUT_CHARS` | react-context.ts | 3,000 | 单工具输出截断长度 |
| `maxRounds` | Project 模型 | 10 | 项目最大轮数 |
| `expireInSeconds` | job-queue 参数 | 1,800 (30 min) | react_round 作业超时 |

---

## 9. 与旧模型详细对比

| 维度 | 旧模型（批量规划） | ReAct 模型 |
|------|-------------------|-----------|
| **决策时机** | 一次规划 5 个工具，执行完才审阅 | 每步实时决策，看到结果再行动 |
| **信息利用** | 只看上轮结果摘要 | 直接看每步的 rawOutput |
| **适应性** | 无法中途调整（已规划的必须执行） | 随时调整策略和目标 |
| **工具选择** | JSON 输出解析（脆弱） | OpenAI Function Calling（原生） |
| **终止方式** | 返回空计划 = 结束（需 anti-termination） | 必须显式调用 `done()`，不会意外终止 |
| **失败处理** | 一个工具失败可能影响整批 | 单步失败不影响后续步骤 |
| **Job 类型** | plan_round + execute_tool（2 种） | react_round（1 种，内含循环） |
| **Worker** | planning-worker + execution-worker（2 个） | react-worker（1 个） |
| **生命周期** | idle→planning→executing→reviewing | idle→executing→reviewing（跳过 planning） |
| **上下文传递** | 轮间摘要（信息损失大） | 滑动窗口（最近 5 步全量） |
| **Token 效率** | 每轮独立 prompt（重复发送上下文） | 累积消息流 + 压缩（减少重复） |

---

## 10. 已知限制与未来方向

### 当前限制

1. **LLM Provider**: 已迁移至 SSE 流式调用，解决了部分 API 代理在非流式模式下返回 `content: null` 的问题。支持 `reasoning_content` 字段回退（reasoning 模型）。空响应自动重试最多 3 次
2. **上下文压缩信息损失**: 超过 5 步的历史被压缩为一行摘要，LLM 可能重复执行已完成的测试
3. **无步骤级审批**: 当前版本所有工具调用自动批准。高风险工具（如 execute_code）在循环中途无法暂停请求人工确认
4. **SSE 事件不可回放**: 页面重载后丢失实时步骤状态，需通过 Steps API 查询历史
5. **单轮内串行执行**: 每步等待工具完成后才进入下一步，无法并行执行独立工具
6. **模型质量差异**: Claude/GPT-4 的 function calling 和代码生成质量远高于小模型

### 未来方向

1. **步骤级审批**: 高风险工具在推理链中途请求人工确认（控制函数待实现）
2. **自适应步数限制**: 根据渗透阶段动态调整 MAX_STEPS_PER_ROUND（侦察阶段更多步，验证阶段更少步）
3. **多 Agent 协作**: 多个 ReAct Agent 并行工作在不同目标/阶段上
4. **Token 用量监控**: 记录每轮实际 token 消耗，生成成本报告
5. **步骤历史持久化**: 将 SSE 事件持久化存储，支持页面重载后回放
6. **工具级超时优化**: 不同工具类型使用不同超时（网络扫描 vs 代码执行）
7. **压缩策略优化**: 智能选择压缩哪些步骤（保留发现漏洞的步骤全量输出）
