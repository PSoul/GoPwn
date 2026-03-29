# github-recon-mcp-server — Roadmap

## Phase 1 — Core Implementation (Complete)
- [x] GitHub REST API client with rate limit handling
- [x] Code search tool (github_code_search)
- [x] Repository search tool (github_repo_search)
- [x] Commit search tool (github_commit_search)
- [x] Intelligence record mappers
- [x] Unit tests for API client and mappers
- [x] E2E tests with InMemoryTransport

## Phase 2 — Enhancements (Planned)
- [ ] Pagination helper for iterating through all results
- [ ] Gist search support
- [ ] File content retrieval for matched code results
- [ ] Organization member enumeration
- [ ] Repository secret scanning alerts (requires GitHub Advanced Security)
- [ ] Caching layer to reduce API calls
- [ ] Result deduplication across searches
