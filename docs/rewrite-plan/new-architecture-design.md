# 新架构设计方案

> 日期: 2026-04-04
> 目标: 从头设计后端，复用前端页面和 MCP 协议

---

## 一、技术栈选择

### 保留不变
- **前端框架**: Next.js 15 (App Router) + React 19 + TypeScript 5
- **UI 组件**: shadcn/ui (Radix) + Tailwind CSS + Recharts
- **数据库**: PostgreSQL 16 + Prisma 7
- **MCP SDK**: @modelcontextprotocol/sdk（MCP 工具协议不变）

### 新增/替换
- **任务队列**: BullMQ (Redis) — 替代当前的同步 drain 模型
- **消息总线**: Redis Pub/Sub — 替代进程内 EventEmitter
- **后端进程分离**: Next.js (API + SSR) + Worker 进程（独立 Node.js 进程处理长任务）
- **状态机**: XState 5 — 替代散布在代码中的状态字符串判断

### 为什么不换框架

当前前端 20+ 个页面、30+ 个组件、完整的 shadcn/ui 体系都是围绕 Next.js App Router 构建的。换成 Fastify + 独立 SPA 意味着重写所有前端路由、SSR 逻辑、认证中间件。保留 Next.js 但**将长任务卸载到 Worker 进程**是最务实的方案。

---

## 二、核心架构设计

### 2.1 进程架构

```
┌─────────────────────────────────────────────────┐
│                 Next.js 进程                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ API Route│  │  SSR Page │  │ SSE Endpoint  │  │
│  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │              │                │           │
│  ┌────┴──────────────┴────────────────┴───────┐  │
│  │            Service Layer                    │  │
│  │   (验证、查询、命令下发、SSE 订阅)          │  │
│  └────────────────────┬───────────────────────┘  │
│                       │                           │
│  ┌────────────────────┴───────────────────────┐  │
│  │          Prisma + Redis Client              │  │
│  └────────────────────────────────────────────┘  │
└───────────────────────┬───────────────────────────┘
                        │ Redis Queue / Pub/Sub
┌───────────────────────┴───────────────────────────┐
│               Worker 进程 (可多实例)                │
│  ┌────────────────────────────────────────────┐   │
│  │         BullMQ Worker                       │   │
│  │  ┌────────────┐  ┌────────────────────┐    │   │
│  │  │ LLM Planner│  │ Tool Executor      │    │   │
│  │  └────────────┘  └────────────────────┘    │   │
│  │  ┌────────────┐  ┌────────────────────┐    │   │
│  │  │ Analyzer   │  │ Lifecycle Manager  │    │   │
│  │  └────────────┘  └────────────────────┘    │   │
│  └────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────┐   │
│  │  Prisma + Redis + MCP SDK                   │   │
│  └────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────┘
```

### 2.2 关键设计决策

#### 决策 1: API Route 只做"命令下发"，不做"命令执行"

```
用户点击"开始项目"
→ API Route 写入 DB: project.lifecycle = "starting"
→ API Route 投递 BullMQ job: { type: "project.start", projectId }
→ API Route 立即返回 202 Accepted
→ Worker 异步执行: LLM 规划 → 工具执行 → 结果归一化
→ Worker 通过 Redis Pub/Sub 发出进度事件
→ 前端 SSE 接收事件，实时更新 UI
```

#### 决策 2: 多轮编排用持久化状态机而非内存循环

当前的 `while (currentRound < maxRounds)` 循环替换为：

```
每一轮是一个独立的 BullMQ job:

Job: project.plan_round
  输入: { projectId, round }
  执行: LLM 生成计划 → 持久化到 orchestrator_plans
  完成后: 投递 N 个 project.execute_tool jobs

Job: project.execute_tool
  输入: { projectId, runId }
  执行: MCP 工具调用 → 结果归一化 → 写入 DB
  完成后: 检查同轮所有 tool job 是否完成

Job: project.round_completed
  输入: { projectId, round }
  执行: 检查是否需要下一轮
  如果是: 投递新的 project.plan_round job
  如果否: 投递 project.settle_closure job
```

