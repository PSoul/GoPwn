import { getStoredApprovalById } from "@/lib/approval-repository"
import { getStoredAssetById, listStoredAssets, upsertStoredAssets } from "@/lib/asset-repository"
import { isExecutionAbortError, throwIfExecutionAborted } from "@/lib/mcp-execution-abort"
import { resolveMcpConnector } from "@/lib/mcp-connectors/registry"
import {
  getHostFromTarget,
} from "@/lib/mcp-connectors/local-foundational-connectors"
import type {
  McpConnectorExecutionContext,
  McpConnectorResult,
} from "@/lib/mcp-connectors/types"
import { getStoredEvidenceById, upsertStoredEvidence } from "@/lib/evidence-repository"
import {
  getStoredMcpRunById,
  updateStoredMcpRun,
} from "@/lib/mcp-gateway-repository"
import { getStoredMcpToolById } from "@/lib/mcp-repository"
import { getStoredSchedulerTaskByRunId } from "@/lib/mcp-scheduler-repository"
import { analyzeAndWriteback } from "@/lib/llm-writeback-service"
import { buildStableRecordId, formatDayStamp, formatTimestamp } from "@/lib/prototype-record-utils"
import {
  refreshStoredProjectResults,
  upsertStoredProjectFindings,
} from "@/lib/project-results-repository"
import { getStoredProjectById } from "@/lib/project-repository"
import { prisma } from "@/lib/prisma"
import { fromLogRecord } from "@/lib/prisma-transforms"
import type {
  AssetRecord,
  EvidenceRecord,
  LogRecord,
  McpRunRecord,
  McpWorkflowSmokePayload,
  ProjectFindingRecord,
  ProjectRecord,
} from "@/lib/prototype-types"
import { upsertStoredWorkLogs } from "@/lib/work-log-repository"

type NormalizedExecutionArtifacts = {
  actor: string
  assets: AssetRecord[]
  evidence: EvidenceRecord[]
  findings: ProjectFindingRecord[]
  workLogs: LogRecord[]
}

type SchedulerTaskOwnership = {
  leaseToken: string
  workerId: string
}

function mergeRelations(
  left: AssetRecord["relations"] = [],
  right: AssetRecord["relations"] = [],
) {
  const records = new Map([...left, ...right].map((relation) => [relation.id, relation]))

  return Array.from(records.values())
}

function makeEvidenceId(run: McpRunRecord) {
  return `EV-${formatDayStamp()}-${run.id.replace(/^run-/, "").replace(/[^a-z0-9]+/gi, "").slice(0, 12)}`
}

function buildExecutionAuditLog(project: ProjectRecord, run: McpRunRecord, status: string) {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    category: "执行结果",
    summary: `${run.requestedAction} 已完成结果归一化并写入平台记录。`,
    projectName: project.name,
    actor: run.toolName,
    timestamp: formatTimestamp(),
    status,
  }
}

/** 内部平台操作工具，不需要 LLM 分析 */
const INTERNAL_TOOLS = new Set(["seed-normalizer", "capture-evidence", "report-exporter"])

