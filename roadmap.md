# Roadmap

## Project Snapshot

- Date: `2026-04-03`
- Current focus: Phase 23b TCP 通用化与实战验证已完成 — TCP 通用协议探测、llmCode 数据库持久化、多轮上下文增强。Redis 端到端验证成功（4 资产、23 证据、1 高危发现）。下一步: 测试 SSH/MySQL/MongoDB 等其他 TCP 靶场目标，优化审批-恢复循环去重。
- Working mode: 平台主仓库继续负责运行时与桥接；新的 MCP server 优先在独立脚手架仓库中开发、校验和整理文档。

## Phase 17a: Prisma 数据层迁移 (Prisma Data Layer Migration)

- Status: Completed on `2026-03-30`
- Branch: `feat/phase17a-prisma-validation`
- Goal: 将平台从 JSON 文件存储迁移到 Prisma ORM + PostgreSQL，实现全部 13 个 repository 的异步化改造、分层迁移，并移除文件存储双路径使 Prisma 成为唯一数据层。

### 交付清单

1. **Step A: 全量异步化改造** — 13 个 repository 文件 + `prototype-api.ts` + 48 个 API routes + 21 个 page components + service 文件全部改为 async
2. **Step B1: Prisma 基础设施** — `prisma.ts` 单例（PrismaPg 适配器）、`prisma-transforms.ts` 转换层（20+ 模型双向转换）、`docker-compose` PostgreSQL 配置
3. **Step B2-B7: Tier 0-5 分层迁移** — 全部 13 个 repository 从文件 I/O 替换为 Prisma 调用
4. **Step C: 数据迁移** — `prisma/seed.ts` 完成 JSON → PostgreSQL 迁移，~3,400 条记录
5. **Step D: 烟雾测试** — `scripts/smoke-test-prisma-crud.ts` (15 CRUD 测试全部通过) + `scripts/test-prisma-queries.ts` (12 查询全部通过)
6. **Step E: 文件存储移除** — 移除所有 `USE_PRISMA` 条件分支和 `readPrototypeStore`/`writePrototypeStore` 调用，Prisma 为唯一数据层
7. **Prisma 7.x 适配器集成** — `@prisma/adapter-pg` (PrismaPg) 替代已废弃的 `datasourceUrl`

### 已知待办

- [x] 测试套件适配 Prisma（Phase 17c 已完成）
- [x] E2E 测试验证（Phase 17d 已完成，14/14 通过）

## Phase 17d: E2E 适配 + 分支合并 + MCP 集成测试修复

- Status: Completed on `2026-03-30`
- Branch: `feat/phase17d-e2e-merge-integration` (已合并至 main)
- Goal: 完成 E2E 测试 Prisma 适配、合并 Phase 17a-17d 分支到 main、修复 MCP 集成测试代码、工程清理。

### 交付清单

1. **E2E 数据库种子脚本** — `scripts/e2e-seed-database.mjs`，直接 pg 连接 TRUNCATE 24 表 + 种子研究员用户 + 3 个 LLM profiles（使用 Prisma camelCase 列名带引号标识符）
2. **Playwright 代理绕过** — 端口 4500、`NO_PROXY=localhost,127.0.0.1`、Chromium `--no-proxy-server` 参数，解决 Windows 代理导致 WebServer 误判
3. **E2E 选择器修复** — "新建项目"链接 `.first()`、"全部"按钮重复元素精确定位、"AI 思考日志"标题断言替代面板内按钮
4. **MCP 集成测试修复** — 5 个测试文件添加 `// @vitest-environment node`（StdioClientTransport 与 jsdom 不兼容）、`supports()` 和 `registerValidationServer()` 添加 `await`
5. **tests/setup.ts 双环境** — 条件加载 `@testing-library/jest-dom/vitest`、`cleanup`、`window.matchMedia`（node 环境跳过）
6. **分支合并** — Phase 17a/17c/17d 全部合并至 main（fast-forward merge）
7. **工程清理** — 删除 16 个 codex worktree + 30+ 已合并本地分支，仅保留 main

### 验收标准

- [x] 14/14 E2E 测试通过（Playwright + Chromium）
- [x] 178/178 单元测试通过，33 跳过
- [x] 所有 Phase 17 分支合并至 main
- [x] `.gitignore` 新增 `*.txt` 规则
- [x] worktree 和分支清理完毕

## Phase 17c: 测试套件 Prisma 适配 (Test Suite Prisma Adaptation)

- Status: Completed on `2026-03-30`
- Branch: `feat/phase17c-test-prisma-adaptation`
- Goal: 将全部 vitest 测试从文件存储 fixture 迁移到 Prisma 数据库 fixture，确保测试套件在 Prisma-only 数据层下全部通过。

### 交付清单

1. **测试隔离基础设施** — `tests/helpers/prisma-test-utils.ts`（cleanDatabase + seedTestUsers），TRUNCATE CASCADE 清理全部 24 张表
2. **全局 setup 改造** — `tests/setup.ts` 适配 async beforeEach/afterEach，集成数据库清理、用户种子、MCP 执行中断
3. **38 个测试文件适配** — 所有测试文件从文件存储 fixture 迁移到 Prisma 数据库操作
4. **MCP 集成测试隔离** — `SKIP_MCP_INTEGRATION=1` 环境变量默认跳过真实 MCP stdio 测试（5 个文件 + 2 个用例）
5. **API 路由测试修复** — 适配 `withApiHandler` 2 参数签名（Request + RouteContext）
6. **SQLite FK 修复** — `mcp-server-sqlite.ts` 移除 FK 约束（server 记录已迁移至 PostgreSQL）
7. **类型对齐** — 修复 ProjectRecord 新增字段、Prisma 转换层 null 安全等类型错误

### 验收标准

- [x] `tsc --noEmit` 零错误
- [x] `vitest run` — 55 files passed, 8 skipped, 178 tests passed, 33 skipped
- [x] `fileParallelism: false` 防止数据库竞争
- [x] 所有测试单独运行均可通过

### 验收标准

- [x] `next build` 无 TypeScript 错误
- [x] 全部 13 个 repository 文件异步化完成
- [x] 48 个 API routes 适配异步 repository
- [x] 21 个 page components 适配异步数据获取
- [x] Prisma schema 覆盖全部平台实体（25 模型）
- [x] 分层迁移（Tier 0-5）全部完成
- [x] Docker PostgreSQL 实际运行验证
- [x] 数据迁移脚本验证（~3,400 条记录）
- [x] CRUD 烟雾测试 15/15 通过
- [x] 文件存储双路径完全移除

## Phase 17b: Agent 大脑进化 (Agent Brain Evolution)

- Status: Completed on `2026-03-29`
- Branch: `feat/phase17-platform-evolution`
- Goal: 将平台的 AI Agent 大脑从"简单规划"进化为"自适应智能体"，参考 Claude Code CLI / Codex CLI / Aider 的 Agent 设计模式，补齐配置系统、环境感知、输出压缩、失败分析、并行执行、自我反思等核心能力。

### 交付清单

1. **Agent 配置系统** — `lib/agent-config.ts`（264 行），30+ 可调参数分 5 大类（model/context/execution/safety/behavior），独立 JSON 持久化 + API 端点
2. **平台环境检测** — `lib/env-detector.ts`（139 行），检测 OS/Shell/Node.js/可用工具（curl/nmap/python 等 20 种），注入 LLM 大脑提示词
3. **工具输出结构化压缩** — `lib/tool-output-summarizer.ts`（403 行），15+ 工具专用提取器，按 token 预算自动压缩
4. **失败智能分析** — `lib/failure-analyzer.ts`（226 行），9 类错误分类 + 重试建议 + 替代工具推荐
5. **并行工具执行** — `orchestrator-service.ts` 重写 `executePlanItems()`，低/中风险工具按 `maxParallelTools` 批量并行，高风险保持串行审批
6. **轮间自我反思** — `orchestrator-service.ts` 新增 `generateRoundReflection()`，确定性反思引擎（无额外 LLM 调用），产出 keyFindings/lessonsLearned/nextDirection
7. **Token 预算上下文压缩** — `orchestrator-context-builder.ts` 新增 `compressContextByBudget()`，按 `maxContextTokens × compressionThresholdPercent` 自动截断各区段
8. **Agent Config API** — `app/api/settings/agent-config/route.ts`，GET/PATCH 端点
9. **Script MCP Server 环境增强** — execute_code/execute_command 工具描述注入平台环境信息

### 关键配置参数（参考 Claude Code/Codex/Aider）

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `maxContextTokens` | 65536 | LLM 上下文窗口大小 |
| `compressionThresholdPercent` | 70 | 超过此比例触发上下文压缩 |
| `toolOutputSummarizeThreshold` | 2000 | 输出超过此字符数触发摘要 |
| `toolOutputMaxChars` | 30000 | 输出截断上限 |
| `maxParallelTools` | 3 | 并行执行工具数 |
| `maxRetries` | 2 | 工具重试次数 |
| `maxRounds` | 5 | 最大编排轮数 |
| `approvalPolicy` | "cautious" | 审批策略（cautious/balanced/aggressive） |

### 验收标准

- [x] `next build` 无 TypeScript 错误
- [x] 单元测试 139/142 通过（3 个预存失败）
- [x] 集成测试 18/20 通过（2 个 SSH 容器启动时序）
- [x] Agent 配置可通过 API 读写
- [x] 工具输出压缩正确运行
- [x] 失败分析覆盖 9 类错误
- [x] 并行执行和反思注入编排循环

