# Tab 重构 + 术语清理 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将项目详情页 8 Tab 重构为 7 Tab（概览/域名/站点/端口/漏洞/执行控制/AI日志），Tab 数据改为实时查询，并清理全站模糊术语。

**Architecture:** 三层变更：(1) 类型层改 scopeStatus/ProjectStatus 值 → 全量 replace_all；(2) 页面层改 Tab 结构 + 数据源从 JSON 缓存改实时 DB 查询；(3) 文案层批量替换面向用户的模糊术语。

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma 7.x, Tailwind CSS, Vitest

**Spec:** `docs/superpowers/specs/2026-03-31-tab-restructure-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/types/asset.ts` | Modify | scopeStatus 类型值：已纳入→已确认, 待确认→待验证, 待复核→需人工判断 |
| `lib/types/project.ts` | Modify | ProjectStatus 值：待处理→待启动, 已阻塞→等待审批 |
| `prisma/schema.prisma` | Modify | Asset.scopeStatus 默认值改为 "待验证" |
| `lib/asset-repository.ts` | Modify | 增加 `listStoredAssetsByType()` 按类型过滤查询 |
| `components/projects/project-workspace-nav.tsx` | Modify | 8 Tab → 7 Tab，更新标签和路由 |
| `app/(console)/projects/[projectId]/results/domains/page.tsx` | Rewrite | 域名专用表格，实时查询 |
| `app/(console)/projects/[projectId]/results/sites/page.tsx` | Create | 站点 Tab 页面 |
| `app/(console)/projects/[projectId]/results/network/page.tsx` | Rewrite | 端口专用表格（Nmap 风格），实时查询 |
| `components/projects/project-results-hub.tsx` | Rewrite | 3 卡片（域名/站点/端口），实时计数 |
| `components/projects/project-summary.tsx` | Modify | 统计卡片标签 + 路由更新 |
| `lib/results/project-results-core.ts` | Modify | buildResultMetrics 标签更新，buildAssetGroups 删除，scopeTone 更新 |
| `app/(console)/projects/[projectId]/context/` | Delete | "上下文" Tab 删除 |
| `app/(console)/projects/[projectId]/flow/` | Delete | "阶段" Tab 删除 |
| `components/projects/project-knowledge-tabs.tsx` | Delete | 仅被 context 使用 |
| `components/projects/project-stage-flow.tsx` | Delete | 仅被 flow 使用 |
| 27 个文件 (scopeStatus) | Modify | 全局 replace: 已纳入→已确认, 待确认→待验证, 待复核→需人工判断 |
| 22 个文件 (ProjectStatus) | Modify | 全局 replace: 待处理→待启动, 已阻塞→等待审批 |
| 多个 UI 组件 | Modify | 文案：编排→AI 规划, 调度→执行控制, MCP 工具→探测工具, 收束→自动收尾, 情报→信息 |
| E2E + 单元测试 | Modify | 断言中的状态值和文案更新 |

---

### Task 1: 类型定义 — scopeStatus 值更新

**Files:**
- Modify: `lib/types/asset.ts:23` (AssetRecord.scopeStatus)
- Modify: `lib/types/asset.ts:13` (AssetRelation.scopeStatus)

- [ ] **Step 1: 更新 AssetRecord.scopeStatus 类型**

In `lib/types/asset.ts`, line 23, replace:
```typescript
scopeStatus: "已纳入" | "待确认" | "待复核"
```
with:
```typescript
scopeStatus: "已确认" | "待验证" | "需人工判断"
```

Do the same at line 13 for `AssetRelation.scopeStatus`.

- [ ] **Step 2: 全局替换 scopeStatus 值**

Using editor replace-all across all `.ts` and `.tsx` files:
```
"已纳入" → "已确认"       (asset scope context only)
"待确认" → "待验证"       (asset scope context only)
"待复核" → "需人工判断"    (asset scope context only)
```

