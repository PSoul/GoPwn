# Code Index

> This document describes all code directories and key files so another LLM can quickly understand the project.
> Last updated: 2026-04-02 (Phase 23b: execute_code pipeline fix)

---

## Project Overview

LLM-driven penetration testing platform. The LLM acts as the "brain" (planning, reasoning, reviewing), MCP servers act as the "limbs" (executing tools against targets), and the platform acts as the "central nervous system" (approval control, scheduling, persistence, normalization).

**Tech stack**: Next.js 15 (App Router) + React 19 + TypeScript + TailwindCSS + shadcn/ui + PostgreSQL 16 + Prisma 7 + Vitest + Playwright

---

## `app/` -- Next.js Pages and API Routes

### Pages (`app/(console)/`)

| Route | Description |
|-------|-------------|
| `dashboard/` | Main dashboard with project summary stats |
| `projects/` | Project list page |
| `projects/new/` | Create new project form |
| `projects/[projectId]/` | Project detail with 7 tabs (Overview, Operations, Findings, Assets, Evidence, Domains, Network) |
| `approvals/` | Pending approval queue |
| `assets/` | Global asset inventory |
| `evidence/` | Global evidence browser |
| `settings/` | Platform settings (LLM, MCP tools, approval policy, agent config, audit logs) |
| `vuln-center/` | Vulnerability center dashboard |
| `login/` | Authentication page |

### API Routes (`app/api/`) -- 47 route files

| Group | Routes | Description |
|-------|--------|-------------|
| `auth/` | login, logout, captcha | Session-based auth with CAPTCHA |
| `projects/` | CRUD, archive | Project lifecycle management |
| `projects/[id]/scheduler-control` | PATCH | Start/stop/pause scheduler lifecycle |
| `projects/[id]/scheduler-tasks/` | CRUD | Individual task management |
| `projects/[id]/orchestrator/plan` | POST | Trigger LLM plan generation |
| `projects/[id]/orchestrator/local-validation` | POST | Run local lab validation |
| `projects/[id]/mcp-workflow/smoke-run` | POST | Execute MCP smoke test |
| `projects/[id]/operations` | GET | Aggregated operations view |
| `projects/[id]/results/*` | findings, domains, network | Structured pentest results |
| `projects/[id]/context` | GET | LLM context for the project |
| `projects/[id]/flow` | GET | Pentest flow stage data |
| `projects/[id]/llm-logs/` | GET, GET/:id | LLM call history |
| `projects/[id]/mcp-runs` | GET | MCP execution history |
| `projects/[id]/approval-control` | PATCH | Toggle approval mode |
| `projects/[id]/report-export` | GET | Export pentest report |
| `approvals/` | GET, PATCH/:id | Approval queue management |
| `assets/` | GET, GET/:id | Asset inventory |
| `evidence/` | GET, GET/:id | Evidence records |
| `artifacts/` | GET | Raw artifact file serving |
| `dashboard/` | GET | Dashboard aggregation |
| `llm-logs/` | recent, stream | Global LLM log viewer + SSE stream |
| `settings/` | llm, mcp-servers, mcp-tools, approval-policy, agent-config, sections, system-status, audit-logs, work-logs | Platform configuration |
| `users/` | CRUD | User management |
| `vuln-center/` | summary | Vulnerability statistics |
| `health/` | GET | Health check |

---

## `components/` -- React Components (115 files)

| Directory | Key Components | Description |
|-----------|---------------|-------------|
| `projects/` | ProjectForm, ProjectDetailTabs, OverviewTab, OperationsTab, FindingsTab, AssetsTab, EvidenceTab, DomainsTab, NetworkTab | Project UI, 7-tab detail layout |
| `dashboard/` | DashboardCards, ProjectsTable, StatsChart | Dashboard widgets |
| `approvals/` | ApprovalQueue, ApprovalCard, ApprovalActions | Approval workflow UI |
| `assets/` | AssetTable, AssetDetail | Asset inventory display |
| `evidence/` | EvidenceList, EvidenceDetail | Evidence browser |
| `settings/` | SettingsSections, LlmSettings, McpToolsSettings, ApprovalPolicySettings | Settings panels |
| `auth/` | LoginForm, CaptchaField | Authentication components |
| `layout/` | AppShell, Sidebar, Header, Breadcrumbs | Application layout |
| `shared/` | LoadingSkeleton, ConfirmDialog, PageTransition, ErrorBoundary | Shared utilities |
| `kokonutui/` | Animated UI components | Enhanced UI widgets |
| `ui/` | shadcn/ui primitives | Button, Card, Dialog, Table, Tabs, etc. |