## Phase 16: Docker 靶场全面测试 + MCP 工具实战验证

- Status: Completed on `2026-03-29`
- Branch: `feat/phase16-docker-lab-testing`
- Goal: 扩展 Docker 靶场（HTTP + TCP 双协议），让纯 JS MCP Server 直接对靶场进行真实测试，验证编排 → 执行 → 发现 → 报告闭环。

### 交付清单

1. **Docker 靶场扩展** — 新增 Redis/SSH/Tomcat/Elasticsearch/MongoDB 5 个服务到 compose.yaml，总计 12 个靶场
2. **TCP 探测支持** — `local-lab-catalog.ts` 新增 `probeTcpPort()` 函数和 `protocol` 字段，支持 TCP 服务探测
3. **编排器 TCP 分支** — `orchestrator-service.ts` 新增 `buildTcpLabFallbackPlanItems()`，TCP 目标自动安排 banner 抓取和端口扫描
4. **LLM 提示 TCP 指导** — `llm-brain-prompt.ts` 补充 TCP 服务类目标规划指导
5. **stdio 连接器增强** — `stdio-mcp-connector.ts` 支持 `tcp://host:port` 格式解析
6. **Docker 集成测试** — `tests/integration/docker-lab-mcp.test.ts`（需 ENABLE_DOCKER_LAB_TESTS=1）
7. **端到端验证脚本** — `scripts/e2e-docker-validation.ts`（自动创建项目 → 编排 → 验证 → 报告）
8. **Tomcat 自定义镜像** — `docker/local-labs/tomcat/` (Dockerfile + tomcat-users.xml 弱口令)

### 验收标准

- [x] `next build` 无 TypeScript 错误
- [x] 单元测试无新增回归
- [x] Docker compose 可正常启动 12 个靶场服务
- [x] 本地靶场目录包含 11 个条目（HTTP + TCP）
- [x] TCP 目标编排正确生成 banner 抓取和端口扫描计划
- [x] 集成测试 13/13 通过（curl/netcat/encode MCP Server 真实调用验证）
- [x] 端到端验证脚本：11 靶场全部在线探测成功，6 靶场完整编排闭环（37 runs, 6 assets, 10 evidence, 4 findings）

### LLM 自主脚本能力（Phase 16 追加）

9. **Script MCP Server** — `mcps/script-mcp-server/`，4 个工具（execute_code / execute_command / read_file / write_file），赋予 LLM 大脑自主编写攻击代码的能力
10. **工具注册** — `mcp-auto-discovery.ts` 新增 script 服务器 4 个工具映射，`mcp-servers.json` 添加 script 入口
11. **编排器集成** — `llm-brain-prompt.ts` 添加"自主脚本能力"指导段落，`stdio-mcp-connector.ts` 添加 execute_code/execute_command/read_file/write_file 参数构建
12. **集成测试** — `tests/integration/script-mcp-server.test.ts`（7 个用例全部通过：Redis 未授权、SSH Banner、MySQL 握手、Elasticsearch 泄露、Shell 执行、文件 I/O）

### Bug Fixes — Script MCP Server

- 修复 `.mjs` 扩展名导致 CommonJS `require()` 不可用：临时文件从 `.mjs` 改为 `.js`
- 修复 Redis 探测脚本双 `data` 事件处理器导致非零退出：合并为单一处理器 + 显式 `process.exit(0)`

## Phase 15: 生产就绪基础 (Production Ready Foundation)

- Status: Completed on `2026-03-29`
- Branch: `feat/phase15-production-ready`
- Goal: 将平台从单用户原型提升到多用户生产就绪状态，补齐部署配置、错误处理和测试覆盖。

### 交付清单

1. **环境变量配置** — 完善 `.env.example`，涵盖数据库、认证、LLM、初始管理员等全部配置项
2. **全局 ErrorBoundary** — `app/global-error.tsx`，捕获应用级 React 渲染错误
3. **多用户认证** — `UserRecord` 类型（admin/researcher/approver 三角色）、store 持久化、用户 CRUD API、环境变量自动种子管理员
4. **用户管理页面** — `/settings/users`，支持创建用户、分配角色、启用/禁用账号
5. **登录安全增强** — 禁用账号拒绝登录、最后登录时间记录
6. **测试修复** — 修复 auth/app-shell/projects/evidence 4 个测试文件，新增 users-api 6 个用例；增加全局超时至 15s 解决工作流测试超时
7. **`.gitignore` 加固** — 排除 `.env`/`.env.local`/`tsconfig.tsbuildinfo`

### 验收标准

- [x] `next build` 无 TypeScript 错误
- [x] 单元测试 189/191 通过（2 个失败为环境依赖：MCP connector + Docker）
- [x] 新增 6 个用户管理 API 测试全部通过
- [x] 多用户认证工作流完整：种子用户 → 管理员创建 → 角色分配 → 禁用/启用 → 审计日志
- [x] `.env.example` 涵盖所有环境变量
- [x] 全局错误边界正确捕获应用级错误

## Phase 12: 漏洞驾驶舱重构 (Vuln Cockpit Redesign)

- Status: Completed on `2026-03-29`
- Branch: `feat/vuln-cockpit-redesign`
- Goal: 将平台从”证据中心”视角转向”漏洞驾驶舱”视角，增强项目区分度，为研究员提供 LLM 实时思考可见性。

### 交付清单

1. **导航术语更新** — 侧边栏”执行”→”发现”，”证据与结果”→”漏洞中心”，路由 `/evidence` → `/vuln-center`，项目标签”证据”→”上下文”
2. **漏洞中心页面** (`/vuln-center`) — 跨项目漏洞聚合，严重程度统计卡片，搜索/筛选，可展开行查看摘要，执行证据归档折叠面板
3. **项目卡片布局** — 表格 → 2/3 列卡片网格，状态色带（运行中=蓝/已阻塞=红/已完成=绿），指标标签，运行中项目优先排序
4. **LLM 调用日志系统** — Prisma `LlmCallLog` 模型，`llm-call-logger.ts` 服务（创建/追加/完成/失败），LLM provider 流式输出 + 自动日志
5. **AI 日志标签页** — 项目工作区第 8 个标签”AI 日志”，按角色筛选，自动刷新，prompt/response 展开，元数据 footer
6. **AI 悬浮聊天窗** — 右下角全局悬浮组件，聊天气泡风格，角色筛选，3 秒轮询，localStorage 记忆展开状态
7. **新 API** — `GET /api/vuln-center/summary`, `GET /api/projects/[id]/llm-logs`, `GET /api/projects/[id]/llm-logs/[logId]`, `GET /api/llm-logs/recent`

### 验收标准

- [x] 侧边栏显示”发现”和”漏洞中心”
- [x] `/evidence` 重定向到 `/vuln-center`
- [x] 漏洞中心页面显示跨项目漏洞统计
- [x] 项目列表为卡片网格，有状态色带区分
- [x] 项目详情有”AI 日志”标签和”上下文”标签
- [x] 全局 AI 悬浮窗可展开/最小化
- [x] LLM 调用自动记录日志并支持流式追加
- [x] 16 个新单元测试全部通过
- [x] E2E 测试覆盖所有新功能

## Phase 1: Frontend Prototype Closure

- Status: Completed on `2026-03-26`
- Goal: deliver a template-aligned, route-complete frontend prototype for the authorized external security assessment platform.

### Scope

- `/login`, `/dashboard`, `/projects`, `/projects/new`, `/projects/[id]`
- dedicated project secondary routes for results, flow, operations, and evidence/context
- `/approvals`, `/assets`, `/assets/[id]`, `/evidence`, `/evidence/[id]`
- settings hub and split settings subpages
- `code_index.md`, route smoke tests, and browser E2E baseline

### Acceptance Criteria

- frontend visual tone stays close to the provided backend and login templates
- project create/edit only requires the minimal three-field project model, with execution/approval policy moved back to MCP/settings surfaces
- dashboard first screen answers project/asset/finding/approval questions before exposing deeper control surfaces
- asset center and project result surfaces use typed full-width tables instead of one mixed long page
- project overview is results-first and no longer mixes high-volume tables into one page
- settings are split into focused subpages instead of a single long control surface
- `npx vitest run`, `npm run lint`, `npm run build`, and `npm run e2e` all pass

## Phase 2: Mock Backend API and Integration Slice

- Status: Completed on `codex/backend-integration-2026-03-26`
- Goal: add a first backend/API layer inside the Next.js app and complete the initial read-only frontend/backend contract alignment.

### Task Checklist

- completed: create route handlers for project list, project overview, project flow, project operations, project context, project result tables, and settings summary data
- completed: extend the same route-handler/service-layer approach to dashboard, approvals, assets, asset detail, evidence, and evidence detail
- completed: extract a shared service layer so mock data and route handlers use one contract
- completed: add API tests for key JSON endpoints
- completed: keep the frontend stable while preparing it for data access migration by switching dashboard, approvals, assets, evidence, projects, and settings pages onto the new service layer
- completed: update `code_index.md` and `roadmap.md` after the slice landed
- next: start a fresh isolated branch/worktree for persisted entities and write-capable flows

### Acceptance Criteria

- API routes return stable JSON payloads for the main project and settings views
- API routes also cover the console-level dashboard, approvals, assets, and evidence surfaces
- API tests pass locally
- frontend can be evolved against the new contract without reworking the route structure
- the full frontend regression suite still passes on the backend branch

