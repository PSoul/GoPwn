# Live LLM And Local Lab Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repeatable real-provider validation path that can run the platform against local Docker labs, verify the real MCP chain participates, and leave behind an auditable report artifact.

**Architecture:** Keep the current Next.js app routes, scheduler, MCP gateway, and connector registry as the execution backbone. Harden the orchestrator boundary so real LLM output is normalized into the platform's known capability/risk contract, then add a small live-validation runner that boots the app, exercises the HTTP API end-to-end, optionally auto-approves waiting actions, and writes a report under `output/live-validation/`.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Node.js child-process/fetch APIs, Docker Compose, Playwright-ready local runtime, OpenAI-compatible HTTP provider.

---

### Task 1: Harden Real LLM Plan Intake

**Files:**
- Modify: `lib/orchestrator-service.ts`
- Modify: `lib/llm-provider/openai-compatible-provider.ts`
- Modify: `tests/api/orchestrator-api.test.ts`

- [ ] **Step 1: Write the failing real-plan normalization test**

Add a focused API test case that simulates a real provider returning near-match capability text or markdown-wrapped JSON, then assert the stored plan still maps to platform-supported capabilities and risk levels.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm run test -- tests/api/orchestrator-api.test.ts`
Expected: FAIL because the current implementation trusts provider output too literally.

- [ ] **Step 3: Normalize provider responses before dispatch**

Update `lib/llm-provider/openai-compatible-provider.ts` to tolerate JSON wrapped in extra text when possible, and update `lib/orchestrator-service.ts` to coerce capability names, risk levels, and targets into the platform's known local-validation contract with a safe fallback.

- [ ] **Step 4: Re-run the focused orchestrator test**

Run: `npm run test -- tests/api/orchestrator-api.test.ts`
Expected: PASS with normalized plan items and stable execution behavior.

- [ ] **Step 5: Commit**

```bash
git add lib/orchestrator-service.ts lib/llm-provider/openai-compatible-provider.ts tests/api/orchestrator-api.test.ts
git commit -m "feat: normalize live orchestrator plans"
```

### Task 2: Add A Repeatable Live Validation Runner

**Files:**
- Create: `scripts/run-live-validation.mjs`
- Modify: `package.json`
- Create: `tests/lib/live-validation-report.test.ts`

- [ ] **Step 1: Write the failing report/runner helper test**

Add a focused unit test around any extracted report-shaping helper so the live-validation artifact format is deterministic and easy to inspect.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm run test -- tests/lib/live-validation-report.test.ts`
Expected: FAIL because the helper/script does not exist yet.

- [ ] **Step 3: Implement the runner and report generation**

Create `scripts/run-live-validation.mjs` that:
- verifies required runtime env vars for real-provider runs
- optionally launches `docker/local-labs/compose.yaml`
- starts the Next.js app on an isolated port
- calls `/api/projects/:id/orchestrator/plan` and `/orchestrator/local-validation`
- optionally approves any waiting approval
- fetches project context and MCP settings evidence
- writes JSON and Markdown report artifacts under `output/live-validation/<timestamp>/`

- [ ] **Step 4: Add an npm script**

Expose the runner from `package.json` so it can be executed consistently without retyping long commands.

- [ ] **Step 5: Re-run the focused runner/report test**

Run: `npm run test -- tests/lib/live-validation-report.test.ts`
Expected: PASS with deterministic report shaping.

- [ ] **Step 6: Commit**

```bash
git add scripts/run-live-validation.mjs package.json tests/lib/live-validation-report.test.ts
git commit -m "feat: add live validation runner"
```

### Task 3: Document The Live Validation Flow

**Files:**
- Modify: `docs/operations/local-docker-labs.md`
- Modify: `code_index.md`
- Modify: `roadmap.md`

- [ ] **Step 1: Document how to run the new validation path**

Extend `docs/operations/local-docker-labs.md` with the real-provider env requirements, the validation runner command, report output location, and expected approval-resume behavior.

- [ ] **Step 2: Update index and roadmap**

Reflect the new runner, report artifacts, and Phase 7 live-validation progress in `code_index.md` and `roadmap.md`.

- [ ] **Step 3: Commit**

```bash
git add docs/operations/local-docker-labs.md code_index.md roadmap.md
git commit -m "docs: add live validation workflow guidance"
```

### Task 4: Execute Real Validation And Verify The Slice

**Files:**
- Runtime only: `docker/local-labs/compose.yaml`
- Runtime artifact output: `output/live-validation/`

- [ ] **Step 1: Start the local labs**

Run: `docker compose -f docker/local-labs/compose.yaml up -d`
Expected: Juice Shop and WebGoat containers are created or started successfully.

- [ ] **Step 2: Run the real-provider validation command**

Run the new npm script with runtime-only environment variables for:
- `LLM_API_KEY`
- `LLM_BASE_URL`
- `LLM_ORCHESTRATOR_MODEL`
- optional `LLM_REVIEWER_MODEL`
- optional `LLM_TIMEOUT_MS`

Expected: a report is written under `output/live-validation/` and the run records show the real MCP web-surface path plus approval/resume behavior.

- [ ] **Step 3: Run the full verification suite**

Run: `npm run test:all`
Expected: PASS.

- [ ] **Step 4: Capture actual completion state**

Summarize what was truly validated live, what still remains manual or pending, and whether the current build qualifies as a first alpha release.
