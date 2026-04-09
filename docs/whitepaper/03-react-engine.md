# 03 — ReAct 执行引擎

> ReAct（Reason + Act）是 GoPwn 的核心执行引擎。LLM 在每一步推理后选择工具执行，观察真实结果后继续推理，直到完成本轮测试目标。

---

## 3.1 什么是 ReAct

ReAct 是一种让 LLM 逐步推理并行动的执行模式，源自学术论文 *"ReAct: Synergizing Reasoning and Acting in Language Models"*。在 GoPwn 中，每一步 LLM 执行三个动作：

1. **Thought（思考）** — 分析当前状态，决定下一步策略。例如："端口扫描发现 6379 开放，这通常是 Redis 服务，需要检测是否存在未授权访问。"
2. **Action（行动）** — 通过 OpenAI Function Calling 选择一个 MCP 工具并指定参数。例如：调用 `tcp_connect`，参数 `{ host: "target", port: 6379, data: "PING\r\n" }`。
3. **Observation（观察）** — 获取工具的真实执行结果。例如："+PONG"，确认 Redis 无需认证即可连接。

这个循环持续进行，直到 LLM 主动调用 `done()` 结束本轮，或达到步数上限（30 步）。

## 3.2 为什么用 ReAct 替代批量规划

GoPwn 最初使用"批量规划"模型：LLM 一次生成多个工具执行计划，平台并行执行完毕后再让 LLM 审阅。这个模型存在根本性问题：

| 旧模型（批量规划） | 问题 |
|-------------------|------|
| 一次规划 5 个工具 | 无法根据中间结果调整策略。例如发现 WAF 后无法改变后续测试方法 |
| 执行完才能看结果 | 浪费在无效工具上的时间和 API 调用费用 |
| JSON 输出解析 | LLM 生成的 JSON 格式不标准，解析脆弱 |
| 空计划 = 结束 | 需要复杂的 anti-termination 机制防止 LLM 过早放弃 |

ReAct 模型的对应优势：

| ReAct 模型 | 优势 |
|-----------|------|
| 每步实时决策 | LLM 看到每个工具的真实输出后再决定下一步 |
| 原生 Function Calling | 利用 LLM 原生能力，无需 JSON 解析 |
| 显式终止 | 必须调用 `done()` 才能结束，不会意外终止 |
| 单步失败不致命 | 一个工具失败不影响后续步骤 |
| 实时可观测 | 前端实时看到 LLM 的每一步推理 |

## 3.3 ReAct 循环详解

### 3.3.1 单轮执行流程

```
handleReactRound({ projectId, round })
│
├─ 1. 加载项目信息、已发现资产、已发现漏洞、可用 MCP 工具列表
├─ 2. 构建 ReactContext → buildReactSystemPrompt()（动态系统提示词）
├─ 3. 将 MCP 工具转换为 OpenAI functions 列表
├─ 4. 创建 ReactContextManager（系统提示 + 初始用户消息）
├─ 5. 创建 OrchestratorRound 记录
│
├─ 6. 进入 ReAct 循环 (step = 1..30)
│   │
│   ├─ 6a. 调用 LLM（带 tools 参数, temperature=0.2）
│   │       → LLM 返回 tool_calls[0].function: { name, arguments }
│   │
│   ├─ 6b. 判断调用类型:
│   │   ├─ done(summary, phase_suggestion)
│   │   │   → 记录 stopReason="llm_done"，跳出循环
│   │   │
│   │   ├─ report_finding(title, severity, target, detail)
│   │   │   → 直接写入 Finding 记录，继续循环
│   │   │
│   │   └─ MCP 工具 (httpx_probe, execute_code 等)
│   │       ├─ Scope 检查（目标是否在授权范围内）
│   │       ├─ 构建 MCP 输入参数
│   │       ├─ 创建 McpRun 记录
│   │       ├─ callTool() 执行（5 分钟超时）
│   │       ├─ 更新 McpRun 状态和输出
│   │       ├─ 异步入队 analyze_result 任务
│   │       └─ 将结果以 role: tool 回填 LLM 上下文
│   │
│   ├─ 6c. 发布 SSE 事件 (react_step_completed)
│   ├─ 6d. 每 5 步刷新系统提示（更新资产/漏洞列表）
│   └─ 6e. 检查中止信号 (AbortRegistry)
│
├─ 7. 更新 OrchestratorRound（actualSteps, stopReason）
├─ 8. 等待未完成的分析任务（最多 30 秒）
└─ 9. 发布 round_completed 任务 → 触发 Lifecycle Worker 审阅
```