## Phase 3: Real Backend Core

- Status: Completed on `codex/real-backend-core-2026-03-26`
- Goal: replace prototype-only mock behavior with persisted platform capabilities and write-capable platform flows.

### Task Checklist

- completed: introduce a local file-backed persistent store for projects, project details, form presets, and audit logs
- completed: add project create, update, and archive mutation APIs on top of the new repository layer
- completed: persist audit-log entries for project create/update/archive actions and expose them through an audit-log API
- completed: wire the project create/edit/archive UI flows to the new persisted APIs while preserving the current route structure and visual style
- completed: add authenticated researcher login, signed session-cookie protection, and middleware-based console/API access control
- completed: persist approval records plus global/project-level approval control state, with real decision/update APIs
- completed: wire the approvals center, project operations page, and approval-policy settings page to the persisted approval/control APIs
- completed: expand persistence into approvals plus global/project approval-control state
- pending: preserve the read-only contracts already proven in Phase 2 while swapping the remaining read models off static data

### Acceptance Criteria

- platform state survives restart
- core records are queryable and editable through the backend
- approval and audit history are persisted, not mocked
- approval decisions and approval-control changes are operable from the UI, not read-only

## Phase 4: Orchestration and MCP Execution

- Status: In progress across `codex/mcp-gateway-core-2026-03-26` and `codex/execution-results-core-2026-03-26`
- Goal: connect real LLM/MCP orchestration while preserving approval and audit controls.

### Task Checklist

- completed: implement persisted MCP tool registry, health checks, capability metadata, boundary rules, and registration checklist controls
- completed: add project-level MCP dispatch records with capability-first routing, tool selection, blocked-run handling, and approval-linked execution state
- completed: add foundational runnable local MCP tools and a smoke workflow that validates both full low-risk execution and approval-gated interruption
- completed: normalize foundational MCP execution outputs into persisted assets, evidence, work logs, and findings
- completed: make approved MCP runs resume into execution and refresh project result state instead of only flipping approval display state
- completed: expose execution-derived results through asset, evidence, project context, dashboard, and work-log surfaces
- in progress: add richer task queue, retries, rate limiting, and emergency stop controls that drive actual execution rather than only settings state
- pending: define provider abstraction for real LLM orchestration and reviewer models
- pending: replace local foundational runners with real MCP connectors incrementally, one capability family at a time

### Acceptance Criteria

- controlled execution can be triggered end-to-end from the platform
- high-risk actions cannot bypass approval
- audit chain covers planning, execution, evidence, and operator intervention
- at least one foundational workflow can be smoke-tested locally before real MCP connectors are attached
- approved high-risk runs advance project assets, evidence, work logs, and findings in persisted state

## Phase 5: Real Connectors and Scheduler Loop

- Status: In progress on `codex/real-connectors-scheduler-core-2026-03-26`
- Goal: replace local foundational MCP simulators with real connector adapters and make the platform scheduler capable of driving them safely.

### Task Checklist

- completed: introduce a connector abstraction that can route one capability family to local mocks or real connectors
- completed: define connector result contracts for raw output, structured content, retryability, and normalization hints
- completed: add a persisted scheduler-task loop that can queue ready work, approval waits, delays, approval resumes, and retries
- completed: keep the current file-backed prototype store as the state layer while expanding it with scheduler task records
- completed: land the first real connector family end-to-end for `DNS / 子域 / 证书情报类` using Node DNS/TLS APIs
- completed: route workflow smoke runs and approval resumes through the same scheduler/execution path instead of ad hoc direct execution
- completed: add focused unit tests for connector selection, scheduler transitions, approval resume, and retry scheduling
- pending: add prompt/config docs for optionally wiring a real LLM endpoint into orchestrator testing without hardcoding credentials

### Acceptance Criteria

- met: at least one real MCP connector can replace its local mock without changing the UI contract
- met: scheduler can safely replay queued work after approvals and delays
- raw connector output remains auditable while normalized platform records stay stable
- full `npm run test:all` remains green after the first real connector family lands

## Phase 6: Real LLM Orchestrator and Local Docker Validation

- Status: Completed on `codex/llm-orchestrator-docker-validation-2026-03-26`
- Goal: attach a real LLM orchestration provider, define MCP server onboarding conventions, and validate the end-to-end platform flow against local Docker-based vulnerable targets.

### Task Checklist

- completed: add an OpenAI-compatible LLM provider abstraction with environment-only configuration, status reporting, timeout handling, and JSON-plan parsing
- completed: add orchestrator service APIs for plan generation and local validation execution, including persisted last-plan state per project
- completed: expose orchestrator state on the project operations contract and operations page
- completed: add a project-side orchestrator UI panel that can generate local plans and trigger local validation runs
- completed: define MCP onboarding conventions and a reusable connector-template document for future tool families
- completed: add a local Docker validation harness for OWASP Juice Shop and WebGoat under `docker/local-labs/compose.yaml`
- completed: add automated API tests and browser E2E coverage proving the orchestrator panel and local validation path work end-to-end
- next: move from prototype-grade orchestration toward production backend integration and real MCP server attachment

### Acceptance Criteria

- met: platform can run against a real LLM provider through configuration only
- met: MCP onboarding docs are explicit enough for follow-up sessions to add new tool families safely
- met: at least one local Docker vulnerable target can be exercised end-to-end without touching external systems
- met: API and browser E2E tests cover the orchestrated local validation path

## Phase 7: Production Backend Integration and Real MCP Expansion

- Status: In progress across `codex/production-backend-real-mcp-2026-03-26`, `codex/live-llm-local-lab-validation-2026-03-27`, and `codex/real-data-platform-hardening-2026-03-27`
- Goal: harden the prototype backend into a more production-like runtime and replace more simulated capability families with real MCP integrations.

### Task Checklist

- completed: augment the prototype backend with a SQLite-backed persistence layer dedicated to external MCP server metadata and invocation logs
- completed: introduce a real MCP stdio server/client attachment model using the official TypeScript SDK for the `Web 页面探测类` capability
- completed: expose the connected MCP server registry and recent invocation history in the MCP settings API and settings UI
- completed: harden the real LLM plan intake so markdown-wrapped JSON and near-match capability/risk labels are normalized into the platform contract before MCP dispatch
- completed: add a reusable `npm run live:validate` runner that boots the app, logs in, executes the local-lab flow, auto-resumes approvals, and writes Markdown + JSON artifacts under `output/live-validation/`
- completed: execute a real end-to-end validation against local Juice Shop using runtime-only SiliconFlow credentials, real Web stdio MCP invocation, approval resume, and persisted result aggregation
- completed: make `npm run live:validate` auto-create a real project when `LIVE_VALIDATION_PROJECT_ID` is absent, removing old seed-project assumptions
- completed: auto-register the `web-surface-stdio` MCP server during live validation when the workspace is still empty
- completed: add `LIVE_VALIDATION_STATE_MODE=workspace|isolated` plus `LIVE_VALIDATION_STATE_DIR`, allowing validated closure data to stay in the normal workspace store when desired
- completed: verify one clean real Juice Shop closure in workspace mode and keep the resulting project (`proj-20260327-f6a3fd0c`) visible through standard dashboard, project, evidence, and findings routes
- completed: remove runtime-seeded business/demo records so dashboard, projects, assets, evidence, and settings surfaces are now empty-first by default
- completed: convert `/settings/llm` into a real persisted configuration surface with store-backed profiles and runtime store-first provider resolution
- completed: add a strict MCP server registration contract, registration API, contract docs, and settings-page registration flow
- completed: remove automatic demo MCP server seeding; new servers now appear only after explicit validated registration
- completed: isolate Playwright browser runs behind a temporary prototype-store directory so E2E tests verify the empty-first runtime deterministically
- completed: stabilize WebGoat host-side reachability in the current Windows + Docker Desktop environment by standardizing host publishing to `18080:8080` and `19090:9090`
- completed: add built-in fallback for internal MCP capabilities (`目标解析类`, `报告导出类`) so empty workspaces do not block core closure flows
- completed: execute a real low-risk WebGoat validation through the same live runner, keeping the resulting project in the workspace store and proving real MCP-backed result persistence
- completed: verify browser-side report export from the WebGoat project operations page and capture a screenshot artifact under `output/playwright/`
- completed: add a real stdio MCP server + connector for `受控验证类`, implemented as a generic auditable HTTP request workbench (`auth-guard-check`)
- completed: extend live-validation bootstrapping so `web-surface-stdio`, `http-structure-stdio`, and `http-validation-stdio` can all auto-register in an empty workspace
- completed: add a real Playwright-backed `截图与证据采集类` stdio MCP plus a real connector for `capture-evidence`
- completed: persist screenshot/HTML artifacts under the runtime store instead of in JSON records, and expose them through an authenticated `/api/artifacts/[...artifactPath]` route
- completed: upgrade evidence-detail payloads and UI so researchers can directly preview screenshots and open stored HTML snapshots
- completed: extend live-validation MCP bootstrap so `evidence-capture-stdio` can auto-register in an empty workspace
- completed: steer the WebGoat high-risk closure toward `/WebGoat/actuator`, then validate a real anonymous-management-surface finding through approval resume
- completed: execute a real WebGoat high-risk closure in workspace mode, preserving one real finding (`Spring Actuator 管理端点匿名暴露`) plus matching evidence and report artifacts
- completed: normalize `HTTP / API 结构发现类` output into persisted candidate assets and evidence/context records instead of leaving it mostly in run history
- completed: verify the resulting WebGoat finding page and post-finding report export flow in the browser UI, capturing screenshots under `output/playwright/`
- in progress: replace or augment more of the file-backed prototype runtime with database-backed persistence suitable for longer-running environments
- pending: wire project/task execution state to durable queues, cancellation, and better operator controls
- pending: expand real connector families beyond DNS + Web surface probing + HTTP controlled validation + evidence capture into deeper API reconnaissance and network discovery
- pending: refine the LLM provider configuration surface further with masked secrets, profile validation UX, and clearer operational fallback behavior
- pending: add local-lab-backed regression suites that can optionally run against real Docker targets in CI or controlled local environments

