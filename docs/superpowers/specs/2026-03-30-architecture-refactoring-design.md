# Architecture Refactoring Design: Phase 19 Subtraction

> Date: 2026-03-30
> Status: Approved
> Goal: Reduce complexity by splitting 3 monolithic files, deleting ~850 lines of dead code, capping max file size at ~410 lines.

## Context

After 17 phases of additive development, the codebase has accumulated structural debt in three files:

- `prototype-types.ts` (918 lines, 90 types) — single file for all domain types
- `prototype-api.ts` (1,104 lines, 43 functions) — facade where 81% are zero-value passthroughs
- `orchestrator-service.ts` (1,536 lines, 38 functions) — 11 responsibility groups in one file

Tests pass (178 unit + 14 E2E). No functionality changes needed. This is pure structural improvement.

## Constraints

- Zero functionality changes — all existing behavior preserved exactly
- All 178 unit tests + 14 E2E tests must pass after each step
- Each step is independently committable and verifiable
- No new dependencies introduced

---

## Step 1: Split prototype-types.ts into Domain Files

### What

Split 90 exported types from `prototype-types.ts` into 10 domain-specific files under `lib/types/`. The original file becomes a re-export barrel.

### File Structure

```
lib/types/
├── project.ts       ProjectRecord, ProjectDetailRecord, ProjectFormPreset,
│                     ProjectStage, ProjectStatus, ProjectSchedulerLifecycle,
│                     TimelineStage, TaskRecord, TaskStatus,
│                     ProjectKnowledgeItem, ProjectResultMetric,
│                     ProjectInventoryItem, ProjectInventoryGroup,
│                     ProjectFindingRecord, ProjectStageSnapshot,
│                     ProjectClosureState, ProjectClosureBlockerRecord,
│                     ProjectClosureStatusRecord, ProjectConclusionRecord
│
├── approval.ts      ApprovalRecord, ApprovalControl,
│                     ApprovalDecisionInput, ApprovalControlPatch,
│                     ApprovalPolicyPayload
│
├── mcp.ts           McpToolRecord, McpCapabilityRecord, McpBoundaryRule,
│                     McpRegistrationField, McpServerTransport, McpServerStatus,
│                     McpServerRecord, McpServerInvocationRecord,
│                     McpResultMapping, McpServerContractSummaryRecord,
│                     McpToolContractSummaryRecord, McpRunRecord
│
├── scheduler.ts     ProjectSchedulerControl, McpSchedulerTaskStatus,
│                     McpSchedulerTaskRecord, OrchestratorRoundRecord
│
├── asset.ts         AssetViewKey, AssetCollectionView, AssetRelation, AssetRecord
│
├── evidence.ts      EvidenceRecord
│
├── settings.ts      ControlSetting, PolicyRecord, SettingsSectionRecord,
│                     LlmSettingRecord, LlmProfileId, LlmProfileRecord,
│                     LlmSettingsPayload, LlmProviderStatus, LocalLabRecord
│
├── llm-log.ts       LlmCallRole, LlmCallPhase, LlmCallStatus, LlmCallLogRecord,
│                     LlmCallLogListPayload
│
├── user.ts          UserRole, UserStatus, UserRecord
│
└── payloads.ts      All *Payload, *Input, *Patch types (~30 types):
                      ProjectMutationInput, ProjectPatchInput,
                      ProjectCollectionPayload, ProjectOverviewPayload,
                      ProjectFlowPayload, ProjectOperationsPayload,
                      ProjectContextPayload, ProjectInventoryPayload,
                      ProjectFindingsPayload, DashboardPayload,
                      MetricCard, DashboardPriorityRecord,
                      DashboardRecentResultRecord, DashboardSystemRecord,
                      SettingsSectionsPayload, SystemStatusPayload,
                      LogCollectionPayload, LogRecord, SystemStatusRecord,
                      ApiErrorPayload, ApprovalCollectionPayload,
                      AssetCollectionPayload, AssetDetailPayload,
                      EvidenceCollectionPayload, EvidenceDetailPayload,
                      McpToolPatchInput, McpSettingsPayload,
                      McpDispatchInput, McpDispatchPayload,
                      McpRunCollectionPayload, McpWorkflowSmokeInput,
                      McpWorkflowSmokePayload, LocalValidationRunInput,
                      OrchestratorPlanPayload, LocalValidationRunPayload,
                      ProjectReportExportActionPayload,
                      VulnCenterSummaryPayload,
                      OrchestratorPlanItem, OrchestratorPlanRecord,
                      ProjectOrchestratorPanelPayload,
                      ProjectReportExportRecord, ProjectReportExportPayload
```

### Backward Compatibility

