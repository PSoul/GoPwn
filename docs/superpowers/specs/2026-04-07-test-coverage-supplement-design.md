# GoPwn 测试覆盖补全方案

> 日期: 2026-04-07
> 状态: approved

## 背景

经过三轮代码审计 + 测试覆盖审查，发现当前 219 单元/集成测试 + 31 E2E 存在显著缺口：

- MCP 层（核心执行路径）：0/4 文件有测试
- LLM Provider 层：3/8 文件有测试
- API 路由：28 个路由零隔离测试
- 基础设施：1/11 文件有测试
- 源文件总体覆盖率约 44%

本方案设计完整的测试补全策略，目标将覆盖率从 44% 提升到 70%+。

## 设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 性能测试 | 组件级微基准（非端到端负载） | 单 Worker 单实例架构，无并发负载场景；组件微基准跑得快、无外部依赖、可放进 CI |
| React 组件测试 | 不补 | 101 个组件大多展示型，E2E 已覆盖交互；有逻辑的地方用 hook 测试覆盖 |
| API 路由 | 28 个全部测试 | 全量覆盖，不留盲区 |
| LLM Mock 策略 | 分层：unit 用 vi.mock，integration 用 msw | openai-provider 的 HTTP 序列化/反序列化需要 msw 验证；现有 unit 测试不改动 |
| Middleware 测试 | 通过路由测试间接覆盖 | 每个路由测试统一验证"无 token → 401"，自动覆盖认证逻辑 |
| CI 分层 | fast (unit) + full (all) | 开发时 `npm test` <10 秒快速反馈，CI 跑 full |
| 实施方式 | 按模块逐个补齐（非按测试层） | MCP/LLM 是最高风险，优先获得测试保护 |

## 模块设计

### 1. MCP 层（P0）

#### tests/unit/mcp/stdio-connector.test.ts

用 `vi.mock("child_process")` mock spawn，返回假的 stdin/stdout/stderr 流。

| # | 测试点 | 验证内容 |
|---|--------|----------|
| 1 | 正常 JSON-RPC 通信 | 发送请求，mock stdout 返回匹配 ID 的响应，promise resolve |
| 2 | 并发请求 ID 隔离 | 同时发 3 个请求（不同 ID），各自 resolve 到正确响应 |
| 3 | 请求超时 | mock stdout 不响应，超时后 promise reject + 进程被 kill |
| 4 | stdin.write 失败 → 进程清理 | mock stdin.write 回调 error，进程被 SIGKILL + pending reject |
| 5 | 进程异常退出 | mock 进程 emit exit，所有 pending reject + connector 不可用 |
| 6 | stderr 缓冲区消费 | stderr 数据被收集，不导致缓冲区溢出 |
| 7 | close() 清理 | 进程被 kill，后续调用 reject |

#### tests/unit/mcp/registry.test.ts

mock stdio-connector 和 mcp-tool-repo。

| # | 测试点 | 验证内容 |
|---|--------|----------|
| 1 | 首次 getConnector | spawn 一次 |
| 2 | 重复 getConnector | 命中缓存，不再 spawn |
| 3 | 并发 getConnector 去重 | 同时 2 个请求，只 spawn 一次（inflight dedup） |
| 4 | 禁用 server → 缓存淘汰 | enabled=false 时旧连接器被 close 并移除 |
| 5 | callTool 路由 | toolName → serverName 映射正确 |
| 6 | callTool 连接器不存在 | 返回错误而非崩溃 |
| 7 | closeAll 清理 | 所有缓存连接器被 close |

### 2. LLM 层（P0）

#### tests/integration/llm/openai-provider.test.ts

用 msw 拦截 `POST /chat/completions`。

