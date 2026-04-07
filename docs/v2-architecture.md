# V2 架构文档

> 本文档描述 LLM 渗透测试平台 v2 的架构设计，已更新至 ReAct 引擎迁移后的当前状态。

## 1. 架构总览

V2 采用 **双进程 + 异步任务队列 + 事件驱动** 架构。核心编排引擎已从"规划 → 执行"两步模型迁移至 **ReAct（Reasoning + Acting）** 循环模型，LLM 在单个轮次内通过 OpenAI Function Calling 自主选工具、观察结果、决定下一步。

```
┌──────────────────────────────────┐
│  Next.js 进程 (API + SSR)        │
│  ├─ API Routes (<5s 响应)        │
│  ├─ SSR 页面渲染                 │
│  └─ SSE 端点 (实时事件推送)      │
└──────────────┬───────────────────┘
               │ pg-boss 任务队列
               │ PostgreSQL LISTEN/NOTIFY
┌──────────────▼───────────────────┐
│  Worker 进程 (长任务处理)         │
│  ├─ ReAct Worker   (ReAct 循环)  │
│  ├─ Analysis Worker (LLM 分析)   │
│  ├─ Verification Worker (PoC)    │
│  └─ Lifecycle Worker (轮次生命周期) │
└──────────────────────────────────┘
```

**技术栈**: Next.js 15 + React 19 + TypeScript + Prisma 7 + PostgreSQL 16 + pg-boss + JWT + SSE Streaming LLM

---

## 2. 核心设计决策

### 2.1 纯函数状态机

10 个状态，15 种事件，所有转换通过 `transition(current, event)` 纯函数完成。ReAct 迁移后新增三个直接跳过 `planning` 状态的事件（`START_REACT`、`CONTINUE_REACT`、`RETRY_REACT`）：

```
idle       → executing        (START_REACT，跳过 planning)
idle       → planning         (START，保留旧路径)
planning   → executing        (PLAN_READY)
planning   → failed           (PLAN_FAILED)
executing  → reviewing        (ALL_DONE，即 round_completed)
executing  → waiting_approval (APPROVAL_NEEDED)
waiting_approval → executing  (RESOLVED)
reviewing  → executing        (CONTINUE_REACT，跳过 planning)
reviewing  → planning         (CONTINUE，保留旧路径)
reviewing  → settling         (SETTLE)
settling   → completed        (SETTLED)
settling   → failed           (FAILED)
failed     → executing        (RETRY_REACT，跳过 planning)
failed     → planning         (RETRY，保留旧路径)
* → stopping → stopped        (STOP / STOPPED)
```

**状态枚举（ProjectLifecycle）**: `idle` | `planning` | `executing` | `waiting_approval` | `reviewing` | `settling` | `completed` | `stopped` | `stopping` | `failed`

### 2.2 五实体领域模型

| 实体 | 用途 | 关键字段 |
|------|------|---------|
| **Project** | 顶层容器 | lifecycle, currentPhase, currentRound, maxRounds |
| **Asset** | 发现的资产（树形） | kind, value, parentId, fingerprints[] |
| **Finding** | 安全发现 | severity, status(suspected→verified/false_positive), evidenceId |
| **Evidence** | 原始证据 | toolName, rawOutput, mcpRunId |
| **McpRun** | 工具执行记录 | status, riskLevel, phase, round, stepIndex, thought, functionArgs |

辅助实体: Approval, OrchestratorPlan, OrchestratorRound, LlmCallLog, AuditEvent, Poc, Fingerprint

`McpRun` 在 ReAct 迁移后新增 `stepIndex`（在轮次内的步骤序号）、`thought`（LLM 调用工具前的推理文本）、`functionArgs`（原始 function call 参数 JSON）三个字段。

### 2.3 任务类型（Job Types）

| 任务 | 触发时机 | 处理 Worker |
|------|---------|------------|
| `react_round` | 项目启动 / 轮次继续 / 重试 | ReAct Worker |
| `analyze_result` | ReAct 循环内工具执行成功 | Analysis Worker |
| `verify_finding` | 发现非 info 级别问题 | Verification Worker |
| `round_completed` | ReAct 循环结束 | Lifecycle Worker |
| `settle_closure` | Reviewer 决定结束或达到 maxRounds | Lifecycle Worker |