### 3.3.2 常量配置

| 常量 | 值 | 说明 |
|------|------|------|
| `MAX_STEPS_PER_ROUND` | 30 | 单轮最大步数硬限制 |
| `MAX_EMPTY_RETRIES` | 3 | LLM 连续空响应最大重试次数 |
| `TOOL_TIMEOUT_MS` | 300,000 (5 min) | 单个 MCP 工具执行超时 |
| `ANALYSIS_WAIT_MS` | 30,000 (30 s) | 轮末等待异步分析完成 |

### 3.3.3 停止原因

| stopReason | 含义 |
|------------|------|
| `llm_done` | LLM 主动调用 `done()`，正常完成 |
| `max_steps` | 达到 30 步上限，强制终止 |
| `llm_no_action` | LLM 返回纯文本无 tool_calls，异常终止 |
| `aborted` | 用户手动停止 |
| `error` | 不可恢复的执行错误 |

### 3.3.4 空响应处理

如果 LLM 返回完全空的响应（`content: null` 且无 tool_calls），react-worker 会：
1. 将空响应作为 assistant 消息加入上下文
2. 注入 tool 消息提示 LLM 重新选择工具
3. 最多重试 3 次，超过则抛出错误

## 3.4 控制函数

除了 38 个 MCP 工具外，LLM 还可以调用两个平台内置的控制函数：

### done — 结束本轮

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `summary` | string | 是 | 本轮测试总结 |
| `phase_suggestion` | enum | 否 | 建议下一轮的渗透阶段 |

`phase_suggestion` 枚举值：`recon` / `discovery` / `assessment` / `verification` / `reporting`

当 LLM 认为当前轮次的测试目标已充分覆盖时，调用 `done()` 结束循环。平台记录 summary，如果有 phase_suggestion 则更新项目的下一阶段。

### report_finding — 报告安全发现

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 漏洞标题 |
| `severity` | enum | 是 | critical / high / medium / low / info |
| `target` | string | 是 | 受影响目标 |
| `detail` | string | 是 | 漏洞详情 |
| `recommendation` | string | 否 | 修复建议 |

LLM 在推理过程中如果确认发现了安全问题，可以直接调用 `report_finding` 报告，该函数直接写入 Finding 记录。调用后循环继续，LLM 可以继续测试其他目标。

## 3.5 上下文管理器（ReactContextManager）

ReAct 循环在每一步都需要向 LLM 传递完整的对话历史。随着步骤增多，消息列表会不断膨胀。`ReactContextManager` 负责在保证 LLM 信息完整性的同时控制 token 使用。

### 消息格式

使用 OpenAI 现代 `tools` 格式：

```
[0] { role: "system", content: "你是一个渗透测试 ReAct Agent..." }
[1] { role: "user", content: "开始第 1 轮测试，目标: ..." }
[2] { role: "assistant", tool_calls: [{ id: "tc_1", type: "function",
      function: { name: "httpx_probe", arguments: '{"target":"..."}' } }] }
[3] { role: "tool", tool_call_id: "tc_1", content: "HTTP/200 ..." }
[4] { role: "assistant", tool_calls: [{ id: "tc_2", ... }] }
[5] { role: "tool", tool_call_id: "tc_2", content: "..." }
...
```

### 滑动窗口压缩

| 参数 | 值 | 说明 |
|------|------|------|
| `TOKEN_BUDGET` | 80,000 | 触发压缩的 token 阈值 |
| `RECENT_WINDOW` | 5 步 | 保留完整输出的最近步数 |
| `MAX_OUTPUT_CHARS` | 3,000 | 单次工具输出最大保留长度 |
| Token 估算 | chars / 3 | 粗略估算规则 |

当估算 token 超过 80,000 时自动触发压缩：

1. **最近 5 步**：保留完整的 assistant + tool 消息
2. **更早的步骤**：压缩为单行摘要 `[Step N] toolName → target (OK/FAILED)`
3. 所有压缩摘要合并为一条 `user` 消息插入 index 2
4. 系统提示（index 0）和初始用户消息（index 1）永远不压缩