`lib/prototype-types.ts` becomes:

```typescript
export * from "./types/project"
export * from "./types/approval"
export * from "./types/mcp"
export * from "./types/scheduler"
export * from "./types/asset"
export * from "./types/evidence"
export * from "./types/settings"
export * from "./types/llm-log"
export * from "./types/user"
export * from "./types/payloads"
```

All existing `import { X } from "@/lib/prototype-types"` statements continue to work unchanged.

### Cross-references Between Domain Files

Some types reference types from other domains. Handle via direct imports:
- `payloads.ts` imports from `project.ts`, `approval.ts`, `mcp.ts`, etc.
- `project.ts` is self-contained (no cross-domain imports)
- `scheduler.ts` may reference `McpSchedulerTaskStatus` which is in `mcp.ts` — move task-status types to `scheduler.ts` since they belong to the scheduler domain

### Verification

```bash
npx tsc --noEmit    # Zero errors
npx vitest run      # 178 passed, 33 skipped
```

---

## Step 2: Slim Down prototype-api.ts

### What

Delete 35 passthrough/simple-forwarding functions. Update ~30 API routes to import directly from repositories. Rename the remaining file to `lib/api-compositions.ts` (~250 lines, 8 functions).

### Functions to Delete (35)

Pure passthroughs (13):
- `listProjectsPayload`, `getAssetDetailPayload`, `getProjectRecord`,
  `listEvidencePayload`, `listAuditLogsPayload`, `updateGlobalApprovalControlPayload`,
  `getLlmSettingsPayload`, `updateLlmSettingsPayload`, `registerMcpServerPayload`,
  `getMcpToolPayload`, `updateMcpToolPayload`, `runMcpHealthCheckPayload`,
  `listWorkLogsPayload`

Wrapping passthroughs (5):
- `listApprovalsPayload`, `createProjectOverviewPayload`,
  `updateProjectOverviewPayload`, `archiveProjectOverviewPayload`,
  `dispatchProjectMcpRunPayload`

Simple forwarding (17):
- `getProjectOverviewPayload`, `getProjectFlowPayload`,
  `getProjectFormPresetValue`, `getProjectInventoryPayload`,
  `getProjectFindingsPayload`, `getEvidenceDetailPayload`,
  `listAssetsPayload`, `listProjectMcpRunsPayload`,
  `runProjectMcpWorkflowSmokePayload`, `updateProjectApprovalControlPayload`,
  `runProjectSchedulerTaskActionPayload`, `getProjectOrchestratorPayload`,
  `generateProjectOrchestratorPlanPayload`, `executeProjectLocalValidationPayload`,
  `getProjectReportExportPayload`, `triggerProjectReportExportPayload`,
  `getSystemStatusPayload`

### Functions to Keep (8) — moved to api-compositions.ts

1. `getDashboardPayload` — 6 data sources + helper functions
2. `getProjectOperationsPayload` — 8 data sources
3. `getProjectContextPayload` — 5 data sources
4. `getSettingsSectionsPayload` — 5 data sources
5. `getMcpSettingsPayload` — 3 repos + 2 Prisma + transforms
6. `updateApprovalDecisionPayload` — 6 sources + conditional orchestration
7. `updateProjectSchedulerControlPayload` — 6 sources + state machine
8. `getApprovalPolicyPayload` — 3 data sources

Plus private helpers used by these functions (e.g., `getProjectBase`, `buildAssetViews`, dashboard helper functions).

### Migration Pattern for API Routes

Before:
```typescript
import { listProjectsPayload } from "@/lib/prototype-api"
// ...
const data = await listProjectsPayload()
```

After:
```typescript
import { listStoredProjects } from "@/lib/project-repository"
// ...
const data = await listStoredProjects()
```

### File Disposition

- Delete `lib/prototype-api.ts`
- Create `lib/api-compositions.ts` (~250 lines) with the 8 retained functions
- Update 60 import sites (37 API routes + 20 pages + 3 others)

### Verification

```bash
npx tsc --noEmit
npx vitest run
node scripts/run-playwright.mjs  # 14 E2E
```

---

## Step 3: Split orchestrator-service.ts

### What

Split 1,536 lines into 5 focused modules. The main file retains only public API entry points (~350 lines).

### New File Structure

#### `lib/orchestrator-target-scope.ts` (~230 lines)

Responsibility: Target classification, scope validation, TCP parsing.

Functions moved:
- `classifyTarget`, `extractHostCandidate`, `toWebTarget`
- `isLocalHost`, `ipv4ToNumber`, `isIpv4InCidr`, `extractComparableHost`
- `isTargetWithinProjectScope`, `filterPlanItemsToProjectScope`
- `isWebGoatBaseUrl`, `canUseHttpStructureDiscovery` (inline into caller)
- `isTcpTarget`, `parseTcpTarget`