`plan_round` 和 `execute_tool` 两个旧任务已随 Planning Worker、Execution Worker 一并移除。

### 2.4 ReAct 引擎

ReAct 循环在 `react-worker.ts` 中实现，核心逻辑如下：

```
for stepIndex = 0..MAX_STEPS_PER_ROUND (30):
  1. 调用 LLM（OpenAI tools format，tools = MCP工具 + 控制函数）
  2. 若 LLM 无 tool_calls → 停止（llm_no_action）
  3. 若 tool_calls[0].function.name == "done" → 记录 summary/phase_suggestion → 停止
  4. 若 tool_calls[0].function.name == "report_finding" → 直接写 Finding → continue
  5. 检查 scope → 超出则注入失败结果 → continue
  6. 执行 MCP 工具（TOOL_TIMEOUT_MS = 5min）
  7. 保存 McpRun，更新 OrchestratorRound 统计
  8. 将结果注入 ReactContextManager
  9. 发布 react_step_completed SSE 事件
  10. 每 5 步刷新资产/发现列表，更新 system prompt
完成后 → 等待挂起分析（≤30s）→ 发布 round_completed job
```

**控制函数**（非 MCP 工具，由 `function-calling.ts` 定义）:

| 函数名 | 作用 | 必填参数 |
|--------|------|---------|
| `done` | 结束当前轮次，类似原 `finish_round` | `summary` |
| `done` (可选) | 建议下一轮阶段 | `phase_suggestion` |
| `report_finding` | 直接报告安全发现 | `title`, `severity`, `target`, `detail` |

### 2.5 ReactContextManager（滑动窗口压缩）

`react-context.ts` 管理 ReAct 循环的对话消息列表，确保不超出 LLM 上下文窗口：

- **Token 预算**: 80,000 tokens（估算：字符数 ÷ 3）
- **单条工具输出截断**: 最多 3,000 字符
- **滑动窗口**: 保留最近 5 步完整输出；更早的步骤压缩为单行摘要 `[Step N] toolName → target (OK/FAILED)`
- 压缩摘要以 `user` 消息注入，`system` 消息（index 0）和初始 `user` 消息（index 1）始终保留

### 2.6 动态 MCP 工具管理

```
mcps/mcp-servers.json → loadServersFromManifest() → McpServer 表
                       → syncToolsFromServers() → stdio JSON-RPC tools/list → McpTool 表
                       → inferCapability() 自动推断能力族
```

在 ReAct 模型中，MCP 工具通过 `mcpToolsToFunctions()` 转换为 OpenAI `functions` 参数格式，供 LLM 直接选用。工具的 `inputSchema`（JSON Schema）直接映射为 function `parameters`。

**新增 MCP 工具的流程**:
1. 在 `mcps/` 下创建新的 MCP server
2. 在 `mcps/mcp-servers.json` 中添加配置
3. 重启 worker 或调用 `POST /api/settings/mcp/sync`
4. 工具自动发现、注册、归类，下次 ReAct 循环时自动可用

**15 种能力族**: dns_subdomain, dns_whois, external_intel, host_discovery, port_scan, asset_scan, credential_test, web_probe, waf_detection, fingerprint, web_crawl, http_interaction, tcp_interaction, vuln_scan, code_execution, crypto_tool, file_io, screenshot

### 2.7 Scope 策略（scope-policy.ts）

`createScopePolicy(targets)` 从项目目标列表自动推断边界规则，在 ReAct 循环每步执行前检查：

- 域名目标 → `DomainRule`：同根域名（`*.example.com`）均在 scope 内
- IP 目标 → `SubnetRule`：同 /24 子网均在 scope 内
- 超出 scope 的工具调用不执行，注入失败结果并发布 `scope_exceeded` 事件

### 2.8 System Prompt 动态加载

LLM 的系统提示由 `react-prompt.ts` 中的 `buildReactSystemPrompt(ctx)` 动态构建，内含：
- 项目名称和项目描述（用于智能 scope 判断和测试策略引导）
- 当前项目目标、渗透阶段、轮次信息
- 已发现资产和安全发现列表（每 5 步自动刷新）
- Scope 描述 + 组织关联资产的软性指导
- 可用 MCP 工具列表（含参数提示：必填/可选、枚举值、描述）
- 可用控制函数说明

