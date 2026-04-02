/**
 * artifact-normalizer.ts — Tool-specific artifact normalization.
 *
 * Converts raw MCP connector results into platform-standard assets, evidence,
 * findings, and work logs. Each tool has a dedicated normalizer branch.
 */

import { getStoredAssetById, listStoredAssets } from "@/lib/asset-repository"
import {
  getHostFromTarget,
  getRootDomain,
} from "@/lib/mcp-connectors/local-foundational-connectors"
import type {
  McpConnectorExecutionContext,
  McpConnectorResult,
} from "@/lib/mcp-connectors/types"
import { buildStableRecordId, formatTimestamp } from "@/lib/prototype-record-utils"
import type {
  AssetRecord,
  ProjectFindingRecord,
} from "@/lib/prototype-types"
import {
  buildHttpStructureAssetType,
  buildHttpStructureIssueLead,
  makeEvidenceId,
  mergeRelations,
  type NormalizedExecutionArtifacts,
} from "@/lib/execution/execution-helpers"
import { normalizeStdioMcpArtifacts } from "@/lib/execution/artifact-normalizer-stdio"

/** Infer asset type from response headers instead of URL path matching */
function inferAssetTypeFromHeaders(headers: string[]): string {
  const joined = headers.join(" ").toLowerCase()
  if (joined.includes("application/json") || joined.includes("application/graphql")) return "api"
  if (joined.includes("text/html")) return "web"
  return "entry"
}

function isControlledValidationArtifactShape(rawResult: Extract<McpConnectorResult, { status: "succeeded" }>): boolean {
  return (
    "requestSummary" in rawResult.structuredContent ||
    "responseSummary" in rawResult.structuredContent ||
    "responseSignals" in rawResult.structuredContent ||
    "finding" in rawResult.structuredContent
  )
}

export async function normalizeExecutionArtifacts(
  context: McpConnectorExecutionContext,
  rawResult: Extract<McpConnectorResult, { status: "succeeded" }>,
): Promise<NormalizedExecutionArtifacts> {
  const timestamp = formatTimestamp()
  const linkedApprovalId = context.run.linkedApprovalId ?? ""
  const evidenceId = makeEvidenceId(context.run)
  const existingAssets = new Map((await listStoredAssets(context.project.id)).map((asset) => [asset.id, asset]))
  const actor = context.run.toolName

  if (context.run.toolName === "seed-normalizer") {
    return normalizeSeedNormalizer(context, rawResult, { timestamp, existingAssets, actor })
  }

  if (context.run.toolName === "dns-census") {
    return normalizeDnsCensus(context, rawResult, { timestamp, evidenceId, linkedApprovalId, existingAssets, actor })
  }

  if (context.run.toolName === "web-surface-map") {
    return normalizeWebSurfaceMap(context, rawResult, { timestamp, evidenceId, linkedApprovalId, existingAssets, actor })
  }

  if (context.run.toolName === "graphql-surface-check") {
    return normalizeGraphqlSurfaceCheck(context, rawResult, { timestamp, evidenceId, linkedApprovalId, existingAssets, actor })
  }

  if (context.run.capability === "受控验证类" && isControlledValidationArtifactShape(rawResult)) {
    return normalizeControlledValidation(context, rawResult, { timestamp, evidenceId, linkedApprovalId, existingAssets, actor })
  }

  if (context.run.toolName === "capture-evidence") {
    return normalizeCaptureEvidence(context, rawResult, { timestamp, evidenceId, linkedApprovalId, existingAssets, actor })
  }

  if (context.run.toolName === "report-exporter") {
    return normalizeReportExporter(context, rawResult, { timestamp, actor })
  }

  // Generic handler for real stdio MCP tools
  const hasStructuredContent = rawResult.structuredContent && Object.keys(rawResult.structuredContent).length > 0
  const isScriptToolWithOutput = (context.run.toolName === "execute_code" || context.run.toolName === "execute_command")
    && rawResult.rawOutput && rawResult.rawOutput.length > 0

  if (rawResult.mode === "real" && (hasStructuredContent || isScriptToolWithOutput)) {
    return normalizeStdioMcpArtifacts(context, rawResult, { timestamp, evidenceId, linkedApprovalId, existingAssets, actor })
  }

  return {
    actor,
    assets: [],
    evidence: [],
    findings: [],
    workLogs: [
      {
        id: `work-${context.run.id}`,
        category: "执行结果",
        summary: rawResult.summaryLines[0] ?? `${context.run.toolName} 已执行。`,
        projectName: context.project.name,
        actor,
        timestamp,
        status: "已完成",
      },
    ],
  }
}

