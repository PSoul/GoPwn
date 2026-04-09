# 05 — LLM 集成与 Prompt 工程

> GoPwn 的 LLM 集成遵循一个核心原则：只教方法论，不给代码。Prompt 中绝不包含具体攻击代码、靶场路径或 payload 字符串。

---

## 5.1 设计原则

GoPwn 的 Prompt 工程建立在四个核心原则之上：

1. **不给代码就是不作弊** — Prompt 中绝不包含 JavaScript/Python 代码片段、特定靶场路径（如 `/vulnerabilities/sqli/`）、具体 payload 字符串（如 `' OR '1'='1`）
2. **教方法论不教答案** — 告诉 LLM "分析页面 HTML 提取表单字段"，而不是给出具体的 DOM 选择器代码
3. **让 LLM 自主决策** — 侦察结果 + 方法论 = LLM 自己决定写什么代码、测什么漏洞
4. **换目标不需改 Prompt** — 同一套 Prompt 对 DVWA、Juice Shop、真实网站都有效

这些原则确保 GoPwn 是一个通用的渗透测试平台，而非针对特定靶场的"作弊器"。

## 5.2 四个 Prompt 模板

GoPwn 使用四个角色化的 Prompt 模板，每个模板对应一个 LLM 角色：

### 5.2.1 ReAct System Prompt（主驱动）

**函数**: `buildReactSystemPrompt(ctx: ReactContext)`
**位置**: `lib/llm/react-prompt.ts`
**Temperature**: 0.2
**角色**: 驱动 ReAct Agent 在迭代循环中执行渗透测试

**内容结构（9 个区块）**:

| 区块 | 内容 | 动态性 |
|------|------|--------|
| 1. 共享方法论 | 从 `mcps/pentest-agent-prompt.md` 加载 | 静态（内存缓存） |
| 2. 角色定义 | ReAct Agent 规则：每次必须调用 tool | 静态 |
| 3. 项目信息 | 项目名、描述、阶段、轮次、步数进度 | 每轮更新 |
| 4. 目标列表 | 所有渗透目标及类型 | 每轮更新 |
| 5. Scope 规则 | 范围描述 + 关联资产指导 | 每轮更新 |
| 6. 已发现资产 | 按 kind 分组列出 | 每 5 步刷新 |
| 7. 已发现漏洞 | 按 severity 排序列出 | 每 5 步刷新 |
| 8. 可用工具 | MCP 工具列表 + 参数提示 + 控制函数 | 每轮更新 |
| 9. 行为准则 | 9 条核心规则 | 静态 |

**9 条行为准则**:
1. 每步必须调用工具（禁止纯文本回复）
2. 根据实际结果决策（不预设结论）
3. 发现新目标先判断关联性（强关联深入、弱关联跳过）
4. 测试充分时调用 `done()`
5. 不重复测试已覆盖的目标
6. 优先高价值目标
7. 保持阶段意识（recon/discovery/assessment/verification）
8. 工具参数准确（可选参数使用默认值，仅项目需要时覆盖）
9. 错误恢复（工具失败换方法，不放弃）

**ReactContext 类型**:

```typescript
type ReactContext = {
  projectName: string
  projectDescription?: string      // 注入所有 LLM 角色
  targets: Array<{ value: string; type: string }>
  currentPhase: PentestPhase
  round: number
  maxRounds: number
  maxSteps: number
  stepIndex: number
  scopeDescription: string
  assets: Array<{ kind: AssetKind; value: string; label: string }>
  findings: Array<{ title: string; severity: string; affectedTarget: string; status: string }>
  availableTools?: Array<{ name: string; description: string; parameterHints?: string }>
}
```

### 5.2.2 审阅器 Prompt（Reviewer）

**函数**: `buildReviewerPrompt(ctx: ReviewerContext)`
**位置**: `lib/llm/prompts.ts`
**Temperature**: 0.1
**角色**: 每轮结束后审阅结果，决定是否继续

**输入信息**: 项目名称和描述、当前阶段、轮次进度、轮次摘要（含 actualSteps, stopReason, lastThought）、资产总数、漏洞总数、未验证漏洞数

**输出格式**:
```json
{
  "decision": "continue | settle",
  "nextPhase": "recon | discovery | assessment | verification | reporting",
  "reasoning": "决策理由"
}
```

**结论客观性原则**:
- findings=0 且 evidence=0 → 不能说"安全状态良好"，应结论为"覆盖不足"
- 工具失败/超时/无法连接 = 覆盖不足的证据
- 只有多种工具成功执行且未发现问题 → 才能说"未发现高危漏洞"

### 5.2.3 分析器 Prompt（Analyzer）

**函数**: `buildAnalyzerPrompt(ctx: AnalyzerContext)`
**位置**: `lib/llm/prompts.ts`
**角色**: 解析单次 MCP 工具输出，提取资产和安全发现

**输入**: 工具名、目标、原始输出（截断至 15,000 字符）、已有资产列表、已有发现列表、项目描述和原始目标

**输出格式**:
```json
{
  "assets": [{ "kind": "...", "value": "...", "label": "...", "fingerprints": [] }],
  "findings": [{ "title": "...", "severity": "...", "summary": "...", "affectedTarget": "...", "recommendation": "..." }],
  "evidenceSummary": "..."
}
```

**关联性判断**: Analyzer 根据项目描述和目标判断发现的资产是否与项目相关 — 强关联（目标子域名、同网段 IP）提取，弱关联（CDN、第三方服务）跳过。

