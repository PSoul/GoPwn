"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SectionCard } from "@/components/shared/section-card"
import { approvals, assets, evidenceRecords, projectTasks } from "@/lib/prototype-data"

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

export function ProjectKnowledgeTabs() {
  return (
    <SectionCard title="项目沉淀信息" eyebrow="Knowledge Panel" description="阶段主视图下方承接资产、证据、审批和任务调度，不把详情页切成普通 tab 堆叠页。">
      <Tabs defaultValue="资产" className="space-y-5">
        <TabsList className="h-auto flex-wrap rounded-3xl bg-slate-100/80 p-2 dark:bg-slate-900/80">
          {tabItems.map((item) => (
            <TabsTrigger key={item} value={item} className="rounded-2xl px-4 py-2">
              {item}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="资产" className="space-y-3">
          {assets.map((asset) => (
            <div key={asset.id} className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-sm font-semibold text-slate-950 dark:text-white">{asset.label}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{asset.profile}</p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="审批记录" className="space-y-3">
          {approvals.map((approval) => (
            <div key={approval.id} className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-sm font-semibold text-slate-950 dark:text-white">{approval.actionType}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{approval.rationale}</p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="证据与日志" className="space-y-3">
          {evidenceRecords.map((record) => (
            <div key={record.id} className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-sm font-semibold text-slate-950 dark:text-white">{record.title}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{record.source}</p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="任务与调度" className="space-y-3">
          {projectTasks.map((task) => (
            <div key={task.id} className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-sm font-semibold text-slate-950 dark:text-white">{task.title}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{task.status} · {task.reason}</p>
            </div>
          ))}
        </TabsContent>

        {tabItems
          .filter((item) => !["资产", "审批记录", "证据与日志", "任务与调度"].includes(item))
          .map((item) => (
            <TabsContent key={item} value={item}>
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                {item} 将复用同一套高密度卡片与表格风格承接项目沉淀数据。
              </div>
            </TabsContent>
          ))}
      </Tabs>
    </SectionCard>
  )
}
