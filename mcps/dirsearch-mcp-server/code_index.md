# dirsearch-mcp-server Code Index

## Source Files

### src/index.ts
MCP server entry point. Creates the server, registers tools, and starts stdio transport.

### src/dirsearch/locator.ts
Locates the dirsearch binary via `DIRSEARCH_PATH` env var or system PATH lookup.

### src/dirsearch/runner.ts
Executes dirsearch with given arguments, writes output to a temp JSON file, reads and parses results.

### src/parsers/json-parser.ts
Parses dirsearch JSON output (`{"results": [...]}` format) into `DirsearchResult[]`.

### src/mappers/types.ts
TypeScript interfaces: `DirsearchOutput`, `DirsearchResult`, `WebEntryRecord`.

### src/mappers/web-entries.ts
Maps raw `DirsearchResult[]` to `WebEntryRecord[]` (url, statusCode, contentLength, redirectUrl).

### src/tools/scan.ts
Registers `dirsearch_scan` tool for basic directory/file scanning.

### src/tools/recursive.ts
Registers `dirsearch_recursive` tool for recursive directory scanning with depth control.

## Test Files

### tests/unit/locator.test.ts
Unit tests for binary locator (env var, PATH fallback, error handling).

### tests/unit/json-parser.test.ts
Unit tests for JSON parser (results object, array fallback, empty, invalid).

### tests/unit/mappers.test.ts
Unit tests for web entry mapper (field mapping, redirect handling, empty input).

### tests/e2e/mcp-server.test.ts
E2E tests using in-memory MCP transport (tool listing, scan results, argument passing).

### tests/fixtures/scan-result.json
Sample dirsearch JSON output with 3 results for testing.
