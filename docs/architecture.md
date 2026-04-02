# 平台架构设计

> 最后更新: 2026-04-02

---

## 核心设计思想

```
LLM = 大脑    → 理解目标、规划动作、判断停止条件、审阅结论
MCP = 四肢    → 14 个服务器、36+ 工具，负责与外部目标的所有交互
平台 = 中枢   → 审批控制、任务调度、数据持久化、结果归一化、项目管理
```

LLM 永远不会直接接触目标。它只输出 JSON 计划（capability + target + requestedAction），平台将计划翻译成 MCP 工具调用。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Next.js 15 (App Router) + React 19 + TypeScript + TailwindCSS + shadcn/ui |
| API | Next.js API Routes (48 路由) |
| 数据层 | PostgreSQL 16 + Prisma 7.x (@prisma/adapter-pg) |
| LLM | OpenAI-compatible API (支持 DeepSeek/GPT/Claude 等) |
| MCP | @modelcontextprotocol/sdk, 14 个 stdio 服务器 |
| 测试 | Vitest (单元) + Playwright (E2E) |

---

## 分层架构

```
┌─────────────────────────────────────────────────┐
│                  UI Layer                        │
│  Pages (25) + Components (100+) + shadcn/ui      │
├─────────────────────────────────────────────────┤
│                  API Layer                        │
│  48 API Routes (auth, projects, approvals, etc.) │
├─────────────────────────────────────────────────┤
│              Composition Layer                    │
│  dashboard / project / settings / control         │
│  (聚合查询，组合多个 repository 调用)              │
├─────────────────────────────────────────────────┤
│               Service Layer                       │
│  Orchestrator │ Scheduler │ MCP Gateway │ LLM    │
├─────────────────────────────────────────────────┤
│              Repository Layer                     │
│  13 个 Repository (project, asset, evidence, ...) │
│  Prisma ORM + prisma-transforms.ts               │
├─────────────────────────────────────────────────┤
│                Data Layer                         │
│  PostgreSQL 16 (25 数据模型)                      │
└─────────────────────────────────────────────────┘
```

---

## 核心模块

### 编排器（Orchestrator）— 6 个文件

| 文件 | 职责 |
|------|------|
| `orchestrator-service.ts` | 主入口：生命周期启动、多轮循环、收尾 |
| `orchestrator-plan-builder.ts` | LLM 计划生成、归一化、持久化 |
| `orchestrator-execution.ts` | 计划执行、轮次记录、续跑判断（7个停止条件）|
| `orchestrator-context-builder.ts` | 上下文构建（失败摘要、target 格式约束）|
| `orchestrator-target-scope.ts` | 范围过滤（防止越界） |
| `orchestrator-local-lab.ts` | Docker 靶场集成 |

### MCP 调度 — 3 层

```
project-mcp-dispatch-service.ts  项目级入口（含 drain 超时保护）
         ↓
gateway/mcp-dispatch-service.ts  调度网关（审批路由、风险分流）
         ↓
mcp-scheduler-service.ts         任务队列（租约、心跳、重试、并发控制）
```

### MCP 执行 — 连接器模式

```
execution-runner.ts              单任务执行管线
         ↓
mcp-connectors/registry.ts      连接器注册表
         ↓
stdio-mcp-connector.ts          通用 stdio 连接器（JSON-RPC 双向通信）
real-dns-intelligence-connector  DNS 情报连接器
real-http-structure-connector    HTTP 结构连接器
real-http-validation-connector   HTTP 验证连接器
local-foundational-connectors    本地基础连接器
```

### 结果归一化

```
mcp-execution-service.ts         主入口：normalizeExecutionArtifacts + normalizeStdioMcpArtifacts
                                 按工具类型分派，含 execute_code stdout 提取和 JSON 漏洞解析
artifact-normalizer.ts           辅助函数（当前未被 import）
artifact-normalizer-stdio.ts     辅助函数（当前未被 import）
```

### LLM 集成 — 3 个 Prompt 模板

