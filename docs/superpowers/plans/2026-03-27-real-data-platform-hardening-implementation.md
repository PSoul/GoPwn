# Real Data Platform Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the platform from a seeded prototype into a real-data-first build with stable project routing, validated MCP registration, persisted editable LLM settings, and a real local-lab project closure visible in normal project pages.

**Architecture:** Keep the existing Next.js route structure, JSON-backed platform store, and SQLite-backed external MCP registry, but remove seeded business records from bootstrapping. Introduce ASCII-safe project IDs, split runtime business data from platform dictionaries, persist LLM configuration in the store, enforce MCP registration through Zod-backed contracts, and make the live local-lab runner create a real project and write results back into the same project surfaces the UI already reads.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Vitest, Playwright, Zod, `node:sqlite`, local JSON persistence, MCP TypeScript SDK

---

## File Map

### Runtime and Persistence

- Create: `lib/project-id.ts`
- Create: `lib/platform-config.ts`
- Create: `lib/llm-settings-repository.ts`
- Create: `lib/llm-settings-write-schema.ts`
- Create: `lib/mcp-registration-schema.ts`
- Create: `lib/live-validation-project-service.ts`
- Create: `tests/helpers/project-fixtures.ts`
- Modify: `lib/project-repository.ts`
- Modify: `lib/prototype-store.ts`
- Modify: `lib/prototype-types.ts`
- Modify: `lib/prototype-api.ts`
- Modify: `lib/llm-provider/registry.ts`
- Modify: `lib/mcp-server-sqlite.ts`
- Modify: `lib/mcp-server-repository.ts`
- Modify: `lib/orchestrator-service.ts`
- Delete: `lib/prototype-data.ts`

### App Routes and UI

- Create: `app/api/settings/llm/route.ts`
- Create: `app/api/settings/mcp-servers/register/route.ts`
- Create: `components/settings/llm-settings-client.tsx`
- Modify: `app/(console)/dashboard/page.tsx`
- Modify: `app/(console)/approvals/page.tsx`
- Modify: `app/(console)/assets/page.tsx`
- Modify: `app/(console)/evidence/page.tsx`
- Modify: `app/(console)/projects/[projectId]/operations/page.tsx`
- Modify: `app/(console)/settings/page.tsx`
- Modify: `app/(console)/settings/llm/page.tsx`
- Modify: `app/(console)/settings/system-status/page.tsx`
- Modify: `components/projects/project-form.tsx`
- Modify: `components/settings/llm-settings-panel.tsx`
- Modify: `components/settings/mcp-gateway-client.tsx`
- Modify: `components/settings/settings-subnav.tsx`

### Docs and Scripts

- Create: `docs/contracts/mcp-server-contract.md`
- Modify: `scripts/run-live-validation.mjs`
- Modify: `scripts/lib/live-validation-report.mjs`
- Modify: `code_index.md`
- Modify: `roadmap.md`

### Tests

- Create: `tests/lib/prototype-store.test.ts`
- Create: `tests/api/llm-settings-api.test.ts`
- Create: `tests/api/mcp-registration-api.test.ts`
- Modify: `tests/api/projects-api.test.ts`
- Modify: `tests/api/project-mutations-api.test.ts`
- Modify: `tests/api/settings-api.test.ts`
- Modify: `tests/api/operational-surfaces-api.test.ts`
- Modify: `tests/api/project-surfaces-api.test.ts`
- Modify: `tests/api/mcp-runs-api.test.ts`
- Modify: `tests/api/mcp-workflow-smoke-api.test.ts`
- Modify: `tests/api/approval-controls-api.test.ts`
- Modify: `tests/api/orchestrator-api.test.ts`
- Modify: `tests/lib/mcp-connectors.test.ts`
- Modify: `tests/lib/mcp-scheduler-service.test.ts`
- Modify: `tests/lib/mcp-scheduler-retry.test.ts`
- Modify: `tests/lib/real-web-surface-mcp-connector.test.ts`
- Modify: `tests/pages/project-mutations-ui.test.tsx`
- Modify: `tests/pages/approvals-assets-page.test.tsx`
- Modify: `tests/pages/dashboard-page.test.tsx`
- Modify: `tests/pages/evidence-settings-page.test.tsx`
- Modify: `tests/pages/project-detail-page.test.tsx`
- Modify: `tests/pages/projects-page.test.tsx`
- Modify: `tests/projects/project-operations-panel.test.tsx`
- Modify: `tests/projects/project-orchestrator-panel.test.tsx`
- Modify: `tests/settings/mcp-gateway-client.test.tsx`
- Modify: `e2e/prototype-smoke.spec.ts`

## Task 1: Stabilize Project IDs and Reproduce the 404 Bug End-to-End

**Files:**
- Create: `lib/project-id.ts`
- Modify: `lib/project-repository.ts`
- Modify: `lib/prototype-store.ts`
- Modify: `tests/lib/prototype-store.test.ts`
- Modify: `tests/api/project-mutations-api.test.ts`
- Modify: `tests/pages/project-mutations-ui.test.tsx`
- Modify: `e2e/prototype-smoke.spec.ts`

- [ ] **Step 1: Write the failing API assertion for ASCII-safe project IDs**

Add a new assertion to `tests/api/project-mutations-api.test.ts`:

```ts
expect(createPayload.project.id).toMatch(/^proj-\d{8}-[a-f0-9]{8}$/)
expect(createPayload.project.id).not.toContain("北栖")
```

- [ ] **Step 2: Run the focused API test and verify it fails for the current name-derived ID**

Run: `npx vitest run tests/api/project-mutations-api.test.ts`
Expected: FAIL because the created project ID currently includes the Chinese project name.

- [ ] **Step 3: Write the failing browser test for create-and-land behavior**

