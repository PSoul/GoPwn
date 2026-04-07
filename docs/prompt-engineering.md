# Prompt 工程设计

> 最后更新: 2026-04-07
> 核心原则：只教通用方法论，不给任何具体代码示例或靶场特定路径。LLM 必须自主思考。

---

## 设计原则

1. **不给代码就是不作弊** — Prompt 中绝不包含任何 JavaScript/Python 代码片段、特定靶场路径（如 `/vulnerabilities/sqli/`）、具体 payload 字符串（如 `' OR '1'='1`）
2. **教方法论不教答案** — 告诉 LLM "分析页面 HTML 提取表单字段"，而不是给出 `document.querySelector('input[name=user_token]')` 的代码
3. **让 LLM 自主决策** — 侦察结果 + 方法论 = LLM 自己决定写什么代码、测什么漏洞
4. **换目标不需改 prompt** — 同一套 prompt 对 DVWA、Juice Shop、真实网站都应该有效

---

## 四个 Prompt 模板

### 1. ReAct System Prompt（主驱动，新架构核心）

**函数**: `buildReactSystemPrompt(ctx: ReactContext)` — `lib/llm/react-prompt.ts`
**Temperature**: 0.2
**用途**: 驱动 ReAct Agent 在迭代循环中执行渗透测试，每轮调用一次 LLM 并通过 Function Calling 选择工具

**内容结构**（动态组装，按节顺序）:

```
1. 共享方法论基础（从 mcps/pentest-agent-prompt.md 加载，若文件不存在则跳过）
2. 角色定义（ReAct Agent：每次响应必须调用 tool，禁止纯文本）
3. 项目信息（项目名、项目描述（若有）、阶段、轮次、步数进度）
4. 测试目标列表（[type] value 格式）
5. Scope 规则（scopeDescription + 组织关联资产的软性指导）
6. 已发现资产（[kind] value — label 格式，无资产时显示占位符）
7. 已发现漏洞（[severity/status] title → affectedTarget 格式，无发现时显示占位符）
8. 可用工具列表（MCP 工具名 + 描述 + 参数提示 + done/report_finding 控制函数）
9. 行为准则（9 条：每步必须调用工具、根据实际结果决策、发现新目标先判断关联性、
              充分时调用 done()、不重复测试、优先高价值目标、阶段意识、
              工具参数准确（默认值优先）、错误恢复）
```

**与工具调用的集成方式**:
- 使用 OpenAI 现代 `tools` 格式（Phase 24c 升级）— 请求体使用 `tools: [{type: "function", function: {...}}]` + `tool_choice`，而非废弃的 `functions` + `function_call`
- MCP 工具由 `mcpToolsToFunctions()` 转换为 OpenAI functions 格式后传入
- 控制函数（`done`、`report_finding`）通过 `getControlFunctions()` 附加，与 MCP 工具并列可选
- LLM 响应通过 `message.tool_calls[0].function.{name, arguments}` 解析（兼容旧 `function_call` 格式）
- 工具结果以 `role: "tool"` + `tool_call_id` 回填消息列表

**系统提示刷新机制**:
- 每执行 5 步后，worker 重新查询数据库获取最新资产和发现
- 调用 `ctxManager.updateSystemPrompt(updatedPrompt)` 原地替换消息列表第 0 条
- 确保 LLM 始终看到最新的资产/漏洞状态，而不是轮次开始时的快照

**关联文件**:
- `lib/llm/react-prompt.ts` — `buildReactSystemPrompt()` 实现
- `lib/llm/system-prompt.ts` — `loadSystemPrompt()` 加载共享方法论，内存缓存，重启 worker 生效
- `lib/llm/function-calling.ts` — `mcpToolsToFunctions()`、`getControlFunctions()`
- `lib/workers/react-worker.ts` — ReAct 循环主体，Temperature 0.2，每 5 步刷新系统提示

> **历史说明**: 旧架构的"编排器 User Prompt"（`buildProjectBrainPrompt`）和常量 `ORCHESTRATOR_BRAIN_SYSTEM_PROMPT` 已被本模板完全替代，不再存在于代码库中。

---

### 2. 审阅器 Prompt

