# Plan 2: 资产页 + 3 个子 Tab

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建资产页，包含 3 个子 tab（域名/主机与端口/Web与API），每个 tab 有独立的定制表格。

**Architecture:** 资产页是一个 Server Component 路由页，获取全部资产后按 kind 分组，传给 Client Component 的 tab 容器。子 tab 通过 URL query 参数 `?tab=domains|hosts|web` 切换。

**Tech Stack:** Next.js 15 App Router + React 19 + TypeScript + shadcn/ui + Prisma 7

**数据模型参考：** Asset 有 `kind` 枚举：domain, subdomain, ip, port, service, webapp, api_endpoint。资产间有 parent/children 树形关系。

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `app/(console)/projects/[projectId]/assets/page.tsx` | 资产页路由（Server Component） |
| Create | `components/projects/asset-page-tabs.tsx` | 子 tab 容器（Client Component） |
| Create | `components/projects/asset-domains-table.tsx` | 域名表格 |
| Create | `components/projects/asset-hosts-table.tsx` | 主机与端口表格 |
| Create | `components/projects/asset-web-table.tsx` | Web 与 API 表格 |

---

### Task 1: 创建资产页路由

**Files:**
- Create: `app/(console)/projects/[projectId]/assets/page.tsx`

- [ ] **Step 1: 创建路由页面**

```tsx
import { notFound } from "next/navigation"
import { requireAuth } from "@/lib/infra/auth"
import { getProject } from "@/lib/services/project-service"
import { listByProject as listAssets } from "@/lib/services/asset-service"
import { AssetPageTabs } from "@/components/projects/asset-page-tabs"

export default async function AssetPage({ params }: { params: Promise<{ projectId: string }> }) {
  await requireAuth()
  const { projectId } = await params

  let project
  try {
    project = await getProject(projectId)
  } catch {
    notFound()
  }

  const assets = await listAssets(projectId)

  return (
    <div className="p-4">
      <AssetPageTabs projectId={project.id} assets={assets} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(console)/projects/[projectId]/assets/page.tsx
git commit -m "feat: add asset page route"
```

---

### Task 2: 创建子 Tab 容器

**Files:**
- Create: `components/projects/asset-page-tabs.tsx`

- [ ] **Step 1: 创建 tab 容器组件**

```tsx
"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AssetDomainsTable } from "@/components/projects/asset-domains-table"
import { AssetHostsTable } from "@/components/projects/asset-hosts-table"
import { AssetWebTable } from "@/components/projects/asset-web-table"
import type { Asset } from "@/lib/generated/prisma"

type Props = {
  projectId: string
  assets: Asset[]
}

export function AssetPageTabs({ projectId, assets }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get("tab") ?? "domains"

  // Split assets by kind
  const domains = assets.filter((a) => a.kind === "domain" || a.kind === "subdomain")
  const hosts = assets.filter((a) => a.kind === "ip" || a.kind === "port" || a.kind === "service")
  const web = assets.filter((a) => a.kind === "webapp" || a.kind === "api_endpoint")

  function handleTabChange(value: string) {
    router.replace(`/projects/${projectId}/assets?tab=${value}`, { scroll: false })
  }

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="domains">域名 ({domains.length})</TabsTrigger>
        <TabsTrigger value="hosts">主机与端口 ({hosts.length})</TabsTrigger>
        <TabsTrigger value="web">Web 与 API ({web.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="domains">
        <AssetDomainsTable projectId={projectId} assets={domains} />
      </TabsContent>
      <TabsContent value="hosts">
        <AssetHostsTable projectId={projectId} assets={hosts} />
      </TabsContent>
      <TabsContent value="web">
        <AssetWebTable projectId={projectId} assets={web} />
      </TabsContent>
    </Tabs>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/projects/asset-page-tabs.tsx
git commit -m "feat: add AssetPageTabs container with 3 sub-tabs"
```

---

### Task 3: 域名表格

**Files:**
- Create: `components/projects/asset-domains-table.tsx`

- [ ] **Step 1: 创建域名表格组件**