| # | 测试点 | 验证内容 |
|---|--------|----------|
| 1 | 普通 chat 请求 | 解析出 content + model + durationMs |
| 2 | Function Calling 响应 | 解析出 functionCall.name + arguments |
| 3 | 自定义 baseUrl | 请求发到配置地址 |
| 4 | 超时处理 | msw 延迟超过 timeoutMs，abort + 错误消息 |
| 5 | HTTP 429 Rate Limit | 错误包装含 retry-after |
| 6 | HTTP 500 Server Error | 错误含状态码和响应体 |
| 7 | 畸形 JSON 响应 | 不崩溃，抛有意义的错误 |
| 8 | AbortSignal 中断 | 已 abort 的 signal，请求不发出 |

#### tests/unit/llm/react-prompt.test.ts

| # | 测试点 | 验证内容 |
|---|--------|----------|
| 1 | 基本构建 | messages 数组结构正确 |
| 2 | 工具列表注入 | enabled tools 格式化为 function definitions |
| 3 | 历史消息截断 | 超长历史被压缩/截断 |
| 4 | 无工具场景 | 空列表不崩溃 |
| 5 | 阶段上下文 | 不同 phase 生成不同指导策略 |

#### tests/unit/llm/system-prompt.test.ts

| # | 测试点 | 验证内容 |
|---|--------|----------|
| 1 | 模板渲染 | 占位符（target、scope）正确替换 |
| 2 | 不含具体攻击代码 | 输出无 curl/sqlmap/nmap 等具体命令 |

#### tests/unit/llm/prompts.test.ts

| # | 测试点 | 验证内容 |
|---|--------|----------|
| 1 | buildAnalyzerPrompt | 传入 rawOutput，返回结构正确 |
| 2 | buildReviewerPrompt | 传入 round summary，返回审阅提示 |
| 3 | buildVerifierPrompt | 传入 finding，返回 PoC 验证提示 |
| 4 | 空输入/异常输入 | null/undefined/空字符串不崩溃 |
| 5 | 不含具体攻击代码 | 所有 prompt 输出无具体攻击命令 |

### 3. API 路由全量测试（P0）

28 个路由聚合为 12 个测试文件，放在 `tests/integration/api/`。

策略：
- PGlite 内存数据库（复用 pglite-prisma.ts）
- 直接调用 route handler（传入构造的 NextRequest）
- 每个路由统一验证：无 token → 401

| 测试文件 | 覆盖路由 | Cases |
|----------|----------|-------|
| `auth.test.ts` | login, logout | 6 |
| `health.test.ts` | health | 2 |
| `projects-crud.test.ts` | projects list/create, [id] get/update/delete | 10 |
| `projects-lifecycle.test.ts` | start, stop | 10 |
| `projects-approvals.test.ts` | projects/[id]/approvals | 4 |
| `projects-assets.test.ts` | projects/[id]/assets | 4 |
| `projects-findings.test.ts` | projects/[id]/findings, evidence | 6 |
| `projects-logs.test.ts` | llm-logs, mcp-runs, pipeline-logs | 6 |
| `projects-misc.test.ts` | orchestrator, events, report-export, rounds/steps | 8 |
| `approvals-decision.test.ts` | approvals/[id] get/decide | 6 |
| `dashboard.test.ts` | dashboard, llm-logs/recent | 4 |
| `settings.test.ts` | llm, approval-policy, system-status, mcp-tools, mcp-servers, mcp-sync | 12 |

关键场景（projects-lifecycle.test.ts）：
1. start — 正常启动，lifecycle → running + job 发布
2. start — 重复启动已 running 的项目 → 400（lifecycle 状态机拒绝 running→running）
3. start — 项目不存在 → 404
4. stop — 运行中正常停止
5. stop — 已停止再 stop → 400（lifecycle 状态机拒绝 stopped→stopping）
6. stop — waiting_approval 下 stop，审批记录被清理
7. delete — 正常删除 + 审计记录
8. delete — 运行中删除 → 应返回 400 拒绝（需先 stop）
9. 无 token → 401
10. 非法 projectId → 404