// ──────────────────────────────────────────────
// Tool-specific normalizers
// ──────────────────────────────────────────────

type SharedContext = {
  timestamp: string
  evidenceId: string
  linkedApprovalId: string
  existingAssets: Map<string, AssetRecord>
  actor: string
}

function normalizeSeedNormalizer(
  context: McpConnectorExecutionContext,
  rawResult: Extract<McpConnectorResult, { status: "succeeded" }>,
  shared: Pick<SharedContext, "timestamp" | "existingAssets" | "actor">,
): NormalizedExecutionArtifacts {
  const { timestamp, existingAssets, actor } = shared
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
    workLogs: [
      {
        id: `work-${context.run.id}`,
        category: "目标标准化",
        summary: `种子目标已规范化为 ${targets.join(" / ")}，创建了 ${seedAssets.length} 个初始资产。`,
        projectName: context.project.name,
        actor,
        timestamp,
        status: "已完成",
      },
    ],
  }
}

function normalizeDnsCensus(
  context: McpConnectorExecutionContext,
  rawResult: Extract<McpConnectorResult, { status: "succeeded" }>,
  shared: SharedContext,
): NormalizedExecutionArtifacts {
  const { timestamp, evidenceId, linkedApprovalId, existingAssets, actor } = shared
  const discoveredSubdomains = (rawResult.structuredContent.discoveredSubdomains as string[]) ?? []
  const resolvedAddresses = (rawResult.structuredContent.resolvedAddresses as string[]) ?? []
  const certificate = rawResult.structuredContent.certificate as
    | { fingerprint256?: string; subjectaltname?: string; valid_to?: string }
    | undefined

  const domainAssets = discoveredSubdomains.map((host) => {
    const assetId = buildStableRecordId("asset", context.project.id, "domain", host)
    const existingAsset = existingAssets.get(assetId)
    return {
      id: assetId,
      projectId: context.project.id,
      projectName: context.project.name,
      type: host === getRootDomain(host) ? "domain" : "subdomain",
      label: host,
      profile: "被动 DNS / 证书情报返回",
      scopeStatus: "已确认",
      lastSeen: timestamp,
      host,
      ownership: `${context.project.name} 结果面候选域名`,
      confidence: "0.78",
      exposure:
        resolvedAddresses.length > 0
          ? `解析地址 ${resolvedAddresses.join(" / ")}；可继续衔接 Web 入口识别。`
          : "由被动子域与证书情报采集发现，可继续衔接 Web 入口识别。",
      linkedEvidenceId: evidenceId,
      linkedTaskTitle: context.run.requestedAction,
      issueLead: certificate?.fingerprint256
        ? `证书指纹 ${certificate.fingerprint256.slice(0, 18)}...`
        : "建议继续采集 Web 面入口、响应头和服务指纹。",
      relations: mergeRelations(existingAsset?.relations, [
        {
          id: buildStableRecordId("asset-rel", host, "evidence"),
          label: evidenceId,
          type: "evidence",
          relation: "发现证据",
          scopeStatus: "已确认",
        },
      ]),
    } satisfies AssetRecord
  })

  const ipAssets = resolvedAddresses.map((address) => {
    const assetId = buildStableRecordId("asset", context.project.id, "ip", address)
    const existingAsset = existingAssets.get(assetId)
    return {
      id: assetId,
      projectId: context.project.id,
      projectName: context.project.name,
      type: "ip",
      label: address,
      profile: "DNS 解析命中地址",
      scopeStatus: "已确认",
      lastSeen: timestamp,
      host: address,
      ownership: `${context.project.name} 解析结果`,
      confidence: "0.74",
      exposure: discoveredSubdomains.length > 0 ? `来源于 ${discoveredSubdomains[0]} 的解析结果。` : "来源于 DNS 解析结果。",
      linkedEvidenceId: evidenceId,
      linkedTaskTitle: context.run.requestedAction,
      issueLead: "可继续衔接端口与服务识别。",
      relations: mergeRelations(existingAsset?.relations, [
        {
          id: buildStableRecordId("asset-rel", address, "evidence"),
          label: evidenceId,
          type: "evidence",
          relation: "解析证据",
          scopeStatus: "已确认",
        },
      ]),
    } satisfies AssetRecord
  })

  return {
    actor,
    assets: [...domainAssets, ...ipAssets],
    evidence: [
      {
        id: evidenceId,
        projectId: context.project.id,
        projectName: context.project.name,
        title: "被动域名与子域情报返回",
        source: "DNS / 子域 / 证书情报类",
        confidence: "0.78",
        conclusion: "情报已归档",
        linkedApprovalId,
        rawOutput: rawResult.rawOutput,
        screenshotNote: "当前为被动情报结果，无页面截图。",
        structuredSummary: [
          `被动发现 ${discoveredSubdomains.length} 条域名或子域结果，解析地址 ${resolvedAddresses.length} 条。`,
          certificate?.valid_to
            ? `TLS 证书已获取，有效期至 ${certificate.valid_to}。`
            : "结果已同步进入域名 / Web 入口表格，可继续向 Web 与服务识别流转。",
        ],
        linkedTaskTitle: context.run.requestedAction,
        linkedAssetLabel: discoveredSubdomains[0] ?? context.run.target,
        timeline: [`${timestamp} DNS 情报归一化完成`],
        verdict: "当前结果作为资产基础盘使用，等待后续入口和归属确认。",
      },
    ],
    findings: [],
    workLogs: [
      {
        id: `work-${context.run.id}`,
        category: "资产发现",
        summary: `被动情报新增 ${discoveredSubdomains.length} 条域名 / 子域结果，解析地址 ${resolvedAddresses.length} 条。`,
        projectName: context.project.name,
        actor,
        timestamp,
        status: "已完成",
      },
    ],
  }
}

