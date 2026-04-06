# GoPwn 综合测试方案设计

> 日期: 2026-04-06
> 状态: 已批准
> 范围: 后端核心 + 关键路径深度覆盖（不含前端组件测试）

## 1. 背景与目标

经过深度代码审计（10 个子系统，修复 12 个 bug），需要通过综合测试验证修复的正确性，并建立持续的质量保障体系。

**核心约束**：
- 性能测试不使用真实 LLM 调用（零成本）
- 数据库集成测试使用 PGlite（无需 Docker）
- 本地优先，CI 后续补充

**测试目标**：
- 单元测试覆盖所有 domain 逻辑和 worker 边界场景
- 集成测试验证真实 SQL 行为（upsert 竞态、原子更新）
- 性能测试验证 ReAct 循环吞吐量和并发隔离性

## 2. 测试现状

| 区域 | 现有测试 | 现有用例数 |
|------|----------|-----------|
| Worker 单元测试 | 3 文件 | 13 |
| E2E (Playwright) | 2 文件 | ~15 |
| MCP 服务器 | 57 文件 | ~100+ |
| Domain 层 | 0 | 0 |
| Service 层 | 0 | 0 |
| Repository 层 | 0 | 0 |
| API 路由 | 0 | 0 |
| LLM 模块 | 0 | 0 |
| 性能测试 | 0 | 0 |

## 3. 目录结构

```
tests/
├── setup.ts                          # 全局 setup（已有）
├── helpers/
│   ├── _helpers.ts                   # 现有 mock 工厂（迁移）
│   ├── pglite-prisma.ts             # PGlite + Prisma 集成工具
│   └── mock-llm.ts                  # LLM/MCP mock 工厂
├── unit/
│   ├── domain/
│   │   ├── lifecycle.test.ts        # 状态机全覆盖
│   │   ├── errors.test.ts           # 自定义错误类
│   │   ├── phases.test.ts           # 阶段流转
│   │   └── scope-policy.test.ts     # 作用域策略
│   ├── llm/
│   │   ├── call-logger.test.ts      # 调用日志
│   │   ├── function-calling.test.ts # 函数调用转换
│   │   └── tool-input-mapper.test.ts# 参数映射
│   └── workers/
│       ├── react-worker.test.ts     # ReAct 循环（新增）
│       ├── lifecycle-worker.test.ts # 生命周期（增强）
│       ├── analysis-worker.test.ts  # 分析（增强）
│       └── verification-worker.test.ts # 验证（增强）
├── integration/
│   ├── repositories/
│   │   ├── project-repo.test.ts
│   │   ├── finding-repo.test.ts
│   │   ├── approval-repo.test.ts
│   │   ├── asset-repo.test.ts
│   │   ├── mcp-run-repo.test.ts
│   │   └── audit-repo.test.ts
│   ├── services/
│   │   ├── project-service.test.ts
│   │   └── approval-service.test.ts
│   └── api/
│       ├── projects.test.ts
│       ├── approvals.test.ts
│       └── settings.test.ts
└── perf/
    ├── react-loop.perf.ts           # ReAct 循环吞吐量
    ├── concurrent-projects.perf.ts  # 并发隔离性
    └── job-queue.perf.ts            # pg-boss 压测
```

## 4. PGlite 集成测试基础设施

### 4.1 工作原理

1. 每个测试文件 `beforeAll` 启动一个 PGlite 内存实例
2. 读取 Prisma schema 生成 DDL，在 PGlite 上执行建表
3. 创建绑定到 PGlite 的 Prisma Client 实例
4. `vi.mock("@/lib/infra/prisma")` 替换全局 prisma 为测试实例
5. 每个 `beforeEach` 执行 TRUNCATE 清空所有表
6. `afterAll` 关闭 PGlite 实例

### 4.2 接口设计

```typescript
// tests/helpers/pglite-prisma.ts
export async function createTestDb(): Promise<{
  prisma: PrismaClient
  cleanup: () => Promise<void>
  truncateAll: () => Promise<void>
}>
```

### 4.3 关键设计决策

- **文件级隔离**：每个 .test.ts 文件独立 PGlite 实例
- **用例级清空**：同文件内 TRUNCATE 隔离，比重建实例快 10x
- **Schema 同步**：从 prisma/schema.prisma 生成 SQL，不依赖 migration 文件
- **枚举处理**：Prisma enum 先 CREATE TYPE 再建表

## 5. 单元测试用例（~75 个）

### 5.1 Domain 层（~20 个）

**lifecycle.test.ts**:
- 所有合法转换路径（idle→planning, planning→executing, executing→reviewing, ...）
- 所有非法转换抛 Error（idle→reviewing, stopped→executing, ...）
- `isTerminal()` 对每个状态的返回值
- `isActive()` 对每个状态的返回值
- 重复转换同一事件的行为

**errors.test.ts**:
- NotFoundError 属性和 HTTP 状态码 (404)
- DomainError 自定义状态码和错误码

