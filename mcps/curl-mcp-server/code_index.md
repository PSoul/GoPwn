# curl-mcp-server Code Index

## Overview
MCP Server for HTTP packet interaction using Node.js native `fetch` and `net.Socket`. No external binaries required.

## Entry Point
- `src/index.ts` — Creates McpServer, registers all tools, starts stdio transport.

## HTTP Client Layer
- `src/http/types.ts` — TypeScript interfaces: `HttpRequestOptions`, `HttpResponse`, `RawRequestOptions`, `RawHttpResponse`.
- `src/http/client.ts` — `sendHttpRequest()` — Uses native `fetch()` with AbortSignal timeout, redirect control, 1MB body truncation.
- `src/http/raw-client.ts` — `sendRawRequest()` — Uses `net.createConnection` / `tls.connect` for raw TCP HTTP packets.

## Tool Registrations
- `src/tools/request.ts` — `registerHttpRequest()` — Registers `http_request` tool (GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS).
- `src/tools/raw-request.ts` — `registerRawRequest()` — Registers `http_raw_request` tool (raw TCP socket).
- `src/tools/batch.ts` — `registerHttpBatch()` — Registers `http_batch` tool (concurrent HTTP requests with pool).

## Tests
- `tests/unit/client.test.ts` — Unit tests for `sendHttpRequest` with mocked `fetch`.
- `tests/unit/raw-client.test.ts` — Unit tests for `sendRawRequest` with real local `net.Server`.
- `tests/e2e/mcp-server.test.ts` — E2E tests using `InMemoryTransport` with mocked client modules.

## Configuration
- `examples/registration.json` — MCP client registration example.
