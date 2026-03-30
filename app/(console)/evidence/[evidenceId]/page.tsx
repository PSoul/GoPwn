import Link from "next/link"
import { notFound } from "next/navigation"

import { EvidenceDetail } from "@/components/evidence/evidence-detail"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { getStoredEvidenceById } from "@/lib/evidence-repository"
import { buildRuntimeArtifactUrl } from "@/lib/runtime-artifacts"

export default async function EvidenceDetailPage({
  params,
}: {
  params: Promise<{ evidenceId: string }>
}) {
  const { evidenceId } = await params
  const record = await getStoredEvidenceById(evidenceId)

  if (!record) {
    notFound()
  }

  const artifacts = {
    screenshotUrl: buildRuntimeArtifactUrl(record.screenshotArtifactPath) ?? undefined,
    htmlUrl: buildRuntimeArtifactUrl(record.htmlArtifactPath) ?? undefined,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`证据详情 · ${record.id}`}
        description="证据详情页按“原始输出 -> 截图 -> 结构化摘要 -> 关联链路 -> 结论”的顺序展开，让研究员按自然判断路径阅读。"
        actions={
          <>
            <StatusBadge tone="warning">{record.conclusion}</StatusBadge>
            <Button asChild className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400">
              <Link href="/evidence">返回证据列表</Link>
            </Button>
          </>
        }
      />

      <EvidenceDetail record={record} artifacts={artifacts} />
    </div>
  )
}
