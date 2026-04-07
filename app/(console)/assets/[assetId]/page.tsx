import Link from "next/link"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { getAsset } from "@/lib/services/asset-service"
import { ASSET_KIND_LABELS } from "@/lib/types/labels"

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ assetId: string }>
}) {
  const { assetId } = await params

  let asset
  try {
    asset = await getAsset(assetId)
  } catch {
    notFound()
  }

  const kindLabel = ASSET_KIND_LABELS[asset.kind] ?? asset.kind

  return (
    <div className="space-y-6">
      <PageHeader
        title={`资产详情 · ${asset.value}`}
        description="资产详情页展示识别画像、指纹信息与关联发现。"
        actions={
          <>
            <StatusBadge tone="info">{kindLabel}</StatusBadge>
            <Button asChild className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400">
              <Link href="/assets">返回资产中心</Link>
            </Button>
          </>
        }
      />

      <SectionCard title="基本信息" description="资产识别画像">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">类型</p>
            <p className="mt-1 text-sm font-medium text-slate-950 dark:text-white">{kindLabel}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">值</p>
            <p className="mt-1 text-sm font-medium text-slate-950 dark:text-white">{asset.value}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">标签</p>
            <p className="mt-1 text-sm font-medium text-slate-950 dark:text-white">{asset.label}</p>
          </div>
        </div>
      </SectionCard>

      {asset.fingerprints.length > 0 && (
        <SectionCard title="指纹信息" description="技术栈和服务识别结果">
          <div className="space-y-2">
            {asset.fingerprints.map((fp) => (
              <div key={fp.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{fp.category}</span>
                <span className="text-sm text-slate-950 dark:text-white">{fp.value}</span>
                <span className="ml-auto text-xs text-slate-400">{fp.source}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {asset.findings && asset.findings.length > 0 && (
        <SectionCard title="关联漏洞" description="与此资产相关的安全发现">
          <div className="space-y-2">
            {asset.findings.map((f) => (
              <Link
                key={f.id}
                href={`/projects/${f.projectId}/vuln/${f.id}`}
                className="block rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <p className="text-sm font-medium text-slate-950 dark:text-white">{f.title}</p>
                <p className="mt-1 text-xs text-slate-500">{f.severity} · {f.status}</p>
              </Link>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
