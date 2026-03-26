# Code Index

## 1. Project Purpose

This workspace is a Next.js App Router frontend prototype for an authorized external security assessment platform. The product is positioned as a B-end research console, not a chat application. The current prototype now follows a clearer split:

- dashboard shell and overall visual rhythm come from the provided backend template
- login uses the provided login template direction
- project detail has been refocused from "process first" to "results first"
- stage flow and task/scheduling have been demoted into project-level secondary routes
- settings have been split into a settings hub plus dedicated subpages

## 2. Routing Map

### Public Routes

- `app/page.tsx`
  Redirects `/` to `/dashboard`.
- `app/login/page.tsx`
  Platform account login entrance for researcher access.

### API Route Group

- `app/api/dashboard/route.ts`
  Dashboard summary endpoint returning metrics, lead project context, queue priorities, approvals, assets, evidence, tools, and task data.
- `app/api/approvals/route.ts`
  Approval collection endpoint returning the global approval queue as `{ items, total }`.
- `app/api/assets/route.ts`
  Asset collection endpoint returning the asset-center list as `{ items, total }`.
- `app/api/assets/[assetId]/route.ts`
  Asset detail endpoint returning a single typed asset payload or a 404 JSON error.
- `app/api/evidence/route.ts`
  Evidence collection endpoint returning the evidence/review queue as `{ items, total }`.
- `app/api/evidence/[evidenceId]/route.ts`
  Evidence detail endpoint returning a single evidence record payload or a 404 JSON error.
- `app/api/projects/route.ts`
  Project collection endpoint returning `{ items, total }`, and now also supports persisted `POST` project creation.
- `app/api/projects/[projectId]/route.ts`
  Project overview endpoint returning the overview contract for a single project, and now also supports persisted `PATCH` project updates.
- `app/api/projects/[projectId]/archive/route.ts`
  Project archive endpoint that marks a project complete in persistent storage and emits a project audit-log entry.
- `app/api/projects/[projectId]/flow/route.ts`
  Project flow endpoint exposing current stage and timeline data.
- `app/api/projects/[projectId]/operations/route.ts`
  Project operations endpoint exposing task-stage context plus project approvals.
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
  Secondary project page for approvals, approval mode switch, task board, and scheduler controls.
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
  Global approvals center for cross-project high-risk action decisions.
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
  Dedicated approval strategy page with approval switch, scope rules, and emergency stop.
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
  Standard backend login form with account, password, and verification code fields.

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
  Project-level approval switch, approval record summary, and operations overview block.

### Approvals

- `components/approvals/approval-list.tsx`
  Approval queue table with status/risk structure and entry actions.
- `components/approvals/approval-detail-sheet.tsx`
  Embedded approval decision detail panel showing rationale, parameters, blockers, prerequisites, and decision actions.

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
- `components/settings/llm-settings-panel.tsx`
  Panel grid for orchestrator/reviewer/extractor model configuration.
- `components/settings/system-control-panel.tsx`
  Approval switch, policy, scope rule, and emergency stop surface for the approval-policy page.
- `components/settings/settings-log-table.tsx`
  Generic table used by work logs and audit logs.
- `components/settings/system-status-grid.tsx`
  Grid of system health cards for the settings hub and system-status page.

## 5. Data and Type Layer

- `lib/navigation.ts`
  Single source of truth for sidebar navigation and route title lookup.
- `lib/prototype-types.ts`
  Domain model definitions for:
  - dashboard metrics, dashboard priorities, and dashboard API payloads
  - projects and project detail records
  - result metrics, asset inventory groups, findings, and stage snapshots
  - approval control state
  - approvals, assets, evidence, and MCP tools
  - settings hub sections, LLM settings, work logs, audit logs, and system status cards
  - API payload types for dashboard, approvals, assets, evidence, project collections, project surface contracts, and settings summaries
