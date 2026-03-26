# Roadmap

## Project Snapshot

- Date: `2026-03-26`
- Current focus: the first Phase 7 slice is landing on `codex/production-backend-real-mcp-2026-03-26`, adding a SQLite-backed MCP server registry, a real stdio MCP server/client path for Web surface probing, and settings exposure for connected MCP servers.
- Working mode: each major feature area uses its own isolated git branch/worktree so the existing branch is not disturbed.

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

- Status: In progress on `codex/production-backend-real-mcp-2026-03-26`
- Goal: harden the prototype backend into a more production-like runtime and replace more simulated capability families with real MCP integrations.

### Task Checklist

- completed: augment the prototype backend with a SQLite-backed persistence layer dedicated to external MCP server metadata and invocation logs
- completed: introduce a real MCP stdio server/client attachment model using the official TypeScript SDK for the `Web 页面探测类` capability
- completed: expose the connected MCP server registry and recent invocation history in the MCP settings API and settings UI
- in progress: replace or augment more of the file-backed prototype runtime with database-backed persistence suitable for longer-running environments
- pending: wire project/task execution state to durable queues, cancellation, and better operator controls
- pending: expand real connector families beyond DNS + Web surface probing into API reconnaissance and evidence capture
- pending: refine the LLM provider configuration surface, secret handling guidance, and operational fallback behavior
- pending: add local-lab-backed regression suites that can optionally run against real Docker targets in CI or controlled local environments

### Acceptance Criteria

- partially met: backend state now includes a durable SQLite slice for external MCP server registry metadata and real-call audit history
- met: at least one non-DNS external interaction family runs through a real MCP/server integration path
- project execution, approvals, evidence, and findings remain auditable after backend hardening
- the local Docker validation stack remains usable as a regression harness while the backend evolves

## Notes for Future LLM Sessions

- Read `code_index.md` first for code structure.
- Read this roadmap second for phase boundaries and current priorities.
- Treat the provided backend template as the primary visual reference.
- Do not develop major new work on an existing branch when a new isolated branch/worktree is requested.
- Keep the "LLM = brain, MCP = limbs" boundary explicit: external interactions should flow through MCP, while normalization and platform-side aggregation can stay internal.