项目描述同时注入 Analyzer 和 Reviewer 的 prompt 中，确保所有 LLM 角色理解项目整体目标。

ReAct system prompt 与文件加载的 `pentest-agent-prompt.md` 各司其职：前者提供上下文感知的动态部分，后者保留通用渗透方法论。

### 2.9 SSE 流式 LLM Provider

`openai-provider.ts` 使用 SSE 流式调用（`stream: true`）与 OpenAI 兼容 API 通信：
- 解决部分 API 代理（如反向代理）在非流式模式下返回 `content: null` 的问题
- 支持流式 `tool_calls` 聚合（按 index 拼接分块的 name 和 arguments）
- 支持 `reasoning_content` 字段回退（reasoning 模型在 content 为空时提取 reasoning）
- LLM 空响应时自动重试（react-worker 层最多 3 次）
- 包含 `stream_options: { include_usage: true }` 以获取 token 用量统计

### 2.10 MCP 工具可观测性

react-worker 在每次 MCP 工具执行后记录详细日志：
- **成功**：`mcp_result` INFO — 工具名、目标、执行耗时（ms）、输出长度、输出预览
- **失败**：`mcp_error` ERROR — 工具名、目标、执行耗时、参数 JSON、错误详情
- 日志同时写入 Pino（stdout）和数据库（pipeline_log 表），支持前端工作日志页面查询

---

## 3. V1 vs V2 对比

### 3.1 架构级差异

| 维度 | V1 | V2（ReAct 后） |
|------|----|----|
| **进程模型** | 单进程（HTTP 请求内执行长任务） | 双进程（API + Worker 分离） |
| **编排方式** | 同步 while 循环在 HTTP 请求中 | ReAct 循环在 Worker 中，LLM 自主选工具 |
| **任务队列** | 手动 SchedulerTask + 租约机制 | pg-boss（PostgreSQL 原生） |
| **状态管理** | 隐式（字符串条件分支） | 显式纯函数状态机（10 状态 15 事件） |
| **规划方式** | LLM 批量生成 N 个 MCP run 计划 | LLM 每步 function call，单工具逐步执行 |
| **数据模型** | 13 个 JSON 列在 ProjectDetail 中 | 规范化表（13 个模型，10 个枚举） |
| **状态值** | 中文字符串 `"运行中"` | TypeScript 枚举 `executing` |
| **MCP 连接器** | 10 个专用连接器 | 1 个通用 stdio 连接器 + 注册表 |
| **工具调用格式** | 自定义 JSON 结构 | 标准 OpenAI Function Calling |
| **错误处理** | `catch {}` 静默吞错 | 类型化 DomainError + 重试 |
| **代码量** | lib/ ~15,000 行 | lib/ ~7,700 行 |
| **可扩展性** | 不可能（状态在内存中） | 可水平扩展（无状态 Worker） |

### 3.2 V1 的根本问题

1. **HTTP 请求超时**: 5-30 分钟的渗透流程在单个 HTTP 请求中执行，超时后成为僵尸进程
2. **手动租约管理**: SchedulerTask 用时间戳 + UUID 管理租约，存在竞态条件
3. **无检查点**: 进程崩溃后无法恢复，项目卡在"运行中"
4. **JSON 列反模式**: 所有状态塞在 JSON 列中，无法查询优化
5. **同步执行**: `Promise.allSettled()` 在请求中等待所有工具完成
6. **LLM 流中断**: SSE 流断裂后 `completeLlmCallLog()` 永远不会被调用
7. **固定计划**: LLM 一次批量规划 N 个工具，无法根据中间结果动态调整

### 3.3 V2 如何解决

| V1 Bug / 限制 | V2 方案 |
|--------|---------|
| 调度任务卡在 "running" | pg-boss 自动检测停滞任务并重试 |
| LLM 日志卡在 "streaming" | Worker 启动时 `cleanupStale()` 清理超时日志 |
| 自动重规划崩溃 | 每个 job 独立；失败不传播 |
| 项目卡在 "运行中" | `round_completed` 任务始终运行，始终更新状态 |
| 工具结果丢失 | 每个 job 结果持久化到 DB 后才触发下一步 |
| 审批绕过 | `approveAction()` API 立即调度 `react_round` |
| 并发数据竞争 | Prisma 事务保证原子性 |
| 计划固化无法迭代 | ReAct 每步观察结果后决定下一步，完全自适应 |

