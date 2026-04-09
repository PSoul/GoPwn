# 06 — 数据模型与存储

> GoPwn 使用 PostgreSQL 16 + Prisma 7.x 作为数据层，定义了 19 个数据模型和 9 个枚举类型，覆盖项目管理、资产发现、安全发现、工具执行、审批审计的完整数据需求。

---

## 6.1 数据库选型

| 选型 | 技术 | 理由 |
|------|------|------|
| 数据库 | PostgreSQL 16 | 成熟稳定、支持 LISTEN/NOTIFY（SSE 事件）、pg-boss 原生支持 |
| ORM | Prisma 7.x | TypeScript 类型安全、自动迁移、声明式 Schema |
| 适配器 | @prisma/adapter-pg | PrismaPg 驱动，连接池 max: 10 |
| 任务队列 | pg-boss 12.x | 基于 PostgreSQL 的作业队列，无需额外 Redis |

### 连接配置

```
DATABASE_URL=postgresql://pentest:pentest@localhost:5432/pentest?schema=public
```

Prisma 连接池配置：`max: 10, idleTimeoutMillis: 30000`，在高并发场景下避免连接耗尽。

## 6.2 枚举类型（9 个）

| 枚举 | 值 | 用途 |
|------|------|------|
| `ProjectLifecycle` | idle, planning, executing, waiting_approval, reviewing, settling, stopping, stopped, completed, failed | 项目生命周期 |
| `PentestPhase` | recon, discovery, assessment, verification, reporting | 渗透测试阶段 |
| `AssetKind` | domain, subdomain, ip, port, service, webapp, api_endpoint | 资产类型 |
| `FindingStatus` | suspected, verifying, verified, false_positive, remediated | 漏洞状态 |
| `Severity` | critical, high, medium, low, info | 严重程度 |
| `RiskLevel` | low, medium, high | 操作风险等级 |
| `ApprovalStatus` | pending, approved, rejected, deferred | 审批状态 |
| `McpRunStatus` | pending, scheduled, running, succeeded, failed, cancelled | 工具执行状态 |
| `LlmCallStatus` | streaming, completed, failed | LLM 调用状态 |

## 6.3 核心实体

### 6.3.1 Project — 项目

项目是 GoPwn 的顶层容器，代表一次渗透测试任务。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | cuid | 主键 |
| code | string (unique) | 项目编码 |
| name | string | 项目名称 |
| description | string | 项目描述（注入所有 LLM Prompt） |
| lifecycle | ProjectLifecycle | 当前生命周期状态 |
| currentPhase | PentestPhase | 当前渗透阶段 |
| currentRound | int | 当前轮次 |
| maxRounds | int (默认 10) | 最大轮次 |

**关联**: Target[], Asset[], Evidence[], Finding[], McpRun[], Approval[], OrchestratorRound[], LlmCallLog[], AuditEvent[], PipelineLog[]

### 6.3.2 Target — 目标

项目的渗透测试目标。

| 字段 | 类型 | 说明 |
|------|------|------|
| value | string | 目标值（IP / 域名 / URL） |
| type | string | 目标类型 |
| normalized | string | 归一化值 |

**唯一约束**: `[projectId, type, normalized]`

### 6.3.3 Asset — 资产（树形结构）

发现的资产支持树形结构，例如 domain → ip → port → service → webapp。

| 字段 | 类型 | 说明 |
|------|------|------|
| kind | AssetKind | 资产类型 |
| value | string | 资产值（如 192.168.1.1:80） |
| label | string | 显示标签 |
| parentId | string? | 父资产 ID（构成树） |
| confidence | float | 置信度 |
| metadata | json | 元数据 |

**唯一约束**: `[projectId, kind, value]`
**索引**: `[projectId, kind]`
**关联**: Fingerprint[] (指纹), children[] (子资产), Finding[], Evidence[]

### 6.3.4 Finding — 安全发现

| 字段 | 类型 | 说明 |
|------|------|------|
| status | FindingStatus | 状态流转: suspected → verifying → verified/false_positive |
| severity | Severity | 严重程度: critical → info |
| title | string | 漏洞标题 |
| summary | string | 漏洞摘要 |
| affectedTarget | string | 受影响目标 |
| recommendation | string | 修复建议 |

**索引**: `[projectId, status]`, `[projectId, severity]`
**关联**: Poc[] (验证代码), Asset?, Evidence?

**智能去重**: Finding 创建时执行三层去重 —
1. 精确匹配（title + affectedTarget）
2. normalizeTitle 模糊匹配（中英文同义词归一化，如"未授权访问" ↔ "unauthorized-access"）
3. tokenSimilarity 分词相似度（英文单词 + 中文 bigram，coverage ≥ 0.7 且互斥英文 token 守卫）

