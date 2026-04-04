# 新后端实现 Prompt

> 本文档是一份完整的开发 prompt，可以直接交给 AI 来实现新后端。
> 日期: 2026-04-04

---

## 项目背景

你要为一个 LLM 渗透测试平台重新实现后端。这是一个面向单人研究员的授权外网安全评估工作台：

- **LLM 是大脑**: 负责规划渗透测试流程、生成任务、分析工具输出
- **MCP 是四肢**: 通过 Model Context Protocol 调用安全工具（DNS 侦查、端口扫描、Web 探测等）
- **平台是中枢**: 管理项目、审批、资产、证据、报告

当前后端有严重的架构问题（长任务绑定 HTTP 请求、进程内状态丢失、scheduler 卡死等），需要从头重写后端，但复用现有的前端页面（20 个 Next.js 页面）和 MCP 协议。

---

## 技术栈

- **框架**: Next.js 15 (App Router) — 保留，用于 API + SSR
- **语言**: TypeScript 5 (strict mode)
- **数据库**: PostgreSQL 16 + Prisma 7
- **任务队列**: BullMQ + Redis 7
- **状态机**: XState 5（项目生命周期管理）
- **消息总线**: Redis Pub/Sub（跨进程事件通知）
- **前端**: React 19 + shadcn/ui + Tailwind CSS（已有，只需适配 API 类型）

---

## 核心架构要求

### 1. 进程分离

系统分为两类进程：

**Next.js 进程**（HTTP 服务）:
- 处理 API 请求（短生命周期，<5s 响应）
- 渲染 SSR 页面
- 提供 SSE endpoint（订阅 Redis Pub/Sub 转发给客户端）
- **绝对不执行长任务**（不调用 LLM、不执行 MCP 工具）

**Worker 进程**（BullMQ Worker）:
- 从 Redis 队列拉取 job 并执行
- 执行 LLM 调用（10-120s）
- 执行 MCP 工具调用（5-60s）
- 分析工具输出（LLM writeback）
- 管理项目生命周期（多轮编排）
- 可以运行多个实例（水平扩展）

### 2. 命令-查询分离

API Route 的设计原则：

- **查询（GET）**: 直接查 Prisma，返回数据
- **命令（POST/PUT/DELETE）**: 写入数据库 + 投递 BullMQ job → 立即返回 202 Accepted
- **所有长操作通过 job 异步执行**

示例：

```typescript
// app/api/projects/[projectId]/start/route.ts
export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  const project = await projectRepo.findById(params.projectId)
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })
  
  // 更新状态
  await projectRepo.updateLifecycle(project.id, "starting")
  
  // 投递 job
  await planningQueue.add("plan_round", {
    projectId: project.id,
    round: 1,
  })
  
  // 立即返回
  return NextResponse.json({ status: "started" }, { status: 202 })
}
```

### 3. 持久化状态机

项目生命周期不使用内存循环，使用数据库持久化的状态 + BullMQ job chain：

```
用户点击"开始"
  → API: project.lifecycle = "starting", 投递 plan_round job
  
plan_round job 执行:
  → 调用 LLM 生成计划
  → 保存 OrchestratorPlan 到数据库
  → project.lifecycle = "executing"
  → 为每个计划项投递 execute_tool job
  → 投递 round_completed job（依赖所有 execute_tool 完成）
  
execute_tool job 执行:
  → 调用 MCP 工具
  → 保存结果到数据库
  → 投递 analyze_result job
  
analyze_result job 执行:
  → 调用 LLM 分析工具输出
  → 保存 assets, evidence, findings 到数据库
  → 发布 Redis 事件通知前端
  
round_completed job 执行:
  → 检查所有 tool job 的完成状态
  → 决定是否需要下一轮
  → 如果继续: 投递新的 plan_round job
  → 如果结束: 投递 settle_closure job
  
settle_closure job 执行:
  → 生成最终结论（LLM reviewer）
  → 导出报告
  → project.lifecycle = "completed"
```

### 4. 错误恢复

**BullMQ 原生特性利用**:
- `attempts: 3` — 自动重试
- `backoff: { type: "exponential", delay: 5000 }` — 指数退避
- stalled job recovery — Worker 崩溃后自动恢复
- `removeOnComplete: { age: 86400 }` — 自动清理

