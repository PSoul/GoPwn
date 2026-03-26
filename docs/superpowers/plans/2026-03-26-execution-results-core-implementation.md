# Execution Results Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist MCP execution outputs as platform assets, evidence, work logs, and findings so approved runs materially advance project state.

**Architecture:** Keep MCP dispatch and approval decisions as the gateway layer, then add a normalization layer that converts local or future real MCP structured output into stored platform records. Project detail pages continue reading from the prototype store, but their result-facing sections are refreshed from persisted execution data rather than static seed-only mock arrays.

**Tech Stack:** Next.js App Router route handlers, TypeScript, file-backed prototype store JSON, Vitest, Playwright.

---

## File Structure Map

- Modify: `lib/prototype-store.ts`
- Modify: `lib/prototype-types.ts`
- Modify: `lib/prototype-api.ts`
- Modify: `lib/mcp-gateway-repository.ts`
- Modify: `lib/mcp-workflow-service.ts`
- Modify: `lib/approval-repository.ts`
- Modify: `app/(console)/settings/work-logs/page.tsx`
- Modify: `tests/api/mcp-runs-api.test.ts`
- Modify: `tests/api/mcp-workflow-smoke-api.test.ts`
- Modify: `tests/api/operational-surfaces-api.test.ts`
- Modify: `code_index.md`
- Modify: `roadmap.md`
- Create: `lib/asset-repository.ts`
- Create: `lib/evidence-repository.ts`
- Create: `lib/work-log-repository.ts`
- Create: `lib/project-results-repository.ts`
- Create: `lib/mcp-execution-service.ts`
- Create: `tests/api/execution-results-api.test.ts`

## Task 1: Extend persisted store for execution-derived records

**Files:**
- Modify: `lib/prototype-store.ts`
- Modify: `lib/prototype-types.ts`
- Create: `lib/asset-repository.ts`
- Create: `lib/evidence-repository.ts`
- Create: `lib/work-log-repository.ts`
- Create: `lib/project-results-repository.ts`

- [ ] **Step 1: Add failing tests for stored execution result reads**
- [ ] **Step 2: Extend the store schema with persisted assets, evidence, work logs, and findings**
- [ ] **Step 3: Seed new collections from existing prototype data**
- [ ] **Step 4: Implement repository helpers for list/get/upsert flows**
- [ ] **Step 5: Run the focused tests**

## Task 2: Normalize MCP tool outputs into platform records

**Files:**
- Create: `lib/mcp-execution-service.ts`
- Modify: `lib/mcp-workflow-service.ts`
- Modify: `lib/mcp-gateway-repository.ts`
- Modify: `lib/prototype-types.ts`

- [ ] **Step 1: Add failing tests for output normalization**
- [ ] **Step 2: Separate local raw tool output from platform record normalization**
- [ ] **Step 3: Map `seed-normalizer`, `dns-census`, `web-surface-map`, and `report-exporter` into stored records**
- [ ] **Step 4: Add `auth-guard-check` local execution so approved high-risk runs can generate findings/evidence**
- [ ] **Step 5: Re-run focused API tests**

## Task 3: Resume approved runs into real execution

**Files:**
- Modify: `lib/approval-repository.ts`
- Modify: `lib/prototype-api.ts`
- Modify: `app/api/approvals/[approvalId]/route.ts`
- Modify: `tests/api/mcp-runs-api.test.ts`

- [ ] **Step 1: Add failing approval-resume assertions**
- [ ] **Step 2: Hook approval decisions to MCP execution resume**
- [ ] **Step 3: Persist resumed outputs and refresh run summaries**
- [ ] **Step 4: Verify project state, asset counts, and findings advance after approval**

## Task 4: Move API and UI surfaces to stored result data

**Files:**
- Modify: `lib/prototype-api.ts`
- Modify: `app/(console)/settings/work-logs/page.tsx`
- Modify: `tests/api/operational-surfaces-api.test.ts`
- Modify: `tests/pages/evidence-settings-page.test.tsx`

- [ ] **Step 1: Switch asset/evidence/work-log payloads from static arrays to repositories**
- [ ] **Step 2: Refresh dashboard/project context reads from persisted records**
- [ ] **Step 3: Verify results pages still render correctly with stored data**

## Task 5: Documentation and full verification

**Files:**
- Modify: `code_index.md`
- Modify: `roadmap.md`
- Modify: `.gitignore` if needed

- [ ] **Step 1: Update implementation index and roadmap**
- [ ] **Step 2: Confirm `*.txt` remains ignored**
- [ ] **Step 3: Run `npm run test`**
- [ ] **Step 4: Run `npm run lint`**
- [ ] **Step 5: Run `npm run build`**
- [ ] **Step 6: Run `npm run e2e`**
- [ ] **Step 7: Run `npm run test:all`**