**phases.test.ts**:
- 阶段顺序合法性
- 阶段标签映射

**scope-policy.test.ts**:
- IP/CIDR/URL/域名的判定规则

### 5.2 Worker 层（现有 13 → ~40 个）

**react-worker.test.ts**（新增）:
- 正常 ReAct 循环：plan → execute → analyze 完整链路
- LLM 返回 function_call → MCP 执行 → 结果反馈
- LLM 返回非法 JSON → 优雅降级
- abort 信号中断循环
- 项目已停止时跳过执行
- 工具执行失败 → 错误结果反馈给 LLM
- 达到 maxSteps 限制 → 循环终止

**现有 worker 补充边界用例**:
- verification: PoC 超时 → 状态回退到 suspected
- verification: 并发验证同一 finding → 只有一个执行
- analysis: LLM 返回重复 finding → 去重生效
- analysis: LLM 返回非法 severity enum → 处理
- lifecycle: 并发 round_completed → 不重复发布下一轮

### 5.3 LLM 模块（~15 个）

**call-logger.test.ts**:
- 正常调用 → 记录 prompt + response + model + duration
- 调用失败 → 记录 error、状态为 failed
- response 超长 → 截断到 100k
- functionCall 存在时 → 日志包含函数调用摘要

**function-calling.test.ts**:
- MCP 工具列表 → 正确转换为 OpenAI function schema
- 工具参数映射 → 类型正确传递

**tool-input-mapper.test.ts**:
- LLM 参数 → 正确映射到 MCP 工具输入
- 缺少必填参数 → 抛错或填默认值
- 多余参数 → 忽略

## 6. 集成测试用例（~40 个）

### 6.1 Repository 层（~20 个，PGlite）

**project-repo.test.ts**:
- CRUD：create → findById → findAll → updateLifecycle → deleteById
- targets JSON 字段正确存取
- deleteById 级联删除关联数据

**finding-repo.test.ts**:
- create + findByProject 基本流程
- normalizeTitle() 去重：中英文同义标题 → 同一 normalizedTitle
- 去重逻辑：同 projectId + 同 normalizedTitle → 不重复创建
- updateStatus 状态流转
- createPoc 关联 finding 和 mcpRun

**approval-repo.test.ts**:
- create + findByProject + findPending
- decide() 原子性：pending → approved 返回 count=1
- decide() 幂等性：已 approved 再 decide → 返回 count=0
- cancelPendingByProject()：只取消 pending，不影响已决策

**asset-repo.test.ts**:
- upsert：相同 (projectId, kind, value) → 更新而非新建
- 父资产关联：port 的 parentId 指向 ip
- countByProject 统计准确

**mcp-run-repo.test.ts**:
- 状态流转：scheduled → running → succeeded/failed
- cancelPendingByProject()：只取消 pending/scheduled
- checkAndPublishRoundCompletion()：全部完成才触发

**audit-repo.test.ts**:
- create + findByProject 基本流程
- 字段完整性（category, action, actor, detail）

### 6.2 Service 层（~12 个，PGlite + mock）

**project-service.test.ts**:
- createProject → 正确解析多目标（URL, IP, CIDR, 域名混合）
- createProject → 审计记录已创建
- startProject → idle 项目启动成功、发布 react_round job
- startProject → failed 项目重试（RETRY_REACT 事件）
- startProject → 非法状态抛错
- stopProject → 完整清理链路（abort + cancel runs + approvals + jobs）
- stopProject → cleanup 异常不阻塞状态转换
- deleteProject → 审计记录先于删除写入

**approval-service.test.ts**:
- decide → approved 更新状态
- decide → 并发 decide 同一审批 → 只有一个成功（TOCTOU 验证）
- decide → 已解决审批 → 409 错误
- decide → 最后一个审批完成 → 项目恢复 executing

### 6.3 API 路由（~8 个）

**测试方式**：直接 import route handler 函数，构造 NextRequest 对象调用。

**projects.test.ts**:
- POST /projects — 正常创建、缺少 name 返回 400
- POST /projects/[id]/start — 正常启动、项目不存在返回 404
- POST /projects/[id]/stop — 正常停止
- GET /projects — 列表返回

**approvals.test.ts**:
- PUT /approvals/[id] — 正常审批、缺少 decision 返回 400
- PUT /approvals/[id] — 并发审批返回 409

**settings.test.ts**:
- GET/PUT /settings/llm — 读取和更新 LLM 配置
- 非法 provider 值返回 400

## 7. 性能测试（3 个场景）

### 7.1 Mock 基础设施

```typescript
// tests/helpers/mock-llm.ts

// 可配置延迟的 mock LLM provider
export function createDelayedLlmProvider(options: {
  delayMs: number           // 模拟推理延迟
  responses: Map<string, string>  // role → 预录 JSON 响应
  failRate?: number         // 0-1，模拟随机失败
}): LlmProvider

// 可配置延迟的 mock MCP tool
export function createDelayedMcpTool(options: {
  delayMs: number
  output: string
  failRate?: number
}): MockCallTool
```

