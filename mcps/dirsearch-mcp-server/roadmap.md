# dirsearch-mcp-server Roadmap

## v1.0.0 (Current)
- [x] Binary locator with DIRSEARCH_PATH env var and PATH fallback
- [x] JSON output parser for dirsearch format
- [x] Web entry mapper (status, url, content-length, redirect)
- [x] `dirsearch_scan` tool with wordlist, extensions, threads, excludeStatus, timeout
- [x] `dirsearch_recursive` tool with depth, wordlist, extensions, timeout
- [x] Unit tests for locator, parser, mappers
- [x] E2E tests with in-memory MCP transport

## v1.1.0 (Planned)
- [ ] Support for custom headers (`--header`)
- [ ] Support for authentication (`--auth`)
- [ ] Support for proxy configuration (`--proxy`)
- [ ] Support for custom user-agent (`--user-agent`)
- [ ] Streaming progress updates via MCP notifications

## v1.2.0 (Future)
- [ ] Multiple URL scanning in single invocation
- [ ] Result filtering by content-length ranges
- [ ] Integration with other MCP servers for chained scanning