- `lib/prototype-data.ts`
  Centralized Chinese mock data for all pages, including:
  - dashboard metrics and priorities
  - project list data and form presets
  - project-detail results-first data such as asset groups, findings, result metrics, stage snapshots, and per-project approval controls
  - approvals with rationale/parameters/stop conditions
  - assets with ownership, confidence, relations, and linked evidence
  - evidence records with raw output, timeline, and verdict
  - settings hub sections, LLM settings, work logs, audit logs, global approval control, and system status
  - helper lookups such as `getProjectById`, `getProjectDetailById`, and project-specific filter helpers
  - Phase 3 seed content for bootstrapping the local persistent store
- `lib/prototype-store.ts`
  Local file-backed persistence bootstrap. Ensures `.prototype-store/prototype-store.json` exists, seeds it from Phase 2 mock data, and reads/writes the store for server-side usage.
- `lib/project-repository.ts`
  Phase 3 repository layer for persisted projects and audit logs. Owns project creation, update, archive, default-detail generation, preset persistence, and audit-log emission.
- `lib/project-write-schema.ts`
  Zod validation schema for project create/update request payloads.
- `lib/prototype-api.ts`
  Backend/service contract layer. Still serves read-only dashboard/approvals/assets/evidence/settings payloads, and Phase 3 now adds persisted project create/update/archive operations plus audit-log reads behind the same seam.
- `lib/utils.ts`
  Shared utility helpers used by UI primitives/components.

## 6. Tests

- `tests/setup.ts`
  Shared Vitest + Testing Library setup.
- `tests/layout/app-shell.test.tsx`
  Verifies shared shell/navigation rendering.
- `tests/auth/login-form.test.tsx`
  Verifies login route/form rendering.
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
- `tests/api/project-surfaces-api.test.ts`
  API tests for project flow, operations, context, and result-table endpoints.
- `tests/api/operational-surfaces-api.test.ts`
  API tests for dashboard, approvals, assets, and evidence endpoints, including detail-route 404 handling.
- `tests/api/settings-api.test.ts`
  API tests for settings section and system-status endpoints.
- `playwright.config.ts`
  Playwright E2E configuration that boots the local Next.js dev server and runs browser smoke flows against the prototype routes.
- `scripts/run-playwright.mjs`
  Wrapper that clears the dedicated Playwright web-server port before launching browser tests, avoiding stale local dev-server conflicts in repeated runs.
- `e2e/prototype-smoke.spec.ts`
  Browser-level smoke tests for `/login`, `/dashboard`, `/projects`, project result/context routes, and split settings navigation.

## 7. Visual Review Artifacts

- `output/playwright/project-overview-results-hub.png`
  Full-page screenshot of the compact project overview plus results hub.
- `output/playwright/project-network-table.png`
  Full-page screenshot of the dedicated network results table.
- `output/playwright/settings-hub-split.png`
  Full-page screenshot of the split settings hub page.

## 8. Template Incorporation Notes

- The project was seeded from the provided backend/dashboard template to inherit the intended visual tone and shell structure.
- The dashboard shell, sidebar, and top chrome were already tightened to better match the supplied backend template.
- The login experience was rebuilt from the provided login template direction, but adapted into product-specific language.
- The current iteration keeps the template shell aesthetic while replacing generic dashboard content with LLM pentest platform-specific information architecture.

## 9. Supporting Docs

- `.impeccable.md`
  Saved design context used to preserve the agreed visual/interaction direction.
- `roadmap.md`
  Phase-based delivery tracker covering frontend closure, read-only backend/API integration, real backend persistence, and orchestration work, now including the first persisted project slice.
- `docs/superpowers/plans/2026-03-26-frontend-prototype-implementation.md`
  Step-by-step implementation plan used during execution.
- `docs/superpowers/specs/2026-03-26-frontend-prototype-design.md`
  Upstream product/spec reference from the approved design work.
- `docs/prompts/2026-03-26-phase-03-real-backend-core-prompt.md`
  Handoff prompt for the next major phase after the read-only backend/API integration slice.

## 10. Verification Commands

Use these commands from the worktree root:

```bash
npx vitest run
npm run lint
npm run build
npm run e2e
```
