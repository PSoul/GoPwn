# LLM 渗透测试平台 v2 后端重写设计规格

> 日期: 2026-04-04
> 状态: 待审阅

---

## 一、产品定位

一个以 LLM 为大脑、MCP 工具为四肢的**持久化安全评估平台**。与传统漏扫平台的区别：LLM 替代固定规则引擎做决策，因此能覆盖更多攻击面、降低误报漏报率。与 Strix 等 CLI 扫描工具的区别：我们提供完整的项目管理、审批门控、资产积累和持久化证据链。

核心用户：安全研究员 / 渗透测试员（单人或小团队）。

---

## 二、核心概念模型

### 2.1 五大实体

```
Target（输入目标）
  └─▶ Asset（发现的资产，树状结构）
        ├─▶ Evidence（工具原始输出 + 截图）
        └─▶ Finding（安全问题）
              └─▶ PoC（可复现的漏洞验证）
```

| 实体 | 定义 | 生命周期 |
|------|------|---------|
| **Target** | 用户输入的测试目标（域名/IP/URL/CIDR） | 项目创建时写入，不可变 |
| **Asset** | 从目标发现的可交互资源 | 持续发现，跨项目可复用 |
| **Evidence** | 工具执行的原始输出、截图、HTTP 响应包 | 工具执行后自动生成 |
| **Finding** | 一个具体的安全问题（含严重性、影响、修复建议） | suspected → verified / false_positive |
| **PoC** | 可复现的漏洞验证代码 + 执行结果 | Finding 的验证产物 |

### 2.2 资产树模型

资产是树状结构，体现渗透测试中从目标到具体漏洞的发现链路：

```
项目目标: example.com
├─ [domain] example.com
│   ├─ [subdomain] admin.example.com
│   │   └─ [ip] 1.2.3.4
│   │       └─ [port] 443/tcp
│   │           └─ [service] nginx/1.24
│   │               └─ [webapp] /admin (后台管理)
│   │                   ├─ [api_endpoint] POST /admin/api/login
│   │                   └─ Finding: SQL 注入 (verified, PoC 附带)
│   └─ [subdomain] api.example.com
│       └─ [ip] 1.2.3.5
│           └─ [port] 8080/tcp
│               └─ [service] Spring Boot 3.2
│                   └─ Finding: Actuator 未授权 (verified)
└─ [domain] example.org (关联域名)
    └─ ...
```

**AssetKind 枚举**：

| Kind | 说明 | 典型父级 | 典型指纹 |
|------|------|---------|---------|
| `domain` | 根域名 | (无，顶级) | WHOIS, NS 记录 |
| `subdomain` | 子域名 | domain | CNAME, A 记录 |
| `ip` | IP 地址 | subdomain / domain | 地理位置, ASN |
| `port` | 开放端口 | ip | 协议 (TCP/UDP) |
| `service` | 运行的服务 | port | 产品名, 版本号 |
| `webapp` | Web 应用 / 站点入口 | service | 框架, CMS, WAF |
| `api_endpoint` | API 端点 | webapp | 方法, 参数, 认证方式 |

前端展示：资产列表页 + 树状展开视图，用户可以沿树结构浏览从域名到具体端点的完整攻击面。

### 2.3 Finding + PoC 生命周期

```
                    LLM 分析工具输出
                         │
                         ▼
                    ┌──────────┐
                    │ suspected │  ← LLM 认为可能存在漏洞
                    └─────┬────┘
                          │ LLM 生成 PoC 代码
                          ▼
                    ┌──────────┐
                    │ verifying │  ← PoC 在沙箱中执行
                    └─────┬────┘
                     ╱         ╲
                    ▼           ▼
            ┌──────────┐  ┌───────────────┐
            │ verified  │  │ false_positive │
            │ (已确认)  │  │  (误报)        │
            └──────────┘  └───────────────┘
                 │
                 ▼ (人工复核后)
            ┌──────────┐
            │ remediated│  ← 已修复
            └──────────┘
```