这样每个步骤都是独立的、可恢复的、可监控的。

#### 决策 3: 状态持久化优先于进程内缓存

| 当前方案 | 新方案 |
|---------|--------|
| `activeExecutionControllers` (进程内 Map) | 数据库 `execution_sessions` 表 + BullMQ job ID |
| `EventEmitter` (进程内) | Redis Pub/Sub |
| LLM streaming 中间内容在内存 | streaming 内容实时 append 到 `llm_call_logs.response` |
| Scheduler task lease (string 时间戳) | BullMQ 原生的 job lock + stalled job recovery |

---

## 三、数据库 Schema 重新设计

### 3.1 设计原则

1. **消灭 JSON 列**: 当前 `ProjectDetail` 的 13 个 JSON 列全部拆分为独立关系表
2. **强外键约束**: 所有引用关系使用 Prisma 的 `@relation`
3. **状态枚举化**: 所有状态使用 PostgreSQL enum 或 Prisma enum
4. **消灭冗余字段**: 不再在子表存储 `projectName`，通过 join 获取
5. **审计日志独立**: 使用 PostgreSQL trigger 或应用层 middleware 自动记录变更

### 3.2 核心模型

```prisma
// ── 枚举定义 ──

enum ProjectLifecycle {
  idle
  starting
  running
  paused
  stopping
  stopped
  completed
}

enum TaskStatus {
  pending
  ready
  waiting_dependency
  waiting_approval
  scheduled
  running
  succeeded
  failed
  cancelled
  needs_review
}

enum ApprovalStatus {
  pending       // 待处理
  approved      // 已批准
  rejected      // 已拒绝
  deferred      // 已延后
}

enum RiskLevel {
  low
  medium
  high
}

enum LlmCallStatus {
  streaming
  completed
  failed
  cancelled
}

// ── 项目核心 ──

model Project {
  id              String           @id @default(cuid())
  code            String           @unique
  name            String
  description     String           @default("")
  lifecycle       ProjectLifecycle @default(idle)
  currentStage    String           @default("scope_definition")
  currentRound    Int              @default(0)
  maxRounds       Int              @default(5)
  autoReplan      Boolean          @default(true)
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  targets         Target[]
  phases          ProjectPhase[]
  approvals       Approval[]
  assets          Asset[]
  evidence        Evidence[]
  findings        Finding[]
  mcpRuns         McpRun[]
  orchestratorPlans OrchestratorPlan[]
  orchestratorRounds OrchestratorRound[]
  llmCallLogs     LlmCallLog[]
  auditEvents     AuditEvent[]

  @@map("projects")
}

model Target {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  value       String   // 原始输入值
  type        String   // domain | ip | cidr | url | company
  normalized  String   // 标准化后的值
  createdAt   DateTime @default(now())

  @@unique([projectId, type, normalized])
  @@map("targets")
}

model ProjectPhase {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  stage       String
  status      String   @default("pending")  // pending | active | completed | skipped
  startedAt   DateTime?
  completedAt DateTime?
  note        String   @default("")

  @@unique([projectId, stage])
  @@map("project_phases")
}

// ── 资产体系 ──

model Asset {
  id            String   @id @default(cuid())
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  type          String   // domain | subdomain | host | ip | port | service | website | api | entry
  value         String   // 标准化值
  label         String   // 显示标签
  scopeStatus   String   @default("unverified")  // unverified | confirmed | excluded
  confidence    Float    @default(0)
  firstSeenAt   DateTime @default(now())
  lastSeenAt    DateTime @default(now())
  metadata      Json     @default("{}")  // 只用于不确定结构的扩展字段

  parentId      String?
  parent        Asset?   @relation("AssetTree", fields: [parentId], references: [id])
  children      Asset[]  @relation("AssetTree")

  evidenceLinks AssetEvidence[]
  fingerprints  Fingerprint[]

  @@unique([projectId, type, value])
  @@index([projectId, type])
  @@index([scopeStatus])
  @@map("assets")
}

model Fingerprint {
  id            String   @id @default(cuid())
  assetId       String
  asset         Asset    @relation(fields: [assetId], references: [id], onDelete: Cascade)
  category      String   // protocol | service | product | version | framework | component
  value         String
  source        String   // 产生此指纹的工具名
  confidence    Float    @default(0)
  rawEvidence   String   @default("")
  observedAt    DateTime @default(now())

  @@index([assetId])
  @@map("fingerprints")
}

model AssetEvidence {
  assetId    String
  evidenceId String
  asset      Asset    @relation(fields: [assetId], references: [id], onDelete: Cascade)
  evidence   Evidence @relation(fields: [evidenceId], references: [id], onDelete: Cascade)

  @@id([assetId, evidenceId])
  @@map("asset_evidence")
}

// ── 审批体系 ──

model Approval {
  id              String         @id @default(cuid())
  projectId       String
  project         Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  mcpRunId        String?        @unique
  mcpRun          McpRun?        @relation(fields: [mcpRunId], references: [id])
  target          String
  actionType      String
  riskLevel       RiskLevel
  rationale       String         @default("")
  status          ApprovalStatus @default(pending)
  decidedAt       DateTime?
  decidedBy       String?
  decisionNote    String         @default("")
  createdAt       DateTime       @default(now())

  @@index([projectId, status])
  @@map("approvals")
}

// ── 证据与发现 ──

model Evidence {
  id              String   @id @default(cuid())
  projectId       String
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  mcpRunId        String?
  mcpRun          McpRun?  @relation(fields: [mcpRunId], references: [id])
  title           String
  source          String   @default("")  // 产生证据的能力族
  rawOutput       String   @default("")  // 原始工具输出（text）
  summary         String   @default("")  // LLM 摘要
  verdict         String   @default("")
  capturedUrl     String?
  artifactPaths   String[] @default([])  // 截图、HTML 快照等文件路径
  createdAt       DateTime @default(now())

  assetLinks      AssetEvidence[]
  findings        Finding[]

  @@index([projectId])
  @@map("evidence")
}

model Finding {
  id              String    @id @default(cuid())
  projectId       String
  project         Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  evidenceId      String?
  evidence        Evidence? @relation(fields: [evidenceId], references: [id], onDelete: SetNull)
  severity        RiskLevel
  status          String    @default("unverified")  // unverified | confirmed | false_positive | remediated
  title           String
  summary         String    @default("")
  affectedAsset   String    @default("")
  recommendation  String    @default("")
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([projectId, severity])
  @@map("findings")
}

// ── MCP 执行体系 ──

model McpRun {
  id              String    @id @default(cuid())
  projectId       String
  project         Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  toolId          String?
  tool            McpTool?  @relation(fields: [toolId], references: [id])
  capability      String
  toolName        String
  requestedAction String
  target          String
  riskLevel       RiskLevel
  status          TaskStatus @default(pending)
  dispatchMode    String     // auto | approval_required | blocked
  llmCode         String?    // LLM 生成的代码
  connectorMode   String?    // stdio | real
  error           String?
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  // BullMQ job tracking
  bullJobId       String?    @unique
  round           Int?       // 所属编排轮次

  approval        Approval?
  evidence        Evidence[]
  summaryLines    McpRunSummary[]

  @@index([projectId, status])
  @@map("mcp_runs")
}

model McpRunSummary {
  id        String   @id @default(cuid())
  mcpRunId  String
  mcpRun    McpRun   @relation(fields: [mcpRunId], references: [id], onDelete: Cascade)
  line      String
  createdAt DateTime @default(now())

  @@index([mcpRunId])
  @@map("mcp_run_summaries")
}

// ── MCP 工具注册 ──

model McpTool {
  id                String  @id @default(cuid())
  serverName        String
  toolName          String  @unique
  version           String  @default("")
  capability        String
  boundary          String  @default("external")
  riskLevel         RiskLevel @default(medium)
  requiresApproval  Boolean @default(false)
  description       String  @default("")
  inputSchema       Json    @default("{}")
  outputSchema      Json    @default("{}")
  enabled           Boolean @default(true)
  timeout           Int     @default(60000)
  maxRetries        Int     @default(3)
  concurrencyLimit  Int     @default(1)

  mcpRuns           McpRun[]

  @@map("mcp_tools")
}

model McpServer {
  id          String   @id @default(cuid())
  serverName  String   @unique
  version     String   @default("")
  transport   String   // stdio | streamable_http | sse
  command     String?
  args        String[] @default([])
  endpoint    String?
  enabled     Boolean  @default(true)
  lastHealthCheck DateTime?
  healthStatus    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("mcp_servers")
}

// ── 编排体系 ──

model OrchestratorPlan {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  round       Int
  provider    String
  summary     String   @default("")
  items       Json     @default("[]")  // 计划项（结构化但变化频繁，保留 JSON）
  createdAt   DateTime @default(now())

  @@unique([projectId, round])
  @@map("orchestrator_plans")
}

model OrchestratorRound {
  id                  String   @id @default(cuid())
  projectId           String
  project             Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  round               Int
  status              String   @default("planning")  // planning | executing | completed | failed
  planItemCount       Int      @default(0)
  executedCount       Int      @default(0)
  newAssetCount       Int      @default(0)
  newEvidenceCount    Int      @default(0)
  newFindingCount     Int      @default(0)
  reflection          Json?
  startedAt           DateTime @default(now())
  completedAt         DateTime?

  @@unique([projectId, round])
  @@map("orchestrator_rounds")
}

// ── LLM 调用日志 ──

model LlmCallLog {
  id          String        @id @default(cuid())
  projectId   String
  project     Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  role        String        // orchestrator | reviewer | analyzer
  phase       String        // planning | reviewing | analyzing
  prompt      String
  response    String        @default("")
  status      LlmCallStatus @default(streaming)
  model       String        @default("")
  provider    String        @default("")
  durationMs  Int?
  error       String?
  createdAt   DateTime      @default(now())
  completedAt DateTime?

  @@index([projectId, status])
  @@map("llm_call_logs")
}

// ── 审计 ──

model AuditEvent {
  id          String   @id @default(cuid())
  projectId   String?
  project     Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
  category    String
  action      String
  actor       String
  detail      String   @default("")
  createdAt   DateTime @default(now())

  @@index([projectId])
  @@index([category])
  @@map("audit_events")
}

// ── 设置 ──

model LlmProfile {
  id          String  @id  // orchestrator | reviewer | analyzer
  provider    String  @default("openai-compatible")
  label       String  @default("")
  apiKey      String  @default("")
  baseUrl     String  @default("")
  model       String  @default("")
  timeoutMs   Int     @default(120000)
  temperature Float   @default(0.2)
  enabled     Boolean @default(false)

  @@map("llm_profiles")
}

model GlobalConfig {
  id                    String  @id @default("global")
  approvalEnabled       Boolean @default(true)
  autoApproveLowRisk    Boolean @default(true)
  autoApproveMediumRisk Boolean @default(true)

  @@map("global_config")
}

// ── 用户 ──

model User {
  id          String   @id @default(cuid())
  account     String   @unique
  password    String
  displayName String
  role        String   @default("researcher")
  status      String   @default("active")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("users")
}
```