**应用层恢复**:
- Worker 启动时清理 stale 数据：
  - `LlmCallLog` status = "streaming" 且 createdAt > 10 分钟 → 标记为 "failed"
  - `McpRun` status = "running" 且 bullJobId 在 BullMQ 中已不存在 → 标记为 "failed"
  - `Project` lifecycle = "starting" 或 "executing" 且无活跃 job → 标记为 "failed"

---

## 数据库 Schema

请使用以下 Prisma schema（精简版，完整版见 `docs/rewrite-plan/new-architecture-design.md`）：

核心模型：
- `Project` — 项目（lifecycle 用 enum）
- `Target` — 项目目标（独立表，不是 String[]）
- `ProjectPhase` — 项目阶段（独立表，不是 JSON）
- `Asset` — 资产（自引用树结构）
- `Fingerprint` — 指纹（资产子表）
- `Approval` — 审批（外键关联 McpRun）
- `Evidence` — 证据（外键关联 McpRun）
- `Finding` — 发现
- `McpRun` — MCP 执行记录（包含 BullMQ jobId）
- `McpTool` — MCP 工具注册
- `McpServer` — MCP 服务器注册
- `OrchestratorPlan` — 编排计划（按轮次）
- `OrchestratorRound` — 编排轮次记录
- `LlmCallLog` — LLM 调用日志
- `AuditEvent` — 审计事件
- `LlmProfile` — LLM 配置
- `GlobalConfig` — 全局配置
- `User` — 用户

关键设计点：
1. **没有 SchedulerTask 表** — BullMQ 管理任务调度
2. **没有 ProjectDetail JSON 列** — 全部拆分为独立关系表
3. **所有状态用 enum** — `ProjectLifecycle`, `TaskStatus`, `ApprovalStatus`, `RiskLevel`
4. **外键约束** — 所有引用关系使用 `@relation`
5. **不存冗余字段** — 不在子表存 `projectName`

---

## 目录结构

