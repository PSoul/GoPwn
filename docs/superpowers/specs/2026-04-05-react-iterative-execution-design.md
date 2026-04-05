# ReAct 迭代执行引擎设计规格

> Round 内嵌 ReAct 循环，让 LLM 每执行一个工具就看到结果并决定下一步，取代当前的批量规划+批量执行模式。

## 动机

渗透测试是发现驱动的过程——信息收集中发现新域名、新服务、新入口点，都需要立即纳入后续测试。当前的"批量规划 5 个工具→批量执行→下轮"模式有三个问题：

1. **反馈延迟**：LLM 规划时看不到实时结果，无法根据中间发现调整策略
2. **上下文丢失**：批量执行完成后，LLM 只能看到摘要，丢失了工具输出的细节
3. **灵活性差**：发现新目标需要等到下一轮才能测试，错过最佳时机

## 架构概览

```
项目启动 → Round 1 → Round 2 → ... → maxRounds → settle
              │
              └─ ReAct 循环（最多 30 步）
                   ├─ Step 1: LLM function call → MCP 工具执行 → 结果回传 LLM
                   ├─ Step 2: LLM 看到结果 → 下一个 function call → ...
                   ├─ ...
                   └─ LLM 调用 done() / 达到步数上限 → 结束 round
                          │
                          └─ Reviewer 决定：继续下一轮 or settle
```

### 保留不变的部分

- Round / Reviewer / Settle 生命周期状态机
- MCP server 架构和 stdio connector
- Assets / Findings / Evidence 数据模型和 repository 层
- 前端 round 面板结构（内部增加 step 详情）
- SSE 事件推送基础设施（PostgreSQL LISTEN/NOTIFY）
- 审批策略数据模型（初版不启用，保留扩展接口）

### 被替代的部分

| 现有组件 | 变化 |
|---------|------|
| `lib/workers/planning-worker.ts` | **删除**——被 `react-worker.ts` 替代 |
| `lib/workers/execution-worker.ts` | **删除**——工具执行内联到 ReAct 循环中 |
| `analysis-worker.ts` (handleAnalyzeResult) | **保留**，被 ReAct worker 异步调用 |
| `lib/llm/prompts.ts` 中 `buildPlannerPrompt()` | **删除**——被 `react-prompt.ts` 替代 |
| `lib/llm/prompts.ts` 中 `buildAnalyzerPrompt()` / `buildReviewerPrompt()` | **保留**不变 |
| `buildToolInput()` | **提取**到 `lib/llm/tool-input-mapper.ts` 公共模块 |
| pg-boss job `plan_round` | **删除**——替换为 `react_round` |
| pg-boss job `execute_tool` | **删除** |
| pg-boss job `analyze_result` | **保留** |

---

## 详细设计

### 1. ReAct Worker（核心变化）

**新文件**：`lib/workers/react-worker.ts`

**职责**：接收 `react_round` job，运行一个完整的 ReAct 循环直到 LLM 主动停止或达到步数上限。

**入口函数**：
```typescript
export async function handleReactRound(data: {
  projectId: string
  round: number
}): Promise<void>
```

**ReAct 循环伪代码**：

```
1. 加载项目上下文（targets, assets, findings, enabled tools）
2. 构建 system prompt + 初始 user message
3. 将 MCP 工具转换为 OpenAI function definitions
4. 注册控制 functions（done, report_finding）

5. LOOP（stepIndex = 0; stepIndex < MAX_STEPS_PER_ROUND; stepIndex++）:
   a. 调用 LLM（messages, functions, function_call: "auto"）
   b. 解析 LLM 响应：
      - 如果是 tool_call：
        i.   保存 thought（assistant message 中的 content）
        ii.  解析 function name + arguments
        iii. 如果是 done() → 结束循环
        iv.  如果是 report_finding() → 直接创建 finding，继续循环
        v.   否则：调用 MCP registry.callTool()
        vi.  保存 mcp_run 记录（含 stepIndex, thought）
        vii. 异步触发 analyzer（提取 assets/findings）
        viii.上下文管理：压缩旧步骤
        ix.  将 tool result 追加到 messages
        x.   发布 SSE 事件
      - 如果是普通文本（无 tool_call）→ 视为 LLM 完成推理，结束循环

6. Round 结束：
   a. 更新 OrchestratorRound 状态
   b. 等待所有异步 analyzer 完成（最多 30s）
   c. 发布 round_completed job → reviewer 决定下一步
```

