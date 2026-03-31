import { listStoredProjectApprovals } from "@/lib/approval-repository"
import { listStoredAssets } from "@/lib/asset-repository"
import { listStoredEvidence } from "@/lib/evidence-repository"
import { listStoredMcpRuns } from "@/lib/mcp-gateway-repository"
import { getProjectOrchestratorPanelPayload } from "@/lib/orchestrator-service"
import { buildDefaultProjectSchedulerControl } from "@/lib/project-scheduler-lifecycle"
import { listStoredSchedulerTasks } from "@/lib/mcp-scheduler-repository"
import {
  getStoredProjectSchedulerControl,
} from "@/lib/project-scheduler-control-repository"
import {
  getStoredProjectReportExportPayload,
  listStoredProjectFindings,
} from "@/lib/project-results-repository"
import {
  getStoredProjectById,
  getStoredProjectDetailById,
} from "@/lib/project-repository"
import { prisma } from "@/lib/prisma"
import { toOrchestratorRoundRecord } from "@/lib/prisma-transforms"
import type {
  AssetCollectionView,
  ProjectContextPayload,
  ProjectOperationsPayload,
} from "@/lib/prototype-types"

// ──────────────────────────────────────────────
// Private helpers
// ──────────────────────────────────────────────

async function getProjectBase(projectId: string) {
  const project = await getStoredProjectById(projectId)
  const detail = await getStoredProjectDetailById(projectId)

  if (!project || !detail) {
    return null
  }

  return { project, detail }
}

// ──────────────────────────────────────────────
// Exported
// ──────────────────────────────────────────────

export function buildAssetViews(
  assets: Awaited<ReturnType<typeof listStoredAssets>>,
  options?: {
    includePendingReview?: boolean
  },
): AssetCollectionView[] {
  const typedViews: Array<{
    key: AssetCollectionView["key"]
    label: string
    description: string
    match: (asset: (typeof assets)[number]) => boolean
  }> = [
    {
      key: "domains-web",
      label: "域名 / Web",
      description: "域名、站点、路径入口和 API/Web 暴露面。",
      match: (asset) => ["domain", "subdomain", "website", "api", "page_entry", "entry", "web"].includes(asset.type),
    },
    {
      key: "hosts-ip",
      label: "IP / 主机",
      description: "IP、主机、网段等基础网络对象。",
      match: (asset) => ["ip", "cidr", "host"].includes(asset.type),
    },
    {
      key: "ports-services",
      label: "端口 / 服务",
      description: "开放端口、协议、服务和端口级画像。",
      match: (asset) => asset.type === "port" || (asset.type === "service" && !asset.profile.toLowerCase().includes("fingerprint")),
    },
    {
      key: "fingerprints",
      label: "指纹 / 技术栈",
      description: "版本、headers、框架和技术画像线索。",
      match: (asset) =>
        asset.profile.toLowerCase().includes("fingerprint") ||
        asset.profile.toLowerCase().includes("header") ||
        asset.type === "service",
    },
    {
      key: "pending-review",
      label: "待确认 / 待复核",
      description: "尚未最终纳入范围或仍需复核的对象。",
      match: (asset) => asset.scopeStatus !== "已纳入",
    },
  ]

  const visibleViews = options?.includePendingReview === false
    ? typedViews.filter((view) => view.key !== "pending-review")
    : typedViews

  return visibleViews.map((view) => {
    const items = assets.filter(view.match)

    return {
      key: view.key,
      label: view.label,
      description: view.description,
      count: items.length,
      items,
    }
  })
}

export async function getProjectOperationsPayload(projectId: string): Promise<ProjectOperationsPayload | null> {
  const base = await getProjectBase(projectId)

  if (!base) {
    return null
  }

  const dbRounds = await prisma.orchestratorRound.findMany({
    where: { projectId },
    orderBy: { round: "asc" },
  })

  return {
    ...base,
    approvals: await listStoredProjectApprovals(projectId),
    mcpRuns: await listStoredMcpRuns(projectId),
    schedulerControl: await getStoredProjectSchedulerControl(projectId) ?? buildDefaultProjectSchedulerControl(base.project.lastUpdated, "idle"),
    schedulerTasks: await listStoredSchedulerTasks(projectId),
    orchestrator: await getProjectOrchestratorPanelPayload(projectId),
    reportExport: await getStoredProjectReportExportPayload(projectId),
    orchestratorRounds: dbRounds.map(toOrchestratorRoundRecord),
  }
}

export async function getProjectContextPayload(projectId: string): Promise<ProjectContextPayload | null> {
  const base = await getProjectBase(projectId)

  if (!base) {
    return null
  }

  const findings = await listStoredProjectFindings(projectId)

  return {
    ...base,
    detail: {
      ...base.detail,
      findings,
    },
    approvals: await listStoredProjectApprovals(projectId),
    assets: await listStoredAssets(projectId),
    evidence: await listStoredEvidence(projectId),
  }
}
