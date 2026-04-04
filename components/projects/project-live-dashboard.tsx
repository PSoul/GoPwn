"use client"

import { StatusBadge } from "@/components/shared/status-badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Project, Finding, Asset, Approval, ProjectLifecycle, PentestPhase } from "@/lib/generated/prisma"
import { LIFECYCLE_LABELS, PHASE_LABELS } from "@/lib/types/labels"

import { ProjectApprovalBar } from "./project-approval-bar"
import { ProjectVulnTab } from "./project-vuln-tab"
import { ProjectAssetTab } from "./project-asset-tab"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

const lifecycleTone: Record<ProjectLifecycle, Tone> = {
  idle: "neutral",
  planning: "info",
  executing: "info",
  waiting_approval: "warning",
  reviewing: "warning",
  settling: "success",
  stopping: "warning",
  stopped: "neutral",
  completed: "success",
  failed: "danger",
}

const phaseTone: Record<PentestPhase, Tone> = {
  recon: "info",
  discovery: "info",
  assessment: "warning",
  verification: "danger",
  reporting: "success",
}

export function ProjectLiveDashboard({
  project,
  initialFindings,
  initialAssets,
  initialApprovals,
}: {
  project: Project
  initialFindings: Finding[]
  initialAssets: Asset[]
  initialApprovals: Approval[]
}) {
  return (
    <div className="space-y-4">
      <ProjectApprovalBar initialApprovals={initialApprovals} />

      <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-950 dark:text-white">{project.name}</h1>
          <StatusBadge tone={phaseTone[project.currentPhase]}>{PHASE_LABELS[project.currentPhase]}</StatusBadge>
          <StatusBadge tone={lifecycleTone[project.lifecycle]}>{LIFECYCLE_LABELS[project.lifecycle]}</StatusBadge>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            R{project.currentRound}/{project.maxRounds}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-xs text-slate-500">资产</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{initialAssets.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-xs text-slate-500">发现</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{initialFindings.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-xs text-slate-500">已验证</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
            {initialFindings.filter((f) => f.status === "verified").length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-xs text-slate-500">待审批</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
            {initialApprovals.filter((a) => a.status === "pending").length}
          </p>
        </div>
      </div>

      <Tabs defaultValue="vulns">
        <TabsList>
          <TabsTrigger value="vulns">漏洞</TabsTrigger>
          <TabsTrigger value="assets">资产</TabsTrigger>
        </TabsList>
        <TabsContent value="vulns">
          <ProjectVulnTab projectId={project.id} initialFindings={initialFindings} />
        </TabsContent>
        <TabsContent value="assets">
          <ProjectAssetTab projectId={project.id} initialAssets={initialAssets} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