### 2. OpenAI Function Calling 集成

**新文件**：`lib/llm/function-calling.ts`

将 MCP 工具的 inputSchema（Zod → JSON Schema）转换为 OpenAI function definitions。

```typescript
interface OpenAIFunction {
  name: string          // MCP toolName
  description: string   // MCP tool description
  parameters: object    // JSON Schema from inputSchema
}

// 从 mcpTool 表转换
function mcpToolToFunction(tool: McpTool): OpenAIFunction

// 控制 functions
function getControlFunctions(): OpenAIFunction[]
// - done: { summary: string, phase_suggestion?: PentestPhase }
// - report_finding: { title, severity, target, detail, recommendation }
```

**LLM 调用格式**（OpenAI chat completion）：

```typescript
const response = await llm.chat(messages, {
  functions: [...mcpFunctions, ...controlFunctions],
  function_call: "auto",
  signal: abortController.signal,
})
```

**LLM provider 适配**：

现有 `lib/llm/openai-provider.ts` 需要扩展支持 `functions` 和 `function_call` 参数。当前只支持 `jsonMode`，需增加：

```typescript
interface ChatOptions {
  jsonMode?: boolean
  functions?: OpenAIFunction[]
  function_call?: "auto" | "none" | { name: string }
  signal?: AbortSignal
}

interface ChatResponse {
  content: string
  provider: string
  // 新增
  functionCall?: {
    name: string
    arguments: string  // JSON string
  }
  // OpenAI 新格式也支持 tool_calls 数组，但初版只取第一个
}
```

### 3. 上下文管理

**新文件**：`lib/workers/react-context.ts`

管理 ReAct 循环中的 LLM 消息列表，防止 context window 溢出。

**混合模式策略**：

```
messages 结构：
  [0] system prompt（固定）
  [1] user message: 项目概况 + 当前 assets/findings 摘要
  [2..N] ReAct 步骤的 assistant/function/tool messages

压缩规则：
  - 当前步骤（最新）：完整 tool output
  - 最近 5 步：完整 tool output（但单个 output 截断到 3000 字符）
  - 更早的步骤：压缩为一行摘要
    格式："[Step {i}] {toolName}({target}) → {status}: {一行摘要}"
    摘要来源：analyzer 提取的结构化结果，或 output 前 200 字符
```

**压缩触发**：每步执行后检查总 token 估算（按字符数 / 3 粗估），超过阈值时压缩最旧的未压缩步骤。

**资产/发现注入**：每步开头的 system prompt 末尾动态追加最新的 assets 和 findings 列表（从数据库读取），确保 LLM 始终看到最新状态。

### 4. Scope 自动扩展

**修改文件**：`lib/domain/scope-policy.ts`（新建）

```typescript
interface ScopePolicy {
  // 原始目标列表
  originalTargets: Array<{ value: string; type: string }>
  // 判断一个新发现的资产是否在 scope 内
  isInScope(asset: { kind: string; value: string }): boolean
}
```

**Scope 边界规则**：

1. **同域规则**：原始目标为 `example.com`，则 `*.example.com` 自动纳入
2. **同网段规则**：原始目标为 `192.168.1.100`，则 `192.168.1.0/24` 自动纳入
3. **同主机规则**：同一 IP/hostname 的不同端口自动纳入
4. **越界标记**：不满足以上规则的资产标记为 `outOfScope: true`，只记录不测试

**ReAct worker 集成**：LLM 可以对任何目标调用工具，但 worker 在执行前检查 scope：
- in-scope → 正常执行
- out-of-scope → 跳过执行，在 tool result 中返回提示 "目标超出 scope，已记录但未执行"
- 发布 `scope_exceeded` 事件通知前端

### 5. 数据模型变化

#### 5.1 McpRun 表扩展

