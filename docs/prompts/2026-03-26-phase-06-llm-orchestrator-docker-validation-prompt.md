# Phase 06 Prompt: Real LLM Orchestrator and Local Docker Validation

You are continuing development of the authorized external security assessment platform after Phase 5 landed the connector registry, persisted scheduler tasks, approval-resume flow, and the first real DNS / certificate intelligence connector family.

## Baseline You Must Assume

The current branch/worktree already contains:

- persisted auth, projects, approvals, audit logs, assets, evidence, work logs, findings, MCP runs, and scheduler tasks
- connector abstraction with local foundational connectors plus one real DNS connector
- scheduler-driven dispatch, retry/delay state, and approval resume
- workflow smoke runs routed through the same scheduler + connector + normalization path
- updated `code_index.md` and `roadmap.md`
- full verification already green on this phase branch

Read these first:

- `code_index.md`
- `roadmap.md`
- `docs/superpowers/specs/2026-03-26-llm-pentest-platform-design.md`
- `docs/superpowers/specs/2026-03-26-mcp-gateway-registry-spec.md`
- `docs/superpowers/plans/2026-03-26-real-connectors-scheduler-implementation.md`

## Primary Goal

Implement the next backend slice in a fresh isolated branch/worktree:

1. add a real LLM orchestrator provider abstraction
2. define MCP onboarding conventions/templates for future tool families
3. create a safe local Docker-based vulnerable-target validation harness
4. prove end-to-end execution:
   - LLM planning
   - MCP capability dispatch
   - scheduler execution
   - approval gating when needed
   - asset/evidence/finding persistence

## Hard Constraints

- create a fresh isolated `codex/` branch and worktree before editing
- do not modify the current user branch directly
- never hardcode live credentials or write them into source, logs, or docs
- keep `*.txt` ignored in git
- update `code_index.md`
- update `roadmap.md`
- run full verification:
  - `npm run test`
  - `npm run lint`
  - `npm run build`
  - `npm run e2e`
  - `npm run test:all`
- use Context7 and official / primary documentation

## Technical Direction

### 1. Real LLM Provider Abstraction

- add a provider layer that can call a configured remote LLM endpoint
- keep credentials strictly in runtime env/config, never in persisted records
- support at least:
  - orchestrator request
  - reviewer request
  - failure fallback / timeout reporting
- make the provider pluggable so later sessions can add OpenAI or other providers without touching scheduler logic

### 2. MCP Onboarding Conventions

- document how a new capability family should be added
- define:
  - connector contract expectations
  - tool metadata requirements
  - normalization expectations
  - approval/risk defaults
  - test strategy

### 3. Local Docker Validation Harness

Use safe, intentionally vulnerable local-only targets. Recommended starting set:

- OWASP Juice Shop
- OWASP WebGoat / WebWolf
- optionally DVWA if needed later

Favor targets with official Docker guidance and stable local ports. Keep bindings on `127.0.0.1`.

Reference official docs:

- OWASP Juice Shop running guide: <https://pwning.owasp-juice.shop/companion-guide/latest/part1/running.html>
- OWASP WebGoat project page: <https://owasp.org/www-project-webgoat/>
- DVWA project repository: <https://github.com/digininja/DVWA>

### 4. Validation Scope

Add a minimal but real end-to-end path such as:

- LLM receives a seed target like `http://127.0.0.1:3000`
- LLM chooses low-risk reconnaissance capabilities
- scheduler dispatches through MCP connectors
- results persist into project context
- one deliberately approval-gated validation action pauses correctly
- operator approval resumes it

## Deliverables

- real LLM provider abstraction and config docs
- MCP onboarding convention docs/templates
- local Docker lab bootstrap (compose or equivalent)
- at least one automated test or smoke harness that proves the local end-to-end path
- updated docs and green verification

## Notes

- The platform rule remains: LLM is the brain, MCP is the limbs.
- External interaction should still flow through MCP/connectors, not directly from the LLM provider layer.
- Keep the UI/API contract stable unless a change is clearly necessary for safe operation.
