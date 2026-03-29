# whois-mcp-server Roadmap

## Phase 1 — Core Implementation [COMPLETE]
- [x] WHOIS domain query via TCP (port 43)
- [x] WHOIS IP query via ARIN
- [x] ICP filing query via HTTP API
- [x] TLD-based WHOIS server routing
- [x] Response parsing (domain + IP)
- [x] MCP tool registration (3 tools)
- [x] Unit and E2E tests
- [x] Timeout and error handling

## Phase 2 — Enhancements (Planned)
- [ ] RDAP (Registration Data Access Protocol) support
- [ ] Recursive WHOIS follow (refer server chains)
- [ ] Bulk domain/IP query support
- [ ] Result caching with TTL
- [ ] Additional TLD server mappings
