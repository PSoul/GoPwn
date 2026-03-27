# WebGoat Controlled Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real `受控验证类` MCP path based on a generic HTTP request workbench, then use it to drive a real WebGoat finding closure from project execution through evidence, findings, and report export.

**Architecture:** Keep the current capability-first gateway and scheduler design, but replace the `auth-guard-check` local-only fallback with a real stdio MCP server plus a real connector. The first concrete closure targets WebGoat's anonymously exposed Spring Actuator surface, which is low-impact to verify yet still proves the approval, evidence, finding, and export chain end-to-end.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Node stdio MCP servers via `@modelcontextprotocol/sdk`, Playwright, local Docker labs

---

## File Map

- Create: `scripts/mcp/http-validation-runtime.mjs`
  - Encapsulate auditable HTTP request execution, redirect handling, and docker-fallback helpers for controlled validation.
- Create: `scripts/mcp/http-validation-server.mjs`
  - Expose the generic HTTP validation MCP tool over stdio.
- Create: `lib/mcp-connectors/real-http-validation-mcp-connector.ts`
  - Call the new MCP server, translate real tool output into the platform connector contract, and honor cancellation.
- Modify: `lib/mcp-connectors/registry.ts`
  - Register the new real connector before local fallbacks.
- Modify: `lib/mcp-execution-service.ts`
  - Normalize real HTTP validation output into assets, evidence, findings, and work logs.
- Modify: `lib/orchestrator-service.ts`
  - Allow the WebGoat path to include `HTTP / API 结构发现类` before `受控验证类`, and steer the high-risk target toward the discovered actuator surface.
- Modify: `scripts/lib/live-validation-runner.mjs`
  - Auto-register the HTTP validation MCP server and include its contract in live validation bootstrapping.
- Modify: `docs/contracts/mcp-server-contract.md`
  - Clarify how generic HTTP validation tools should expose auditable request/response fields.
- Modify: `tests/lib/real-http-validation-mcp-connector.test.ts`
  - Add focused real-connector tests.
- Modify: `tests/lib/live-validation-runner.test.ts`
  - Cover auto-registration of the new MCP server.
- Modify: `tests/api/orchestrator-api.test.ts`
  - Cover WebGoat planning/execution using real controlled validation semantics.
- Modify: `README.md`
  - Record the new WebGoat finding closure and update TODOs.
- Modify: `roadmap.md`
  - Mark the WebGoat controlled-validation slice as completed or advanced.
- Modify: `code_index.md`
  - Index the new MCP runtime, connector, and validation flow.

### Task 1: Define Real HTTP Controlled Validation MCP

**Files:**
- Create: `scripts/mcp/http-validation-runtime.mjs`
- Create: `scripts/mcp/http-validation-server.mjs`
- Modify: `tests/lib/real-http-validation-mcp-connector.test.ts`

- [ ] **Step 1: Write the failing connector/runtime tests**

```ts
it("executes an auditable GET validation request through a real MCP stdio server", async () => {
  // expect status, headers, body preview, and matched evidence signals
})

it("passes docker fallback arguments for WebGoat validation targets", async () => {
  // host unreachable -> container fallback args are forwarded to the MCP tool
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/real-http-validation-mcp-connector.test.ts`
Expected: FAIL because the real controlled-validation MCP server and connector do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
server.registerTool("run_http_validation", { ... }, async (input) => {
  // fetch or docker fallback
  // return requestSummary, responseSummary, matchedSignals, recommendedFinding
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/real-http-validation-mcp-connector.test.ts`
Expected: PASS with real MCP-backed validation output.

- [ ] **Step 5: Commit**

```bash
git add scripts/mcp/http-validation-runtime.mjs scripts/mcp/http-validation-server.mjs lib/mcp-connectors/real-http-validation-mcp-connector.ts tests/lib/real-http-validation-mcp-connector.test.ts
git commit -m "feat: add real http controlled validation mcp"
```

### Task 2: Normalize Real Validation Into Findings

**Files:**
- Modify: `lib/mcp-execution-service.ts`
- Modify: `lib/mcp-connectors/registry.ts`
- Modify: `tests/api/orchestrator-api.test.ts`

- [ ] **Step 1: Write the failing execution/orchestrator tests**

```ts
it("writes a real WebGoat actuator exposure finding after approval resumes", async () => {
  // local validation -> approval -> finding/evidence appear in project context
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/api/orchestrator-api.test.ts`
Expected: FAIL because approved WebGoat validation still falls back to the local `auth-guard-check` behavior.

- [ ] **Step 3: Write minimal implementation**

```ts
if (context.run.toolName === "auth-guard-check") {
  // consume request/response summary from the real MCP connector
  // create a medium-severity finding for anonymous actuator exposure
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/api/orchestrator-api.test.ts`
Expected: PASS with real approval-driven finding generation.

- [ ] **Step 5: Commit**

```bash
git add lib/mcp-execution-service.ts lib/mcp-connectors/registry.ts tests/api/orchestrator-api.test.ts
git commit -m "feat: normalize real controlled validation findings"
```

### Task 3: Wire Live Validation Bootstrapping and Real WebGoat Closure

**Files:**
- Modify: `scripts/lib/live-validation-runner.mjs`
- Modify: `tests/lib/live-validation-runner.test.ts`
- Modify: `docs/contracts/mcp-server-contract.md`

- [ ] **Step 1: Write the failing live-runner tests**

```ts
it("auto-registers the controlled-validation MCP server alongside web and structure discovery", async () => {
  // expect third server registration payload
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/live-validation-runner.test.ts`
Expected: FAIL because the live runner only bootstraps web-surface and http-structure MCP servers.

- [ ] **Step 3: Write minimal implementation**

```ts
function buildHttpValidationRegistrationPayload() { ... }
export async function ensureWebSurfaceMcpRegistration(...) {
  // register web surface, http structure, and http validation contracts
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/live-validation-runner.test.ts`
Expected: PASS with all required MCP registrations present.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/live-validation-runner.mjs tests/lib/live-validation-runner.test.ts docs/contracts/mcp-server-contract.md
git commit -m "feat: bootstrap controlled validation mcp for live runs"
```

### Task 4: Verify and Document the Real Finding Closure

**Files:**
- Modify: `README.md`
- Modify: `roadmap.md`
- Modify: `code_index.md`

- [ ] **Step 1: Run focused verification**

Run: `npm run test -- tests/lib/real-http-validation-mcp-connector.test.ts tests/api/orchestrator-api.test.ts tests/lib/live-validation-runner.test.ts tests/lib/real-web-surface-mcp-connector.test.ts`
Expected: PASS

- [ ] **Step 2: Run full verification**

Run: `npm run lint`
Expected: PASS

Run: `npm run build`
Expected: PASS

Run: `npm run e2e`
Expected: PASS

- [ ] **Step 3: Run real WebGoat live validation**

Run: `npm run live:validate`
Expected: A preserved workspace-mode WebGoat project with real assets, evidence, findings, and report artifacts under `output/live-validation/`.

- [ ] **Step 4: Perform browser confirmation**

Run: `npm run dev` plus Playwright flow against the resulting project.
Expected: Findings visible in UI and report export still works after the new validation path lands.

- [ ] **Step 5: Update docs and commit**

```bash
git add README.md roadmap.md code_index.md output/live-validation output/playwright
git commit -m "docs: record webgoat controlled validation closure"
```
