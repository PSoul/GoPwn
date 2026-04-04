import os from "node:os"

import {
  dashboardMetrics,
  systemStatusCards,
} from "@/lib/settings/platform-config"
import { listStoredLlmProfiles } from "@/lib/llm/llm-settings-repository"
import { listStoredApprovals } from "@/lib/data/approval-repository"
import { listStoredAssets } from "@/lib/data/asset-repository"
import { listStoredEvidence } from "@/lib/data/evidence-repository"
import {
  listStoredMcpTools,
} from "@/lib/mcp/mcp-repository"
import {
  getStoredProjectDetailById,
  listStoredProjects,
} from "@/lib/project/project-repository"
import {
  listStoredProjectFindings,
} from "@/lib/project/project-results-repository"
import { prisma } from "@/lib/infra/prisma"
import { buildAssetViews } from "./project-compositions"
import type {
  DashboardPayload,
  DashboardRecentResultRecord,
  DashboardSystemRecord,
  McpToolRecord,
  ProjectRecord,
  SystemStatusPayload,
  SystemStatusRecord,
  TaskRecord,
  Tone,
} from "@/lib/prototype-types"

// ──────────────────────────────────────────────
// Private helpers
// ──────────────────────────────────────────────

async function buildDashboardMetrics(projects: ProjectRecord[], approvalTotal: number) {
  const findings = await listStoredProjectFindings()
  const assets = await listStoredAssets()

  return dashboardMetrics.map((metric) => {
    if (metric.label === "项目总数") {
      return {
        ...metric,
        value: String(projects.length),
        delta: projects.length > 0 ? `${projects.filter((project) => project.status === "运行中").length} 个运行中` : "等待第一个真实项目",
      }
    }

    if (metric.label === "已发现资产") {
      return {
        ...metric,
        value: String(assets.length),
        delta: assets.length > 0 ? `${assets.filter((asset) => asset.scopeStatus !== "已确认").length} 个待验证` : "等待真实资产数据",
      }
    }

    if (metric.label === "已发现漏洞") {
      return {
        ...metric,
        value: String(findings.length),
        delta: findings.length > 0 ? `${findings.filter((finding) => finding.status === "待复核").length} 个待复核` : "等待真实发现沉淀",
      }
    }

    if (metric.label === "待审批动作") {
      return {
        ...metric,
        value: String(approvalTotal),
        delta: approvalTotal > 0 ? `${projects.filter((project) => project.pendingApprovals > 0).length} 个项目受影响` : "当前无审批阻塞",
      }
    }

    return metric
  })
}

function buildDashboardPriorities({
  approvals,
  assets,
  mcpTools,
  projects,
}: {
  approvals: Awaited<ReturnType<typeof listStoredApprovals>>
  assets: Awaited<ReturnType<typeof listStoredAssets>>
  mcpTools: Awaited<ReturnType<typeof listStoredMcpTools>>
  projects: ProjectRecord[]
}) {
  if (projects.length === 0 && approvals.length === 0 && assets.length === 0 && mcpTools.length === 0) {
    return []
  }

  const priorities: Array<{ title: string; detail: string; tone: Tone }> = []
  const pendingApprovals = approvals.filter((approval) => approval.status === "待处理")
  const pendingAssets = assets.filter((asset) => asset.scopeStatus !== "已确认")
  const abnormalTools = mcpTools.filter((tool) => tool.status === "异常")
  const blockedProjects = projects.filter((project) => project.status === "等待审批")

  if (pendingApprovals.length > 0) {
    priorities.push({
      title: "审批队列待清理",
      detail: `${pendingApprovals.length} 个动作仍在等待人工确认，优先恢复被阻塞项目的主路径。`,
      tone: "danger",
    })
  }

  if (pendingAssets.length > 0) {
    priorities.push({
      title: "待验证资产需要处理",
      detail: `${pendingAssets.length} 个对象仍待验证或需人工判断，建议先补归属再推进下一步验证。`,
      tone: "warning",
    })
  }

  if (abnormalTools.length > 0) {
    priorities.push({
      title: "探测工具健康待处理",
      detail: `${abnormalTools.length} 个工具处于异常状态，继续前请先完成巡检与恢复。`,
      tone: "info",
    })
  }

  if (priorities.length === 0 && blockedProjects.length > 0) {
    priorities.push({
      title: "阻塞项目待恢复",
      detail: `${blockedProjects.length} 个项目处于阻塞状态，建议先进入项目详情查看当前阶段与控制策略。`,
      tone: "warning",
    })
  }

  return priorities
}

async function deriveDashboardTasks(projects: ProjectRecord[]): Promise<TaskRecord[]> {
  if (projects.length === 0) {
    return []
  }

  const results: TaskRecord[] = []
  for (const project of projects) {
    const detail = await getStoredProjectDetailById(project.id)
    if (detail?.tasks) {
      results.push(...detail.tasks)
    }
  }
  return results
}