```
project-root/
├── app/
│   ├── (console)/          # 现有前端页面（保留）
│   ├── api/                # API 路由（重写）
│   │   ├── projects/
│   │   │   ├── route.ts                     # GET: 列表, POST: 创建
│   │   │   └── [projectId]/
│   │   │       ├── route.ts                 # GET: 详情, PUT: 更新, DELETE: 删除
│   │   │       ├── start/route.ts           # POST: 启动项目
│   │   │       ├── pause/route.ts           # POST: 暂停
│   │   │       ├── resume/route.ts          # POST: 恢复
│   │   │       ├── stop/route.ts            # POST: 停止
│   │   │       ├── approvals/route.ts       # GET: 项目审批列表
│   │   │       ├── assets/route.ts          # GET: 项目资产
│   │   │       ├── evidence/route.ts        # GET: 项目证据
│   │   │       ├── findings/route.ts        # GET: 项目发现
│   │   │       ├── mcp-runs/route.ts        # GET: MCP 执行记录
│   │   │       ├── orchestrator/route.ts    # GET: 编排状态
│   │   │       ├── llm-logs/route.ts        # GET: LLM 日志
│   │   │       └── events/route.ts          # GET (SSE): 实时事件流
│   │   ├── approvals/
│   │   │   └── [approvalId]/
│   │   │       └── route.ts                 # PUT: 审批决策
│   │   ├── assets/
│   │   │   └── [assetId]/route.ts           # GET: 资产详情
│   │   ├── evidence/
│   │   │   └── [evidenceId]/route.ts        # GET: 证据详情
│   │   ├── dashboard/route.ts               # GET: 仪表盘数据
│   │   ├── settings/
│   │   │   ├── llm/route.ts                 # GET/PUT: LLM 配置
│   │   │   ├── mcp-tools/route.ts           # GET: 工具列表
│   │   │   ├── mcp-servers/
│   │   │   │   └── register/route.ts        # POST: 注册 MCP Server
│   │   │   ├── system-status/route.ts       # GET: 系统状态（含 Redis/BullMQ）
│   │   │   └── audit-logs/route.ts          # GET: 审计日志
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   └── logout/route.ts
│   │   └── health/route.ts
│   ├── login/
│   └── layout.tsx
│
├── components/              # 现有组件（保留，微调类型）
│
├── lib/
│   ├── domain/              # 领域模型
│   │   ├── project-lifecycle.ts   # XState 状态机定义
│   │   ├── risk-policy.ts         # 审批策略规则
│   │   ├── pentest-stages.ts      # 渗透测试阶段定义
│   │   └── errors.ts              # 业务错误定义
│   │
│   ├── services/            # 业务服务层
│   │   ├── project-service.ts     # 项目 CRUD + 状态管理
│   │   ├── approval-service.ts    # 审批流程
│   │   ├── orchestrator-service.ts # 编排（命令下发，不执行）
│   │   ├── dashboard-service.ts   # 仪表盘聚合
│   │   ├── asset-service.ts       # 资产管理
│   │   └── settings-service.ts    # 配置管理
│   │
│   ├── repositories/        # 数据访问层
│   │   ├── project-repo.ts
│   │   ├── asset-repo.ts
│   │   ├── evidence-repo.ts
│   │   ├── finding-repo.ts
│   │   ├── approval-repo.ts
│   │   ├── mcp-run-repo.ts
│   │   ├── mcp-tool-repo.ts
│   │   ├── llm-log-repo.ts
│   │   └── audit-repo.ts
│   │
│   ├── workers/             # BullMQ Worker 处理函数
│   │   ├── planning-worker.ts     # LLM 规划 job
│   │   ├── execution-worker.ts    # MCP 工具执行 job
│   │   ├── analysis-worker.ts     # LLM 结果分析 job
│   │   └── lifecycle-worker.ts    # 轮次管理 + 收尾 job
│   │
│   ├── mcp/                 # MCP 集成层
│   │   ├── connector.ts           # 连接器接口
│   │   ├── stdio-connector.ts     # stdio 传输连接器
│   │   ├── built-in-tools.ts      # 内置工具（seed-normalizer 等）
│   │   ├── registry.ts            # 工具/服务器注册表
│   │   └── discovery.ts           # 自动发现
│   │
│   ├── llm/                 # LLM 集成层
│   │   ├── provider.ts            # Provider 接口
│   │   ├── openai-provider.ts     # OpenAI-compatible 实现
│   │   ├── prompts.ts             # 所有 prompt 模板
│   │   └── call-logger.ts         # 调用日志 middleware
│   │
│   ├── infra/               # 基础设施
│   │   ├── prisma.ts              # Prisma client 单例
│   │   ├── redis.ts               # Redis client 单例
│   │   ├── queues.ts              # BullMQ Queue 定义
│   │   ├── event-bus.ts           # Redis Pub/Sub 封装
│   │   └── api-handler.ts        # API Route 错误处理包装
│   │
│   ├── types/               # TypeScript 类型
│   │   └── index.ts               # 从 Prisma 生成 + 扩展类型
│   │
│   └── utils.ts             # cn() 等工具函数
│
├── worker.ts                # Worker 进程入口
├── prisma/
│   └── schema.prisma
├── docker-compose.yml       # PostgreSQL + Redis + App + Worker
└── package.json
```

---

## 实现指南

### Phase 0: 基础设施搭建

#### 0.1 Prisma Schema

创建上述 schema，运行 `prisma migrate dev` 生成数据库。

#### 0.2 Redis + BullMQ

```typescript
// lib/infra/redis.ts
import Redis from "ioredis"

export const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379")

// lib/infra/queues.ts
import { Queue } from "bullmq"
import { redis } from "./redis"

export const planningQueue = new Queue("planning", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 604800 },
  },
})

export const executionQueue = new Queue("execution", {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 604800 },
  },
})

export const analysisQueue = new Queue("analysis", {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 2000 },
    removeOnComplete: { age: 86400 },
  },
})

export const lifecycleQueue = new Queue("lifecycle", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
})
```

#### 0.3 事件总线

```typescript
// lib/infra/event-bus.ts
import Redis from "ioredis"

const publisher = new Redis(process.env.REDIS_URL || "redis://localhost:6379")

export type ProjectEvent = {
  type: string
  projectId: string
  timestamp: string
  data: Record<string, unknown>
}

export async function publishEvent(event: ProjectEvent) {
  await publisher.publish(
    `project:${event.projectId}`,
    JSON.stringify(event)
  )
}

export function createSubscriber() {
  return new Redis(process.env.REDIS_URL || "redis://localhost:6379")
}
```

#### 0.4 Worker 入口