Append a Playwright test in `e2e/prototype-smoke.spec.ts` that:

```ts
await loginAsResearcher(page)
await page.goto("/projects/new")
await page.getByRole("button", { name: "创建项目" }).click()
await expect(page).toHaveURL(/\/projects\/proj-\d{8}-[a-f0-9]{8}$/)
await expect(page.getByRole("heading", { name: /项目详情 · 北栖支付开放暴露面初筛/ })).toBeVisible()
```

- [ ] **Step 4: Run the focused E2E test and verify it reproduces the broken navigation**

Run: `npx playwright test e2e/prototype-smoke.spec.ts --grep "create"`
Expected: FAIL because the browser currently lands on a `404` route after creation.

- [ ] **Step 5: Implement a dedicated ASCII-safe ID generator**

Create `lib/project-id.ts`:

```ts
import { createHash } from "node:crypto"

function buildDayStamp(date = new Date()) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}${month}${day}`
}

export function buildAsciiProjectId(name: string, date = new Date()) {
  const hash = createHash("sha256")
    .update(`${name}:${date.toISOString()}:${Math.random()}`)
    .digest("hex")
    .slice(0, 8)

  return `proj-${buildDayStamp(date)}-${hash}`
}
```

- [ ] **Step 6: Add a migration path for existing non-ASCII project IDs**

Update `lib/prototype-store.ts` with a migration helper that rewrites legacy project IDs and every related foreign key:

```ts
function migrateProjectIdsToAscii(store: PrototypeStore): PrototypeStore {
  const idMap = new Map<string, string>()

  const projects = store.projects.map((project) => {
    if (/^[\x00-\x7F]+$/.test(project.id)) {
      return project
    }

    const nextId = buildAsciiProjectId(project.name)
    idMap.set(project.id, nextId)
    return { ...project, id: nextId }
  })

  const rewriteId = (value: string) => idMap.get(value) ?? value

  return {
    ...store,
    projects,
    projectDetails: store.projectDetails.map((detail) => ({ ...detail, projectId: rewriteId(detail.projectId) })),
    projectFindings: store.projectFindings.map((finding) => ({ ...finding, projectId: rewriteId(finding.projectId) })),
    approvals: store.approvals.map((approval) => ({ ...approval, projectId: rewriteId(approval.projectId) })),
    assets: store.assets.map((asset) => ({ ...asset, projectId: rewriteId(asset.projectId) })),
    evidenceRecords: store.evidenceRecords.map((record) => ({ ...record, projectId: rewriteId(record.projectId) })),
    mcpRuns: store.mcpRuns.map((run) => ({ ...run, projectId: rewriteId(run.projectId) })),
    schedulerTasks: store.schedulerTasks.map((task) => ({ ...task, projectId: rewriteId(task.projectId) })),
    orchestratorPlans: Object.fromEntries(Object.entries(store.orchestratorPlans).map(([key, value]) => [rewriteId(key), value])),
    projectFormPresets: Object.fromEntries(Object.entries(store.projectFormPresets).map(([key, value]) => [rewriteId(key), value])),
    mcpServerContracts: store.mcpServerContracts.map((contract) => ({ ...contract, projectId: contract.projectId ? rewriteId(contract.projectId) : undefined })),
    mcpToolContracts: store.mcpToolContracts.map((contract) => ({ ...contract, projectId: contract.projectId ? rewriteId(contract.projectId) : undefined })),
  }
}
```

- [ ] **Step 7: Add migration coverage for legacy non-ASCII project IDs**

Extend `tests/lib/prototype-store.test.ts`:

```ts
expect(migrated.projects[0].id).toMatch(/^proj-\d{8}-[a-f0-9]{8}$/)
expect(migrated.projectDetails[0].projectId).toBe(migrated.projects[0].id)
expect(migrated.assets[0].projectId).toBe(migrated.projects[0].id)
expect(migrated.mcpRuns[0].projectId).toBe(migrated.projects[0].id)
expect(JSON.stringify(migrated)).not.toContain("proj-北栖支付开放暴露面初筛")
```

- [ ] **Step 7.5: Add a post-migration guard sweep for stale legacy IDs**

After the explicit field rewrites, add a recursive guard in `lib/prototype-store.ts`:

```ts
function assertNoLegacyProjectIdsRemain(value: unknown, legacyIds: Set<string>) {
  if (typeof value === "string" && legacyIds.has(value)) {
    throw new Error(`Legacy project id remained after migration: ${value}`)
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => assertNoLegacyProjectIdsRemain(entry, legacyIds))
    return
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((entry) => assertNoLegacyProjectIdsRemain(entry, legacyIds))
  }
}
```

Run it against the migrated store before returning from the migration helper so any missed project-linked record fails fast during development.

- [ ] **Step 8: Wire repository creation to the new ID generator**

Update `lib/project-repository.ts` so:

```ts
import { buildAsciiProjectId } from "@/lib/project-id"

