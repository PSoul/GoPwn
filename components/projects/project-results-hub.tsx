import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { ProjectDetailRecord, ProjectRecord } from "@/lib/prototype-types"

const resultCards = [
  {
    key: "domains",
    title: "域名 / Web 入口",
    description: "把域名、路径入口、后台登录页和 Web 暴露面集中成一个整页表格，不跟端口和漏洞混在一起。",
    linkLabel: "查看域名 / Web 入口表格",
  },
  {
    key: "network",
    title: "IP / 端口 / 服务",
    description: "把 IP、端口、协议、服务画像和版本线索放成网络面总表，适合承载大量结果。",
    linkLabel: "查看 IP / 端口 / 服务表格",
  },
  {
    key: "findings",
    title: "漏洞与发现",
    description: "把已确认问题、待验证候选和待复核 finding 拉成单独结果表，不在总览页直接铺开。",
    linkLabel: "查看漏洞与发现表格",
  },
] as const

export function ProjectResultsHub({
  project,
  detail,
}: {
  project: ProjectRecord
  detail: ProjectDetailRecord
}) {
  const domainsGroup = detail.assetGroups.find((group) => group.title === "域名 / Web 入口")
  const networkGroup = detail.assetGroups.find((group) => group.title === "IP / 端口 / 服务")

  const counts = {
    domains: domainsGroup?.count ?? "0 条",
    network: networkGroup?.count ?? "0 条",
    findings: `${detail.findings.length} 条`,
  }

  return (
    <SectionCard
      title="结果模块"
      description="项目总览页只保留结果模块入口。真正的资产和漏洞内容进入独立整页表格，避免结果一多就把页面打乱。"
    >
      <div className="grid gap-4 xl:grid-cols-3">
        {resultCards.map((card) => (
          <div
            key={card.key}
            className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{card.description}</p>
              </div>
              <StatusBadge tone={card.key === "findings" ? "warning" : "info"}>{counts[card.key]}</StatusBadge>
            </div>
            <Button asChild variant="outline" className="mt-5 w-full rounded-full">
              <Link href={`/projects/${project.id}/results/${card.key}`}>
                {card.linkLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
