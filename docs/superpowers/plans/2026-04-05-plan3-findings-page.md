# Plan 3: 漏洞页 + 漏洞详情页重构

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建独立的漏洞列表页路由，重构漏洞详情页增加证据展示，移除不合理的"状态"字段。

**Architecture:** 漏洞列表是顶部导航的独立 tab，不再内嵌在概览页中。详情页增加原始证据折叠区块。移除 FindingStatus 在 UI 中的暴露。

**Tech Stack:** Next.js 15 App Router + React 19 + TypeScript + shadcn/ui + Prisma 7

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `app/(console)/projects/[projectId]/findings/page.tsx` | 漏洞列表页路由 |
| Create | `components/projects/findings-list-table.tsx` | 漏洞列表表格（无状态列） |
| Modify | `components/projects/finding-detail.tsx` (108 行) | 重构详情页：移除状态，增加证据区块 |
| Modify | `app/(console)/projects/[projectId]/vuln/[findingId]/page.tsx` (24 行) | 传递 evidence 数据 |

---

### Task 1: 创建漏洞列表页路由

**Files:**
- Create: `app/(console)/projects/[projectId]/findings/page.tsx`

- [ ] **Step 1: 创建路由页面**

```tsx
import { notFound } from "next/navigation"
import { requireAuth } from "@/lib/infra/auth"
import { getProject } from "@/lib/services/project-service"
import * as findingRepo from "@/lib/repositories/finding-repo"
import { FindingsListTable } from "@/components/projects/findings-list-table"

export default async function FindingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  await requireAuth()
  const { projectId } = await params

  let project
  try {
    project = await getProject(projectId)
  } catch {
    notFound()
  }

  const findings = await findingRepo.findByProject(projectId)

  return (
    <div className="p-4">
      <FindingsListTable projectId={project.id} findings={findings} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(console)/projects/[projectId]/findings/page.tsx
git commit -m "feat: add findings list page route"
```

---

### Task 2: 创建漏洞列表表格组件

**Files:**
- Create: `components/projects/findings-list-table.tsx`

- [ ] **Step 1: 创建组件**

这个表格无"状态"列，只有：漏洞标题、严重级别、影响目标、发现时间。点击行跳转详情页。

```tsx
"use client"

import { useRouter } from "next/navigation"
import { StatusBadge } from "@/components/shared/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Finding, Severity } from "@/lib/generated/prisma"
import { SEVERITY_LABELS } from "@/lib/types/labels"

type Tone = "default" | "info" | "success" | "warning" | "danger" | "muted"

const severityTone: Record<Severity, Tone> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "info",
  info: "muted",
}

type Props = {
  projectId: string
  findings: Finding[]
}

export function FindingsListTable({ projectId, findings }: Props) {
  const router = useRouter()

  if (findings.length === 0) {
    return <p className="text-sm text-zinc-600 py-8 text-center">暂无安全发现</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>漏洞标题</TableHead>
          <TableHead>严重级别</TableHead>
          <TableHead>影响目标</TableHead>
          <TableHead>发现时间</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {findings.map((finding) => (
          <TableRow
            key={finding.id}
            className="cursor-pointer hover:bg-zinc-800/50"
            onClick={() => router.push(`/projects/${projectId}/vuln/${finding.id}`)}
          >
            <TableCell>
              <p className="font-medium text-sm">{finding.title}</p>
              {finding.summary && (
                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{finding.summary}</p>
              )}
            </TableCell>
            <TableCell>
              <StatusBadge tone={severityTone[finding.severity]} label={SEVERITY_LABELS[finding.severity]} />
            </TableCell>
            <TableCell className="text-sm font-mono text-zinc-400 max-w-[200px] truncate">
              {finding.affectedTarget}
            </TableCell>
            <TableCell className="text-sm text-zinc-500">
              {new Date(finding.createdAt).toLocaleDateString("zh-CN")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/projects/findings-list-table.tsx
git commit -m "feat: add FindingsListTable component without status column"
```

