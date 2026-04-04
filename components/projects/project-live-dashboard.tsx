"use client"

import { StatusBadge } from "@/components/shared/status-badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useProjectEvents } from "@/lib/hooks/use-project-events"
import type {
  ProjectRecord,
  ProjectDetailRecord,
  ProjectFindingRecord,
  AssetRecord,
  ApprovalRecord,
  Tone,
} from "@/lib/prototype-types"

import { ProjectApprovalBar } from "./project-approval-bar"
import { ProjectStatsBar } from "./project-stats-bar"
import { ProjectVulnTab } from "./project-vuln-tab"
import { ProjectAssetTab } from "./project-asset-tab"
import { ProjectActivityLog } from "./project-activity-log"

const stageTone: Record<string, Tone> = {
  "授权与范围定义": "neutral",
  "种子目标接收": "info",
  "持续信息收集": "info",
  "目标关联与范围判定": "info",
  "发现与指纹识别": "warning",
  "待验证项生成": "warning",
  "审批前排队": "warning",
  "受控 PoC 验证": "danger",
  "证据归档与结果判定": "success",
  "风险聚合与项目结论": "success",
  "报告与回归验证": "success",
}

const statusTone: Record<string, Tone> = {
  运行中: "info",
  待启动: "neutral",
  已暂停: "warning",
  已停止: "neutral",
  等待审批: "warning",
  已完成: "success",
}

export function ProjectLiveDashboard({
  project,
  detail,
  initialFindings,
  initialAssets,
  initialApprovals,
}: {
  project: ProjectRecord
  detail: ProjectDetailRecord
  initialFindings: ProjectFindingRecord[]
  initialAssets: AssetRecord[]
  initialApprovals: ApprovalRecord[]
}) {
  const live = useProjectEvents(project.id)

  const assetCount = live.assetCount || project.assetCount
  const vulnCount = live.vulnCount || initialFindings.length
  const highCount = live.highCount || initialFindings.filter((f) => f.severity === "高危").length
  const pendingApprovals = live.pendingApprovals || project.pendingApprovals

  return (
    <div className="space-y-4">
      <ProjectApprovalBar projectId={project.id} initialApprovals={initialApprovals} />

      <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-950 dark:text-white">{project.name}</h1>
          <StatusBadge tone={stageTone[project.stage] ?? "neutral"}>{project.stage}</StatusBadge>
          <StatusBadge tone={statusTone[project.status] ?? "neutral"}>{project.status}</StatusBadge>
        </div>
        {project.targets.length > 0 && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            目标: {project.targets.join(", ")}
          </p>
        )}
      </div>

      <ProjectStatsBar
        assetCount={assetCount}
        vulnCount={vulnCount}
        highCount={highCount}
        pendingApprovals={pendingApprovals}
      />

      <Tabs defaultValue="vulns">
        <TabsList>
          <TabsTrigger value="vulns">漏洞</TabsTrigger>
          <TabsTrigger value="assets">资产</TabsTrigger>
          <TabsTrigger value="logs">执行日志</TabsTrigger>
        </TabsList>
        <TabsContent value="vulns">
          <ProjectVulnTab projectId={project.id} initialFindings={initialFindings} />
        </TabsContent>
        <TabsContent value="assets">
          <ProjectAssetTab projectId={project.id} initialAssets={initialAssets} />
        </TabsContent>
        <TabsContent value="logs">
          <ProjectActivityLog logs={live.logs} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
