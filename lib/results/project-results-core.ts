import { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import {
  toProjectRecord,
  toProjectDetailRecord,
  toProjectConclusionRecord,
  toFindingRecord,
  fromFindingRecord,
  toAssetRecord,
  toEvidenceRecord,
  toApprovalRecord,
  toMcpRunRecord,
  toLogRecord,
  toSchedulerTaskRecord,
} from "@/lib/prisma-transforms"
import { buildProjectClosureStatus } from "@/lib/project-closure-status"
import { formatTimestamp, toDisplayCount } from "@/lib/prototype-record-utils"
import { SINGLE_USER_LABEL } from "@/lib/project-targets"
import type {
  ApprovalRecord,
  AssetRecord,
  EvidenceRecord,
  LogRecord,
  McpRunRecord,
  ProjectConclusionRecord,
  ProjectDetailRecord,
  ProjectFindingRecord,
  ProjectInventoryGroup,
  ProjectKnowledgeItem,
  ProjectRecord,
  ProjectResultMetric,
  ProjectStage,
  ProjectStageSnapshot,
  ProjectSchedulerLifecycle,
  TimelineStage,
  Tone,
} from "@/lib/prototype-types"

const stageOrder: ProjectStage[] = [
  "授权与范围定义",
  "种子目标接收",
  "持续信息收集",
  "目标关联与范围判定",
  "发现与指纹识别",
  "待验证项生成",
  "审批前排队",
  "受控 PoC 验证",
  "证据归档与结果判定",
  "风险聚合与项目结论",
  "报告与回归验证",
]

function isDomainAsset(asset: AssetRecord) {
  return ["domain", "subdomain"].includes(asset.type)
}

function isSiteAsset(asset: AssetRecord) {
  return ["entry", "web", "api"].includes(asset.type)
}

function isNetworkAsset(asset: AssetRecord) {
  return ["host", "ip", "port", "service"].includes(asset.type)
}

function scopeTone(scopeStatus: AssetRecord["scopeStatus"]): Tone {
  if (scopeStatus === "已确认") {
    return "success"
  }

  if (scopeStatus === "待验证") {
    return "warning"
  }

  return "info"
}

function statusTone(status: string): Tone {
  if (status.includes("阻塞") || status.includes("拒绝")) {
    return "danger"
  }

  if (status.includes("延后") || status.includes("复核") || status.includes("待")) {
    return "warning"
  }

  if (status.includes("完成") || status.includes("执行")) {
    return "success"
  }

  return "info"
}

function buildAssetGroups(assets: AssetRecord[]): ProjectInventoryGroup[] {
  const domainAndSiteAssets = assets.filter((a) => isDomainAsset(a) || isSiteAsset(a))
  const networkAssets = assets.filter(isNetworkAsset)

  return [
    {
      title: "域名 / Web 入口",
      description: "域名、子域名、后台入口和 API/Web 暴露面统一放在这里，适合直接横向查看当前结果面。",
      count: toDisplayCount(domainAndSiteAssets.length),
      items: domainAndSiteAssets.map((asset) => ({
        primary: asset.label,
        secondary: `${asset.profile}。${asset.exposure}`,
        meta: asset.type === "api" ? "API / Web" : asset.type,
        status: asset.scopeStatus,
        tone: scopeTone(asset.scopeStatus),
      })),
    },
    {
      title: "IP / 端口 / 服务",
      description: "网络侧结果与服务画像集中成表，方便后续扩展大规模开放端口与版本线索。",
      count: toDisplayCount(networkAssets.length),
      items: networkAssets.map((asset) => ({
        primary: `${asset.host}${asset.label ? ` / ${asset.label}` : ""}`,
        secondary: `${asset.profile}。${asset.exposure}`,
        meta: asset.type,
        status: asset.scopeStatus,
        tone: scopeTone(asset.scopeStatus),
      })),
    },
  ]
}

function buildResultMetrics(
  domainAssets: AssetRecord[],
  siteAssets: AssetRecord[],
  networkAssets: AssetRecord[],
  findings: ProjectFindingRecord[],
): ProjectResultMetric[] {
  const openPortCount = networkAssets.filter((asset) => asset.type === "port").length
  const highRiskCount = findings.filter((finding) => finding.severity === "高危").length

  return [
    {
      label: "域名",
      value: String(domainAssets.length),
      note: domainAssets.length > 0 ? "已发现域名和子域名资产。" : "等待识别",
      tone: domainAssets.length > 0 ? "success" : "neutral",
    },
    {
      label: "站点",
      value: String(siteAssets.length),
      note: siteAssets.length > 0 ? "已发现 Web 入口和 API 暴露面。" : "等待识别",
      tone: siteAssets.length > 0 ? "info" : "neutral",
    },
    {
      label: "开放端口",
      value: String(openPortCount),
      note: openPortCount > 0 ? "已发现开放端口和运行服务。" : "等待识别",
      tone: openPortCount > 0 ? "info" : "neutral",
    },
    {
      label: "漏洞线索",
      value: String(findings.length),
      note: findings.length > 0 ? `${highRiskCount} 条高危或待复核结果已形成列表。` : "等待验证",
      tone: findings.length > 0 ? "warning" : "neutral",
    },
  ]
}

function dedupeKnowledgeItems(items: ProjectKnowledgeItem[]) {
  const seen = new Set<string>()

  return items.filter((item) => {
    const key = `${item.title}::${item.meta}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function buildDerivedKnowledge(
  detail: ProjectDetailRecord,
  assets: AssetRecord[],
  evidence: ProjectDetailRecord["findings"][number]["evidenceId"][],
  evidenceRecords: EvidenceRecord[],
  approvals: ApprovalRecord[],
  runs: McpRunRecord[],
  workLogs: LogRecord[],
) {
  const derivedDiscoveredInfo: ProjectKnowledgeItem[] = evidenceRecords.slice(0, 3).map((record) => ({
    title: record.title,
    detail: record.structuredSummary[0] ?? record.verdict,
    meta: record.source,
    tone: record.conclusion.includes("问题") ? "warning" : "info",
  }))

  const derivedServiceSurface: ProjectKnowledgeItem[] = assets
    .filter(isNetworkAsset)
    .slice(0, 4)
    .map((asset) => ({
      title: `${asset.host} · ${asset.label}`,
      detail: asset.profile,
      meta: asset.type,
      tone: scopeTone(asset.scopeStatus),
    }))

  const derivedFingerprints: ProjectKnowledgeItem[] = assets
    .filter((asset) => asset.profile.length > 0)
    .slice(0, 4)
    .map((asset) => ({
      title: asset.profile,
      detail: asset.issueLead,
      meta: asset.host,
      tone: asset.issueLead ? "warning" : "info",
    }))

  const derivedEntries: ProjectKnowledgeItem[] = assets
    .filter((a) => isDomainAsset(a) || isSiteAsset(a))
    .slice(0, 4)
    .map((asset) => ({
      title: asset.label,
      detail: asset.exposure,
      meta: asset.host,
      tone: scopeTone(asset.scopeStatus),
    }))

  const derivedScheduler: ProjectKnowledgeItem[] = [
    ...approvals
      .filter((approval) => approval.status === "待处理")
      .slice(0, 2)
      .map((approval) => ({
        title: `审批待处理 · ${approval.actionType}`,
        detail: approval.blockingImpact,
        meta: approval.tool,
        tone: "danger" as const,
      })),
    ...runs
      .filter((run) => run.status === "已延后" || run.status === "已阻塞")
      .slice(0, 2)
      .map((run) => ({
        title: `${run.requestedAction} · ${run.status}`,
        detail: run.summaryLines.at(-1) ?? run.summaryLines[0] ?? "调度状态已更新。",
        meta: run.toolName,
        tone: statusTone(run.status),
      })),
  ]

  const derivedActivity: ProjectKnowledgeItem[] = workLogs.slice(0, 4).map((log) => ({
    title: log.category,
    detail: log.summary,
    meta: `${log.actor} · ${log.timestamp}`,
    tone: statusTone(log.status),
  }))

  return {
    discoveredInfo: dedupeKnowledgeItems([...derivedDiscoveredInfo, ...detail.discoveredInfo]).slice(0, 6),
    serviceSurface: dedupeKnowledgeItems([...derivedServiceSurface, ...detail.serviceSurface]).slice(0, 6),
    fingerprints: dedupeKnowledgeItems([...derivedFingerprints, ...detail.fingerprints]).slice(0, 6),
    entries: dedupeKnowledgeItems([...derivedEntries, ...detail.entries]).slice(0, 6),
    scheduler: dedupeKnowledgeItems([...derivedScheduler, ...detail.scheduler]).slice(0, 6),
    activity: dedupeKnowledgeItems([...derivedActivity, ...detail.activity]).slice(0, 8),
  }
}

function resolveCurrentStage(
  project: ProjectRecord,
  approvals: ApprovalRecord[],
  runs: McpRunRecord[],
  findings: ProjectFindingRecord[],
  evidenceCount: number,
  finalConclusion: ProjectConclusionRecord | null,
): ProjectStageSnapshot {
  const pendingApprovals = approvals.filter((approval) => approval.status === "待处理")
  const approvedValidationRun = runs.find(
    (run) => run.toolName === "auth-guard-check" && run.status === "已执行",
  )
  const reportRun = runs.find((run) => run.toolName === "report-exporter" && run.status === "已执行")

  let title: ProjectStage = project.stage
  let summary = project.summary
  let blocker = project.riskSummary

  if (finalConclusion) {
    return {
      title: "风险聚合与项目结论",
      summary: finalConclusion.summary,
      blocker: "项目已经形成最终结论，当前无新的待处理审批或调度阻塞。",
      owner: finalConclusion.source === "reviewer" ? "结果审阅模型" : SINGLE_USER_LABEL,
      updatedAt: finalConclusion.generatedAt,
    }
  }

  if (reportRun) {
    title = findings.length > 0 ? "风险聚合与项目结论" : "报告与回归验证"
    summary = findings.length > 0 ? "报告摘要与发现列表已经具备，可以继续进入结论整理。" : "基础流程结果已导出，可继续做继续采集。"
    blocker = pendingApprovals.length > 0 ? "仍有审批动作未处理，会影响下一轮高风险验证。" : "当前无硬阻塞，可继续扩展执行。"
  } else if (approvedValidationRun || findings.length > 0) {
    title = findings.length > 0 ? "证据归档与结果判定" : "受控 PoC 验证"
    summary = findings.length > 0 ? "高风险验证已形成初步问题与证据，需要继续复核结论。" : "审批通过后的验证已恢复执行。"
    blocker = pendingApprovals.length > 0 ? "后续高风险动作仍受审批约束。" : "当前重点转向证据归档与结果判定。"
  } else if (evidenceCount > 0) {
    title = "发现与指纹识别"
    summary = "被动情报和入口识别已经形成可复核结果。"
    blocker = pendingApprovals.length > 0 ? "待审批动作会阻塞继续深入验证。" : "当前无硬阻塞，可继续扩展结果面。"
  } else if (runs.some((run) => run.toolName === "dns-census" && run.status === "已执行")) {
    title = "目标关联与范围判定"
    summary = "子域与候选目标已被发现，等待继续同步入口和归属。"
    blocker = pendingApprovals.length > 0 ? "审批动作仍在队列中。" : "继续推进 Web 和服务面识别。"
  } else if (runs.some((run) => run.toolName === "seed-normalizer" && run.status === "已执行")) {
    title = "持续信息收集"
    summary = "种子目标已标准化，正在展开被动情报采集。"
    blocker = pendingApprovals.length > 0 ? "审批动作仍在队列中。" : "继续采集 DNS、证书和页面入口。"
  }

  return {
    title,
    summary,
    blocker,
    owner: pendingApprovals.length > 0 ? "审批中心" : findings.length > 0 ? "证据中心" : SINGLE_USER_LABEL,
    updatedAt: project.lastUpdated || formatTimestamp(),
  }
}

function buildTimeline(currentStage: ProjectStageSnapshot, blocked: boolean): TimelineStage[] {
  const currentIndex = stageOrder.indexOf(currentStage.title as ProjectStage)

  return stageOrder.map((stage, index) => {
    let state: TimelineStage["state"] = "watching"

    if (index < currentIndex) {
      state = "done"
    } else if (index === currentIndex) {
      state = blocked ? "blocked" : "current"
    }

    return {
      title: stage,
      state,
      note:
        stage === currentStage.title
          ? currentStage.summary
          : index < currentIndex
            ? "上一阶段结果已沉淀到项目记录。"
            : "等待主路径或审批状态继续推进。",
    }
  })
}

// ──────────────────────────────────────────────
// Exported: findings CRUD
// ──────────────────────────────────────────────

export async function listStoredProjectFindings(projectId?: string) {
  const rows = await prisma.finding.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { updatedAt: "desc" },
  })
  return rows.map(toFindingRecord)
}

export async function upsertStoredProjectFindings(records: ProjectFindingRecord[]) {
  if (!records.length) {
    return []
  }

  await prisma.$transaction(
    records.map((record) => {
      const data = fromFindingRecord(record)
      return prisma.finding.upsert({
        where: { id: record.id },
        create: data,
        update: data,
      })
    }),
  )
  return records
}

// ──────────────────────────────────────────────
// Exported: conclusion queries
// ──────────────────────────────────────────────

export async function listStoredProjectConclusions(projectId?: string) {
  const rows = await prisma.projectConclusion.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { generatedAt: "desc" },
  })
  return rows.map(toProjectConclusionRecord)
}

export async function getStoredProjectLatestConclusion(projectId: string) {
  const row = await prisma.projectConclusion.findFirst({
    where: { projectId },
    orderBy: { generatedAt: "desc" },
  })
  return row ? toProjectConclusionRecord(row) : null
}

// ──────────────────────────────────────────────
// Exported: project results refresh
// ──────────────────────────────────────────────

export async function refreshStoredProjectResults(projectId: string) {
  const [projectRow, detailRow] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.projectDetail.findUnique({ where: { projectId } }),
  ])
  if (!projectRow || !detailRow) return null

  const project = toProjectRecord(projectRow)
  const detail = toProjectDetailRecord(detailRow)

  // Parallel reads
  const [
    assetRows,
    evidenceRows,
    findingRows,
    approvalRows,
    runRows,
    taskRows,
    conclusionRow,
    schedulerControlRow,
    workLogRows,
  ] = await Promise.all([
    prisma.asset.findMany({ where: { projectId } }),
    prisma.evidence.findMany({ where: { projectId } }),
    prisma.finding.findMany({ where: { projectId } }),
    prisma.approval.findMany({ where: { projectId } }),
    prisma.mcpRun.findMany({ where: { projectId } }),
    prisma.schedulerTask.findMany({ where: { projectId } }),
    prisma.projectConclusion.findUnique({ where: { projectId } }),
    prisma.projectSchedulerControl.findUnique({ where: { projectId } }),
    prisma.workLog.findMany({ where: { projectName: project.name }, orderBy: { timestamp: "desc" }, take: 10 }),
  ])

  const projectAssets = assetRows.map(toAssetRecord)
  const projectEvidence = evidenceRows.map(toEvidenceRecord)
  const projectFindings = findingRows.map(toFindingRecord)
  const projectApprovals = approvalRows.map(toApprovalRecord)
  const projectRuns = runRows.map(toMcpRunRecord)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectSchedulerTasks = taskRows.map((r: any) => toSchedulerTaskRecord(r))
  const latestConclusion = conclusionRow ? toProjectConclusionRecord(conclusionRow) : null
  const projectWorkLogs = workLogRows.map(toLogRecord)

  const schedulerLifecycle = (schedulerControlRow?.lifecycle ?? (project.status === "待启动" ? "idle" : "running")) as ProjectSchedulerLifecycle
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const waitingApprovalTaskCount = projectSchedulerTasks.filter((t: any) => t.status === "waiting_approval").length
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runningTaskCount = projectSchedulerTasks.filter((t: any) => t.status === "running").length
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queuedTaskCount = projectSchedulerTasks.filter((t: any) => ["ready", "retry_scheduled", "delayed"].includes(t.status)).length
  const reportExported = projectRuns.some((run) => run.toolName === "report-exporter" && run.status === "已执行")
  const domainAssets = projectAssets.filter(isDomainAsset)
  const siteAssets = projectAssets.filter(isSiteAsset)
  const networkAssets = projectAssets.filter(isNetworkAsset)
  const pendingApprovals = projectApprovals.filter((approval) => approval.status === "待处理").length

  const currentStage = resolveCurrentStage(
    project, projectApprovals, projectRuns, projectFindings, projectEvidence.length, latestConclusion,
  )
  const closureStatus = buildProjectClosureStatus({
    finalConclusionGenerated: latestConclusion !== null,
    lifecycle: schedulerLifecycle,
    pendingApprovals,
    projectStatus: project.status,
    queuedTaskCount,
    reportExported,
    runningTaskCount,
    waitingApprovalTaskCount,
  })
  const derivedKnowledge = buildDerivedKnowledge(
    detail, projectAssets,
    projectFindings.map((f) => f.evidenceId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    projectEvidence as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    projectApprovals, projectRuns, projectWorkLogs as any,
  )

  const openTasks = latestConclusion
    ? 0
    : Math.max(
        detail.tasks.filter((task) => !["succeeded", "cancelled"].includes(task.status)).length +
          projectRuns.filter((run) => ["待审批", "已阻塞", "已延后"].includes(run.status)).length,
        pendingApprovals + projectFindings.filter((finding) => finding.status !== "已缓解").length,
      )

  const nextProjectStatus =
    latestConclusion ? "已完成"
      : project.status === "已完成" ? "已完成"
      : project.status === "已停止" ? "已停止"
      : project.status === "已暂停" ? "已暂停"
      : pendingApprovals > 0 ? "等待审批"
      : projectAssets.length > 0 || projectEvidence.length > 0 ? "运行中"
      : project.status

  const nextSummary = latestConclusion
    ? latestConclusion.summary
    : projectFindings.length > 0
      ? `结果面已沉淀 ${projectAssets.length} 条资产、${projectEvidence.length} 条证据和 ${projectFindings.length} 条漏洞/发现，项目可以继续围绕现有结果推进。`
      : projectAssets.length > 0 || projectEvidence.length > 0
        ? `结果面已沉淀 ${projectAssets.length} 条资产和 ${projectEvidence.length} 条证据，当前重点是继续把结果做厚，而不是回到流程细节。`
        : project.summary

  const nextRiskSummary = latestConclusion
    ? latestConclusion.keyPoints.join("；")
    : projectFindings.length > 0
      ? `${projectFindings.filter((f) => f.severity === "高危").length} 条高危或待复核发现已形成列表。`
      : pendingApprovals > 0
        ? `${pendingApprovals} 个高风险动作仍在等待审批。`
        : projectEvidence.length > 0
          ? "已有证据与入口线索，可继续补厚结果面。"
          : project.riskSummary

  await prisma.project.updateMany({
    where: { id: projectId },
    data: {
      stage: currentStage.title as ProjectStage,
      status: nextProjectStatus,
      pendingApprovals,
      openTasks,
      assetCount: projectAssets.length,
      evidenceCount: projectEvidence.length,
      summary: nextSummary,
      riskSummary: nextRiskSummary,
    },
  })

  const nextBlockingReason = latestConclusion
    ? "项目已完成当前轮次并形成最终结论，当前没有新的审批或调度阻塞。"
    : pendingApprovals > 0
      ? `当前仍有 ${pendingApprovals} 个待审批动作，后续高风险验证会继续受控推进。`
      : projectFindings.length > 0
        ? "当前没有硬阻塞，重点转为复核现有问题、补齐证据和继续扩展结果面。"
        : "当前没有硬阻塞，可继续采集域名、服务和 Web 入口结果。"

  const nextStep = latestConclusion
    ? "查看最终结论与报告摘要，如需继续扩展测试，请新建下一轮项目。"
    : projectFindings.length > 0
      ? "优先在漏洞与发现页复核当前问题，同时补齐关联证据与受影响资产。"
      : domainAssets.length > 0
        ? "继续围绕域名、站点和网络面补厚当前项目结果。"
        : "继续推进被动情报采集和入口识别。"

  const currentFocus = latestConclusion
    ? "当前项目已自动收尾，重点转为复核最终结论、报告摘要和导出结果。"
    : projectFindings.length > 0
      ? "先围绕已出现的漏洞与发现补厚证据，再决定是否扩展验证。"
      : pendingApprovals > 0
        ? "优先处理审批阻塞，并确保已到手的资产和证据先沉淀到结果页。"
        : "优先扩大当前可见资产、入口和证据的覆盖面。"

  const updatedDetailData = {
    blockingReason: nextBlockingReason,
    nextStep,
    currentFocus,
    timeline: buildTimeline(currentStage, latestConclusion ? false : pendingApprovals > 0) as unknown as Prisma.InputJsonArray,
    resultMetrics: buildResultMetrics(domainAssets, siteAssets, networkAssets, projectFindings) as unknown as Prisma.InputJsonArray,
    assetGroups: buildAssetGroups(projectAssets) as unknown as Prisma.InputJsonArray,
    closureStatus: closureStatus as unknown as Prisma.InputJsonObject,
    finalConclusion: latestConclusion as unknown as Prisma.InputJsonObject ?? undefined,
    currentStage: currentStage as unknown as Prisma.InputJsonObject,
    discoveredInfo: derivedKnowledge.discoveredInfo as unknown as Prisma.InputJsonArray,
    serviceSurface: derivedKnowledge.serviceSurface as unknown as Prisma.InputJsonArray,
    fingerprints: derivedKnowledge.fingerprints as unknown as Prisma.InputJsonArray,
    entries: derivedKnowledge.entries as unknown as Prisma.InputJsonArray,
    scheduler: derivedKnowledge.scheduler as unknown as Prisma.InputJsonArray,
    activity: derivedKnowledge.activity as unknown as Prisma.InputJsonArray,
  }

  const updatedDetailRow = await prisma.projectDetail.update({
    where: { projectId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: updatedDetailData as any,
  })
  const updatedProjectRow = await prisma.project.findUnique({ where: { id: projectId } })

  return {
    project: toProjectRecord(updatedProjectRow!),
    detail: toProjectDetailRecord(updatedDetailRow),
  }
}
