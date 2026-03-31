import Image from "next/image"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { EvidenceRecord } from "@/lib/prototype-types"

export function EvidenceDetail({
  record,
  artifacts,
}: {
  record: EvidenceRecord
  artifacts?: {
    screenshotUrl?: string
    htmlUrl?: string
  }
}) {
  return (
    <div className="space-y-6">
      <SectionCard
        title={record.title}
        eyebrow="Evidence Summary"
        description={`${record.projectName} · 关联审批 ${record.linkedApprovalId}`}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">来源</p>
            <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{record.source}</p>
          </div>
          <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">置信度</p>
            <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{record.confidence}</p>
          </div>
          <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">当前结论</p>
            <StatusBadge tone="warning" className="mt-2">
              {record.conclusion}
            </StatusBadge>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <SectionCard
            title="原始输出"
            eyebrow="Raw Output"
            description="先看原始响应、原始输出和采样痕迹，再决定结构化摘要是否可信。"
          >
            <div className="space-y-3">
              {record.rawOutput.map((item, index) => (
                <pre
                  key={`${record.id}-raw-${index}`}
                  className="overflow-x-auto rounded-3xl border border-slate-200/80 bg-slate-950 px-4 py-4 text-sm text-slate-100 dark:border-slate-800"
                >
                  <code>{item}</code>
                </pre>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="截图" eyebrow="Screenshot" description="截图不是装饰，而是帮助研究员快速确认页面上下文与肉眼可见线索。">
            <div className="rounded-card border border-slate-200/80 bg-[linear-gradient(135deg,_rgba(14,165,233,0.16),_rgba(15,23,42,0.03))] p-6 dark:border-slate-800 dark:bg-[linear-gradient(135deg,_rgba(14,165,233,0.2),_rgba(2,6,23,0.5))]">
              <div className="rounded-panel border border-white/70 bg-white/80 p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.4)] dark:border-slate-700 dark:bg-slate-900/80">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {artifacts?.screenshotUrl ? (
                      <Button asChild variant="outline" size="sm" className="rounded-full border-slate-300 dark:border-slate-700">
                        <a href={artifacts.screenshotUrl} target="_blank" rel="noreferrer">
                          打开截图
                        </a>
                      </Button>
                    ) : null}
                    {artifacts?.htmlUrl ? (
                      <Button asChild variant="outline" size="sm" className="rounded-full border-slate-300 dark:border-slate-700">
                        <a href={artifacts.htmlUrl} target="_blank" rel="noreferrer">
                          打开 HTML
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
                {artifacts?.screenshotUrl ? (
                  <div className="space-y-4">
                    <Image
                      src={artifacts.screenshotUrl}
                      alt={`${record.title} screenshot`}
                      width={1440}
                      height={900}
                      unoptimized
                      className="w-full rounded-2xl border border-slate-200/80 bg-slate-50 object-cover shadow-[0_20px_60px_-40px_rgba(15,23,42,0.4)] dark:border-slate-800 dark:bg-slate-950/80"
                    />
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-6 dark:border-slate-800 dark:bg-slate-950/80">
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">采证画面说明</p>
                      <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{record.screenshotNote}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-6 dark:border-slate-800 dark:bg-slate-950/80">
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">采证画面说明</p>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{record.screenshotNote}</p>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="结构化摘要" eyebrow="Structured Summary" description="从原始输出抽出值得继续推进的事实，不在这里直接替代结论判断。">
            <div className="space-y-3">
              {record.structuredSummary.map((item, index) => (
                <div
                  key={`${record.id}-summary-${index}`}
                  className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300"
                >
                  {item}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="关联链路" eyebrow="Context Links" description="把证据与任务、审批、资产链路放在一起，便于快速复核。">
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                <p className="text-sm font-semibold text-slate-950 dark:text-white">关联任务</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{record.linkedTaskTitle}</p>
              </div>
              <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                <p className="text-sm font-semibold text-slate-950 dark:text-white">关联审批</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{record.linkedApprovalId}</p>
              </div>
              <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                <p className="text-sm font-semibold text-slate-950 dark:text-white">关联资产</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{record.linkedAssetLabel}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="时间线" eyebrow="Timeline" description="证据的可信度很大程度取决于采集顺序和前后上下文。">
            <div className="space-y-3">
              {record.timeline.map((item, index) => (
                <div
                  key={`${record.id}-timeline-${index}`}
                  className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300"
                >
                  {item}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="最终结论" eyebrow="Verdict" description="最终结论不是结果终点，而是指导下一步是否复核、回流或继续验证。">
            <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">{record.verdict}</p>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