### 3.4 V2 的当前限制

1. **无水平扩展测试**: 虽然架构支持多 Worker，但未实测
2. **能力推断**: `inferCapability()` 基于名称/描述模式匹配，新工具可能需要调整
3. **证据存储**: 原始输出存 DB 文本列，大文件应考虑对象存储
4. ~~**Finding 去重**: 跨轮次无内建去重机制~~ **[Phase 24b 已修复]** — normalizeTitle 模糊匹配去重
5. **可观测性**: MCP 工具执行已有完整日志（耗时/结果/错误），无 Prometheus 指标
6. **连接池**: 每个 MCP server 一个 stdio 进程，不支持并行工具调用

### 3.5 Phase 24b 稳定性修复 (2026-04-05)

| 问题 | 修复 |
|------|------|
| IPv6 连接超时 | `instrumentation.ts` 设置 `dns.setDefaultResultOrder("ipv4first")` |
| MCP 进程超时卡死 | stdio-connector RPC timeout 时 SIGKILL 子进程 |
| DB 连接池耗尽 | PrismaPg 配置 `max: 10, idleTimeoutMillis: 30000` |
| round_completed 不触发 | `updateStatus` 转 terminal 时自动检查并发布 |
| Finding 重复 | `normalizeTitle()` 模糊匹配（去除空格/标点/通用词差异） |
| 工具参数错误 | `buildToolInput` 增加 `rawRequest` 自动构造 |

---

## 4. 目录结构

```
lib/
├── domain/          # 纯领域逻辑（无 I/O）
│   ├── lifecycle.ts       # 状态机（10 状态 15 事件）
│   ├── phases.ts          # 渗透阶段定义
│   ├── risk-policy.ts     # 风险审批策略
│   ├── scope-policy.ts    # Scope 边界策略（自动扩展含护栏）
│   └── errors.ts          # 领域错误类型
│
├── infra/           # 基础设施
│   ├── prisma.ts          # Prisma 客户端
│   ├── job-queue.ts       # pg-boss 抽象
│   ├── event-bus.ts       # PostgreSQL NOTIFY
│   ├── pg-listener.ts     # LISTEN（SSE 用）
│   ├── auth.ts            # JWT 认证
│   └── api-handler.ts     # API 错误包装
│
├── workers/         # 4 个 Job Handler（planning/execution worker 已删除）
│   ├── react-worker.ts         # ReAct 循环主逻辑（处理 react_round）
│   ├── react-context.ts        # ReactContextManager（滑动窗口压缩）
│   ├── analysis-worker.ts      # LLM 提取 asset/finding（处理 analyze_result）
│   ├── verification-worker.ts  # LLM 生成 PoC（处理 verify_finding）
│   └── lifecycle-worker.ts     # Reviewer + 结算（处理 round_completed / settle_closure）
│
├── mcp/             # MCP 工具管理
│   ├── connector.ts       # 接口定义
│   ├── stdio-connector.ts # stdio JSON-RPC
│   ├── registry.ts        # 工具注册 + 能力推断
│   └── index.ts
│
├── llm/             # LLM 提供者
│   ├── provider.ts        # 抽象接口（含 OpenAIFunctionDef 类型）
│   ├── openai-provider.ts # OpenAI 兼容实现（支持 tools + tool_choice）
│   ├── call-logger.ts     # 调用日志装饰器
│   ├── prompts.ts         # Reviewer 等角色 prompt
│   ├── system-prompt.ts   # 文件加载系统提示（pentest-agent-prompt.md）
│   ├── react-prompt.ts    # ReAct system prompt 动态构建器
│   ├── function-calling.ts # MCP tools → OpenAI functions 转换 + 控制函数定义
│   ├── tool-input-mapper.ts # function call args → MCP tool input 映射
│   └── index.ts
│
├── services/        # 业务逻辑
│   ├── project-service.ts
│   ├── approval-service.ts
│   ├── mcp-bootstrap.ts
│   └── ...
│
├── repositories/    # 数据访问层
│   ├── project-repo.ts
│   ├── asset-repo.ts
│   ├── finding-repo.ts
│   ├── mcp-run-repo.ts
│   ├── mcp-tool-repo.ts
│   └── ...
│
└── hooks/           # React Hooks
    ├── use-project-events.ts  # SSE 项目事件订阅
    └── use-react-steps.ts     # ReAct 步骤实时展示（SSE）

worker.ts            # Worker 入口（注册 react_round / analyze_result / verify_finding /
                     #              round_completed / settle_closure）
middleware.ts         # JWT 认证中间件
mcps/                # MCP Server 集合
mcps/mcp-servers.json       # Server 清单
mcps/pentest-agent-prompt.md # LLM 通用渗透系统提示
```