function buildProjectRecord(input: ProjectMutationInput, existingProjects: ProjectRecord[]): ProjectRecord {
  const timestamp = formatTimestamp()

  return {
    id: buildAsciiProjectId(input.name),
    code: buildProjectCode(existingProjects),
    // existing fields...
  }
}
```

- [ ] **Step 9: Re-run the focused project creation and migration tests**

Run:
- `npx vitest run tests/lib/prototype-store.test.ts`
- `npx vitest run tests/api/project-mutations-api.test.ts`
- `npx vitest run tests/pages/project-mutations-ui.test.tsx`
- `npx playwright test e2e/prototype-smoke.spec.ts --grep "create"`

Expected: PASS, and the browser lands on the newly created detail page instead of `404`.

- [ ] **Step 10: Commit the routing fix**

Run:

```bash
git add lib/project-id.ts lib/project-repository.ts lib/prototype-store.ts tests/lib/prototype-store.test.ts tests/api/project-mutations-api.test.ts tests/pages/project-mutations-ui.test.tsx e2e/prototype-smoke.spec.ts
git commit -m "fix: stabilize project ids for detail routing"
```

## Task 2: Convert the Store to Empty-First Bootstrapping and Purge Seeded Demo Records

**Files:**
- Create: `tests/lib/prototype-store.test.ts`
- Modify: `lib/prototype-store.ts`
- Modify: `lib/prototype-types.ts`
- Modify: `tests/api/project-mutations-api.test.ts`
- Modify: `tests/api/orchestrator-api.test.ts`

- [ ] **Step 1: Write the failing store bootstrap test**

Create `tests/lib/prototype-store.test.ts` with an empty-first assertion:

```ts
const store = readPrototypeStore()

expect(store.projects).toEqual([])
expect(store.assets).toEqual([])
expect(store.evidenceRecords).toEqual([])
expect(store.auditLogs).toEqual([])
```

Add a second migration assertion:

```ts
writePrototypeStore({
  ...legacyStoreWithSeededProjects,
})

const migrated = readPrototypeStore()
expect(migrated.projects.find((project) => project.id === "proj-huayao")).toBeUndefined()
```

- [ ] **Step 2: Run the store test and verify it fails against the current seeded store**

Run: `npx vitest run tests/lib/prototype-store.test.ts`
Expected: FAIL because `buildSeedStore()` still injects seeded demo projects and related records.

- [ ] **Step 3: Replace seed bootstrapping with explicit platform defaults**

Refactor `lib/prototype-store.ts` around:

```ts
function buildInitialStore(): PrototypeStore {
  return {
    version: 8,
    auditLogs: [],
    approvalPolicies: [],
    approvals: [],
    assets: [],
    evidenceRecords: [],
    globalApprovalControl: {
      enabled: true,
      mode: "高风险审批，低风险自动通过",
      autoApproveLowRisk: true,
      description: "默认启用高风险审批。",
      note: "可在系统设置中调整。",
    },
    mcpRuns: [],
    orchestratorPlans: {},
    schedulerTasks: [],
    mcpTools: [],
    projectDetails: [],
    projectFindings: [],
    projectFormPresets: {},
    projects: [],
    scopeRules: [],
    workLogs: [],
    llmProfiles: DEFAULT_LLM_PROFILES,
    mcpServerContracts: [],
    mcpToolContracts: [],
  }
}
```

Define `DEFAULT_LLM_PROFILES` in this same task so the store can build cleanly before Task 4 starts.

- [ ] **Step 4: Add an explicit seeded-data purge migration**

Inside `lib/prototype-store.ts`, add a migration helper like:

```ts
const SEEDED_PROJECT_IDS = new Set(["proj-huayao", "proj-xingtu", "proj-yunlan"])

