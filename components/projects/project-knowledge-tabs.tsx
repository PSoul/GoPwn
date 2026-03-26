"use client"

import Link from "next/link"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ApprovalRecord, AssetRecord, EvidenceRecord, ProjectDetailRecord } from "@/lib/prototype-types"

const tabItems = [
  "已发现信息",
  "资产",
  "IP / 端口 / 服务",
  "指纹 / 技术栈",
  "Web / API 入口",
  "审批记录",
  "证据与日志",
  "任务与调度",
] as const

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
    <SectionCard title="项目沉淀信息" description="详情页下半区保持项目级知识面板，让研究员能在同一上下文里查看资产、审批、证据与回流线索。">
      <Tabs defaultValue="已发现信息" className="space-y-5">
        <TabsList className="h-auto flex-wrap rounded-3xl bg-slate-100/80 p-2 dark:bg-slate-900/80">
          {tabItems.map((item) => (
            <TabsTrigger key={item} value={item} className="rounded-2xl px-4 py-2">
              {item}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="已发现信息" className="space-y-3">
          {detail.discoveredInfo.map((item) => (
            <CardItem key={item.title} title={item.title} detail={item.detail} meta={item.meta} tone={item.tone} />
          ))}
        </TabsContent>

        <TabsContent value="资产" className="space-y-3">
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

        <TabsContent value="IP / 端口 / 服务" className="space-y-3">
          {detail.serviceSurface.map((item) => (
            <CardItem key={item.title} title={item.title} detail={item.detail} meta={item.meta} tone={item.tone} />
          ))}
        </TabsContent>

        <TabsContent value="指纹 / 技术栈" className="space-y-3">
          {detail.fingerprints.map((item) => (
            <CardItem key={item.title} title={item.title} detail={item.detail} meta={item.meta} tone={item.tone} />
          ))}
        </TabsContent>

        <TabsContent value="Web / API 入口" className="space-y-3">
          {detail.entries.map((item) => (
            <CardItem key={item.title} title={item.title} detail={item.detail} meta={item.meta} tone={item.tone} />
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
                {approval.target} · {approval.submittedAt}
              </p>
            </div>
          ))}
        </TabsContent>

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
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">置信度 {record.confidence}</p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="任务与调度" className="space-y-3">
          {detail.scheduler.map((item) => (
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
