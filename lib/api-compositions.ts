import os from "node:os"

import {
  dashboardMetrics,
  mcpBoundaryRules,
  mcpCapabilityRecords,
  mcpRegistrationFields,
  settingsSections,
  systemControlOverview,
  systemStatusCards,
} from "@/lib/platform-config"
import { listStoredLlmProfiles } from "@/lib/llm-settings-repository"
import {
  getStoredGlobalApprovalControl,
  listStoredApprovalPolicies,
  listStoredApprovals,
  listStoredProjectApprovals,
  listStoredScopeRules,
  updateStoredApprovalDecision,
} from "@/lib/approval-repository"
import {
  listStoredAssets,
} from "@/lib/asset-repository"
import {
  listStoredEvidence,
} from "@/lib/evidence-repository"
import {
  listStoredMcpRuns,
} from "@/lib/mcp-gateway-repository"
import {
  listStoredMcpServerInvocations,
  listStoredMcpServers,
} from "@/lib/mcp-server-repository"
import {
  getProjectOrchestratorPanelPayload,
  runProjectLifecycleKickoff,
} from "@/lib/orchestrator-service"
import { buildDefaultProjectSchedulerControl } from "@/lib/project-scheduler-lifecycle"
import {
  drainStoredSchedulerTasks,
  syncStoredSchedulerTaskAfterApprovalDecision,
} from "@/lib/mcp-scheduler-service"
import { listStoredSchedulerTasks } from "@/lib/mcp-scheduler-repository"
import {
  listStoredMcpTools,
} from "@/lib/mcp-repository"
import {
  getStoredProjectSchedulerControl,
  stopStoredProjectSchedulerTasks,
  updateStoredProjectSchedulerControl,
} from "@/lib/project-scheduler-control-repository"
import {
  getStoredProjectReportExportPayload,
  listStoredProjectFindings,
} from "@/lib/project-results-repository"
import {
  getStoredProjectById,
  getStoredProjectDetailById,
  listStoredAuditLogs,
  listStoredProjects,
} from "@/lib/project-repository"
import { prisma } from "@/lib/prisma"
import { toOrchestratorRoundRecord } from "@/lib/prisma-transforms"
import { listStoredWorkLogs } from "@/lib/work-log-repository"
import type {
  ApprovalCollectionPayload,
  ApprovalControlPatch,
  ApprovalDecisionInput,
  ApprovalPolicyPayload,
  AssetCollectionView,
  DashboardPayload,
  DashboardRecentResultRecord,
  DashboardSystemRecord,
  LlmProfileRecord,
  McpResultMapping,
  McpSettingsPayload,
  McpToolRecord,
  ProjectCollectionPayload,
  ProjectContextPayload,
  ProjectFlowPayload,
  ProjectOperationsPayload,
  ProjectOverviewPayload,
  ProjectRecord,
  SettingsSectionsPayload,
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
        delta: assets.length > 0 ? `${assets.filter((asset) => asset.scopeStatus !== "已纳入").length} 个待确认` : "等待真实资产回流",
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
  const pendingAssets = assets.filter((asset) => asset.scopeStatus !== "已纳入")
  const abnormalTools = mcpTools.filter((tool) => tool.status === "异常")
  const blockedProjects = projects.filter((project) => project.status === "已阻塞")

  if (pendingApprovals.length > 0) {
    priorities.push({
      title: "审批队列待清理",
      detail: `${pendingApprovals.length} 个动作仍在等待人工确认，优先恢复被阻塞项目的主路径。`,
      tone: "danger",
    })
  }

  if (pendingAssets.length > 0) {
    priorities.push({
      title: "待确认资产需要回流",
      detail: `${pendingAssets.length} 个对象仍待确认或复核，建议先补归属再推进下一步验证。`,
      tone: "warning",
    })
  }

  if (abnormalTools.length > 0) {
    priorities.push({
      title: "MCP 工具健康待处理",
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

function buildMcpSettingsMetric(tools: McpToolRecord[]) {
  const enabledCount = tools.filter((tool) => tool.status === "启用").length
  const abnormalCount = tools.filter((tool) => tool.status === "异常").length

  return `${enabledCount} 启用 / ${abnormalCount} 异常`
}

function buildLlmSettingsMetric(profiles: LlmProfileRecord[]) {
  const enabledProfiles = profiles.filter((profile) => profile.enabled && profile.model).length

  return enabledProfiles > 0 ? `${enabledProfiles} 套已启用` : "等待配置"
}

function buildCapabilityPayloadFromTools(tools: McpToolRecord[]) {
  return mcpCapabilityRecords.map((capability) => ({
    ...capability,
    connectedTools: tools.filter((tool) => tool.capability === capability.name).map((tool) => tool.toolName),
  }))
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
            : "所有已注册 MCP 工具当前均处于健康状态。",
        tone: tools.length === 0 ? "neutral" : abnormalTools.length > 0 ? "danger" : "success",
      }
    }

    if (card.title === "调度队列") {
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
            ? "当前还没有独立浏览器/截图采集节点，但 Web 页面探测链路仍可回流基础入口证据。"
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

async function getProjectBase(projectId: string) {
  const project = await getStoredProjectById(projectId)
  const detail = await getStoredProjectDetailById(projectId)

  if (!project || !detail) {
    return null
  }

  return { project, detail }
}

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
      href: `/projects/${finding.projectId}/results/findings`,
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
      tone: asset.scopeStatus === "已纳入" ? ("success" as const) : ("warning" as const),
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
      tone: project.status === "已阻塞" ? ("danger" as const) : ("neutral" as const),
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
      title: "MCP 工具",
      value: `${mcpTools.filter((tool) => tool.status === "启用").length} / ${mcpTools.length}`,
      detail: "当前已启用 MCP 工具数量。",
      href: "/settings/mcp-tools",
      tone: mcpTools.some((tool) => tool.status === "异常") ? "warning" : "success",
    },
    {
      title: "LLM 模型",
      value: [...new Set(enabledModels.map((profile) => profile.model))].join(" / ") || "未配置",
      detail: "当前参与编排的模型配置。",
      href: "/settings/llm",
      tone: enabledModels.length > 0 ? "info" : "warning",
    },
    {
      title: "调度队列",
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

// ──────────────────────────────────────────────
// Exported composition functions (8)
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

export async function getSettingsSectionsPayload(): Promise<SettingsSectionsPayload> {
  const auditTotal = (await listStoredAuditLogs()).length
  const approvalControl = await getStoredGlobalApprovalControl()
  const llmProfiles = await listStoredLlmProfiles()
  const mcpTools = await listStoredMcpTools()
  const workLogTotal = (await listStoredWorkLogs()).length

  return {
    items: settingsSections.map((section) => {
      if (section.href === "/settings/mcp-tools") {
        return {
          ...section,
          metric: buildMcpSettingsMetric(mcpTools),
        }
      }

      if (section.href === "/settings/llm") {
        return {
          ...section,
          metric: buildLlmSettingsMetric(llmProfiles),
        }
      }

      if (section.href === "/settings/approval-policy") {
        return {
          ...section,
          metric: approvalControl.enabled ? "高风险审批开启" : "审批临时关闭",
        }
      }

      if (section.href === "/settings/audit-logs") {
        return {
          ...section,
          metric: `${auditTotal} 条审计记录`,
        }
      }

      if (section.href === "/settings/work-logs") {
        return {
          ...section,
          metric: `${workLogTotal} 条工作日志`,
        }
      }

      return section
    }),
    total: settingsSections.length,
  }
}

export async function getMcpSettingsPayload(): Promise<McpSettingsPayload> {
  const tools = await listStoredMcpTools()
  const dbServerContracts = await prisma.mcpServerContract.findMany()
  const dbToolContracts = await prisma.mcpToolContract.findMany()

  return {
    tools,
    servers: await listStoredMcpServers(),
    recentInvocations: await listStoredMcpServerInvocations(undefined, 6),
    capabilities: buildCapabilityPayloadFromTools(tools),
    boundaryRules: mcpBoundaryRules,
    registrationFields: mcpRegistrationFields,
    serverContracts: dbServerContracts.map((row) => ({
      serverId: row.serverId,
      serverName: row.serverName,
      version: row.version,
      transport: row.transport as "stdio" | "streamable_http" | "sse",
      enabled: row.enabled,
      toolNames: row.toolNames,
      command: row.command ?? undefined,
      endpoint: row.endpoint,
      projectId: row.projectId ?? undefined,
      updatedAt: row.updatedAt.toISOString(),
    })),
    toolContracts: dbToolContracts.map((row) => ({
      serverId: row.serverId,
      serverName: row.serverName,
      toolName: row.toolName,
      title: row.title,
      capability: row.capability,
      boundary: row.boundary as "外部目标交互" | "平台内部处理" | "外部第三方API",
      riskLevel: row.riskLevel as "高" | "中" | "低",
      requiresApproval: row.requiresApproval,
      resultMappings: row.resultMappings as McpResultMapping[],
      projectId: row.projectId ?? undefined,
      updatedAt: row.updatedAt.toISOString(),
    })),
  }
}

export async function updateApprovalDecisionPayload(approvalId: string, input: ApprovalDecisionInput) {
  const approval = await updateStoredApprovalDecision(approvalId, input)

  if (!approval) {
    return approval
  }

  await syncStoredSchedulerTaskAfterApprovalDecision(approval)

  if (approval.status === "已批准") {
    const linkedRunId = (await listStoredMcpRuns()).find((item) => item.linkedApprovalId === approval.id)?.id

    if (linkedRunId) {
      await drainStoredSchedulerTasks({
        runId: linkedRunId,
        ignoreProjectLifecycle: true,
      })
    }

    const schedulerControl = await getStoredProjectSchedulerControl(approval.projectId)

    if (schedulerControl?.lifecycle === "running") {
      await runProjectLifecycleKickoff(approval.projectId, {
        controlCommand: "resume",
        note: "审批通过后，继续根据当前结果推进项目后续动作并判断是否可以收束。",
      })
    }
  }

  return approval
}

export async function updateProjectSchedulerControlPayload(
  projectId: string,
  patch: Parameters<typeof updateStoredProjectSchedulerControl>[1],
) {
  const payload = await updateStoredProjectSchedulerControl(projectId, patch)

  if (!payload) {
    return null
  }

  if ("status" in payload && typeof payload.status === "number" && "error" in payload) {
    return payload
  }

  if (!('transition' in payload)) {
    return payload
  }

  if (payload.transition.changedLifecycle) {
    if (payload.transition.nextLifecycle === "running") {
      await runProjectLifecycleKickoff(projectId, {
        controlCommand: payload.transition.previousLifecycle === "paused" ? "resume" : "start",
        note: payload.schedulerControl.note,
      })
    }

    if (payload.transition.nextLifecycle === "stopped") {
      await stopStoredProjectSchedulerTasks(projectId, payload.schedulerControl.note)
    }
  }

  const refreshedProject = await getStoredProjectById(projectId)
  const refreshedDetail = await getStoredProjectDetailById(projectId)
  const refreshedControl = await getStoredProjectSchedulerControl(projectId)

  if (!refreshedProject || !refreshedDetail || !refreshedControl) {
    return payload
  }

  return {
    detail: refreshedDetail,
    project: refreshedProject,
    schedulerControl: refreshedControl,
    transition: payload.transition,
  }
}

export async function getApprovalPolicyPayload(): Promise<ApprovalPolicyPayload> {
  const approvalControl = await getStoredGlobalApprovalControl()

  return {
    overview: systemControlOverview.map((item, index) =>
      index === 3
        ? {
            ...item,
            value: approvalControl.enabled ? "审批链路已开启" : "审批链路已关闭",
            description: approvalControl.note,
          }
        : item,
    ),
    approvalControl,
    approvalPolicies: await listStoredApprovalPolicies(),
    scopeRules: await listStoredScopeRules(),
  }
}

export async function getSystemStatusPayload(): Promise<SystemStatusPayload> {
  const items = await buildSystemStatusPayloadFromTools(await listStoredMcpTools())

  return {
    items,
    total: items.length,
  }
}