function purgeSeededBusinessRecords(store: PrototypeStore): PrototypeStore {
  return {
    ...store,
    projects: store.projects.filter((project) => !SEEDED_PROJECT_IDS.has(project.id)),
    projectDetails: store.projectDetails.filter((detail) => !SEEDED_PROJECT_IDS.has(detail.projectId)),
    projectFindings: store.projectFindings.filter((finding) => !SEEDED_PROJECT_IDS.has(finding.projectId)),
    approvals: store.approvals.filter((approval) => !SEEDED_PROJECT_IDS.has(approval.projectId)),
    assets: store.assets.filter((asset) => !SEEDED_PROJECT_IDS.has(asset.projectId)),
    evidenceRecords: store.evidenceRecords.filter((record) => !SEEDED_PROJECT_IDS.has(record.projectId)),
    mcpRuns: store.mcpRuns.filter((run) => !SEEDED_PROJECT_IDS.has(run.projectId)),
    schedulerTasks: store.schedulerTasks.filter((task) => !SEEDED_PROJECT_IDS.has(task.projectId)),
    workLogs: store.workLogs.filter((log) => !SEEDED_PROJECT_NAMES.has(log.projectName ?? "")),
    auditLogs: store.auditLogs.filter((log) => !SEEDED_PROJECT_NAMES.has(log.projectName ?? "")),
  }
}
```

Use a dedicated `SEED_PROJECT_NAMES` set for project-name-based log cleanup where needed.

- [ ] **Step 5: Add the new store fields to the shared types**

Extend `PrototypeStore`-backed types in `lib/prototype-types.ts` with:

```ts
export interface LlmProfileRecord {
  id: "orchestrator" | "reviewer" | "extractor"
  provider: string
  label: string
  apiKey: string
  baseUrl: string
  model: string
  timeoutMs: number
  temperature: number
  enabled: boolean
}
```

Use this in later tasks instead of `LlmSettingRecord`.

- [ ] **Step 6: Update tests that currently depend on seeded projects**

Before any orchestrator or mutation test reads a project, create it first:

```ts
const createResponse = await postProjects(new Request("http://localhost/api/projects", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(baseProjectInput),
}))
const { project } = await createResponse.json()
```

Then replace hard-coded `proj-huayao` references with `project.id`.

- [ ] **Step 7: Re-run the focused persistence tests**

Run:
- `npx vitest run tests/lib/prototype-store.test.ts`
- `npx vitest run tests/api/project-mutations-api.test.ts`
- `npx vitest run tests/api/orchestrator-api.test.ts`

Expected: PASS with no seeded demo project assumptions left in those suites.

- [ ] **Step 8: Commit the empty-first persistence slice**

Run:

```bash
git add lib/prototype-store.ts lib/prototype-types.ts tests/lib/prototype-store.test.ts tests/api/project-mutations-api.test.ts tests/api/orchestrator-api.test.ts
git commit -m "refactor: switch platform store to real data bootstrapping"
```

## Task 3: Move Platform Dictionaries Out of Prototype Data and Add Real Empty States

**Files:**
- Create: `lib/platform-config.ts`
- Create: `tests/helpers/project-fixtures.ts`
- Modify: `lib/prototype-api.ts`
- Modify: `app/(console)/dashboard/page.tsx`
- Modify: `app/(console)/approvals/page.tsx`
- Modify: `app/(console)/assets/page.tsx`
- Modify: `app/(console)/evidence/page.tsx`
- Modify: `app/(console)/projects/[projectId]/operations/page.tsx`
- Modify: `app/(console)/settings/page.tsx`
- Modify: `app/(console)/settings/system-status/page.tsx`
- Modify: `components/settings/settings-subnav.tsx`
- Delete: `lib/prototype-data.ts`
- Modify: `tests/api/settings-api.test.ts`
- Modify: `tests/api/operational-surfaces-api.test.ts`
- Modify: `tests/api/projects-api.test.ts`
- Modify: `tests/api/project-surfaces-api.test.ts`
- Modify: `tests/api/mcp-runs-api.test.ts`
- Modify: `tests/api/mcp-workflow-smoke-api.test.ts`
- Modify: `tests/api/approval-controls-api.test.ts`
- Modify: `tests/lib/mcp-connectors.test.ts`
- Modify: `tests/lib/mcp-scheduler-service.test.ts`
- Modify: `tests/lib/mcp-scheduler-retry.test.ts`
- Modify: `tests/lib/real-web-surface-mcp-connector.test.ts`
- Modify: `tests/pages/approvals-assets-page.test.tsx`
- Modify: `tests/pages/dashboard-page.test.tsx`
- Modify: `tests/pages/evidence-settings-page.test.tsx`
- Modify: `tests/pages/project-detail-page.test.tsx`
- Modify: `tests/pages/projects-page.test.tsx`
- Modify: `tests/projects/project-operations-panel.test.tsx`
- Modify: `tests/projects/project-orchestrator-panel.test.tsx`

- [ ] **Step 1: Write the failing dashboard empty-state expectation**

Update `tests/pages/dashboard-page.test.tsx` to assert:

```ts
expect(screen.getByText("当前还没有真实项目数据")).toBeInTheDocument()
expect(screen.queryByText("华曜科技匿名外网面梳理")).not.toBeInTheDocument()
```

- [ ] **Step 2: Run the dashboard test and verify it fails because demo data is still rendered**

Run: `npx vitest run tests/pages/dashboard-page.test.tsx`
Expected: FAIL because the dashboard still imports and dereferences seeded queue items.

- [ ] **Step 3: Create a dedicated platform dictionary module**

Create `lib/platform-config.ts` and move only stable dictionaries into it:

```ts
export const settingsSections = [
  { title: "MCP 工具管理", href: "/settings/mcp-tools", description: "..." },
  { title: "LLM 设置", href: "/settings/llm", description: "..." },
]

export const mcpCapabilityRecords = [
  { id: "cap-web-surface", name: "Web 页面探测类", defaultRiskLevel: "中", boundary: "外部目标交互", ... },
]
```

Do not move business records such as demo projects, demo approvals, or demo evidence into this file.

- [ ] **Step 4: Update direct imports away from `lib/prototype-data.ts`**

Replace imports in:

```ts
// before
import { settingsSections } from "@/lib/prototype-data"

// after
import { settingsSections } from "@/lib/platform-config"
```

Do the same for capability records and other platform dictionaries.

- [ ] **Step 4.5: Move seeded test fixtures out of runtime code**

Create `tests/helpers/project-fixtures.ts` with explicit test-only builders:

```ts
export const baseProjectInput = {
  name: "测试项目",
  seed: "http://127.0.0.1:3000",
  targetType: "url",
  owner: "测试研究员",
  priority: "中",
  targetSummary: "http://127.0.0.1:3000",
  authorizationSummary: "仅用于自动化测试。",
  scopeSummary: "仅限测试目标。",
  forbiddenActions: "禁止越界。",
  defaultConcurrency: "项目级 1 / 高风险 1",
  rateLimit: "10 req/min",
  timeout: "30s / 1 次重试",
  approvalMode: "高风险逐项审批，低风险自动执行",
  tags: "测试 / 自动化",
  deliveryNotes: "自动化测试创建。",
} as const
```

Use repository or API-driven setup in tests instead of importing business fixtures from runtime code.

- [ ] **Step 5: Make dashboard payloads safe for empty datasets**

Refactor `lib/prototype-api.ts` so `getDashboardPayload()` derives queue cards conditionally:

```ts
const leadProject = projects[0] ?? null

return {
  metrics: buildDashboardMetrics(projects, pendingApprovalCount),
  priorities: buildDashboardPriorities({ projects, approvals, mcpTools }),
  leadProject,
  approvals,
  assets,
  evidence,
  mcpTools,
  projectTasks: deriveDashboardTasks(projects, approvals),
  projects,
}
```

Ensure `buildDashboardPriorities()` returns an empty array when there is no real work.

- [ ] **Step 6: Render explicit empty states in the dashboard page**

Update `app/(console)/dashboard/page.tsx` to gate fake queue cards:

```tsx
if (!leadProject) {
  return (
    <div className="space-y-4">
      <section className="rounded-3xl border ...">
        <h1 className="text-lg font-semibold">当前还没有真实项目数据</h1>
        <p className="text-sm text-slate-600">先创建项目，再让 LLM + MCP 开始沉淀资产、证据和漏洞结果。</p>
        <Button asChild><Link href="/projects/new">新建第一个项目</Link></Button>
      </section>
    </div>
  )
}
```

Also remove any hard-coded project route like:

```tsx
// before
<Link href="/projects/proj-huayao">查看项目回流</Link>

