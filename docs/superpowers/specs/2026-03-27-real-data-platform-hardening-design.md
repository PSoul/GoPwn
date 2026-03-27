# Real Data Platform Hardening Design

## 1. Background

The current platform is no longer just a UI prototype, but it still behaves like one in several critical areas:

- creating a new project can land on a blank `404` page
- the store is still bootstrapped from `lib/prototype-data.ts`, so the app opens with demo projects, demo assets, demo evidence, and demo logs
- MCP onboarding is described in prose, but not enforced by a strict machine-validated registration contract
- `/settings/llm` is read-only and cannot be used to parameterize a real provider from the UI
- the live local-lab validation flow can generate artifacts under `output/live-validation/`, but it does not complete a normal in-app project lifecycle with browsable results

The user direction for this slice is to pivot from "prototype with realistic behavior" toward "first real usable version":

- no static demo business data should remain in normal runtime views
- new MCP integrations must conform to a strict contract
- LLM settings must become editable and provider-backed
- the local vulnerable-lab flow must create a real project and persist normal project results

## 2. Goals

This slice will deliver the following:

1. Fix the project-creation `404` path and make project detail routing stable.
2. Remove mock business data from runtime state and default views.
3. Introduce a strict MCP registration contract, documentation, and validation.
4. Make LLM settings editable in the UI, including plaintext `apiKey` display for this debugging phase.
5. Run a real local vulnerable-lab validation by creating a dedicated project and persisting results into normal project routes.

## 3. Non-Goals

This slice will explicitly not do the following:

- fully replace the JSON-backed store with a production database for every entity
- implement masked or encrypted secret storage yet
- solve the separate WebGoat host-reachability issue in the current Windows + Docker Desktop environment
- add every future MCP tool family now; this slice defines and enforces the contract first

## 4. External References

This design is aligned to the following official references that were re-checked during planning:

- Next.js App Router dynamic route params behavior from the official Next.js docs
- Model Context Protocol TypeScript SDK tool registration guidance, especially `registerTool`, `inputSchema`, `outputSchema`, and `structuredContent`

The platform-specific MCP contract in this slice should be built on top of the official MCP tool model rather than inventing an unrelated schema.

## 5. Recommended Approach

Adopt a "real data first" transition:

- keep the current app architecture, routes, and general UI intact
- replace seeded business records with empty or persisted real records
- separate platform dictionaries from business data
- add strict registration schemas before expanding more MCP families
- route local-lab validation back into the same persisted project surfaces users browse normally

This avoids a risky full storage rewrite while still meeting the user's requirement to stop behaving like a demo.

## 6. Architecture Changes

### 6.1 Stable Project Identity

Project display names should continue to support Chinese and mixed-language text, but route IDs should become ASCII-only stable identifiers.

The new project ID strategy will:

- stop deriving the route ID directly from the project name
- generate IDs such as `proj-20260327-7f42ab9c`
- preserve a separate human-readable project name field for UI

This sidesteps the observed dynamic-route risk around encoded non-ASCII path segments and makes scripts, APIs, and links more stable.

Existing non-ASCII project IDs already stored in local state should be migrated to ASCII IDs, with all foreign keys rewritten consistently:

- `projectDetails.projectId`
- approvals, assets, evidence, findings, MCP runs, scheduler tasks, form presets, and any other project-linked records

### 6.2 Split Platform Dictionaries from Runtime Data

`lib/prototype-data.ts` currently mixes two very different things:

- business records that should now be real persisted data
- platform dictionaries and UI metadata that may remain static for now

This slice will split them.

Business records to remove from static bootstrapping:

- projects
- project details
- findings
- approvals
- assets
- evidence
- work logs
- audit logs
- demo LLM settings
- demo MCP run history

Platform dictionaries that may remain code-defined for now:

- stage labels and capability taxonomy
- settings navigation metadata
- local lab catalog metadata
- boundary rule text and descriptive help copy

The runtime must open with empty-state screens when there is no real data, rather than silently injecting demo projects.

### 6.3 Empty-First Store Bootstrapping

`lib/prototype-store.ts` will move from "seeded demo state" to "empty persisted state with system defaults".

The default store should contain only:

- schema version
- empty business arrays/records
- minimal platform-level defaults required for the app to function
- persisted LLM configuration defaults
- persisted MCP registry data structures

The migration logic should purge known demo business data from existing stores. The purge must remove the existing seeded demo projects and their derived records so the user is left with only real data.

### 6.4 Strict MCP Registration Contract

This slice will add a new formal contract document:

- `docs/contracts/mcp-server-contract.md`

The contract will define three layers:

1. Server registration fields
2. Tool contract fields
3. Result-mapping fields

Required server-level fields:

- `serverName`
- `version`
- `transport`
- `command` plus `args` for `stdio`, or `endpoint` for remote transports
- `enabled`

Required tool-level fields:

- `toolName`
- `title` or human label
- `description`
- `capability`
- `boundary`
- `riskLevel`
- `requiresApproval`
- `inputSchema`
- `outputSchema`
- `defaultConcurrency`
- `rateLimit`
- `timeout`
- `retry`

Required result-mapping fields:

- which outputs can produce domain/web rows
- which outputs can produce IP/port/service rows
- which outputs can produce findings
- which outputs can produce evidence
- which outputs can produce work-log entries

Validation rules:

- registration must fail if required fields are missing
- registration must fail if `inputSchema` or `outputSchema` is absent
- registration must fail if capability, boundary, or risk values are outside the platform taxonomy
- registration must fail if transport-specific fields do not match the chosen transport