```typescript
// worker.ts
import { Worker } from "bullmq"
import { redis } from "./lib/infra/redis"
import { handlePlanRound } from "./lib/workers/planning-worker"
import { handleExecuteTool } from "./lib/workers/execution-worker"
import { handleAnalyzeResult } from "./lib/workers/analysis-worker"
import { handleRoundCompleted, handleSettleClosure } from "./lib/workers/lifecycle-worker"

// 启动时清理 stale 数据
async function cleanupOnStartup() {
  // ... 清理 stale LLM call logs, stale McpRuns 等
}

await cleanupOnStartup()

new Worker("planning", async (job) => {
  switch (job.name) {
    case "plan_round": return handlePlanRound(job.data)
  }
}, { connection: redis, concurrency: 2 })

new Worker("execution", async (job) => {
  switch (job.name) {
    case "execute_tool": return handleExecuteTool(job.data)
  }
}, { connection: redis, concurrency: 5 })

new Worker("analysis", async (job) => {
  switch (job.name) {
    case "analyze_result": return handleAnalyzeResult(job.data)
  }
}, { connection: redis, concurrency: 3 })

new Worker("lifecycle", async (job) => {
  switch (job.name) {
    case "round_completed": return handleRoundCompleted(job.data)
    case "settle_closure": return handleSettleClosure(job.data)
  }
}, { connection: redis, concurrency: 1 })

console.log("Worker started, waiting for jobs...")
```

### Phase 1: Repository 层

每个 Repository 是一个纯函数模块，只做 Prisma CRUD，不包含业务逻辑。

```typescript
// lib/repositories/project-repo.ts
import { prisma } from "@/lib/infra/prisma"
import type { ProjectLifecycle } from "@prisma/client"

export async function findAll() {
  return prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { assets: true, findings: true, approvals: true } } },
  })
}

export async function findById(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      targets: true,
      phases: { orderBy: { stage: "asc" } },
    },
  })
}

export async function create(data: {
  code: string
  name: string
  description: string
  targets: Array<{ value: string; type: string; normalized: string }>
}) {
  return prisma.project.create({
    data: {
      code: data.code,
      name: data.name,
      description: data.description,
      targets: { create: data.targets },
    },
    include: { targets: true },
  })
}

export async function updateLifecycle(id: string, lifecycle: ProjectLifecycle) {
  return prisma.project.update({
    where: { id },
    data: { lifecycle },
  })
}

// ... 其他 CRUD
```

### Phase 2: Service 层

Service 层编排业务逻辑，协调 Repository + Queue。

```typescript
// lib/services/project-service.ts
import * as projectRepo from "@/lib/repositories/project-repo"
import { planningQueue } from "@/lib/infra/queues"
import { publishEvent } from "@/lib/infra/event-bus"
import { ProjectNotFoundError, InvalidLifecycleTransitionError } from "@/lib/domain/errors"

export async function startProject(projectId: string) {
  const project = await projectRepo.findById(projectId)
  if (!project) throw new ProjectNotFoundError(projectId)
  
  if (project.lifecycle !== "idle" && project.lifecycle !== "paused") {
    throw new InvalidLifecycleTransitionError(project.lifecycle, "starting")
  }
  
  await projectRepo.updateLifecycle(projectId, "starting")
  
  await planningQueue.add("plan_round", {
    projectId,
    round: project.currentRound + 1,
  })
  
  await publishEvent({
    type: "lifecycle_changed",
    projectId,
    timestamp: new Date().toISOString(),
    data: { lifecycle: "starting" },
  })
  
  return { status: "started" }
}

export async function stopProject(projectId: string) {
  const project = await projectRepo.findById(projectId)
  if (!project) throw new ProjectNotFoundError(projectId)
  
  await projectRepo.updateLifecycle(projectId, "stopping")
  
  // 取消所有 active jobs
  // BullMQ: 通过 job ID 查找并移除
  // ...
  
  await projectRepo.updateLifecycle(projectId, "stopped")
  
  await publishEvent({
    type: "lifecycle_changed",
    projectId,
    timestamp: new Date().toISOString(),
    data: { lifecycle: "stopped" },
  })
}
```

### Phase 3: Worker 实现

#### Planning Worker

