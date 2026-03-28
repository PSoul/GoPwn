# Durable Worker Orphan Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lease-backed durable worker semantics so `running` scheduler tasks can survive process loss, recover expired orphan executions, fence off stale worker writeback, and expose enough runtime metadata for operators to understand what the scheduler is doing.

**Architecture:** Keep the current file-backed scheduler queue, but add worker lease metadata directly onto persisted `McpSchedulerTaskRecord` items. `drainStoredSchedulerTasks` will claim work with a worker id + `leaseToken`, run a heartbeat loop while the connector is executing, and recover stale `running` tasks whose lease has expired before draining new work; writeback is allowed only when the finishing worker still owns the active lease.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, file-backed JSON prototype store, Node `AbortController`, Node `timers/promises`

---

## File Map

- Modify: `lib/prototype-types.ts`
  - Extend `McpSchedulerTaskRecord` with durable-worker lease metadata.
- Modify: `lib/mcp-scheduler-repository.ts`
  - Add claim, heartbeat, lease-clear, ownership fencing, and orphan-recovery helpers.
- Modify: `lib/mcp-scheduler-service.ts`
  - Claim tasks through durable-worker helpers, run the heartbeat loop, recover stale running tasks before draining, and clear lease state on terminal transitions.
- Modify: `lib/mcp-execution-service.ts`
  - Preserve truthful cancellation behavior while refusing stale-lease writeback.
- Modify: `components/projects/project-scheduler-runtime-panel.tsx`
  - Surface worker/lease metadata in the runtime queue so recovery is operator-visible.
- Modify: `tests/lib/mcp-scheduler-service.test.ts`
  - Add end-to-end scheduler tests for claim, heartbeat-backed execution, and orphan recovery.
- Create or modify: `tests/lib/mcp-scheduler-repository.test.ts`
  - Add focused repository tests for lease claim, heartbeat refresh, and expired-running-task recovery.
- Modify: `tests/projects/project-scheduler-runtime-panel.test.tsx`
  - Verify new runtime metadata is rendered and stale-running-task copy remains understandable.
- Modify: `roadmap.md`
  - Move durable-worker/orphan-recovery progress into the roadmap.
- Modify: `code_index.md`
  - Index the new durable-worker helpers and updated runtime semantics.
- Modify: `docs/operations/project-scheduler-runtime-controls.md`
  - Document lease, heartbeat, and orphan-recovery behavior.

### Task 1: Define Durable Scheduler Lease State

**Files:**
- Modify: `lib/prototype-types.ts`
- Modify: `lib/mcp-scheduler-repository.ts`
- Create or modify: `tests/lib/mcp-scheduler-repository.test.ts`

- [ ] **Step 1: Write the failing repository tests**

```ts
it("claims a ready task with worker lease metadata", () => {
  // seed task -> claim -> expect workerId, leaseToken, heartbeatAt, leaseExpiresAt
})

it("refreshes lease metadata only for the owning worker", () => {
  // claim -> stale token heartbeat rejected -> active token heartbeat succeeds
})

it("recovers expired running tasks back into the queue", () => {
  // running task with expired lease -> recover -> expect ready and recovery summary
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/mcp-scheduler-repository.test.ts`
Expected: FAIL because lease helpers and metadata do not exist yet.

- [ ] **Step 3: Write minimal repository implementation**

```ts
type SchedulerLeasePatch = Pick<
  McpSchedulerTaskRecord,
  | "workerId"
  | "leaseToken"
  | "leaseStartedAt"
  | "leaseExpiresAt"
  | "heartbeatAt"
  | "lastRecoveredAt"
  | "recoveryCount"
>

export function claimStoredSchedulerTask(...) { ... }
export function heartbeatStoredSchedulerTask(...) { ... }
export function clearStoredSchedulerTaskLease(...) { ... }
export function recoverExpiredStoredSchedulerTasks(...) { ... }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/mcp-scheduler-repository.test.ts`
Expected: PASS with repository lease transitions green.

- [ ] **Step 5: Commit**

```bash
git add lib/prototype-types.ts lib/mcp-scheduler-repository.ts tests/lib/mcp-scheduler-repository.test.ts
git commit -m "feat: add scheduler lease metadata"
```

### Task 2: Make Drain Use Durable Workers and Recover Orphans