**Important:** "待确认" also appears as an approval-related text in some contexts. Only replace occurrences that are asset `scopeStatus` values. Verify by checking surrounding context.

Key files with scopeStatus occurrences:
- `lib/mcp-execution-service.ts` (41 occurrences — bulk of them)
- `lib/prototype-data.ts` (27 occurrences — seed data)
- `components/assets/*.tsx` (multiple)
- `lib/results/project-results-core.ts`
- `lib/compositions/dashboard-compositions.ts`
- `prisma/seed.ts`
- `tests/lib/dashboard-assets-payload.test.ts`

- [ ] **Step 3: 更新 Prisma schema 默认值**

In `prisma/schema.prisma`, line 177, replace:
```prisma
scopeStatus       String   @default("待确认")
```
with:
```prisma
scopeStatus       String   @default("待验证")
```

- [ ] **Step 4: 生成 Prisma migration**

Run:
```bash
npx prisma migrate dev --name rename-scope-status-defaults
```

- [ ] **Step 5: 验证编译通过**

Run:
```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: rename scopeStatus values — 已纳入→已确认, 待确认→待验证, 待复核→需人工判断"
```

---

### Task 2: 类型定义 — ProjectStatus 值更新

**Files:**
- Modify: `lib/types/project.ts:16`

- [ ] **Step 1: 更新 ProjectStatus 类型**

In `lib/types/project.ts`, line 16, replace:
```typescript
export type ProjectStatus = "运行中" | "待处理" | "已暂停" | "已停止" | "已阻塞" | "已完成"
```
with:
```typescript
export type ProjectStatus = "运行中" | "待启动" | "已暂停" | "已停止" | "等待审批" | "已完成"
```

- [ ] **Step 2: 全局替换 ProjectStatus 值**

Using editor replace-all across all `.ts` and `.tsx` files:
```
"待处理" → "待启动"       (project status context only)
"已阻塞" → "等待审批"     (project status context only)
```

**Important:** "待处理" also appears as an approval status value (`ApprovalRecord.status`). Do NOT replace those. Only replace occurrences tied to `project.status` or `ProjectStatus`.

Key files: `lib/gateway/mcp-dispatch-service.ts` (6), `lib/results/project-results-core.ts` (7), `lib/compositions/dashboard-compositions.ts` (6), `lib/prototype-data.ts` (7), `lib/orchestrator-execution.ts` (5).