```typescript
// lib/workers/planning-worker.ts
import * as projectRepo from "@/lib/repositories/project-repo"
import * as mcpRunRepo from "@/lib/repositories/mcp-run-repo"
import { executionQueue, lifecycleQueue } from "@/lib/infra/queues"
import { publishEvent } from "@/lib/infra/event-bus"
import { resolveLlmProvider } from "@/lib/llm/provider"
import { buildPlanPrompt } from "@/lib/llm/prompts"

export async function handlePlanRound(data: { projectId: string; round: number }) {
  const { projectId, round } = data
  const project = await projectRepo.findById(projectId)
  if (!project) throw new Error(`Project ${projectId} not found`)
  
  // 检查项目是否被停止
  if (project.lifecycle === "stopping" || project.lifecycle === "stopped") {
    return { status: "cancelled" }
  }
  
  await projectRepo.updateLifecycle(projectId, "executing")
  
  // 调用 LLM 生成计划
  const provider = await resolveLlmProvider()
  const prompt = await buildPlanPrompt(project, round)
  const plan = await provider.generatePlan({ prompt, projectId, purpose: "orchestrator" })
  
  // 保存计划
  await prisma.orchestratorPlan.create({
    data: {
      projectId,
      round,
      provider: provider.getStatus().provider,
      summary: plan.summary,
      items: plan.items,
    },
  })
  
  // 为每个计划项创建 McpRun 并投递 execution job
  const jobIds: string[] = []
  for (const item of plan.items) {
    const run = await mcpRunRepo.create({
      projectId,
      capability: item.capability,
      toolName: item.toolName,
      requestedAction: item.requestedAction,
      target: item.target,
      riskLevel: item.riskLevel,
      round,
    })
    
    // 检查是否需要审批
    if (await requiresApproval(project, item)) {
      await createApprovalForRun(project, run, item)
      continue  // 不投递 execution job，等审批通过后再投递
    }
    
    const job = await executionQueue.add("execute_tool", {
      projectId,
      mcpRunId: run.id,
    })
    await mcpRunRepo.update(run.id, { bullJobId: job.id, status: "scheduled" })
    jobIds.push(job.id!)
  }
  
  // 投递 round_completed job（等所有 execution job 完成后再运行）
  await lifecycleQueue.add("round_completed", {
    projectId,
    round,
  }, {
    delay: 5000,  // 给 execution jobs 一点时间启动
  })
  
  publishEvent({
    type: "plan_generated",
    projectId,
    timestamp: new Date().toISOString(),
    data: { round, itemCount: plan.items.length },
  })
  
  return { status: "planned", itemCount: plan.items.length }
}
```

#### Execution Worker

```typescript
// lib/workers/execution-worker.ts
import * as mcpRunRepo from "@/lib/repositories/mcp-run-repo"
import { analysisQueue } from "@/lib/infra/queues"
import { publishEvent } from "@/lib/infra/event-bus"
import { resolveConnector } from "@/lib/mcp/registry"

export async function handleExecuteTool(data: { projectId: string; mcpRunId: string }) {
  const { projectId, mcpRunId } = data
  const run = await mcpRunRepo.findById(mcpRunId)
  if (!run) throw new Error(`McpRun ${mcpRunId} not found`)
  
  // 更新状态
  await mcpRunRepo.update(mcpRunId, { status: "running", startedAt: new Date() })
  
  publishEvent({
    type: "tool_started",
    projectId,
    timestamp: new Date().toISOString(),
    data: { toolName: run.toolName, target: run.target, runId: mcpRunId },
  })
  
  try {
    // 解析连接器
    const connector = await resolveConnector(run.toolName)
    if (!connector) {
      await mcpRunRepo.update(mcpRunId, {
        status: "failed",
        error: `No connector found for ${run.toolName}`,
        completedAt: new Date(),
      })
      return
    }
    
    // 执行工具
    const result = await connector.execute({
      toolName: run.toolName,
      arguments: buildToolArguments(run),
    })
    
    if (result.status === "succeeded") {
      await mcpRunRepo.update(mcpRunId, {
        status: "succeeded",
        completedAt: new Date(),
      })
      
      // 投递分析 job
      await analysisQueue.add("analyze_result", {
        projectId,
        mcpRunId,
        rawOutput: result.rawOutput,
        toolName: run.toolName,
        target: run.target,
      })
    } else {
      await mcpRunRepo.update(mcpRunId, {
        status: "failed",
        error: result.error,
        completedAt: new Date(),
      })
    }
  } catch (error) {
    await mcpRunRepo.update(mcpRunId, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
      completedAt: new Date(),
    })
    throw error  // 让 BullMQ 决定是否重试
  }
  
  publishEvent({
    type: "tool_completed",
    projectId,
    timestamp: new Date().toISOString(),
    data: { toolName: run.toolName, runId: mcpRunId, status: run.status },
  })
}
```