function normalizeWebSurfaceMap(
  context: McpConnectorExecutionContext,
  rawResult: Extract<McpConnectorResult, { status: "succeeded" }>,
  shared: SharedContext,
): NormalizedExecutionArtifacts {
  const { timestamp, evidenceId, linkedApprovalId, existingAssets, actor } = shared
  const webEntries =
    (rawResult.structuredContent.webEntries as Array<{
      fingerprint: string; headers: string[]; statusCode: number; title: string; url: string
    }>) ?? []

  const assets = webEntries.map((entry) => {
    const host = getHostFromTarget(entry.url)
    const assetId = buildStableRecordId("asset", context.project.id, "entry", entry.url)
    const existingAsset = existingAssets.get(assetId)
    return {
      id: assetId,
      projectId: context.project.id,
      projectName: context.project.name,
      type: inferAssetTypeFromHeaders(entry.headers),
      label: entry.url,
      profile: `${entry.fingerprint} · ${entry.statusCode}`,
      scopeStatus: "已确认",
      lastSeen: timestamp,
      host,
      ownership: `${context.project.name} Web 暴露面`,
      confidence: "0.81",
      exposure: `页面标题 ${entry.title}；响应头 ${entry.headers.join(" / ")}`,
      linkedEvidenceId: evidenceId,
      linkedTaskTitle: context.run.requestedAction,
      issueLead: "当前入口已可继续衔接受控验证或证据采集。",
      relations: mergeRelations(existingAsset?.relations, [
        {
          id: buildStableRecordId("asset-rel", entry.url, "host"),
          label: host,
          type: "domain",
          relation: "所属主机",
          scopeStatus: "已确认",
        },
        {
          id: buildStableRecordId("asset-rel", entry.url, "evidence"),
          label: evidenceId,
          type: "evidence",
          relation: "页面识别证据",
          scopeStatus: "已确认",
        },
      ]),
    } satisfies AssetRecord
  })

  return {
    actor,
    assets,
    evidence: [
      {
        id: evidenceId,
        projectId: context.project.id,
        projectName: context.project.name,
        title: "Web 入口与响应特征识别",
        source: "Web 页面探测类",
        confidence: "0.81",
        conclusion: "结果已归档",
        linkedApprovalId,
        rawOutput: webEntries.flatMap((entry) => [`${entry.url} -> ${entry.statusCode}`, ...entry.headers]),
        screenshotNote: "本轮为结构化入口识别，截图可在后续证据采集能力接入后补足。",
        structuredSummary: [
          `识别到 ${webEntries.length} 个 Web 入口或管理台路径。`,
          "入口已进入域名 / Web 入口表格，可继续向高风险验证或证据采集流转。",
        ],
        linkedTaskTitle: context.run.requestedAction,
        linkedAssetLabel: webEntries[0]?.url ?? context.run.target,
        timeline: [`${timestamp} Web 入口归一化完成`],
        verdict: "当前入口识别已具备继续分析价值，后续优先补厚响应特征与鉴权线索。",
      },
    ],
    findings: [],
    workLogs: [
      {
        id: `work-${context.run.id}`,
        category: "Web 面识别",
        summary: `Web 入口与响应特征已入库，共 ${webEntries.length} 条。`,
        projectName: context.project.name,
        actor,
        timestamp,
        status: "已完成",
      },
    ],
  }
}

