# curl-mcp-server Roadmap

## Completed (v1.0.0)
- [x] `http_request` tool — custom HTTP requests via native fetch
- [x] `http_raw_request` tool — raw TCP/TLS HTTP packets via net.Socket
- [x] `http_batch` tool — batch HTTP with concurrency control
- [x] Unit tests for client and raw-client
- [x] E2E tests via InMemoryTransport

## Planned
- [ ] Response header filtering (include/exclude patterns)
- [ ] Cookie jar support across batch requests
- [ ] HTTP/2 support for raw requests
- [ ] Request/response logging tool for debugging sessions
- [ ] Proxy support (HTTP/SOCKS5)
- [ ] Client certificate authentication for TLS
- [ ] Response body format detection and structured parsing (JSON, XML, HTML)
- [ ] Rate limiting configuration for batch requests