**修改文件**：`prisma/schema.prisma`

McpRun 新增字段：

```prisma
model McpRun {
  // ... 现有字段 ...

  // ReAct 新增
  stepIndex     Int?      // 步骤序号（0-based），null 表示非 ReAct 模式创建
  thought       String?   // LLM 在此步骤的推理内容
  functionArgs  Json?     // LLM 输出的 function call arguments（原始 JSON）
}
```

#### 5.2 OrchestratorRound 表扩展

```prisma
model OrchestratorRound {
  // ... 现有字段 ...

  // ReAct 新增
  maxSteps      Int       @default(30)   // 本轮最大步数
  actualSteps   Int       @default(0)    // 实际执行步数
  stopReason    String?   // "llm_done" | "max_steps" | "aborted" | "error"
}
```

#### 5.3 OrchestratorPlan 表

**不再需要**用于存储 plan items（ReAct 模式下没有预规划）。但保留表结构以兼容旧数据。ReAct 模式下不写入此表。

### 6. 事件系统扩展

**新增 SSE 事件类型**：

| 事件 | 触发时机 | payload |
|------|---------|---------|
| `react_step_started` | ReAct 步骤开始（LLM 返回 tool_call） | `{ round, stepIndex, thought, toolName, target }` |
| `react_step_completed` | 工具执行完成 | `{ round, stepIndex, toolName, status, outputPreview }` |
| `react_round_progress` | 每步结束后 | `{ round, currentStep, maxSteps, phase }` |
| `scope_exceeded` | LLM 尝试测试越界目标 | `{ target, reason }` |

**保留的事件**（语义不变）：
- `analysis_completed` — analyzer 提取完成
- `round_reviewed` — reviewer 决定
- `lifecycle_changed` — 生命周期变化
- `project_completed` — 项目完成

**废弃的事件**：
- `plan_created` → 不再有预规划阶段
- `tool_started` / `tool_completed` / `tool_failed` → 被 `react_step_*` 替代

### 7. Worker 注册变化

**修改文件**：`worker.ts`

```typescript
// 删除 plan_round 和 execute_tool 的 import 和 subscribe

// 新增
import { handleReactRound } from "@/lib/workers/react-worker"
boss.subscribe("react_round", handleReactRound, {
  teamConcurrency: 1,  // 同一项目同时只跑一个 round
  teamSize: 1,
})

// 保留不变
boss.subscribe("analyze_result", handleAnalyzeResult)
boss.subscribe("verify_finding", handleVerifyFinding)
boss.subscribe("round_completed", handleRoundCompleted)
boss.subscribe("settle_closure", handleSettleClosure)
```

**Job 超时**：`react_round` job 需要更长超时（单个 round 可能 30 步×5 分钟），设为 30 分钟。pg-boss 配置中 `expireInSeconds` 设为 1800。

### 8. 项目启动流程变化

**修改文件**：`lib/services/project-service.ts`

```
旧：POST /start → 发布 plan_round job
新：POST /start → 发布 react_round job
```

生命周期状态变化：
```
旧：idle → planning → executing → reviewing → ...
新：idle → executing → reviewing → ...

（planning 和 executing 合并——ReAct 循环同时包含规划和执行）
```

注意：
- `planning` 状态仍保留在 Prisma enum 中以兼容旧数据，但新 round 直接进入 `executing`
- `waiting_approval` 状态初版不使用（全自动模式），后续扩展审批时启用
- 生命周期状态机 `lib/domain/lifecycle.ts` 需要新增 `idle → executing` 的直接转换（当前只有 `idle → planning`）
- stale recovery 逻辑（worker.ts）需要适配：检测 `executing` 状态下的 react_round job 是否存活

### 9. Reviewer 适配

**修改文件**：`lib/workers/lifecycle-worker.ts` (handleRoundCompleted)

Reviewer 的输入不变——仍然是当前 round 的统计（执行了多少步、发现了什么）。但上下文更丰富：

- 新增：ReAct 循环的 `stopReason`（LLM 主动停止 vs 达到上限）
- 新增：LLM 最后一个 `thought` 作为 round 总结
- 保留：assets/findings 增量统计

