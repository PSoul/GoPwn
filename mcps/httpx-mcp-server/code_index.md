# httpx-mcp-server Code Index

## Source Files

| File | Purpose |
|------|---------|
| `src/index.ts` | MCP server entry point — registers tools and starts stdio transport |
| `src/httpx/locator.ts` | Locates the httpx binary via `HTTPX_PATH` env or system PATH |
| `src/httpx/runner.ts` | Spawns httpx process, pipes targets to stdin, reads JSON output from temp file |
| `src/parsers/json-parser.ts` | Parses httpx JSON/JSONL output into `HttpxResult[]` |
| `src/mappers/types.ts` | Type definitions: `HttpxResult` (raw) and `WebEntryRecord` (mapped) |
| `src/mappers/web-entries.ts` | Maps `HttpxResult[]` to `WebEntryRecord[]` with field renaming and defaults |
| `src/tools/probe.ts` | `httpx_probe` tool — web alive detection with port/thread/timeout options |
| `src/tools/tech-detect.ts` | `httpx_tech_detect` tool — technology stack detection via `-tech-detect` flag |

## Test Files

| File | Purpose |
|------|---------|
| `tests/unit/locator.test.ts` | Unit tests for binary locator (env, PATH, not-found) |
| `tests/unit/json-parser.test.ts` | Unit tests for JSON/JSONL parsing |
| `tests/unit/mappers.test.ts` | Unit tests for HttpxResult → WebEntryRecord mapping |
| `tests/e2e/mcp-server.test.ts` | End-to-end tests using in-memory MCP transport with mocked runner |
| `tests/fixtures/probe-result.json` | Fixture data simulating httpx JSON output |

## Key Design Decisions

- **stdin-based input**: Unlike fscan which takes targets as CLI args, httpx reads targets from stdin (one per line). The runner writes to `child.stdin` then closes it.
- **Temp file output**: httpx writes results to a `-o` temp file rather than stdout, avoiding conflicts with the MCP stdio transport.
- **JSONL parsing**: Supports both JSON array and JSONL (one object per line) formats since httpx outputs JSONL by default with `-json`.