// after
{asset.projectId ? <Link href={`/projects/${asset.projectId}`}>查看项目回流</Link> : null}
```

- [ ] **Step 6.5: Delete the runtime mock dataset file once imports are gone**

Delete `lib/prototype-data.ts` after all runtime and test imports have moved to `lib/platform-config.ts` or `tests/helpers/project-fixtures.ts`.

- [ ] **Step 7: Re-run the UI tests for empty-first behavior**

Run:
- `npx vitest run tests/api/settings-api.test.ts`
- `npx vitest run tests/api/operational-surfaces-api.test.ts`
- `npx vitest run tests/api/projects-api.test.ts`
- `npx vitest run tests/api/project-surfaces-api.test.ts`
- `npx vitest run tests/api/mcp-runs-api.test.ts`
- `npx vitest run tests/api/mcp-workflow-smoke-api.test.ts`
- `npx vitest run tests/api/approval-controls-api.test.ts`
- `npx vitest run tests/lib/mcp-connectors.test.ts`
- `npx vitest run tests/lib/mcp-scheduler-service.test.ts`
- `npx vitest run tests/lib/mcp-scheduler-retry.test.ts`
- `npx vitest run tests/lib/real-web-surface-mcp-connector.test.ts`
- `npx vitest run tests/pages/approvals-assets-page.test.tsx`
- `npx vitest run tests/pages/dashboard-page.test.tsx`
- `npx vitest run tests/pages/evidence-settings-page.test.tsx`
- `npx vitest run tests/pages/project-detail-page.test.tsx`
- `npx vitest run tests/pages/projects-page.test.tsx`
- `npx vitest run tests/projects/project-operations-panel.test.tsx`
- `npx vitest run tests/projects/project-orchestrator-panel.test.tsx`

Expected: PASS with no seeded project assumptions in the dashboard path.

- [ ] **Step 8: Commit the dictionary split and empty-state UI**

Run:

```bash
git add lib/platform-config.ts tests/helpers/project-fixtures.ts lib/prototype-api.ts app/(console)/dashboard/page.tsx app/(console)/approvals/page.tsx app/(console)/assets/page.tsx app/(console)/evidence/page.tsx app/(console)/projects/[projectId]/operations/page.tsx app/(console)/settings/page.tsx app/(console)/settings/system-status/page.tsx components/settings/settings-subnav.tsx tests/api/settings-api.test.ts tests/api/operational-surfaces-api.test.ts tests/api/projects-api.test.ts tests/api/project-surfaces-api.test.ts tests/api/mcp-runs-api.test.ts tests/api/mcp-workflow-smoke-api.test.ts tests/api/approval-controls-api.test.ts tests/lib/mcp-connectors.test.ts tests/lib/mcp-scheduler-service.test.ts tests/lib/mcp-scheduler-retry.test.ts tests/lib/real-web-surface-mcp-connector.test.ts tests/pages/approvals-assets-page.test.tsx tests/pages/dashboard-page.test.tsx tests/pages/evidence-settings-page.test.tsx tests/pages/project-detail-page.test.tsx tests/pages/projects-page.test.tsx tests/projects/project-operations-panel.test.tsx tests/projects/project-orchestrator-panel.test.tsx
git rm lib/prototype-data.ts
git commit -m "refactor: replace demo runtime data with real empty states"
```

## Task 4: Persist Editable LLM Settings and Resolve Providers from Store First

**Files:**
- Create: `lib/llm-settings-repository.ts`
- Create: `lib/llm-settings-write-schema.ts`
- Create: `app/api/settings/llm/route.ts`
- Create: `components/settings/llm-settings-client.tsx`
- Modify: `lib/prototype-store.ts`
- Modify: `lib/prototype-types.ts`
- Modify: `lib/prototype-api.ts`
- Modify: `lib/llm-provider/registry.ts`
- Modify: `app/(console)/settings/llm/page.tsx`
- Modify: `components/settings/llm-settings-panel.tsx`
- Create: `tests/api/llm-settings-api.test.ts`

- [ ] **Step 1: Write the failing API test for persisted LLM settings**

Create `tests/api/llm-settings-api.test.ts`:

```ts
const getResponse = await getLlmSettings()
const getPayload = await getResponse.json()

expect(getPayload.items.find((item: { id: string }) => item.id === "orchestrator")).toBeTruthy()

const patchResponse = await patchLlmSettings(new Request("http://localhost/api/settings/llm", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    items: [
      {
        id: "orchestrator",
        provider: "openai-compatible",
        label: "SiliconFlow Orchestrator",
        apiKey: "sk-test-visible",
        baseUrl: "https://api.siliconflow.cn/v1",
        model: "Pro/deepseek-ai/DeepSeek-V3.2",
        timeoutMs: 15000,
        temperature: 0.2,
        enabled: true,
      },
    ],
  }),
}))