**关键设计**：
- `suspected` 状态的 Finding 是 LLM 从工具输出中提取的疑似问题
- 系统自动为 suspected Finding 生成 PoC（LLM 编写验证代码）
- PoC 在 MCP 工具（execute_code）中执行，结果决定 Finding 升级为 `verified` 或降级为 `false_positive`
- 只有 `verified` 的 Finding 出现在最终报告和仪表盘中
- `false_positive` 保留记录（含 PoC 尝试过程），方便审计

**PoC 记录结构**：

```typescript
type PocRecord = {
  id: string
  findingId: string
  code: string          // LLM 生成的验证代码
  language: "javascript" | "python" | "http"  // 代码类型
  executionOutput: string  // 执行结果
  succeeded: boolean       // 是否成功复现
  executedAt: Date
  mcpRunId: string        // 关联的 MCP 执行记录
}
```

### 2.4 Evidence 设计

Evidence 是工具执行的原始产物，是 Finding 的证据支撑：

```typescript
type EvidenceRecord = {
  id: string
  mcpRunId: string        // 产生此证据的 MCP 执行
  assetId: string         // 关联的资产
  title: string           // 证据标题
  toolName: string        // 产生证据的工具
  rawOutput: string       // 工具原始输出（全文）
  summary: string         // LLM 生成的摘要
  artifactPaths: string[] // 截图、HTML 快照等文件路径
  capturedUrl?: string    // 被测 URL
  createdAt: Date
}
```

Evidence 不直接暴露在 UI 主导航，而是从 Finding 详情页链接过去："查看原始证据"。

---

## 三、渗透测试阶段模型

### 3.1 五阶段流程

| 阶段 | 英文 | LLM 的目标 | 主要 MCP 能力族 |
|------|------|-----------|----------------|
| 1. 信息收集 | `recon` | 收集目标相关的所有公开信息 | DNS/子域枚举、证书透明度、WHOIS、端口扫描 |
| 2. 攻击面发现 | `discovery` | 发现所有可交互的入口和服务 | Web 爬虫、目录扫描、API 发现、服务指纹识别 |
| 3. 漏洞评估 | `assessment` | 识别潜在安全问题 | 漏洞扫描、配置检查、HTTP 交互测试 |
| 4. 漏洞验证 | `verification` | 生成 PoC 验证疑似漏洞 | execute_code、浏览器自动化、TCP 交互 |
| 5. 报告生成 | `reporting` | 生成结构化渗透测试报告 | 截图采集、报告导出 |

**阶段不是严格线性的**：LLM 可以在 discovery 阶段发现新子域后回到 recon 做进一步收集，也可以在 assessment 阶段直接验证明显的漏洞。阶段更像是"当前重心"，而不是硬性门控。

### 3.2 LLM 多轮编排

每一轮 LLM 规划是一个独立的 job：

```
Round 1 (recon):     LLM 看到目标 → 规划 DNS 枚举 + 端口扫描
Round 2 (recon):     LLM 看到端口结果 → 规划服务指纹识别
Round 3 (discovery): LLM 看到 Web 服务 → 规划目录扫描 + API 发现
Round 4 (assessment):LLM 看到 API 端点 → 规划 SQL 注入 + 认证测试
Round 5 (verification): LLM 发现疑似 SQLi → 生成 PoC 代码验证
```

LLM 在每轮结束时决定：
- 当前阶段是否还需要更多轮次
- 是否推进到下一阶段
- 是否回退到之前的阶段（发现了新资产）
- 是否结束（所有 Finding 已验证）

最大轮次：可配置，默认 10 轮。

---

## 四、技术架构

### 4.1 技术选型（已确认）

| 组件 | 选择 | 理由 |
|------|------|------|
| 框架 | Next.js 15 (App Router) | 复用前端 |
| 任务队列 | pg-boss (PostgreSQL) | 无额外依赖，接口抽象可换 BullMQ |
| 事件总线 | PostgreSQL LISTEN/NOTIFY | 配合 pg-boss，零新依赖 |
| 状态机 | 纯函数转换表 | 轻量，不引入 XState |
| 认证 | JWT + httpOnly + SameSite=Strict | 无 CSRF，便于测试 |
| 数据库 | PostgreSQL 16 + Prisma 7 | 保持不变 |