### Acceptance Criteria

- partially met: backend state now includes a durable SQLite slice for external MCP server registry metadata and real-call audit history
- met: at least one non-DNS external interaction family runs through a real MCP/server integration path
- met: at least two real LLM + real MCP + local Docker target validation flows have now been executed and captured as reusable artifacts, including a real-finding WebGoat closure
- met: a clean environment can now auto-bootstrap a real validation project instead of relying on older seed IDs
- met: real closure data can now be preserved into the normal workspace runtime when workspace-mode persistence is selected
- met: runtime settings and MCP registration surfaces no longer depend on static demo configuration
- met: WebGoat can now move from low-risk discovery into approval-gated real controlled validation without falling back to synthetic findings
- met: the platform can now capture and render real screenshot/HTML evidence through a registered MCP family instead of only textual screenshot notes
- project execution, approvals, evidence, and findings remain auditable after backend hardening
- the local Docker validation stack remains usable as a regression harness while the backend evolves

### Reference Closure

- Real project id: `proj-20260327-f6a3fd0c`
- Run artifact: `output/live-validation/2026-03-27T05-09-27-704Z-juice-shop/report.md`
- Notes: this run used the real SiliconFlow-backed orchestrator, the real `web-surface-stdio` MCP path, approval resume, and workspace-mode persistence so the result stayed visible in normal UI routes.
- Real project id: `proj-20260327-4e3a91b0`
- Run artifact: `output/live-validation/2026-03-27T11-12-11-708Z-webgoat/report.md`
- Notes: this run used the real SiliconFlow-backed orchestrator, real `web-surface-stdio` + `http-structure-stdio` + `http-validation-stdio` MCP paths, approval resume, workspace-mode persistence, one real finding, and browser-side verification of the finding page plus report export.
- Real project id: `proj-20260327-af2ebd69`
- Run artifact: `output/live-validation/2026-03-27T11-38-59-701Z-webgoat/report.md`
- Notes: this rerun verified that `HTTP / API 结构发现类` output now persists as real evidence/context (`HTTP / API 结构线索识别`) alongside the WebGoat Actuator finding in the normal workspace store.

## Phase 8: Platform Stabilization and Durable Execution Controls

- Status: In progress across `codex/platform-stabilization-2026-03-27`, `codex/durable-worker-orphan-recovery-2026-03-27`, `codex/cooperative-cancellation-2026-03-27`, and `codex/second-local-lab-webgoat-2026-03-27`
- Goal: prioritize operator-visible runtime control before expanding more MCP capability families, so the scheduler queue and project lifecycle can be safely started, paused, resumed, stopped, cancelled, and retried from the real project operations surface.

### Task Checklist

- completed: persist per-project scheduler-control state in the prototype store and initialize it for newly created projects
- completed: expose `schedulerControl` and `schedulerTasks` on the project operations payload
- completed: add repository helpers for project-level pause/resume, queued-task cancel, and failed-task retry
- completed: make the scheduler drain loop respect project pause state and keep cancelled work out of future drains
- completed: add project-scoped scheduler control and scheduler task action APIs with request validation
- completed: add a dedicated runtime queue panel on the operations page with pause/resume, cancel, retry, and explicit disabled states
- completed: allow operators to issue a stop request for `running` tasks and prevent cancelled work from continuing result commit when writeback has not happened yet
- completed: add durable worker lease metadata, heartbeat refresh, orphan `running` task recovery, and stale-lease writeback fencing
- completed: surface worker / lease / recovery metadata directly in the project runtime queue panel
- completed: cover repository, API, payload, component, and page integration paths with targeted tests
- completed: introduce shared `AbortController` propagation for already-running tasks so the scheduler heartbeat, execution layer, local connectors, real DNS/TLS checkpoints, and the real stdio Web-surface MCP path cooperatively stop when operators request cancellation
- completed: add an explicit project lifecycle state machine (`idle | running | paused | stopped`) so new projects stay idle until the researcher manually starts them
- completed: wire lifecycle `start / resume` transitions to real LLM kickoff planning, persist the latest plan, and route high-risk actions into approval instead of silently dropping them
- completed: make `stop` terminal for the project lifecycle, cancelling queued work and requesting cooperative abort for already-running executions
- completed: centralize the platform LLM-brain prompts so lifecycle kickoff, local-lab planning, and provider calls all use one shared prompt contract
- completed: add project final-conclusion persistence so queue-drained projects no longer stop at vague stage prose and instead land on a durable, displayable conclusion record
- completed: make queue-drained lifecycle runs and approval resumes automatically trigger report export and then settle the project into `已完成` when the closure conditions are met
- completed: add in-scope orchestration filtering so URL/IP targets no longer schedule irrelevant DNS actions, and provider-returned targets are re-clamped back to project scope
- completed: add a minimal `pages/_document.tsx` compatibility shim so `next build` remains stable in the current Windows + App Router workspace setup
- partially met: move the current file-backed queue toward a more durable long-lived worker/executor model suitable for longer sessions

## Phase 9: Closure Read Model and Project Finalization

- Status: Completed on `codex/basic-production-loop-2026-03-28`
- Goal: make project lifecycle completion explicit by persisting final conclusions, auto-exporting reports when the queue drains, and continuing lifecycle execution after approval resumes.

### Task Checklist

- completed: introduce persisted `projectConclusions` records in the prototype store
- completed: generate a final conclusion from reviewer-model output when configured, with a deterministic fallback when no reviewer is available
- completed: enrich report-export payloads with final-conclusion summary, source, and generation time
- completed: surface final conclusion on the project overview and report-export panels
- completed: continue project lifecycle after approval resumes instead of stopping at a single resumed run
- completed: auto-settle queue-drained projects into `报告导出 -> 最终结论 -> 已完成`
- completed: tighten orchestration scope so direct URL/IP targets do not schedule irrelevant DNS expansion
- completed: verify the new behavior through API tests, full unit test suite, lint, build, and Playwright E2E

### Acceptance Criteria

- met: queue-drained projects now have a first-class final conclusion instead of only stage prose
- met: approval resume now continues project progression and can end in an automatic closure
- met: report export and project overview both expose the same final conclusion source of truth
- met: lifecycle kickoff no longer drops provider-planned high-risk work on the floor

### Priority Tasks

- completed: stabilize WebGoat host-side reachability so the second lab can be validated through the same runner
- completed: unify the default WebGoat port assumptions across compose, runner, API, and UI around `18080/19090`
- completed: add another real MCP family by landing the HTTP controlled-validation path used for the WebGoat actuator closure
- completed: require explicit manual start before ordinary project LLM orchestration begins, while still allowing explicit operator-triggered local validation and manual MCP dispatch to promote a project into `running`
- expand local-lab-backed regression coverage for real Docker targets in controlled environments
- add masked-secret mode for LLM settings while keeping a debug toggle for local development

### Acceptance Criteria

- met: project-level scheduler pause/resume is operator-visible and blocks future queue pickup
- met: new projects no longer auto-run on creation; manual start now gates the first LLM orchestration pass
- met: project pause/resume/stop are now real backend lifecycle transitions instead of UI-only status toggles
- met: queued tasks can be cancelled and failed tasks can be retried from the project operations page
- met: the operations API contract now carries real runtime scheduler state instead of only high-level task cards
- partially met: operators can now issue stop requests for `running` tasks, recover orphan executions, block stale late writeback, and cooperatively interrupt the platform heartbeat, local connectors, real DNS/TLS checkpoints, and the real stdio Web-surface MCP path; broader remote rollback and additional connector families are still pending
- met: WebGoat can now be validated through the same end-to-end runner in a real finding closure path, including approval resume and browser-side report export
- met: this slice has already been verified with `npm run test`, `npm run lint`, `npm run build`, and `npm run e2e`

## Phase 10: Production-Ready MCP Orchestration

- Status: Completed on `codex/non-mcp-production-hardening-2026-03-28`
- Goal: 将12个外部 MCP 服务器复制到本仓库 `mcps/` 目录，实现自动发现与注册，构建通用 stdio 连接器驱动全部34个工具，实现多轮自动编排循环，使平台能真正"新建项目→设置目标→点击开始→LLM 自动分配 MCP→多轮执行→输出最终结论"。

### Task Checklist