function normalizeGraphqlSurfaceCheck(
  context: McpConnectorExecutionContext,
  rawResult: Extract<McpConnectorResult, { status: "succeeded" }>,
  shared: SharedContext,
): NormalizedExecutionArtifacts {
  const { timestamp, evidenceId, linkedApprovalId, existingAssets, actor } = shared
  const webEntries =
    (rawResult.structuredContent.webEntries as Array<{
      fingerprint?: string; finalUrl?: string; headers: string[]; statusCode: number; title: string; url: string
    }>) ?? []
  const structureEntries =
    (rawResult.structuredContent.structureEntries as Array<{
      kind: string; label: string; url: string; confidence: string; source: string
    }>) ?? []
  const transport = (rawResult.structuredContent.transport as string | undefined) ?? "host"
  const primaryEntry = webEntries[0]

  const webAssets = webEntries.map((entry) => {
    const host = getHostFromTarget(entry.url)
    const assetId = buildStableRecordId("asset", context.project.id, "entry", entry.url)
    const existingAsset = existingAssets.get(assetId)
    return {
      id: assetId,
      projectId: context.project.id,
      projectName: context.project.name,
      type: inferAssetTypeFromHeaders(entry.headers),
      label: entry.url,
      profile: `${entry.fingerprint || entry.title} · ${entry.statusCode}`,
      scopeStatus: "已确认",
      lastSeen: timestamp,
      host,
      ownership: `${context.project.name} HTTP / API 结构发现`,
      confidence: structureEntries[0]?.confidence ?? "0.68",
      exposure: `基础入口标题 ${entry.title}；响应头 ${entry.headers.join(" / ") || "未采集关键响应头"}`,
      linkedEvidenceId: evidenceId,
      linkedTaskTitle: context.run.requestedAction,
      issueLead: structureEntries.length > 0 ? `继续围绕 ${structureEntries[0].label} 候选入口补充证据。` : "继续采集 API / 文档结构线索。",
      relations: mergeRelations(existingAsset?.relations, [
        {
          id: buildStableRecordId("asset-rel", entry.url, "host"),
          label: host,
          type: "domain",
          relation: "所属主机",
          scopeStatus: "已确认",
        },
        {
          id: buildStableRecordId("asset-rel", entry.url, "evidence"),
          label: evidenceId,
          type: "evidence",
          relation: "结构发现证据",
          scopeStatus: "已确认",
        },
      ]),
    } satisfies AssetRecord
  })

  const structureAssets = structureEntries.map((entry) => {
    const host = getHostFromTarget(entry.url)
    const assetId = buildStableRecordId("asset", context.project.id, buildHttpStructureAssetType(entry.kind), entry.url)
    const existingAsset = existingAssets.get(assetId)
    return {
      id: assetId,
      projectId: context.project.id,
      projectName: context.project.name,
      type: buildHttpStructureAssetType(entry.kind),
      label: entry.url,
      profile: `${entry.label} · ${entry.kind}`,
      scopeStatus: "已确认",
      lastSeen: timestamp,
      host,
      ownership: `${context.project.name} API / 文档候选入口`,
      confidence: entry.confidence,
      exposure: `由 ${entry.source} 线索识别，当前作为 ${entry.label} 候选入口返回。`,
      linkedEvidenceId: evidenceId,
      linkedTaskTitle: context.run.requestedAction,
      issueLead: buildHttpStructureIssueLead(entry.kind),
      relations: mergeRelations(existingAsset?.relations, [
        {
          id: buildStableRecordId("asset-rel", entry.url, "host"),
          label: host,
          type: "domain",
          relation: "所属主机",
          scopeStatus: "已确认",
        },
        {
          id: buildStableRecordId("asset-rel", entry.url, "evidence"),
          label: evidenceId,
          type: "evidence",
          relation: "结构候选证据",
          scopeStatus: "已确认",
        },
      ]),
    } satisfies AssetRecord
  })

  const candidateLabels = structureEntries.map((entry) => entry.label)
  const candidateSummary =
    structureEntries.length > 0
      ? `识别到 ${structureEntries.length} 个 HTTP / API 结构候选入口：${candidateLabels.join(" / ")}。`
      : "当前未识别到明确的 API / 文档候选入口。"

  return {
    actor,
    assets: [...webAssets, ...structureAssets],
    evidence: [
      {
        id: evidenceId,
        projectId: context.project.id,
        projectName: context.project.name,
        title: "HTTP / API 结构线索识别",
        source: "HTTP / API 结构发现类",
        confidence: structureEntries[0]?.confidence ?? "0.68",
        conclusion: structureEntries.length > 0 ? "结构线索已归档" : "暂未识别到明确入口",
        linkedApprovalId,
        rawOutput: [
          primaryEntry ? `${primaryEntry.url} -> ${primaryEntry.statusCode}` : "",
          ...(primaryEntry?.headers ?? []),
          ...structureEntries.map(
            (entry) => `${entry.label} (${entry.kind}) -> ${entry.url} [${entry.source} / ${entry.confidence}]`,
          ),
        ].filter(Boolean),
        screenshotNote:
          "当前为 HTTP / API 结构发现结果，页面截图和完整 HTML 证据可在后续截图与证据采集类接入后补齐。",
        structuredSummary: [
          candidateSummary,
          primaryEntry
            ? `基础入口 ${primaryEntry.title} 返回 HTTP ${primaryEntry.statusCode}，当前链路通过 ${transport === "docker" ? "容器内 fallback" : "宿主机直连"} 完成采集。`
            : "本轮没有额外的基础入口摘要。",
        ],
        linkedTaskTitle: context.run.requestedAction,
        linkedAssetLabel: structureEntries[0]?.url ?? primaryEntry?.url ?? context.run.target,
        timeline: [`${timestamp} HTTP / API 结构发现归一化完成`],
        verdict:
          structureEntries.length > 0
            ? "已识别可继续深挖的 API / 文档 / 管理端点线索，建议衔接截图证据、匿名可达性确认和必要的审批后验证。"
            : "本轮结构发现没有形成明确入口，建议补充目录探测、页面探测或更具体的请求样本。",
      },
    ],
    findings: [],
    workLogs: [
      {
        id: `work-${context.run.id}`,
        category: "HTTP / API 结构发现",
        summary:
          structureEntries.length > 0
            ? `HTTP / API 结构发现已返回 ${structureEntries.length} 个候选入口。`
            : "HTTP / API 结构发现已执行，但未识别到明确候选入口。",
        projectName: context.project.name,
        actor,
        timestamp,
        status: "已完成",
      },
    ],
  }
}