### 4.2 进程架构

```
┌─────────────────────────────────────────────┐
│              Next.js 进程                     │
│  API Route (短请求 <5s) + SSR + SSE          │
│  职责: 验证、查询、命令下发、SSE 转发          │
└──────────────────┬──────────────────────────┘
                   │ pg-boss job 投递
                   │ LISTEN/NOTIFY 事件
┌──────────────────┴──────────────────────────┐
│           Worker 进程 (可多实例)               │
│  pg-boss Worker 消费 job                      │
│  职责: LLM 调用、MCP 工具执行、结果分析        │
└─────────────────────────────────────────────┘
```

### 4.3 Job 类型

| Job | 输入 | 执行内容 | 后续 |
|-----|------|---------|------|
| `plan_round` | projectId, round | 调用 LLM 生成计划 | 投递 N 个 execute_tool |
| `execute_tool` | projectId, mcpRunId | 调用 MCP 工具 | 投递 analyze_result |
| `analyze_result` | projectId, mcpRunId, rawOutput | LLM 分析输出，提取 Asset/Evidence/Finding | 如有 suspected Finding → 投递 verify_finding |
| `verify_finding` | projectId, findingId | LLM 生成 PoC → execute_code 执行 → 更新 Finding 状态 | (无) |
| `round_completed` | projectId, round | 检查本轮所有 job 完成，决定下一步 | 投递 plan_round 或 settle_closure |
| `settle_closure` | projectId | LLM reviewer 生成报告 | 更新 lifecycle = completed |

### 4.4 项目生命周期状态机

```typescript
const TRANSITIONS = {
  idle:      { START: "planning" },
  planning:  { PLAN_READY: "executing", PLAN_FAILED: "failed", STOP: "stopping" },
  executing: { ALL_DONE: "reviewing", APPROVAL_NEEDED: "waiting_approval", STOP: "stopping" },
  waiting_approval: { RESOLVED: "executing", STOP: "stopping" },
  reviewing: { CONTINUE: "planning", SETTLE: "settling", STOP: "stopping" },
  settling:  { SETTLED: "completed", FAILED: "failed" },
  stopping:  { STOPPED: "stopped" },
  completed: {},  // 终态
  stopped:   {},  // 终态
  failed:    { RETRY: "planning", STOP: "stopping" },
} as const
```

---

## 五、数据库 Schema

### 5.1 枚举定义

```prisma
enum ProjectLifecycle {
  idle
  planning
  executing
  waiting_approval
  reviewing
  settling
  stopping
  stopped
  completed
  failed
}

enum PentestPhase {
  recon
  discovery
  assessment
  verification
  reporting
}

enum AssetKind {
  domain
  subdomain
  ip
  port
  service
  webapp
  api_endpoint
}

enum FindingStatus {
  suspected
  verifying
  verified
  false_positive
  remediated
}

enum Severity {
  critical
  high
  medium
  low
  info
}

enum RiskLevel {
  low
  medium
  high
}

enum ApprovalStatus {
  pending
  approved
  rejected
  deferred
}

enum McpRunStatus {
  pending
  scheduled
  running
  succeeded
  failed
  cancelled
}

enum LlmCallStatus {
  streaming
  completed
  failed
}
```

### 5.2 核心模型