- [ ] **Step 3: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: rename ProjectStatus values — 待处理→待启动, 已阻塞→等待审批"
```

---

### Task 3: 资产查询层 — 按类型过滤

**Files:**
- Modify: `lib/asset-repository.ts`

- [ ] **Step 1: 添加按类型列表查询函数**

在 `lib/asset-repository.ts` 中，`listStoredAssets` 函数后新增：

```typescript
export async function listStoredAssetsByTypes(projectId: string, types: string[]) {
  const rows = await prisma.asset.findMany({
    where: { projectId, type: { in: types } },
    orderBy: { lastSeen: "desc" },
  })
  return rows.map(toAssetRecord)
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/asset-repository.ts
git commit -m "feat: add listStoredAssetsByTypes for filtered asset queries"
```

---

### Task 4: Tab 导航重构

**Files:**
- Modify: `components/projects/project-workspace-nav.tsx`

- [ ] **Step 1: 更新 tabs 数组**

Replace the entire `tabs` array (lines 13-22) with:

```typescript
const tabs = [
  { href: "", label: "概览", icon: null },
  { href: "/results/domains", label: "域名", icon: Globe },
  { href: "/results/sites", label: "站点", icon: Globe },
  { href: "/results/network", label: "端口", icon: Network },
  { href: "/results/findings", label: "漏洞", icon: ShieldAlert },
  { href: "/operations", label: "执行控制", icon: Settings2 },
  { href: "/ai-logs", label: "AI 日志", icon: BrainCircuit },
]
```

- [ ] **Step 2: 清理未使用的 icon imports**

Update the import line (line 5):
```typescript
import { Globe, Network, ShieldAlert, Settings2, BrainCircuit } from "lucide-react"
```

Remove `FileText` and `GitBranch` (were used by deleted "上下文" and "阶段" tabs).

- [ ] **Step 3: Commit**

```bash
git add components/projects/project-workspace-nav.tsx
git commit -m "refactor: restructure project tabs — 8→7, remove context/flow, rename labels"
```

---

### Task 5: 域名页面重写 — 实时查询

**Files:**
- Rewrite: `app/(console)/projects/[projectId]/results/domains/page.tsx`

- [ ] **Step 1: 重写域名页面**

Replace entire file content with:

```typescript
import Link from "next/link"
import { notFound } from "next/navigation"
import { Globe } from "lucide-react"

import { ProjectWorkspaceIntro } from "@/components/projects/project-workspace-intro"
import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { getStoredProjectById } from "@/lib/project-repository"
import { listStoredAssetsByTypes } from "@/lib/asset-repository"

export default async function ProjectDomainsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = await getStoredProjectById(projectId)

  if (!project) {
    notFound()
  }

  const assets = await listStoredAssetsByTypes(projectId, ["domain", "subdomain"])
  const hasOnlyIpTargets = project.targets.every((t) => /^\d{1,3}(\.\d{1,3}){3}/.test(t))

  return (
    <div className="space-y-5">
      <ProjectWorkspaceIntro
        title="域名"
        description="项目范围内发现的域名和子域名，以及对应的解析 IP。"
        actions={
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href={`/projects/${project.id}`}>返回概览</Link>
          </Button>
        }
      />

      <SectionCard title="域名资产" description="DNS 层发现的域名和子域名列表。">
        {assets.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <Globe className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </EmptyMedia>
              <EmptyTitle>暂无域名资产</EmptyTitle>
              <EmptyDescription>
                {hasOnlyIpTargets
                  ? "当前目标为 IP 地址，无域名资产。可在端口 Tab 查看网络层探测结果。"
                  : "项目启动后，探测工具会自动发现域名和子域名。"}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">域名</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">类型</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">解析 IP</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">来源</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">状态</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id} className="border-b border-slate-100 dark:border-slate-800/60">
                    <td className="px-3 py-2.5 font-medium text-slate-950 dark:text-white">
                      <Link href={`/assets/${asset.id}`} className="hover:underline">{asset.label}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {asset.type === "domain" ? "主域名" : "子域名"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-300">{asset.host || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{asset.ownership || "—"}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge tone={asset.scopeStatus === "已确认" ? "success" : asset.scopeStatus === "待验证" ? "warning" : "info"}>
                        {asset.scopeStatus}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(console)/projects/[projectId]/results/domains/page.tsx
git commit -m "feat: rewrite domains page — direct DB query, domain-specific table"
```

---

### Task 6: 新建站点页面

**Files:**
- Create: `app/(console)/projects/[projectId]/results/sites/page.tsx`

- [ ] **Step 1: 创建站点页面**

```typescript
import Link from "next/link"
import { notFound } from "next/navigation"
import { Globe } from "lucide-react"

import { ProjectWorkspaceIntro } from "@/components/projects/project-workspace-intro"
import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { getStoredProjectById } from "@/lib/project-repository"
import { listStoredAssetsByTypes } from "@/lib/asset-repository"

export default async function ProjectSitesPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = await getStoredProjectById(projectId)

  if (!project) {
    notFound()
  }

  const assets = await listStoredAssetsByTypes(projectId, ["entry", "web", "api"])

  return (
    <div className="space-y-5">
      <ProjectWorkspaceIntro
        title="站点"
        description="项目范围内发现的 Web 站点、API 端点和页面入口。"
        actions={
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href={`/projects/${project.id}`}>返回概览</Link>
          </Button>
        }
      />

      <SectionCard title="站点资产" description="HTTP 应用层发现的 Web 服务列表。">
        {assets.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <Globe className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </EmptyMedia>
              <EmptyTitle>暂未发现 Web 站点</EmptyTitle>
              <EmptyDescription>项目启动后，探测工具会自动识别 HTTP 服务。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">URL</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">标题</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">状态码</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">服务器 / 组件</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">状态</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => {
                  const title = extractField(asset.profile, "标题") || extractField(asset.profile, "title") || "—"
                  const statusCode = extractField(asset.exposure, "状态码") || extractField(asset.exposure, "status") || "—"
                  const server = extractField(asset.profile, "服务器") || extractField(asset.profile, "server") || "—"

                  return (
                    <tr key={asset.id} className="border-b border-slate-100 dark:border-slate-800/60">
                      <td className="max-w-xs truncate px-3 py-2.5 font-mono text-xs text-slate-950 dark:text-white">
                        <Link href={`/assets/${asset.id}`} className="hover:underline">{asset.label}</Link>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{title}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-300">{statusCode}</td>
                      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{server}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge tone={asset.scopeStatus === "已确认" ? "success" : asset.scopeStatus === "待验证" ? "warning" : "info"}>
                          {asset.scopeStatus}
                        </StatusBadge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function extractField(text: string, key: string): string | null {
  const regex = new RegExp(`${key}[：:]\\s*(.+?)(?:[。；,，]|$)`)
  const match = text.match(regex)
  return match?.[1]?.trim() || null
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(console)/projects/[projectId]/results/sites/page.tsx"
git commit -m "feat: add sites tab page — web entry assets with URL/title/status columns"
```

---

### Task 7: 端口页面重写 — Nmap 风格

**Files:**
- Rewrite: `app/(console)/projects/[projectId]/results/network/page.tsx`

- [ ] **Step 1: 重写端口页面**

Replace entire file with:

```typescript
import Link from "next/link"
import { notFound } from "next/navigation"
import { Network } from "lucide-react"

import { ProjectWorkspaceIntro } from "@/components/projects/project-workspace-intro"
import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { getStoredProjectById } from "@/lib/project-repository"
import { listStoredAssetsByTypes } from "@/lib/asset-repository"

export default async function ProjectPortsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = await getStoredProjectById(projectId)

  if (!project) {
    notFound()
  }

  const assets = await listStoredAssetsByTypes(projectId, ["host", "ip", "port", "service"])

  return (
    <div className="space-y-5">
      <ProjectWorkspaceIntro
        title="端口"
        description="目标 IP 的开放端口、运行协议和服务识别结果。"
        actions={
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href={`/projects/${project.id}`}>返回概览</Link>
          </Button>
        }
      />

      <SectionCard title="端口资产" description="网络层探测发现的 IP、端口和服务列表。">
        {assets.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <Network className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </EmptyMedia>
              <EmptyTitle>暂未发现开放端口</EmptyTitle>
              <EmptyDescription>项目启动后，探测工具会自动扫描目标端口。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">IP</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">端口</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">协议</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">服务</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">产品 / 版本</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">状态</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => {
                  const portMatch = asset.label.match(/:(\d+)$/)
                  const port = portMatch ? portMatch[1] : (asset.type === "port" ? asset.label : "—")
                  const protocol = asset.exposure.includes("UDP") ? "UDP" : "TCP"
                  const service = extractService(asset.profile, asset.exposure)
                  const product = extractProduct(asset.profile)

                  return (
                    <tr key={asset.id} className="border-b border-slate-100 dark:border-slate-800/60">
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-950 dark:text-white">
                        <Link href={`/assets/${asset.id}`} className="hover:underline">{asset.host || asset.label}</Link>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-300">{port}</td>
                      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{protocol}</td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{service}</td>
                      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{product}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge tone={asset.scopeStatus === "已确认" ? "success" : asset.scopeStatus === "待验证" ? "warning" : "info"}>
                          {asset.scopeStatus}
                        </StatusBadge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function extractService(profile: string, exposure: string): string {
  const combined = `${profile} ${exposure}`
  const serviceMatch = combined.match(/(?:服务|service)[：:]\s*(\S+)/i)
  if (serviceMatch) return serviceMatch[1]
  for (const svc of ["ssh", "http", "https", "mysql", "mongodb", "redis", "ftp", "smtp", "dns", "telnet", "postgresql"]) {
    if (combined.toLowerCase().includes(svc)) return svc
  }
  return "—"
}

function extractProduct(profile: string): string {
  if (!profile || profile === "—") return "—"
  return profile.length > 60 ? profile.slice(0, 60) + "..." : profile
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(console)/projects/[projectId]/results/network/page.tsx"
git commit -m "feat: rewrite ports page — Nmap-style IP/port/protocol/service table"
```

---

### Task 8: 概览页入口卡片 + 统计指标更新

**Files:**
- Rewrite: `components/projects/project-results-hub.tsx`
- Modify: `components/projects/project-summary.tsx:200-210`
- Modify: `lib/results/project-results-core.ts` (buildResultMetrics, buildAssetGroups, scopeTone)

- [ ] **Step 1: 重写 project-results-hub.tsx**

Replace entire file:

```typescript
import Link from "next/link"
import { ArrowRight, Globe, Network, ShieldAlert } from "lucide-react"

import type { AssetRecord, ProjectDetailRecord, ProjectRecord } from "@/lib/prototype-types"

const resultSections = [
  { key: "domains" as const, title: "域名", icon: Globe, types: ["domain", "subdomain"] },
  { key: "sites" as const, title: "站点", icon: Globe, types: ["entry", "web", "api"] },
  { key: "network" as const, title: "端口", icon: Network, types: ["host", "ip", "port", "service"] },
  { key: "findings" as const, title: "漏洞", icon: ShieldAlert, types: null },
]

export function ProjectResultsHub({
  project,
  detail,
  assets,
}: {
  project: ProjectRecord
  detail: ProjectDetailRecord
  assets: AssetRecord[]
}) {
  const counts: Record<string, number> = {
    domains: assets.filter((a) => ["domain", "subdomain"].includes(a.type)).length,
    sites: assets.filter((a) => ["entry", "web", "api"].includes(a.type)).length,
    network: assets.filter((a) => ["host", "ip", "port", "service"].includes(a.type)).length,
    findings: detail.findings.length,
  }

  return (
    <div className="grid gap-3 md:grid-cols-4">
      {resultSections.map((section) => {
        const count = counts[section.key]
        const Icon = section.icon
        return (
          <Link
            key={section.key}
            href={`/projects/${project.id}/results/${section.key}`}
            className="group flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 dark:hover:bg-slate-900/60"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-950 dark:text-white">{section.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {count > 0 ? `${count} 条记录` : "暂无数据"}
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: 更新 project detail page 传入 assets prop**

In `app/(console)/projects/[projectId]/page.tsx`, add assets import and pass to hub:

```typescript
import { listStoredAssets } from "@/lib/asset-repository"

// Inside the component, after getting project and detail:
const assets = await listStoredAssets(projectId)

// Pass to hub:
<ProjectResultsHub project={project} detail={detail} assets={assets} />
```

- [ ] **Step 3: 更新 project-summary.tsx hrefMap**

In `components/projects/project-summary.tsx`, replace the hrefMap (lines 202-207):

```typescript
const hrefMap: Record<string, string> = {
  "域名": `/projects/${project.id}/results/domains`,
  "站点": `/projects/${project.id}/results/sites`,
  "开放端口": `/projects/${project.id}/results/network`,
  "漏洞线索": `/projects/${project.id}/results/findings`,
}
```

- [ ] **Step 4: 更新 buildResultMetrics**

In `lib/results/project-results-core.ts`, update `buildResultMetrics()` (lines 121-156):

Replace `"已纳入域名"` with `"域名"`, update note text.
Replace `"证据锚点"` metric with `"站点"` metric.
Update `"开放端口"` note text from "网络侧开放端口与服务画像已入库" to "已发现开放端口和运行服务".
Update the function to accept sites count as parameter.

```typescript
function buildResultMetrics(
  domainAssets: AssetRecord[],
  siteAssets: AssetRecord[],
  networkAssets: AssetRecord[],
  findings: ProjectFindingRecord[],
): ProjectResultMetric[] {
  const openPortCount = networkAssets.filter((asset) => asset.type === "port").length
  const highRiskCount = findings.filter((finding) => finding.severity === "高危").length

  return [
    {
      label: "域名",
      value: String(domainAssets.length),
      note: domainAssets.length > 0 ? "已发现域名和子域名资产。" : "等待识别",
      tone: domainAssets.length > 0 ? "success" : "neutral",
    },
    {
      label: "站点",
      value: String(siteAssets.length),
      note: siteAssets.length > 0 ? "已发现 Web 站点和 API 端点。" : "等待识别",
      tone: siteAssets.length > 0 ? "info" : "neutral",
    },
    {
      label: "开放端口",
      value: String(openPortCount),
      note: openPortCount > 0 ? "已发现开放端口和运行服务。" : "等待识别",
      tone: openPortCount > 0 ? "info" : "neutral",
    },
    {
      label: "漏洞线索",
      value: String(findings.length),
      note: findings.length > 0 ? `${highRiskCount} 条高危结果。` : "等待验证",
      tone: findings.length > 0 ? "warning" : "neutral",
    },
  ]
}
```

- [ ] **Step 5: 更新 refreshStoredProjectResults 中的调用**

In `lib/results/project-results-core.ts`, update the call site (around line 550):

Add site assets filtering:
```typescript
const siteAssets = projectAssets.filter((a) => ["entry", "web", "api"].includes(a.type))
```

Update the call:
```typescript
resultMetrics: buildResultMetrics(domainAssets, siteAssets, networkAssets, projectFindings) as unknown as Prisma.InputJsonArray,
```

- [ ] **Step 6: 更新 scopeTone 函数**

In `lib/results/project-results-core.ts`, update the `scopeTone` function:

```typescript
function scopeTone(status: string): Tone {
  if (status === "已确认") return "success"
  if (status === "待验证") return "warning"
  return "info"
}
```

- [ ] **Step 7: Commit**

```bash
git add components/projects/project-results-hub.tsx components/projects/project-summary.tsx lib/results/project-results-core.ts "app/(console)/projects/[projectId]/page.tsx"
git commit -m "feat: update results hub to 4 cards, metrics labels, direct asset queries"
```

---

### Task 9: 删除上下文和阶段页面

**Files:**
- Delete: `app/(console)/projects/[projectId]/context/page.tsx`
- Delete: `app/(console)/projects/[projectId]/flow/page.tsx`
- Delete: `components/projects/project-knowledge-tabs.tsx`
- Delete: `components/projects/project-stage-flow.tsx`

- [ ] **Step 1: 删除文件**

```bash
rm -f "app/(console)/projects/[projectId]/context/page.tsx"
rmdir "app/(console)/projects/[projectId]/context" 2>/dev/null
rm -f "app/(console)/projects/[projectId]/flow/page.tsx"
rmdir "app/(console)/projects/[projectId]/flow" 2>/dev/null
rm -f components/projects/project-knowledge-tabs.tsx
rm -f components/projects/project-stage-flow.tsx
```

- [ ] **Step 2: 清理 context/flow 的 import 引用**

Search for any remaining imports of deleted files and remove them:
```bash
grep -r "project-knowledge-tabs\|project-stage-flow\|context/page\|flow/page" --include="*.ts" --include="*.tsx" -l
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove context and flow tabs — content consolidated elsewhere"
```

---

### Task 10: UI 文案批量更新

**Files:** Multiple UI components

- [ ] **Step 1: 替换"编排"→"AI 规划"（用户可见文案）**

Files to update:
- `components/projects/project-scheduler-runtime-panel.tsx`: "编排轮次" → "AI 规划轮次"
- `lib/results/project-results-core.ts`: work log summaries containing "编排"
- `app/(console)/projects/[projectId]/operations/page.tsx`: "LLM 编排配置" → "AI 规划配置", "LLM 编排器" → "AI 规划器"

**Note:** Only replace user-facing display text. Keep internal variable names (e.g., `orchestrator-service.ts`) unchanged.

- [ ] **Step 2: 替换"调度"→"执行控制"（Tab 和面板标题）**

- `components/projects/project-scheduler-runtime-panel.tsx`: "调度器" → "执行引擎" in user-facing text
- `lib/platform-config.ts`: "调度队列" → "执行队列" in systemStatusCards

- [ ] **Step 3: 替换"MCP 工具"→"探测工具"（面向用户文案）**

- `components/settings/mcp-gateway-client.tsx`: 4 occurrences of "MCP 工具" → "探测工具"
- `lib/platform-config.ts`: "MCP 工具管理" → "探测工具管理"

- [ ] **Step 4: 替换"收束"→"自动收尾"**

Search and replace in user-facing strings across `lib/` and `components/`.

- [ ] **Step 5: 替换"情报"→"信息"（发现严重度）**

In `lib/types/project.ts` and display components, replace severity value `"情报"` with `"信息"`.

- [ ] **Step 6: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: batch terminology cleanup — 编排→AI规划, MCP工具→探测工具, 收束→自动收尾"
```

---

### Task 11: 测试更新

**Files:** All test files referencing changed values

- [ ] **Step 1: 更新单元测试中的状态值断言**

Search all test files for old status values and update:
```bash
grep -r '"已纳入"\|"待确认"\|"待复核"\|"待处理"\|"已阻塞"\|"情报"' tests/ --include="*.ts" --include="*.tsx" -l
```

Replace in each file.

- [ ] **Step 2: 更新 E2E 测试**

In `e2e/prototype-smoke.spec.ts` and `e2e/vuln-cockpit.spec.ts`:
- Update any tab name assertions (e.g., "调度" → "执行控制")
- Update any status text assertions

- [ ] **Step 3: 运行全量测试**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: All tests pass (may need iterative fixes).

- [ ] **Step 4: 运行 E2E 测试**

```bash
PLAYWRIGHT_WEB_PORT=3000 npx playwright test
```

Expected: 14/14 pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: update assertions for tab restructure and terminology changes"
```

---

### Task 12: 最终验证

- [ ] **Step 1: TypeScript 编译**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 2: 生产构建**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 3: 单元测试**

```bash
npx vitest run
```
Expected: 178/178 pass.

- [ ] **Step 4: E2E 测试**

```bash
PLAYWRIGHT_WEB_PORT=3000 npx playwright test
```
Expected: 14/14 pass.

- [ ] **Step 5: 浏览器验证**

Open http://127.0.0.1:3000, verify:
1. 项目详情页显示 7 个 Tab（概览/域名/站点/端口/漏洞/执行控制/AI日志）
2. 域名 Tab 显示域名专用表格（域名/类型/解析IP/来源/状态）
3. 站点 Tab 显示 Web 站点表格（URL/标题/状态码/服务器/状态）
4. 端口 Tab 显示 Nmap 风格表格（IP/端口/协议/服务/产品版本/状态）
5. 所有状态 Badge 显示新术语（已确认/待验证/待启动/等待审批）
6. "上下文"和"阶段" Tab 已消失
7. "执行控制" Tab 替代原"调度"
8. 面板中不再出现"编排""MCP 工具""收束"等术语
