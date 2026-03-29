# subfinder-mcp-server Roadmap

## Completed
- [x] Binary locator with SUBFINDER_PATH env and PATH fallback
- [x] Runner with temp file I/O and JSONL parsing
- [x] `subfinder_enum` tool: passive subdomain enumeration with sources, recursive, timeout
- [x] `subfinder_verify` tool: enumerate + DNS resolve with custom resolvers
- [x] Domain mapper with host-based deduplication
- [x] Unit tests for locator, parser, mapper
- [x] E2E tests via in-memory MCP transport

## Planned
- [ ] Add `subfinder_sources` tool to list available enumeration sources
- [ ] Support `-all` flag to use all available sources
- [ ] Add rate limiting options (`-rate-limit`, `-t` threads)
- [ ] Support `-exclude-sources` for blacklisting specific sources
- [ ] Output enrichment: add resolved IP addresses when available
- [ ] Support provider configuration via `-pc` (provider config file)
- [ ] Add progress streaming for long-running enumerations
