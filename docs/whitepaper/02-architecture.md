# 02 — 系统架构设计

> GoPwn 采用双进程 + 异步任务队列 + 事件驱动架构，核心编排引擎基于 ReAct 循环模型。

---

## 2.1 架构总览

GoPwn 运行时由两个独立进程组成，通过 PostgreSQL 进行通信：

```
┌──────────────────────────────────────────────┐
│  Next.js 进程 (API + SSR + SSE)              │
│  ├─ 36 个 API Routes (<5s 响应)              │
│  ├─ 16 个 SSR 页面                           │
│  └─ SSE 端点 (实时事件推送)                   │
└──────────────────┬───────────────────────────┘
                   │ pg-boss 任务队列
                   │ PostgreSQL LISTEN/NOTIFY
┌──────────────────▼───────────────────────────┐
│  Worker 进程 (长任务处理)                     │
│  ├─ ReAct Worker      (ReAct 循环执行)       │
│  ├─ Analysis Worker   (LLM 语义分析)         │
│  ├─ Verification Worker (PoC 验证)           │
│  └─ Lifecycle Worker  (轮次审阅 + 项目收尾)  │
└──────────────────────────────────────────────┘
```

### 为什么双进程

将 Web 服务和长任务处理拆分为独立进程，解决了 V1 架构中的核心问题：

| V1 问题 | V2 方案 |
|---------|---------|
| HTTP 请求内执行 5-30 分钟的渗透流程，超时崩溃 | Worker 独立进程，不受 HTTP 超时限制 |
| 进程崩溃后项目卡在"运行中"，无法恢复 | pg-boss 自动检测停滞任务并重试 |
| 所有状态存在内存中，无法水平扩展 | 无状态 Worker，状态全部持久化到 PostgreSQL |
| 工具执行并发竞争 | pg-boss 作业队列保证串行化 |

### 通信机制

两个进程之间的通信完全通过 PostgreSQL：

1. **pg-boss 任务队列** — Next.js 进程发布任务（如 `react_round`），Worker 进程消费任务。pg-boss 基于 PostgreSQL 实现，无需额外的 Redis 或 RabbitMQ。
2. **PostgreSQL LISTEN/NOTIFY** — Worker 进程通过 NOTIFY 发送实时事件，Next.js 进程通过 LISTEN 接收后推送给 SSE 客户端。
3. **共享数据库** — 两个进程读写同一个 PostgreSQL 数据库，通过 Prisma ORM 保证数据一致性。

## 2.2 领域分层

GoPwn 的 `lib/` 目录按领域组织为 9 个子目录：

```
lib/
├── domain/          纯领域逻辑（无 I/O 依赖）
│   ├── lifecycle.ts       生命周期状态机（10 状态 16 事件）
│   ├── phases.ts          渗透测试阶段定义（recon → reporting）
│   ├── scope-policy.ts    目标范围策略（自动推断 + 护栏）
│   └── errors.ts          领域异常类型
│
├── workers/         后台作业处理器
│   ├── react-worker.ts         ReAct 循环（处理 react_round）
│   ├── react-context.ts        上下文管理器（滑动窗口压缩）
│   ├── analysis-worker.ts      LLM 语义分析（处理 analyze_result）
│   ├── verification-worker.ts  PoC 验证（处理 verify_finding）
│   └── lifecycle-worker.ts     轮次审阅 + 收尾（处理 round_completed / settle_closure）
│
├── services/        应用服务层
│   ├── project-service.ts      项目 CRUD + 生命周期管理
│   ├── approval-service.ts     审批决策处理
│   ├── mcp-bootstrap.ts        MCP 服务器注册与工具发现
│   └── ...
│
├── repositories/    数据访问层（Prisma 封装）
│   ├── project-repo.ts         项目
│   ├── asset-repo.ts           资产（树形结构）
│   ├── finding-repo.ts         安全发现（含智能去重）
│   ├── mcp-run-repo.ts         MCP 执行记录
│   └── ...
│
├── llm/             LLM 调用与 Prompt 工程
│   ├── openai-provider.ts      OpenAI 兼容 SSE 流式客户端
│   ├── react-prompt.ts         ReAct 系统提示词构建器
│   ├── function-calling.ts     MCP → OpenAI functions 转换
│   ├── tool-input-mapper.ts    LLM 参数 → MCP 输入映射
│   ├── prompts.ts              Reviewer / Analyzer / Verifier 提示词
│   ├── call-logger.ts          LLM 调用日志装饰器
│   └── ...
│
├── mcp/             MCP 调度与连接
│   ├── registry.ts             工具注册表 + 能力推断
│   ├── stdio-connector.ts      stdio JSON-RPC 连接器
│   └── connector.ts            连接器接口定义
│
├── hooks/           React Hooks
│   ├── use-project-events.ts   SSE 项目事件订阅
│   └── use-react-steps.ts      ReAct 步骤实时展示
│
├── infra/           基础设施
│   ├── prisma.ts               PrismaClient 单例（PrismaPg, max: 10）
│   ├── job-queue.ts            pg-boss 作业队列封装
│   ├── event-bus.ts            进程内 EventEmitter SSE 事件总线
│   ├── pipeline-logger.ts      流水线结构化日志
│   ├── api-handler.ts          API 路由通用处理
│   └── ...
│
└── types/           TypeScript 类型定义
    └── labels.ts               UI 标签映射
```

