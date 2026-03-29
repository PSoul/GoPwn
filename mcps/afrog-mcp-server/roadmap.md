# afrog-mcp-server Roadmap

## Completed
- [x] Binary locator (AFROG_PATH env var + PATH fallback)
- [x] Runner with temp file JSON output and stdout capture
- [x] JSONL/JSON parser
- [x] AfrogResult to Finding mapper with severity normalization and port extraction
- [x] `afrog_scan` tool — POC vulnerability scanning with severity/pocId/keyword/rate filters
- [x] `afrog_list_pocs` tool — list available POCs by parsing stdout
- [x] Unit tests (locator, parser, mappers)
- [x] E2E integration tests with mocked runner
- [x] Example registration config

## Future
- [ ] Add `afrog_update` tool to update afrog POC database
- [ ] Support custom POC directories via `--poc-file` flag
- [ ] Add progress reporting for long-running scans
- [ ] Add proxy support (`-proxy` flag)
- [ ] Add webhook/callback notification support
- [ ] Structured error types for common failure modes
