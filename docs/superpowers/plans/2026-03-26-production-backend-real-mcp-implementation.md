# Production Backend Real MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first Phase 7 backend-hardening slice by introducing a SQLite-backed MCP server registry and a real stdio MCP server/client execution path for the `Web 页面探测类` capability.

**Architecture:** Keep the existing JSON-backed prototype entities stable for now, but augment the platform with a SQLite persistence layer dedicated to external MCP server metadata and invocation logs. Route `web-surface-map` through a real MCP stdio server spawned as a subprocess via the official TypeScript SDK, while preserving the current scheduler, approval, and result-normalization contracts.

**Tech Stack:** Next.js 15, TypeScript, Vitest, Playwright, Node.js `node:sqlite`, `@modelcontextprotocol/sdk`, existing prototype repositories/connectors.

---

## File Map

- Create: `lib/mcp-server-sqlite.ts`
  - Own SQLite bootstrap, schema creation, and low-level query helpers for MCP server records and invocation logs.
- Create: `lib/mcp-server-repository.ts`
  - Expose high-level CRUD/read helpers for MCP server metadata and invocation logs.
- Create: `lib/mcp-client-service.ts`
  - Spawn and manage an MCP stdio client connection, list/call tools, and normalize timeout/error behavior.
- Create: `lib/mcp-connectors/real-web-surface-mcp-connector.ts`
  - Real connector for `web-surface-map`, backed by the MCP client service and server registry.
- Create: `scripts/mcp/web-surface-server.mjs`
  - Local stdio MCP server exposing one safe read-only web-surface tool.
- Modify: `lib/mcp-connectors/registry.ts`
  - Prefer the real web-surface connector before local fallback when the registry reports an enabled server.
- Modify: `lib/prototype-types.ts`
  - Add MCP server and invocation-log domain types plus settings payload extensions if needed.
- Modify: `lib/prototype-data.ts`
  - Seed MCP settings copy/fields for the new registry surface if UI needs new descriptive blocks.
- Modify: `lib/prototype-api.ts`
  - Expose MCP server payloads for settings.
- Modify: `app/api/settings/mcp-tools/route.ts`
  - Return the server registry together with tool data or call into a new payload helper.
- Modify: `components/settings/mcp-gateway-client.tsx`
  - Render a compact MCP server registry section beneath the existing tool controls.
- Modify: `code_index.md`
  - Document the new persistence/real-MCP files and behavior.
- Modify: `roadmap.md`
  - Record the incremental Phase 7 slice and remaining work.
- Test: `tests/lib/mcp-server-repository.test.ts`
  - Verify SQLite bootstrap, seeded server reads, and invocation-log persistence.
- Test: `tests/lib/real-web-surface-mcp-connector.test.ts`
  - Verify the real connector can call the stdio MCP server and produce normalized `webEntries`.
- Test: `tests/api/mcp-tools-api.test.ts`
  - Verify settings MCP payload now includes server registry data.
- Test: `tests/settings/mcp-gateway-client.test.tsx`
  - Verify the MCP settings page renders the connected server registry block.

### Task 1: Write The Plan-Validation Tests

**Files:**
- Create: `tests/lib/mcp-server-repository.test.ts`
- Create: `tests/lib/real-web-surface-mcp-connector.test.ts`
- Modify: `tests/api/mcp-tools-api.test.ts`
- Modify: `tests/settings/mcp-gateway-client.test.tsx`

- [ ] **Step 1: Write the failing SQLite registry tests**

Add tests that expect:
- a seeded MCP server registry record for the real web-surface stdio server
- the ability to persist and read invocation logs from SQLite

- [ ] **Step 2: Run the SQLite registry tests to verify they fail**

Run: `npm run test -- tests/lib/mcp-server-repository.test.ts`
Expected: FAIL because the SQLite-backed registry layer does not exist yet.

- [ ] **Step 3: Write the failing real-web-surface connector test**

Add a focused test that expects a `web-surface-map` run to execute through a real MCP stdio server and return structured `webEntries`.

- [ ] **Step 4: Run the connector test to verify it fails**

Run: `npm run test -- tests/lib/real-web-surface-mcp-connector.test.ts`
Expected: FAIL because the client service, stdio server, and real connector do not exist yet.

- [ ] **Step 5: Extend the settings tests first**