---

## 5. API 端点

### 项目管理
| 方法 | 路由 | 功能 |
|------|------|------|
| GET | /api/projects | 项目列表 |
| POST | /api/projects | 创建项目 |
| GET | /api/projects/[id] | 项目详情 |
| POST | /api/projects/[id]/start | 启动渗透 |
| POST | /api/projects/[id]/stop | 停止渗透 |

### 项目数据
| 方法 | 路由 | 功能 |
|------|------|------|
| GET | /api/projects/[id]/assets | 资产列表 |
| GET | /api/projects/[id]/findings | 发现列表 |
| GET | /api/projects/[id]/evidence | 证据列表 |
| GET | /api/projects/[id]/mcp-runs | 执行记录 |
| GET | /api/projects/[id]/llm-logs | LLM 日志 |
| GET | /api/projects/[id]/orchestrator | 规划 & 轮次 |
| GET | /api/projects/[id]/events | SSE 实时事件 |
| GET | /api/projects/[projectId]/rounds/[round]/steps | ReAct 步骤查询 |

### 审批
| 方法 | 路由 | 功能 |
|------|------|------|
| GET | /api/projects/[id]/approvals | 待审批列表 |
| PUT | /api/approvals/[id] | 审批决策 |

### 设置
| 方法 | 路由 | 功能 |
|------|------|------|
| GET/POST | /api/settings/llm | LLM 配置 |
| GET/POST | /api/settings/mcp/servers | MCP 服务器管理 |
| POST | /api/settings/mcp/sync | 触发工具发现 |

### 认证
| 方法 | 路由 | 功能 |
|------|------|------|
| POST | /api/auth/login | 登录（JWT cookie） |
| POST | /api/auth/logout | 登出 |

---

## 6. MCP 工具清单 (38 个工具)

| Server | 工具名 | 能力族 | 描述 |
|--------|--------|--------|------|
| **fscan** (v2.0) | fscan_host_discovery | host_discovery | 主机存活探测 |
| | fscan_port_scan | port_scan | 端口扫描 + 服务识别 |
| | fscan_service_bruteforce | credential_test | 服务弱口令爆破 |
| | fscan_vuln_scan | vuln_scan | 已知漏洞扫描 (MS17-010 等) |
| | fscan_web_scan | vuln_scan | Web POC 扫描 |
| | fscan_full_scan | port_scan | 综合扫描 |
| **subfinder** | subfinder_enum | dns_subdomain | 被动子域名枚举 |
| | subfinder_verify | dns_subdomain | 子域名枚举 + DNS 验证 |
| **httpx** | httpx_probe | host_discovery | Web 存活探测 |
| | httpx_tech_detect | fingerprint | 技术栈识别 |
| **curl** | http_request | http_interaction | 自定义 HTTP 请求 |
| | http_raw_request | http_interaction | 原始 TCP 发送 HTTP 包 |
| | http_batch | http_interaction | 批量 HTTP 请求 |
| **netcat** | tcp_connect | tcp_interaction | TCP 连接 + 数据收发 |
| | udp_send | tcp_interaction | UDP 发送 |
| | tcp_banner_grab | tcp_interaction | TCP Banner 抓取 |
| **afrog** | afrog_scan | vuln_scan | POC 漏洞扫描 |
| | afrog_list_pocs | vuln_scan | 列出可用 POC |
| **dirsearch** | dirsearch_scan | web_crawl | 目录/文件扫描 |
| | dirsearch_recursive | web_crawl | 递归目录扫描 |
| **fofa** | fofa_search | external_intel | FOFA 资产搜索 |
| | fofa_host | external_intel | FOFA 主机详情 |
| | fofa_stats | external_intel | FOFA 统计 |
| **whois** | whois_query | dns_whois | 域名 WHOIS |
| | whois_ip | dns_whois | IP WHOIS |
| | icp_query | dns_whois | ICP 备案查询 |
| **encode** | encode_decode | crypto_tool | 编解码 (base64/hex/URL 等) |
| | hash_compute | crypto_tool | 哈希计算 |
| | crypto_util | crypto_tool | 加解密 + JWT 解析 |
| **wafw00f** | wafw00f_detect | waf_detection | WAF 检测 |
| | wafw00f_list | waf_detection | WAF 列表 |
| **github-recon** | github_code_search | external_intel | GitHub 代码泄露搜索 |
| | github_repo_search | external_intel | GitHub 仓库搜索 |
| | github_commit_search | external_intel | GitHub 提交搜索 |
| **script** | execute_code | code_execution | 执行 Node.js 代码 |
| | execute_command | code_execution | 执行 shell 命令 |
| | read_file | file_io | 读取文件 |
| | write_file | file_io | 写入文件 |

