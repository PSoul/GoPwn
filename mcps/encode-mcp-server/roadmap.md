# encode-mcp-server Roadmap

## Phase 1 - Core Implementation (Complete)
- [x] Encoding/decoding: base64, base64url, url, hex, html, unicode, utf8
- [x] Hash computation: md5, sha1, sha256, sha512, sha3-256, sha3-512
- [x] HMAC support with configurable output formats
- [x] AES-256-CBC and AES-256-GCM encrypt/decrypt
- [x] JWT decode (header + payload, no verification)
- [x] Random string generation with charset options
- [x] UUID v4 generation
- [x] MCP tool registration with Zod validation
- [x] Unit tests for all codec modules
- [x] E2E integration tests via InMemoryTransport
