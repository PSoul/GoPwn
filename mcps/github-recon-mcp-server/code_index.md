# github-recon-mcp-server — Architecture Overview

## Purpose
MCP Server for GitHub code leak reconnaissance during authorized penetration testing. Provides three tools for searching GitHub's code, repositories, and commits via the GitHub REST API.

## Directory Structure

```
src/
├── index.ts                   # Entry point — registers tools, starts StdioServerTransport
├── github/
│   ├── api-client.ts          # GitHubClient — REST API client with rate limit handling
│   └── types.ts               # GitHub API response type definitions
├── mappers/
│   ├── types.ts               # IntelligenceRecord output type
│   └── intelligence.ts        # Map GitHub responses → IntelligenceRecord
└── tools/
    ├── code-search.ts         # github_code_search tool registration
    ├── repo-search.ts         # github_repo_search tool registration
    └── commit-search.ts       # github_commit_search tool registration

tests/
├── fixtures/                  # Sample GitHub API responses
│   ├── code-search.json
│   ├── repo-search.json
│   └── commit-search.json
├── unit/
│   ├── api-client.test.ts     # GitHubClient unit tests (mocked fetch)
│   └── intelligence-mapper.test.ts  # Mapper function unit tests
└── e2e/
    └── mcp-server.test.ts     # InMemoryTransport integration tests
```

## Key Design Decisions
- **API Client Pattern**: Follows fofa-mcp-server's pattern — constructor reads env vars, methods return typed responses.
- **Rate Limit Handling**: Checks `X-RateLimit-Remaining` header on every response, throws before consuming the response if limit is 0.
- **Authentication**: Optional `GITHUB_TOKEN` env var. Unauthenticated requests have lower rate limits (10 req/min for search).
- **Query Building**: Code search and commit search tools build compound GitHub search queries from structured parameters (org, language, filename, extension, author, repo).
- **Accept Headers**: Code search uses `text-match+json` for text match fragments; commit search uses `cloak-preview+json` as required by GitHub API.

## Tools
| Tool | Description |
|------|-------------|
| `github_code_search` | Search code for leaked credentials/secrets |
| `github_repo_search` | Search repositories for reconnaissance |
| `github_commit_search` | Search commits for sensitive information |

## Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | No | GitHub personal access token (increases rate limits) |