async function normalizeControlledValidation(
  context: McpConnectorExecutionContext,
  rawResult: Extract<McpConnectorResult, { status: "succeeded" }>,
  shared: SharedContext,
): Promise<NormalizedExecutionArtifacts> {
  const { timestamp, evidenceId, linkedApprovalId, existingAssets, actor } = shared
  const finding = (rawResult.structuredContent.finding as {
    affectedSurface: string
    severity: ProjectFindingRecord["severity"]
    status: ProjectFindingRecord["status"]
    summary: string
    title: string
  }) ?? {
    affectedSurface: context.run.target,
    severity: "高危" as const,
    status: "待复核" as const,
    summary: "受控验证产生了新的高价值结果。",
    title: context.run.requestedAction,
  }
  const responseSignals = (rawResult.structuredContent.responseSignals as string[]) ?? []
  const targetHost = getHostFromTarget(context.run.target)
  const entryAssetId = buildStableRecordId("asset", context.project.id, "entry", context.run.target)
  const existingAsset = existingAssets.get(entryAssetId) ?? await getStoredAssetById(entryAssetId)

  return {
    actor,
    assets: [
      {
        id: entryAssetId,
        projectId: context.project.id,
        projectName: context.project.name,
        type: context.run.target.includes("/v") ? "api" : "entry",
        label: context.run.target,
        profile: "审批后受控验证入口",
        scopeStatus: "已确认",
        lastSeen: timestamp,
        host: targetHost,
        ownership: `${context.project.name} 高价值验证入口`,
        confidence: "0.84",
        exposure: finding.summary,
        linkedEvidenceId: evidenceId,
        linkedTaskTitle: context.run.requestedAction,
        issueLead: finding.title,
        relations: mergeRelations(existingAsset?.relations, [
          {
            id: buildStableRecordId("asset-rel", context.run.target, "approval"),
            label: linkedApprovalId || "已执行",
            type: "approval",
            relation: "受控验证审批",
            scopeStatus: "已确认",
          },
          {
            id: buildStableRecordId("asset-rel", context.run.target, "evidence"),
            label: evidenceId,
            type: "evidence",
            relation: "验证证据",
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
        title: finding.title,
        source: "受控验证类",
        confidence: "0.84",
        conclusion: "待复核问题",
        linkedApprovalId,
        rawOutput: responseSignals,
        screenshotNote: "当前为受控验证输出，建议后续继续补充页面、响应和时间线证据。",
        structuredSummary: [
          finding.summary,
          rawResult.summaryLines[0] ?? "验证已执行。",
        ],
        linkedTaskTitle: context.run.requestedAction,
        linkedAssetLabel: context.run.target,
        timeline: [`${timestamp} 审批通过后的受控验证执行完成`],
        verdict: (rawResult.structuredContent.verdict as string) ?? "当前结果已进入漏洞与发现列表。",
      },
    ],
    findings: [
      {
        id: buildStableRecordId("finding", context.project.id, context.run.target, context.run.requestedAction),
        projectId: context.project.id,
        severity: finding.severity,
        status: finding.status,
        title: finding.title,
        summary: finding.summary,
        affectedSurface: finding.affectedSurface,
        evidenceId,
        owner: "受控验证",
        updatedAt: timestamp,
      },
    ],
    workLogs: [
      {
        id: `work-${context.run.id}`,
        category: "受控验证",
        summary: `${finding.title} 已执行并形成新证据。`,
        projectName: context.project.name,
        actor,
        timestamp,
        status: "待复核",
      },
    ],
  }
}

async function normalizeCaptureEvidence(
  context: McpConnectorExecutionContext,
  rawResult: Extract<McpConnectorResult, { status: "succeeded" }>,
  shared: SharedContext,
): Promise<NormalizedExecutionArtifacts> {
  const { timestamp, evidenceId, linkedApprovalId, existingAssets, actor } = shared
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

function normalizeReportExporter(
  context: McpConnectorExecutionContext,
  rawResult: Extract<McpConnectorResult, { status: "succeeded" }>,
  shared: Pick<SharedContext, "timestamp" | "actor">,
): NormalizedExecutionArtifacts {
  const { timestamp, actor } = shared
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