```prisma
// ── 项目 ──

model Project {
  id            String           @id @default(cuid())
  code          String           @unique
  name          String
  description   String           @default("")
  lifecycle     ProjectLifecycle @default(idle)
  currentPhase  PentestPhase     @default(recon)
  currentRound  Int              @default(0)
  maxRounds     Int              @default(10)
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  targets       Target[]
  assets        Asset[]
  evidence      Evidence[]
  findings      Finding[]
  mcpRuns       McpRun[]
  approvals     Approval[]
  plans         OrchestratorPlan[]
  rounds        OrchestratorRound[]
  llmCallLogs   LlmCallLog[]
  auditEvents   AuditEvent[]

  @@map("projects")
}

model Target {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  value       String
  type        String   // domain | ip | cidr | url
  normalized  String
  createdAt   DateTime @default(now())

  @@unique([projectId, type, normalized])
  @@map("targets")
}

// ── 资产树 ──

model Asset {
  id          String    @id @default(cuid())
  projectId   String
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  parentId    String?
  parent      Asset?    @relation("AssetTree", fields: [parentId], references: [id])
  children    Asset[]   @relation("AssetTree")

  kind        AssetKind
  value       String    // 标准化值 (e.g. "admin.example.com", "1.2.3.4", "443/tcp")
  label       String    // 显示标签
  confidence  Float     @default(0)
  firstSeenAt DateTime  @default(now())
  lastSeenAt  DateTime  @default(now())
  metadata    Json      @default("{}")  // 仅用于不确定结构的扩展

  fingerprints Fingerprint[]
  evidence     Evidence[]
  findings     Finding[]

  @@unique([projectId, kind, value])
  @@index([projectId, kind])
  @@map("assets")
}

model Fingerprint {
  id         String   @id @default(cuid())
  assetId    String
  asset      Asset    @relation(fields: [assetId], references: [id], onDelete: Cascade)
  category   String   // protocol | product | version | framework | os | waf
  value      String
  source     String   // 产生此指纹的工具名
  confidence Float    @default(0)
  observedAt DateTime @default(now())

  @@index([assetId])
  @@map("fingerprints")
}

// ── 证据 ──

model Evidence {
  id             String   @id @default(cuid())
  projectId      String
  project        Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assetId        String?
  asset          Asset?   @relation(fields: [assetId], references: [id])
  mcpRunId       String?
  mcpRun         McpRun?  @relation(fields: [mcpRunId], references: [id])

  title          String
  toolName       String
  rawOutput      String   @default("")
  summary        String   @default("")
  artifactPaths  String[] @default([])
  capturedUrl    String?
  createdAt      DateTime @default(now())

  findings       Finding[]

  @@index([projectId])
  @@map("evidence")
}

// ── 漏洞 + PoC ──

model Finding {
  id              String        @id @default(cuid())
  projectId       String
  project         Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assetId         String?
  asset           Asset?        @relation(fields: [assetId], references: [id])
  evidenceId      String?
  evidence        Evidence?     @relation(fields: [evidenceId], references: [id])

  status          FindingStatus @default(suspected)
  severity        Severity      @default(info)
  title           String
  summary         String        @default("")
  affectedTarget  String        @default("")  // URL / IP:port
  recommendation  String        @default("")
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  pocs            Poc[]

  @@index([projectId, status])
  @@index([projectId, severity])
  @@map("findings")
}

model Poc {
  id              String   @id @default(cuid())
  findingId       String
  finding         Finding  @relation(fields: [findingId], references: [id], onDelete: Cascade)
  mcpRunId        String?
  mcpRun          McpRun?  @relation(fields: [mcpRunId], references: [id])

  code            String        // LLM 生成的验证代码
  language        String        // javascript | python | http
  executionOutput String        @default("")
  succeeded       Boolean       @default(false)
  executedAt      DateTime?
  createdAt       DateTime      @default(now())

  @@index([findingId])
  @@map("pocs")
}

// ── MCP 执行 ──

model McpRun {
  id              String       @id @default(cuid())
  projectId       String
  project         Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  toolId          String?
  tool            McpTool?     @relation(fields: [toolId], references: [id])

  capability      String
  toolName        String
  target          String
  requestedAction String
  riskLevel       RiskLevel
  status          McpRunStatus @default(pending)
  phase           PentestPhase
  round           Int

  pgBossJobId     String?      @unique
  rawOutput       String?
  error           String?
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  approval        Approval?
  evidence        Evidence[]
  pocs            Poc[]

  @@index([projectId, status])
  @@map("mcp_runs")
}

model McpTool {
  id               String    @id @default(cuid())
  serverName       String
  toolName         String    @unique
  capability       String
  boundary         String    @default("external")
  riskLevel        RiskLevel @default(medium)
  requiresApproval Boolean   @default(false)
  description      String    @default("")
  inputSchema      Json      @default("{}")
  enabled          Boolean   @default(true)
  timeout          Int       @default(60000)

  mcpRuns          McpRun[]

  @@map("mcp_tools")
}

model McpServer {
  id             String   @id @default(cuid())
  serverName     String   @unique
  transport      String   // stdio | streamable_http
  command        String?
  args           String[] @default([])
  endpoint       String?
  enabled        Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@map("mcp_servers")
}

// ── 审批 ──

model Approval {
  id           String         @id @default(cuid())
  projectId    String
  project      Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  mcpRunId     String         @unique
  mcpRun       McpRun         @relation(fields: [mcpRunId], references: [id])

  target       String
  actionType   String
  riskLevel    RiskLevel
  rationale    String         @default("")
  status       ApprovalStatus @default(pending)
  decidedAt    DateTime?
  decisionNote String         @default("")
  createdAt    DateTime       @default(now())

  @@index([projectId, status])
  @@map("approvals")
}

// ── 编排 ──

model OrchestratorPlan {
  id        String       @id @default(cuid())
  projectId String
  project   Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  round     Int
  phase     PentestPhase
  provider  String
  summary   String       @default("")
  items     Json         @default("[]")
  createdAt DateTime     @default(now())

  @@unique([projectId, round])
  @@map("orchestrator_plans")
}

model OrchestratorRound {
  id             String       @id @default(cuid())
  projectId      String
  project        Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  round          Int
  phase          PentestPhase
  status         String       @default("planning")  // planning | executing | completed | failed
  planItemCount  Int          @default(0)
  executedCount  Int          @default(0)
  newAssetCount  Int          @default(0)
  newFindingCount Int         @default(0)
  startedAt      DateTime     @default(now())
  completedAt    DateTime?

  @@unique([projectId, round])
  @@map("orchestrator_rounds")
}

// ── LLM 日志 ──

model LlmCallLog {
  id          String        @id @default(cuid())
  projectId   String
  project     Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  role        String        // planner | reviewer | analyzer
  phase       String        // planning | reviewing | analyzing | verifying
  prompt      String
  response    String        @default("")
  status      LlmCallStatus @default(streaming)
  model       String        @default("")
  provider    String        @default("")
  durationMs  Int?
  error       String?
  createdAt   DateTime      @default(now())

  @@index([projectId, status])
  @@map("llm_call_logs")
}

// ── 审计 ──

model AuditEvent {
  id        String   @id @default(cuid())
  projectId String?
  project   Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
  category  String
  action    String
  actor     String
  detail    String   @default("")
  createdAt DateTime @default(now())

  @@index([projectId])
  @@map("audit_events")
}

// ── 配置 ──

model LlmProfile {
  id          String  @id  // planner | reviewer | analyzer
  provider    String  @default("openai-compatible")
  apiKey      String  @default("")
  baseUrl     String  @default("")
  model       String  @default("")
  timeoutMs   Int     @default(120000)
  temperature Float   @default(0.2)

  @@map("llm_profiles")
}

model GlobalConfig {
  id                    String  @id @default("global")
  approvalEnabled       Boolean @default(true)
  autoApproveLowRisk    Boolean @default(true)
  autoApproveMediumRisk Boolean @default(true)

  @@map("global_config")
}

model User {
  id          String   @id @default(cuid())
  account     String   @unique
  password    String
  displayName String
  role        String   @default("researcher")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("users")
}
```