**System**: 共享方法论（`loadSystemPrompt()`）
**User 函数**: `buildReviewerPrompt(ctx: ReviewerContext)` — `lib/llm/prompts.ts`
**Temperature**: 0.1
**用途**: 每轮结束后，审阅测试结果并决定是继续下一轮还是终止评估

**ReviewerContext 字段**:

| 字段 | 来源 | 说明 |
|------|------|------|
| `projectName` | 项目记录 | 项目名称 |
| `projectDescription` | 项目记录 | 项目描述（用于理解测试目标和策略） |
| `currentPhase` | 项目记录 | 当前阶段（recon/discovery/assessment 等） |
| `round` / `maxRounds` | 轮次计数 | 当前轮次及上限 |
| `roundSummary` | lifecycle-worker 组装 | 包含 ReAct 循环元数据（见下） |
| `totalAssets` / `totalFindings` | 数据库统计 | 资产总数、发现总数 |
| `unverifiedFindings` | 发现过滤 | suspected + verifying 状态数量 |

**ReAct 轮次元数据（roundSummary 中包含）**:
- `actualSteps`：本轮实际执行步骤数（来自 `OrchestratorRound` 记录）
- `stopReason`：停止原因（`llm_done` / `max_steps` / `llm_no_action` / `aborted`）
- `lastThought`：LLM 最后一次推理内容（从最大 stepIndex 的 mcp_run 记录中提取）

**输出格式**（JSON）:
```json
{
  "decision": "continue|settle",
  "nextPhase": "recon|discovery|assessment|verification|reporting",
  "reasoning": "决策理由"
}
```

**关键设计 — 结论客观性原则**:
- findings=0 && evidence=0 → **不能说** "安全状态良好"
- 正确结论：扫描覆盖不足，不能排除安全风险
- 只有多种工具成功执行且未发现问题 → 才能说 "未发现高危漏洞"
- 工具失败/超时/无法连接 = 覆盖不足的证据
- 已知靶场（DVWA、WebGoat 等）需明确说明是故意脆弱应用

---

### 3. 分析器 Prompt

**函数**: `buildAnalyzerPrompt(ctx: AnalyzerContext)` — `lib/llm/prompts.ts`
**用途**: 解析单次 MCP 工具的原始输出，提取资产和安全发现

**AnalyzerContext 新增字段**:
- `projectDescription` — 项目描述，帮助判断资产与项目的关联性
- `scopeTargets` — 项目原始目标列表，用于关联性比对

**输入**:
- 工具名、目标、原始输出（截断至 15,000 字符）
- 已有资产列表（去重依据）
- 已有发现列表（避免重复报告同类问题）
- 项目描述和原始目标（用于智能关联性判断）

**关联性判断指令**（注入 Analyzer prompt）:
- 只提取与项目目标有关联的资产
- 强关联（目标子域名、同网段 IP、官方关联域名）→ 提取
- 弱关联（CDN、第三方服务商、无明确关系的外部地址）→ 不提取
- 资产 JSON 支持可选 `relevance` 字段说明关联依据

**输出格式**（JSON）:
```json
{
  "assets": [{ "kind": "...", "value": "...", "label": "...", "parentValue": "...", "fingerprints": [...] }],
  "findings": [{ "title": "...", "severity": "...", "summary": "...", "affectedTarget": "...", "recommendation": "..." }],
  "evidenceSummary": "..."
}
```

**关联**: 分析器由 react-worker 异步触发（`analyze_result` job），不阻塞 ReAct 循环主流程。

---

### 4. 验证器 Prompt

**函数**: `buildVerifierPrompt(ctx: VerifierContext)` — `lib/llm/prompts.ts`
**用途**: 针对已发现漏洞生成 PoC 验证代码

**输出格式**（JSON）:
```json
{
  "code": "验证代码（完整可执行）",
  "language": "javascript|python|http",
  "description": "代码说明及成功/失败判断标志"
}
```

**要求**: 代码必须非破坏性，输出必须包含 `{ "verified": true/false, "detail": "..." }`，优先使用 JavaScript (Node.js fetch API)。

---

## ReAct 上下文管理

`ReactContextManager`（`lib/workers/react-context.ts`）负责在迭代 ReAct 循环中维护 LLM 消息历史，并通过滑动窗口压缩控制 token 用量。