```tsx
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "@/components/shared/status-badge"
import type { Asset } from "@/lib/generated/prisma"
import { ASSET_KIND_LABELS } from "@/lib/types/labels"

type Props = {
  projectId: string
  assets: Asset[] // kind: domain | subdomain
}

export function AssetDomainsTable({ projectId, assets }: Props) {
  if (assets.length === 0) {
    return <p className="text-sm text-zinc-600 py-8 text-center">暂未发现域名资产</p>
  }

  // Find IP assets for resolution display — look for children with kind=ip
  // For now, show the value directly; IP resolution requires parent-child lookup
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>域名</TableHead>
          <TableHead>类型</TableHead>
          <TableHead>解析 IP</TableHead>
          <TableHead>发现时间</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => (
          <TableRow key={asset.id}>
            <TableCell className="font-mono text-sm">{asset.value}</TableCell>
            <TableCell>
              <StatusBadge tone={asset.kind === "domain" ? "info" : "muted"} label={ASSET_KIND_LABELS[asset.kind]} />
            </TableCell>
            <TableCell>
              {/* IP resolution: check metadata or related assets */}
              {asset.metadata && typeof asset.metadata === "object" && "resolvedIp" in (asset.metadata as Record<string, unknown>)
                ? (
                  <Link
                    href={`/projects/${projectId}/assets/ip/${encodeURIComponent((asset.metadata as Record<string, string>).resolvedIp)}`}
                    className="text-blue-400 hover:underline font-mono text-sm"
                  >
                    {(asset.metadata as Record<string, string>).resolvedIp}
                  </Link>
                )
                : <span className="text-zinc-600 text-sm">未解析</span>
              }
            </TableCell>
            <TableCell className="text-sm text-zinc-500">
              {new Date(asset.firstSeenAt).toLocaleDateString("zh-CN")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

注意：IP 解析信息可能存在 `asset.metadata.resolvedIp` 中，也可能通过 parent-child 关系获取。当前实现先检查 metadata，后续可增强为查询关联的 IP 类型子资产。

- [ ] **Step 2: Commit**

```bash
git add components/projects/asset-domains-table.tsx
git commit -m "feat: add AssetDomainsTable component"
```

---

### Task 4: 主机与端口表格

**Files:**
- Create: `components/projects/asset-hosts-table.tsx`

- [ ] **Step 1: 创建主机与端口表格组件**

```tsx
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Asset } from "@/lib/generated/prisma"

type Props = {
  projectId: string
  assets: Asset[] // kind: ip | port | service
}