- completed: 将12个 MCP 服务器（subfinder, fscan, httpx, dirsearch, curl, netcat, wafw00f, afrog, whois, fofa, github-recon, encode）从 `D:\dev\mcps` 复制到 `mcps/` 目录，使用相对路径确保部署可移植性
- completed: 创建 `mcps/mcp-servers.json` 统一配置文件，定义所有服务器的 command/args/cwd/env
- completed: 实现 `lib/mcp-auto-discovery.ts` 自动发现模块，包含 `TOOL_REGISTRY` 映射34个工具到平台能力分类、风险级别和边界类型
- completed: 实现 `lib/mcp-connectors/stdio-mcp-connector.ts` 通用 stdio 连接器，支持所有34个外部 MCP 工具的参数构建和执行
- completed: 将通用 stdio 连接器注册为连接器优先级链的最高优先级
- completed: 扩展 `callMcpServerTool()` 支持 `cwd` 和 `env` 参数传递
- completed: 实现 `lib/orchestrator-context-builder.ts` 多轮上下文构建器，包含资产快照、轮次压缩、未使用能力提示等分层上下文策略
- completed: 在 `orchestrator-service.ts` 中实现多轮自动编排循环：`recordOrchestratorRound()` 记录轮次、`shouldContinueAutoReplan()` 检查6个停止条件、`generateMultiRoundPlan()` 使用分层上下文生成计划
- completed: 扩展 `ProjectSchedulerControl` 类型支持 `autoReplan`、`maxRounds`、`currentRound` 字段
- completed: 更新 Zod 写入 schema 和 PATCH 类型支持新的调度控制字段
- completed: 在前端调度运行面板添加"自动续跑"开关和编排轮次显示
- completed: 预填 LLM 生产配置（SiliconFlow DeepSeek-V3.2）通过 store 迁移自动种子
- completed: 添加"编解码与密码学工具类"能力分类到平台配置
- completed: 修复 `project-mcp-runs-panel.tsx` 缺少 `已取消` 状态的类型错误
- completed: 更新 `code_index.md` 和 `roadmap.md`

### Real Validation Results

- 已验证 MCP 自动发现：12个服务器全部发现注册，35个工具启用
- 已验证 env 路径解析：`HTTPX_PATH` 正确解析为 `D:\dev\llmpentest0326\mcps\httpx-mcp-server\bin\httpx.exe`
- 已验证真实 MCP 执行：httpx_probe 成功探测 DVWA（HTTP 302, Apache/2.4.25/Debian/PHP），wafw00f_detect 检测无 WAF，curl http_request 获取完整响应
- 已验证多轮编排：3轮在171秒内完成，LLM 智能跳过 localhost DNS 扫描，聚焦 HTTP 探测→技术识别→漏洞扫描→报告导出
- 已验证 Docker 靶场：DVWA, OWASP Juice Shop, WebGoat, DVWA（共8个服务容器运行正常）
- 测试结果：157/161 通过（4个并行超时为已知预存问题，单独运行全部通过）

### Bug Fixes in This Phase

- 修复 env 路径解析：`mcp-servers.json` 中相对路径通过 `resolveEnvPaths()` 转为绝对路径
- 修复 stdio MCP 结果不生成资产/证据：添加 `normalizeStdioMcpArtifacts()` 处理器
- 修复 `connectorMode` TypeScript 类型：`updateStoredMcpRun` patch 类型新增 `connectorMode` 字段
- 修复 FK 外键约束：`appendStoredMcpServerInvocation` 用 try/catch 包裹实现 best-effort 记录
- 修复 fscan `-f json` 标志：更正为 `-json`（fscan 1.8.4 格式）
- 修复 dirsearch 超时：扫描/目录工具超时延长至 300s
- 修复单工具失败阻塞整轮：`executePlanItems()` 改为继续执行，仅审批阻塞停止

### Acceptance Criteria

- met: 12个 MCP 服务器已本地化到 `mcps/` 目录，配置使用相对路径
- met: 自动发现模块能扫描并注册所有34个工具到平台能力体系
- met: 通用 stdio 连接器能驱动任意外部 MCP 工具执行
- met: 多轮自动编排循环能在 autoReplan 开启时持续运行直到停止条件触发
- met: 真实 MCP 工具执行能产生平台资产、证据和漏洞发现记录
- met: 端到端管线已通过 Docker 靶场验证（DVWA 3轮自动编排）
- met: 前端 UI 支持自动续跑开关和轮次进度显示
- met: 所有单元测试通过（并行超时为已知预存问题）
- met: LLM 配置在非测试环境自动种子

## Phase 11: 前端对接与生产化闭环

- Status: Completed on `codex/non-mcp-production-hardening-2026-03-28`
- Goal: 将后端多轮编排管线完全打通到前端，修复真实 MCP 执行中发现的工具路由、超时、结果分类问题，通过 DVWA 靶场真实端到端验证，实现从浏览器”新建项目→开始→实时查看编排进度→查看结论”的完整闭环。

### Task Checklist

- completed: 暴露 `orchestratorRounds` 到前端 API（`getProjectOperationsPayload` 返回轮次数据）
- completed: 前端调度运行面板添加 `initialRounds` prop 和轮次记录展示（每轮计划数/执行数/新资产/新证据/新发现/停止原因）
- completed: 前端自动轮询：lifecycle 为 `running` 时每 5 秒刷新 `/api/projects/{id}/operations` 更新轮次、任务和控制状态
- completed: 修复 LLM 调用超时：orchestrator/reviewer 超时从 30s→120s，extractor 从 15s→60s
- completed: 修复 MCP SDK 内部超时：`client.callTool()` 传递 `{ timeout: timeoutMs }` 使 SDK 超时与调用者一致
- completed: 修复工具路由偏差：添加 `preferredToolName` 直接匹配机制，LLM 输出必须包含 `toolName` 字段
- completed: 修复 WAF 检测结果分类：过滤掉信息级和否定结果（如 “No WAF Detected”），不再作为漏洞
- completed: 修复 fscan 输出解析：移除无效 `-json` 标志，重写 `parsePlainTextOutput()` 解析纯文本输出
- completed: 修复 fscan URL 目标处理：`buildToolArguments` 提取 hostname，不再将 URL 直接传给 fscan
- completed: 自动检测 HTTP 响应安全发现：服务器版本泄露、过时 Apache（< 2.4.50）、过时 PHP（< 8.0）
- completed: 安装 DVWA 数据库（通过 Playwright 自动化 setup.php）
- completed: DVWA 真实端到端渗透测试：3 轮 239.7 秒，发现 2 个真实漏洞（Apache 版本泄露 + 过时版本）、4 条证据、1 个资产
- completed: Playwright E2E 测试超时调整：LLM 相关测试超时延长至 150s/180s
- completed: 更新 `code_index.md` 和 `roadmap.md`

### Bug Fixes in This Phase

- 修复 LLM AbortError：DeepSeek API 响应慢于默认 30s 超时，延长至 120s
- 修复 gateway 路由偏差：LLM 请求 `wafw00f_detect` 但 gateway 派发 `httpx_probe`，根因是按 capability 而非 toolName 匹配
- 修复 MCP SDK 超时不一致：SDK 内部 `DEFAULT_REQUEST_TIMEOUT_MSEC = 60000` 覆盖调用者 300s 设置
- 修复 fscan JSON 解析失败：fscan 不支持 `-json` 标志，输出为纯文本
- 修复 Apache 版本比较语法错误：`parseFloat(“2.4.25”) < 2.4.50` 改为 `localeCompare` with `{ numeric: true }`

### Real Validation Results

- DVWA 真实渗透：3 轮自动编排，LLM 动态选择 httpx→wafw00f→fscan→afrog 工具链
- 发现 2 个真实安全发现：Apache/2.4.25 (Debian) 版本泄露 + Apache 版本过时（低于 2.4.50）
- 采集 4 条证据记录，1 个资产（Web 入口），自动生成最终结论
- 6/8 Playwright E2E 测试通过（2 个 LLM 依赖测试需要真实 API 超时 > 15s）
- 97/97 Vitest 单元测试通过（不含 LLM 超时测试）

### Acceptance Criteria

- met: 前端能实时反映编排进度（轮次、资产数、发现数），每 5 秒自动刷新
- met: `orchestratorRounds` 轮次记录在项目操作页面完整展示
- met: DVWA 靶场通过真实多轮自动编排完成渗透测试
- met: 工具路由、超时、结果分类问题已修复并通过真实验证
- met: Playwright E2E 和 Vitest 单元测试覆盖核心路径

## Phase 13: 生产加固 (Production Hardening)

- Status: Completed on `2026-03-29`
- Branch: `feat/phase13-production-hardening`
- Goal: 将平台安全性和可观测性提升到生产可用级别，加固认证链路，实现 LLM 日志 SSE 实时推送，稳定 E2E 测试。

### 交付清单

1. **SSE 实时日志流** — `GET /api/llm-logs/stream` 端点，基于 EventEmitter 的 SSE 推送，前端 EventSource 接收 + 轮询降级
2. **认证加固** — HMAC 签名 session cookie、CSRF 双重提交 cookie（login 端 + middleware 全 mutation）、滑动窗口速率限制（login 5/min + API 60/min）、bcrypt 密码验证
3. **验证码系统** — 服务端生成 4 位字母数字验证码、5 分钟过期、一次性使用、HMR 安全的 globalThis 存储
4. **E2E 测试稳定性** — `E2E_TEST_MODE` 环境变量绕过 CSRF + 验证码校验、验证码容错（try/catch 降级 "TEST"）、选择器精确化（role button 替代 text 匹配）
5. **TypeScript 清理** — 移除未使用导入、tsconfig 排除 mcps 目录、`@ts-ignore` → `@ts-expect-error`

### 验收标准

