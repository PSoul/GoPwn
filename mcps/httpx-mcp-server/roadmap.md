# httpx-mcp-server Roadmap

## v1.0.0 (Current)
- [x] `httpx_probe` — web alive detection with ports, threads, timeout
- [x] `httpx_tech_detect` — technology stack detection
- [x] stdin-based target piping
- [x] JSON/JSONL output parsing
- [x] Unit and E2E test suite

## v1.1.0 (Planned)
- [ ] `httpx_screenshot` tool — capture web page screenshots via `-screenshot`
- [ ] `httpx_cdn_detect` tool — CDN/WAF detection via `-cdn`
- [ ] Custom headers support (`-H` flag)
- [ ] HTTP method selection (`-x` flag)
- [ ] Follow redirects control (`-follow-redirects`, `-max-redirects`)

## v1.2.0 (Future)
- [ ] Rate limiting options (`-rate-limit`, `-delay`)
- [ ] Proxy support (`-proxy`, `-http-proxy`)
- [ ] Custom resolver (`-resolver`)
- [ ] Response body hash output (`-hash`)
- [ ] Filter by status code, content length, or title
- [ ] Output format options (CSV export)

## v2.0.0 (Future)
- [ ] Streaming results via MCP resource subscriptions
- [ ] Integration with nuclei-mcp-server for chained scanning workflows
- [ ] Persistent scan history and diff comparisons
