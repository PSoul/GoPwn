# Plan 4: IP 详情页 + 跨页面链接

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建 IP 资产详情页，聚合展示该 IP 下的所有端口、关联漏洞、关联 Web 应用，并确保所有跨页面链接可达。

**Architecture:** IP 详情页是 Server Component，通过 assetId 查询 IP 资产及其子资产（端口/服务），通过 affectedTarget 匹配关联漏洞。

**Tech Stack:** Next.js 15 App Router + React 19 + TypeScript + shadcn/ui + Prisma 7

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `app/(console)/projects/[projectId]/assets/ip/[assetId]/page.tsx` | IP 详情页路由 |
| Create | `components/projects/ip-detail.tsx` | IP 详情页组件 |
| Modify | `lib/repositories/asset-repo.ts` | 增加按 IP 查询关联资产的方法 |

---

### Task 1: 增加资产仓库查询方法

**Files:**
- Modify: `lib/repositories/asset-repo.ts` (108 行)

- [ ] **Step 1: 增加查询 IP 关联资产和漏洞的方法**

在文件末尾追加：

```typescript
/** Find all port assets that are children of the given IP asset */
export async function findPortsByIpAsset(ipAssetId: string) {
  return prisma.asset.findMany({
    where: { parentId: ipAssetId, kind: "port" },
    include: {
      children: { where: { kind: "service" } }, // service assets
    },
    orderBy: { value: "asc" },
  })
}

/** Find webapp/api_endpoint assets that are descendants of ports under this IP */
export async function findWebAppsByIpAsset(ipAssetId: string) {
  // Get port IDs first
  const ports = await prisma.asset.findMany({
    where: { parentId: ipAssetId, kind: "port" },
    select: { id: true },
  })
  const portIds = ports.map((p) => p.id)
  if (portIds.length === 0) return []

  // Find webapp/api_endpoint with parent being one of the ports (or their services)
  const services = await prisma.asset.findMany({
    where: { parentId: { in: portIds }, kind: "service" },
    select: { id: true },
  })
  const parentIds = [...portIds, ...services.map((s) => s.id)]

  return prisma.asset.findMany({
    where: {
      parentId: { in: parentIds },
      kind: { in: ["webapp", "api_endpoint"] },
    },
    orderBy: { value: "asc" },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/repositories/asset-repo.ts
git commit -m "feat: add IP-centric asset query methods"
```

---

### Task 2: 创建 IP 详情页路由

**Files:**
- Create: `app/(console)/projects/[projectId]/assets/ip/[assetId]/page.tsx`

- [ ] **Step 1: 创建路由页面**

```tsx
import { notFound } from "next/navigation"
import { requireAuth } from "@/lib/infra/auth"
import * as assetRepo from "@/lib/repositories/asset-repo"
import * as findingRepo from "@/lib/repositories/finding-repo"
import { IpDetail } from "@/components/projects/ip-detail"

export default async function IpDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; assetId: string }>
}) {
  await requireAuth()
  const { projectId, assetId } = await params

  const ipAsset = await assetRepo.findById(assetId)
  if (!ipAsset || ipAsset.projectId !== projectId || ipAsset.kind !== "ip") {
    notFound()
  }

  // Fetch related data in parallel
  const [ports, webApps, allFindings] = await Promise.all([
    assetRepo.findPortsByIpAsset(assetId),
    assetRepo.findWebAppsByIpAsset(assetId),
    findingRepo.findByProject(projectId),
  ])

  // Filter findings that affect this IP
  const relatedFindings = allFindings.filter((f) =>
    f.affectedTarget.includes(ipAsset.value),
  )

  // Find associated domain (parent of this IP, if any)
  const associatedDomain = ipAsset.parent?.kind === "domain" || ipAsset.parent?.kind === "subdomain"
    ? ipAsset.parent
    : null

  return (
    <IpDetail
      projectId={projectId}
      ipAsset={ipAsset}
      associatedDomain={associatedDomain}
      ports={ports}
      relatedFindings={relatedFindings}
      webApps={webApps}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(console)/projects/[projectId]/assets/ip/[assetId]/page.tsx
git commit -m "feat: add IP detail page route"
```

---

### Task 3: 创建 IP 详情页组件

**Files:**
- Create: `components/projects/ip-detail.tsx`

- [ ] **Step 1: 创建组件**