async function normalizeExecutionArtifacts(
  context: McpConnectorExecutionContext,
  rawResult: Extract<McpConnectorResult, { status: "succeeded" }>,
): Promise<NormalizedExecutionArtifacts> {
  const timestamp = formatTimestamp()
  const evidenceId = makeEvidenceId(context.run)
  const actor = context.run.toolName

  // === 内部平台操作：seed-normalizer（目标标准化，不需要 LLM 分析） ===
  if (context.run.toolName === "seed-normalizer") {
    const existingAssets = new Map((await listStoredAssets(context.project.id)).map((asset) => [asset.id, asset]))
    const targets = (rawResult.structuredContent.normalizedTargets as string[]) ?? []

    const seedAssets: AssetRecord[] = []
    for (const target of targets) {
      const host = getHostFromTarget(target)
      if (!host) continue
      const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
      const assetType = isIp ? "host" : "domain"
      const assetId = buildStableRecordId("asset", context.project.id, assetType, host)
      if (existingAssets.has(assetId) || seedAssets.some((a) => a.id === assetId)) continue
      seedAssets.push({
        id: assetId,
        projectId: context.project.id,
        projectName: context.project.name,
        type: assetType,
        label: host,
        profile: "种子目标",
        scopeStatus: "已确认",
        lastSeen: timestamp,
        host,
        ownership: `${context.project.name} 种子输入`,
        confidence: "1.00",
        exposure: "项目初始输入目标",
        linkedEvidenceId: "",
        linkedTaskTitle: "目标标准化",
        issueLead: "等待侦查工具采集更多信息。",
        relations: [],
      })
    }

    return {
      actor,
      assets: seedAssets,
      evidence: [],
      findings: [],
      workLogs: [{
        id: `work-${context.run.id}`,
        category: "目标标准化",
        summary: `种子目标已规范化为 ${targets.join(" / ")}，创建了 ${seedAssets.length} 个初始资产。`,
        projectName: context.project.name,
        actor,
        timestamp,
        status: "已完成",
      }],
    }
  }

  // === 内部平台操作：capture-evidence（截图与证据采集） ===
  if (context.run.toolName === "capture-evidence") {
    const linkedApprovalId = context.run.linkedApprovalId ?? ""
    const existingAssets = new Map((await listStoredAssets(context.project.id)).map((asset) => [asset.id, asset]))
    const capturedUrl = (rawResult.structuredContent.capturedUrl as string | undefined) ?? context.run.target
    const pageTitle = (rawResult.structuredContent.pageTitle as string | undefined) ?? "Untitled"
    const statusCode = (rawResult.structuredContent.statusCode as number | undefined) ?? 0
    const htmlPreview = (rawResult.structuredContent.htmlPreview as string | undefined) ?? ""
    const screenshotArtifactPath = rawResult.structuredContent.screenshotArtifactPath as string | undefined
    const htmlArtifactPath = rawResult.structuredContent.htmlArtifactPath as string | undefined
    const targetHost = getHostFromTarget(capturedUrl)
    const entryAssetId = buildStableRecordId("asset", context.project.id, "entry", capturedUrl)
    const existingAsset = existingAssets.get(entryAssetId) ?? await getStoredAssetById(entryAssetId)

    return {
      actor,
      assets: [
        {
          id: entryAssetId,
          projectId: context.project.id,
          projectName: context.project.name,
          type: "entry",
          label: capturedUrl,
          profile: statusCode > 0 ? `页面采证 · HTTP ${statusCode}` : "页面采证",
          scopeStatus: "已确认",
          lastSeen: timestamp,
          host: targetHost,
          ownership: `${context.project.name} 页面证据采样入口`,
          confidence: "0.86",
          exposure:
            htmlArtifactPath || screenshotArtifactPath
              ? `已沉淀真实页面截图${htmlArtifactPath ? "与 HTML 快照" : ""}，标题 ${pageTitle}。`
              : `已完成页面采证，标题 ${pageTitle}。`,
          linkedEvidenceId: evidenceId,
          linkedTaskTitle: context.run.requestedAction,
          issueLead: "可从证据详情直接复核页面上下文、截图与 HTML 原貌。",
          relations: mergeRelations(existingAsset?.relations, [
            {
              id: buildStableRecordId("asset-rel", capturedUrl, "evidence"),
              label: evidenceId,
              type: "evidence",
              relation: "页面采证",
              scopeStatus: "已确认",
            },
          ]),
        },
      ],
      evidence: [
        {
          id: evidenceId,
          projectId: context.project.id,
          projectName: context.project.name,
          title: `${pageTitle} 页面截图与 HTML 快照`,
          source: "截图与证据采集类",
          confidence: "0.86",
          conclusion: "证据已归档",
          linkedApprovalId,
          rawOutput: rawResult.rawOutput,
          screenshotNote:
            screenshotArtifactPath && htmlArtifactPath
              ? "已生成真实页面截图与 HTML 快照，可直接在下方预览或打开原始产物。"
              : screenshotArtifactPath
                ? "已生成真实页面截图，可直接在下方预览。"
                : "本轮没有生成可预览截图，但页面上下文仍已作为证据记录归档。",
          structuredSummary: [
            statusCode > 0
              ? `页面 ${capturedUrl} 采证完成，标题 ${pageTitle}，主响应状态 HTTP ${statusCode}。`
              : `页面 ${capturedUrl} 采证完成，标题 ${pageTitle}。`,
            htmlPreview
              ? `HTML 快照摘要：${htmlPreview}`
              : "HTML 快照已归档，可在证据详情中查看原始页面源码快照。",
          ],
          linkedTaskTitle: context.run.requestedAction,
          linkedAssetLabel: capturedUrl,
          timeline: [`${timestamp} 真实页面截图与 HTML 快照归档完成`],
          verdict: "当前页面上下文已可直接复核，后续可围绕页面线索继续进入结构发现或受控验证。",
          capturedUrl,
          screenshotArtifactPath,
          htmlArtifactPath,
        },
      ],
      findings: [],
      workLogs: [
        {
          id: `work-${context.run.id}`,
          category: "证据采集",
          summary: `${capturedUrl} 已完成页面截图与 HTML 快照归档。`,
          projectName: context.project.name,
          actor,
          timestamp,
          status: "已完成",
        },
      ],
    }
  }

  // === 内部平台操作：report-exporter（报告导出） ===
  if (context.run.toolName === "report-exporter") {
    const reportDigest = (rawResult.structuredContent.reportDigest as string[]) ?? []

    return {
      actor,
      assets: [],
      evidence: [],
      findings: [],
      workLogs: [
        {
          id: `work-${context.run.id}`,
          category: "报告导出",
          summary: `项目报告摘要已导出：${reportDigest.join("；")}`,
          projectName: context.project.name,
          actor,
          timestamp,
          status: "已完成",
        },
      ],
    }
  }

  // === 所有其他工具：使用 LLM 语义分析结果并生成平台记录 ===
  // 替代原有的 ~900 行工具特定解析器（dns-census, web-surface-map, graphql-surface-check,
  // controlled-validation, normalizeStdioMcpArtifacts 等），由 LLM 统一分析任何工具输出。
  // 如果 LLM 不可用，降级为保存原始输出作为证据。
  return analyzeAndWriteback(context, rawResult)
}

