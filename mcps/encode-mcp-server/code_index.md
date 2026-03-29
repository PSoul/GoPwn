# encode-mcp-server Architecture

## Overview
MCP Server providing encoding/decoding, hashing, and cryptographic utility tools for authorized penetration testing.

## Project Structure
```
encode-mcp-server/
├── src/
│   ├── index.ts              # Server entry point, registers 3 tools
│   ├── codec/
│   │   ├── encoder.ts        # Encoding/decoding: base64, base64url, url, hex, html, unicode, utf8
│   │   ├── hasher.ts         # Hash computation: md5, sha1, sha256, sha512, sha3-256, sha3-512
│   │   └── crypto.ts         # AES encrypt/decrypt, random string, JWT decode, UUID generate
│   └── tools/
│       ├── encode-decode.ts   # encode_decode tool registration
│       ├── hash-compute.ts    # hash_compute tool registration
│       └── crypto-util.ts     # crypto_util tool registration
├── tests/
│   ├── unit/
│   │   ├── encoder.test.ts    # Encoder round-trip tests for all 7 algorithms
│   │   ├── hasher.test.ts     # Hash algorithm and HMAC tests
│   │   └── crypto.test.ts     # AES, JWT, random string, UUID tests
│   └── e2e/
│       └── mcp-server.test.ts # InMemoryTransport integration tests
```

## Tools
| Tool | Description |
|------|-------------|
| `encode_decode` | Encode/decode strings with base64, URL, hex, HTML, unicode, utf8 |
| `hash_compute` | Compute MD5, SHA-1/256/512, SHA3-256/512 hashes with optional HMAC |
| `crypto_util` | AES-CBC/GCM encrypt/decrypt, random strings, JWT decode, UUID generation |

## Dependencies
- `@modelcontextprotocol/sdk` — MCP protocol SDK
- `zod` — Input validation
- Node.js `crypto` — All cryptographic operations