---

## 六、后端分层架构

```
app/api/              → 请求验证 + 命令/查询分发（<30 行/文件）
lib/services/         → 业务逻辑编排（查询聚合、命令投递）
lib/repositories/     → Prisma CRUD（纯数据访问，无业务逻辑）
lib/workers/          → pg-boss job 处理函数（长任务执行）
lib/mcp/              → MCP 连接器 + 工具注册
lib/llm/              → LLM provider + prompt + call logger
lib/domain/           → 状态机、风险策略、阶段定义、错误类型
lib/infra/            → Prisma client、pg-boss、事件总线、API 工具函数
lib/types/            → TypeScript 类型（从 Prisma 生成 + 扩展）
```

### 6.1 API Route 设计原则

- **GET** = 直接查 Prisma 返回数据
- **POST/PUT/DELETE** = 写 DB + 投递 job → 返回 202
- **每个 route 文件 < 30 行**，逻辑在 service 层

### 6.2 Worker 设计原则

- 每个 job 必须**幂等**（相同输入执行两次不产生副作用）
- 每个 job 有**超时**（pg-boss 原生支持）
- 失败自动**重试**（指数退避）
- Worker 启动时**清理 stale 数据**（stuck streaming、orphan running）

### 6.3 队列接口抽象

```typescript
// lib/infra/job-queue.ts
export interface JobQueue {
  publish(jobName: string, data: unknown, options?: JobOptions): Promise<string>
  subscribe(jobName: string, handler: (data: unknown) => Promise<void>): void
}

// pg-boss 实现
export function createPgBossJobQueue(boss: PgBoss): JobQueue { ... }

// 未来可替换为 BullMQ 实现
// export function createBullMQJobQueue(redis: Redis): JobQueue { ... }
```