### 10. 前端变化

#### 10.1 Operations 面板增强

**修改文件**：`components/projects/project-mcp-runs-panel.tsx`

当前显示 mcp_run 列表（平铺）。改为按 round → step 分组：

```
Round 3 (ReAct, 12/30 步, LLM 主动停止)
  ├─ Step 0: [思考] 目标是 192.168.1.100，先做端口扫描
  │          → fscan_port_scan(192.168.1.100) ✅ 发现 22,80,3306,6379
  ├─ Step 1: [思考] 发现 4 个端口，逐个抓 banner
  │          → tcp_banner_grab(192.168.1.100:6379) ✅ Redis 未授权
  ├─ Step 2: [思考] Redis 未授权，尝试获取敏感信息
  │          → execute_code(192.168.1.100:6379) ✅ 获取到数据库列表
  └─ ...
```

关键 UI 元素：
- 每步显示 thought（折叠/展开）
- 每步显示工具名、目标、状态、耗时
- rawOutput 展开查看
- 实时更新：通过 SSE 接收 `react_step_*` 事件

#### 10.2 Orchestrator 面板适配

**修改文件**：`components/projects/project-orchestrator-panel.tsx`

当前显示 "AI Planning Rounds" 和 plan items。改为显示 ReAct 循环摘要：

```
Round 3 — assessment 阶段 — 12 步 — LLM 主动停止
  摘要：完成了 Redis 未授权验证和 MySQL 弱密码测试...
  新增资产：3 | 新增发现：2
```

#### 10.3 SSE 监听

**修改文件**：前端组件需要监听新事件类型

- `react_step_started` → 在面板底部追加新步骤（显示 thought + "执行中..."）
- `react_step_completed` → 更新步骤状态（✅/❌ + output preview）
- `react_round_progress` → 更新进度条

### 11. API 变化

#### 11.1 新增端点

```
GET /api/projects/[projectId]/rounds/[round]/steps
```
返回指定 round 的所有 ReAct 步骤（mcp_run 按 stepIndex 排序），包含 thought 和 output。

#### 11.2 修改端点

```
GET /api/projects/[projectId]/orchestrator
```
返回数据中增加 ReAct 相关字段（actualSteps, stopReason）。

#### 11.3 保留端点

所有其它端点（assets, findings, evidence, approvals, llm-logs, pipeline-logs）无需修改。

### 12. LLM System Prompt

**新文件**：`lib/llm/react-prompt.ts`

ReAct agent 的 system prompt 结构：

```markdown
# 角色
你是一个专业的渗透测试 AI agent。你通过调用工具来执行渗透测试，每一步都能看到工具的完整输出并决定下一步行动。

# 项目信息
- 项目名称：{projectName}
- 目标：{targets}
- 当前阶段：{phase}
- 当前轮次：{round}/{maxRounds}
- 已用步数：{stepIndex}/{maxSteps}

# Scope 规则
- 可以自由测试以下 scope 内的目标：{scopeDescription}
- 发现新目标时，如果属于同域/同网段，直接测试
- 如果超出 scope，调用工具时会收到提示

# 已发现资产
{assetsList}

# 已发现漏洞
{findingsList}

# 行为准则
1. 每一步先思考（在 content 中写出推理），再选择工具
2. 根据工具返回的实际结果决定下一步，不要假设结果
3. 发现新的高价值目标时，立即展开测试
4. 当你认为当前阶段的测试已充分，调用 done() 结束本轮
5. 如果发现明确的安全问题，调用 report_finding() 记录
6. 不要重复已经做过的测试（检查已发现资产和漏洞列表）
7. 优先测试高价值目标（开放的管理端口、未授权服务等）
```

### 13. 错误处理

| 场景 | 处理 |
|------|------|
| LLM 调用失败 | 重试 1 次，仍失败则结束 round，stopReason = "error" |
| MCP 工具执行超时 | 在 tool result 中返回超时错误，LLM 可以选择重试或跳过 |
| MCP 工具执行失败 | 在 tool result 中返回错误信息，LLM 可以选择换工具 |
| LLM 输出无法解析 | 跳过此步，在 messages 中追加错误提示，继续循环 |
| 项目被用户停止 | 检查 abort signal，立即结束循环，stopReason = "aborted" |
| 达到步数上限 | 结束循环，stopReason = "max_steps" |
| 整个 react_round job 超时（30min） | pg-boss 标记失败，stale recovery 机制处理 |

