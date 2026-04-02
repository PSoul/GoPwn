# Development Roadmap

> Last updated: 2026-04-02

---

## Phase Summary

| Phase | Name | Status | Commit |
|-------|------|--------|--------|
| 1-12 | Foundation + Core Features | Done | (various) |
| 13 | Production Hardening | Done | (various) |
| 14 | UI/UX Performance | Done | (various) |
| 15 | (reserved) | -- | -- |
| 16 | Prisma Migration (schema) | Done | (various) |
| 17 | Prisma Migration (data layer) | Done | `1536a1d` |
| 17c | Test suite Prisma adaptation | Done | `fdc05d8` |
| 17d | E2E Prisma adaptation + MCP integration | Done | `1536a1d` |
| 18 | (reserved for future) | -- | -- |
| 19 | Architecture Refactoring | Done | `194c79a` |
| 20 | Continued Refactoring (module splits) | Done | `8a4a0fc` |
| 21 | UI Polish + Debug Fixes | Done | `7d174fb` |
| 22 | Real Pentest Validation | Done | `3b75af3` |
| 22b | Vuln Detection (LLM code passthrough) | Done | `3b75af3` |
| 23 | Anti-Cheating Refactoring | Done | `f850631` |
| 23b | Scheduler Stuck Task Fix | Done | `40a119a` |

---

## Phase 1-12: Foundation + Core Features

Built the core platform from scratch:
- Next.js app with auth, project CRUD, dashboard
- MCP tool framework with 14 local servers
- LLM orchestrator with plan-execute-review loop
- Approval workflow for dangerous operations
- Scheduler with multi-round execution
- Asset, finding, evidence, and network result models
- Settings management (LLM provider, MCP tools, approval policy)

---

## Phase 13: Production Hardening

- Error boundaries and graceful degradation
- Rate limiting on API routes
- CSRF protection
- Input validation with Zod schemas
- Audit logging

---

## Phase 14: UI/UX Performance

- Loading skeletons for all pages
- Confirmation dialogs for destructive actions
- Page transition animations
- Collapsible sections on operations page
- Field-level form validation
- Unified border-radius design tokens

---

## Phase 16-17: Prisma Migration

Migrated from prototype SQLite/in-memory storage to PostgreSQL + Prisma:
- Phase 16: Schema design (25 models)
- Phase 17: Data layer migration (all repositories)
- Phase 17c: Test suite adaptation
- Phase 17d: E2E test adaptation + MCP integration tests

---

## Phase 19: Architecture Refactoring

- Split monolithic type file into per-domain modules (`types/`)
- Eliminated facade pattern, direct repository access
- Decomposed orchestrator into focused modules
- Removed dead code and duplicate imports

---

## Phase 20: Continued Refactoring (Module Splits)

Split 5 large files into 14 sub-modules:
- `api-compositions.ts` -> 4 domain compositions
- `project-results-repository.ts` -> 3 results modules
- `mcp-gateway-repository.ts` -> run CRUD + dispatch service
- `project-repository.ts` -> read + mutation modules
- `project-scheduler-control-repository.ts` -> 3 scheduler modules

---

## Phase 21: UI Polish + Debug Fixes

- Tab restructure: 8 tabs -> 7 tabs (merged redundant views)
- Terminology cleanup across UI
- Fixed 15+ real-usage bugs across 5 debug rounds
- Direct DB queries replacing composition overhead

---

## Phase 22: Real Pentest Validation

- 8 core fixes for MCP/orchestrator/reviewer pipeline
- LLM code passthrough for active vulnerability testing
- Auto-detection of vulnerability patterns in tool output
- Removed fake fallback data generation
- HTTP proxy support for LLM provider via undici ProxyAgent

---

## Phase 23: Anti-Cheating Refactoring -- COMPLETE

**Goal**: Remove all target-specific "cheating" logic so the platform works generically with any target, relying on the LLM's own reasoning rather than hardcoded shortcuts.