### 7.2 测试场景

**react-loop.perf.ts — 单轮 ReAct 吞吐量**:
- Mock LLM 延迟 50ms，Mock MCP 延迟 100ms
- 执行完整 ReAct round（3-5 步 function_call）
- 度量：端到端耗时、框架开销比（总耗时 - mock 延迟总和）
- 基线：框架开销 < 500ms
- 连续 10 轮取 P50/P95

**concurrent-projects.perf.ts — 并发隔离性**:
- 同时启动 5 个项目的 ReAct round
- 每个项目用不同 mock 响应
- 验证：5 个项目全部完成、findings/assets 不串数据、abort 一个不影响其余
- 度量：5 并发 vs 5 串行耗时比（期望 < 2x）

**job-queue.perf.ts — pg-boss 压测**:
- 100ms 内发布 100 个 job（混合类型）
- 验证：singletonKey 去重、30s 内消费完成、cancelByProject < 1s
- 度量：发布/消费吞吐量、取消延迟

### 7.3 配置

- 独立 config：`vitest.perf.config.mts`
- `testTimeout: 120_000`
- `fileParallelism: false`
- 不计入覆盖率

## 8. 测试数据工厂

### 8.1 已有工厂（保留）

- `mockProject(overrides?)` — 默认 planning 状态
- `mockMcpRun(overrides?)` — 默认 scheduled 状态
- `mockFinding(overrides?)` — 默认 suspected/high
- `mockLlmProvider(response)` — 固定响应 provider

### 8.2 新增工厂

- `mockApproval(overrides?)` — 默认 pending 状态
- `mockAsset(overrides?)` — 默认 port 类型
- `mockEvidence(overrides?)` — 默认含 rawOutput + toolName
- `mockLlmLog(overrides?)` — 默认 streaming 状态
- `mockAuditEntry(overrides?)` — 默认 project/created/user
- `mockUser(overrides?)` — 默认 researcher 角色

### 8.3 PGlite 专用 seeder

```typescript
export async function seedProjectWithFindings(prisma, options?: {
  findingCount?: number   // 默认 5
  assetCount?: number     // 默认 3
  withApprovals?: boolean // 默认 false
})
```

### 8.4 预录 LLM 响应

扩展现有 MOCK_PLAN_RESPONSE / MOCK_ANALYSIS_RESPONSE / MOCK_REVIEW_RESPONSE，新增：

- `MOCK_REACT_FUNCTION_CALL` — function_call 格式响应
- `MOCK_REACT_FINAL_ANSWER` — 结束循环的文本响应
- `MOCK_VERIFIER_POC` — PoC 代码生成响应
- `MOCK_INVALID_JSON` — 非法 JSON（测试降级）

## 9. Vitest 配置

### 9.1 主配置（vitest.config.mts 改造为 workspace）

```typescript
// unit project
{
  test: {
    name: "unit",
    include: ["tests/unit/**/*.test.ts"],
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 15_000,
  }
}

// integration project
{
  test: {
    name: "integration",
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30_000,
    fileParallelism: false,
  }
}
```

### 9.2 性能测试配置（vitest.perf.config.mts）

```typescript
{
  test: {
    include: ["tests/perf/**/*.perf.ts"],
    environment: "node",
    testTimeout: 120_000,
    fileParallelism: false,
  }
}
```

### 9.3 npm scripts

```json
{
  "test": "vitest run",
  "test:unit": "vitest run --project unit",
  "test:integration": "vitest run --project integration",
  "test:perf": "vitest run --config vitest.perf.config.mts",
  "test:coverage": "vitest run --coverage",
  "test:all": "npm run test && npm run test:perf && npm run lint && npx tsc --noEmit"
}
```

## 10. 覆盖率

- 工具：`@vitest/coverage-v8`
- 输出：`coverage/` 目录，HTML + text-summary
- 不设硬阈值，仅参考
- 排除：`tests/`, `lib/generated/`, `node_modules/`, `*.config.*`

## 11. 预估总量

| 类别 | 用例数 | 预计耗时 |
|------|--------|---------|
| 单元测试 | ~75 | < 10s |
| 集成测试 | ~40 | 30-60s |
| 性能测试 | ~10 | 2-3 min |
| **合计** | **~125** | **< 4 min** |

## 12. 实施顺序

1. 基础设施搭建（helpers/, vitest 配置, npm scripts）
2. Domain 单元测试（零依赖，最快出成果）
3. PGlite 集成工具
4. Repository 集成测试
5. Service 集成测试
6. Worker 单元测试增强
7. LLM 模块单元测试
8. API 路由测试
9. 性能测试 mock 基础设施
10. 性能测试场景

## 13. 不在范围内

- 前端 React 组件测试（E2E 已覆盖主要流程）
- MCP 服务器测试（各服务器已有独立测试）
- CI/CD pipeline 配置（后续单独处理）
- 覆盖率硬阈值（宽松模式）
