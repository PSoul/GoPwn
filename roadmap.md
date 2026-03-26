# Roadmap

## Project Snapshot

- Date: `2026-03-26`
- Current focus: an isolated backend/API branch is active and has landed the first read-only contract slice for projects and settings.
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

- Status: In progress on `codex/backend-integration-2026-03-26`
- Goal: add a first backend/API layer inside the Next.js app and begin frontend/backend contract alignment.

### Task Checklist

- completed: create route handlers for project list, project overview, project flow, project operations, project context, project result tables, and settings summary data
- completed: extract a shared service layer so mock data and route handlers use one contract
- completed: add API tests for key JSON endpoints
- completed: keep the frontend stable while preparing it for data access migration by switching the related pages onto the new service layer
- in progress: update `code_index.md`, `roadmap.md`, and handoff prompt files after the backend slice lands
- next: extend the same contract approach to approvals, assets, evidence, and dashboard data
- next: add write-capable project CRUD endpoints before moving into persistent storage

### Acceptance Criteria

- API routes return stable JSON payloads for the main project and settings views
- API tests pass locally
- frontend can be evolved against the new contract without reworking the route structure
- the full frontend regression suite still passes on the backend branch

## Phase 3: Real Backend Core

- Status: Planned
- Goal: replace prototype-only mock behavior with persisted platform capabilities.

### Task Checklist

- introduce database-backed entities for projects, approvals, assets, evidence, logs, and settings
- add authenticated researcher access and session boundaries
- persist audit logs and approval actions
- wire project CRUD to real storage

### Acceptance Criteria

- platform state survives restart
- core records are queryable and editable through the backend
- approval and audit history are persisted, not mocked

## Phase 4: Orchestration and MCP Execution

- Status: Planned
- Goal: connect real LLM/MCP orchestration while preserving approval and audit controls.

### Task Checklist

- define provider abstraction for LLM orchestration and reviewer models
- implement MCP tool registry, health checks, and controlled execution boundaries
- add task queue, retries, rate limiting, and emergency stop controls
- connect evidence generation and approval gating to real execution records

### Acceptance Criteria

- controlled execution can be triggered end-to-end from the platform
- high-risk actions cannot bypass approval
- audit chain covers planning, execution, evidence, and operator intervention

## Notes for Future LLM Sessions

- Read `code_index.md` first for code structure.
- Read this roadmap second for phase boundaries and current priorities.
- Treat the provided backend template as the primary visual reference.
- Do not develop major new work on an existing branch when a new isolated branch/worktree is requested.