关键场景（approvals-decision.test.ts）：
1. approve pending → 200 + 状态变更
2. reject pending → 200 + 状态变更
3. 并发 decide 同一审批（TOCTOU）→ 只有一个成功
4. 已决定再 decide → 400
5. 审批不存在 → 404
6. 无 token → 401

关键场景（auth.test.ts）：
1. 正确凭据 → 200 + cookie
2. 错误密码 → 401
3. 不存在账号 → 401
4. 空 body → 400
5. logout → 清除 cookie
6. 无 token → 401

### 4. Worker 入口 + react-context（P1）

#### tests/unit/worker.test.ts

mock pg-boss、prisma、registry。

| # | 测试点 | 验证内容 |
|---|--------|----------|
| 1 | recoverStaleProjects — 有 stale | 重新入队或标记 failed |
| 2 | recoverStaleProjects — 无 stale | 空跑不报错 |
| 3 | fatalShutdown | 调用 closeAll() + process.exit(1) |
| 4 | fatalShutdown — closeAll 抛异常 | best-effort 不二次崩溃 |
| 5 | handler 注册 | 注册 react_round/analyze_result/verify_finding/round_completed |

#### tests/unit/workers/react-context.test.ts

| # | 测试点 | 验证内容 |
|---|--------|----------|
| 1 | 短历史不压缩 | 原样返回 |
| 2 | 超长历史压缩 | 旧消息被摘要替代 |
| 3 | system 消息保留 | 压缩时不截断 |
| 4 | 工具调用结果保留 | 最近 N 轮 function call + result 不压缩 |
| 5 | 空历史 | 空数组不崩溃 |

### 5. Services（P1）

| 测试文件 | Cases | 类型 |
|----------|-------|------|
| `tests/integration/services/settings-service.test.ts` | 4 | integration |
| `tests/integration/services/dashboard-service.test.ts` | 3 | integration |
| `tests/integration/services/mcp-bootstrap.test.ts` | 3 | integration |
| `tests/unit/services/asset-service.test.ts` | 3 | unit |

### 6. Repositories（P1）

| 测试文件 | Cases | 类型 |
|----------|-------|------|
| `tests/integration/repositories/evidence-repo.test.ts` | 3 | integration |
| `tests/integration/repositories/llm-log-repo.test.ts` | 3 | integration |
| `tests/integration/repositories/mcp-tool-repo.test.ts` | 4 | integration |
| `tests/integration/repositories/pipeline-log-repo.test.ts` | 3 | integration |

### 7. Infrastructure（P1）

| 测试文件 | Cases | 类型 |
|----------|-------|------|
| `tests/unit/infra/event-bus.test.ts` | 3 | unit |
| `tests/unit/infra/abort-registry.test.ts` | 4 | unit |
| `tests/unit/infra/auth.test.ts` | 3 | unit |
| `tests/unit/infra/api-handler.test.ts` | 3 | unit |
| `tests/unit/infra/pg-listener.test.ts` | 3 | unit |

跳过（无业务逻辑）：prisma.ts、logger.ts、navigation.ts、api-client.ts、pipeline-logger.ts

### 8. Domain（P1）

| 测试文件 | Cases | 类型 |
|----------|-------|------|
| `tests/unit/domain/risk-policy.test.ts` | 3 | unit |
| `tests/unit/domain/scope-policy.test.ts` | 3 | unit |

### 9. 性能基准（P1）

新建 `tests/perf/` 目录，使用 vitest bench API（独立于 projects，通过 `vitest bench` 命令运行）。

在 vitest.config.mts 顶层 `test` 中添加 bench 配置：

```typescript
test: {
  // ... existing projects ...
  benchmark: {
    include: ["tests/perf/**/*.bench.ts"],
  },
}
```