---

## `lib/` -- Core Business Logic (137 files)

### Orchestrator (the "brain" coordinator)

| File | Description |
|------|-------------|
| `orchestrator-service.ts` | Main orchestrator entry point -- coordinates LLM planning, task execution, and result review; includes per-project lifecycle mutex to prevent concurrent kickoffs **(Phase 23b)** |
| `orchestrator-plan-builder.ts` | Builds execution plans from LLM output (capability + target + requestedAction) |
| `orchestrator-execution.ts` | Executes MCP tool calls from plans; same-target `execute_code` runs run sequentially to avoid conflicts **(Phase 23)** |
| `orchestrator-context-builder.ts` | Builds LLM context from project state; passes raw `execute_code` output to LLM for autonomous analysis **(Phase 23)** |
| `orchestrator-local-lab.ts` | Local lab validation runner; generic fallback plans not tied to any specific target **(Phase 23)** |
| `orchestrator-target-scope.ts` | Target scope validation, localhost equivalents detection; removed target-specific helpers **(Phase 23)** |

### LLM Integration

| File | Description |
|------|-------------|
| `llm-brain-prompt.ts` | System prompt for the LLM brain; generic TCP/service guidance without listing specific ports **(Phase 23)** |
| `llm-call-logger.ts` | Logs all LLM API calls for audit |
| `llm-settings-repository.ts` | CRUD for LLM provider settings |
| `llm-settings-write-schema.ts` | Zod validation for LLM settings |
| `tool-output-summarizer.ts` | Summarizes long tool outputs for LLM context window |
| `llm-provider/openai-compatible-provider.ts` | OpenAI-compatible LLM API client with HTTP proxy support |
| `llm-provider/registry.ts` | LLM provider registry |
| `llm-provider/types.ts` | LLM provider type definitions |

### MCP Connectors

| File | Description |
|------|-------------|
| `mcp-connectors/stdio-mcp-connector.ts` | Generic stdio MCP server connector; TCP banner detection by protocol patterns, not hardcoded ports **(Phase 23)** |
| `mcp-connectors/local-foundational-connectors.ts` | Built-in foundational connectors (HTTP probe, DNS); minimal smoke results without fabricating data **(Phase 23)** |
| `mcp-connectors/real-http-validation-mcp-connector.ts` | HTTP validation connector; generic validation profile **(Phase 23)** |
| `mcp-connectors/real-http-structure-mcp-connector.ts` | HTTP structure analysis connector |
| `mcp-connectors/real-web-surface-mcp-connector.ts` | Web surface discovery connector |
| `mcp-connectors/real-dns-intelligence-connector.ts` | DNS intelligence connector |
| `mcp-connectors/real-evidence-capture-mcp-connector.ts` | Evidence capture connector |
| `mcp-connectors/registry.ts` | Connector registry |
| `mcp-connectors/types.ts` | Connector type definitions |

### Execution Pipeline

| File | Description |
|------|-------------|
| `execution/artifact-normalizer.ts` | Normalizes raw tool output into structured assets/findings/network records; header-based asset classification instead of URL-path matching **(Phase 23)**. NOTE: currently unused — the actual normalizer lives inside `mcp-execution-service.ts` |
| `execution/artifact-normalizer-stdio.ts` | Artifact normalization for stdio MCP output. NOTE: currently unused — the actual normalizer lives inside `mcp-execution-service.ts` |
| `execution/execution-runner.ts` | Low-level tool execution runner |
| `execution/execution-helpers.ts` | Execution utility functions |

### MCP Infrastructure