### 3.3 与当前 Schema 的关键区别

| 维度 | 当前 | 新设计 |
|------|------|--------|
| ProjectDetail JSON 列 | 13 个 JSON 列 | 拆分为 ProjectPhase、Asset、Fingerprint 等独立表 |
| 状态管理 | 中文字符串 "待处理"、"已执行" | enum 类型 `TaskStatus`、`ApprovalStatus` |
| 外键 | String ID 无约束 | Prisma `@relation` 强约束 |
| projectName 冗余 | 每个子表都存 | 删除，通过 join 获取 |
| SchedulerTask | 独立表 + lease 机制 | 删除，由 BullMQ 原生管理 |
| 审批-执行关联 | string linkedApprovalId | 外键 `Approval.mcpRunId` |
| summaryLines | String[] 不断追加 | 独立 McpRunSummary 表，append-only |

---

## 四、后端架构设计

### 4.1 分层架构

```
app/api/            → Controller 层（请求验证 + 命令/查询分发）
lib/services/       → Service 层（业务逻辑编排）
lib/repositories/   → Repository 层（数据访问）
lib/workers/        → Worker 层（异步任务处理）
lib/mcp/            → MCP 集成层（工具注册、连接器、SDK 桥接）
lib/llm/            → LLM 集成层（provider 适配、prompt 构建）
lib/domain/         → 领域模型（状态机定义、业务规则）
lib/infra/          → 基础设施（Redis、Prisma、事件总线）
```

