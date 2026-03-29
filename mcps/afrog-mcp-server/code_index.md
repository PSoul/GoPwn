# afrog-mcp-server Code Index

## Project Overview
MCP Server wrapping the afrog binary for POC-based vulnerability scanning. Exposes 2 tools via the Model Context Protocol.

## Directory Structure

### `src/index.ts`
Entry point. Creates McpServer, registers tools, starts stdio transport.

### `src/afrog/locator.ts`
Locates the afrog binary via `AFROG_PATH` env var or system PATH lookup.

### `src/afrog/runner.ts`
- `runAfrog(options)` — Executes afrog with `-json -o {tmpfile}`, reads and parses JSONL output into `AfrogResult[]`.
- `runAfrogStdout(options)` — Executes afrog and returns raw stdout (used by `afrog_list_pocs`).

### `src/parsers/json-parser.ts`
- `parseAfrogOutput(raw)` — Parses JSON array or JSONL string into `AfrogResult[]`.

### `src/mappers/types.ts`
Type definitions: `AfrogResult`, `Finding`, `PocEntry`.

### `src/mappers/findings.ts`
- `mapToFindings(results)` — Maps `AfrogResult[]` to `Finding[]`. Extracts port from URL, normalizes severity.

### `src/tools/scan.ts`
Registers `afrog_scan` tool. Params: target, severity, pocId, pocKeyword, timeout, rateLimit.

### `src/tools/list-pocs.ts`
Registers `afrog_list_pocs` tool. Parses stdout lines into `PocEntry[]`. Params: keyword, severity.

### `tests/`
- `unit/locator.test.ts` — Tests binary location logic.
- `unit/json-parser.test.ts` — Tests JSON/JSONL parsing.
- `unit/mappers.test.ts` — Tests AfrogResult to Finding mapping.
- `e2e/mcp-server.test.ts` — Full MCP client/server integration tests with mocked runner.

### `examples/registration.json`
Sample MCP client configuration for registering this server.
