# Code Index

## 1. Project Purpose

This workspace is a Next.js App Router frontend prototype for an authorized external security assessment platform. The product is positioned as a B-end research console, not a chat application. The current prototype now follows a clearer split:

- dashboard shell and overall visual rhythm come from the provided backend template
- login uses the provided login template direction
- project detail has been refocused from "process first" to "results first"
- stage flow and task/scheduling have been demoted into project-level secondary routes
- settings have been split into a settings hub plus dedicated subpages
- MCP is now a first-class platform surface with a persisted registry, project-side dispatch records, and approval-linked execution state
- foundational MCP execution now persists normalized outputs into assets, evidence, work logs, and findings so approved runs materially advance project state
- the operations page now includes an orchestrator console for local lab planning and validation rehearsal
- the backend now includes a configurable OpenAI-compatible LLM provider layer plus local Docker lab support

## 2. Routing Map

### Public Routes

- `app/page.tsx`
  Redirects `/` to `/dashboard`.
- `app/login/page.tsx`
  Platform account login entrance for researcher access. When already authenticated, middleware now redirects it back to `/dashboard`.

### API Route Group

- `app/api/auth/login/route.ts`
  Login endpoint validating platform account, password, and captcha, then issuing the `prototype_session` cookie.
- `app/api/auth/logout/route.ts`
  Logout endpoint clearing the session cookie, recording an audit log entry, and redirecting browser form submissions back to `/login`.
- `app/api/dashboard/route.ts`
  Dashboard summary endpoint returning metrics, lead project context, queue priorities, approvals, assets, evidence, tools, and task data.
- `app/api/approvals/route.ts`
  Approval collection endpoint returning the global approval queue as `{ items, total }`.
- `app/api/approvals/[approvalId]/route.ts`
  Approval detail/mutation endpoint supporting persisted approval decisions (`已批准` / `已拒绝` / `已延后`). Approved runs now resume into execution and write execution results back into platform records.
- `app/api/assets/route.ts`
  Asset collection endpoint returning the persisted asset-center list as `{ items, total }`.
- `app/api/assets/[assetId]/route.ts`
  Asset detail endpoint returning a single persisted asset payload or a 404 JSON error.
- `app/api/evidence/route.ts`
  Evidence collection endpoint returning the persisted evidence/review queue as `{ items, total }`.
- `app/api/evidence/[evidenceId]/route.ts`
  Evidence detail endpoint returning a single persisted evidence record payload or a 404 JSON error.
- `app/api/projects/route.ts`
  Project collection endpoint returning `{ items, total }`, and now also supports persisted `POST` project creation.
- `app/api/projects/[projectId]/route.ts`
  Project overview endpoint returning the overview contract for a single project, and now also supports persisted `PATCH` project updates.
- `app/api/projects/[projectId]/archive/route.ts`
  Project archive endpoint that marks a project complete in persistent storage and emits a project audit-log entry.
- `app/api/projects/[projectId]/approval-control/route.ts`
  Project-level approval-control mutation endpoint for saving operations-page approval switch changes.
- `app/api/projects/[projectId]/flow/route.ts`
  Project flow endpoint exposing current stage and timeline data.
- `app/api/projects/[projectId]/operations/route.ts`
  Project operations endpoint exposing task-stage context, project approvals, recent MCP run records, and orchestrator/local-lab panel data.
- `app/api/projects/[projectId]/orchestrator/plan/route.ts`
  Orchestrator-plan endpoint. `GET` returns current provider/local-lab/last-plan state, and `POST` generates a new plan for a selected local lab.
- `app/api/projects/[projectId]/orchestrator/local-validation/route.ts`
  Local-validation endpoint. Starts a local lab validation run, returns completed/blocked/waiting-approval state, and persists the newest orchestrator plan.
- `app/api/projects/[projectId]/mcp-runs/route.ts`
  Project-level MCP dispatch endpoint. `GET` returns persisted run records and `POST` accepts a capability-first dispatch request, then either auto-executes it through the execution-normalization service or routes it into approval.
- `app/api/projects/[projectId]/mcp-workflow/smoke-run/route.ts`
  Runnable workflow-smoke endpoint for end-to-end MCP verification. Executes the foundational local MCP chain through the same persistence path used by direct dispatch and can optionally stop at a high-risk approval checkpoint.
