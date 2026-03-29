# wafw00f-mcp-server Architecture

## Overview
MCP Server wrapping the wafw00f binary for Web Application Firewall (WAF) detection during authorized penetration testing.

## Directory Structure
```
src/
  index.ts              - Entry point, registers tools, starts StdioServerTransport
  wafw00f/
    locator.ts          - Finds wafw00f binary via WAFW00F_PATH env or PATH lookup
    runner.ts           - Executes wafw00f with temp file output (JSON) or stdout capture
  parsers/
    json-parser.ts      - Parses wafw00f JSON output into Wafw00fResult[]
  mappers/
    types.ts            - Wafw00fResult, Finding interfaces
    findings.ts         - Maps Wafw00fResult[] to Finding[]
  tools/
    detect.ts           - wafw00f_detect tool: detect WAFs on a target URL
    list.ts             - wafw00f_list tool: list all detectable WAFs

tests/
  fixtures/             - JSON/text fixtures for unit tests
  unit/                 - Unit tests for locator, parser, mappers
  e2e/                  - InMemoryTransport MCP server integration tests
```

## Tools
| Tool | Description |
|------|-------------|
| `wafw00f_detect` | Detect WAFs protecting a target URL |
| `wafw00f_list` | List all WAFs wafw00f can detect |

## Binary Wrapper Pattern
Follows the same pattern as afrog-mcp-server: locate binary, execute with args, parse output, map to findings.