Severity 只升不降 — 已有 `medium` 的 Finding 被匹配为 `high` 时升级，反之不降级。

### 6.3.5 Evidence — 原始证据

| 字段 | 类型 | 说明 |
|------|------|------|
| title | string | 证据标题 |
| toolName | string | 产生证据的工具 |
| rawOutput | string | 原始输出 |
| summary | string | 摘要 |
| capturedUrl | string? | 截图 URL |

### 6.3.6 McpRun — MCP 工具执行记录

| 字段 | 类型 | 说明 |
|------|------|------|
| toolName | string | 工具名称 |
| target | string | 执行目标 |
| status | McpRunStatus | 执行状态 |
| riskLevel | RiskLevel | 风险等级 |
| phase | PentestPhase | 执行时的渗透阶段 |
| round | int | 所属轮次 |
| rawOutput | string? | 原始输出 |
| error | string? | 错误信息 |
| **stepIndex** | int? | ReAct 步骤序号（ReAct 新增） |
| **thought** | string? | LLM 推理内容（ReAct 新增） |
| **functionArgs** | json? | Function Call 原始参数（ReAct 新增） |

**索引**: `[projectId, status]`

### 6.3.7 Poc — 验证代码

| 字段 | 类型 | 说明 |
|------|------|------|
| code | string | PoC 代码 |
| language | string | 编程语言 |
| executionOutput | string | 执行输出 |
| succeeded | boolean | 是否验证成功 |

## 6.4 辅助实体

### 编排相关

| 模型 | 用途 | 关键字段 |
|------|------|---------|
| OrchestratorPlan | 编排计划（旧模型保留） | round, phase, items (JSON) |
| OrchestratorRound | 编排轮次 | round, phase, maxSteps, actualSteps, stopReason |

### 审批与审计

| 模型 | 用途 | 关键字段 |
|------|------|---------|
| Approval | 审批记录 | target, actionType, riskLevel, status, decisionNote |
| AuditEvent | 审计事件 | category, action, actor, detail |
| PipelineLog | 流水线日志 | jobType, stage, level, message, data, duration |

### LLM 与设置

| 模型 | 用途 | 关键字段 |
|------|------|---------|
| LlmCallLog | LLM 调用日志 | role, phase, prompt, response, model, durationMs |
| LlmProfile | LLM 配置 | provider, apiKey, baseUrl, model, temperature |
| GlobalConfig | 全局配置 | approvalEnabled, autoApproveLowRisk, autoApproveMediumRisk |

### MCP 管理

| 模型 | 用途 | 关键字段 |
|------|------|---------|
| McpTool | MCP 工具注册 | serverName, toolName, capability, inputSchema, enabled |
| McpServer | MCP 服务器 | serverName, transport, command, args, envJson |

## 6.5 实体关系图

```
Project ─1:N─→ Target
    │
    ├─1:N─→ Asset ──1:N──→ Fingerprint
    │         │ (self-ref: parent → children)
    │         ├─1:N─→ Finding ──1:N──→ Poc
    │         └─1:N─→ Evidence
    │
    ├─1:N─→ McpRun ──1:1──→ Approval
    │         ├─1:N─→ Evidence
    │         └─1:N─→ Poc
    │
    ├─1:N─→ OrchestratorRound
    ├─1:N─→ OrchestratorPlan
    ├─1:N─→ LlmCallLog
    ├─1:N─→ AuditEvent
    └─1:N─→ PipelineLog

McpServer ──1:N──→ McpTool ──1:N──→ McpRun

LlmProfile (独立配置表)
GlobalConfig (单例配置)
User (认证表)
```

## 6.6 索引策略

| 模型 | 索引 | 用途 |
|------|------|------|
| Asset | `[projectId, kind]` | 按类型查询项目资产 |
| Finding | `[projectId, status]` | 查询项目内特定状态的漏洞 |
| Finding | `[projectId, severity]` | 按严重程度排序 |
| McpRun | `[projectId, status]` | 查询项目内 pending/running 的执行 |
| Approval | `[projectId, status]` | 查询待审批项 |
| LlmCallLog | `[projectId, status]` | 查询 streaming 状态的调用 |
| PipelineLog | `[projectId, createdAt]` | 时间范围查询 |
| PipelineLog | `[projectId, round]` | 按轮次查询 |
| PipelineLog | `[level]` | 按日志级别筛选 |

## 6.7 数据库操作

```bash
# 查看/编辑数据（可视化）
npx prisma studio

# 修改 schema 后推送变更
npx prisma db push

# 生成 Prisma Client 类型
npx prisma generate

# 正式迁移（生产环境）
npx prisma migrate deploy

# 重置数据库（开发环境）
npx prisma db push --force-reset
```