- `app/api/projects/[projectId]/context/route.ts`
  Project context endpoint exposing evidence, approvals, assets, and activity-support data.
- `app/api/projects/[projectId]/results/domains/route.ts`
  Project domains/Web entry result-table endpoint.
- `app/api/projects/[projectId]/results/network/route.ts`
  Project IP/port/service result-table endpoint.
- `app/api/projects/[projectId]/results/findings/route.ts`
  Project findings result-table endpoint.
- `app/api/settings/sections/route.ts`
  Settings hub category summary endpoint.
- `app/api/settings/audit-logs/route.ts`
  Persistent audit-log collection endpoint returning `{ items, total }` for platform and operator actions.
- `app/api/settings/work-logs/route.ts`
  Persistent work-log collection endpoint returning execution/playback records for daily LLM + MCP activity.
- `app/api/settings/approval-policy/route.ts`
  Global approval-policy read/mutation endpoint returning the persisted settings payload and saving approval strategy changes.
- `app/api/settings/system-status/route.ts`
  Settings system-health summary endpoint.

### Console Route Group

- `app/(console)/layout.tsx`
  Shared authenticated shell for all console routes.
- `app/(console)/dashboard/page.tsx`
  Template-aligned dashboard with command-surface composition and current work priorities.
- `app/(console)/projects/page.tsx`
  Project management entry with search, filters, action buttons, and CRUD-style prototype operations.
- `app/(console)/projects/new/page.tsx`
  Project creation page using the shared project form.
- `app/(console)/projects/[projectId]/page.tsx`
  Project overview page. It now acts as a compact summary + results hub instead of rendering all assets/findings/context directly inline.
- `app/(console)/projects/[projectId]/flow/page.tsx`
  Secondary project page dedicated to stage flow details, blockers, reflow, and next-step reasoning.
- `app/(console)/projects/[projectId]/operations/page.tsx`
  Secondary project page for approvals, persisted approval mode switch, orchestrator controls, task board, and scheduler controls.
- `app/(console)/projects/[projectId]/context/page.tsx`
  Secondary project page for evidence, approvals, supplemental intelligence, asset-center context, and activity timeline.
- `app/(console)/projects/[projectId]/results/domains/page.tsx`
  Full-page table for domains and Web entry points.
- `app/(console)/projects/[projectId]/results/network/page.tsx`
  Full-page table for IP, port, and service results.
- `app/(console)/projects/[projectId]/results/findings/page.tsx`
  Full-page findings/vulnerability table.
- `app/(console)/projects/[projectId]/edit/page.tsx`
  Project edit route reusing the same shared form as project creation.
- `app/(console)/approvals/page.tsx`
  Global approvals center for cross-project high-risk action decisions, now backed by persisted queue filtering and decision actions.
- `app/(console)/assets/page.tsx`
  Asset center with scope status, recognition profile, and project linkage.
- `app/(console)/assets/[assetId]/page.tsx`
  Asset detail view focused on current profile, relations, and next actions.
- `app/(console)/evidence/page.tsx`
  Evidence/result list for structured review and chain tracing.
- `app/(console)/evidence/[evidenceId]/page.tsx`
  Evidence detail page ordered as raw output -> screenshot -> structured summary -> linked context -> verdict.
- `app/(console)/settings/page.tsx`
  Settings hub with category links and system status preview.
- `app/(console)/settings/mcp-tools/page.tsx`
  Dedicated MCP capability/tool management page.
- `app/(console)/settings/llm/page.tsx`
  Dedicated LLM model responsibility and budget page.
- `app/(console)/settings/approval-policy/page.tsx`
  Dedicated approval strategy page with persisted approval switch, scope rules, and emergency stop controls.
- `app/(console)/settings/work-logs/page.tsx`
  Dedicated execution/work log page.
- `app/(console)/settings/audit-logs/page.tsx`
  Dedicated audit/event log page.
- `app/(console)/settings/system-status/page.tsx`
  Dedicated platform health/status page.

## 3. Layout and Shared UI

### Root Layout

- `app/layout.tsx`
  Defines global metadata, theme provider, and stable template-aligned typography using `Inter`.
- `middleware.ts`
  Protects console routes and non-public APIs with session-cookie checks, redirects unauthenticated users to `/login`, and prevents authenticated users from re-entering the login page.