### 4.2 关键模块设计

#### 4.2.1 任务队列 (BullMQ)

```typescript
// lib/infra/queues.ts
import { Queue, Worker } from "bullmq"

// 三个队列，不同优先级和并发策略
export const planningQueue = new Queue("planning", { connection: redis })
export const executionQueue = new Queue("execution", { connection: redis })
export const analysisQueue = new Queue("analysis", { connection: redis })

// Job 类型定义
type PlanRoundJob = { projectId: string; round: number }
type ExecuteToolJob = { projectId: string; mcpRunId: string }
type AnalyzeResultJob = { projectId: string; mcpRunId: string }
type RoundCompletedJob = { projectId: string; round: number }
type SettleClosureJob = { projectId: string }
```

#### 4.2.2 项目生命周期状态机 (XState)

```typescript
// lib/domain/project-lifecycle.ts
import { createMachine } from "xstate"

export const projectLifecycleMachine = createMachine({
  id: "projectLifecycle",
  initial: "idle",
  states: {
    idle: {
      on: { START: "planning" }
    },
    planning: {
      on: {
        PLAN_READY: "executing",
        PLAN_FAILED: "failed",
        STOP: "stopping"
      }
    },
    executing: {
      on: {
        ALL_TOOLS_DONE: "round_review",
        APPROVAL_NEEDED: "waiting_approval",
        STOP: "stopping"
      }
    },
    waiting_approval: {
      on: {
        APPROVAL_RESOLVED: "executing",
        STOP: "stopping"
      }
    },
    round_review: {
      on: {
        CONTINUE: "planning",
        SETTLE: "settling",
        STOP: "stopping"
      }
    },
    settling: {
      on: {
        SETTLED: "completed",
        SETTLE_FAILED: "failed"
      }
    },
    stopping: {
      on: { STOPPED: "stopped" }
    },
    paused: {
      on: {
        RESUME: "planning",
        STOP: "stopping"
      }
    },
    completed: { type: "final" },
    stopped: { type: "final" },
    failed: {
      on: {
        RETRY: "planning",
        STOP: "stopping"
      }
    }
  }
})
```