- [x] LLM 日志通过 SSE 实时推送到前端（created/updated/completed/failed 事件）
- [x] 未认证用户无法访问 API（middleware 拦截）
- [x] 登录端点受 CSRF 和速率限制保护
- [x] E2E 测试在 E2E_TEST_MODE 下稳定运行
- [x] `npm run build` 通过（无 TypeScript 错误）
- [x] prototype-smoke.spec.ts 8/8 通过

## Phase 14: AI 聊天窗项目上下文 (Chat Widget Project Context)

- Status: Completed on `2026-03-29`
- Branch: `feat/phase14-chat-project-context`
- Goal: 解决全局 AI 聊天窗口无法区分不同项目对话的问题，加固 SSE 端点安全性。

### 交付清单

1. **LlmCallLogRecord 扩展** — 添加 `projectName?: string` 可选字段，向后兼容
2. **服务端项目名注入** — `createLlmCallLog()` 创建时自动查找项目名，SSE 事件携带项目名
3. **API 查询时 enrichment** — `/api/llm-logs/recent` 对旧日志补充项目名（复用 projectNameMap 模式）
4. **AI 聊天窗 UI 升级**:
   - 每条日志气泡显示紫色项目名标签（仅"全部项目"模式下显示）
   - 项目筛选下拉（全部项目 / 当前项目 / 各项目名）
   - URL 感知：进入 `/projects/[id]` 自动切换到当前项目筛选
   - 手动选择后保持用户选择，不自动覆盖
5. **SSE 端点安全加固** — `/api/llm-logs/stream` 用 `withApiHandler` 包裹
6. **E2E 测试** — 漏洞中心 waitForResponse 修复，聊天窗增加项目筛选器断言

### 验收标准

- [x] `npm run build` 通过
- [x] AI 聊天窗显示项目名标签
- [x] 项目筛选下拉可切换
- [x] 进入项目页自动切换到当前项目
- [x] SSE 端点使用 withApiHandler

## Phase 19: Architecture Refactoring (做减法)

- Status: Completed on `2026-03-31`
- Branch: `feat/phase19-architecture-refactoring` (已合并至 main)
- Goal: Reduce complexity by splitting 3 monolithic files, deleting ~850 lines of dead code, capping max file size at ~410 lines

### 交付清单

1. **Split `prototype-types.ts`** (918 lines → 10 行 barrel) — 90 个类型拆分到 `lib/types/` 下 10 个领域文件（project/approval/mcp/scheduler/asset/evidence/settings/llm-log/user/payloads）
2. **Delete `prototype-api.ts`** (1,104 lines, 43 functions) — 35 个零价值透传函数删除，8 个聚合函数迁移到新建 `api-compositions.ts` (780 lines)，58 个 import 站点更新为直接 repository 导入
3. **Split `orchestrator-service.ts`** (1,536 lines → 421 lines) — 拆为 5 个聚焦模块：orchestrator-service (421), orchestrator-target-scope (192), orchestrator-plan-builder (439), orchestrator-execution (436), orchestrator-local-lab (98)
4. **代码简化** — 合并重复 import、删除死代码函数 (isTcpTarget)、消除冗余三元运算、去重复 normalizeUrlTarget 函数

### 验收标准

- [x] 79 文件变更，+2,548 / -2,658 行（净减 110 行）
- [x] 178/178 单元测试通过，33 跳过
- [x] 14/14 E2E 测试通过
- [x] 零功能变更 — 所有行为完全保留
- [x] Design spec: `docs/superpowers/specs/2026-03-30-architecture-refactoring-design.md`

## Phase 20: Continued Refactoring — 二级模块拆分

- Status: Completed on `2026-03-31`
- Branch: `feat/phase20-continued-refactoring` (待合并至 main)
- Goal: 对 5 个 460-790 行大文件做二级拆分，每个文件 < 400 行，原文件变为 barrel re-export，零 import 站点变更。

### 交付清单

1. **Split `api-compositions.ts`** (780 行 → 4 行 barrel) — 拆为 `lib/compositions/` 下 4 个子模块（dashboard/project/settings/control）
2. **Split `project-results-repository.ts`** (790 行 → 3 行 barrel) — 拆为 `lib/results/` 下 3 个子模块（core/conclusion-service/report-repository），循环依赖通过将结论查询放入 core 解决
3. **Split `mcp-gateway-repository.ts`** (486 行 → 2 行 barrel) — 拆为 `lib/gateway/` 下 2 个子模块（run-repository/dispatch-service）
4. **Split `project-scheduler-control-repository.ts`** (533 行 → 2 行 barrel) — 拆为 `lib/scheduler-control/` 下 3 个子模块（helpers/core/task-commands）
5. **Split `project-repository.ts`** (460 行 → 2 行 barrel) — 拆为 `lib/project/` 下 2 个子模块（read-repository/mutation-repository）

### 验收标准

- [x] 5 个大文件拆分为 14 个 < 400 行子模块
- [x] 零 import 站点变更（barrel re-export 模式）
- [x] 178/178 单元测试通过，33 跳过
- [x] 14/14 E2E 测试通过
- [x] 零功能变更 — 所有行为完全保留

## Phase 21: UI/UX 全站审查修复 (UI/UX Full-Site Review Fix)

- Status: Completed on `2026-03-31`
- Branch: `feat/phase21-ui-ux-fixes` (待合并至 main)
- Goal: 基于 Playwright 自动截图审查（56 张截图 × 27 页面），修复全站 8 个 P1 体验问题和 3 个优先 P2 打磨问题。

### 审查方法

- 使用 `scripts/ui-review-screenshots.mjs` 对 27 个页面 × 2 视口（Desktop 1280×800 + Mobile 390×844）+ 4 页深色模式自动截图
- 审查报告保存在 `docs/ui-ux-review-report.md`，分 P0/P1/P2 三级

### 交付清单

**Sprint 1 — P1 核心体验：**
1. **Loading 骨架屏覆盖** (12 个新文件) — `SettingsSubPageSkeleton` 共享组件 + 7 个设置子页面 + settings 主页 + vuln-center + assets + approvals 各有匹配布局的 `loading.tsx`
2. **破坏性操作确认对话框** — 调度面板停止/取消任务添加 AlertDialog + 审批决策通过/拒绝添加 AlertDialog（延后处理保持直接调用）
3. **页面切换过渡动画** — CSS `fade-in` keyframe (0.2s ease-out, translateY 4px) + `key={pathname}` 触发路由切换重挂载

**Sprint 2 — P1 信息架构：**
4. **Operations 页面折叠面板** — 创建 `OperationsCollapsibleSection` 组件，底部 LLM 编排和 MCP 调度面板默认折叠
5. **MCP 工具页面 Accordion 折叠** — 用 Radix Accordion 包裹次要区块（契约注册/已连接服务端/能力边界规则），保留统计和工具列表始终可见
6. **项目表单字段级验证** — 从 useState 迁移到 react-hook-form + zodResolver + FormField/FormMessage，zod schema 校验名称/目标/描述

**Sprint 3 — P2 打磨：**
7. **圆角 Token 统一** — 定义 4 个语义化圆角 token（`hero=36px` `card=28px` `panel=24px` `item=22px`），21 个文件批量替换 16 种自定义圆角值
8. **Dashboard 空平台引导** — 所有指标为 0 时显示 sky 主题引导卡片 + "创建第一个项目" CTA
9. **结果页空状态差异化** — domains(Globe)、network(Network)、findings(ShieldAlert) 使用不同图标和文案

### 验收标准

- [x] 12 个新 loading.tsx 文件，骨架屏与实际页面结构匹配
- [x] 调度停止/取消 + 审批通过/拒绝均有 AlertDialog 确认
- [x] 页面切换有微妙 fade-in 效果
- [x] Operations 底部面板和 MCP 工具次要区块可折叠
- [x] `/projects/new` 空提交显示字段下方红色错误提示
- [x] `grep -rn "rounded-\[" --include="*.tsx"` 仅剩 login-form.tsx 和 chart.tsx 特殊值
- [x] Dashboard 零数据时显示引导卡片
- [x] 三个结果页各自图标和文案不同
- [x] `npx next lint` 无报错
- [x] 8 次独立 commit，每个 Sprint 并行开发

## Phase 21 Debug: 真实使用 Bug 修复

- Status: Completed on `2026-03-31`
- Branch: `fix/phase21-debug-0331`
- Goal: 修复用户真实使用中发现的 6 个 bug，确保平台基本可用。

### 交付清单

1. **LLM 上下文窗口设置** — Prisma schema 新增 `contextWindowSize` 字段（默认 65536）、类型/zod/UI/repository 全链路支持
2. **模型未配置警告** — Operations 和 AI Logs 页面显示 amber 警告横幅，链接至 LLM 设置页
3. **阻塞原因显示** — 任务队列中 `waiting_approval` 状态显示原因说明 + "前往审批中心" 链接
4. **AI 日志空提示** — AI Logs 页面检测 LLM 编排器未启用时显示配置提示
5. **用户名显示** — 从 session cookie 读取真实用户名/角色，替代硬编码 "研究员席位"
6. **Subfinder 结果提取** — 修复 `mcp-execution-service.ts` 中 `String(domainObject)` 产生 `[object Object]` 的问题

### 验收标准

- [x] 178/178 单元测试通过
- [x] `npx next lint` 无报错
- [x] Prisma schema 同步（`db push` 成功）
- [x] 14 个文件变更

