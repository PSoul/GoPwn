# Plan 1: 导航重构 + 概览页

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将顶部导航从 7 个 tab 简化为 5 个，将主页面从内嵌 tab 仪表盘重构为概览仪表盘。

**Architecture:** 删除指向已删除路由的导航链接，去掉 ProjectLiveDashboard 的内嵌 tab 系统，概览页只展示统计摘要卡片和最近活动作为入口。

**Tech Stack:** Next.js 15 App Router + React 19 + TypeScript + shadcn/ui + Prisma 7

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `components/projects/project-workspace-nav.tsx` | 5 个 tab 导航 |
| Rewrite | `components/projects/project-live-dashboard.tsx` → rename to `project-overview.tsx` | 概览仪表盘 |
| Modify | `app/(console)/projects/[projectId]/page.tsx` | 改用新概览组件 |

---

### Task 1: 重构 ProjectWorkspaceNav — 5 个 Tab

**Files:**
- Modify: `components/projects/project-workspace-nav.tsx` (全文件，55 行)

- [ ] **Step 1: 替换 tabs 数组**

将 lines 13-21 的 7 个 tab 替换为 5 个：

```typescript
const tabs = [
  { href: "", label: "概览", icon: LayoutDashboard },
  { href: "/assets", label: "资产", icon: Globe },
  { href: "/findings", label: "漏洞", icon: ShieldAlert },
  { href: "/operations", label: "执行控制", icon: Settings2 },
  { href: "/ai-logs", label: "AI 日志", icon: BrainCircuit },
]
```

需要新增 import: `LayoutDashboard` from "lucide-react"，移除未使用的 `Network` import。

- [ ] **Step 2: 验证导航渲染**

Run: `npx next build 2>&1 | head -30` 确认无编译错误。

- [ ] **Step 3: Commit**

```bash
git add components/projects/project-workspace-nav.tsx
git commit -m "refactor: simplify workspace nav to 5 tabs"
```

---

### Task 2: 创建概览页组件 ProjectOverview

**Files:**
- Create: `components/projects/project-overview.tsx`

- [ ] **Step 1: 创建组件文件**

```tsx
"use client"

import Link from "next/link"
import { ShieldAlert, Globe, Network, AppWindow } from "lucide-react"
import { StatusBadge } from "@/components/shared/status-badge"
import { ProjectSummary } from "@/components/projects/project-summary"
import type { Project, Finding, Asset, Approval, Severity, AssetKind } from "@/lib/generated/prisma"
import { SEVERITY_LABELS, ASSET_KIND_LABELS } from "@/lib/types/labels"

type Tone = "default" | "info" | "success" | "warning" | "danger" | "muted"

const severityTone: Record<Severity, Tone> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "info",
  info: "muted",
}

type Props = {
  project: Project
  initialFindings: Finding[]
  initialAssets: Asset[]
  initialApprovals: Approval[]
}

export function ProjectOverview({ project, initialFindings, initialAssets, initialApprovals }: Props) {
  // Group findings by severity
  const findingsBySeverity = new Map<Severity, number>()
  for (const f of initialFindings) {
    findingsBySeverity.set(f.severity, (findingsBySeverity.get(f.severity) ?? 0) + 1)
  }

  // Group assets by kind
  const assetsByKind = new Map<AssetKind, number>()
  for (const a of initialAssets) {
    assetsByKind.set(a.kind, (assetsByKind.get(a.kind) ?? 0) + 1)
  }

  // Map asset kinds to sub-tab query params
  const kindToTab: Partial<Record<AssetKind, string>> = {
    domain: "domains",
    subdomain: "domains",
    ip: "hosts",
    port: "hosts",
    service: "hosts",
    webapp: "web",
    api_endpoint: "web",
  }

  return (
    <div className="space-y-6 p-4">
      <ProjectSummary project={project} />

      {/* Security Findings Summary */}
      <section>
        <h3 className="text-sm font-medium text-zinc-400 mb-3">安全发现</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {(["critical", "high", "medium", "low", "info"] as Severity[]).map((sev) => {
            const count = findingsBySeverity.get(sev) ?? 0
            return (
              <Link
                key={sev}
                href={`/projects/${project.id}/findings`}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <StatusBadge tone={severityTone[sev]} label={SEVERITY_LABELS[sev]} />
                </div>
                <p className="text-2xl font-semibold text-zinc-100">{count}</p>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Asset Discovery Summary */}
      <section>
        <h3 className="text-sm font-medium text-zinc-400 mb-3">资产发现</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {(["domain", "subdomain", "ip", "port", "service", "webapp", "api_endpoint"] as AssetKind[]).map((kind) => {
            const count = assetsByKind.get(kind) ?? 0
            if (count === 0) return null
            const tab = kindToTab[kind] ?? "domains"
            return (
              <Link
                key={kind}
                href={`/projects/${project.id}/assets?tab=${tab}`}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 hover:border-zinc-700 transition-colors"
              >
                <p className="text-xs text-zinc-500 mb-1">{ASSET_KIND_LABELS[kind]}</p>
                <p className="text-2xl font-semibold text-zinc-100">{count}</p>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Recent Activity */}
      <section>
        <h3 className="text-sm font-medium text-zinc-400 mb-3">最近活动</h3>
        <div className="space-y-2">
          {initialFindings.slice(0, 5).map((f) => (
            <Link
              key={f.id}
              href={`/projects/${project.id}/vuln/${f.id}`}
              className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 hover:border-zinc-700 transition-colors"
            >
              <ShieldAlert className="h-4 w-4 text-zinc-500 shrink-0" />
              <span className="text-sm text-zinc-300 truncate flex-1">{f.title}</span>
              <StatusBadge tone={severityTone[f.severity]} label={SEVERITY_LABELS[f.severity]} />
              <span className="text-xs text-zinc-600">{new Date(f.createdAt).toLocaleDateString("zh-CN")}</span>
            </Link>
          ))}
          {initialFindings.length === 0 && (
            <p className="text-sm text-zinc-600 py-4 text-center">暂无安全发现</p>
          )}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: 验证编译**

Run: `npx next build 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add components/projects/project-overview.tsx
git commit -m "feat: add ProjectOverview dashboard component"
```

---

### Task 3: 更新主页面使用 ProjectOverview

**Files:**
- Modify: `app/(console)/projects/[projectId]/page.tsx` (40 行)

- [ ] **Step 1: 替换 import 和组件**

将 `ProjectLiveDashboard` import 替换为 `ProjectOverview`:

```typescript
import { ProjectOverview } from "@/components/projects/project-overview"
```

将 render 部分 `<ProjectLiveDashboard ... />` 替换为 `<ProjectOverview ... />`。

- [ ] **Step 2: 验证页面加载**

Run: `npx next dev` 然后在浏览器中访问 `/projects/{id}` 确认概览页渲染正常。

- [ ] **Step 3: Commit**

```bash
git add app/(console)/projects/[projectId]/page.tsx
git commit -m "refactor: replace live dashboard with overview on project page"
```

---

### Task 4: 清理旧组件

**Files:**
- Delete or mark deprecated: `components/projects/project-live-dashboard.tsx` (107 行)

- [ ] **Step 1: 检查是否有其他文件引用 ProjectLiveDashboard**

Run: `grep -r "ProjectLiveDashboard\|project-live-dashboard" components/ app/ lib/ --include="*.ts" --include="*.tsx"`

- [ ] **Step 2: 如果无其他引用，删除文件**

```bash
git rm components/projects/project-live-dashboard.tsx
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: remove deprecated ProjectLiveDashboard component"
```