---

## 七、MCP 协议复用

### 7.1 不变的部分

- MCP Server 注册合同（JSON 格式）
- MCP 工具能力族分类
- 外部 MCP Server 仓库（llmpentest-mcp-template）
- @modelcontextprotocol/sdk

### 7.2 简化的连接器

当前 10 个连接器文件 → 3 个：

| 连接器 | 用途 |
|--------|------|
| `stdio-connector.ts` | 通用 stdio MCP Server 连接 |
| `http-connector.ts` | streamable HTTP MCP Server 连接 |
| `builtin-connector.ts` | 内置工具（seed-normalizer, capture-evidence, report-exporter） |

### 7.3 连接器接口

```typescript
export interface McpConnector {
  execute(input: ToolExecutionInput): Promise<ToolExecutionResult>
  healthCheck(): Promise<{ healthy: boolean; error?: string }>
  dispose(): Promise<void>
}

export type ToolExecutionResult =
  | { status: "succeeded"; rawOutput: string; structured?: unknown }
  | { status: "failed"; error: string; retryable: boolean }
  | { status: "aborted" }
```

---

## 八、LLM 三角色架构

| 角色 | 新名称 | 职责 | 输出 |
|------|--------|------|------|
| Planner | `planner` | 规划每轮的工具调用 | OrchestratorPlanItem[] |
| Analyzer | `analyzer` | 分析工具输出，提取资产/证据/疑似漏洞 | Asset[] + Evidence[] + Finding(suspected)[] |
| Reviewer | `reviewer` | 项目结束时生成报告和结论 | 结构化报告 JSON |

新增职责：
- **Analyzer** 新增：对 suspected Finding 生成 PoC 代码（verify_finding job 中调用）
- **Planner** 新增：在规划中标注当前 phase，以及是否需要回退到之前的 phase

---

## 九、前端适配策略

### 9.1 状态映射表

后端返回 enum string，前端统一映射：

```typescript
// lib/types/labels.ts
export const LIFECYCLE_LABELS: Record<ProjectLifecycle, string> = {
  idle: "待启动",
  planning: "规划中",
  executing: "执行中",
  waiting_approval: "等待审批",
  reviewing: "回顾中",
  settling: "收尾中",
  stopping: "停止中",
  stopped: "已停止",
  completed: "已完成",
  failed: "失败",
}

export const FINDING_STATUS_LABELS: Record<FindingStatus, string> = {
  suspected: "疑似",
  verifying: "验证中",
  verified: "已确认",
  false_positive: "误报",
  remediated: "已修复",
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "严重",
  high: "高危",
  medium: "中危",
  low: "低危",
  info: "信息",
}
```

