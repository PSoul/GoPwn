"use client"

import Link from "next/link"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ApprovalRecord, AssetRecord, EvidenceRecord, ProjectDetailRecord } from "@/lib/prototype-types"

const tabItems = ["证据与日志", "审批记录", "补充情报", "资产中心条目", "活动时间线"] as const

export function ProjectKnowledgeTabs({
  detail,
  approvals,
  assets,
  evidence,
}: {
  detail: ProjectDetailRecord
  approvals: ApprovalRecord[]
  assets: AssetRecord[]
  evidence: EvidenceRecord[]
}) {
  return (
    <SectionCard
      title="项目证据与上下文"
      description="结果型内容已经拆到专门表格页，这里保留证据、审批、补充情报、资产条目和活动时间线，供研究员继续复核。"
    >
      <Tabs defaultValue="证据与日志" className="space-y-5">
        <TabsList className="h-auto flex-wrap rounded-3xl bg-slate-100/80 p-2 dark:bg-slate-900/80">
          {tabItems.map((item) => (
            <TabsTrigger key={item} value={item} className="rounded-2xl px-4 py-2">
              {item}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="证据与日志" className="space-y-3">
          {evidence.map((record) => (
            <div key={record.id} className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/evidence/${record.id}`} className="text-sm font-semibold text-slate-950 hover:text-slate-700 dark:text-white dark:hover:text-slate-200">
                    {record.title}
                  </Link>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{record.source}</p>
                </div>
                <StatusBadge tone="warning">{record.conclusion}</StatusBadge>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                置信度 {record.confidence} · 关联资产 {record.linkedAssetLabel}
              </p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="审批记录" className="space-y-3">
          {approvals.map((approval) => (
            <div key={approval.id} className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">{approval.actionType}</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{approval.rationale}</p>
                </div>
                <StatusBadge tone={approval.status === "待处理" ? "danger" : approval.status === "已延后" ? "warning" : "success"}>
                  {approval.status}
                </StatusBadge>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {approval.target} · {approval.parameterSummary}
              </p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="补充情报" className="space-y-3">
          {detail.discoveredInfo.map((item) => (
            <CardItem key={item.title} title={item.title} detail={item.detail} meta={item.meta} tone={item.tone} />
          ))}
        </TabsContent>

        <TabsContent value="资产中心条目" className="space-y-3">
          {assets.map((asset) => (
            <div key={asset.id} className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/assets/${asset.id}`} className="text-sm font-semibold text-slate-950 hover:text-slate-700 dark:text-white dark:hover:text-slate-200">
                    {asset.label}
                  </Link>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{asset.profile}</p>
                </div>
                <StatusBadge tone={asset.scopeStatus === "已纳入" ? "success" : asset.scopeStatus === "待确认" ? "warning" : "info"}>
                  {asset.scopeStatus}
                </StatusBadge>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {asset.host} · {asset.lastSeen}
              </p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="活动时间线" className="space-y-3">
          {detail.activity.map((item) => (
            <CardItem key={item.title} title={item.title} detail={item.detail} meta={item.meta} tone={item.tone} />
          ))}
        </TabsContent>
      </Tabs>
    </SectionCard>
  )
}

function CardItem({
  title,
  detail,
  meta,
  tone,
}: {
  title: string
  detail: string
  meta: string
  tone: "neutral" | "info" | "success" | "warning" | "danger"
}) {
  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950 dark:text-white">{title}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{detail}</p>
        </div>
        <StatusBadge tone={tone}>{meta}</StatusBadge>
      </div>
    </div>
  )
}