#### 4.2.3 事件总线 (Redis Pub/Sub)

```typescript
// lib/infra/event-bus.ts
import { createClient } from "redis"

export type ProjectEvent = {
  type: string
  projectId: string
  timestamp: string
  data: Record<string, unknown>
}

// 发布事件（Worker 进程中调用）
export async function publishProjectEvent(event: ProjectEvent) {
  await redisPublisher.publish(`project:${event.projectId}`, JSON.stringify(event))
}

// 订阅事件（API 进程中的 SSE endpoint 调用）
export async function subscribeProjectEvents(
  projectId: string,
  callback: (event: ProjectEvent) => void
): Promise<() => void> {
  const subscriber = redisClient.duplicate()
  await subscriber.subscribe(`project:${projectId}`, (message) => {
    callback(JSON.parse(message))
  })
  return () => subscriber.unsubscribe(`project:${projectId}`)
}
```

#### 4.2.4 错误处理策略

```typescript
// lib/domain/errors.ts

// 所有业务错误继承 DomainError
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
  }
}

export class ProjectNotFoundError extends DomainError {
  constructor(projectId: string) {
    super(`Project ${projectId} not found`, "PROJECT_NOT_FOUND", 404)
  }
}

export class InvalidLifecycleTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super(`Invalid transition from ${from} to ${to}`, "INVALID_TRANSITION", 409)
  }
}

export class ToolExecutionError extends DomainError {
  constructor(toolName: string, message: string, public readonly retryable: boolean) {
    super(`Tool ${toolName} failed: ${message}`, "TOOL_EXECUTION_FAILED", 500)
  }
}
```