expect((await patchResponse.json()).items[0].apiKey).toBe("sk-test-visible")
```

- [ ] **Step 2: Run the LLM settings API test and verify it fails because the route does not exist**

Run: `npx vitest run tests/api/llm-settings-api.test.ts`
Expected: FAIL because `/api/settings/llm` is not implemented yet.

- [ ] **Step 3: Reuse and expand the store defaults added in Task 2**

In `lib/prototype-store.ts`, confirm the Task 2 defaults remain the single source of truth:

```ts
export const DEFAULT_LLM_PROFILES: LlmProfileRecord[] = [
  {
    id: "orchestrator",
    provider: "openai-compatible",
    label: "Default Orchestrator",
    apiKey: "",
    baseUrl: "",
    model: "",
    timeoutMs: 15000,
    temperature: 0.2,
    enabled: false,
  },
  // reviewer, extractor...
]
```

- [ ] **Step 4: Build a repository and write schema for LLM settings**

Create `lib/llm-settings-write-schema.ts`:

```ts
export const llmProfileSchema = z.object({
  id: z.enum(["orchestrator", "reviewer", "extractor"]),
  provider: z.string().trim().min(1),
  label: z.string().trim().min(1),
  apiKey: z.string(),
  baseUrl: z.string().trim(),
  model: z.string().trim(),
  timeoutMs: z.number().int().min(1000).max(120000),
  temperature: z.number().min(0).max(2),
  enabled: z.boolean(),
})
```

Create `lib/llm-settings-repository.ts` with read/update helpers using `readPrototypeStore()` and `writePrototypeStore()`.

- [ ] **Step 5: Add the API route and prototype API glue**

Implement `app/api/settings/llm/route.ts`:

```ts
export async function GET() {
  return Response.json(getLlmSettingsPayload())
}

export async function PATCH(request: Request) {
  const body = await request.json()
  const parsed = llmSettingsPatchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid llm settings payload" }, { status: 400 })
  }

  return Response.json(updateLlmSettingsPayload(parsed.data))
}
```

- [ ] **Step 6: Resolve the real provider from persisted settings before env fallback**

Update `lib/llm-provider/registry.ts`:

```ts
const orchestrator = getStoredLlmProfile("orchestrator")

if (orchestrator?.enabled && orchestrator.apiKey && orchestrator.baseUrl && orchestrator.model) {
  return createOpenAiCompatibleProvider({
    apiKey: orchestrator.apiKey,
    baseUrl: orchestrator.baseUrl,
    orchestratorModel: orchestrator.model,
    reviewerModel: getStoredLlmProfile("reviewer")?.model ?? orchestrator.model,
    timeoutMs: orchestrator.timeoutMs,
  })
}

// env fallback remains below
```

- [ ] **Step 7: Replace the read-only page with an editable client form**

Create `components/settings/llm-settings-client.tsx` with controlled inputs for:

```tsx
<Input value={profile.label} />
<Input value={profile.apiKey} type="text" />
<Input value={profile.baseUrl} />
<Input value={profile.model} />
<Input value={String(profile.timeoutMs)} />
<Input value={String(profile.temperature)} />
<Switch checked={profile.enabled} />
```

Update `app/(console)/settings/llm/page.tsx` to fetch real API data and render the client editor.

- [ ] **Step 8: Re-run the focused LLM settings tests**

Run:
- `npx vitest run tests/api/llm-settings-api.test.ts`
- `npx vitest run tests/lib/llm-provider.test.ts`
- `npx vitest run tests/pages/evidence-settings-page.test.tsx`

Expected: PASS, and the orchestrator path can consume store-backed settings.

- [ ] **Step 9: Commit the LLM settings slice**

Run:

```bash
git add lib/llm-settings-repository.ts lib/llm-settings-write-schema.ts app/api/settings/llm/route.ts components/settings/llm-settings-client.tsx app/(console)/settings/llm/page.tsx components/settings/llm-settings-panel.tsx lib/prototype-store.ts lib/prototype-types.ts lib/prototype-api.ts lib/llm-provider/registry.ts tests/api/llm-settings-api.test.ts
git commit -m "feat: persist editable llm settings"
```

## Task 5: Enforce a Strict MCP Registration Contract

**Files:**
- Create: `docs/contracts/mcp-server-contract.md`
- Create: `lib/mcp-registration-schema.ts`
- Create: `app/api/settings/mcp-servers/register/route.ts`
- Modify: `lib/mcp-server-sqlite.ts`
- Modify: `lib/mcp-server-repository.ts`
- Modify: `lib/prototype-types.ts`
- Modify: `lib/prototype-api.ts`
- Modify: `components/settings/mcp-gateway-client.tsx`
- Modify: `tests/settings/mcp-gateway-client.test.tsx`
- Create: `tests/api/mcp-registration-api.test.ts`

- [ ] **Step 1: Write the failing MCP registration API test**

Create `tests/api/mcp-registration-api.test.ts` with one success and multiple failure cases:

```ts
const validPayload = {
  serverName: "web-surface-stdio-custom",
  version: "1.0.0",
  transport: "stdio",
  command: "node",
  args: ["scripts/mcp/web-surface-server.mjs"],
  enabled: true,
  tools: [
    {
      toolName: "web-surface-map",
      title: "Web Surface Map",
      description: "Probe web titles, status codes, and headers.",
      capability: "Web 页面探测类",
      boundary: "外部目标交互",
      riskLevel: "中",
      requiresApproval: false,
      inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
      outputSchema: { type: "object", properties: { webEntries: { type: "array" } } },
      defaultConcurrency: "2",
      rateLimit: "20 req/min",
      timeout: "30s",
      retry: "1 次",
      resultMappings: ["webEntries", "evidence"],
    },
  ],
}
```

Add negative assertions for all required contract failures:

```ts
expect(missingInputSchemaPayload.error).toContain("inputSchema")
expect(missingOutputSchemaPayload.error).toContain("outputSchema")
expect(stdioMissingCommandPayload.error).toContain("command")
expect(stdioMissingArgsPayload.error).toContain("args")
expect(remoteMissingEndpointPayload.error).toContain("endpoint")
expect(remoteWithCommandPayload.error).toContain("endpoint")
expect(invalidCapabilityPayload.error).toContain("capability")
expect(invalidBoundaryPayload.error).toContain("boundary")
expect(invalidRiskPayload.error).toContain("riskLevel")
```

- [ ] **Step 2: Run the MCP registration test and verify it fails because the route does not exist**

Run: `npx vitest run tests/api/mcp-registration-api.test.ts`
Expected: FAIL because the registration route and validation schema are missing.

- [ ] **Step 3: Document the contract in a first-class doc**

Create `docs/contracts/mcp-server-contract.md` with sections for:

```md
## Server Fields
## Tool Fields
## Transport Rules
## Schema Rules
## Result Mapping Rules
## Registration Examples
```

Document that `inputSchema` and `outputSchema` are required, matching the platform's MCP expectations.

- [ ] **Step 4: Add Zod-backed registration schemas**

Create `lib/mcp-registration-schema.ts`:

```ts
const jsonSchemaObject = z.object({
  type: z.string(),
}).passthrough()

