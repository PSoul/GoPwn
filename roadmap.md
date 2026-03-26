# Roadmap

## Project Snapshot

- Date: `2026-03-26`
- Current focus: Phase 4 is actively turning MCP from a registry/settings concept into a runnable execution layer with project-level dispatch records and workflow smoke tests in a fresh isolated worktree.
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

- Status: In progress on `codex/mcp-gateway-core-2026-03-26`
- Goal: connect real LLM/MCP orchestration while preserving approval and audit controls.

### Task Checklist

- completed: implement persisted MCP tool registry, health checks, capability metadata, boundary rules, and registration checklist controls
- completed: add project-level MCP dispatch records with capability-first routing, tool selection, blocked-run handling, and approval-linked execution state
- completed: add foundational runnable local MCP tools and a smoke workflow that validates both full low-risk execution and approval-gated interruption
- in progress: add richer task queue, retries, rate limiting, and emergency stop controls that drive actual execution rather than only settings state
- pending: define provider abstraction for real LLM orchestration and reviewer models
- pending: connect execution outputs into persisted assets, evidence, work logs, and project result surfaces
- pending: replace local foundational runners with real MCP connectors incrementally, one capability family at a time

### Acceptance Criteria

- controlled execution can be triggered end-to-end from the platform
- high-risk actions cannot bypass approval
- audit chain covers planning, execution, evidence, and operator intervention
- at least one foundational workflow can be smoke-tested locally before real MCP connectors are attached

## Notes for Future LLM Sessions

- Read `code_index.md` first for code structure.
- Read this roadmap second for phase boundaries and current priorities.
- Treat the provided backend template as the primary visual reference.
- Do not develop major new work on an existing branch when a new isolated branch/worktree is requested.