### Changes (10 source files, 4 test files)

| File | What Changed |
|------|-------------|
| `lib/mcp-connectors/stdio-mcp-connector.ts` | TCP banner detection now uses protocol patterns (SSH, HTTP, MySQL, etc.) instead of hardcoded port-to-service mappings |
| `lib/orchestrator-local-lab.ts` | Fallback plans are generic (probe HTTP, scan ports) instead of WebGoat-specific sequences |
| `lib/mcp-connectors/local-foundational-connectors.ts` | Smoke test returns minimal real results; no longer fabricates fake assets/findings when tools are unavailable |
| `lib/llm-brain-prompt.ts` | TCP guidance tells LLM to probe and identify services generically instead of listing specific port numbers |
| `lib/execution/artifact-normalizer.ts` | Asset classification uses HTTP response headers (Content-Type, Server, X-Powered-By) instead of URL path matching |
| `lib/mcp-connectors/real-http-validation-mcp-connector.ts` | Validation profile is generic, not tied to any specific application |
| `lib/orchestrator-target-scope.ts` | Extended localhost equivalents list; removed `isWebGoatBaseUrl` helper |
| `lib/orchestrator-context-builder.ts` | Passes raw `execute_code` output directly to LLM for autonomous analysis |
| `lib/orchestrator-execution.ts` | `execute_code` calls targeting the same host run sequentially to prevent race conditions |
| `lib/project-mcp-dispatch-service.ts` | Background completion handler properly resolves timed-out drain operations |

### Acceptance Criteria (all met)

- [x] No source file references WebGoat, DVWA, or any specific target by name
- [x] No hardcoded port-to-service mappings (e.g., "8080 = WebGoat")
- [x] No URL-path-based asset classification (e.g., "/WebGoat" = web app)
- [x] No fabricated scan results when tools are unavailable
- [x] TCP service detection works by banner/protocol analysis
- [x] Asset classification works by HTTP header analysis
- [x] LLM prompt teaches methodology, not specific attack recipes
- [x] All 67 unit tests pass
- [x] Both E2E tests pass

---

## Phase 23b: Scheduler Stuck Task Fix -- COMPLETE

**Goal**: Fix scheduler tasks getting permanently stuck in "running" status, blocking project closure.

### Root Causes Fixed

| # | Problem | Fix | File |
|---|---------|-----|------|
| 1 | Unhandled exceptions between task claim and status update | Added catch block that moves task to "failed" | `lib/mcp-scheduler-service.ts` |
| 2 | "aborted" path cleared lease but didn't set terminal status | Added `status: "cancelled"` | `lib/mcp-scheduler-service.ts` |
| 3 | "ownership_lost" path didn't update task at all | Added `status: "failed"` | `lib/mcp-scheduler-service.ts` |
| 4 | Expired task recovery always reset to "ready" even when MCP run already completed | Now checks MCP run status, marks as "completed" if run finished | `lib/mcp-scheduler-repository.ts` |
| 5 | Multiple approvals triggered concurrent lifecycle kickoffs exceeding maxRounds | Added per-project in-memory mutex | `lib/orchestrator-service.ts` |
| 6 | Operations API poll didn't trigger recovery | Added `recoverExpiredStoredSchedulerTasks` to operations composition | `lib/compositions/project-compositions.ts` |

### Verification

- DVWA integration test: 12/12 tasks completed, 0 stuck, project closure successful
- All 226 unit tests pass (1 pre-existing failure in api-handler.test.ts unrelated)

---

## Future Phases (Planned)

| Phase | Name | Description |
|-------|------|-------------|
| 24 | Multi-target orchestration | Support scanning multiple targets in a single project with parallel execution |
| 25 | Report generation | PDF/HTML report export with executive summary and technical details |
| 26 | Plugin MCP servers | Support for community-contributed MCP servers via plugin architecture |
| 27 | Team collaboration | Multi-user projects with role-based access and shared findings |