### 消息格式

```
system     → ReAct 系统提示（buildReactSystemPrompt 输出，每 5 步刷新）
user       → 初始启动消息（"开始第 N 轮渗透测试，目标: ..."）
[重复以下单元直至循环结束]:
  assistant  → { content: thought, tool_calls: [{ id, type: "function", function: { name, arguments } }] }
  tool       → { tool_call_id, content: toolOutput }
```

- 当 LLM 调用控制函数（`done` / `report_finding`）时，结果同样以 `tool` 角色消息写回
- 当 LLM 未调用任何函数（纯文本回复）时，以 `assistant` 消息追加后结束循环（`stopReason: llm_no_action`）

### 滑动窗口压缩

| 参数 | 值 | 说明 |
|------|----|------|
| `RECENT_WINDOW` | 5 步 | 最近 N 步保留完整工具输出 |
| `MAX_OUTPUT_CHARS` | 3,000 字符 | 单次工具输出最大保留长度（超出截断） |
| `TOKEN_BUDGET` | 80,000 token | 触发压缩的 token 阈值 |
| token 估算 | chars / 3 | 粗略估算，每 3 字符约 1 token |

**压缩逻辑**:
1. 当估算 token 超过 `TOKEN_BUDGET` 时，自动触发
2. 将超出最近 5 步的旧步骤压缩为单行摘要：`[Step N] toolName → target (OK|FAILED)`
3. 压缩后的摘要以 `user` 角色消息 `[Previous steps summary]` 插入
4. 原始的 `assistant + function` 消息对从历史中移除
5. 系统提示（index 0）和初始用户消息（index 1）永远不压缩

### 系统提示更新

每执行 5 步，react-worker 重新从数据库拉取最新资产和发现，调用 `ctxManager.updateSystemPrompt()` 替换 `messages[0]`，无需重建整个消息列表。

---

## Function Calling 格式

### MCP 工具转换

`mcpToolsToFunctions(tools: McpToolRecord[]): OpenAIFunctionDef[]`（`lib/llm/function-calling.ts`）

将数据库中 `McpTool` 记录的 `inputSchema`（JSON Schema 格式）转为 OpenAI `functions` 参数格式：

```typescript
{
  name: tool.toolName,
  description: tool.description,
  parameters: {
    type: "object",
    properties: schema.properties,
    required: schema.required,   // 仅在 schema 中存在时包含
  }
}
```

### 控制函数

`getControlFunctions()` 返回两个平台内置函数，与 MCP 工具并列传给 LLM：

| 函数名 | 用途 | 必填参数 |
|--------|------|----------|
| `done` | 主动结束当前轮次 | `summary`（测试总结），可选 `phase_suggestion`（下阶段建议） |
| `report_finding` | 直接报告安全发现 | `title`, `severity`, `target`, `detail`，可选 `recommendation` |

**`done` 的 `phase_suggestion` 枚举**: `recon` / `discovery` / `assessment` / `verification` / `reporting`
**`report_finding` 的 `severity` 枚举**: `critical` / `high` / `medium` / `low` / `info`

### LLM 响应分发逻辑（react-worker）

```
response.functionCall 存在？
  ├─ name == "done"            → 更新 phase（若有 phase_suggestion），设 stopReason=llm_done，break
  ├─ name == "report_finding"  → 写入 finding 到数据库，continue 继续循环
  └─ 其他（MCP 工具名）        → scope 检查 → 执行 callTool() → 写回 function 消息 → 触发异步分析
response.functionCall 不存在？
  └─ 纯文本回复                → 追加 assistant 消息，设 stopReason=llm_no_action，break
```

### Scope 检查

每次 MCP 工具调用前，从 `fnArgs` 中提取目标值（优先顺序：`target` > `url` > `host` > `address`），经 `scopePolicy.isInScope()` 验证。超出 scope 的调用不执行，但会写入 `failed` 状态的 function 消息，使 LLM 知晓约束原因。

---

## 通用方法论（Prompt 中的核心教学内容）

通用方法论由 `mcps/pentest-agent-prompt.md` 承载，通过 `loadSystemPrompt()` 加载后注入为所有 Prompt 的前置内容。以下为文件缺失时的 fallback 内置原则：

