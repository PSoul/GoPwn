# fofa-mcp-server Code Index

## Entry Point
- `src/index.ts` — MCP server bootstrap, registers all 3 tools, connects stdio transport

## API Client
- `src/fofa/api-client.ts` — `FofaClient` class wrapping FOFA REST API with native `fetch`. Methods: `search()`, `host()`, `stats()`. Reads `FOFA_EMAIL` and `FOFA_KEY` from env.

## Mappers
- `src/mappers/types.ts` — TypeScript interfaces: `FofaSearchResponse`, `FofaHostResponse`, `IntelligenceRecord`
- `src/mappers/intelligence.ts` — Functions to convert raw FOFA responses into `IntelligenceRecord`: `mapSearchToIntelligence()`, `mapHostToIntelligence()`, `mapStatsToIntelligence()`

## Tools
- `src/tools/search.ts` — `fofa_search` tool: asset search with FOFA query syntax
- `src/tools/host.ts` — `fofa_host` tool: host detail lookup by IP or domain
- `src/tools/stats.ts` — `fofa_stats` tool: aggregated statistics for a query

## Tests
- `tests/unit/api-client.test.ts` — Unit tests for FofaClient (mocked fetch)
- `tests/unit/mappers.test.ts` — Unit tests for intelligence mappers
- `tests/e2e/mcp-server.test.ts` — E2E tests using InMemoryTransport MCP client
- `tests/fixtures/` — JSON fixtures for search and host responses

## Config
- `examples/registration.json` — MCP client registration example
