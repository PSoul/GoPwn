# Cooperative Cancellation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a running-task stop request into a true cooperative cancellation signal that propagates through the active execution runtime, down into connectors and the stdio MCP client, so long-running work can stop early instead of only being blocked at writeback time.

**Architecture:** Add an in-memory active-execution registry keyed by `runId`, backed by `AbortController`. When the scheduler claims a task it registers a live controller, passes `signal` through `executeStoredMcpRun` into `McpConnectorExecutionContext`, and unregisters it at the end. When operators stop a `running` task, the scheduler-control repository aborts the active controller; connectors and the stdio MCP client then cooperatively observe the signal and return quickly.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Node `AbortController`, Node `AbortSignal`, Node `timers/promises`, official MCP TypeScript SDK stdio transport

---

## File Map

- Create: `lib/mcp-execution-runtime.ts`
  - Runtime registry for active execution controllers and abort requests.
- Modify: `lib/mcp-connectors/types.ts`
  - Add `signal?: AbortSignal` to connector execution context.
- Modify: `lib/mcp-client-service.ts`
  - Support abortable stdio MCP calls by closing the client/transport on signal abort.
- Modify: `lib/mcp-connectors/real-web-surface-mcp-connector.ts`
  - Pass the signal into real stdio MCP tool calls and map abort into a fast failure path.
- Modify: `lib/mcp-connectors/real-dns-intelligence-connector.ts`
  - Add cancellation checkpoints and abort-aware TLS probe cleanup.
- Modify: `lib/mcp-connectors/local-foundational-connectors.ts`
  - Add cheap cancellation checkpoints so local fallback connectors also cooperate.
- Modify: `lib/mcp-execution-service.ts`
  - Thread `signal` through execution context.
- Modify: `lib/mcp-scheduler-service.ts`
  - Register/unregister active execution controllers for claimed work and share the signal with heartbeat + execution.
- Modify: `lib/project-scheduler-control-repository.ts`
  - Abort the active controller immediately when a `running` task receives a stop request.
- Modify: `tests/lib/scheduler-operator-controls.test.ts`
  - Verify stop requests trigger runtime abort.
- Create or modify: `tests/lib/mcp-execution-runtime.test.ts`
  - Verify registry register/abort/unregister behavior.
- Modify: `tests/lib/real-web-surface-mcp-connector.test.ts`
  - Verify a long-running stdio MCP execution exits quickly after abort.
- Modify: `tests/lib/mcp-connectors.test.ts`
  - Verify local/real connector cancellation checkpoints behave safely.
- Modify: `roadmap.md`
- Modify: `code_index.md`

### Task 1: Add Active Execution Registry

**Files:**
- Create: `lib/mcp-execution-runtime.ts`
- Create or modify: `tests/lib/mcp-execution-runtime.test.ts`

- [x] **Step 1: Write the failing runtime-registry tests**
- [x] **Step 2: Run test to verify it fails**
  Run: `npm run test -- tests/lib/mcp-execution-runtime.test.ts`
- [x] **Step 3: Implement register / abort / unregister helpers**
- [x] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

### Task 2: Propagate AbortSignal Through Scheduler and Control Layer

**Files:**
- Modify: `lib/mcp-scheduler-service.ts`
- Modify: `lib/project-scheduler-control-repository.ts`
- Modify: `lib/mcp-execution-service.ts`
- Modify: `lib/mcp-connectors/types.ts`
- Modify: `tests/lib/scheduler-operator-controls.test.ts`

- [x] **Step 1: Write the failing scheduler/control tests**
- [x] **Step 2: Run test to verify it fails**
  Run: `npm run test -- tests/lib/scheduler-operator-controls.test.ts`
- [x] **Step 3: Implement controller registration, abort, and teardown**
- [x] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

### Task 3: Make Real MCP Stdio Calls Cooperatively Abort

**Files:**
- Modify: `lib/mcp-client-service.ts`
- Modify: `lib/mcp-connectors/real-web-surface-mcp-connector.ts`
- Modify: `tests/lib/real-web-surface-mcp-connector.test.ts`

- [x] **Step 1: Write the failing real-web abort test**
- [x] **Step 2: Run test to verify it fails**
  Run: `npm run test -- tests/lib/real-web-surface-mcp-connector.test.ts`
- [x] **Step 3: Implement abortable MCP client calls**
- [x] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

### Task 4: Add Connector-Level Cancellation Checkpoints

**Files:**
- Modify: `lib/mcp-connectors/real-dns-intelligence-connector.ts`
- Modify: `lib/mcp-connectors/local-foundational-connectors.ts`
- Modify: `tests/lib/mcp-connectors.test.ts`

- [x] **Step 1: Write the failing connector cancellation tests**
- [x] **Step 2: Run test to verify it fails**
  Run: `npm run test -- tests/lib/mcp-connectors.test.ts`
- [x] **Step 3: Add cancellation checkpoints and abort-aware TLS cleanup**
- [x] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

### Task 5: Document and Verify

**Files:**
- Modify: `roadmap.md`
- Modify: `code_index.md`

- [x] **Step 1: Update docs and indexes**
- [x] **Step 2: Run focused verification**
  Run: `npm run test -- tests/lib/mcp-execution-runtime.test.ts tests/lib/scheduler-operator-controls.test.ts tests/lib/real-web-surface-mcp-connector.test.ts tests/lib/mcp-connectors.test.ts`
- [ ] **Step 3: Run full verification**
  Run: `npm run test:all`
- [ ] **Step 4: Commit and push**
  Run: `git push -u origin codex/cooperative-cancellation-2026-03-27`