export const mcpToolRegistrationSchema = z.object({
  toolName: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  capability: z.enum(MCP_CAPABILITY_NAMES),
  boundary: z.enum(["外部目标交互", "平台内部处理"]),
  riskLevel: z.enum(["高", "中", "低"]),
  requiresApproval: z.boolean(),
  inputSchema: jsonSchemaObject,
  outputSchema: jsonSchemaObject,
  defaultConcurrency: z.string().trim().min(1),
  rateLimit: z.string().trim().min(1),
  timeout: z.string().trim().min(1),
  retry: z.string().trim().min(1),
  resultMappings: z.array(z.enum(["domains", "webEntries", "network", "findings", "evidence", "workLogs"])).min(1),
})

export const mcpServerRegistrationSchema = z.object({
  serverName: z.string().trim().min(1),
  version: z.string().trim().min(1),
  transport: z.enum(["stdio", "streamable_http", "sse"]),
  command: z.string().trim().optional(),
  args: z.array(z.string()).optional(),
  endpoint: z.string().trim().optional(),
  enabled: z.boolean(),
  tools: z.array(mcpToolRegistrationSchema).min(1),
}).superRefine((value, context) => {
  if (value.transport === "stdio") {
    if (!value.command) {
      context.addIssue({ code: "custom", message: "stdio transport requires command", path: ["command"] })
    }
    if (!value.args) {
      context.addIssue({ code: "custom", message: "stdio transport requires args", path: ["args"] })
    }
    if (value.endpoint) {
      context.addIssue({ code: "custom", message: "stdio transport must not define endpoint", path: ["endpoint"] })
    }
    return
  }

  if (!value.endpoint) {
    context.addIssue({ code: "custom", message: "remote transport requires endpoint", path: ["endpoint"] })
  }

  if (value.command || value.args) {
    context.addIssue({ code: "custom", message: "remote transport must not define command or args", path: ["endpoint"] })
  }
})
```

- [ ] **Step 5: Extend SQLite persistence for registered MCP contracts**

Add a new table in `lib/mcp-server-sqlite.ts`:

```sql
CREATE TABLE IF NOT EXISTS mcp_server_tool_contracts (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  version TEXT NOT NULL,
  contract_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (server_id) REFERENCES mcp_servers(id)
) STRICT;
```

Persist the validated contract JSON for each registered tool.

- [ ] **Step 5.5: Mirror MCP contract summaries into the JSON store**

Extend `PrototypeStore` and its defaults with:

```ts
mcpServerContracts: []
mcpToolContracts: []
```

Persist normalized summaries there as well so the empty-first store matches the spec and the UI can render registered contracts without opening SQLite directly.

- [ ] **Step 6: Add the registration API**

Implement `app/api/settings/mcp-servers/register/route.ts`:

```ts
export async function POST(request: Request) {
  const body = await request.json()
  const parsed = mcpServerRegistrationSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid MCP registration payload" }, { status: 400 })
  }

  return Response.json(registerStoredMcpServer(parsed.data), { status: 201 })
}
```

- [ ] **Step 7: Add a minimal registration UI block**

In `components/settings/mcp-gateway-client.tsx`, add a small registration form or JSON import textarea that POSTs to the new API and surfaces validation errors inline.

Use a focused success message:

```ts
setMessage(`MCP server ${payload.server.serverName} 已完成契约校验并注册。`)
```

- [ ] **Step 8: Re-run the focused MCP contract tests**

Run:
- `npx vitest run tests/api/mcp-registration-api.test.ts`
- `npx vitest run tests/settings/mcp-gateway-client.test.tsx`
- `npx vitest run tests/lib/mcp-server-repository.test.ts`

Expected: PASS, with invalid contract payloads rejected before registration.

- [ ] **Step 9: Commit the MCP contract enforcement slice**

Run:

```bash
git add docs/contracts/mcp-server-contract.md lib/mcp-registration-schema.ts app/api/settings/mcp-servers/register/route.ts lib/mcp-server-sqlite.ts lib/mcp-server-repository.ts lib/prototype-types.ts lib/prototype-api.ts components/settings/mcp-gateway-client.tsx tests/api/mcp-registration-api.test.ts tests/settings/mcp-gateway-client.test.tsx
git commit -m "feat: enforce validated mcp registration contracts"
```

## Task 6: Make Live Validation Create a Real Project and Persist a Browsable Closure

**Files:**
- Create: `lib/live-validation-project-service.ts`
- Modify: `scripts/run-live-validation.mjs`
- Modify: `scripts/lib/live-validation-report.mjs`
- Modify: `tests/api/orchestrator-api.test.ts`
- Modify: `e2e/prototype-smoke.spec.ts`
- Modify: `lib/orchestrator-service.ts`

- [ ] **Step 1: Write the failing orchestrator test against a newly created project**

In `tests/api/orchestrator-api.test.ts`, replace hard-coded demo IDs with a created project:

```ts
const createResponse = await postProjects(new Request("http://localhost/api/projects", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(baseProjectInput),
}))
const { project } = await createResponse.json()

