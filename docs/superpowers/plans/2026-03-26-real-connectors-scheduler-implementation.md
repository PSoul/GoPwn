# Real Connectors and Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ad hoc local MCP execution with a connector abstraction plus a persisted scheduler loop, and land one real DNS / certificate intelligence capability family without changing current UI/API contracts.

**Architecture:** Keep the current file-backed prototype store and route contracts, but split MCP execution into three layers: gateway intake, scheduler state transitions, and connector execution. Local foundational runners remain available behind the connector registry, while the DNS family gains a real Node-powered connector path using `node:dns/promises` and `node:tls` so approved or auto-runnable work can be replayed safely through the same scheduler.

**Tech Stack:** Next.js App Router, TypeScript, Node built-in `dns/promises`, Node built-in `tls`, file-backed JSON store, Vitest, Playwright.

---

## File Structure Map

- Modify: `lib/prototype-types.ts`
- Modify: `lib/prototype-store.ts`
- Modify: `lib/prototype-api.ts`
- Modify: `lib/mcp-gateway-repository.ts`
- Modify: `lib/mcp-execution-service.ts`
- Modify: `lib/mcp-workflow-service.ts`
- Modify: `lib/approval-repository.ts`
- Modify: `tests/api/mcp-runs-api.test.ts`
- Modify: `tests/api/mcp-workflow-smoke-api.test.ts`
- Modify: `tests/api/approval-controls-api.test.ts`
- Modify: `code_index.md`
- Modify: `roadmap.md`
- Create: `lib/mcp-connectors/types.ts`
- Create: `lib/mcp-connectors/registry.ts`
- Create: `lib/mcp-connectors/local-foundational-connectors.ts`
- Create: `lib/mcp-connectors/real-dns-intelligence-connector.ts`
- Create: `lib/mcp-scheduler-repository.ts`
- Create: `lib/mcp-scheduler-service.ts`
- Create: `tests/lib/mcp-scheduler-service.test.ts`
- Create: `tests/lib/mcp-connectors.test.ts`

## Task 1: Extend persisted types and store for scheduler state

**Files:**
- Modify: `lib/prototype-types.ts`
- Modify: `lib/prototype-store.ts`
- Create: `lib/mcp-scheduler-repository.ts`

- [ ] **Step 1: Write failing scheduler-store tests**

Add coverage for queue item persistence, retry scheduling, approval waiting, and delayed replay reads.

- [ ] **Step 2: Add scheduler-focused types**

Introduce explicit scheduler task/status types, retry metadata, delay timestamps, connector mode, and richer execution result contracts without breaking the existing page payloads.

- [ ] **Step 3: Extend the prototype store schema**

Persist scheduler task records alongside MCP runs, and ensure seed-store migration keeps older stores readable.

- [ ] **Step 4: Implement repository helpers**

Add list/get/upsert helpers for scheduler tasks and status transitions so higher layers do not write raw store patches.

- [ ] **Step 5: Run focused scheduler-store tests**

Run: `npm run test -- tests/lib/mcp-scheduler-service.test.ts`

## Task 2: Introduce connector abstraction and registry

**Files:**
- Create: `lib/mcp-connectors/types.ts`
- Create: `lib/mcp-connectors/registry.ts`
- Create: `lib/mcp-connectors/local-foundational-connectors.ts`
- Create: `lib/mcp-connectors/real-dns-intelligence-connector.ts`
- Modify: `lib/mcp-execution-service.ts`

- [ ] **Step 1: Write failing connector-selection tests**

Cover capability-to-connector routing, local fallback, and real DNS connector selection.

- [ ] **Step 2: Define connector contracts**

Capture execution context, raw output, structured content, normalization hints, retryability, and connector mode in a dedicated types module.

- [ ] **Step 3: Extract current local tool logic behind connectors**

Move the existing foundational tool behavior out of `mcp-execution-service.ts` into local connector implementations so the execution service becomes connector-agnostic.

- [ ] **Step 4: Implement the real DNS intelligence connector**

Use `node:dns/promises` for A/AAAA/MX/NS/TXT lookups and reverse lookups when IPs are present, then use `node:tls` certificate inspection for HTTPS-capable targets to collect issuer, validity window, SAN, and fingerprint data.

- [ ] **Step 5: Re-run focused connector tests**

Run: `npm run test -- tests/lib/mcp-connectors.test.ts`

## Task 3: Route dispatch and approval resume through the scheduler

**Files:**
- Modify: `lib/mcp-gateway-repository.ts`
- Create: `lib/mcp-scheduler-service.ts`
- Modify: `lib/approval-repository.ts`
- Modify: `lib/prototype-api.ts`

- [ ] **Step 1: Write failing transition tests for queued and approval-resume flows**

Assert that new dispatches become scheduler tasks, approvals resume queued work, and rejected/delayed approvals stop or defer execution cleanly.

- [ ] **Step 2: Add scheduler transition helpers**

Implement enqueue, claim-ready-task, mark-running, mark-completed, mark-failed, mark-waiting-approval, and mark-retry-scheduled behavior.

- [ ] **Step 3: Update gateway intake**

Make dispatch create both the visible MCP run record and the backing scheduler task, while preserving the existing HTTP response payload shape.

- [ ] **Step 4: Update approval resume path**

Replace ad hoc `resumeStoredApprovedMcpRun` behavior with scheduler-driven resume so approved tasks flow through the same executor and retry rules as normal queued work.

- [ ] **Step 5: Re-run approval and MCP API tests**

Run: `npm run test -- tests/api/mcp-runs-api.test.ts tests/api/approval-controls-api.test.ts`

## Task 4: Execute workflow smoke runs through scheduler + connectors

**Files:**
- Modify: `lib/mcp-workflow-service.ts`
- Modify: `lib/mcp-execution-service.ts`
- Modify: `tests/api/mcp-workflow-smoke-api.test.ts`

- [ ] **Step 1: Write failing workflow assertions for scheduler-backed execution**

Check that baseline runs complete via queued execution and approval scenarios stop with a resumable task state instead of direct inline execution only.

- [ ] **Step 2: Rework smoke workflow step execution**

Each step should enqueue through the same scheduler/gateway path, drain ready work when safe, and accumulate outputs from completed runs.

- [ ] **Step 3: Preserve normalization behavior**

Keep assets, evidence, work logs, and findings flowing through the current normalization layer, but source raw outputs from connectors rather than hardcoded tool branches.

- [ ] **Step 4: Add retry-safe behavior**

If a connector returns a retryable failure, the scheduler should mark the task for retry and avoid corrupting visible project state.

- [ ] **Step 5: Re-run focused workflow/API tests**

Run: `npm run test -- tests/api/mcp-workflow-smoke-api.test.ts tests/api/mcp-runs-api.test.ts`

## Task 5: Documentation and full verification

**Files:**
- Modify: `code_index.md`
- Modify: `roadmap.md`
- Modify: `.gitignore` if needed

- [ ] **Step 1: Update implementation index**

Document the new scheduler layer, connector registry, and real DNS intelligence path for later LLM sessions.

- [ ] **Step 2: Update roadmap**

Mark Phase 5 progress clearly and call out the next slice for real LLM orchestrator wiring and Docker靶场 end-to-end validation.

- [ ] **Step 3: Confirm `*.txt` remains ignored**

Verify `.gitignore` still protects prompt scratch files and tool dumps.

- [ ] **Step 4: Run `npm run test`**

- [ ] **Step 5: Run `npm run lint`**

- [ ] **Step 6: Run `npm run build`**

- [ ] **Step 7: Run `npm run e2e`**

- [ ] **Step 8: Run `npm run test:all`**