#### Lifecycle Worker

```typescript
// lib/workers/lifecycle-worker.ts
import { planningQueue } from "@/lib/infra/queues"
import { publishEvent } from "@/lib/infra/event-bus"

export async function handleRoundCompleted(data: { projectId: string; round: number }) {
  const { projectId, round } = data
  const project = await projectRepo.findById(projectId)
  if (!project) return
  
  // 检查是否被停止
  if (project.lifecycle === "stopping" || project.lifecycle === "stopped") {
    return
  }
  
  // 等待所有 execution + analysis jobs 完成
  const runs = await mcpRunRepo.findByProjectAndRound(projectId, round)
  const hasActiveJobs = runs.some(r => ["pending", "scheduled", "running"].includes(r.status))
  
  if (hasActiveJobs) {
    // 还有未完成的 job，延迟后重新检查
    throw new Error("Active jobs still running")  // BullMQ 会重试
  }
  
  // 记录轮次结果
  await recordRoundResults(projectId, round, runs)
  
  // 决定是否继续
  const shouldContinue = await checkShouldContinue(project, round, runs)
  
  if (shouldContinue) {
    await planningQueue.add("plan_round", {
      projectId,
      round: round + 1,
    })
  } else {
    await lifecycleQueue.add("settle_closure", { projectId })
  }
}

export async function handleSettleClosure(data: { projectId: string }) {
  const { projectId } = data
  
  // 生成最终结论（LLM reviewer）
  // 导出报告
  // 更新 project.lifecycle = "completed"
  
  await projectRepo.updateLifecycle(projectId, "completed")
  
  publishEvent({
    type: "project_completed",
    projectId,
    timestamp: new Date().toISOString(),
    data: {},
  })
}
```

### Phase 4: SSE Endpoint

```typescript
// app/api/projects/[projectId]/events/route.ts
import { createSubscriber } from "@/lib/infra/event-bus"

export async function GET(req: Request, { params }: { params: { projectId: string } }) {
  const { projectId } = params
  
  const stream = new ReadableStream({
    async start(controller) {
      const subscriber = createSubscriber()
      
      await subscriber.subscribe(`project:${projectId}`)
      
      subscriber.on("message", (channel, message) => {
        controller.enqueue(`data: ${message}\n\n`)
      })
      
      // 心跳
      const heartbeat = setInterval(() => {
        controller.enqueue(": heartbeat\n\n")
      }, 15000)
      
      // 清理
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat)
        subscriber.unsubscribe(`project:${projectId}`)
        subscriber.quit()
        controller.close()
      })
    },
  })
  
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}
```

### Phase 5: MCP 连接器

```typescript
// lib/mcp/stdio-connector.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import type { McpConnector, ToolExecutionInput, ToolExecutionResult } from "./connector"

export class StdioMcpConnector implements McpConnector {
  readonly id: string
  readonly transport = "stdio" as const
  private client: Client | null = null
  
  constructor(
    private config: {
      serverName: string
      command: string
      args: string[]
    }
  ) {
    this.id = config.serverName
  }
  
  async execute(input: ToolExecutionInput): Promise<ToolExecutionResult> {
    const client = await this.ensureClient()
    
    try {
      const result = await client.callTool({
        name: input.toolName,
        arguments: input.arguments,
      })
      
      const textContent = result.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n")
      
      if (result.isError) {
        return { status: "failed", error: textContent, retryable: true }
      }
      
      return { status: "succeeded", output: result.content, rawOutput: textContent }
    } catch (error) {
      if (input.signal?.aborted) {
        return { status: "aborted" }
      }
      return {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        retryable: true,
      }
    }
  }
  
  async healthCheck() {
    try {
      const client = await this.ensureClient()
      await client.listTools()
      return { healthy: true }
    } catch (error) {
      return { healthy: false, error: error instanceof Error ? error.message : "Unknown" }
    }
  }
  
  async dispose() {
    if (this.client) {
      await this.client.close()
      this.client = null
    }
  }
  
  private async ensureClient(): Promise<Client> {
    if (this.client) return this.client
    
    const transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args,
    })
    
    this.client = new Client({ name: "pentest-platform", version: "2.0.0" })
    await this.client.connect(transport)
    return this.client
  }
}
```

---

## API 端点清单