### 4.3 解决当前已知 BUG 的设计

#### BUG 1: Scheduler task 卡在 running

**新方案**: 不再有自建 scheduler task。BullMQ 原生提供：
- Job lock 自动续期
- Stalled job 检测（worker 进程崩溃时自动恢复）
- 可配置的 `lockDuration` 和 `stalledInterval`
- Job 状态完全由 BullMQ 管理，不存在手动 lease 不一致

#### BUG 2: LLM call log 卡在 streaming

**新方案**: 
- LLM 调用在 Worker 进程中执行，不受 HTTP 请求生命周期约束
- Worker 启动时运行 `cleanupStaleLlmCalls()`：将所有 `status = streaming` 且 `createdAt < 10 分钟前` 的记录标记为 `failed`
- streaming 过程中每次 flush 都更新 `updatedAt`，作为健康检查依据

#### BUG 3: Auto-replan 循环崩溃

**新方案**: 没有循环。每一轮是独立的 BullMQ job：
- `plan_round` job 失败 → BullMQ 自动重试（指数退避）
- `execute_tool` job 失败 → 标记为 failed，不影响其他 tool job
- `round_completed` job 检查所有 tool job 完成状态，决定下一步
- 任何 job 失败都不会影响数据库一致性

#### BUG 4: 项目卡在"运行中"

**新方案**: 
- BullMQ 的 `completed` 和 `failed` 事件由 Worker 监听
- 所有 tool job 完成（成功或失败）时触发 `round_completed` job
- `round_completed` job 无论决定继续还是停止，都会更新项目状态
- 即使 Worker 崩溃，BullMQ stalled job recovery 也会重新处理

#### BUG 5: 审批通过后工具不执行

**新方案**: 审批通过时投递 BullMQ job：

```typescript
// 审批 API 处理
async function approveAction(approvalId: string) {
  await approvalRepository.approve(approvalId)
  const approval = await approvalRepository.findById(approvalId)
  if (approval.mcpRunId) {
    await executionQueue.add("execute_tool", {
      projectId: approval.projectId,
      mcpRunId: approval.mcpRunId,
    })
  }
}
```

---

## 五、MCP 协议复用方案

### 5.1 保持不变的部分

1. **MCP Server 注册合同** (`docs/contracts/mcp-server-contract.md`) — 注册 JSON 格式不变
2. **MCP Tool 合同字段** (toolName, capability, boundary, riskLevel, etc.) — 枚举值不变
3. **stdio 传输** — 仍使用 `@modelcontextprotocol/sdk` 的 `StdioClientTransport`
4. **外部 MCP Server 仓库** (`llmpentest-mcp-template`) — 完全不受影响

