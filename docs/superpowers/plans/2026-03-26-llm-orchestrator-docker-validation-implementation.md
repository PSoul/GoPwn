# LLM Orchestrator and Docker Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real LLM provider abstraction, a local Docker vulnerable-target validation harness, and a minimal end-to-end orchestrated execution path that proves LLM -> MCP -> scheduler -> persisted results works locally.

**Architecture:** Keep the existing MCP gateway, connector registry, and scheduler as the execution backbone. Add a pluggable OpenAI-compatible provider layer for orchestration/review requests, a small orchestrator service that turns project state into capability-first dispatches, and a local-lab catalog/compose stack so the platform can safely validate the full flow against localhost targets without touching external systems.

**Tech Stack:** Next.js App Router, TypeScript, Node `fetch`, file-backed prototype store JSON, Docker Compose, Vitest, Playwright.

---

## File Structure Map

- Modify: `tests/setup.ts`
- Modify: `code_index.md`
- Modify: `roadmap.md`
- Modify: `lib/prototype-types.ts`
- Modify: `lib/prototype-api.ts`
- Modify: `lib/mcp-write-schema.ts`
- Modify: `app/api/projects/[projectId]/operations/route.ts`
- Modify: `app/(console)/projects/[projectId]/operations/page.tsx`
- Modify: `components/projects/project-mcp-runs-panel.tsx`
- Modify: `tests/projects/project-operations-panel.test.tsx`
- Modify: `tests/api/project-surfaces-api.test.ts`
- Modify: `e2e/prototype-smoke.spec.ts`
- Create: `lib/llm-provider/types.ts`
- Create: `lib/llm-provider/openai-compatible-provider.ts`
- Create: `lib/llm-provider/registry.ts`
- Create: `lib/orchestrator-service.ts`
- Create: `lib/local-lab-catalog.ts`
- Create: `app/api/projects/[projectId]/orchestrator/plan/route.ts`
- Create: `app/api/projects/[projectId]/orchestrator/local-validation/route.ts`
- Create: `components/projects/project-orchestrator-panel.tsx`
- Create: `tests/lib/llm-provider.test.ts`
- Create: `tests/api/orchestrator-api.test.ts`
- Create: `docker/local-labs/compose.yaml`
- Create: `docs/operations/local-docker-labs.md`
- Create: `docs/operations/mcp-onboarding-guide.md`
- Create: `docs/templates/mcp-connector-template.md`

## Task 1: Stabilize test/store isolation for the new worktree

**Files:**
- Modify: `tests/setup.ts`

- [ ] **Step 1: Keep the failing baseline reproduction**

Use the previously failing dashboard/operational surface suite as the regression signal for shared store collisions.

- [ ] **Step 2: Isolate default prototype-store usage per Vitest worker**

Ensure tests that do not explicitly set `PROTOTYPE_DATA_DIR` still get an isolated store directory.

- [ ] **Step 3: Re-run the full baseline test suite**

Run: `npm run test`
Expected: green baseline before Phase 6 feature work begins.

## Task 2: Add the pluggable LLM provider layer

**Files:**
- Create: `lib/llm-provider/types.ts`
- Create: `lib/llm-provider/openai-compatible-provider.ts`
- Create: `lib/llm-provider/registry.ts`
- Create: `tests/lib/llm-provider.test.ts`

- [ ] **Step 1: Write failing provider tests**

Cover env-based configuration loading, outbound request shaping, success parsing, and timeout/error reporting.

- [ ] **Step 2: Define provider contracts**

Capture orchestrator/reviewer request shapes, structured JSON-response expectations, and provider status details.

- [ ] **Step 3: Implement an OpenAI-compatible provider**

Use plain `fetch` against a configurable base URL and bearer token, without hardcoding any real credentials.

- [ ] **Step 4: Implement provider registry/status resolution**

Support a disabled/offline mode when env vars are absent so the platform remains operable in prototype mode.

- [ ] **Step 5: Run focused provider tests**

Run: `npm run test -- tests/lib/llm-provider.test.ts`

## Task 3: Add a minimal orchestrator service and API contracts