在 ReAct 模型中，全部 38 个工具加上 `done` 和 `report_finding` 两个控制函数，以标准 OpenAI `functions` 数组形式传递给 LLM，LLM 按需调用，无需预先规划。

---

## 7. 渗透流程（ReAct 生命周期）

```
用户创建项目 → POST /api/projects
     ↓
用户启动 → POST /api/projects/{id}/start
     ↓
idle → executing  (START_REACT，直接跳过 planning)
     ↓
┌─ ReAct Worker 启动第 N 轮循环 ─────────────────────────────┐
│                                                             │
│  for step in 0..30:                                         │
│    LLM function calling (38 MCP 工具 + done + report_finding) │
│    ├─ 调用 MCP 工具 → 存储 McpRun → 结果注入上下文         │
│    │    └─ 成功 → 异步发布 analyze_result                   │
│    ├─ report_finding → 直接写 Finding，continue             │
│    ├─ done(summary, phase_suggestion) → 结束循环            │
│    ├─ 超出 scope → 注入失败结果，continue                   │
│    └─ 每步发布 react_step_completed SSE 事件                │
│                                                             │
│  循环结束 → 等待挂起分析（≤30s） → 发布 round_completed     │
└──────────────────────────────────────────────────────────────┘
     ↓
executing → reviewing  (ALL_DONE)
     ↓
┌─ Lifecycle Worker：LLM Reviewer 审阅本轮结果 ─────────────┐
│  ├─ continue → reviewing → executing (CONTINUE_REACT)       │
│  │    └─ 发布 react_round(round+1)                          │
│  └─ settle（或达到 maxRounds）→ reviewing → settling (SETTLE)│
│       └─ 发布 settle_closure                                │
└──────────────────────────────────────────────────────────────┘
     ↓（并行进行）
┌─ Analysis Worker：LLM 提取 asset/finding ─────────────────┐
│  └─ 非 info → 发布 verify_finding                           │
└──────────────────────────────────────────────────────────────┘
     ↓
┌─ Verification Worker：LLM 生成 PoC → 执行 ───────────────┐
│  └─ verified / false_positive                               │
└──────────────────────────────────────────────────────────────┘
     ↓（最终）
settle_closure → 生成报告 → settling → completed
     ↓
实时事件全程通过 SSE 推送到前端
（react_step_started / react_step_completed / react_round_completed /
 round_reviewed / project_completed 等）
```

### 与旧流程的关键区别

| 旧流程（Plan+Execute） | 新流程（ReAct） |
|------|------|
| LLM 一次生成 N 个工具执行计划 | LLM 每步调用一个工具，实时观察结果 |
| `plan_round` + `execute_tool` 两个独立 job | 单一 `react_round` job 内完成全部步骤 |
| 工具并行执行 | 工具顺序执行（保证 LLM 能观察每步结果） |
| idle → planning → executing | idle → executing（直接，跳过 planning） |
| 固定计划，无法中途调整 | 每步根据上一步结果动态决策 |
| Planner + Executor 两个 Worker | 单一 ReAct Worker |
```