- `app/globals.css`
  Global styling, tokens, and Tailwind-driven visual baseline.

### Shared Shell

- `components/layout/app-shell.tsx`
  Main shell wrapper combining sidebar, header, and route content.
- `components/layout/app-sidebar.tsx`
  Global navigation generated from `lib/navigation.ts`.
- `components/layout/app-header.tsx`
  Top bar showing route title and context actions.

### Reusable Presentation Components

- `components/shared/page-header.tsx`
  Standardized page title + description + action row.
- `components/shared/section-card.tsx`
  Main content section wrapper used across all console pages.
- `components/shared/stat-card.tsx`
  Metric card pattern used on dashboard and summary surfaces.
- `components/shared/status-badge.tsx`
  Shared status/risk/scope badge abstraction.

### Base UI Primitives

- `components/ui/*`
  shadcn-style primitives and utility components used throughout the prototype.
- `components/theme-provider.tsx`
  Theme switching provider.
- `components/theme-toggle.tsx`
  Theme switcher control.

## 4. Domain Component Groups

### Auth

- `components/auth/login-form.tsx`
  Standard backend login form with account, password, and verification code fields, now wired to the real login API and post-login redirect flow.

### Projects

- `components/projects/project-list-client.tsx`
  Client-side project management list with live search, stage/status filters, action buttons, and a real archive flow that calls the archive API and updates local UI state.
- `components/projects/project-form.tsx`
  Shared create/edit project form used by `/projects/new` and `/projects/[projectId]/edit`, now wired to the persisted create/update project APIs.
- `components/projects/project-summary.tsx`
  Compact project hero block with result metrics plus small entry cards for stage flow, operations, and evidence/context.
- `components/projects/project-results-hub.tsx`
  Three-card results entry surface linking to dedicated domain/Web, network, and findings table pages.
- `components/projects/project-inventory-table.tsx`
  Shared full-width result table used by domain/Web and network result pages.
- `components/projects/project-findings-table.tsx`
  Full-width findings table used by the dedicated findings page.
- `components/projects/project-knowledge-tabs.tsx`
  Full context surface for evidence, approvals, supplemental intelligence, asset center entries, and activity timeline on the dedicated context route.
- `components/projects/project-stage-flow.tsx`
  Full stage progression visualization used on the dedicated flow page.
- `components/projects/project-task-board.tsx`
  Task and scheduler board used on the dedicated operations page.
- `components/projects/project-operations-panel.tsx`
  Project-level approval switch, note editor, persisted save flow, approval record summary, and operations overview block.
- `components/projects/project-orchestrator-panel.tsx`
  Client-side orchestrator console for local lab selection, plan generation, local validation execution, provider state display, and last-plan review.
- `components/projects/project-mcp-runs-panel.tsx`
  Project-level MCP dispatch console showing how the LLM requests a capability, how the gateway chooses a tool, and whether the request auto-executes or enters approval. It also exposes one-click workflow smoke runs for end-to-end MCP path verification.

### Approvals

- `components/approvals/approval-center-client.tsx`
  Client-side approvals workbench that owns queue filtering, active-sheet selection, persisted decision actions, and queue statistics.
- `components/approvals/approval-list.tsx`
  Interactive approval queue table with active-row selection and empty-state handling.
- `components/approvals/approval-detail-sheet.tsx`
  Embedded approval decision detail panel showing rationale, parameters, blockers, prerequisites, and persisted decision actions.

### Assets

- `components/assets/asset-table.tsx`
  Asset inventory table with scope status and entry to detail view.
- `components/assets/asset-profile-panel.tsx`
  Core "current recognition profile" panel for a single asset.
- `components/assets/asset-relations.tsx`
  Relation and follow-up view linking assets to evidence, tasks, and related objects.

### Evidence

- `components/evidence/evidence-table.tsx`
  Evidence queue/list table with traceability fields.
- `components/evidence/evidence-detail.tsx`
  Full evidence detail renderer for raw outputs, screenshot notes, structured summary, context links, timeline, and verdict.

### Settings

- `components/settings/settings-subnav.tsx`
  Shared settings secondary navigation used by the hub and all subpages.
- `components/settings/settings-hub-grid.tsx`
  Card grid linking to each settings category.
