# 2026-03-26 Phase 3 Real Backend Core Prompt

You are continuing work on `llm-pentest-frontend-prototype` after:

1. a completed template-aligned frontend prototype
2. an initial read-only backend/API slice on branch `codex/backend-integration-2026-03-26`

## Read First

1. `code_index.md`
2. `roadmap.md`
3. `docs/superpowers/specs/2026-03-26-frontend-prototype-design.md`
4. `docs/superpowers/specs/2026-03-26-llm-pentest-platform-design.md`

## Current State

- The UI already matches the provided backend/login templates closely.
- Project detail is split into overview, results, flow, operations, and context routes.
- Settings are split into a hub plus dedicated subpages.
- A first read-only API contract now exists under `app/api/**` for:
  - project list
  - project overview
  - project flow
  - project operations
  - project context
  - project result tables
  - settings sections
  - settings system status
- Shared payload builders live in `lib/prototype-api.ts`.
- API tests already exist in `tests/api/*.test.ts`.

## Phase 3 Goal

Replace prototype-only read models with a real backend core while preserving the current route structure and visual behavior.

## Required Work

1. Introduce persistent storage for projects, approvals, assets, evidence, logs, and settings.
2. Add authenticated researcher access and session protection.
3. Implement real project CRUD APIs, not just read-only payloads.
4. Persist approval decisions and audit logs.
5. Keep the existing UI stable while migrating from mock data to real storage-backed services.

## Constraints

- Do not change the overall visual direction. Keep following the provided backend template style.
- Do not collapse the split project pages back into a single long page.
- Keep using isolated git branches/worktrees for major feature areas.
- Keep `code_index.md` and `roadmap.md` updated.
- Continue ignoring `*.txt` in git.

## Suggested Technical Direction

- Keep the API contracts in `lib/prototype-api.ts` as the seam between UI and storage.
- Introduce a repository/service layer behind those payload builders.
- Add mutation endpoints for project create/update/archive first.
- Expand API tests before changing UI behavior.

## Verification Requirements

Before claiming completion, run:

```bash
npx vitest run
npm run lint
npm run build
npm run e2e
```

Also add or update API tests for every new backend mutation or persistence behavior you introduce.