**Files:**
- Modify: `lib/mcp-scheduler-service.ts`
- Modify: `lib/mcp-execution-service.ts`
- Modify: `tests/lib/mcp-scheduler-service.test.ts`

- [ ] **Step 1: Write the failing scheduler-service tests**

```ts
it("records claim ownership and clears lease metadata after completion", async () => {
  // drain queued task -> expect worker-claim trace + cleared lease after completion
})

it("requeues expired running tasks before draining new work", async () => {
  // stale running task -> drain -> expect recovery summary and successful completion
})

it("blocks stale worker writeback after ownership has moved", async () => {
  // execute with old leaseToken -> expect aborted writeback and no asset commit
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/mcp-scheduler-service.test.ts`
Expected: FAIL because drain does not claim with a worker id, heartbeat, or recover stale `running` work.

- [ ] **Step 3: Write minimal scheduler implementation**

```ts
async function withTaskHeartbeat(taskId: string, ownership: SchedulerTaskOwnership, work: () => Promise<Result>) {
  // use AbortController + timers/promises.setInterval
  // note: this only keeps the platform-side lease alive; it is not yet remote connector cancellation
}

export async function drainStoredSchedulerTasks(...) {
  recoverExpiredStoredSchedulerTasks(...)
  // claim ready tasks, heartbeat while executeStoredMcpRun() is in flight,
  // clear lease fields on completed/failed/cancelled transitions
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/mcp-scheduler-service.test.ts`
Expected: PASS showing stale running tasks are recovered and terminal tasks clear their lease state.

- [ ] **Step 5: Commit**

```bash
git add lib/mcp-scheduler-service.ts lib/mcp-execution-service.ts tests/lib/mcp-scheduler-service.test.ts
git commit -m "feat: recover orphaned running scheduler tasks"
```

### Task 3: Expose Lease State in the Operations UI

**Files:**
- Modify: `components/projects/project-scheduler-runtime-panel.tsx`
- Modify: `tests/projects/project-scheduler-runtime-panel.test.tsx`

- [ ] **Step 1: Write the failing runtime-panel test**

```tsx
it("shows worker and lease metadata for runtime queue tasks", () => {
  // render running task with workerId/leaseExpiresAt/heartbeatAt
  // expect human-readable lease info
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/projects/project-scheduler-runtime-panel.test.tsx`
Expected: FAIL because the runtime panel does not render lease or recovery metadata yet.

- [ ] **Step 3: Write minimal UI/API implementation**

```tsx
{task.workerId ? <p>执行 worker: {task.workerId}</p> : null}
{task.leaseExpiresAt ? <p>租约截止 {task.leaseExpiresAt}</p> : null}
{task.lastRecoveredAt ? <p>最近恢复 {task.lastRecoveredAt}</p> : null}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/projects/project-scheduler-runtime-panel.test.tsx`
Expected: PASS with runtime queue metadata visible.

- [ ] **Step 5: Commit**

```bash
git add components/projects/project-scheduler-runtime-panel.tsx tests/projects/project-scheduler-runtime-panel.test.tsx
git commit -m "feat: show durable scheduler lease metadata"
```

### Task 4: Document and Verify the Slice

**Files:**
- Modify: `docs/operations/project-scheduler-runtime-controls.md`
- Modify: `roadmap.md`
- Modify: `code_index.md`

- [ ] **Step 1: Update docs and indexes**

```md
- add lease/heartbeat/orphan-recovery semantics
- explain that running stop requests are still cooperative platform-side, not hard remote kill
- note this slice as precursor to true cooperative cancellation
```

- [ ] **Step 2: Run focused and full verification**

Run: `npm run test -- tests/lib/mcp-scheduler-repository.test.ts tests/lib/mcp-scheduler-service.test.ts tests/lib/mcp-execution-service.test.ts tests/lib/scheduler-operator-controls.test.ts tests/api/scheduler-controls-api.test.ts tests/projects/project-scheduler-runtime-panel.test.tsx`
Expected: PASS

Run: `npm run test:all`
Expected: PASS with no new scheduler regressions.

- [ ] **Step 3: Commit**

```bash
git add docs/operations/project-scheduler-runtime-controls.md roadmap.md code_index.md
git commit -m "docs: record durable worker recovery slice"
```

- [ ] **Step 4: Push branch**

Run: `git push -u origin codex/durable-worker-orphan-recovery-2026-03-27`
Expected: remote branch created and ready for the next slice.
