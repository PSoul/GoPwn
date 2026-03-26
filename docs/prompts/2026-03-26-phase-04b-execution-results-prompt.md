# Phase 04B Prompt: MCP Execution Result Persistence and Real Connector Expansion

You are continuing development of the authorized external security assessment platform in a fresh isolated git branch/worktree.

## Current Baseline

The project already has:

- template-aligned frontend routes and split settings pages
- persisted auth, projects, approvals, audit logs, and approval controls
- persisted MCP registry, capability metadata, health checks, and tool settings
- project-level MCP run records
- project-level MCP dispatch API
- foundational runnable local MCP workflow smoke tests

Current branch/worktree implemented:

- capability-first MCP routing
- approval-linked MCP run state
- local foundational runners for:
  - `seed-normalizer`
  - `dns-census`
  - `web-surface-map`
  - `report-exporter`
- workflow smoke route:
  - baseline low-risk path completes
  - approval path halts correctly at high-risk validation

## Primary Goal

Implement the next slice that turns MCP execution output into persisted platform results:

1. map MCP outputs into persisted assets
2. map evidence-capable outputs into persisted evidence records
3. write workflow execution into work logs
4. let approved MCP runs resume into execution instead of only changing state
5. prepare one or two capability families for real connector replacement

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

## Technical Direction

Prefer this execution model:

- LLM requests capability
- MCP gateway selects tool
- tool returns structured raw output
- platform normalizes output into:
  - assets
  - evidence
  - work logs
  - project activity
- high-risk steps remain approval-gated
- once approved, queued runs can resume rather than only flipping display state

## Deliverables

- real persistence of execution-derived assets/evidence/logs
- at least one approved run that can continue into real execution
- tests covering:
  - output normalization
  - approval-to-execution resume path
  - UI/API regression
- updated docs describing the new contracts

## Reference Files To Read First

- `code_index.md`
- `roadmap.md`
- `docs/superpowers/specs/2026-03-26-llm-pentest-platform-design.md`
- `docs/superpowers/specs/2026-03-26-mcp-gateway-registry-spec.md`
