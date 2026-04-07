import Link from "next/link"

import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { listProjects } from "@/lib/services/project-service"
import { listByProject as listAssets } from "@/lib/services/asset-service"

export default async function AssetsPage() {
  const projects = await listProjects()

  const allAssets = (
    await Promise.all(projects.map((p) => listAssets(p.id)))
  ).flat()

  return (
    <div className="space-y-6">
      <PageHeader
        title="资产中心"
        eyebrow="资产工作区"
        description="跨项目的全局资产列表，展示所有已发现资产。"
        actions={
          <>
            <StatusBadge tone={allAssets.length > 0 ? "info" : "neutral"}>
              {allAssets.length} 个资产
            </StatusBadge>
            <Button asChild className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200">
              <Link href="/projects">返回项目列表</Link>
            </Button>
          </>
        }
      />

      {allAssets.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/85 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/60">
          <p className="text-sm font-medium text-slate-950 dark:text-white">还没有发现资产</p>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            项目执行后，发现的资产会在这里汇总展示。
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {allAssets.map((asset) => (
              <Link
                key={asset.id}
                href={`/assets/${asset.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-950 dark:text-white">{asset.value}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{asset.kind} · {asset.label}</p>
                </div>
                <StatusBadge tone="info">{asset.kind}</StatusBadge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