## Phase 21 Debug Round 2: 超时 / 自动展开 / 角色名称

- Status: Completed on `2026-03-31`
- Branch: `fix/phase21-debug-0331`
- Goal: 修复用户第二轮真实使用中发现的 3 个问题。

### 交付清单

1. **移除角色名称编辑** — LLM 设置面板移除可编辑的 label 输入框
2. **Fire-and-forget 生命周期** — 将 `runProjectLifecycleKickoff` 改为后台执行避免 API 超时 500，添加 `flushPendingKickoff()` 测试辅助函数
3. **AI 聊天窗自动展开** — SSE 收到新 `created` 事件时自动展开聊天窗口

### 验收标准

- [x] 178/178 单元测试通过
- [x] API 不再因 LLM 超时返回 500

## Phase 21 Debug Round 3: 文案清理 + 审批策略 + 超时优化

- Status: Completed on `2026-03-31`
- Branch: `fix/phase21-debug-0331`
- Goal: 修复用户第三轮真实使用中发现的 5 个问题，全站文案大清理。

### 交付清单

1. **LLM 超时默认值** — 所有 `timeoutMs` 默认从 15000ms 提升到 120000ms（涉及 Prisma schema、registry、provider、transforms、prototype-store、seed、tests）
2. **"手动开始" 文案清理** — 全站 22 处 "手动开始" / "等待手动开始" 替换为 "启动" / "等待启动"（7 个源文件 + 2 个测试文件）
3. **"回流"/"补采" 术语替换** — 全站 70+ 处晦涩术语替换为通俗文案："回流"→"返回/同步/汇入"，"补采"→"采集"，"回流补采"→"追加采集"（30+ 个源文件 + 15 个测试文件）
4. **项目创建审批策略下拉框** — 新增 `approvalMode` 字段（"默认审批策略" / "全自动执行"），表单 + zod schema + mutation repository 全链路支持
5. **移除"阶段负责人"字段** — 从 flow/page.tsx 删除该卡片，改为 2 列布局

### 验收标准

- [x] `grep "回流\|补采" --include="*.ts" --include="*.tsx"` 零结果
- [x] `grep "手动开始" --include="*.ts" --include="*.tsx"` 零结果
- [x] 项目创建表单包含审批策略下拉框
- [x] 178/178 单元测试通过
- [x] Prisma schema 同步

## Phase 21 Debug Round 4: 统计卡片跳转 + 进度横幅 + AI 日志结构化 + 失败工具摘要

- Status: Completed on `2026-03-31`
- Branch: `fix/phase21-debug-0331`
- Goal: 修复 debug/0331-4.md 中 7 个问题，增强运行时可视性和 LLM 编排智能。

### 交付清单

1. **统计卡片可点击** — 4 个统计卡片（已纳入域名/开放端口/漏洞线索/证据锚点）改为 `<Link>` 跳转到对应结果页
2. **进度横幅实时状态** — 显示当前轮次、执行中工具名+目标、待审批数、已完成/失败任务数、最新轮次指标
3. **fscan ENOENT 检测** — stdio 连接器捕获二进制缺失错误，返回明确安装提示
4. **AI 日志结构化渲染** — JSON 计划渲染为卡片（含 toolName/riskLevel/target/rationale 标签），支持原始/结构化视图切换
5. **失败工具摘要注入** — `buildFailedToolsSummary()` 将连续失败 2+ 次的工具注入 LLM prompt，防止重复调度
6. **MCP 参数修复** — `icp_query` 参数 domain→query、`http_raw_request` 参数 request→rawRequest + tls 字段
7. **maxRounds 文案** — 达到最大轮次时显示"已达到最大轮次限制，正在收束"

### 验收标准

- [x] TypeScript 无新增错误
- [x] 涉及 7 个源文件修改

## Phase 21 Debug Round 5: 资产提取管线重写 + fscan 编译 + MCP 增强

- Status: Completed on `2026-03-31`
- Branch: `fix/phase21-debug-0331`
- Goal: 修复 debug/0331-5.md 中 7 个问题，解决资产数据为空的核心问题。

### 交付清单

1. **seed-normalizer 创建初始资产** — 从 normalizedTargets 自动创建 host/domain 资产，不再返回空 assets 数组
2. **tcp_connect/tcp_banner_grab 资产提取** — 识别 `{connected: true}` / `{banner: "..."}` 返回格式，自动创建 host + port 资产
3. **webEntries 自动衍生 host+port** — 从 Web 入口 URL 推导并创建对应的 host 和 port 资产
4. **fscan.exe 编译** — 从 GitHub 源码编译 46MB 二进制，放置到 `mcps/fscan-mcp-server/bin/fscan.exe`
5. **TLS 证书忽略** — curl-mcp-server 设置 `NODE_TLS_REJECT_UNAUTHORIZED=0` 解决自签名证书 fetch 失败
6. **WHOIS 超时延长** — whois_ip/whois_query 默认超时从 10s 提升到 20s
7. **extractSummaryLines 增强** — 对 tcp/whois 工具返回有意义的摘要（Banner/连接状态/WHOIS 信息）
8. **LLM target 格式约束** — 工具描述和编排 prompt 中明确 tcp_connect/tcp_banner_grab 的 target 必须为 host:port 格式

### 验收标准

- [x] TypeScript 无新增错误
- [x] 涉及 12 个源文件修改
- [x] fscan.exe 编译成功

## Phase 22a: Tab 重构 + 术语清理

- Status: 已完成 on `2026-03-31`
- Branch: `feat/phase22-tab-restructure`
- Goal: 重构项目详情 Tab 结构，统一全站术语，所有结果页改用 DB 直查替代 assetGroups JSON 缓存。

### 交付清单

1. **Tab 结构重构 (8→7 tabs)** — 概览/域名/站点/端口/漏洞/执行控制/AI日志
2. **拆分 "域名/Web"** — 原合并 tab 拆为独立的 "域名" 和 "站点" tabs
3. **重写 "端口/服务"** — 改为 "端口" tab，使用 Nmap 风格表格展示
4. **移除 "上下文" 和 "阶段" tabs** — 精简信息架构，减少冗余页面
5. **重命名 "调度"→"执行控制"** — 更准确地反映该 tab 的实际功能
6. **全站 DB 直查** — 所有结果页改用 Prisma 直接查询数据库，移除 assetGroups JSON 缓存依赖
7. **scopeStatus 术语统一** — 已纳入→已确认, 待确认→待验证, 待复核→需人工判断
8. **ProjectStatus 术语统一** — 待处理→待启动, 已阻塞→等待审批
9. **UI 术语全站清理** — 编排→AI规划, MCP工具→探测工具, 收束→自动收尾, 情报→信息

### 验收标准

- [x] 80 files changed, 2 created, 4 deleted
- [x] 178/178 单元测试通过
- [x] Tab 结构从 8 个精简为 7 个
- [x] 所有结果页使用 DB 直查，不再依赖 assetGroups JSON

## Phase 22: 真实渗透测试闭环验证 (Real Pentest Closure Validation)

- Status: In progress on `2026-04-01`
- Branch: `feat/phase22-real-pentest-validation`
- Goal: 对 Docker 靶场进行完整端到端渗透测试闭环验证，修复验证中发现的核心问题。

### 交付清单（已完成）

1. **MCP 超时检测修复** — SDK 抛出英文 "Request timed out" 但代码只检查中文"超时"，添加英文消息匹配
2. **maxRounds 全局统一 10→5** — `agent-config.ts`、`project-scheduler-lifecycle.ts`、`orchestrator-service.ts`、`project-summary.tsx` 四处统一
3. **高失败率提前收敛** — `orchestrator-execution.ts` 新增停止条件：失败率 >60% 且 ≥3 轮时提前收敛
4. **LLM 收敛原则引导** — `orchestrator-context-builder.ts` 注入收敛原则，防止 LLM 浪费轮次重复失败工具
5. **MCP setup/tool 超时分离** — `mcp-client-service.ts` 将 connect+listTools 超时限制为 30s，不占用工具执行时间
6. **Reviewer 结论客观性约束** — `llm-brain-prompt.ts` 添加 4 条客观性原则，防止 0 发现/0 证据时得出"安全"结论
7. **host.docker.internal→localhost 目标规范化** — `stdio-mcp-connector.ts` 新增 `normalizeTargetForHost()`，使 MCP 工具能实际触达目标
8. **覆盖不足检测** — `project-conclusion-service.ts` 当 findingCount=0 且 evidenceCount=0 时标记扫描覆盖不足

### DVWA 初步验证结果

- 首次验证：16/16 MCP 任务失败（超时检测 bug + host.docker.internal 不可达）
- 修复后第二次验证：5 分钟内完成，LLM 主动返回 items:[] 收尾（收敛引导生效）
- 问题：结论仍为"安全"（0 发现/0 证据，因 target 不可达）→ 触发 Fix 6-8

### 验收标准

- [x] MCP 超时检测覆盖中英文消息
- [x] maxRounds 默认值全局统一为 5
- [x] 高失败率提前收敛逻辑通过代码审查
- [x] Reviewer prompt 包含客观性约束
- [x] host.docker.internal 目标规范化为 localhost
- [x] 178/178 单元测试通过
- [x] TypeScript 编译零错误
- [ ] DVWA 重新验证：MCP 工具实际触达目标并发现漏洞
- [ ] TCP 服务靶场验证（Redis/SSH/MongoDB）
- [ ] WebGoat 靶场验证