export function AssetHostsTable({ projectId, assets }: Props) {
  if (assets.length === 0) {
    return <p className="text-sm text-zinc-600 py-8 text-center">暂未发现主机与端口资产</p>
  }

  // Build rows: for port/service assets, extract host and port from value
  // Asset value formats: "ip" kind → "10.0.1.1", "port" kind → "8082", "service" kind → "http"
  // Port assets typically have parent = ip asset
  const rows = assets
    .filter((a) => a.kind === "port")
    .map((portAsset) => {
      // Find parent IP
      const ipAsset = assets.find((a) => a.kind === "ip" && a.id === portAsset.parentId)
      const host = ipAsset?.value ?? ""
      // Find child service
      const serviceAsset = assets.find((a) => a.kind === "service" && a.parentId === portAsset.id)
      const metadata = portAsset.metadata as Record<string, string> | null
      return {
        id: portAsset.id,
        host,
        ipAssetId: ipAsset?.id,
        port: portAsset.value,
        protocol: metadata?.protocol ?? "TCP",
        service: serviceAsset?.label ?? metadata?.service ?? "",
        banner: metadata?.banner ?? serviceAsset?.value ?? "",
        firstSeenAt: portAsset.firstSeenAt,
      }
    })
    .sort((a, b) => a.host.localeCompare(b.host) || Number(a.port) - Number(b.port))

  // Also show standalone IP assets (no ports discovered yet)
  const ipsWithPorts = new Set(rows.map((r) => r.ipAssetId).filter(Boolean))
  const standaloneIps = assets.filter((a) => a.kind === "ip" && !ipsWithPorts.has(a.id))

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>主机</TableHead>
          <TableHead>端口</TableHead>
          <TableHead>协议</TableHead>
          <TableHead>服务</TableHead>
          <TableHead>Banner/版本</TableHead>
          <TableHead>发现时间</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {standaloneIps.map((ip) => (
          <TableRow key={ip.id}>
            <TableCell>
              <Link
                href={`/projects/${projectId}/assets/ip/${ip.id}`}
                className="text-blue-400 hover:underline font-mono text-sm"
              >
                {ip.value}
              </Link>
            </TableCell>
            <TableCell colSpan={4} className="text-zinc-600 text-sm">端口扫描中...</TableCell>
            <TableCell className="text-sm text-zinc-500">
              {new Date(ip.firstSeenAt).toLocaleDateString("zh-CN")}
            </TableCell>
          </TableRow>
        ))}
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              {row.ipAssetId ? (
                <Link
                  href={`/projects/${projectId}/assets/ip/${row.ipAssetId}`}
                  className="text-blue-400 hover:underline font-mono text-sm"
                >
                  {row.host}
                </Link>
              ) : (
                <span className="font-mono text-sm">{row.host}</span>
              )}
            </TableCell>
            <TableCell className="font-mono text-sm">{row.port}</TableCell>
            <TableCell className="text-sm text-zinc-400">{row.protocol}</TableCell>
            <TableCell className="text-sm">{row.service}</TableCell>
            <TableCell className="text-sm text-zinc-400 max-w-[200px] truncate">{row.banner}</TableCell>
            <TableCell className="text-sm text-zinc-500">
              {new Date(row.firstSeenAt).toLocaleDateString("zh-CN")}
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
git add components/projects/asset-hosts-table.tsx
git commit -m "feat: add AssetHostsTable component"
```

---

### Task 5: Web 与 API 表格

**Files:**
- Create: `components/projects/asset-web-table.tsx`

- [ ] **Step 1: 创建 Web 与 API 表格组件**

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "@/components/shared/status-badge"
import type { Asset } from "@/lib/generated/prisma"
import { ASSET_KIND_LABELS } from "@/lib/types/labels"

type Props = {
  projectId: string
  assets: Asset[] // kind: webapp | api_endpoint
}

export function AssetWebTable({ projectId, assets }: Props) {
  if (assets.length === 0) {
    return <p className="text-sm text-zinc-600 py-8 text-center">暂未发现 Web 应用或 API 端点</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>URL</TableHead>
          <TableHead>类型</TableHead>
          <TableHead>标题/描述</TableHead>
          <TableHead>技术栈</TableHead>
          <TableHead>状态码</TableHead>
          <TableHead>发现时间</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => {
          const metadata = asset.metadata as Record<string, unknown> | null
          return (
            <TableRow key={asset.id}>
              <TableCell className="font-mono text-sm max-w-[300px] truncate">
                <a href={asset.value} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  {asset.value}
                </a>
              </TableCell>
              <TableCell>
                <StatusBadge
                  tone={asset.kind === "webapp" ? "info" : "muted"}
                  label={ASSET_KIND_LABELS[asset.kind]}
                />
              </TableCell>
              <TableCell className="text-sm max-w-[200px] truncate">
                {asset.label !== asset.value ? asset.label : ""}
              </TableCell>
              <TableCell className="text-sm text-zinc-400">
                {metadata?.technology as string ?? ""}
              </TableCell>
              <TableCell className="text-sm font-mono">
                {metadata?.statusCode as string ?? ""}
              </TableCell>
              <TableCell className="text-sm text-zinc-500">
                {new Date(asset.firstSeenAt).toLocaleDateString("zh-CN")}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/projects/asset-web-table.tsx
git commit -m "feat: add AssetWebTable component"
```

---

### Task 6: 清理旧资产表格组件

**Files:**
- Possibly delete: `components/projects/project-asset-tab.tsx` (82 行)

- [ ] **Step 1: 检查旧组件是否还有引用**

Run: `grep -r "ProjectAssetTab\|project-asset-tab" components/ app/ --include="*.ts" --include="*.tsx"`

如果只在已删除的 `project-live-dashboard.tsx` 和概览页中引用，可安全删除。

- [ ] **Step 2: 删除旧组件（如无其他引用）**

```bash
git rm components/projects/project-asset-tab.tsx
git commit -m "chore: remove deprecated ProjectAssetTab component"
```
