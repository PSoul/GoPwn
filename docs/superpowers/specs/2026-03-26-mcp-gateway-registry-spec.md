# 2026-03-26 MCP Gateway Registry and Execution Spec

## 1. Goal

Turn MCP from a static settings table into a first-class execution surface for the platform:

- LLM decides which capability is needed
- MCP gateway selects the concrete tool
- approval policy determines whether the action can execute
- execution state is persisted as project-level MCP run records
- foundational tools can be run locally as a smoke workflow before real external connectors are attached

This keeps the intended product model intact: LLM is the brain, MCP is the limbs.

## 2. Current Implementation Slice

### 2.1 Registry / Control Plane

The platform now persists:

- MCP tools
- capability families
- boundary rules
- registration checklist fields
- health-check state

These are managed in `/settings/mcp-tools` and exposed through dedicated API routes.

### 2.2 Project Execution Plane

The platform now persists project-level MCP run records with:

- capability
- selected tool
- target
- risk level
- dispatch mode
- status
- linked approval id when applicable
- execution summary lines

Project operations now exposes a project-level dispatch console and recent MCP run history.

### 2.3 Runnable Foundational Workflow

A local smoke workflow now exists for end-to-end verification. It currently chains:

1. `seed-normalizer`
2. `dns-census`
3. `web-surface-map`
4. optional high-risk approval gate via `auth-guard-check`
5. `report-exporter`

The workflow supports two scenarios:

- `baseline`: low-risk path completes fully
- `with-approval`: high-risk path halts at approval as expected

## 3. Dispatch Rules

### 3.1 Capability-First Routing

The caller does not choose a specific tool first. It submits:

- capability
- requested action
- target
- risk level

The gateway then selects the first enabled tool that satisfies the requested capability.

### 3.2 Approval Rules

Current rule set:

- if global approval is off or project approval is off, the gateway can auto-execute
- high-risk actions require approval when approval gates are enabled
- tools marked `requiresApproval=true` require approval when approval gates are enabled
- low-risk actions only auto-execute when both global and project settings allow low-risk auto-approval

### 3.3 Blocked State

If no enabled tool exists for a capability:

- the run is persisted as `已阻塞`
- the project activity stream records the block
- the audit log records the failed dispatch

## 4. Why Foundational Local Runners Exist

Before real MCP connectors are attached, the platform still needs a reliable way to prove:

- route handlers work
- dispatch records are created correctly
- approval linkage is correct
- project pages can surface execution history
- E2E/browser tests can validate a realistic control flow

The local foundational runners are not the final connector implementation. They are a deterministic verification layer.

## 5. Next Integration Targets

The next backend slice should expand from dispatch records into result persistence:

1. Map tool outputs into persisted assets
2. Map evidence-capable outputs into persisted evidence records
3. Write workflow events into work logs
4. Add resumable workflow execution after approval
5. Replace local runners with real MCP connectors incrementally by capability family
6. Add real LLM orchestration provider abstraction on top of the gateway

## 6. References

- Official MCP tools/server specification: <https://modelcontextprotocol.io/specification/2025-03-26/server/tools>
- MCP legacy tools concept overview: <https://modelcontextprotocol.io/legacy/concepts/tools>
- Next.js App Router dynamic server data patterns used for the settings/admin control surfaces: <https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/migrating/app-router-migration.mdx>