| File | Description |
|------|-------------|
| `mcp-client-service.ts` | MCP client lifecycle management |
| `mcp-execution-service.ts` | MCP tool execution orchestration. Contains the **actual** `normalizeExecutionArtifacts` + `normalizeStdioMcpArtifacts` (local copies, not imported). Handles execute_code stdout extraction from JSON wrapper, vulnerability JSON parsing, evidence creation, and fallback IP:port extraction from rawOutput **(Phase 23b/24a fix)** |
| `mcp-execution-runtime.ts` | Runtime environment for MCP execution |
| `mcp-execution-abort.ts` | Abort/cancel support for MCP runs |
| `mcp-workflow-service.ts` | Workflow-level MCP coordination |
| `mcp-auto-discovery.ts` | Auto-discover MCP servers from config |
| `mcp-gateway-repository.ts` | MCP gateway data access |
| `mcp-repository.ts` | MCP tool registration repository |
| `mcp-server-repository.ts` | MCP server configuration repository |
| `mcp-server-sqlite.ts` | SQLite-based MCP server storage |
| `mcp-scheduler-service.ts` | MCP task scheduling; catch-all error handler ensures tasks always reach final status **(Phase 23b)** |
| `mcp-scheduler-repository.ts` | Scheduler data access; expired task recovery checks MCP run status to avoid re-executing completed work **(Phase 23b)** |
| `mcp-registration-schema.ts` | MCP tool registration validation |
| `mcp-write-schema.ts` | MCP write operation validation |
| `built-in-mcp-tools.ts` | Built-in tool definitions |

### Project Services

| File | Description |
|------|-------------|
| `project-mcp-dispatch-service.ts` | Dispatches MCP tasks for projects; background completion handler for timed-out drains **(Phase 23)** |
| `project-repository.ts` | Project data access (delegates to sub-modules) |
| `project-results-repository.ts` | Project results data access (delegates to sub-modules) |
| `project-targets.ts` | Target normalization and parsing |
| `project-write-schema.ts` | Project creation/update validation |
| `project-id.ts` | Project ID generation (PRJ-YYYYMMDD-XXX) |
| `project-closure-status.ts` | Project closure/completion status |
| `project-scheduler-lifecycle.ts` | Scheduler lifecycle state machine |
| `project-scheduler-control-repository.ts` | Scheduler control data access |
| `project/` | Sub-modules: `project-read-repository.ts`, `project-mutation-repository.ts` |

### Sub-module Directories

| Directory | Files | Description |
|-----------|-------|-------------|
| `compositions/` | control, dashboard, project, settings | Composition layer -- aggregates multiple repository calls |
| `results/` | project-conclusion-service, project-report-repository, project-results-core | Results aggregation and report generation |
| `gateway/` | dispatch-helpers, mcp-dispatch-service, mcp-run-repository | MCP dispatch gateway |
| `scheduler-control/` | scheduler-control-core, scheduler-control-helpers, scheduler-task-commands | Scheduler control logic |
| `types/` | approval, asset, evidence, llm-log, mcp, payloads, project, scheduler, settings, user | TypeScript type definitions |

### Other Library Files

| File | Description |
|------|-------------|
| `api-handler.ts` | Standard API route handler with auth + error handling |
| `api-client.ts` | Client-side API wrapper |
| `api-error-messages.ts` | Standardized error messages |
| `api-compositions.ts` | Legacy composition entry point |
| `auth-repository.ts` | User authentication data access |
| `auth-session.ts` | Session management |
| `csrf.ts` | CSRF token validation |
| `rate-limit.ts` | API rate limiting |
| `approval-repository.ts` | Approval queue data access |
| `approval-write-schema.ts` | Approval validation |
| `asset-repository.ts` | Asset inventory data access |
| `asset-view-selection.ts` | Asset view filtering |
| `evidence-repository.ts` | Evidence data access |
| `work-log-repository.ts` | Work log data access |
| `agent-config.ts` | Agent configuration |
| `env-detector.ts` | Environment detection |
| `failure-analyzer.ts` | Failure analysis for orchestrator |
| `local-lab-catalog.ts` | Known local lab target catalog |
| `navigation.ts` | Client-side navigation helpers |
| `platform-config.ts` | Platform configuration |
| `prisma.ts` | Prisma client singleton |
| `prisma-transforms.ts` | Prisma query/result transforms |
| `runtime-artifacts.ts` | Runtime artifact storage |
| `utils.ts` | General utilities |
| `prototype-*.ts` | Legacy prototype data layer (4 files, deprecated) |

