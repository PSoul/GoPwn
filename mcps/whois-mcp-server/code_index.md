# whois-mcp-server Architecture

## Overview
MCP Server providing WHOIS domain/IP lookup and ICP filing query capabilities for authorized penetration testing.

## Directory Structure
```
src/
  index.ts              — Entry point, registers tools and starts StdioServerTransport
  whois/
    servers.ts          — TLD → WHOIS server mapping table
    client.ts           — TCP WHOIS client using net.Socket (port 43)
    parser.ts           — Regex-based parser for domain and IP WHOIS responses
  icp/
    api-client.ts       — HTTP client for ICP filing queries (primary + backup API)
  mappers/
    types.ts            — TypeScript interfaces for all data types
  tools/
    whois-query.ts      — whois_query tool registration
    whois-ip.ts         — whois_ip tool registration
    icp-query.ts        — icp_query tool registration
tests/
  fixtures/             — Sample WHOIS and ICP responses
  unit/                 — Unit tests for client, parser, and ICP modules
  e2e/                  — InMemoryTransport integration tests
```

## Tools
| Tool | Description |
|------|-------------|
| `whois_query` | Query WHOIS for a domain name |
| `whois_ip` | Query WHOIS for an IP address |
| `icp_query` | Query ICP filing information |

## Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `ICP_API_URL` | No | Custom ICP API endpoint (defaults to vvhan.com) |