### 5.2 需要重构的部分

1. **连接器层简化**: 当前 10 个连接器文件 → 2-3 个：
   - `stdio-connector.ts` — 通用 stdio MCP 连接器（合并 4 个 real-* 连接器 + stdio connector）
   - `http-connector.ts` — streamable HTTP MCP 连接器
   - `built-in-connector.ts` — 内置工具连接器（seed-normalizer, capture-evidence, report-exporter）

2. **工具发现**: 当前的 `mcp-auto-discovery.ts` (19536 行) 需要大幅简化，核心逻辑保留

### 5.3 连接器接口

```typescript
// lib/mcp/connector.ts
export interface McpConnector {
  readonly id: string
  readonly transport: "stdio" | "streamable_http"
  
  execute(input: ToolExecutionInput): Promise<ToolExecutionResult>
  healthCheck(): Promise<HealthCheckResult>
  dispose(): Promise<void>
}

export type ToolExecutionInput = {
  toolName: string
  arguments: Record<string, unknown>
  signal?: AbortSignal
}

export type ToolExecutionResult =
  | { status: "succeeded"; output: unknown; rawOutput: string }
  | { status: "failed"; error: string; retryable: boolean }
  | { status: "aborted" }
```

---

## 六、前端页面复用方案

### 6.1 复用策略

当前前端有 20 个页面和 30+ 个组件。复用策略：

- **页面布局和路由结构**: 完全保留 `app/(console)/` 结构
- **UI 组件**: 完全保留 `components/ui/` (shadcn/ui)
- **业务组件**: 保留组件 UI，修改数据获取方式（从 `fetch` 调 API 改为适配新 API 响应格式）
- **SSE 事件**: 保留 `project-live-dashboard.tsx` 的 EventSource 逻辑，适配新事件格式

### 6.2 前端需要改的部分

1. **API 响应类型**: 新后端使用 enum 而非中文字符串，前端需要适配映射
2. **prototype-types.ts**: 重写以匹配新 schema（很多类型会简化）
3. **数据聚合页面**: 当前很多页面在 API route 中做数据聚合（如 dashboard、operations），改为后端 Service 层提供聚合 API

### 6.3 前端完全不需要改的部分

- `components/ui/*` — 所有 shadcn/ui 组件
- `components/shared/*` — 通用布局组件
- `components/layout/*` — 布局组件
- `app/login/` — 登录页
- 主题、全局样式、图标

---

## 七、目录结构设计

```
app/
├── (console)/              # 保留现有前端页面
├── api/                    # 精简 API routes
│   ├── projects/
│   ├── approvals/
│   ├── assets/
│   ├── evidence/
│   ├── settings/
│   ├── dashboard/
│   └── events/[projectId]/ # SSE endpoint
├── login/
└── layout.tsx

components/                 # 保留现有组件
├── ui/                     # shadcn/ui (不动)
├── dashboard/
├── projects/
├── settings/
└── shared/

lib/
├── domain/                 # 领域模型 (新)
│   ├── project-lifecycle.ts
│   ├── risk-policy.ts
│   └── errors.ts
├── services/               # 业务服务层 (新)
│   ├── project-service.ts
│   ├── approval-service.ts
│   ├── orchestrator-service.ts
│   ├── dashboard-service.ts
│   └── settings-service.ts
├── repositories/           # 数据访问层 (重写)
│   ├── project-repo.ts
│   ├── asset-repo.ts
│   ├── evidence-repo.ts
│   ├── finding-repo.ts
│   ├── approval-repo.ts
│   ├── mcp-run-repo.ts
│   └── audit-repo.ts
├── workers/                # Worker 任务处理 (新)
│   ├── planning-worker.ts
│   ├── execution-worker.ts
│   ├── analysis-worker.ts
│   └── lifecycle-worker.ts
├── mcp/                    # MCP 集成 (简化)
│   ├── connector.ts
│   ├── stdio-connector.ts
│   ├── built-in-connector.ts
│   ├── registry.ts
│   └── discovery.ts
├── llm/                    # LLM 集成 (简化)
│   ├── provider.ts
│   ├── openai-provider.ts
│   ├── prompts.ts
│   └── call-logger.ts
├── infra/                  # 基础设施
│   ├── prisma.ts
│   ├── redis.ts
│   ├── queues.ts
│   ├── event-bus.ts
│   └── api-handler.ts
└── types/                  # 类型定义
    └── index.ts

worker.ts                   # Worker 进程入口 (新)

prisma/
└── schema.prisma           # 新 schema
```