---

## `mcps/` -- 14 Local MCP Servers

Each server follows a standard structure: `src/index.ts` (entry), `src/tools/` (tool implementations), `src/mappers/` (output normalization), `tests/` (unit + e2e tests).

| Server | Tools | Description |
|--------|-------|-------------|
| `fscan-mcp-server` | full-scan, host-discovery, port-scan, vuln-scan, web-scan, service-bruteforce | Network scanner (fscan wrapper). Parser supports both Chinese (2.0.1+) and English output formats. |
| `curl-mcp-server` | request, raw-request, batch | HTTP client |
| `httpx-mcp-server` | probe, tech-detect | HTTP probing and tech detection |
| `dirsearch-mcp-server` | scan, recursive | Directory/path brute-force |
| `subfinder-mcp-server` | enum, verify | Subdomain enumeration |
| `afrog-mcp-server` | scan, list-pocs | Vulnerability scanner (afrog wrapper) |
| `wafw00f-mcp-server` | detect, list | WAF detection |
| `whois-mcp-server` | whois-query, whois-ip, icp-query | WHOIS/ICP lookup |
| `fofa-mcp-server` | search, host, stats | FOFA search engine integration |
| `github-recon-mcp-server` | code-search, repo-search, commit-search | GitHub reconnaissance |
| `netcat-mcp-server` | tcp-connect, banner-grab, udp-send | Raw TCP/UDP connectivity |
| `encode-mcp-server` | encode-decode, hash-compute, crypto-util | Encoding/hashing utilities |
| `script-mcp-server` | execute-code, execute-command, read-file, write-file | Script execution (LLM-generated code) |

Registry: `mcps/mcp-servers.json`

---

## `prisma/` -- Database Schema

| File | Description |
|------|-------------|
| `schema.prisma` | 25 data models (Project, Asset, Finding, Evidence, McpTool, SchedulerTask, Approval, User, etc.) |
| `seed.ts` | Database seed script |
| `migrations/` | Prisma migration history |

---

## `tests/` -- Unit Tests (67 files)

| Directory | Coverage |
|-----------|----------|
| `tests/api/` | API route handler tests (orchestrator, mcp-runs, project-surfaces, etc.) |
| `tests/lib/` | Core library tests (orchestrator, connectors, normalizer, scheduler) |
| `tests/pages/` | Page component render tests |
| `tests/projects/` | Project-specific component tests |
| `tests/approvals/` | Approval workflow tests |
| `tests/settings/` | Settings page tests |
| `tests/auth/` | Authentication tests |
| `tests/layout/` | Layout component tests |
| `tests/integration/` | Cross-module integration tests |
| `tests/helpers/` | Test utilities and mocks |

---

## `e2e/` -- End-to-End Tests (Playwright)

| File | Description |
|------|-------------|
| `prototype-smoke.spec.ts` | Full smoke test of project lifecycle |
| `vuln-cockpit.spec.ts` | Vulnerability center E2E test |

---

## `docs/` -- Documentation

| File | Description |
|------|-------------|
| `architecture.md` | Platform architecture design (Chinese) |
| `pentest-flow-complete.md` | Complete pentest flow from project creation to conclusion |
| `api-reference.md` | API endpoint reference |
| `development-guide.md` | Developer setup and contribution guide |
| `mcp-tools-matrix.md` | MCP tool capability matrix |
| `prompt-engineering.md` | LLM prompt design notes |
| `code_index.md` | This file |
| `roadmap.md` | Development roadmap with phases |

---

## Key Design Principles (Post-Phase 23)

1. **No target-specific logic**: All orchestration, normalization, and prompt logic is generic. The LLM decides what to do based on its own reasoning, not hardcoded rules.
2. **LLM never touches targets directly**: All interaction goes through MCP tools.
3. **No fabricated data**: If an MCP tool fails or is unavailable, the platform reports the failure honestly rather than generating fake results.
4. **Header-based classification**: Asset types are determined by HTTP response headers and protocol analysis, not URL path matching.
5. **Generic TCP detection**: Service identification uses banner/protocol pattern matching, not port-number assumptions.
6. **Sequential same-target execution**: `execute_code` calls targeting the same host run sequentially to avoid race conditions.