- `components/settings/mcp-tool-table.tsx`
  MCP capability/tool table with health, risk, concurrency, rate, timeout, and retry information.
- `components/settings/mcp-gateway-client.tsx`
  Interactive MCP registry control plane with search, capability overview, boundary rules, registration checklist, tool detail editing, and health-check actions.
- `components/settings/llm-settings-panel.tsx`
  Panel grid for orchestrator/reviewer/extractor model configuration.
- `components/settings/system-control-panel.tsx`
  Client-side approval switch, strategy note editor, save actions, scope rule display, and emergency-stop surface for the approval-policy page.
- `components/settings/settings-log-table.tsx`
  Generic table used by work logs and audit logs.
- `components/settings/system-status-grid.tsx`
  Grid of system health cards for the settings hub and system-status page.

## 5. Data and Type Layer

- `lib/navigation.ts`
  Single source of truth for sidebar navigation and route title lookup.
- `lib/asset-repository.ts`
  Persisted asset repository for listing, detail lookup, and deterministic upsert of execution-derived asset records.
- `lib/approval-repository.ts`
  Approval/state repository handling persisted approval decisions, global approval strategy updates, project-level approval-control updates, queue reordering, project pending-approval sync, audit-log emission, and approval-to-MCP-run state propagation.
- `lib/approval-write-schema.ts`
  Zod validation schemas for approval decisions and approval-control patch payloads.
- `lib/auth-session.ts`
  Stateless session-cookie helper using signed tokens for login protection, middleware checks, and logout parsing.
- `lib/auth-repository.ts`
  Seeded researcher-account validation plus login/logout audit-log recording for the Phase 3 auth slice.
- `lib/evidence-repository.ts`
  Persisted evidence repository for list/detail access and execution-result upserts.
- `lib/llm-provider/types.ts`
  Shared provider contracts for orchestrator/reviewer plan generation.
- `lib/llm-provider/openai-compatible-provider.ts`
  OpenAI-compatible provider implementation. Builds env-driven provider status, performs `chat/completions` requests, and parses JSON plan responses.
- `lib/llm-provider/registry.ts`
  Provider resolver/status facade. Enables or disables the real orchestrator based purely on runtime environment variables.
- `lib/local-lab-catalog.ts`
  Catalog of local Docker validation targets such as Juice Shop and WebGoat, with optional host-side probing to mark labs `online`, `offline`, or `unknown`.
- `lib/mcp-connectors/types.ts`
  Shared connector contracts defining execution context, connector mode (`local` / `real`), success/failure result shapes, and the raw-output contract consumed by the normalization layer.
- `lib/mcp-connectors/registry.ts`
  Connector selection registry. Chooses the best implementation for a run, preferring the real DNS connector when the target supports it and falling back to local foundational connectors otherwise.
- `lib/mcp-connectors/local-foundational-connectors.ts`
  Extracted local foundational connector implementations for `seed-normalizer`, `dns-census`, `web-surface-map`, `auth-guard-check`, and `report-exporter`. These preserve deterministic smoke-run behavior behind the new connector abstraction.
- `lib/mcp-connectors/real-dns-intelligence-connector.ts`
  First real connector family. Uses Node built-ins (`dns/promises` and `tls`) to collect DNS records, reverse lookups, and certificate metadata, while exposing test adapters so CI stays deterministic.
- `lib/mcp-execution-service.ts`
  Execution normalization layer behind the connector registry. Resolves the selected connector, executes it, converts connector-level structured output into platform assets/evidence/work logs/findings, updates run summaries, and refreshes project result state.
- `lib/mcp-scheduler-repository.ts`
  Persisted scheduler-task repository. Stores queue state for ready, waiting-approval, delayed, retry-scheduled, running, completed, failed, and cancelled work.
- `lib/mcp-scheduler-service.ts`
  Scheduler loop and task transition service. Creates per-run scheduler tasks, drains ready work, applies retry/delay transitions, and resumes approval-gated runs through the same executor path.
- `lib/prototype-types.ts`
  Domain model definitions for:
  - dashboard metrics, dashboard priorities, and dashboard API payloads
  - projects and project detail records
  - result metrics, asset inventory groups, findings, and stage snapshots
  - approval control state
  - approvals, assets, evidence, MCP tools, MCP run records, scheduler-task records, and MCP workflow smoke payloads
  - settings hub sections, LLM settings, work logs, audit logs, and system status cards
  - API payload types for dashboard, approvals, assets, evidence, project collections, project surface contracts, MCP dispatch contracts, and settings summaries
