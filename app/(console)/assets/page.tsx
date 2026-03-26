import Link from "next/link"
import { Boxes, FolderKanban, Network, ShieldCheck } from "lucide-react"

import { AssetTable } from "@/components/assets/asset-table"
import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { listAssetsPayload } from "@/lib/prototype-api"

const statIcons = [Boxes, Network, ShieldCheck, FolderKanban]

export default function AssetsPage() {
  const { items: assets } = listAssetsPayload()
  const inScopeCount = assets.filter((item) => item.scopeStatus === "已纳入").length
  const pendingCount = assets.filter((item) => item.scopeStatus === "待确认").length
  const reviewCount = assets.filter((item) => item.scopeStatus === "待复核").length
  const projectCount = new Set(assets.map((item) => item.projectName)).size

  const stats = [
    { label: "资产总量", value: String(assets.length), detail: "所有已识别对象都先被结构化收进资产中心。" },
    { label: "已纳入范围", value: String(inScopeCount), detail: "已确认可继续推进后续识别、验证和证据沉淀。" },
    { label: "待确认对象", value: String(pendingCount + reviewCount), detail: "需要结合归属、授权与项目上下文继续判断。" },
    { label: "覆盖项目", value: String(projectCount), detail: "资产中心横跨项目，是沉淀与回流的统一入口。" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="资产中心"
        description="资产中心不是纯列表，而是把当前识别画像、范围归属和关系链路沉淀在同一个地方，方便研究员快速判断下一步。"
        actions={
          <>
            <StatusBadge tone="warning">{pendingCount + reviewCount} 个待确认对象</StatusBadge>
            <Button asChild className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400">
              <Link href="/projects/proj-huayao">查看项目回流</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = statIcons[index]

          return (
            <div
              key={stat.label}
              className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_12px_40px_-32px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-950/70"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{stat.label}</p>
                  <p className="text-3xl font-semibold text-slate-950 dark:text-white">{stat.value}</p>
                </div>
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{stat.detail}</p>
            </div>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="资产列表"
          eyebrow="Asset Inventory"
          description="把对象类型、画像、关联项目和范围状态直接放到一张表里，便于做范围治理和入口沉淀。"
        >
          <AssetTable records={assets} />
        </SectionCard>

        <SectionCard
          title="沉淀原则"
          eyebrow="Knowledge Rules"
          description="资产列表的真正目标是帮助研究员判断是否要纳入范围、回流前置阶段或进入后续验证。"
        >
          <div className="space-y-4">
            {[
              "先回答“它是谁、归谁、跟哪个项目有关”，再继续谈漏洞验证。",
              "待确认与待复核对象必须保留来源线索，避免后续无法解释为什么纳入或排除。",
              "一旦确认纳入范围，就应补充前置任务而不是强行重置项目主阶段。",
            ].map((item) => (
              <div
                key={item}
                className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300"
              >
                {item}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