### Web 应用测试

1. 先侦察再行动（httpx/dirsearch 了解技术栈和入口点）
2. 分析页面结构（GET HTML，解析表单字段含隐藏的 CSRF token）
3. 处理认证（GET 登录页 → 提取字段 → POST → 保存 session cookie）
4. 逐入口点测试（URL 参数、表单字段、HTTP Header）
5. 覆盖常见漏洞（SQLi、XSS、命令注入、路径穿越、认证绕过、信息泄露）
6. 处理防护机制（编码绕过、变形 payload）

### 非 HTTP 服务测试

1. TCP banner grab 确认服务类型
2. 根据协议自主编写客户端代码
3. 弱口令、默认配置、未授权访问检测

---

## 多轮续跑的上下文传递

旧架构使用批量上下文字段（`roundHistory`、`assetSnapshot`、`lastRoundDetail`、`unusedCapabilities`、`failedToolsSummary`）注入 User Prompt。**新架构已废弃此方案**，由 ReAct 上下文管理器的连续消息流取代：

| 旧字段 | 新机制 |
|--------|--------|
| `roundHistory` | 历史步骤通过滑动窗口压缩保留在消息历史中 |
| `assetSnapshot` | 系统提示每 3 步刷新，始终包含最新资产快照 |
| `lastRoundDetail` | 前一步的工具输出直接以 `function` 消息可见 |
| `unusedCapabilities` | LLM 可通过消息历史推断已用工具，系统不再主动提示 |
| `failedToolsSummary` | 失败的工具调用以 `function` 消息呈现，LLM 可直接读取原因 |

每一步的结果对 LLM 即时可见，无需"上轮摘要"抽象层。跨轮续跑时，新轮次以全新消息历史开始（`ReactContextManager` 重建），但系统提示中的资产/发现列表提供了跨轮上下文。

---

## ReAct Anti-Early-Termination 机制

旧架构依赖两层保护（Prompt 注入 findingCount 警告 + 代码层 fallback 计划注入）来防止 LLM 返回空计划。**新架构已从根本上消除了此问题**：

- **LLM 必须主动调用 `done()` 才能结束** — 不存在"返回空 JSON 收尾"的路径
- **步骤上限兜底**: `MAX_STEPS_PER_ROUND = 30`，达到上限时 `stopReason` 设为 `max_steps`，循环自然终止
- **不调用函数时的处理**: 若 LLM 返回纯文本（不调用任何函数），`stopReason` 设为 `llm_no_action` 后终止，属于 LLM 行为异常，不构成正常流程

可观测的停止原因：

| stopReason | 含义 |
|------------|------|
| `llm_done` | LLM 主动调用 `done()`，正常结束 |
| `max_steps` | 达到 30 步上限，强制终止 |
| `llm_no_action` | LLM 未调用任何函数，异常终止 |
| `aborted` | 用户手动停止项目 |

相关代码：`lib/workers/react-worker.ts` — ReAct 循环主体及 stopReason 逻辑

---

## 已知局限

- **模型能力差异显著**：Claude/GPT-4 的 Function Calling 质量和推理深度远优于小模型，复杂渗透测试任务需要能力较强的模型
- **非标准 Function Calling 支持**：部分 LLM provider 对 OpenAI Function Calling 格式兼容性差，可能导致工具选择错误或参数解析失败
- **Context 窗口压力**：步骤数较多时（尤其工具输出较大），即使有滑动窗口压缩，仍可能接近 context 上限；`MAX_OUTPUT_CHARS=3000` 的单步截断是主要缓解措施
- **DeepSeek V3.2 限制**：在 CSRF token 处理上自主能力有限，且不支持 `response_format`（已在 provider 层自动降级）
- **approval-resume 循环**：高风险工具触发审批后，恢复执行时 LLM 可能对同一目标重复规划（待优化去重逻辑）
- **异步分析延迟**：分析器作为独立 job 异步运行，轮次结束时等待最多 30 秒，等待超时的分析结果不会进入本轮审阅器视野
- **优化方向**：对于 provider 兼容性问题，可增加 tool-use 格式 adapter；对 context 压力，可引入更激进的摘要压缩策略