### 14. Analyzer 集成

ReAct 循环中，每步工具执行完成后**异步**触发 analyzer：

```typescript
// 在 ReAct 循环内
const analysisPromise = queue.publish("analyze_result", {
  projectId, mcpRunId, rawOutput, toolName, target,
})
pendingAnalyses.push(analysisPromise)
```

- 不等待 analyzer 完成再继续下一步（避免阻塞循环）
- Round 结束时等待所有 pending analyses 完成（最多 30s）
- Analyzer 提取的 assets/findings 会写入数据库，下一步的 system prompt 动态注入最新状态

### 15. 无迁移——直接替换

这不是渐进式迁移，是直接替换：
- 删除旧的 planning-worker、execution-worker、buildPlannerPrompt
- 新建 react-worker 和相关模块
- 数据库新增字段用 `?`（optional），旧数据不受影响
- 前端通过 `stepIndex !== null` 区分新旧数据的展示方式

---

## 文件变更清单

### 新建文件
| 文件 | 职责 |
|------|------|
| `lib/workers/react-worker.ts` | ReAct 循环核心 |
| `lib/llm/function-calling.ts` | MCP 工具 → OpenAI function 转换 |
| `lib/llm/react-prompt.ts` | ReAct agent system prompt |
| `lib/llm/tool-input-mapper.ts` | 从 execution-worker 提取的 buildToolInput 公共模块 |
| `lib/workers/react-context.ts` | 上下文管理（压缩、注入） |
| `lib/domain/scope-policy.ts` | Scope 边界判断 |
| `app/api/projects/[projectId]/rounds/[round]/steps/route.ts` | 步骤查询 API |

### 修改文件
| 文件 | 变化 |
|------|------|
| `prisma/schema.prisma` | McpRun + OrchestratorRound 新增字段 |
| `lib/llm/openai-provider.ts` | 支持 functions / function_call 参数 |
| `lib/llm/prompts.ts` | 删除 `buildPlannerPrompt` 及 `PlannerContext`/`LlmPlanResponse` 类型，保留 analyzer/reviewer |
| `lib/llm/index.ts` | 删除 `buildPlannerPrompt` 导出，新增 function-calling 导出 |
| `worker.ts` | 删除 plan_round/execute_tool 注册，新增 react_round |
| `lib/services/project-service.ts` | 启动时发布 `react_round` job（替换 `plan_round`） |
| `lib/services/approval-service.ts` | 审批通过后的 `execute_tool` 发布逻辑暂时注释（初版全自动无审批），后续扩展时改为恢复 ReAct 循环 |
| `lib/domain/lifecycle.ts` | 新增 `idle→executing` 直接转换 |
| `lib/workers/lifecycle-worker.ts` | ① reviewer CONTINUE 时发布 `react_round`（替换 `plan_round`） ② 适配 ReAct 上下文（stopReason, 最后 thought） |
| `lib/repositories/mcp-run-repo.ts` | 支持 stepIndex/thought/functionArgs 字段 |
| `components/projects/project-mcp-runs-panel.tsx` | 按 round→step 分组展示 |
| `components/projects/project-orchestrator-panel.tsx` | ReAct 摘要展示 |
| `app/api/projects/[projectId]/orchestrator/route.ts` | 返回 ReAct 字段 |
| `scripts/publish-job.ts` | 更新调试脚本中的 job name |

### 删除文件
| 文件 | 原因 |
|------|------|
| `lib/workers/planning-worker.ts` | 被 react-worker.ts 完全替代 |
| `lib/workers/execution-worker.ts` | 工具执行内联到 ReAct 循环，buildToolInput 提取到 tool-input-mapper.ts |
| `tests/lib/workers/planning-worker.test.ts` | 对应源文件已删除 |