const validationResponse = await postLocalValidation(
  new Request(`http://localhost/api/projects/${project.id}/orchestrator/local-validation`, { ... }),
  buildProjectContext(project.id),
)
```

Assert that the same project accumulates assets, evidence, and findings.

- [ ] **Step 2: Run the focused orchestrator test and verify it fails on missing created-project flow**

Run: `npx vitest run tests/api/orchestrator-api.test.ts`
Expected: FAIL because current tests and runner still assume a seeded project.

- [ ] **Step 3: Add a helper that creates a local-lab project payload**

Create `lib/live-validation-project-service.ts`:

```ts
export function buildLocalLabProjectInput(lab: LocalLabRecord): ProjectMutationInput {
  return {
    name: `本地靶场 · ${lab.name} 自动验证`,
    seed: lab.baseUrl,
    targetType: "url",
    owner: "本地验证运行器",
    priority: "中",
    targetSummary: `${lab.baseUrl} / ${lab.name}`,
    authorizationSummary: "仅针对本地 Docker 靶场执行验证。",
    scopeSummary: `仅限 ${lab.baseUrl}`,
    forbiddenActions: "禁止将本地靶场动作扩展到外部目标。",
    defaultConcurrency: "项目级 2 / 高风险 1",
    rateLimit: "被动 30 req/min / 验证 5 req/min",
    timeout: "30s / 1 次重试",
    approvalMode: "高风险逐项审批，低风险自动执行",
    tags: "本地靶场 / 自动验证",
    deliveryNotes: "由 live validation runner 自动创建。",
  }
}
```

- [ ] **Step 4: Refactor the runner to create a project before orchestration**

Update `scripts/run-live-validation.mjs` so it:

```js
const createdProject = await requestJson(`${baseUrl}/api/projects`, {
  method: "POST",
  cookie,
  body: buildLocalLabProjectInput(localLab),
})

const projectId = createdProject.payload.project.id
```

Then use `projectId` for plan, validation, context, operations, and MCP run lookups.

- [ ] **Step 5: Make the report artifacts include the created project identity**

Update `scripts/lib/live-validation-report.mjs` and the runner payload:

```js
project: {
  id: contextResult.payload.project.id,
  name: contextResult.payload.project.name,
  createdFromRunner: true,
}
```

- [ ] **Step 6: Add an E2E smoke path for the real created project**

In `e2e/prototype-smoke.spec.ts`, add a browser flow that:

```ts
await loginAsResearcher(page)
await page.goto("/projects/new")
await page.getByRole("button", { name: "创建项目" }).click()
await page.getByRole("link", { name: "任务与调度详情" }).click()
```

Keep the E2E lightweight: prove that a real newly created project can access operations and results subroutes without relying on seeded projects.

- [ ] **Step 7: Re-run the focused local validation and browser tests**

Run:
- `npx vitest run tests/api/orchestrator-api.test.ts`
- `npx playwright test e2e/prototype-smoke.spec.ts`

Expected: PASS, with no dependency on seeded project IDs.

- [ ] **Step 8: Execute one real live validation against Juice Shop**

Run with the user-provided real provider values available in the environment:

```bash
$env:LLM_API_KEY="..."
$env:LLM_BASE_URL="https://api.siliconflow.cn/v1"
$env:LLM_ORCHESTRATOR_MODEL="Pro/deepseek-ai/DeepSeek-V3.2"
npm run live:validate
```

Expected: a newly created Juice Shop validation project is visible in the app store, and `output/live-validation/` also contains matching artifacts.

- [ ] **Step 9: Commit the live project-closure slice**

Run:

```bash
git add lib/live-validation-project-service.ts scripts/run-live-validation.mjs scripts/lib/live-validation-report.mjs tests/api/orchestrator-api.test.ts e2e/prototype-smoke.spec.ts lib/orchestrator-service.ts
git commit -m "feat: persist live validation runs as real projects"
```

## Task 7: Update Docs, Indexes, and Run Full Verification

**Files:**
- Modify: `code_index.md`
- Modify: `roadmap.md`
- Modify: any touched docs under `docs/operations/` if behavior changed materially

- [ ] **Step 1: Update the code index to reflect the new real-data architecture**

Revise:

```md
- `lib/prototype-store.ts`
  Empty-first runtime persistence with seeded demo-data purge and persisted LLM profiles.
- `lib/platform-config.ts`
  Platform dictionaries only; no business records.
- `app/api/settings/llm/route.ts`
  Editable LLM settings API.
- `app/api/settings/mcp-servers/register/route.ts`
  Strict MCP contract registration API.
```

- [ ] **Step 2: Update the roadmap to mark this slice and the next phase**

Add a new roadmap entry describing:

```md
- Status: In progress on `codex/real-data-platform-hardening-2026-03-27`
- Goal: remove prototype business seeds, add strict MCP registration, persisted LLM settings, and real project closure for local validation
```

- [ ] **Step 3: Run lint and production build after all feature tasks are complete**

Run:
- `npm run lint`
- `npm run build`

Expected: PASS with no new build-time or lint-time failures.

- [ ] **Step 4: Run the full automated verification suite**

Run:
- `npm test`
- `npm run e2e`
- `npm run live:validate`

Expected: PASS, plus a real Juice Shop validation project visible in the active store.

- [ ] **Step 5: Capture final git status and verification notes**

Run:

```bash
git status --short
git log --oneline -5
```

Expected: clean working tree after any final doc/test adjustments.

- [ ] **Step 6: Commit the documentation and verification pass**

Run:

```bash
git add code_index.md roadmap.md
git commit -m "docs: refresh roadmap and code index for real data platform slice"
```
