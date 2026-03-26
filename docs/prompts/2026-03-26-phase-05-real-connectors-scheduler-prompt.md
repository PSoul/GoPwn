# Phase 05 Prompt: Real MCP Connectors and Scheduler Loop

You are continuing development of the authorized external security assessment platform in a fresh isolated git branch/worktree.

## Current Baseline

The project already has:

- template-aligned frontend routes and split settings pages
- persisted auth, projects, approvals, audit logs, and approval controls
- persisted MCP registry, capability metadata, health checks, and boundary rules
- project-level MCP dispatch records and approval-linked run states
- local foundational MCP workflow smoke tests
- persisted execution-result normalization into:
  - assets
  - evidence
  - work logs
  - findings
- approval-approved runs now resume into execution and refresh project result state

## Primary Goal

Implement the next slice that moves the platform from local foundational MCP simulators toward real connector replacement and safer queued execution:

1. introduce a connector abstraction that can serve either local mocks or real MCP-backed tools
2. add an explicit scheduler/task loop for queued runs, delayed runs, retries, and approval resumes
3. land at least one real connector family end-to-end, recommended:
   - `DNS / 子域 / 证书情报类`
4. keep the current UI contracts stable while connector internals evolve

## Hard Constraints

- create a new isolated branch/worktree before editing
- do not modify the user’s current branch directly
- keep visual language aligned to the provided backend/login templates
- update `code_index.md`
- update `roadmap.md`
- keep `*.txt` ignored in git
- run full verification:
  - `npm run test`
  - `npm run lint`
  - `npm run build`
  - `npm run e2e`
  - `npm run test:all`
- use Context7 and official/primary docs where appropriate
- never hardcode live credentials or write them into source, logs, or docs

## Technical Direction

Prefer this execution model:

- LLM requests capability
- scheduler decides whether the run is ready, delayed, blocked, retried, or approval-gated
- MCP gateway selects connector implementation for the capability
- connector returns raw output plus structured content
- platform normalizes output into:
  - assets
  - evidence
  - work logs
  - findings
- approval-gated work can be resumed by the scheduler, not only by ad hoc route flow

## Deliverables

- connector abstraction with local and real implementations
- at least one real capability family wired through the abstraction
- persisted scheduler/task state for queued/resumed work
- tests covering:
  - scheduler transitions
  - connector selection
  - real-connector happy path
  - regression of current asset/evidence/work-log flows
- updated docs describing connector contracts and scheduler behavior

## Reference Files To Read First

- `code_index.md`
- `roadmap.md`
- `docs/superpowers/specs/2026-03-26-llm-pentest-platform-design.md`
- `docs/superpowers/specs/2026-03-26-mcp-gateway-registry-spec.md`
- `docs/prompts/2026-03-26-phase-04b-execution-results-prompt.md`
- `docs/superpowers/plans/2026-03-26-execution-results-core-implementation.md`
