# Code Index

## 1. Project Purpose

This workspace is a Next.js App Router frontend prototype for an authorized external security assessment platform. The product is positioned as a B-end research console, not a chat application. Its UX core is a "flow command console" that helps a single researcher:

- understand global project status
- manage project stages and blockers
- process high-risk approvals
- inspect asset profiles and relations
- review evidence chains and conclusions
- control MCP capabilities and platform safeguards

## 2. Routing Map

### Public Routes

- `app/page.tsx`
  Redirects `/` to `/dashboard`.
- `app/login/page.tsx`
  Platform account login entrance for researcher access.

### Console Route Group

- `app/(console)/layout.tsx`
  Shared authenticated shell for all console routes.
- `app/(console)/dashboard/page.tsx`
  Global dashboard rebuilt into a template-aligned command surface: left control summary, middle current-path panel, right recent activity feed, and bottom priority cards for today's work.
- `app/(console)/projects/page.tsx`
  Project management entry with searchable/filterable list, visible CRUD-style actions, and project-level summary metrics.
- `app/(console)/projects/new/page.tsx`
  New project entry using the shared project form component.
- `app/(console)/projects/[projectId]/page.tsx`
  Project detail "flow hub" that reads data by `projectId` and renders summary, stage flow, task board, and knowledge tabs for the selected project.
- `app/(console)/projects/[projectId]/edit/page.tsx`
  Project edit route reusing the same shared form as project creation, prefilled from the selected project.
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
  System control console for MCP tools, approval policy, scope rules, and emergency stop.

## 3. Layout and Shared UI

### Root Layout

- `app/layout.tsx`
  Defines global metadata, theme provider, and typography using `Fira_Sans` + `Fira_Code`.
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
  Client-side project management list with live search, stage/status filters, action buttons, and archive confirmation dialog.
- `components/projects/project-form.tsx`
  Shared create/edit project form used by `/projects/new` and `/projects/[projectId]/edit`.
- `components/projects/project-summary.tsx`
  Top summary block for project detail, including strategy baseline and tags.
- `components/projects/project-stage-flow.tsx`
  Stage progression visualization driven by per-project timeline data with blocking, next-step, and reflow callouts.
- `components/projects/project-task-board.tsx`
  Task and scheduler board for the selected project, including owners, linked targets, and update times.
- `components/projects/project-knowledge-tabs.tsx`
  Structured project knowledge surface that combines project-specific discoveries, assets, approvals, evidence, and scheduler items.

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

- `components/settings/mcp-tool-table.tsx`
  MCP capability/tool table with health, risk, concurrency, rate, timeout, and retry information.
- `components/settings/system-control-panel.tsx`
  System-level control console for overview metrics, approval policy, scope rules, and emergency stop actions.

## 5. Data and Type Layer

- `lib/navigation.ts`
  Single source of truth for sidebar navigation and route title lookup.
- `lib/prototype-types.ts`
  Domain model definitions for projects, project detail data, project form presets, approvals, assets, evidence, MCP tools, control settings, and policies.
- `lib/prototype-data.ts`
  Chinese mock datasets for all pages, including:
  - dashboard metrics and priorities
  - projects, per-project detail records, and project form presets
  - approvals with rationale/parameters/stop conditions
  - assets with ownership, confidence, relations, and linked evidence
  - evidence records with raw output, timeline, and verdict
  - MCP tool states, control overview, approval policies, and scope rules
  - helper lookups such as `getProjectById`, `getProjectDetailById`, and project-specific filter helpers
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
- `tests/pages/project-detail-page.test.tsx`
  Smoke test for project detail flow hub with dynamic `projectId` rendering.
- `tests/pages/approvals-assets-page.test.tsx`
  Smoke tests for approvals center, asset list, and asset detail profile.
- `tests/pages/evidence-settings-page.test.tsx`
  Smoke tests for evidence list/detail and settings control console.

## 7. Template Incorporation Notes

- The project was seeded from the provided backend/dashboard template to inherit the intended visual tone and shell structure.
- The current dashboard composition was further tightened to follow the template's "few large sections, restrained hierarchy" rhythm instead of a many-card KPI wall.
- The login experience was rebuilt from the provided login template direction, but adapted into the product-specific security assessment platform language.
- Existing template-derived utility and UI primitives remain under `components/ui` and `components/kokonutui`, while product-specific pages were rewritten around the approved security-research workflow.

## 8. Supporting Docs

- `.impeccable.md`
  Saved design context used to preserve the agreed visual/interaction direction.
- `docs/superpowers/plans/2026-03-26-frontend-prototype-implementation.md`
  Step-by-step implementation plan used during execution.
- `D:/dev/llmpentest0326/docs/superpowers/specs/2026-03-26-frontend-prototype-design.md`
  Upstream product/spec design reference from the main workspace.

## 9. Verification Commands

Use these commands from the worktree root:

```bash
npx vitest run
npm run lint
npm run build
```