### 系统提示刷新

每执行 5 步，react-worker 重新从数据库查询最新的资产和漏洞列表，调用 `ctxManager.updateSystemPrompt()` 原地替换消息列表第 0 条。这确保 LLM 始终看到最新状态，而不是轮次开始时的快照。

## 3.6 轮次间流转

### 轮次审阅

每轮 ReAct 循环结束后，`lifecycle-worker` 触发 LLM Reviewer 审阅本轮结果：

```typescript
// lifecycle-worker.ts 简化逻辑
async function handleRoundCompleted({ projectId, round }) {
  // 1. 组装审阅上下文（轮次摘要、资产统计、漏洞统计）
  // 2. 调用 Reviewer LLM 生成决策
  const decision = await reviewRound(projectId, round)

  if (decision === "continue" && round < maxRounds) {
    // CONTINUE_REACT → 直接进入下一轮执行
    await queue.publish("react_round", { projectId, round: round + 1 })
  } else {
    // SETTLE → 进入收尾阶段
    await queue.publish("settle_closure", { projectId })
  }
}
```

### Reviewer 决策因素

- 当前轮次发现了多少新资产和漏洞
- 攻击面是否已充分覆盖
- 是否还有未测试的目标或服务
- 已到达最大轮数限制
- LLM 的 stopReason（`llm_done` 带 summary vs `max_steps` 被强制终止）
- 上一步 LLM 的最后推理内容（`lastThought`）

### 跨轮上下文传递

每一轮以全新的 `ReactContextManager` 开始，不继承上轮的消息历史。但跨轮上下文通过系统提示中的以下信息传递：

| 信息 | 来源 | 传递方式 |
|------|------|---------|
| 已发现资产列表 | 数据库实时查询 | 系统提示 §6 "已发现资产" |
| 已发现漏洞列表 | 数据库实时查询 | 系统提示 §7 "已发现漏洞" |
| 当前轮次和阶段 | 项目记录 | 系统提示 §3 "项目信息" |
| 可用工具列表 | MCP 注册表 | 系统提示 §8 "可用工具" |

## 3.7 Anti-Early-Termination

旧架构需要复杂的机制防止 LLM 返回空计划导致过早终止。ReAct 引擎从根本上消除了这个问题：

- **LLM 必须主动调用 `done()` 才能结束** — 不存在"返回空 JSON 收尾"的路径
- **步骤上限兜底** — 达到 30 步时自动终止，`stopReason` 设为 `max_steps`
- **纯文本回复** — 如果 LLM 没有调用任何函数，`stopReason` 设为 `llm_no_action`，属于异常行为

## 3.8 MCP 工具可观测性

react-worker 在每次 MCP 工具执行后记录详细日志，同时写入 Pino（stdout）和数据库（pipeline_log 表）：

- **成功**：`mcp_result` INFO — 工具名、目标、执行耗时（ms）、输出长度、输出预览（前 200 字符）
- **失败**：`mcp_error` ERROR — 工具名、目标、执行耗时、参数 JSON、错误详情（前 300 字符）

前端的"工作日志"页面可查询和筛选这些日志，帮助调试和分析执行过程。

## 3.9 与旧模型详细对比

| 维度 | 旧模型（批量规划） | ReAct 模型 |
|------|-------------------|-----------|
| 决策时机 | 一次规划 5 个工具，执行完才审阅 | 每步实时决策，看到结果再行动 |
| 信息利用 | 只看上轮结果摘要 | 直接看每步的 rawOutput |
| 适应性 | 无法中途调整（已规划的必须执行） | 随时调整策略和目标 |
| 工具选择 | JSON 输出解析（脆弱） | OpenAI Function Calling（原生） |
| 终止方式 | 返回空计划 = 结束 | 必须显式调用 `done()` |
| 失败处理 | 一个工具失败可能影响整批 | 单步失败不影响后续步骤 |
| Job 类型 | plan_round + execute_tool（2 种） | react_round（1 种） |
| Worker | planning-worker + execution-worker | react-worker（1 个） |
| 生命周期 | idle→planning→executing→reviewing | idle→executing→reviewing |
| 上下文传递 | 轮间摘要（信息损失大） | 滑动窗口（最近 5 步全量） |
| Token 效率 | 每轮独立 prompt | 累积消息流 + 压缩 |