**Files:**
- Create: `lib/orchestrator-service.ts`
- Modify: `lib/prototype-types.ts`
- Modify: `lib/prototype-api.ts`
- Modify: `lib/mcp-write-schema.ts`
- Create: `app/api/projects/[projectId]/orchestrator/plan/route.ts`
- Create: `app/api/projects/[projectId]/orchestrator/local-validation/route.ts`
- Create: `tests/api/orchestrator-api.test.ts`

- [ ] **Step 1: Write failing orchestrator API tests**

Cover plan generation, provider-disabled fallback behavior, and end-to-end dispatch into the scheduler.

- [ ] **Step 2: Model orchestrator outputs**

Add typed plan items such as capability, requested action, target, rationale, and execution mode.

- [ ] **Step 3: Implement project-to-prompt shaping**

Turn project summary, stage, results, and local-lab metadata into a compact orchestration request.

- [ ] **Step 4: Implement plan execution**

Convert orchestrator plan items into existing MCP dispatch calls and drain scheduler work when safe.

- [ ] **Step 5: Re-run focused orchestrator tests**

Run: `npm run test -- tests/api/orchestrator-api.test.ts`

## Task 4: Add the local Docker lab catalog and validation harness

**Files:**
- Create: `lib/local-lab-catalog.ts`
- Create: `docker/local-labs/compose.yaml`
- Create: `docs/operations/local-docker-labs.md`

- [ ] **Step 1: Define the local-lab catalog**

Start with at least Juice Shop and WebGoat entries, using localhost-safe URLs and clear labels for the UI/API layer.

- [ ] **Step 2: Add a Compose stack**

Create a small `compose.yaml` that binds services to `127.0.0.1`, includes health checks when practical, and is safe for local-only validation.

- [ ] **Step 3: Document startup and teardown**

Explain how to run the stack, where targets become available, and what validation scenario the platform supports today.

- [ ] **Step 4: Keep the harness optional**

The platform should detect when local labs are not running and surface a useful validation message instead of failing opaquely.

## Task 5: Expose the orchestrated local validation flow in the operations page

**Files:**
- Create: `components/projects/project-orchestrator-panel.tsx`
- Modify: `app/api/projects/[projectId]/operations/route.ts`
- Modify: `app/(console)/projects/[projectId]/operations/page.tsx`
- Modify: `components/projects/project-mcp-runs-panel.tsx`
- Modify: `tests/projects/project-operations-panel.test.tsx`
- Modify: `tests/api/project-surfaces-api.test.ts`

- [ ] **Step 1: Add failing UI/API assertions**

Check that the operations route now includes orchestrator/local-lab state and the page renders a trigger surface.

- [ ] **Step 2: Add a compact orchestrator panel**

Show provider status, available local labs, last plan summary, and actions to generate/execute a local validation plan.

- [ ] **Step 3: Preserve the existing visual language**

Keep the panel aligned with the current backend template tone and avoid destabilizing the existing operations layout.

- [ ] **Step 4: Verify the operations page contract**

Run: `npm run test -- tests/projects/project-operations-panel.test.tsx tests/api/project-surfaces-api.test.ts`

## Task 6: Document MCP onboarding conventions and provide a connector template

**Files:**
- Create: `docs/operations/mcp-onboarding-guide.md`
- Create: `docs/templates/mcp-connector-template.md`
- Modify: `code_index.md`
- Modify: `roadmap.md`

- [ ] **Step 1: Document connector onboarding rules**

Capture metadata expectations, approval/risk defaults, normalization rules, and test requirements for adding future MCP families.

- [ ] **Step 2: Add a reusable template**

Provide a short implementation checklist/template another LLM can follow when adding a connector family.

- [ ] **Step 3: Update project docs**

Reflect the new provider layer, local-lab stack, and onboarding docs in the global index and roadmap.

## Task 7: Browser and full-stack verification

**Files:**
- Modify: `e2e/prototype-smoke.spec.ts`

- [ ] **Step 1: Extend Playwright smoke coverage**

Add one UI-level check that the operations page exposes the new orchestrator/local-validation surface.

- [ ] **Step 2: Run `npm run test`**

- [ ] **Step 3: Run `npm run lint`**

- [ ] **Step 4: Run `npm run build`**

- [ ] **Step 5: Run `npm run e2e`**

- [ ] **Step 6: Run `npm run test:all`**