| 模板 | 用途 | temperature |
|------|------|-------------|
| `ORCHESTRATOR_BRAIN_SYSTEM_PROMPT` | 编排规划 | 0.2 |
| `REVIEWER_BRAIN_SYSTEM_PROMPT` | 结果审阅 | 0.1 |
| `buildMultiRoundBrainPrompt()` | 多轮续跑 | 0.2 |

---

## 数据模型（25 个）

### 项目相关
- `Project` — 项目主体（name, targets, stage, status）
- `ProjectDetail` — 项目详情 JSON（timeline, tasks, activity, metrics）
- `ProjectConclusion` — 最终结论（summary, keyPoints, nextActions）
- `ProjectSchedulerControl` — 调度控制（lifecycle, maxRounds, autoReplan）
- `ProjectFormPreset` — 项目模板

### 结果相关
- `Asset` — 资产（域名/IP/端口/Web入口/服务）
- `Evidence` — 证据（工具原始输出、置信度）
- `Finding` — 漏洞/安全发现（严重性、受影响面）

### MCP 相关
- `McpTool` / `McpServer` — 工具和服务器注册
- `McpToolContract` / `McpServerContract` — 工具契约
- `OrchestratorPlan` — AI 计划（items JSON）
- `OrchestratorRound` — 轮次记录（执行指标、反思）
- `SchedulerTask` — 调度任务（租约、重试、状态）

### 审批
- `Approval` — 审批记录（status, riskLevel, rationale）
- `ApprovalPolicy` / `ScopeRule` — 审批策略
- `GlobalApprovalControl` — 全局审批开关

### 系统
- `User` — 用户（account, role, status）
- `LlmProfile` — LLM 配置
- `LlmCallLog` — LLM 调用日志
- `AuditLog` / `WorkLog` — 审计日志

---

## 安全设计

| 层面 | 机制 |
|------|------|
| 认证 | HMAC 签名的 session cookie (`auth-session.ts`) |
| CSRF | 双重提交 Cookie (`csrf.ts`) |
| 速率限制 | 滑动窗口：登录 5/min, API 60/min (`rate-limit.ts`) |
| 审批 | 高风险动作需人工审批，低风险自动通过 |
| 范围控制 | `filterPlanItemsToProjectScope()` 防止 LLM 越界 |
| 工具边界 | MCP 工具按 boundary 分类（外部交互/平台内部/只读） |
| 超时保护 | drain 超时 120s、LLM 超时 180s、工具超时可配置 |

---

## MCP 工具矩阵

| 服务器 | 工具数 | 能力 |
|--------|--------|------|
| httpx-mcp-server | 3 | Web 探测、技术栈识别 |
| dirsearch-mcp-server | 2 | 目录枚举 |
| subfinder-mcp-server | 2 | 子域发现 |
| fscan-mcp-server | 3 | 端口扫描 |
| wafw00f-mcp-server | 2 | WAF 识别 |
| curl-mcp-server | 2 | HTTP 请求 |
| netcat-mcp-server | 2 | TCP 交互 |
| script-mcp-server | 4 | 代码执行 (execute_code/execute_command) |
| afrog-mcp-server | 2 | 漏洞扫描 |
| fofa-mcp-server | 2 | 情报查询 |
| github-recon-mcp-server | 2 | GitHub 信息采集 |
| whois-mcp-server | 1 | WHOIS 查询 |
| encode-mcp-server | 4 | 编解码工具 |
| (内置) | 2 | 种子解析 + 报告导出 |

---

## 项目生命周期状态机

```
                    ┌──────── paused ◄──────┐
                    │                       │
idle ──→ running ──┤                       ├──→ completed
                    │                       │
                    └──────→ stopped ────────┘
```

### 项目阶段流转

```
种子目标接收 → 持续信息收集 → 目标关联与范围判定 → 发现与指纹识别
→ 待验证项生成 → 审批前排队 → 受控 PoC 验证 → 证据归档与结果判定
→ 风险聚合与项目结论 → 报告与回归验证
```