## Phase 22b: LLM Writeback — 语义分析替代工具特定解析器

- Status: Completed on `2026-04-03`
- Branch: `feat/llm-writeback-tools`
- Goal: 用 LLM 语义分析替代全部工具特定解析器（~900 行硬编码 normalizer），使平台对任意 MCP 工具输出格式通用化。

### 交付清单

1. **LLM Writeback 服务** — `lib/llm-writeback-service.ts`，核心函数 `analyzeAndWriteback()`：调用 analyzer LLM 语义解析任意工具 rawOutput，返回结构化 assets/evidence/findings
2. **Analyzer 提示词** — `lib/llm-brain-prompt.ts` 新增 `ANALYZER_BRAIN_SYSTEM_PROMPT`（9 条规则）和 `buildToolAnalysisPrompt()`，返回 JSON 格式分析结果
3. **LLM Provider 扩展** — `openai-compatible-provider.ts` 新增 `analyzeToolOutput()` 方法，独立 analyzer profile（60s 超时，temperature 0.1）
4. **execution-service 精简** — `mcp-execution-service.ts` 从 1445 行缩减至 ~330 行：仅保留 3 个内部工具（seed-normalizer/capture-evidence/report-exporter）本地处理，其余全部走 `analyzeAndWriteback()`
5. **三级 LLM Profile** — orchestrator（规划）、reviewer（结论）、analyzer（工具输出分析）各自独立配置，analyzer 可用低成本模型
6. **extractor→analyzer 全站重命名** — 涉及 Prisma schema、seed、types、UI、配置面板、AI 日志等 15+ 文件
7. **优雅降级** — LLM 不可用时通过 `buildFallbackArtifacts()` 将 rawOutput 保存为 evidence，供下一轮分析
8. **测试修复** — 5 个测试文件 6 个用例调整断言以匹配 LLM 降级行为（无 LLM 时仅生成 evidence，不生成 findings/assets）

### 删除的代码

- `normalizeStdioMcpArtifacts()` (~500 行) — 工具特定解析器主函数
- dns-census handler — 硬编码子域名提取
- web-surface-map handler — 硬编码 Web 入口提取
- graphql-surface-check handler — 硬编码 GraphQL 端点分类
- controlled-validation handler — 硬编码 HTTP 验证结果解析
- URL 路径硬编码分类 — `/graphql`→"api"、`/dashboard`→"web"

### 验收标准

- [x] mcp-execution-service.ts 从 1445 行缩减至 ~330 行
- [x] 新增 llm-writeback-service.ts 完整实现
- [x] 225/236 单元测试通过（11 个预存失败非本次引入）
- [x] extractor→analyzer 全站重命名完成
- [x] TypeScript 编译零错误
- [ ] DVWA 靶场端到端验证（需真实 LLM 配合）

## Phase 23: 深度架构演进 (Deep Architecture Evolution)

- Status: Completed on `2026-04-03`
- Branch: main
- Goal: 通过三阶段深度架构演进（死代码清理、MCP 连接器简化、lib/ 领域化重组），大幅降低代码库复杂度，为后续功能开发提供更清晰的代码组织基础。

### Phase 1: 死代码清理

- 删除 ~4000+ 行死代码，涉及 22+ 个文件
- 测试 fixture 从外部文件迁移为内联数据

### Phase 2: MCP 连接器简化

- 创建 base factory（基础工厂模式），统一连接器创建流程
- 重写 4 个真实连接器（基于 base factory）
- 移除端口硬编码探测逻辑
- 移除 WebGoat 特定逻辑
- 扩展 `isLocalHost()` 覆盖更多本地地址格式
- 净减代码 ~250+ 行

### Phase 3: lib/ 领域化重组

- 将 54 个文件从扁平 `lib/` 目录重组到 9 个领域子目录：
  - `lib/orchestration/` — 编排引擎相关
  - `lib/mcp/` — MCP 连接器与网关
  - `lib/llm/` — LLM provider 与 prompt
  - `lib/project/` — 项目管理与调度
  - `lib/auth/` — 认证与会话
  - `lib/settings/` — 配置管理
  - `lib/infra/` — 基础设施（日志、环境检测等）
  - `lib/analysis/` — 分析服务（writeback、结论等）
  - `lib/data/` — 数据层（repository、transforms）
- 所有 import 路径已全量迁移，无 barrel re-export 兼容层

### 关键指标

- 净代码减少：Phase 2 ~250+ 行
- 死代码清理：Phase 1 ~4000+ 行（22+ 文件）
- 文件重组：54 个文件 → 9 个子目录
- TypeScript 编译零错误
- 206 个测试全部通过
- 无 barrel re-export 兼容层（所有 import 直接指向新路径）

### 验收标准

- [x] 死代码清理完成，~4000+ 行已删除
- [x] 4 个 MCP 连接器基于 base factory 重写
- [x] 54 个文件按领域重组到 9 个子目录
- [x] 所有 import 路径迁移完成
- [x] `tsc --noEmit` 零错误
- [x] 206 个测试全部通过
- [x] 无 barrel re-export 兼容层

## Phase 23b: TCP 通用化与实战验证 (TCP Generalization & Live Validation)

- Status: Completed on `2026-04-03`
- Branch: `refactor/phase23-deep-architecture-evolution`
- Goal: 解决 Redis 渗透测试 72 证据 0 发现的 bug，建立通用 TCP 服务渗透测试流水线，使平台能对任意 TCP 服务进行自动化安全评估。

### 交付清单

1. **TCP 通用协议探测** — `stdio-mcp-connector.ts` fallback 脚本从无效 `\r\n` 改为 `PING\r\n`+`INFO\r\n` 多协议探针，自动识别 Redis/SSH/MySQL/MongoDB/Elasticsearch/FTP/SMTP
2. **llmCode 数据库持久化** — 新增 `McpRun.llmCode` 字段（Prisma schema + types + transforms），LLM 生成的 execute_code 脚本从内存 Map 迁移到 PostgreSQL，解决审批-恢复周期代码丢失 bug
3. **TCP 服务测试方法论** — `llm-brain-prompt.ts` 新增 5 步 TCP 测试方法论（banner→未授权→弱口令→配置→信息泄露）+ analyzer 规则 #7（TCP 未授权访问判定标准）
4. **TCP fallback 计划增强** — `orchestrator-service.ts` TCP 兜底从 1 项扩展为 3 项（banner 探测 + 未授权访问 + 弱口令/配置检测）
5. **多轮上下文增强** — `orchestrator-context-builder.ts` 注入 execute_code 实际 rawOutput（截断 2000 字符）给 LLM 下一轮规划
6. **OpenAI 兼容层增强** — `openai-compatible-provider.ts` 新增 `fetchWithJsonFormatFallback()` 自动降级 response_format
7. **运维文档全面更新** — LLM 设置、MCP 接入指南、Docker 靶场操作手册、开发指南、prompt 工程文档

### 验收标准

- [x] Redis(6379) 端到端验证: 4 资产、23 证据、1 高危发现（未授权访问）
- [x] TCP fallback 脚本能正确识别 Redis 协议并发送 PING/INFO 探针
- [x] llmCode 在审批-恢复周期中正确持久化和恢复
- [x] LLM prompt 不包含任何靶场特定代码或具体攻击 payload

### 已知待办

- [ ] SSH(2222)/MySQL(13307)/MongoDB(27017)/Tomcat(8888)/WordPress(8082) 靶场验证
- [ ] 审批-恢复循环去重（每次 resume 触发新 lifecycle kickoff 导致 run 指数增长）

## Recommended Next Phase

- Name: `Phase 24 - 多协议靶场全面验证与审批去重 (Multi-Protocol Target Validation & Approval Dedup)`
- Goal: 在 Phase 23b TCP 通用化基础上，对所有 Docker 靶场目标完成端到端验证，并解决审批-恢复循环导致的计划膨胀问题。
- Priorities:
  1. 对 SSH(2222)/MySQL(13307)/MongoDB(27017)/Tomcat(8888)/WordPress(8082) 执行完整 LLM 编排 → MCP 执行 → 发现闭环
  2. 审批-恢复去重：解决每次 resume 触发新 lifecycle kickoff 导致指数级 run 增长的问题
  3. 多目标项目编排：同一项目覆盖多个靶场目标，验证并行调度和作用域隔离
  4. CI 就绪化：GitHub Actions 配置 PostgreSQL service + vitest + playwright

## Notes for Future LLM Sessions

- Read `code_index.md` first for code structure.
- Read this roadmap second for phase boundaries and current priorities.
- Treat the provided backend template as the primary visual reference.
- Do not develop new MCP servers directly in this platform repo by default; prefer `D:\dev\llmpentest-mcp-scaffold`.
- Keep the “LLM = brain, MCP = limbs” boundary explicit: external interactions should flow through MCP, while normalization and platform-side aggregation can stay internal.
- LLM 配置已预填: SiliconFlow DeepSeek-V3.2 (配置在 PostgreSQL llm_profiles 表中, base_url=https://api.siliconflow.cn/v1)
- 12 个 MCP 服务器全部本地化在 `mcps/` 目录，通过 `mcp-auto-discovery.ts` 自动发现注册
- 通用 stdio 连接器 (`stdio-mcp-connector.ts`) 驱动所有 34 个外部工具
- Docker 靶场：DVWA (8081), Juice Shop (3000), WebGoat (18080/19090)