- `lib/prototype-data.ts`
  Centralized Chinese mock data for all pages, including:
  - dashboard metrics and priorities
  - project list data and form presets
  - project-detail results-first data such as asset groups, findings, result metrics, stage snapshots, and per-project approval controls
  - approvals with rationale/parameters/stop conditions
  - assets with ownership, confidence, relations, and linked evidence
  - evidence records with raw output, timeline, and verdict
  - settings hub sections, LLM settings, work logs, audit logs, global approval control, system status, and MCP run seeds
  - helper lookups such as `getProjectById`, `getProjectDetailById`, and project-specific filter helpers
  - Phase 3/4 seed content for bootstrapping the local persistent store
- `lib/project-results-repository.ts`
  Derived project-results layer. Rebuilds project result metrics, result-table groups, current stage snapshot, activity feed, and findings view from persisted assets, evidence, work logs, approvals, and MCP run state.
- `lib/prototype-store.ts`
  Local file-backed persistence bootstrap. Ensures `.prototype-store/prototype-store.json` exists, seeds it from mock data, migrates older stores onto the expanded Phase 6 shape, and now persists orchestrator last-plan state alongside scheduler tasks, projects, approvals, tools, runs, assets, evidence, work logs, and audit logs.
- `lib/prototype-record-utils.ts`
  Shared record helpers for timestamp formatting, stable execution-derived IDs, and count-display formatting.
- `lib/mcp-gateway-repository.ts`
  Persisted MCP gateway layer. Owns project-level MCP run records, capability-to-tool selection, approval requirement decisions, approval record creation for gated actions, blocked-run handling, initial queued-run creation, and approval-result synchronization back into MCP runs.
- `lib/mcp-repository.ts`
  Persisted MCP registry repository for tool listing, tool updates, and health-check state changes.
- `lib/mcp-workflow-service.ts`
  Scheduler-backed MCP workflow runner used for smoke tests. Chains seed normalization, passive discovery, Web mapping, optional approval-gated validation, and report export through the same queue/connector/normalization path used by normal project dispatch.
- `lib/mcp-write-schema.ts`
  Zod validation schemas for MCP tool patch payloads, project-level MCP dispatch payloads, workflow smoke-run payloads, and orchestrator local-validation payloads.
- `lib/orchestrator-service.ts`
  Phase 6 orchestration service. Generates LLM or fallback plans for local labs, persists the latest plan per project, and runs the local validation loop through the same MCP dispatch/scheduler path as normal work.
- `lib/project-mcp-dispatch-service.ts`
  Shared helper that dispatches a project MCP run and immediately drains the scheduler when the run is auto-runnable, avoiding duplicated dispatch+drain logic.
- `lib/project-repository.ts`
  Phase 3 repository layer for persisted projects and audit logs. Owns project creation, update, archive, default-detail generation, preset persistence, and audit-log emission.
- `lib/project-write-schema.ts`
  Zod validation schema for project create/update request payloads.
- `lib/prototype-api.ts`
  Backend/service contract layer. Serves dashboard/assets/evidence/work-log/settings reads, persisted auth/project/approval operations, MCP registry payloads, project-level MCP dispatch/read contracts, orchestrator plan/local-validation contracts, scheduler-driven approval resume execution, and the workflow smoke-run contract behind the same seam.
- `lib/utils.ts`
  Shared utility helpers used by UI primitives/components.
- `lib/work-log-repository.ts`
  Persisted work-log repository for LLM/MCP playback records used by the settings work-log page and API.

## 6. Tests

- `tests/setup.ts`
  Shared Vitest + Testing Library setup, now including explicit DOM cleanup after each test to prevent UI-state leakage between client tests.
- `tests/layout/app-shell.test.tsx`
  Verifies shared shell/navigation rendering.
- `tests/auth/login-form.test.tsx`
  Verifies login route/form rendering.
- `tests/auth/login-ui.test.tsx`
  Verifies login form submission hits the auth API and redirects to the requested protected route.
