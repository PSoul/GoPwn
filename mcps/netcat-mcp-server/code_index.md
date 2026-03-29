# netcat-mcp-server Code Index

## Overview
MCP Server for TCP/UDP packet interaction using Node.js native `net` and `dgram` modules. Provides three tools for network probing without requiring external binaries.

## Directory Structure

### src/
- **index.ts** — MCP server entry point; registers all three tools and starts stdio transport
- **net/types.ts** — TypeScript interfaces for all options and response types (TcpConnectOptions, TcpResponse, UdpSendOptions, UdpResponse, BannerGrabOptions, BannerGrabResponse)
- **net/tcp-client.ts** — `tcpConnect()` and `tcpBannerGrab()` functions using Node.js `net` module
- **net/udp-client.ts** — `udpSend()` function using Node.js `dgram` module
- **tools/tcp-connect.ts** — `registerTcpConnect()` — registers `tcp_connect` MCP tool
- **tools/udp-send.ts** — `registerUdpSend()` — registers `udp_send` MCP tool
- **tools/banner-grab.ts** — `registerBannerGrab()` — registers `tcp_banner_grab` MCP tool

### tests/
- **unit/tcp-client.test.ts** — Unit tests for TCP client using real echo/banner servers on localhost
- **unit/udp-client.test.ts** — Unit tests for UDP client using real echo server on localhost
- **e2e/mcp-server.test.ts** — E2E tests using InMemoryTransport with mocked net clients

### Config
- **package.json** — Project metadata and dependencies
- **tsconfig.json** — TypeScript compiler configuration (ES2022, NodeNext)
- **vitest.config.ts** — Vitest test runner configuration
- **examples/registration.json** — Example MCP client configuration