Exports: `classifyTarget`, `filterPlanItemsToProjectScope`, `parseTcpTarget`, `isWebGoatBaseUrl`, `toWebTarget`, `isLocalHost`

#### `lib/orchestrator-plan-builder.ts` (~410 lines)

Responsibility: Plan generation, normalization, fallback templates, capability matching.

Functions moved:
- `uniqueTools`, `getAvailableOrchestratorTools`, `findCapabilityByName`, `findCapabilityByKeywords`, `findNetworkCapability`
- `normalizeRiskLevel`, `normalizeTarget`, `normalizeUrlTarget`
- `inferCapabilityFromItem`, `buildNormalizedPlanItem`, `normalizePlanItems`
- `appendUniquePlanItem`
- `buildProjectFallbackPlanItems`, `buildTcpLabFallbackPlanItems`
- `normalizePlanRecord`, `persistProjectOrchestratorPlan`, `getStoredProjectOrchestratorPlan`

Exports: `getAvailableOrchestratorTools`, `normalizePlanItems`, `buildProjectFallbackPlanItems`, `normalizePlanRecord`, `persistProjectOrchestratorPlan`, `getStoredProjectOrchestratorPlan`, `findCapabilityByKeywords`

#### `lib/orchestrator-execution.ts` (~320 lines)

Responsibility: Plan execution, round recording, reflection, multi-round loop control, lifecycle closure.

Functions moved:
- `executePlanItems`
- `recordOrchestratorRound`, `generateRoundReflection`
- `shouldContinueAutoReplan`, `generateMultiRoundPlan`
- `buildProjectRecentContext`
- `hasActiveProjectSchedulerWork`, `settleProjectLifecycleClosure`

Exports: `executePlanItems`, `recordOrchestratorRound`, `shouldContinueAutoReplan`, `generateMultiRoundPlan`, `settleProjectLifecycleClosure`, `buildProjectRecentContext`

#### `lib/orchestrator-local-lab.ts` (~100 lines)

Responsibility: Local lab validation-specific plan building.

Functions moved:
- `buildLocalLabFallbackPlanItems`

Exports: `buildLocalLabFallbackPlanItems`

#### `lib/orchestrator-service.ts` (~350 lines, slimmed)

Responsibility: Public API only — 5 exported functions.

Retained:
- `generateProjectLifecyclePlan`
- `runProjectLifecycleKickoff`
- `generateProjectOrchestratorPlan`
- `executeProjectLocalValidation`
- `getProjectOrchestratorPanelPayload`

These functions compose the extracted modules. Import paths change from internal function calls to module imports.

### Internal Call Graph

```
orchestrator-service.ts (public API)
├── imports orchestrator-target-scope.ts
├── imports orchestrator-plan-builder.ts
├── imports orchestrator-execution.ts
└── imports orchestrator-local-lab.ts

orchestrator-plan-builder.ts
├── imports orchestrator-target-scope.ts (for classifyTarget, etc.)
└── no other internal imports

orchestrator-execution.ts
├── imports orchestrator-plan-builder.ts (for generateMultiRoundPlan's normalization)
└── no circular imports

orchestrator-local-lab.ts
├── imports orchestrator-target-scope.ts (for isWebGoatBaseUrl, parseTcpTarget)
├── imports orchestrator-plan-builder.ts (for findCapabilityByKeywords, appendUniquePlanItem)
└── no circular imports
```

### Verification

```bash
npx tsc --noEmit
npx vitest run
node scripts/run-playwright.mjs
```

---

## Expected Outcome

| Metric | Before | After |
|--------|--------|-------|
| `prototype-types.ts` | 918 lines, 1 file | 10 domain files + barrel re-export |
| `prototype-api.ts` | 1,104 lines, 43 functions | `api-compositions.ts`: ~250 lines, 8 functions |
| `orchestrator-service.ts` | 1,536 lines, 38 functions | 5 files, largest ~410 lines |
| Largest single file in lib/ | 1,536 lines | ~410 lines |
| Dead code removed | 0 | ~850 lines (35 passthrough functions) |
| Test impact | — | Zero: all 178 unit + 14 E2E pass |

## Risks

| Risk | Mitigation |
|------|-----------|
| Import path changes break something | Run tsc + vitest + playwright after each step |
| Re-export barrel creates circular imports | Domain files use direct cross-imports, not barrel |
| Orchestrator split creates circular deps | Call graph verified: no cycles in proposed structure |
| API route changes miss a call site | grep for deleted function names before committing |