- `tests/auth/middleware.test.ts`
  Verifies middleware redirects unauthenticated console requests, allows authenticated ones, and blocks protected APIs with `401`.
- `tests/pages/dashboard-page.test.tsx`
  Smoke test for dashboard content.
- `tests/pages/projects-page.test.tsx`
  Smoke tests for project list, project creation form, and project edit form.
- `tests/pages/project-mutations-ui.test.tsx`
  UI interaction tests verifying that the project form calls create APIs and the project list archive flow calls the archive API.
- `tests/pages/project-detail-page.test.tsx`
  Smoke tests for:
  - project overview links to dedicated result pages and context route
  - dedicated project result tables
  - dedicated project flow page
  - dedicated project operations page
  - dedicated project context page
- `tests/pages/approvals-assets-page.test.tsx`
  Smoke tests for approvals center, asset list, and asset detail profile.
- `tests/pages/evidence-settings-page.test.tsx`
  Smoke tests for evidence list/detail, settings hub, and each split settings subpage.
- `tests/api/projects-api.test.ts`
  API tests for project collection and project overview endpoints, including 404 handling.
- `tests/api/project-mutations-api.test.ts`
  Phase 3 API tests for persisted project create, update, archive, and audit-log emission behavior.
- `tests/api/approval-controls-api.test.ts`
  API tests for approval decision persistence, approval-linked project refresh behavior, global approval-policy updates, and project-level approval-control updates.
- `tests/api/project-surfaces-api.test.ts`
  API tests for project flow, operations, context, and result-table endpoints, including MCP run presence and local-lab panel data on the operations contract.
- `tests/api/orchestrator-api.test.ts`
  API tests for Phase 6 orchestrator routes, covering fallback plan generation, operations-payload exposure of the last plan, local validation execution, approval pause, and approval resume persistence.
- `tests/api/operational-surfaces-api.test.ts`
  API tests for dashboard, approvals, assets, and evidence endpoints, including detail-route 404 handling.
- `tests/api/settings-api.test.ts`
  API tests for settings section and system-status endpoints.
- `tests/api/auth-api.test.ts`
  API tests for login success/failure, session-cookie issuance, logout, and auth audit-log emission.
- `tests/api/mcp-runs-api.test.ts`
  API tests for project-level MCP dispatch. Covers low-risk immediate execution, high-risk approval-gated dispatch, approval-linked resume execution, and result persistence into project context and work logs.
- `tests/api/mcp-workflow-smoke-api.test.ts`
  API tests for the runnable foundational MCP workflow, covering both a fully automatic baseline path, persisted result emission, work-log generation, and a path that correctly halts at a high-risk approval boundary.
- `tests/lib/mcp-connectors.test.ts`
  Unit tests for connector selection and the first real DNS connector family, including deterministic mocked Node DNS/TLS adapter results.
- `tests/lib/mcp-scheduler-service.test.ts`
  Unit tests for scheduler task creation, delayed approval handling, and approved-task resume execution.
- `tests/lib/mcp-scheduler-retry.test.ts`
  Unit test for the scheduler retry path using a mocked execution-service response to verify `retry_scheduled` transitions.
- `tests/approvals/approval-center-client.test.tsx`
  Client interaction test verifying the approvals workbench calls the approval mutation API and surfaces success feedback.
- `tests/projects/project-operations-panel.test.tsx`
  Client interaction test verifying project-level approval-control changes call the project mutation API and update local success state.
- `tests/projects/project-orchestrator-panel.test.tsx`
  Client interaction tests for plan generation and local validation actions inside the new orchestrator panel.
- `tests/settings/system-control-panel.test.tsx`
  Client interaction test verifying the approval-policy settings panel persists global strategy changes through the new API.
- `playwright.config.ts`
  Playwright E2E configuration that boots the local Next.js dev server and runs browser smoke flows against the prototype routes.
- `scripts/run-playwright.mjs`
  Wrapper that clears the dedicated Playwright web-server port before launching browser tests, avoiding stale local dev-server conflicts in repeated runs.
- `e2e/prototype-smoke.spec.ts`
  Browser-level smoke tests for `/login`, authenticated access to `/dashboard`, `/projects`, project result/context routes, split settings navigation, and the operations-page orchestrator-plan flow.

## 7. Visual Review Artifacts