function buildDashboardRecentResults({
  approvals,
  assets,
  evidence,
  findings,
  projects,
}: {
  approvals: Awaited<ReturnType<typeof listStoredApprovals>>
  assets: Awaited<ReturnType<typeof listStoredAssets>>
  evidence: Awaited<ReturnType<typeof listStoredEvidence>>
  findings: Awaited<ReturnType<typeof listStoredProjectFindings>>
  projects: ProjectRecord[]
}): DashboardRecentResultRecord[] {
  const records = [
    ...evidence.map((record) => ({
      id: `evidence-${record.id}`,
      title: record.title,
      subtitle: record.projectName,
      meta: `${record.source} · ${record.timeline.at(0) ?? record.projectName}`,
      href: `/projects/${record.projectId}/context`,
      status: record.conclusion,
      tone: "info" as const,
      sortAt: record.timeline.at(0) ?? "",
    })),
    ...findings.map((finding) => ({
      id: `finding-${finding.id}`,
      title: finding.title,
      subtitle: finding.affectedSurface,
      meta: `${finding.severity} · ${finding.updatedAt}`,
      href: `/projects/${finding.projectId}`,
      status: finding.status,
      tone: finding.status === "已确认" ? ("warning" as const) : ("info" as const),
      sortAt: finding.updatedAt,
    })),
    ...assets.map((asset) => ({
      id: `asset-${asset.id}`,
      title: asset.label,
      subtitle: asset.projectName,
      meta: `${asset.type} · ${asset.lastSeen}`,
      href: `/assets/${asset.id}`,
      status: asset.scopeStatus,
      tone: asset.scopeStatus === "已确认" ? ("success" as const) : ("warning" as const),
      sortAt: asset.lastSeen,
    })),
    ...approvals.map((approval) => ({
      id: `approval-${approval.id}`,
      title: approval.actionType,
      subtitle: approval.projectName,
      meta: `${approval.riskLevel}风险 · ${approval.submittedAt}`,
      href: "/approvals",
      status: approval.status,
      tone: approval.status === "待处理" ? ("danger" as const) : ("neutral" as const),
      sortAt: approval.submittedAt,
    })),
    ...projects.map((project) => ({
      id: `project-${project.id}`,
      title: project.name,
      subtitle: project.stage,
      meta: `最近更新 ${project.lastUpdated}`,
      href: `/projects/${project.id}`,
      status: project.status,
      tone: project.status === "等待审批" ? ("danger" as const) : ("neutral" as const),
      sortAt: project.lastUpdated,
    })),
  ]

  const dedupedRecords = Array.from(
    new Map(
      records.map((record) => [
        `${record.title}::${record.subtitle}::${record.meta}::${record.href}::${record.status}`,
        record,
      ]),
    ).values(),
  )

  return dedupedRecords
    .sort((left, right) => right.sortAt.localeCompare(left.sortAt, "zh-CN"))
    .slice(0, 8)
    .map((record) => {
      const { sortAt, ...rest } = record
      void sortAt
      return rest
    })
}

async function buildDashboardSystemOverview({
  mcpTools,
  projects,
}: {
  mcpTools: Awaited<ReturnType<typeof listStoredMcpTools>>
  projects: ProjectRecord[]
}): Promise<DashboardSystemRecord[]> {
  const llmProfiles = await listStoredLlmProfiles()
  const enabledModels = llmProfiles.filter((profile) => profile.enabled && profile.model)
  const activeTaskCount = await prisma.schedulerTask.count({
    where: { status: { notIn: ["completed", "failed", "cancelled"] } },
  })
  const pendingApprovalCount = await prisma.approval.count({
    where: { status: "待处理" },
  })
  const memoryUsage = process.memoryUsage()
  const heapUsedMb = Math.round(memoryUsage.heapUsed / 1024 / 1024)
  const heapTotalMb = Math.round(memoryUsage.heapTotal / 1024 / 1024)
  const loadAverage = os.loadavg()[0]?.toFixed(2) ?? "0.00"

  return [
    {
      title: "探测工具",
      value: `${mcpTools.filter((tool) => tool.status === "启用").length} / ${mcpTools.length}`,
      detail: "当前已启用探测工具数量。",
      href: "/settings/mcp-tools",
      tone: mcpTools.some((tool) => tool.status === "异常") ? "warning" : "success",
    },
    {
      title: "LLM 模型",
      value: [...new Set(enabledModels.map((profile) => profile.model))].join(" / ") || "未配置",
      detail: "当前参与规划的模型配置。",
      href: "/settings/llm",
      tone: enabledModels.length > 0 ? "info" : "warning",
    },
    {
      title: "执行队列",
      value: `${activeTaskCount} 条`,
      detail: `${projects.filter((project) => project.status === "运行中").length} 个运行中项目 / ${pendingApprovalCount} 个待审批动作`,
      href: "/settings/system-status",
      tone: "neutral",
    },
    {
      title: "运行状态",
      value: `Heap ${heapUsedMb}/${heapTotalMb} MB`,
      detail: `1m load ${loadAverage}，用于快速感知当前本地运行压力。`,
      href: "/settings/system-status",
      tone: "info",
    },
  ]
}

