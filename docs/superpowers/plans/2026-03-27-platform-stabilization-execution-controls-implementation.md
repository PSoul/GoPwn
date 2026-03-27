# Platform Stabilization Execution Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make scheduler execution control operator-visible and truly effective by adding project-level scheduler pause/resume plus task-level cancel/retry controls that affect real persisted run state.

**Architecture:** Extend the existing scheduler persistence layer instead of introducing a separate subsystem. Add project-level scheduler control into the project detail contract, expose task operator actions through new project-scoped API routes, and render a dedicated runtime queue panel on the operations page. Keep approval control separate from scheduler control so the "审批" and "调度" boundaries stay clear.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Playwright, local JSON prototype store plus SQLite MCP registry.

---

### Task 1: Extend Runtime Types and Read Models

**Files:**
- Modify: `lib/prototype-types.ts`
- Modify: `lib/project-repository.ts`
- Modify: `lib/prototype-api.ts`
- Test: `tests/api/project-surfaces-api.test.ts`

- [ ] Add scheduler-control and scheduler-task payload types to `lib/prototype-types.ts`.
- [ ] Extend `ProjectDetailRecord` or `ProjectOperationsPayload` so the operations page can read scheduler-control state and real scheduler tasks.
- [ ] Seed new project details with a default scheduler-control state in `lib/project-repository.ts`.
- [ ] Update operations payload assembly in `lib/prototype-api.ts`.
- [ ] Write or extend API tests first to assert the new fields appear in the operations payload.

### Task 2: Add Scheduler Control Repository Logic

**Files:**
- Modify: `lib/mcp-scheduler-repository.ts`
- Modify: `lib/mcp-gateway-repository.ts`
- Modify: `lib/project-repository.ts` or `lib/prototype-api.ts`
- Test: `tests/lib/mcp-scheduler-service.test.ts`
- Test: `tests/lib/mcp-scheduler-retry.test.ts`

- [ ] Write failing tests for pausing a project scheduler, cancelling a ready task, and retrying a failed task.
- [ ] Add repository helpers for:
  - reading/updating project-level scheduler control
  - cancelling an eligible scheduler task
  - retrying a failed scheduler task
- [ ] Update linked MCP run state so operator actions do not leave task/run status divergent.
- [ ] Keep cancelled work out of future drains and make retried work re-enter the queue cleanly.

### Task 3: Guard Drain Logic with Real Operator Controls

**Files:**
- Modify: `lib/mcp-scheduler-service.ts`
- Test: `tests/lib/mcp-scheduler-service.test.ts`

- [ ] Write failing tests proving paused projects do not drain ready work.
- [ ] Update `drainStoredSchedulerTasks` and task processing flow to respect project-level scheduler pause.
- [ ] Ensure task cancel/retry paths affect actual execution outcomes, not just summary text.

### Task 4: Add Project-Scoped Scheduler Control APIs

**Files:**
- Create: `app/api/projects/[projectId]/scheduler-control/route.ts`
- Create: `app/api/projects/[projectId]/scheduler-tasks/[taskId]/route.ts`
- Modify: `lib/prototype-api.ts`
- Create or Modify: `lib/*write-schema*.ts`
- Test: `tests/api/scheduler-controls-api.test.ts`

- [ ] Write failing API tests for:
  - pausing and resuming project scheduler control
  - cancelling an eligible task
  - retrying a failed task
- [ ] Add request validation schemas for scheduler control and task actions.
- [ ] Implement route handlers returning stable JSON payloads consistent with the rest of the app.

### Task 5: Add Runtime Queue UI on Operations Page

**Files:**
- Create: `components/projects/project-scheduler-runtime-panel.tsx`
- Modify: `app/(console)/projects/[projectId]/operations/page.tsx`
- Modify: `components/projects/project-task-board.tsx` only if needed
- Test: `tests/projects/project-scheduler-runtime-panel.test.tsx`
- Test: `tests/pages/project-detail-page.test.tsx`

- [ ] Write failing client tests for pause/resume, cancel, and retry actions.
- [ ] Render a dedicated runtime queue panel on the operations page using the new operations payload fields.
- [ ] Keep the existing task board as high-level process context; do not overload it with runtime queue actions.
- [ ] Show clear disabled states and operator feedback for unsupported actions.

### Task 6: Document and Re-Index

**Files:**
- Modify: `code_index.md`
- Modify: `roadmap.md`
- Modify: `docs/operations/*.md` if a new operator flow is introduced

- [ ] Update docs to describe the new scheduler control surface and API routes.
- [ ] Keep the roadmap aligned with what this slice actually completed.

### Task 7: Verify End to End

**Files:**
- Modify only if needed based on failures

- [ ] Run targeted tests for scheduler repository/service, new APIs, and the new runtime panel.
- [ ] Run `npm run test:all`.
- [ ] Summarize what operator controls now truly affect runtime execution.