| 测试文件 | 测量内容 | Cases |
|----------|----------|-------|
| `tests/perf/mcp-connector.bench.ts` | 单请求延迟(<5ms)、并发 10 请求吞吐、连接器冷启动 | 3 |
| `tests/perf/react-loop.bench.ts` | 单轮 ReAct 编排开销(<50ms)、5 轮增长线性度、压缩触发开销 | 3 |
| `tests/perf/job-queue.bench.ts` | 单次 publish 延迟、批量 100 publish、publish+fetch 往返 | 3 |

### 10. React Hooks（P2）

需要在 vitest.config.mts 中新增第三个 project（jsdom 环境）：

```typescript
{
  name: "hooks",
  include: ["tests/unit/hooks/**/*.test.{ts,tsx}"],
  environment: "jsdom",
  setupFiles: ["./tests/setup.ts"],
  testTimeout: 15_000,
}
```

`npm run test:unit` 改为 `vitest run --project unit --project hooks`。

| 测试文件 | Cases | 类型 |
|----------|-------|------|
| `tests/unit/hooks/use-project-events.test.ts` | 7 | unit (jsdom) |
| `tests/unit/hooks/use-react-steps.test.ts` | 3 | unit (jsdom) |

use-project-events 测试点：连接建立、接收事件、JSON 解析错误容错、断线 3s 重连、projectId 变更、null projectId、卸载清理。

### 11. E2E 补充（P2）

| 测试文件 | Cases |
|----------|-------|
| `e2e/project-detail.spec.ts` | 3 |
| `e2e/project-edit.spec.ts` | 3 |
| `e2e/user-management.spec.ts` | 3 |
| `e2e/report-export.spec.ts` | 2 |

## 测试助手扩展

`tests/helpers/` 新增：

| 文件 | 用途 |
|------|------|
| `msw-handlers.ts` | OpenAI API msw handler 集合（正常/429/500/畸形/function call） |
| `route-test-utils.ts` | 构造 NextRequest + 注入 auth token + 调用 route handler |
| `mock-event-source.ts` | EventSource mock class，支持 trigger onmessage/onerror/onopen |
| `mock-child-process.ts` | 模拟 spawn ChildProcess，可控 stdin/stdout/stderr 流 |

## package.json scripts 变更

```json
"test": "vitest run --project unit --project hooks",
"test:unit": "vitest run --project unit --project hooks",
"test:integration": "vitest run --project integration",
"test:full": "vitest run",
"test:perf": "vitest bench",
"test:e2e": "playwright test"
```

## 总量汇总

| 模块 | 新增文件 | 新增 Cases | 类型 |
|------|----------|-----------|------|
| MCP 层 | 2 | 14 | unit |
| LLM 层 | 4 | 20 | unit + integration(msw) |
| API 路由 | 12 | 78 | integration(PGlite) |
| Worker + react-context | 2 | 10 | unit |
| Services | 4 | 13 | integration + unit |
| Repositories | 4 | 13 | integration |
| Infrastructure | 5 | 16 | unit |
| Domain | 2 | 6 | unit |
| 性能基准 | 3 | 9 | bench |
| React Hooks | 2 | 10 | unit |
| E2E 补充 | 4 | 11 | e2e |
| **合计** | **44** | **~200** | — |

最终目标：~419 单元/集成 + 42 E2E + 9 性能基准

## 成功标准

1. `npm run test:full` 全部通过，零 skip、零 flaky
2. 源文件覆盖率 >= 70%（当前 ~44%）
3. P0 模块（MCP + LLM）覆盖率 >= 85%
4. 性能基准有基线数值，可在 CI 中对比回归
5. `npm run test:unit` 在 10 秒内完成

## 实施顺序

```
Phase 1 (P0): MCP 层 → LLM 层 → API 路由
Phase 2 (P1): Worker → Services → Repos → Infra → Domain → 性能基准
Phase 3 (P2): Hooks → E2E 补充
```

## 依赖

- msw (Mock Service Worker) — 新增 devDependency
- @testing-library/react — 新增 devDependency（hooks 测试）