async function buildSystemStatusPayloadFromTools(tools: McpToolRecord[]): Promise<SystemStatusRecord[]> {
  const enabledCount = tools.filter((tool) => tool.status === "启用").length
  const abnormalTools = tools.filter((tool) => tool.status === "异常")
  const allSchedulerTasks = await prisma.schedulerTask.findMany()
  const activeTasks = allSchedulerTasks.filter((task) => !["succeeded", "failed", "cancelled"].includes(task.status))
  const waitingApprovalTasks = activeTasks.filter((task) => task.status === "waiting_approval").length
  const runningTasks = activeTasks.filter((task) => task.status === "running").length
  const retryTasks = activeTasks.filter((task) => task.status === "retry_scheduled").length
  const browserTools = tools.filter((tool) => tool.capability === "截图与证据采集类" && tool.status === "启用")
  const webSurfaceTools = tools.filter((tool) => tool.capability === "Web 页面探测类" && tool.status === "启用")
  const auditLogTotal = await prisma.auditLog.count()
  const workLogTotal = await prisma.workLog.count()

  return systemStatusCards.map((card) => {
    if (card.title === "MCP 网关") {
      return {
        ...card,
        value: tools.length > 0 ? `${enabledCount} / ${tools.length} 正常` : "0 / 0 已接入",
        description:
          tools.length === 0
            ? "当前还没有注册任何 MCP server 或工具契约。"
            : abnormalTools.length > 0
            ? `${abnormalTools.map((tool) => tool.toolName).join("、")} 当前异常，已影响对应链路。`
            : "所有已注册探测工具当前均处于健康状态。",
        tone: tools.length === 0 ? "neutral" : abnormalTools.length > 0 ? "danger" : "success",
      }
    }

    if (card.title === "执行队列") {
      return {
        ...card,
        value: `${activeTasks.length} 条`,
        description:
          activeTasks.length === 0
            ? "当前没有待运行、待审批或待重试的真实任务。"
            : `${waitingApprovalTasks} 条待审批 / ${runningTasks} 条执行中 / ${retryTasks} 条已排入调度恢复。`,
        tone: activeTasks.length === 0 ? "neutral" : waitingApprovalTasks > 0 ? "warning" : "info",
      }
    }

    if (card.title === "浏览器池") {
      return {
        ...card,
        value: browserTools.length > 0 ? `${browserTools.length} 条已接入` : "未接入",
        description:
          browserTools.length > 0
            ? `当前已注册 ${browserTools.map((tool) => tool.toolName).join("、")}，可用于截图或证据采集。`
            : webSurfaceTools.length > 0
            ? "当前还没有独立浏览器/截图采集节点，但 Web 页面探测链路仍可返回基础入口证据。"
            : "当前还没有浏览器或截图采集能力注册。",
        tone: browserTools.length > 0 ? "success" : webSurfaceTools.length > 0 ? "warning" : "neutral",
      }
    }

    if (card.title === "日志存储") {
      return {
        ...card,
        value: `${workLogTotal + auditLogTotal} 条`,
        description:
          workLogTotal + auditLogTotal > 0
            ? `工作日志 ${workLogTotal} 条 / 审计日志 ${auditLogTotal} 条，均已进入真实持久化存储。`
            : "当前还没有真实日志写入，等项目执行或配置变更后这里会开始累积。",
        tone: workLogTotal + auditLogTotal > 0 ? "success" : "info",
      }
    }

    return card
  })
}

// ──────────────────────────────────────────────
// Exported
// ──────────────────────────────────────────────

export async function getDashboardPayload(): Promise<DashboardPayload> {
  const projects = await listStoredProjects()
  const approvals = await listStoredApprovals()
  const mcpTools = await listStoredMcpTools()
  const assets = await listStoredAssets()
  const evidence = await listStoredEvidence()
  const findings = await listStoredProjectFindings()
  const pendingApprovalCount = approvals.filter((approval) => approval.status === "待处理").length
  const priorities = buildDashboardPriorities({ projects, approvals, assets, mcpTools })
  const leadProject = projects[0] ?? null

  return {
    metrics: await buildDashboardMetrics(projects, pendingApprovalCount),
    priorities,
    leadProject,
    approvals,
    assets,
    evidence,
    mcpTools,
    projectTasks: await deriveDashboardTasks(projects),
    projects,
    assetViews: buildAssetViews(assets, { includePendingReview: false }),
    recentResults: buildDashboardRecentResults({ approvals, assets, evidence, findings, projects }),
    systemOverview: await buildDashboardSystemOverview({ mcpTools, projects }),
  }
}

export async function getSystemStatusPayload(): Promise<SystemStatusPayload> {
  const items = await buildSystemStatusPayloadFromTools(await listStoredMcpTools())

  return {
    items,
    total: items.length,
  }
}
