# Roadmap

## Project Snapshot

- Date: `2026-03-28`
- Current focus: 平台主线已收敛到 `v0.2.1` 基线，包含真实证据采集、生命周期控制、durable worker、cooperative cancellation 与双本地靶场闭环。下一阶段不再在本仓库里直接扩具体 MCP，而是把新增 MCP 的起步工作迁到独立脚手架仓库。
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
- completed: wire lifecycle `start / resume` transitions to real LLM kickoff planning, persist the latest plan, and automatically dispatch only the low-risk first-step items
- completed: make `stop` terminal for the project lifecycle, cancelling queued work and requesting cooperative abort for already-running executions
- completed: centralize the platform LLM-brain prompts so lifecycle kickoff, local-lab planning, and provider calls all use one shared prompt contract
- completed: add a minimal `pages/_document.tsx` compatibility shim so `next build` remains stable in the current Windows + App Router workspace setup
- partially met: move the current file-backed queue toward a more durable long-lived worker/executor model suitable for longer sessions

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
- met: this slice has already been verified with `pnpm test`, `pnpm lint`, `pnpm build`, and `pnpm e2e`

## Recommended Next Phase

- Name: `Phase 9 - Standalone MCP Scaffold Expansion`
- Suggested branch/worktree: 平台主仓库保持在 `main`，新的 MCP 工作优先转到独立仓库 `D:\dev\llmpentest-mcp-scaffold`
- Goal: 让后续 MCP 开发不再耦合平台主仓库，通过独立脚手架仓库交付能力族 starter、合同镜像、stdio smoke 和平台注册工作流；平台主仓库只在确有必要时补最小桥接。

### Priority Tasks

- create or expand starter packs in the standalone scaffold repo, beginning with `端口探测类`
- keep the platform-side MCP contract mirror and scaffold docs in sync with the real platform fields
- only return to the platform repo when a new capability family needs:
  - a new capability enum
  - a new connector
  - new normalization/writeback logic
- continue platform-side regression hardening around queue recovery, environment-blocked lab runs, report export, and second-lab execution

### Acceptance Criteria

- the standalone scaffold repo can independently build, test, validate contracts, and smoke its stdio example
- new MCP work no longer needs to start inside the platform repo by default
- platform docs clearly explain when to stay in the scaffold repo and when to return for runtime bridge work
- platform-side queue, closure, and diagnostics hardening continues without being blocked by MCP family scaffolding work

### Suggested Prompt

- `docs/prompts/2026-03-28-phase-11-platform-runtime-bridge-hardening-prompt.md`
  - 当下一次回到宿主平台仓库继续开发时，优先使用这份 prompt；它聚焦宿主平台运行时、桥接、配置和闭环硬化，而不是继续在本仓库里新增 MCP server

## Notes for Future LLM Sessions

- Read `code_index.md` first for code structure.
- Read this roadmap second for phase boundaries and current priorities.
- Treat the provided backend template as the primary visual reference.
- Do not develop new MCP servers directly in this platform repo by default; prefer `D:\dev\llmpentest-mcp-scaffold`.
- Keep the "LLM = brain, MCP = limbs" boundary explicit: external interactions should flow through MCP, while normalization and platform-side aggregation can stay internal.