### 9.2 新增前端页面/组件

| 页面/组件 | 说明 |
|----------|------|
| 资产树视图 | Asset 列表 + 树状展开 |
| Finding 详情页 | 含 PoC 代码查看 + 执行结果 + 原始证据链接 |
| PoC 验证面板 | 显示 PoC 执行过程和结果 |

### 9.3 保留的前端

所有 shadcn/ui 组件、主题、布局、登录页、设置页结构不变。

---

## 十、认证方案

- 登录: `POST /api/auth/login` → 验证密码 → 签发 JWT → 写入 httpOnly cookie (SameSite=Strict)
- 登出: `POST /api/auth/logout` → 清除 cookie
- 鉴权: 每个 API route 从 cookie 读取 JWT，验证签名和过期时间
- JWT 有效期: 7 天
- 无 CSRF token
- 无 refresh token（单人工具不需要）

---

## 十一、部署架构

### 开发环境

```yaml
# docker-compose.dev.yml
services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: pentest
      POSTGRES_PASSWORD: pentest
      POSTGRES_DB: pentest

  # Next.js: npm run dev (本地运行)
  # Worker: npx tsx worker.ts (本地运行)
```

### 生产环境

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    volumes: [pgdata:/var/lib/postgresql/data]

  app:
    build: .
    command: ["node", ".next/standalone/server.js"]
    ports: ["3000:3000"]
    depends_on: [postgres]

  worker:
    build: .
    command: ["node", "worker.js"]
    depends_on: [postgres]
    deploy:
      replicas: 1  # 可扩展为多实例

volumes:
  pgdata:
```

不需要 Redis。只有 PostgreSQL 一个外部依赖。

---

## 十二、代码量估算

| 模块 | 预估行数 |
|------|---------|
| prisma/schema.prisma | ~350 |
| lib/domain/ | ~300 |
| lib/services/ | ~1500 |
| lib/repositories/ | ~1200 |
| lib/workers/ (含 verify_finding) | ~1200 |
| lib/mcp/ | ~600 |
| lib/llm/ | ~600 |
| lib/infra/ | ~400 |
| lib/types/ | ~300 |
| app/api/ routes | ~1200 |
| worker.ts 入口 | ~50 |
| **后端合计** | **~7700** |
| 前端适配 | ~1000 |
| **总计** | **~8700** |

对比当前 ~24000 行，减少约 64%。

---

## 十三、实施策略

同仓库新分支 `v2/backend-rewrite`，先删 lib/ 再从零创建。

### Phase 0: 基础设施 (1 天)
- 新 Prisma schema + migrate
- pg-boss 配置 + 队列接口抽象
- LISTEN/NOTIFY 事件总线
- Worker 进程骨架
- JWT 认证中间件

### Phase 1: 数据层 + API (2 天)
- Repository 层 (9 个 repo)
- Service 层 (6 个 service)
- API Routes (CRUD + 命令)
- 前端状态映射表

### Phase 2: 编排引擎 (3 天)
- Planning Worker (LLM 调用 + 计划生成)
- Execution Worker (MCP 工具调用)
- Analysis Worker (LLM 分析 + Asset/Evidence/Finding 提取)
- Verification Worker (PoC 生成 + 执行 + Finding 状态更新)
- Lifecycle Worker (轮次管理 + 报告生成)

### Phase 3: MCP 集成 (2 天)
- stdio-connector (从现有代码简化)
- builtin-connector
- 工具注册 + 发现 API

### Phase 4: 前端适配 (2 天)
- 类型适配 + 状态映射
- 资产树视图
- Finding 详情 + PoC 面板
- SSE 事件适配

### Phase 5: 测试 (2 天)
- 单元测试
- E2E 测试
- 真实靶场验证

**总计: ~12 天**