| 方法 | 路径 | 说明 | 同步/异步 |
|------|------|------|----------|
| GET | /api/dashboard | 仪表盘聚合数据 | 同步 |
| GET | /api/projects | 项目列表 | 同步 |
| POST | /api/projects | 创建项目 | 同步 |
| GET | /api/projects/:id | 项目详情 | 同步 |
| PUT | /api/projects/:id | 更新项目 | 同步 |
| DELETE | /api/projects/:id | 删除项目 | 同步 |
| POST | /api/projects/:id/start | 启动项目 | 异步 (202) |
| POST | /api/projects/:id/pause | 暂停项目 | 异步 (202) |
| POST | /api/projects/:id/resume | 恢复项目 | 异步 (202) |
| POST | /api/projects/:id/stop | 停止项目 | 异步 (202) |
| GET | /api/projects/:id/approvals | 项目审批列表 | 同步 |
| GET | /api/projects/:id/assets | 项目资产 | 同步 |
| GET | /api/projects/:id/evidence | 项目证据 | 同步 |
| GET | /api/projects/:id/findings | 项目发现 | 同步 |
| GET | /api/projects/:id/mcp-runs | MCP 执行记录 | 同步 |
| GET | /api/projects/:id/orchestrator | 编排状态 | 同步 |
| GET | /api/projects/:id/llm-logs | LLM 调用日志 | 同步 |
| GET | /api/projects/:id/events | SSE 事件流 | SSE |
| PUT | /api/approvals/:id | 审批决策 | 异步 (202) |
| GET | /api/assets/:id | 资产详情 | 同步 |
| GET | /api/evidence/:id | 证据详情 | 同步 |
| GET | /api/settings/llm | LLM 配置 | 同步 |
| PUT | /api/settings/llm | 更新 LLM 配置 | 同步 |
| GET | /api/settings/mcp-tools | MCP 工具列表 | 同步 |
| POST | /api/settings/mcp-servers/register | 注册 MCP Server | 同步 |
| GET | /api/settings/system-status | 系统状态 | 同步 |
| GET | /api/settings/audit-logs | 审计日志 | 同步 |
| POST | /api/auth/login | 登录 | 同步 |
| POST | /api/auth/logout | 登出 | 同步 |
| GET | /api/health | 健康检查 | 同步 |

---

## 渗透测试流程阶段

系统支持的 9 个主阶段（按文档 `pentest-flow-complete.md` 定义）：

1. `scope_definition` — 授权与范围定义
2. `seed_intake` — 种子目标接收
3. `continuous_recon` — 持续信息收集
4. `scope_validation` — 目标关联与范围判定
5. `discovery` — 发现与指纹识别
6. `vuln_generation` — 待验证项生成
7. `approval_queue` — 审批前排队
8. `controlled_poc` — 受控 PoC 验证
9. `evidence_archive` — 证据归档与结果判定

每个阶段的进入和退出条件由 LLM 编排内核根据当前上下文判断。

---

## MCP 能力族

复用当前定义，不变更：

- 目标解析类
- DNS / 子域 / 证书情报类
- 端口探测类
- 资产探测类
- Web 页面探测类
- HTTP / API 结构发现类
- HTTP 数据包交互类
- TCP 数据包交互类
- 受控验证类
- 截图与证据采集类
- 报告导出类
- 外部情报查询类

---

## 关键实现注意事项

1. **不要在 API Route 中执行 LLM 调用或 MCP 工具调用** — 这是当前架构最大的问题
2. **每个 BullMQ job 必须是幂等的** — 相同输入执行两次不产生副作用
3. **所有数据库写操作使用事务** — 特别是涉及多表更新时
4. **错误必须显式处理** — 不允许空 catch 块
5. **状态一定用 enum** — 不允许中文字符串作为状态
6. **不存冗余字段** — 通过 Prisma include/join 获取关联数据
7. **LLM Prompt 从现有代码复用** — 不需要重新设计 prompt
8. **MCP 注册合同不变** — 外部 MCP Server 不需要任何改动

---

## docker-compose.yml

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: pentest
      POSTGRES_PASSWORD: pentest
      POSTGRES_DB: pentest
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://pentest:pentest@postgres:5432/pentest
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

  worker:
    build: .
    command: ["node", "worker.js"]
    environment:
      DATABASE_URL: postgresql://pentest:pentest@postgres:5432/pentest
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

volumes:
  pgdata:
  redisdata:
```