---

### Task 3: 重构漏洞详情页数据层

**Files:**
- Modify: `app/(console)/projects/[projectId]/vuln/[findingId]/page.tsx` (24 行)

- [ ] **Step 1: 传递 evidence 数据给 FindingDetail**

当前页面只传 `finding, projectId, poc`。需要增加 evidence 数据：

```tsx
import { notFound } from "next/navigation"
import { FindingDetail } from "@/components/projects/finding-detail"
import { requireAuth } from "@/lib/infra/auth"
import * as findingRepo from "@/lib/repositories/finding-repo"

export default async function FindingDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; findingId: string }>
}) {
  await requireAuth()
  const { projectId, findingId } = await params
  const finding = await findingRepo.findById(findingId)

  if (!finding || finding.projectId !== projectId) notFound()

  // findById already includes pocs, asset, evidence
  const poc = finding.pocs[0] ?? null
  const evidence = finding.evidence ?? null

  return <FindingDetail finding={finding} projectId={projectId} poc={poc} evidence={evidence} />
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(console)/projects/[projectId]/vuln/[findingId]/page.tsx
git commit -m "refactor: pass evidence data to FindingDetail"
```

---

### Task 4: 重构 FindingDetail 组件

**Files:**
- Modify: `components/projects/finding-detail.tsx` (108 行)

- [ ] **Step 1: 更新 Props，移除状态，增加证据**

修改 Props：
```typescript
type Props = {
  finding: Finding
  projectId: string
  poc?: Poc | null
  evidence?: { title: string; toolName: string; rawOutput: string } | null
}
```

- [ ] **Step 2: 移除状态相关 UI**

删除 `statusTone` 映射、`FINDING_STATUS_LABELS` import、状态 StatusBadge 渲染。

- [ ] **Step 3: 增加原始证据折叠区块**

在 PoC 区块之后增加：

```tsx
{/* Raw Evidence — collapsed by default */}
{evidence && evidence.rawOutput && (
  <details className="border-t border-zinc-800 pt-4">
    <summary className="text-sm font-medium text-zinc-300 cursor-pointer hover:text-zinc-100">
      原始证据 — {evidence.toolName}
    </summary>
    <pre className="mt-2 rounded bg-zinc-950 p-3 text-xs text-zinc-400 max-h-96 overflow-auto whitespace-pre-wrap">
      {evidence.rawOutput}
    </pre>
  </details>
)}
```

- [ ] **Step 4: 更新返回链接指向漏洞列表页**

将 back link 从 `/projects/${projectId}` 改为 `/projects/${projectId}/findings`。

- [ ] **Step 5: Commit**

```bash
git add components/projects/finding-detail.tsx
git commit -m "refactor: remove status from finding detail, add evidence section"
```

---

### Task 5: 清理旧漏洞表格组件

**Files:**
- Possibly delete: `components/projects/project-vuln-tab.tsx` (142 行)

- [ ] **Step 1: 检查引用**

Run: `grep -r "ProjectVulnTab\|project-vuln-tab" components/ app/ --include="*.ts" --include="*.tsx"`

- [ ] **Step 2: 删除旧组件（如无其他引用）**

```bash
git rm components/projects/project-vuln-tab.tsx
git commit -m "chore: remove deprecated ProjectVulnTab component"
```

---

### Task 6: 删除无效的 findings status PATCH API 调用

**Files:**
- Check: `components/projects/project-findings-table.tsx` (if exists)

- [ ] **Step 1: 搜索所有对 `/results/findings` PATCH 的引用**

Run: `grep -r "results/findings" components/ app/ --include="*.ts" --include="*.tsx"`

- [ ] **Step 2: 移除所有 status 更新相关代码**

这些 PATCH 调用指向不存在的 API 端点，应全部移除。

- [ ] **Step 3: Commit**

```bash
git commit -m "fix: remove broken PATCH calls to non-existent results/findings endpoint"
```
