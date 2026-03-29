# netcat-mcp-server Roadmap

## Completed (v1.0.0)
- [x] TCP connect tool with send/receive, encoding support, and timing metrics
- [x] UDP send tool with timeout handling and encoding support
- [x] TCP banner grab tool for passive service identification
- [x] Unit tests with real localhost echo servers
- [x] E2E tests with MCP InMemoryTransport and mocked clients

## Planned
- [ ] IPv6 support (udp6 socket option, IPv6 addresses)
- [ ] TLS/SSL connect tool (`tls_connect`) for encrypted connections
- [ ] Port scan tool — connect-scan a range of ports
- [ ] Raw packet mode for custom protocol testing
- [ ] Proxy support (SOCKS5, HTTP CONNECT)
- [ ] Connection pooling for repeated requests to same host
- [ ] Response pattern matching (wait until regex match in stream)
- [ ] Multi-packet conversation support (send/receive sequences)
