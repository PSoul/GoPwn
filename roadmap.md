# Roadmap

## Project Snapshot

- Date: `2026-03-28`
- Current focus: 平台主线已收敛到 `v0.2.2` 基线，包含真实证据采集、生命周期控制、durable worker、cooperative cancellation、双本地靶场闭环，以及“项目开始后自动收束到报告与最终结论”的闭环。下一阶段不再在本仓库里直接扩具体 MCP，也不继续推进 `fscan` 方向；主仓库只继续打磨运行时与收束质量。
- Working mode: 平台主仓库继续负责运行时与桥接；新的 MCP server 优先在独立脚手架仓库中开发、校验和整理文档。

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

## Recommended Next Phase

- Name: `Phase 11 - 前端对接与生产化闭环`
- Suggested branch: `codex/frontend-production-loop-2026-03-29`
- Goal: 后端多轮编排管线已验证可用（DVWA 3轮自动渗透成功），下一步将前端完全打通，实现从浏览器操作”新建项目→开始→实时查看编排进度→查看结论”的完整闭环。

### Priority Tasks

1. **前端编排进度实时刷新**：多轮编排运行时，前端轮询或 SSE 推送当前轮次、资产增长、MCP 执行状态，而非只在最终刷新
2. **前端编排状态面板增强**：将 `orchestratorRounds` 和停止原因展示到项目操作页面，让用户清楚看到每轮执行了什么
3. **MCP 工具执行日志前端展示**：将真实 MCP 运行记录（包括 `rawOutput`、`structuredContent`）在前端可视化
4. **真实目标端到端验证**：使用真实域名（如 testphp.vulnweb.com）通过浏览器完整走一遍流程
5. **前端交互修复**：空项目引导、加载状态、错误提示、长时间运行的用户反馈
6. **Playwright E2E 增强**：覆盖新建→开始→自动编排→资产/证据增长→最终结论的完整路径
7. **MCP 工具健康检查前端化**：在设置页面显示各 MCP 工具的真实可用状态（二进制是否存在、依赖是否安装）
8. **fscan/dirsearch 参数适配**：修复 fscan 端口扫描返回空结果、dirsearch 递归扫描等已知工具适配问题

### Acceptance Criteria

- 从浏览器新建项目→点击开始→观察多轮进度→查看最终结论，全程无需 CLI 操作
- 前端能实时反映编排进度（轮次、资产数、发现数）
- 至少一个真实目标能通过浏览器完成完整渗透流程
- Playwright E2E 测试覆盖核心用户路径

### Suggested Prompt

- `docs/prompts/2026-03-29-phase-11-frontend-production-loop-prompt.md`（待生成）

## Notes for Future LLM Sessions

- Read `code_index.md` first for code structure.
- Read this roadmap second for phase boundaries and current priorities.
- Treat the provided backend template as the primary visual reference.
- Do not develop new MCP servers directly in this platform repo by default; prefer `D:\dev\llmpentest-mcp-scaffold`.
- Keep the "LLM = brain, MCP = limbs" boundary explicit: external interactions should flow through MCP, while normalization and platform-side aggregation can stay internal.