```tsx
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { StatusBadge } from "@/components/shared/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Asset, Finding, Severity } from "@/lib/generated/prisma"
import { SEVERITY_LABELS } from "@/lib/types/labels"

type Tone = "default" | "info" | "success" | "warning" | "danger" | "muted"

const severityTone: Record<Severity, Tone> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "info",
  info: "muted",
}

type PortWithServices = Asset & { children: Asset[] }

type Props = {
  projectId: string
  ipAsset: Asset
  associatedDomain: Asset | null
  ports: PortWithServices[]
  relatedFindings: Finding[]
  webApps: Asset[]
}

export function IpDetail({ projectId, ipAsset, associatedDomain, ports, relatedFindings, webApps }: Props) {
  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/projects/${projectId}/assets?tab=hosts`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> 返回主机与端口
        </Link>
        <h2 className="text-2xl font-bold text-zinc-100 font-mono">{ipAsset.value}</h2>
        {associatedDomain && (
          <p className="text-sm text-zinc-500 mt-1">
            关联域名: <span className="text-zinc-300">{associatedDomain.value}</span>
          </p>
        )}
        <p className="text-sm text-zinc-600 mt-1">
          发现时间: {new Date(ipAsset.firstSeenAt).toLocaleDateString("zh-CN")}
        </p>
      </div>

      {/* Open Ports */}
      <section>
        <h3 className="text-sm font-medium text-zinc-400 mb-3">开放端口 ({ports.length})</h3>
        {ports.length === 0 ? (
          <p className="text-sm text-zinc-600 py-4 text-center">暂未发现开放端口</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>端口</TableHead>
                <TableHead>协议</TableHead>
                <TableHead>服务</TableHead>
                <TableHead>Banner/版本</TableHead>
                <TableHead>发现时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ports.map((port) => {
                const service = port.children[0]
                const metadata = port.metadata as Record<string, string> | null
                return (
                  <TableRow key={port.id}>
                    <TableCell className="font-mono text-sm">{port.value}</TableCell>
                    <TableCell className="text-sm text-zinc-400">{metadata?.protocol ?? "TCP"}</TableCell>
                    <TableCell className="text-sm">{service?.label ?? metadata?.service ?? ""}</TableCell>
                    <TableCell className="text-sm text-zinc-400 max-w-[200px] truncate">
                      {metadata?.banner ?? service?.value ?? ""}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-500">
                      {new Date(port.firstSeenAt).toLocaleDateString("zh-CN")}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Related Findings */}
      <section>
        <h3 className="text-sm font-medium text-zinc-400 mb-3">关联漏洞 ({relatedFindings.length})</h3>
        {relatedFindings.length === 0 ? (
          <p className="text-sm text-zinc-600 py-4 text-center">暂无关联漏洞</p>
        ) : (
          <div className="space-y-2">
            {relatedFindings.map((f) => (
              <Link
                key={f.id}
                href={`/projects/${projectId}/vuln/${f.id}`}
                className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 hover:border-zinc-700 transition-colors"
              >
                <StatusBadge tone={severityTone[f.severity]} label={SEVERITY_LABELS[f.severity]} />
                <span className="text-sm text-zinc-300 flex-1 truncate">{f.title}</span>
                {f.affectedTarget && (
                  <span className="text-xs font-mono text-zinc-600">{f.affectedTarget}</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Related Web Apps */}
      <section>
        <h3 className="text-sm font-medium text-zinc-400 mb-3">关联 Web 应用 ({webApps.length})</h3>
        {webApps.length === 0 ? (
          <p className="text-sm text-zinc-600 py-4 text-center">暂无关联 Web 应用</p>
        ) : (
          <div className="space-y-2">
            {webApps.map((app) => (
              <Link
                key={app.id}
                href={`/projects/${projectId}/assets?tab=web`}
                className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 hover:border-zinc-700 transition-colors"
              >
                <span className="text-sm font-mono text-blue-400 flex-1 truncate">{app.value}</span>
                <span className="text-xs text-zinc-500">{app.label !== app.value ? app.label : ""}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/projects/ip-detail.tsx
git commit -m "feat: add IpDetail component with ports, findings, web apps"
```

---

### Task 4: 验证所有跨页面链接

- [ ] **Step 1: 手动验证导航链路**

启动 dev server，对每条链接路径进行验证：

| 起点 | 操作 | 目标 | 预期 |
|------|------|------|------|
| 概览页 | 点击安全发现摘要卡片 | `/projects/[id]/findings` | 漏洞列表 |
| 概览页 | 点击资产发现摘要卡片 | `/projects/[id]/assets?tab=...` | 对应资产 tab |
| 域名 tab | 点击解析 IP | `/projects/[id]/assets/ip/[assetId]` | IP 详情页 |
| 主机与端口 tab | 点击主机 IP | `/projects/[id]/assets/ip/[assetId]` | IP 详情页 |
| IP 详情页 | 点击关联漏洞 | `/projects/[id]/vuln/[findingId]` | 漏洞详情页 |
| IP 详情页 | 返回 | `/projects/[id]/assets?tab=hosts` | 主机与端口 tab |
| 漏洞列表 | 点击行 | `/projects/[id]/vuln/[findingId]` | 漏洞详情页 |
| 漏洞详情页 | 返回 | `/projects/[id]/findings` | 漏洞列表 |

- [ ] **Step 2: 修复发现的链接问题**

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "fix: verify and fix cross-page navigation links"
```