async function updateProjectExecutionMeta(project: ProjectRecord, run: McpRunRecord) {
  // Use updateMany to avoid throwing when the project no longer exists
  // (e.g., test cleanup truncated the table between execution steps).
  await prisma.project.updateMany({
    where: { id: project.id },
    data: {
      lastActor: `${run.toolName} · ${run.requestedAction}`,
    },
  })
  await prisma.auditLog.create({
    data: fromLogRecord(buildExecutionAuditLog(project, run, "已完成")),
  })
}

async function taskOwnershipLost(runId: string, ownership?: SchedulerTaskOwnership) {
  if (!ownership) {
    return false
  }

  const task = await getStoredSchedulerTaskByRunId(runId)

  return Boolean(task && (task.workerId !== ownership.workerId || task.leaseToken !== ownership.leaseToken))
}

export async function executeStoredMcpRun(
  runId: string,
  priorOutputs: McpWorkflowSmokePayload["outputs"] = {},
  ownership?: SchedulerTaskOwnership,
  signal?: AbortSignal,
) {
  const run = await getStoredMcpRunById(runId)

  if (!run) {
    return null
  }

  const project = await getStoredProjectById(run.projectId)

  if (!project) {
    return null
  }

  const approval = run.linkedApprovalId ? await getStoredApprovalById(run.linkedApprovalId) : null
  const executionContext: McpConnectorExecutionContext = {
    approval,
    priorOutputs,
    project,
    run,
    signal,
    tool: run.toolId ? await getStoredMcpToolById(run.toolId) : null,
  }
  const connector = await resolveMcpConnector(executionContext)

  if (!connector) {
    return {
      status: "failed" as const,
      connectorKey: "unresolved-connector",
      mode: run.connectorMode ?? "local",
      errorMessage: `未找到 ${run.toolName} 的连接器实现。`,
      summaryLines: [`${run.toolName} 当前没有可用连接器实现，无法继续执行。`],
      run,
    }
  }

  let rawResult: McpConnectorResult

  try {
    throwIfExecutionAborted(signal)
    rawResult = await connector.execute(executionContext)
  } catch (error) {
    if (isExecutionAbortError(error) || signal?.aborted) {
      return {
        status: "aborted" as const,
        connectorKey: connector.key,
        mode: connector.mode,
        summaryLines: [error instanceof Error ? error.message : "当前执行已取消。"],
        run: await getStoredMcpRunById(run.id) ?? run,
        outputs: priorOutputs,
      }
    }

    throw error
  }

  const cancelledTask = await getStoredSchedulerTaskByRunId(run.id)

  if (cancelledTask?.status === "cancelled") {
    const cancelledRun = await updateStoredMcpRun(run.id, {
      status: "已取消",
      summaryLines: Array.from(
        new Set([
          ...run.summaryLines,
          ...rawResult.summaryLines,
          "研究员已请求停止当前运行，平台已阻止该次执行结果继续写入后续资产、证据和发现链路。",
        ]),
      ),
    })

    return {
      status: "aborted" as const,
      connectorKey: rawResult.connectorKey,
      mode: rawResult.mode,
      summaryLines: rawResult.summaryLines,
      run: cancelledRun ?? run,
      outputs: priorOutputs,
    }
  }

  if (await taskOwnershipLost(run.id, ownership)) {
    return {
      status: "ownership_lost" as const,
      connectorKey: rawResult.connectorKey,
      mode: rawResult.mode,
      summaryLines: rawResult.summaryLines,
      run: await getStoredMcpRunById(run.id) ?? run,
      outputs: priorOutputs,
    }
  }

  throwIfExecutionAborted(signal)

  if (rawResult.status !== "succeeded") {
    return {
      ...rawResult,
      run,
    }
  }

  const artifacts = await normalizeExecutionArtifacts(executionContext, rawResult)

  await upsertStoredAssets(artifacts.assets)
  await upsertStoredEvidence(artifacts.evidence)
  await upsertStoredProjectFindings(artifacts.findings)
  await upsertStoredWorkLogs(artifacts.workLogs)
  await updateProjectExecutionMeta(project, run)

  const persistedRun = await updateStoredMcpRun(run.id, {
    connectorMode: rawResult.mode,
    status: "已执行",
    summaryLines: Array.from(
      new Set([
        ...run.summaryLines,
        ...rawResult.summaryLines,
        artifacts.assets.length > 0 ? `资产中心已新增或刷新 ${artifacts.assets.length} 条记录。` : "",
        artifacts.evidence.length > 0 ? `证据中心已新增或刷新 ${artifacts.evidence.length} 条记录。` : "",
        artifacts.findings.length > 0 ? `漏洞与发现已新增 ${artifacts.findings.length} 条。` : "",
        rawResult.mode === "real" ? "本次执行由真实连接器完成采集。" : "本次执行由本地基础连接器完成。",
        run.linkedApprovalId ? "审批已批准后的执行结果已同步到平台记录。" : "",
      ].filter(Boolean)),
    ),
  })

  await refreshStoredProjectResults(project.id)

  return {
    status: "succeeded" as const,
    connectorKey: rawResult.connectorKey,
    mode: rawResult.mode,
    outputs: {
      ...priorOutputs,
      ...rawResult.outputs,
    },
    run: persistedRun ?? run,
  }
}

export async function resumeStoredApprovedMcpRun(approvalId: string) {
  const approval = await getStoredApprovalById(approvalId)

  if (!approval || approval.status !== "已批准") {
    return null
  }

  const dbRun = await prisma.mcpRun.findFirst({
    where: { linkedApprovalId: approvalId },
  })
  const run = dbRun ? await getStoredMcpRunById(dbRun.id) : null

  if (!run) {
    return null
  }

  return executeStoredMcpRun(run.id)
}

export async function getStoredAssetRecord(assetId: string) {
  return getStoredAssetById(assetId)
}

export async function getStoredEvidenceRecord(evidenceId: string) {
  return getStoredEvidenceById(evidenceId)
}