Implementation-wise, this slice should introduce Zod schemas and a new server-registration API so the contract is enforced, not just documented.

### 6.5 Editable LLM Settings

`/settings/llm` will move from read-only display to persisted editable configuration.

The first version should support role-based model profiles:

- orchestrator
- reviewer
- extractor

Each profile will store:

- `provider`
- `label`
- `apiKey`
- `baseUrl`
- `model`
- `timeoutMs`
- `temperature`
- `enabled`

For this debugging phase, `apiKey` will be rendered in plaintext in the UI because the user explicitly requested it. Later masking can be added without changing the underlying data model.

Provider resolution order:

1. persisted UI settings
2. environment variable fallback

This allows real usage without forcing environment-only configuration.

### 6.6 Real Project Lifecycle for Local Lab Validation

The live validation flow should stop treating project state and artifact state as separate worlds.

The revised flow should:

1. create a new project through the normal project API
2. generate an orchestrator plan for a selected local lab
3. execute MCP-backed steps
4. auto-resume approvals when configured
5. persist assets, evidence, findings, logs, and run history back into that project
6. leave the finished project visible under `/projects` and its subroutes

Artifact reports under `output/live-validation/` should remain, but they become supporting run artifacts rather than the only visible result.

The command-line runner should default to writing into the active application store so the validated project is visible in the main UI. An explicit isolated-store override may remain available for regression use.

## 7. Data Model Direction

### 7.1 New or Changed Store Fields

The store should gain or formalize:

- `llmProfiles`
- `mcpServerContracts`
- `mcpToolContracts`

The store should retain:

- projects
- project details
- findings
- approvals
- assets
- evidence
- audit logs
- work logs
- scheduler tasks
- MCP runs

But these must be empty by default and populated only by real user or execution activity.

### 7.2 Legacy Seed Purge Strategy

Migration must explicitly remove the currently known seeded business records. The purge should target:

- seeded project IDs such as `proj-huayao`, `proj-xingtu`, `proj-yunlan`
- demo approvals, assets, evidence, findings, work logs, and audit logs derived from those projects

This ensures existing users do not carry prototype demo data into the first real-data version.

## 8. Route and API Changes

### 8.1 Project Routes

No route shape changes are required. Existing routes remain:

- `/projects`
- `/projects/new`
- `/projects/[projectId]`
- child result/context/operations routes

The route behavior changes because:

- IDs become ASCII-safe
- missing seeded projects are no longer expected
- empty states become first-class

### 8.2 New MCP Registration Surface

Add an API for validated MCP registration, likely under:

- `POST /api/settings/mcp-servers/register`

Optional follow-up mutations may include:

- `PATCH /api/settings/mcp-servers/[serverId]`
- `POST /api/settings/mcp-servers/[serverId]/validate`

The settings UI should expose a registration form or import surface that is backed by the same schemas.

### 8.3 LLM Settings API

Add persisted APIs such as:

- `GET /api/settings/llm`
- `PATCH /api/settings/llm`

The UI must read from these APIs rather than importing static settings.

## 9. Testing Strategy

### 9.1 Project Creation and Routing

Add or update tests to prove:

- creating a project yields an ASCII route ID
- the app lands on the new detail page successfully
- existing migrated projects with formerly non-ASCII IDs remain reachable after migration

This should include at least one real browser E2E, not only unit or component tests.

### 9.2 Empty-State Regression

Add tests to prove:

- a fresh store shows no demo project records
- dashboard, projects, approvals, evidence, and settings pages render useful empty states

### 9.3 MCP Contract Validation

Add tests to prove:

- valid MCP registrations are accepted
- missing `inputSchema` is rejected
- missing `outputSchema` is rejected
- invalid transport combinations are rejected
- invalid capability, boundary, or risk values are rejected

### 9.4 LLM Settings

Add tests to prove:

- LLM settings are editable and persisted
- provider resolution uses persisted settings before env fallback
- the orchestrator path reads the saved provider config

### 9.5 Local Lab Closure

Add tests to prove:

- a new dedicated project can be created for local lab validation
- the runner persists normal project results into that project
- the resulting assets, evidence, findings, and work logs are visible from normal project APIs

## 10. Risks and Mitigations

### Risk: Purging demo data may break tests that still assume seeded projects exist

Mitigation:

- rewrite tests to build explicit fixtures through repositories or isolated temp stores
- stop relying on global seed records in tests

### Risk: Existing local stores contain mixed real and demo records

Mitigation:

- implement explicit migration rules for known seeded records
- migrate or rewrite non-ASCII project IDs before route usage

### Risk: Persisted plaintext API keys are unsafe long-term

Mitigation:

- accept plaintext storage only for this debugging phase
- document that masking/encryption is a follow-up task

## 11. Acceptance Criteria

This slice is complete when all of the following are true:

- creating a new project no longer results in a blank `404`
- the app no longer boots with demo projects or demo business data
- MCP registration is backed by a strict documented schema and runtime validation
- `/settings/llm` supports real persisted parameter editing, including plaintext key display for now
- a real local Juice Shop validation creates a visible project with persisted results in normal routes
- `code_index.md` and `roadmap.md` are updated after implementation

## 12. Recommended Execution Order

1. Fix project ID generation and add route/E2E coverage.
2. Refactor store bootstrapping to empty-first real data and purge known seeded demo records.
3. Add persisted LLM settings and provider resolution from store.
4. Add MCP contract docs, schema, registration API, and settings UI.
5. Rewrite the live local-lab validation flow so it creates and persists a real project closure.
6. Update docs and run full verification.
