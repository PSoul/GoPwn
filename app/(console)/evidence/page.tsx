import Link from "next/link"
import { FileCheck2, Files, ShieldAlert, Waypoints } from "lucide-react"

import { EvidenceTable } from "@/components/evidence/evidence-table"
import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { listEvidencePayload } from "@/lib/prototype-api"

const statIcons = [Files, FileCheck2, ShieldAlert, Waypoints]

export default function EvidencePage() {
  const { items: evidenceRecords } = listEvidencePayload()
  const linkedApprovals = new Set(evidenceRecords.map((item) => item.linkedApprovalId)).size

  const stats = [
    { label: "证据总量", value: String(evidenceRecords.length), detail: "所有原始输出和结构化摘要都在这里统一回看。" },
    { label: "待复核结论", value: String(evidenceRecords.length), detail: "当前证据都需要人工确认后再进入稳定结论。" },
    { label: "关联审批", value: String(linkedApprovals), detail: "高风险动作的证据链必须能追溯到审批单。" },
    { label: "链路完整度", value: "高", detail: "证据、任务、审批和资产上下文都保持可跳转关系。" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="证据与结果"
        description="证据页的核心是先看原始输出，再看结构化摘要与关联链路，避免研究员只看结论不看上下文。"
        actions={
          <>
            <StatusBadge tone="warning">{evidenceRecords.length} 个待复核结论</StatusBadge>
            <Button asChild className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400">
              <Link href={`/evidence/${evidenceRecords[0].id}`}>查看最新证据</Link>
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
          title="证据列表"
          eyebrow="Evidence Queue"
          description="把证据按编号、来源、结论和关联审批组织起来，让复核入口清晰可见。"
        >
          <EvidenceTable records={evidenceRecords} />
        </SectionCard>

        <SectionCard
          title="复核节奏"
          eyebrow="Review Flow"
          description="证据列表页重点不是展示花哨图表，而是告诉研究员应该按什么顺序阅读和判断。"
        >
          <div className="space-y-4">
            {[
              "先看原始输出是否完整，再接受结构化摘要，不要直接相信自动提炼结果。",
              "高风险结论优先核对是否绑定审批单与资产对象，避免孤立证据。",
              "若证据与历史结果冲突，优先回流到补采与复核，而不是急着归档结论。",
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
