# Phase 07 Prompt: Production Backend Integration and Real MCP Expansion

You are continuing development of the authorized external security assessment platform after Phase 6 landed:

- a configurable OpenAI-compatible LLM provider abstraction
- orchestrator APIs and UI on the project operations page
- persisted last-plan state per project
- local Docker validation assets for OWASP Juice Shop and WebGoat
- MCP onboarding docs and connector templates
- API + browser automation for the orchestrator/local-validation path

## Read These First

- `code_index.md`
- `roadmap.md`
- `docs/superpowers/specs/2026-03-26-llm-pentest-platform-design.md`
- `docs/superpowers/specs/2026-03-26-mcp-gateway-registry-spec.md`
- `docs/operations/mcp-onboarding-guide.md`
- `docs/operations/local-docker-labs.md`
- `docs/superpowers/plans/2026-03-26-llm-orchestrator-docker-validation-implementation.md`

## Primary Goal

Move the platform from a strong prototype backend toward a more production-like architecture while preserving the current UX and LLM/MCP boundary model.

## Core Outcomes

1. harden persistence beyond the current file-backed prototype store
2. introduce a real MCP server/client attachment model instead of only in-process connector stubs
3. expand at least one more real capability family beyond DNS
4. keep the local Docker lab stack usable as a regression harness
5. preserve approvals, auditability, evidence persistence, and result-first project views

## Hard Constraints

- create a fresh isolated `codex/` branch/worktree before editing
- do not modify the user’s current branch directly
- never hardcode live credentials or write them into source, logs, or docs
- keep `*.txt` ignored in git
- update `code_index.md`
- update `roadmap.md`
- use Context7 and official / primary docs
- run full verification:
  - `npm run test`
  - `npm run lint`
  - `npm run build`
  - `npm run e2e`
  - `npm run test:all`

## Recommended Technical Direction

### 1. Persistence Hardening

- replace or augment `.prototype-store` with a database-backed layer
- keep repository boundaries stable so UI contracts do not thrash
- preserve seed/bootstrap ergonomics for local development

### 2. Real MCP Attachment

- define a registry model for external MCP servers or adapters
- separate:
  - tool metadata
  - server connection config
  - invocation contract
  - result normalization
- keep the rule explicit:
  - `LLM = brain`
  - `MCP = limbs`

### 3. Next Real Capability Family

Pick one high-value family and land it end-to-end:

- `Web 页面探测类`
- `HTTP / API 结构发现类`
- `截图与证据采集类`

The chosen family should:

- run through the real MCP/server path
- respect approval/risk defaults
- persist assets/evidence/findings where appropriate

### 4. Local Regression Harness

- keep `docker/local-labs/compose.yaml` compatible
- add optional test hooks or scripts so local labs can be used for controlled regression
- do not require Docker to be running for the default CI/unit path unless clearly gated

## Deliverables

- database-backed or otherwise hardened persistence slice
- real MCP server/client integration scaffold
- one additional real capability family beyond DNS
- updated docs for operations and onboarding
- updated `code_index.md` and `roadmap.md`
- green full verification

## Notes

- avoid large UI redesigns unless required by backend integration
- prefer preserving the existing route structure and operations-page mental model
- keep results-first project detail behavior intact while making backend/runtime stronger
