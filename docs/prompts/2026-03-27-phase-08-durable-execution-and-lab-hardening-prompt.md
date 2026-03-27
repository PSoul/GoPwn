# Phase 08 Prompt: Durable Execution, Real Connector Expansion, and Lab Hardening

You are continuing work on an authorized external security assessment platform built in Next.js App Router.

## Read First

1. `code_index.md`
2. `roadmap.md`
3. `docs/operations/local-docker-labs.md`
4. `docs/operations/mcp-onboarding-guide.md`
5. `docs/superpowers/plans/2026-03-27-live-llm-local-lab-validation-implementation.md`

## Current State

The platform already has:

- template-aligned frontend prototype routes
- persisted project, approval, asset, evidence, work-log, audit-log, and MCP run state
- scheduler-backed MCP dispatch and approval resume
- OpenAI-compatible LLM provider support via environment variables only
- real MCP stdio integration for `Web 页面探测类`
- local Docker labs for Juice Shop and WebGoat
- a reusable `npm run live:validate` runner
- one successful real-provider artifact proving:
  - real LLM planning
  - local Docker Juice Shop targeting
  - real Web stdio MCP invocation
  - approval pause and approval resume
  - persisted asset/evidence/finding aggregation

Known gap:

- in the current Windows + Docker Desktop environment, `webgoat` starts inside the container but its host-side `127.0.0.1:8080` reachability is unstable or unavailable, so the second lab is not yet green through the same runner.

## Product Boundary

- `LLM = brain`
- `MCP = limbs`

Any action that touches a target should prefer MCP.
Platform-side aggregation, normalization, state transitions, and reporting can remain internal.

## What To Build Next

Implement the next slice that moves the platform from successful alpha validation toward a more operational backend:

1. Make execution state more durable and operator-friendly
2. Expand real connector coverage beyond DNS + Web surface
3. Harden the local lab regression path, especially WebGoat
4. Keep the current UI contracts stable unless a small UI adjustment is necessary for operator clarity

## Required Scope

### 1. Durable Execution Controls

- introduce a clearer persisted task/run lifecycle for:
  - queued
  - running
  - waiting approval
  - retry scheduled
  - cancelled
  - completed
  - failed
- add operator controls for:
  - cancel current run
  - cancel queued run
  - retry failed run
  - stop scheduler drain
- make sure these controls affect real execution state, not just display state

### 2. Real Connector Expansion

Add at least one more real capability family beyond:

- `DNS / 子域 / 证书情报类`
- `Web 页面探测类`

Recommended target:

- `HTTP / API 结构发现类`

Examples of acceptable implementations:

- safe HTTP/headers/options probing
- OpenAPI / Swagger discovery
- GraphQL schema/introspection surface discovery with low-risk safeguards

Keep it safe and auditable.

### 3. Local Lab Hardening

- investigate and stabilize WebGoat host-side reachability
- if pure host port publishing remains unreliable on this machine, design a documented fallback that still preserves the platform boundary and local-only safety
- extend the live-validation runner so it can:
  - report per-lab health diagnostics more clearly
  - distinguish environment failure from platform logic failure
  - optionally continue with labs that are reachable while marking blocked labs explicitly

### 4. Regression Coverage

Add focused tests for:

- new durable run-control actions
- new real connector behavior
- lab health diagnostics / failure classification
- any newly introduced normalization or state-transition logic

## Constraints

- do not hardcode secrets
- use environment variables only for real provider credentials
- keep `.txt` ignored in git
- update `code_index.md` and `roadmap.md`
- if you add any new operational flow, document it in `docs/operations/`
- preserve the current route structure unless a change is clearly justified

## Validation Requirements

Before claiming completion:

1. run targeted tests for the new slice
2. run `npm run test:all`
3. run at least one real `npm run live:validate` flow
4. if WebGoat is still not green, report the exact failure mode and the fallback you implemented

## Deliverables

- code changes
- updated docs
- updated `code_index.md`
- updated `roadmap.md`
- real validation artifact(s)
- concise summary of:
  - what is now truly production-leaning
  - what is still prototype-grade
  - what should be built next
