# Phase 3B Prompt: Asset / Evidence / Worklog Persistence Expansion

You are taking over a Next.js App Router project for an authorized external security assessment platform.

## Workspace Rules

- Work only in a fresh isolated git branch/worktree.
- Do not touch the user's original branch.
- Update `code_index.md` and `roadmap.md` after the slice lands.
- Keep `*.txt` ignored in git.
- Run full verification before claiming completion:
  - `npm run test`
  - `npm run lint`
  - `npm run build`
  - `npm run e2e`

## Current Status

Phase 1 frontend prototype is complete.

Phase 2 read-only backend/API integration is complete.

Phase 3 currently already includes:

- local file-backed persistent store under `.prototype-store/prototype-store.json`
- persisted project create/update/archive flows
- persisted audit logs
- researcher login, signed session cookies, middleware route protection
- persisted approval decisions
- persisted global approval strategy updates
- persisted project-level approval-control updates
- approvals center, settings approval-policy page, and project operations page wired to real mutation APIs

## Your Goal

Expand persistence beyond projects and approvals into the next core backend surfaces, while preserving the current route structure and template-aligned UI.

## Required Scope

1. Persist assets and asset-detail state
   - move assets off static prototype-only reads
   - keep current asset list/detail contracts stable
   - support at least status/ownership/scope-review style mutations where appropriate

2. Persist evidence and evidence-detail state
   - move evidence records off static prototype-only reads
   - preserve current list/detail contracts
   - support review/verdict updates and audit-log emission

3. Persist work logs and broader settings state
   - move work logs off static prototype data
   - preserve audit-log reads
   - extend settings persistence where it makes sense for platform operations

4. Improve task/scheduler realism
   - keep task/scheduler UI in the project secondary route
   - introduce at least minimal write-capable task status / scheduling changes if the current structure supports it cleanly

## Constraints

- Do not collapse split project result pages back into one page.
- Keep the visual language aligned to the provided backend/login templates.
- Avoid replacing current information architecture unless necessary.
- Use primary docs when checking framework behavior, especially Context7 for Next.js.

## Suggested Acceptance Criteria

- asset, evidence, and work-log state survives restart
- key read surfaces no longer depend only on static in-memory prototype data
- at least one meaningful mutation flow exists for assets/evidence/task-or-scheduler controls
- audit history records high-value mutations
- full regression suite passes

## Important Existing Files

- `lib/prototype-store.ts`
- `lib/prototype-api.ts`
- `lib/project-repository.ts`
- `lib/approval-repository.ts`
- `app/api/assets/route.ts`
- `app/api/assets/[assetId]/route.ts`
- `app/api/evidence/route.ts`
- `app/api/evidence/[evidenceId]/route.ts`
- `app/(console)/assets/page.tsx`
- `app/(console)/assets/[assetId]/page.tsx`
- `app/(console)/evidence/page.tsx`
- `app/(console)/evidence/[evidenceId]/page.tsx`
- `app/(console)/settings/work-logs/page.tsx`
- `code_index.md`
- `roadmap.md`

## Deliverable Expectation

Implement the slice end-to-end, update tests, update docs, and leave the repo in a verifiably passing state.