Update existing settings API/UI tests so they expect server-registry data to be present.

- [ ] **Step 6: Run those tests to verify they fail**

Run: `npm run test -- tests/api/mcp-tools-api.test.ts tests/settings/mcp-gateway-client.test.tsx`
Expected: FAIL because the settings payload does not yet include server registry data.

### Task 2: Implement The SQLite MCP Server Registry

**Files:**
- Create: `lib/mcp-server-sqlite.ts`
- Create: `lib/mcp-server-repository.ts`
- Modify: `lib/prototype-types.ts`

- [ ] **Step 1: Implement SQLite bootstrap and schema creation**

Use `node:sqlite` `DatabaseSync` against a file inside `.prototype-store`, with tables for:
- `mcp_servers`
- `mcp_server_invocations`

- [ ] **Step 2: Seed one enabled stdio MCP server**

Seed a server record for the local `web-surface-map` stdio server with command, args, transport, enabled state, and note fields.

- [ ] **Step 3: Add repository helpers**

Expose functions for:
- listing server records
- finding one server by id or tool binding
- appending invocation logs
- listing recent invocation logs

- [ ] **Step 4: Run the registry tests**

Run: `npm run test -- tests/lib/mcp-server-repository.test.ts`
Expected: PASS

### Task 3: Implement The Real MCP Stdio Execution Path

**Files:**
- Create: `scripts/mcp/web-surface-server.mjs`
- Create: `lib/mcp-client-service.ts`
- Create: `lib/mcp-connectors/real-web-surface-mcp-connector.ts`
- Modify: `lib/mcp-connectors/registry.ts`

- [ ] **Step 1: Add the official MCP SDK dependency**

Install the TypeScript SDK package and keep usage limited to the new stdio server/client slice.

- [ ] **Step 2: Implement the stdio MCP server**

Expose one safe tool that:
- accepts a target URL
- fetches the page with a timeout
- extracts status code, selected headers, final URL, and HTML title
- returns structured content shaped for the existing normalization layer

- [ ] **Step 3: Implement the stdio client helper**

Create a helper that:
- spawns the configured server
- connects with `StdioClientTransport`
- calls the server tool
- closes the client cleanly
- writes invocation logs to SQLite

- [ ] **Step 4: Implement the real connector**

Route `web-surface-map` to the stdio client helper when the server registry reports an enabled bound server. Keep local fallback behavior via connector ordering.

- [ ] **Step 5: Run the connector tests**

Run: `npm run test -- tests/lib/real-web-surface-mcp-connector.test.ts`
Expected: PASS

### Task 4: Surface MCP Server Registry In Settings

**Files:**
- Modify: `lib/prototype-api.ts`
- Modify: `app/api/settings/mcp-tools/route.ts`
- Modify: `components/settings/mcp-gateway-client.tsx`
- Modify: `tests/api/mcp-tools-api.test.ts`
- Modify: `tests/settings/mcp-gateway-client.test.tsx`

- [ ] **Step 1: Extend settings payloads**

Include server registry and recent invocation data in the MCP settings response.

- [ ] **Step 2: Render a compact server registry panel**

Show:
- server name
- transport
- command or endpoint
- enabled/disabled state
- last invocation result if present

- [ ] **Step 3: Run the settings tests**

Run: `npm run test -- tests/api/mcp-tools-api.test.ts tests/settings/mcp-gateway-client.test.tsx`
Expected: PASS

### Task 5: Update Docs And Verify End-To-End

**Files:**
- Modify: `code_index.md`
- Modify: `roadmap.md`

- [ ] **Step 1: Update project docs**

Document:
- the SQLite registry layer
- the real MCP stdio server/client scaffold
- the new real web-surface capability path
- the remaining Phase 7 gaps

- [ ] **Step 2: Run focused regression**

Run:
- `npm run test -- tests/lib/mcp-server-repository.test.ts`
- `npm run test -- tests/lib/real-web-surface-mcp-connector.test.ts`
- `npm run test -- tests/api/mcp-tools-api.test.ts`
- `npm run test -- tests/settings/mcp-gateway-client.test.tsx`

Expected: PASS

- [ ] **Step 3: Run full verification**

Run:
- `npm run test`
- `npm run lint`
- `npm run build`
- `npm run e2e`
- `npm run test:all`

Expected: all green.
