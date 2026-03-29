import { buildProjectReviewerPrompt } from "@/lib/llm-brain-prompt"
import { resolveLlmProvider } from "@/lib/llm-provider/registry"
import { buildProjectClosureStatus } from "@/lib/project-closure-status"
import { formatTimestamp, toDisplayCount } from "@/lib/prototype-record-utils"
import { SINGLE_USER_LABEL } from "@/lib/project-targets"
import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import type {
  ApprovalRecord,
  AssetRecord,
  McpRunRecord,
  ProjectDetailRecord,
  ProjectConclusionRecord,
  ProjectFindingRecord,
  ProjectInventoryGroup,
  ProjectKnowledgeItem,
  ProjectRecord,
  ProjectReportExportPayload,
  ProjectReportExportRecord,
  ProjectResultMetric,
  ProjectStage,
  ProjectStageSnapshot,
  TimelineStage,
  Tone,
} from "@/lib/prototype-types"
import { upsertStoredWorkLogs } from "@/lib/work-log-repository"

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
  return ["domain", "subdomain", "entry", "web", "api"].includes(asset.type)
}

function isNetworkAsset(asset: AssetRecord) {
  return ["ip", "port", "service"].includes(asset.type)
}

function scopeTone(scopeStatus: AssetRecord["scopeStatus"]): Tone {
  if (scopeStatus === "已纳入") {
    return "success"
  }

  if (scopeStatus === "待确认") {
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
  const domainAssets = assets.filter(isDomainAsset)
  const networkAssets = assets.filter(isNetworkAsset)

  return [
    {
      title: "域名 / Web 入口",
      description: "域名、后台入口、路径入口和 API/Web 暴露面统一放在这里，适合直接横向查看当前结果面。",
      count: toDisplayCount(domainAssets.length),
      items: domainAssets.map((asset) => ({
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
  networkAssets: AssetRecord[],
  findings: ProjectFindingRecord[],
  evidenceCount: number,
): ProjectResultMetric[] {
  const openPortCount = networkAssets.filter((asset) => asset.type === "port").length
  const highRiskCount = findings.filter((finding) => finding.severity === "高危").length

  return [
    {
      label: "已纳入域名",
      value: String(domainAssets.length),
      note: domainAssets.length > 0 ? "域名、Web 入口和 API 面已回流到独立结果表。" : "等待识别",
      tone: domainAssets.length > 0 ? "success" : "neutral",
    },
    {
      label: "开放端口",
      value: String(openPortCount),
      note: openPortCount > 0 ? "网络侧开放端口与服务画像已入库。" : "等待识别",
      tone: openPortCount > 0 ? "info" : "neutral",
    },
    {
      label: "漏洞线索",
      value: String(findings.length),
      note: findings.length > 0 ? `${highRiskCount} 条高危或待复核结果已形成列表。` : "等待验证",
      tone: findings.length > 0 ? "warning" : "neutral",
    },
    {
      label: "证据锚点",
      value: String(evidenceCount),
      note: evidenceCount > 0 ? "证据摘要与原始输出可继续在上下文页复核。" : "等待采样",
      tone: evidenceCount > 0 ? "info" : "neutral",
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
  evidenceRecords: ReturnType<typeof readPrototypeStore>["evidenceRecords"],
  approvals: ApprovalRecord[],
  runs: McpRunRecord[],
  workLogs: ReturnType<typeof readPrototypeStore>["workLogs"],
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
    .filter(isDomainAsset)
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
    summary = findings.length > 0 ? "报告摘要与发现列表已经具备，可以继续进入结论整理。" : "基础流程结果已导出，可继续做回归补采。"
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
    summary = "子域与候选目标已被发现，等待继续回流入口和归属。"
    blocker = pendingApprovals.length > 0 ? "审批动作仍在队列中。" : "继续推进 Web 和服务面识别。"
  } else if (runs.some((run) => run.toolName === "seed-normalizer" && run.status === "已执行")) {
    title = "持续信息收集"
    summary = "种子目标已标准化，正在展开被动情报补采。"
    blocker = pendingApprovals.length > 0 ? "审批动作仍在队列中。" : "继续补采 DNS、证书和页面入口。"
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

function parseReportDigestFromLog(summary: string) {
  const marker = "项目报告摘要已导出："
  const digest = summary.includes(marker) ? summary.slice(summary.indexOf(marker) + marker.length).trim() : ""

  if (!digest) {
    return []
  }

  return digest
    .split("；")
    .map((line) => line.trim())
    .filter(Boolean)
}

function normalizeConclusionSummary(summary: string, fallback: string) {
  const trimmed = summary.trim() || fallback.trim()

  if (!trimmed) {
    return "最终结论：当前项目已收束，但还没有足够结果可供展示。"
  }

  return trimmed.startsWith("最终结论：") ? trimmed : `最终结论：${trimmed}`
}

function buildFallbackConclusionRecord(input: {
  assetCount: number
  evidenceCount: number
  findingCount: number
  projectId: string
}): Omit<ProjectConclusionRecord, "generatedAt" | "id" | "source"> {
  const findingLead =
    input.findingCount > 0
      ? `当前累计 ${input.findingCount} 条漏洞/发现，后续重点应围绕这些结果做复核与修复追踪。`
      : "当前没有新增漏洞/发现，结论以资产面与证据面为主。"

  return {
    assetCount: input.assetCount,
    evidenceCount: input.evidenceCount,
    findingCount: input.findingCount,
    keyPoints: [
      `资产 ${input.assetCount} 条`,
      `证据 ${input.evidenceCount} 条`,
      `漏洞/发现 ${input.findingCount} 条`,
    ],
    nextActions:
      input.findingCount > 0
        ? ["复核高风险发现证据", "整理修复建议并回填报告", "视需要开启下一轮验证"]
        : ["复核当前资产与证据", "确认是否需要补充更深一轮验证", "导出并归档当前报告"],
    projectId: input.projectId,
    summary: normalizeConclusionSummary(
      `本轮项目已完成首轮收束，已沉淀 ${input.assetCount} 条资产、${input.evidenceCount} 条证据和 ${input.findingCount} 条漏洞/发现。 ${findingLead}`,
      "本轮项目已完成首轮收束。",
    ),
  }
}

function buildConclusionWorkLog(record: ProjectConclusionRecord, projectName: string) {
  return {
    id: `work-project-conclusion-${record.projectId}-${record.generatedAt.replace(/[^0-9]/g, "")}`,
    category: "项目结论",
    summary: record.summary,
    projectName,
    actor: record.source === "reviewer" ? "reviewer-provider" : "reviewer-fallback",
    timestamp: record.generatedAt,
    status: "已完成",
  }
}

export function listStoredProjectConclusions(projectId?: string) {
  const conclusions = readPrototypeStore().projectConclusions

  if (!projectId) {
    return conclusions
  }

  return conclusions.filter((item) => item.projectId === projectId)
}

export function getStoredProjectLatestConclusion(projectId: string) {
  return listStoredProjectConclusions(projectId)[0] ?? null
}

export async function generateStoredProjectFinalConclusion(projectId: string) {
  const store = readPrototypeStore()
  const project = store.projects.find((item) => item.id === projectId)

  if (!project) {
    return null
  }

  const assetCount = store.assets.filter((asset) => asset.projectId === projectId).length
  const evidenceCount = store.evidenceRecords.filter((record) => record.projectId === projectId).length
  const findingCount = store.projectFindings.filter((finding) => finding.projectId === projectId).length
  const reportExport = listStoredProjectReportExports(projectId)[0] ?? null
  const existingConclusion = getStoredProjectLatestConclusion(projectId)
  const timestamp = formatTimestamp()
  const fallback = buildFallbackConclusionRecord({
    assetCount,
    evidenceCount,
    findingCount,
    projectId,
  })
  const provider = resolveLlmProvider()
  let nextRecord: ProjectConclusionRecord = {
    ...fallback,
    generatedAt: timestamp,
    id: existingConclusion?.id ?? `conclusion-${projectId}`,
    source: "fallback",
  }

  if (provider) {
    try {
      const providerResult = await provider.generatePlan({
        prompt: buildProjectReviewerPrompt({
          assetCount,
          description: project.description,
          evidenceCount,
          findingCount,
          latestReportSummary: reportExport?.summary ?? "",
          projectName: project.name,
          recentContext: store.workLogs
            .filter((log) => log.projectName === project.name)
            .slice(0, 6)
            .map((log) => `${log.category} / ${log.summary}`),
          stage: project.stage,
          targets: project.targets,
        }),
        purpose: "reviewer",
        projectId,
      })
      const reviewerKeyPoints = providerResult.content.items
        .slice(0, 3)
        .map((item) => `${item.requestedAction} @ ${item.target}`)
        .filter(Boolean)
      const reviewerNextActions = providerResult.content.items
        .slice(0, 3)
        .map((item) => item.rationale || item.requestedAction)
        .filter(Boolean)
      nextRecord = {
        ...nextRecord,
        keyPoints: reviewerKeyPoints.length > 0 ? reviewerKeyPoints : nextRecord.keyPoints,
        nextActions: reviewerNextActions.length > 0 ? reviewerNextActions : nextRecord.nextActions,
        source: "reviewer",
        summary: normalizeConclusionSummary(providerResult.content.summary, fallback.summary),
      }
    } catch {
      nextRecord = {
        ...nextRecord,
        summary: fallback.summary,
        source: "fallback",
      }
    }
  }

  store.projectConclusions = [
    nextRecord,
    ...store.projectConclusions.filter((record) => record.projectId !== projectId),
  ].sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))
  writePrototypeStore(store)
  upsertStoredWorkLogs([buildConclusionWorkLog(nextRecord, project.name)])
  refreshStoredProjectResults(projectId)

  return nextRecord
}

function toStoredProjectReportExportRecord(
  run: McpRunRecord,
  reportLogSummary: string | undefined,
  assetCount: number,
  evidenceCount: number,
  findingCount: number,
  conclusion: ProjectConclusionRecord | null,
): ProjectReportExportRecord {
  const digestLines = parseReportDigestFromLog(reportLogSummary ?? "")

  return {
    id: `report-${run.id}`,
    projectId: run.projectId,
    runId: run.id,
    exportedAt: run.updatedAt,
    summary:
      reportLogSummary ??
      run.summaryLines.at(-1) ??
      `${run.requestedAction} 已执行完成，报告导出记录已回流。`,
    digestLines: digestLines.length > 0 ? digestLines : run.summaryLines.slice(-3),
    assetCount,
    evidenceCount,
    findingCount,
    conclusionGeneratedAt: conclusion?.generatedAt ?? null,
    conclusionSource: conclusion?.source ?? null,
    conclusionSummary: conclusion?.summary ?? null,
  }
}

export function listStoredProjectReportExports(projectId: string): ProjectReportExportRecord[] {
  const store = readPrototypeStore()
  const project = store.projects.find((item) => item.id === projectId)

  if (!project) {
    return []
  }

  const projectRuns = store.mcpRuns.filter(
    (run) => run.projectId === projectId && run.toolName === "report-exporter" && run.status === "已执行",
  )
  const projectLogs = store.workLogs.filter(
    (log) => log.projectName === project.name && log.category === "报告导出",
  )
  const logByRunId = new Map(
    projectLogs
      .filter((log) => log.id.startsWith("work-run-"))
      .map((log) => [log.id.replace(/^work-/, ""), log.summary]),
  )
  const assetCount = store.assets.filter((asset) => asset.projectId === projectId).length
  const evidenceCount = store.evidenceRecords.filter((record) => record.projectId === projectId).length
  const findingCount = store.projectFindings.filter((finding) => finding.projectId === projectId).length
  const conclusion = store.projectConclusions.find((record) => record.projectId === projectId) ?? null

  return [...projectRuns]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((run) =>
      toStoredProjectReportExportRecord(
        run,
        logByRunId.get(run.id),
        assetCount,
        evidenceCount,
        findingCount,
        conclusion,
      ),
    )
}

export function getStoredProjectReportExportPayload(projectId: string): ProjectReportExportPayload {
  const records = listStoredProjectReportExports(projectId)
  const finalConclusion = getStoredProjectLatestConclusion(projectId)

  return {
    finalConclusion,
    latest: records[0] ?? null,
    totalExports: records.length,
  }
}

export function listStoredProjectFindings(projectId?: string) {
  const findings = readPrototypeStore().projectFindings

  if (!projectId) {
    return findings
  }

  return findings.filter((finding) => finding.projectId === projectId)
}

export function upsertStoredProjectFindings(records: ProjectFindingRecord[]) {
  if (!records.length) {
    return []
  }

  const store = readPrototypeStore()
  const currentFindings = new Map(store.projectFindings.map((finding) => [finding.id, finding]))

  for (const record of records) {
    currentFindings.set(record.id, record)
  }

  store.projectFindings = Array.from(currentFindings.values()).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )
  writePrototypeStore(store)

  return records
}

export function refreshStoredProjectResults(projectId: string) {
  const store = readPrototypeStore()
  const projectIndex = store.projects.findIndex((project) => project.id === projectId)
  const detailIndex = store.projectDetails.findIndex((detail) => detail.projectId === projectId)

  if (projectIndex < 0 || detailIndex < 0) {
    return null
  }

  const project = store.projects[projectIndex]
  const detail = store.projectDetails[detailIndex]
  const projectAssets = store.assets.filter((asset) => asset.projectId === projectId)
  const projectEvidence = store.evidenceRecords.filter((record) => record.projectId === projectId)
  const projectWorkLogs = store.workLogs.filter((log) => log.projectName === project.name)
  const projectFindings = store.projectFindings.filter((finding) => finding.projectId === projectId)
  const latestConclusion = store.projectConclusions.find((conclusion) => conclusion.projectId === projectId) ?? null
  const projectApprovals = store.approvals.filter((approval) => approval.projectId === projectId)
  const projectRuns = store.mcpRuns.filter((run) => run.projectId === projectId)
  const projectSchedulerTasks = store.schedulerTasks.filter((task) => task.projectId === projectId)
  const schedulerLifecycle = store.projectSchedulerControls[projectId]?.lifecycle ?? (project.status === "待处理" ? "idle" : "running")
  const waitingApprovalTaskCount = projectSchedulerTasks.filter((task) => task.status === "waiting_approval").length
  const runningTaskCount = projectSchedulerTasks.filter((task) => task.status === "running").length
  const queuedTaskCount = projectSchedulerTasks.filter((task) => ["ready", "retry_scheduled", "delayed"].includes(task.status)).length
  const reportExported = projectRuns.some((run) => run.toolName === "report-exporter" && run.status === "已执行")
  const domainAssets = projectAssets.filter(isDomainAsset)
  const networkAssets = projectAssets.filter(isNetworkAsset)
  const currentStage = resolveCurrentStage(
    project,
    projectApprovals,
    projectRuns,
    projectFindings,
    projectEvidence.length,
    latestConclusion,
  )
  const closureStatus = buildProjectClosureStatus({
    finalConclusionGenerated: latestConclusion !== null,
    lifecycle: schedulerLifecycle,
    pendingApprovals: projectApprovals.filter((approval) => approval.status === "待处理").length,
    projectStatus: project.status,
    queuedTaskCount,
    reportExported,
    runningTaskCount,
    waitingApprovalTaskCount,
  })
  const derivedKnowledge = buildDerivedKnowledge(
    detail,
    projectAssets,
    projectFindings.map((finding) => finding.evidenceId),
    projectEvidence,
    projectApprovals,
    projectRuns,
    projectWorkLogs,
  )
  const pendingApprovals = projectApprovals.filter((approval) => approval.status === "待处理").length
  const openTasks = latestConclusion
    ? 0
    : Math.max(
        detail.tasks.filter((task) => !["succeeded", "cancelled"].includes(task.status)).length +
          projectRuns.filter((run) => ["待审批", "已阻塞", "已延后"].includes(run.status)).length,
        pendingApprovals + projectFindings.filter((finding) => finding.status !== "已缓解").length,
      )

  const nextProjectStatus =
    latestConclusion
      ? "已完成"
      : project.status === "已完成"
      ? "已完成"
      : project.status === "已停止"
        ? "已停止"
        : project.status === "已暂停"
          ? "已暂停"
          : pendingApprovals > 0
            ? "已阻塞"
            : projectAssets.length > 0 || projectEvidence.length > 0
              ? "运行中"
              : project.status

  store.projects[projectIndex] = {
    ...project,
    stage: currentStage.title as ProjectStage,
    status: nextProjectStatus,
    pendingApprovals,
    openTasks,
    assetCount: projectAssets.length,
    evidenceCount: projectEvidence.length,
    summary:
      latestConclusion
        ? latestConclusion.summary
        : projectFindings.length > 0
        ? `结果面已沉淀 ${projectAssets.length} 条资产、${projectEvidence.length} 条证据和 ${projectFindings.length} 条漏洞/发现，项目可以继续围绕现有结果推进。`
        : projectAssets.length > 0 || projectEvidence.length > 0
          ? `结果面已沉淀 ${projectAssets.length} 条资产和 ${projectEvidence.length} 条证据，当前重点是继续把结果做厚，而不是回到流程细节。`
          : project.summary,
    riskSummary:
      latestConclusion
        ? latestConclusion.keyPoints.join("；")
        : projectFindings.length > 0
        ? `${projectFindings.filter((finding) => finding.severity === "高危").length} 条高危或待复核发现已形成列表。`
        : pendingApprovals > 0
          ? `${pendingApprovals} 个高风险动作仍在等待审批。`
          : projectEvidence.length > 0
            ? "已有证据与入口线索，可继续补厚结果面。"
            : project.riskSummary,
  }

  store.projectDetails[detailIndex] = {
    ...detail,
    blockingReason:
      latestConclusion
        ? "项目已完成当前轮次并形成最终结论，当前没有新的审批或调度阻塞。"
        : pendingApprovals > 0
        ? `当前仍有 ${pendingApprovals} 个待审批动作，后续高风险验证会继续受控推进。`
        : projectFindings.length > 0
          ? "当前没有硬阻塞，重点转为复核现有问题、补齐证据和继续扩展结果面。"
          : "当前没有硬阻塞，可继续补采域名、服务和 Web 入口结果。",
    nextStep:
      latestConclusion
        ? "查看最终结论与报告摘要，如需继续扩展测试，请新建下一轮项目。"
        : projectFindings.length > 0
        ? "优先在漏洞与发现页复核当前问题，同时补齐关联证据与受影响资产。"
        : domainAssets.length > 0
          ? "继续围绕 Web 入口、网络面和证据锚点补厚当前项目结果。"
          : "继续推进被动情报补采和入口识别。",
    currentFocus:
      latestConclusion
        ? "当前项目已收束，重点转为复核最终结论、报告摘要和导出结果。"
        : projectFindings.length > 0
        ? "先围绕已出现的漏洞与发现补厚证据，再决定是否扩展验证。"
        : pendingApprovals > 0
          ? "优先处理审批阻塞，并确保已到手的资产和证据先沉淀到结果页。"
          : "优先扩大当前可见资产、入口和证据的覆盖面。",
    timeline: buildTimeline(currentStage, latestConclusion ? false : pendingApprovals > 0),
    resultMetrics: buildResultMetrics(domainAssets, networkAssets, projectFindings, projectEvidence.length),
    assetGroups: buildAssetGroups(projectAssets),
    closureStatus,
    finalConclusion: latestConclusion,
    findings: projectFindings,
    currentStage,
    ...derivedKnowledge,
  }

  writePrototypeStore(store)

  return {
    project: store.projects[projectIndex],
    detail: store.projectDetails[detailIndex],
  }
}