### 分层原则

- **domain/** 包含纯逻辑，不依赖数据库或网络，所有函数都是纯函数，可直接单元测试
- **repositories/** 封装所有 Prisma 调用，返回领域对象而非原始数据库模型
- **services/** 组合 domain 和 repository，处理业务用例
- **workers/** 消费 pg-boss 任务，是平台执行渗透测试的实际入口
- **llm/** 封装所有 LLM 相关逻辑，包括 prompt 构建、API 调用、结果解析
- **infra/** 提供基础设施能力，对上层透明

## 2.3 项目生命周期状态机

GoPwn 使用纯函数状态机管理项目的完整生命周期。所有状态转换通过 `transition(current, event)` 纯函数完成，确保状态变更可预测、可测试。

### 10 个状态

| 状态 | 含义 |
|------|------|
| `idle` | 项目已创建，等待启动 |
| `planning` | （旧路径保留）LLM 正在生成执行计划 |
| `executing` | ReAct 循环正在执行，LLM 逐步调用工具 |
| `waiting_approval` | 高风险操作已暂停，等待人工审批 |
| `reviewing` | 本轮执行完毕，LLM Reviewer 正在审阅结果 |
| `settling` | 审阅决定结束，正在生成最终报告 |
| `completed` | 项目已完成 |
| `stopped` | 项目已被用户手动停止 |
| `stopping` | 正在执行停止操作（清理资源） |
| `failed` | 执行过程中发生不可恢复的错误 |

### 16 个事件

```
START_REACT:       idle       → executing     （直接跳过 planning）
CONTINUE_REACT:    reviewing  → executing     （轮次审阅后继续下一轮）
RETRY_REACT:       failed     → executing     （从失败状态重试）

START:             idle       → planning      （旧路径保留）
CONTINUE:          reviewing  → planning      （旧路径保留）
RETRY:             failed     → planning      （旧路径保留）
PLAN_READY:        planning   → executing
PLAN_FAILED:       planning   → failed

ALL_DONE:          executing  → reviewing
APPROVAL_NEEDED:   executing  → waiting_approval
RESOLVED:          waiting_approval → executing
SETTLE:            reviewing  → settling
SETTLED:           settling   → completed
FAILED:            settling   → failed
STOP / STOPPED:    *          → stopping → stopped
```

### 状态流转图（ReAct 路径）

```
        START_REACT
idle ──────────────→ executing
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
failed ────────────→ executing
```

### 关键设计决策

- **ReAct 事件跳过 planning** — `START_REACT`、`CONTINUE_REACT`、`RETRY_REACT` 三个事件直接从 `idle`/`reviewing`/`failed` 进入 `executing`，不经过 `planning` 状态。这是因为 ReAct 引擎将规划和执行合并为一个循环，不需要独立的规划阶段。
- **旧路径保留** — `START`、`CONTINUE`、`RETRY` 三个旧事件仍然存在，经过 `planning` 状态。这保证了向后兼容性，但当前所有新项目都使用 ReAct 路径。
- **纯函数实现** — `transition()` 函数不依赖任何外部状态，输入当前状态和事件，输出新状态。非法转换抛出 `DomainError`。

## 2.4 五实体领域模型

GoPwn 的数据模型围绕五个核心实体构建：

```
Project ←──────────────────────────────────────┐
    │                                           │
    ├── Target[]       项目目标（IP/域名/URL）    │
    ├── Asset[]        发现的资产（树形结构）      │
    │    ├── Fingerprint[]  资产指纹              │
    │    └── children[]     子资产（如 IP→Port）   │
    ├── Finding[]      安全发现                   │
    │    └── Poc[]          验证代码               │
    ├── Evidence[]     原始证据                   │
    ├── McpRun[]       工具执行记录               │
    │    └── stepIndex/thought/functionArgs (ReAct)│
    ├── Approval[]     审批记录                   │
    ├── OrchestratorRound[]  编排轮次             │
    ├── LlmCallLog[]   LLM 调用日志              │
    ├── AuditEvent[]   审计事件                   │
    └── PipelineLog[]  流水线日志                  │
```

| 实体 | 用途 | 关键字段 |
|------|------|---------|
| **Project** | 顶层容器，一次渗透测试任务 | lifecycle, currentPhase, currentRound, maxRounds, description |
| **Asset** | 发现的资产，支持树形结构 | kind (domain/ip/port/service/webapp...), value, parentId, fingerprints |
| **Finding** | 安全发现/漏洞 | severity (critical→info), status (suspected→verified/false_positive), affectedTarget |
| **Evidence** | 工具执行的原始证据 | toolName, rawOutput, summary |
| **McpRun** | 单次 MCP 工具执行记录 | toolName, status, rawOutput, stepIndex, thought, functionArgs |

## 2.5 异步任务流

GoPwn 使用 pg-boss 管理五种异步任务，形成完整的执行管线：

| 任务名 | 触发时机 | 处理 Worker | 并发数 | 产出 |
|--------|---------|-------------|--------|------|
| `react_round` | 项目启动 / 轮次继续 / 重试 | ReAct Worker | 3 | McpRun 记录 + analyze_result 任务 |
| `analyze_result` | 工具执行成功 | Analysis Worker | 5 | Asset + Finding + Evidence |
| `verify_finding` | 发现非 info 级别问题 | Verification Worker | 5 | PoC 验证结果 |
| `round_completed` | 本轮所有步骤完成 | Lifecycle Worker | 3 | 审阅决策 (continue/settle) |
| `settle_closure` | 审阅决定结束 | Lifecycle Worker | 1 | 最终报告 + completed 状态 |

### 任务流图

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

### 任务配置

| 参数 | 值 | 说明 |
|------|------|------|
| react_round 超时 | 1800s (30 min) | 单轮 ReAct 循环最大时长 |
| singletonKey | `react-round-{projectId}-{round}` | 防止重复发布同一轮次 |
| 分析等待 | 30s | 轮末等待未完成的 analyze_result 任务 |

## 2.6 实时事件系统

GoPwn 使用 SSE（Server-Sent Events）实现前端实时更新，无需轮询：

```
Worker 进程                    Next.js 进程                    浏览器
    │                              │                              │
    │  PostgreSQL NOTIFY           │                              │
    │  ─────────────────────────→  │                              │
    │                              │  SSE event stream            │
    │                              │  ─────────────────────────→  │
    │                              │                              │
    │  进程内 EventEmitter         │                              │
    │  (publishEvent)              │                              │
    │  ─────────────────────────→  │                              │
```

### SSE 事件类型

| 事件 | 触发时机 | payload |
|------|---------|---------|
| `react_step_started` | ReAct 步骤开始 | round, stepIndex, thought, toolName |
| `react_step_completed` | ReAct 步骤完成 | round, stepIndex, status, outputPreview |
| `react_round_progress` | 轮次进度更新 | round, currentStep, maxSteps |
| `round_reviewed` | 轮次审阅完成 | round, decision, reason |
| `lifecycle_changed` | 生命周期变更 | lifecycle |

前端通过 `useProjectEvents` Hook 订阅 SSE 端点，`useReactSteps` Hook 维护当前轮次的步骤列表和进度状态。

## 2.7 僵尸恢复机制

Worker 启动时和每 5 分钟周期性检查卡住的项目，执行自动恢复：

| 卡死状态 | 恢复策略 |
|---------|---------|
| `planning` | 发布 `react_round` 任务（旧状态兼容） |
| `executing` (无 pending run) | 触发 `round_completed`（ReAct 循环可能已完成但消息丢失） |
| `executing` (有 pending run) | 强制终止超时 run（>10 分钟），重新发布 `react_round` |
| `reviewing` | 重新触发 `round_completed` |
| `settling` | 重新触发 `settle_closure` |
| `stopping` | 强制转为 `stopped` |

此外，Worker 启动时还会清理超时的 LLM 调用日志（状态卡在 `streaming`），以及每 6 小时清理 30 天前的 debug 级别流水线日志。

## 2.8 V1 → V2 架构演进

GoPwn 经历了从 V1 到 V2 的完整架构重写：

| 维度 | V1 | V2（当前） |
|------|----|----|
| 进程模型 | 单进程（HTTP 请求内执行长任务） | 双进程（API + Worker 分离） |
| 编排方式 | 同步 while 循环在 HTTP 请求中 | ReAct 循环在 Worker 中 |
| 任务队列 | 手动 SchedulerTask + 租约机制 | pg-boss（PostgreSQL 原生） |
| 状态管理 | 隐式字符串条件分支 | 显式纯函数状态机（10 状态 16 事件） |
| 规划方式 | LLM 批量生成 N 个工具计划 | LLM 每步 Function Call，逐步执行 |
| 数据模型 | 13 个 JSON 列在 ProjectDetail 中 | 规范化表（19 个模型，9 个枚举） |
| MCP 连接器 | 10 个专用连接器 | 1 个通用 stdio 连接器 + 注册表 |
| 工具调用格式 | 自定义 JSON 结构 | 标准 OpenAI Function Calling |
| 错误处理 | `catch {}` 静默吞错 | 类型化 DomainError + 重试 |
| 代码量 | lib/ ~15,000 行 | lib/ ~7,700 行 |
