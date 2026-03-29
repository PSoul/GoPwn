# subfinder-mcp-server Code Index

## Entry Point
- `src/index.ts` — MCP server bootstrap, registers tools, starts stdio transport

## Binary Integration
- `src/subfinder/locator.ts` — Locates subfinder binary via `SUBFINDER_PATH` env or system PATH
- `src/subfinder/runner.ts` — Executes subfinder with temp file output, parses results

## Parsers
- `src/parsers/json-parser.ts` — Parses subfinder JSONL/JSON output into `SubfinderResult[]`

## Mappers
- `src/mappers/types.ts` — Type definitions: `SubfinderResult`, `DomainRecord`
- `src/mappers/domains.ts` — Deduplicates by host, maps `SubfinderResult` to `DomainRecord`

## Tools
- `src/tools/enum.ts` — `subfinder_enum`: passive subdomain enumeration
- `src/tools/verify.ts` — `subfinder_verify`: enumerate + DNS resolve (no wildcard)

## Tests
- `tests/unit/locator.test.ts` — Unit tests for binary locator
- `tests/unit/json-parser.test.ts` — Unit tests for JSON/JSONL parser
- `tests/unit/mappers.test.ts` — Unit tests for domain mapper (incl. dedup)
- `tests/e2e/mcp-server.test.ts` — E2E tests via in-memory MCP transport
- `tests/fixtures/enum-result.json` — Test fixture with sample subfinder output

## Configuration
- `examples/registration.json` — MCP registration manifest
