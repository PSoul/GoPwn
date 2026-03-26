import { ShieldCheck, TimerReset } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Switch } from "@/components/ui/switch"
import type { ApprovalRecord, ProjectDetailRecord, ProjectRecord } from "@/lib/prototype-types"

const approvalTone = {
  待处理: "danger",
  已批准: "success",
  已拒绝: "neutral",
  已延后: "warning",
} as const

export function ProjectOperationsPanel({
  project,
  detail,
  approvals,
}: {
  project: ProjectRecord
  detail: ProjectDetailRecord
  approvals: ApprovalRecord[]
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <SectionCard
        title="审批模式开关"
        description="审批主要是控制某些 MCP 调用是否需要人工确认，不应该喧宾夺主，但必须在二级页里明确可见。"
      >
        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950 dark:text-white">项目审批开关</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{detail.approvalControl.description}</p>
              </div>
              <Switch defaultChecked={detail.approvalControl.enabled} disabled aria-label="项目审批开关" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge tone={detail.approvalControl.enabled ? "warning" : "neutral"}>{detail.approvalControl.mode}</StatusBadge>
              <StatusBadge tone={detail.approvalControl.autoApproveLowRisk ? "success" : "warning"}>
                低风险自动放行：{detail.approvalControl.autoApproveLowRisk ? "开启" : "关闭"}
              </StatusBadge>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">{detail.approvalControl.note}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <ShieldCheck className="h-4 w-4" />
                <p className="text-sm font-semibold">审批负载</p>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{project.pendingApprovals}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">当前待处理审批动作数量，只有高风险动作会在这里形成阻塞。</p>
            </div>
            <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <TimerReset className="h-4 w-4" />
                <p className="text-sm font-semibold">开放任务</p>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{project.openTasks}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">任务与调度从主页面下沉后，统一在这里处理人工接管、等待依赖和恢复调度。</p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="项目审批记录" description="只保留和当前项目相关的审批，帮助研究员判断哪些动作需要继续人工放行。">
        <div className="space-y-3">
          {approvals.map((approval) => (
            <div
              key={approval.id}
              className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">{approval.actionType}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{approval.rationale}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge tone={approvalTone[approval.status]}>{approval.status}</StatusBadge>
                  <StatusBadge tone={approval.riskLevel === "高" ? "danger" : approval.riskLevel === "中" ? "warning" : "success"}>
                    风险 {approval.riskLevel}
                  </StatusBadge>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[20px] border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-xs text-slate-500 dark:text-slate-400">目标</p>
                  <p className="mt-1 text-sm font-medium text-slate-950 dark:text-white">{approval.target}</p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{approval.submittedAt}</p>
                </div>
                <div className="rounded-[20px] border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-xs text-slate-500 dark:text-slate-400">MCP / 参数摘要</p>
                  <p className="mt-1 text-sm font-medium text-slate-950 dark:text-white">
                    {approval.tool} · {approval.mcpCapability}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{approval.parameterSummary}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