- `output/playwright/project-overview-results-hub.png`
  Full-page screenshot of the compact project overview plus results hub.
- `output/playwright/project-network-table.png`
  Full-page screenshot of the dedicated network results table.
- `output/playwright/settings-hub-split.png`
  Full-page screenshot of the split settings hub page.
- `output/playwright/project-operations-mcp-workflow.png`
  Full-page screenshot of the project operations page after MCP dispatch history and workflow smoke controls were added.

## 8. Template Incorporation Notes

- The project was seeded from the provided backend/dashboard template to inherit the intended visual tone and shell structure.
- The dashboard shell, sidebar, and top chrome were already tightened to better match the supplied backend template.
- The login experience was rebuilt from the provided login template direction, but adapted into product-specific language.
- The current iteration keeps the template shell aesthetic while replacing generic dashboard content with LLM pentest platform-specific information architecture.

## 9. Supporting Docs

- `.impeccable.md`
  Saved design context used to preserve the agreed visual/interaction direction.
- `roadmap.md`
  Phase-based delivery tracker covering frontend closure, backend integration, persistence, MCP execution, real connectors/scheduler, and the Phase 6 orchestrator/local-Docker validation slice.
- `docker/local-labs/compose.yaml`
  Local Docker validation harness for OWASP Juice Shop and WebGoat, used to exercise the platform against safe, local-only vulnerable targets.
- `docs/operations/local-docker-labs.md`
  Operator guide for launching and validating the local Docker lab stack and using it from the project operations page.
- `docs/operations/mcp-onboarding-guide.md`
  Phase 6 onboarding guide explaining the boundary model, connector expectations, registration flow, and testing checklist for future MCP tool families.
- `docs/templates/mcp-connector-template.md`
  Reusable checklist/template for designing and reviewing a new MCP connector before implementation.
- `docs/superpowers/plans/2026-03-26-frontend-prototype-implementation.md`
  Step-by-step implementation plan used during execution.
- `docs/superpowers/plans/2026-03-26-execution-results-core-implementation.md`
  Step-by-step implementation plan for the execution-results slice covering assets/evidence/work-log persistence and approval resume execution.
- `docs/superpowers/plans/2026-03-26-real-connectors-scheduler-implementation.md`
  Step-by-step implementation plan for the Phase 5 connector abstraction, scheduler loop, approval resume, retry handling, and real DNS connector slice.
- `docs/superpowers/plans/2026-03-26-llm-orchestrator-docker-validation-implementation.md`
  Step-by-step implementation plan for the Phase 6 provider abstraction, orchestrator APIs/UI, MCP onboarding docs, and local Docker validation harness.
- `docs/superpowers/specs/2026-03-26-frontend-prototype-design.md`
  Upstream product/spec reference from the approved design work.
- `docs/prompts/2026-03-26-phase-03-real-backend-core-prompt.md`
  Handoff prompt for the next major phase after the read-only backend/API integration slice.
- `docs/prompts/2026-03-26-phase-06-llm-orchestrator-docker-validation-prompt.md`
  Handoff prompt for the next isolated branch/worktree, focused on real LLM provider wiring, MCP onboarding conventions, and local Docker vulnerable-target validation.
- `docs/prompts/2026-03-26-phase-03b-persistence-expansion-prompt.md`
  Handoff prompt for the next persistence slice covering assets, evidence, work logs, and task/scheduler realism.
- `docs/prompts/2026-03-26-phase-04b-execution-results-prompt.md`
  Phase 4B implementation prompt that drove the current execution-results slice.
- `docs/prompts/2026-03-26-phase-05-real-connectors-scheduler-prompt.md`
  Recommended next-phase prompt for replacing local MCP runners with real connector families and a scheduler/task loop.
- `docs/prompts/2026-03-26-phase-07-production-backend-integration-prompt.md`
  Recommended next-phase prompt for hardening the prototype backend, expanding real MCP/server integration, and moving toward a more production-like runtime.
- `docs/superpowers/specs/2026-03-26-mcp-gateway-registry-spec.md`
  MCP gateway registry and execution spec describing the current capability-first dispatch model, approval linkage, foundational runnable tools, and next backend integration targets.

## 10. Verification Commands

Use these commands from the worktree root:

```bash
npx vitest run
npm run lint
npm run build
npm run e2e
npm run test:all
```