---

## 八、代码量估算

### 新后端核心代码

| 模块 | 预估行数 | 说明 |
|------|---------|------|
| prisma/schema.prisma | ~300 | 精简后的 schema |
| lib/domain/ | ~400 | 状态机 + 业务规则 + 错误定义 |
| lib/services/ | ~1500 | 5 个 service，每个 ~300 行 |
| lib/repositories/ | ~1200 | 7 个 repo，每个 ~170 行（Prisma 让 repo 很薄） |
| lib/workers/ | ~1000 | 4 个 worker，每个 ~250 行 |
| lib/mcp/ | ~800 | 连接器 + 注册 + 发现 |
| lib/llm/ | ~600 | provider + prompt + logger |
| lib/infra/ | ~400 | prisma + redis + queue + event-bus |
| lib/types/ | ~300 | 精简后的类型定义 |
| app/api/ routes | ~1500 | ~48 个 route 文件，每个 ~30 行 |
| worker.ts | ~50 | Worker 入口 |
| **后端合计** | **~8050** | |

### 前端改动

| 模块 | 预估行数 | 说明 |
|------|---------|------|
| 类型适配层 | ~200 | 新类型定义映射 |
| API client 适配 | ~100 | 响应格式适配 |
| 组件小改 | ~500 | 状态字符串映射、字段名变更 |
| **前端改动合计** | **~800** | |

### 与当前代码量对比

| 度量 | 当前 | 新方案 |
|------|------|--------|
| lib/ 后端代码 | ~15000 行 (68 个文件) | ~8050 行 (~35 个文件) |
| prisma-transforms.ts | 870 行 | 0 行（直接用 Prisma 类型） |
| prototype-types.ts | 918 行 | ~300 行 |
| 前端代码 | ~8000 行 | ~8800 行（改动 +800） |
| 总计 | ~24000 行 | ~17000 行 |

---

## 九、部署架构

### 开发环境

```
docker-compose:
  - postgres:16
  - redis:7
  - next-app (npm run dev)
  - worker (tsx worker.ts)
```

### 生产环境

```
docker-compose:
  - postgres:16 (volume 持久化)
  - redis:7 (volume 持久化)
  - next-app (next start)
  - worker (node worker.js, 可 N 个实例)
  - nginx (可选, 反代)
```

---

## 十、迁移策略

### Phase 0: 基础设施 (1 天)
- 新 Prisma schema
- Redis + BullMQ 配置
- Worker 进程骨架
- 事件总线

### Phase 1: 核心后端 (3 天)
- Repository 层
- Service 层
- 项目生命周期状态机
- API Routes (CRUD)

### Phase 2: 编排引擎 (3 天)
- Planning Worker
- Execution Worker
- Analysis Worker (LLM writeback)
- Lifecycle Worker (round management)

### Phase 3: MCP 集成 (2 天)
- 通用 stdio connector
- Built-in tools
- Tool discovery + registration API

### Phase 4: 前端适配 (2 天)
- 类型适配
- 状态字符串映射
- SSE 事件适配
- Dashboard 数据适配

### Phase 5: 测试与打磨 (2 天)
- E2E 测试
- 错误恢复测试
- 性能测试

**总计: ~13 天**（单人全职开发）