### 5.2.4 验证器 Prompt（Verifier）

**函数**: `buildVerifierPrompt(ctx: VerifierContext)`
**位置**: `lib/llm/prompts.ts`
**角色**: 针对已发现漏洞生成 PoC 验证代码

**输出格式**:
```json
{
  "code": "验证代码（完整可执行）",
  "language": "javascript | python | http",
  "description": "代码说明及成功/失败判断标志"
}
```

**要求**: 代码必须非破坏性；输出必须包含 `{ "verified": true/false, "detail": "..." }`；优先使用 JavaScript（Node.js fetch API）。

## 5.3 LLM Provider 实现

### OpenAI 兼容客户端

`openai-provider.ts` 实现了与任意 OpenAI 兼容 API 的通信，使用 SSE 流式调用：

**核心特性**:

| 特性 | 实现方式 |
|------|---------|
| SSE 流式调用 | `stream: true`，逐块解析 Server-Sent Events |
| tool_calls 聚合 | 按 index 拼接分块的 name 和 arguments |
| reasoning_content 回退 | reasoning 模型在 content 为空时提取 reasoning |
| response_format 降级 | 收到 400 后移除 `response_format` 并在 system prompt 中追加 JSON 指令重试 |
| token 用量统计 | `stream_options: { include_usage: true }` |
| 空响应重试 | react-worker 层最多 3 次 |

### 三个 LLM Profile

平台支持独立配置三个 LLM 角色：

| Profile ID | 用途 | Temperature |
|------------|------|-------------|
| `planner` (react 复用) | ReAct 执行循环 | 0.2 |
| `analyzer` | MCP 工具输出分析 | 默认 |
| `reviewer` | 轮次审阅决策 | 0.1 |

**解析优先级**: 数据库配置 → 环境变量 → 默认值。`reviewer` 和 `analyzer` 未配置时回退复用 `planner`。

### 已验证的 LLM Provider

| Provider | 模型 | 状态 | 备注 |
|----------|------|------|------|
| 阿里云 DashScope | qwen3.6-plus | 已验证 | 推理模型，timeout 建议 300s |
| SiliconFlow | DeepSeek-V3.2 | 已验证 | response_format 不兼容，已自动降级 |

理论上支持任何 OpenAI 兼容 API，包括 OpenAI 官方、Azure OpenAI、各类反向代理和 API 聚合服务。

## 5.4 Function Calling 格式

### 请求格式（现代 tools 格式）

```json
{
  "model": "...",
  "messages": [...],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "httpx_probe",
        "description": "Web 存活探测",
        "parameters": { "type": "object", "properties": {...}, "required": [...] }
      }
    },
    ...
  ],
  "tool_choice": "auto",
  "stream": true
}
```

### 响应分发逻辑

```
LLM 返回 tool_calls?
  ├─ name == "done"            → 更新 phase，stopReason=llm_done，结束循环
  ├─ name == "report_finding"  → 写入 Finding，继续循环
  └─ 其他（MCP 工具名）        → scope 检查 → callTool() → 回填结果 → 异步分析

LLM 无 tool_calls?
  └─ 纯文本回复                → stopReason=llm_no_action，结束循环
```

## 5.5 通用渗透方法论

`mcps/pentest-agent-prompt.md` 承载通用方法论，通过 `loadSystemPrompt()` 加载后注入所有 Prompt 前置内容。以下为核心教学框架：

### Web 应用测试

1. 先侦察再行动 — 用 httpx/dirsearch 了解技术栈和入口点
2. 分析页面结构 — GET HTML，解析表单字段含隐藏的 CSRF token
3. 处理认证 — GET 登录页 → 提取字段 → POST → 保存 session cookie
4. 逐入口点测试 — URL 参数、表单字段、HTTP Header
5. 覆盖常见漏洞 — SQLi、XSS、命令注入、路径穿越、认证绕过、信息泄露
6. 处理防护机制 — 编码绕过、变形 payload

### 非 HTTP 服务测试

1. TCP banner grab 确认服务类型
2. 根据协议自主编写客户端代码
3. 弱口令、默认配置、未授权访问检测

## 5.6 LLM 调用日志

`call-logger.ts` 装饰器记录每次 LLM 调用的完整信息：

| 字段 | 内容 |
|------|------|
| role | 调用角色（react / analyzer / reviewer / verifier） |
| phase | 当前渗透阶段 |
| prompt | 完整的 prompt 内容 |
| response | LLM 返回内容（含 Function Call 详情） |
| model | 使用的模型名 |
| provider | Provider 标识 |
| durationMs | 调用耗时 |
| status | streaming / completed / failed |

Function Call 详情在 response 中以 `[Function Call] name(args)` 格式附加，解决了前端 AI 日志显示"暂无内容"的问题。

## 5.7 已知限制

1. **模型能力差异显著** — Claude/GPT-4 的 Function Calling 质量和推理深度远优于小模型，复杂渗透测试需要强模型
2. **非标准 Function Calling** — 部分 LLM Provider 对 OpenAI Function Calling 兼容性差，可能导致工具选择错误
3. **Context 窗口压力** — 步骤较多时即使有滑动窗口压缩，仍可能接近上限
4. **异步分析延迟** — 分析器作为独立 job 异步运行，等待超时的分析结果不进入本轮审阅器视野
