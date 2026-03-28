import { getStoredApprovalById } from "@/lib/approval-repository"
import { getStoredAssetById, listStoredAssets, upsertStoredAssets } from "@/lib/asset-repository"
import { isExecutionAbortError, throwIfExecutionAborted } from "@/lib/mcp-execution-abort"
import { resolveMcpConnector } from "@/lib/mcp-connectors/registry"
import {
  getHostFromTarget,
  getRootDomain,
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
import { buildStableRecordId, formatDayStamp, formatTimestamp } from "@/lib/prototype-record-utils"
import {
  refreshStoredProjectResults,
  upsertStoredProjectFindings,
} from "@/lib/project-results-repository"
import { getStoredProjectById } from "@/lib/project-repository"
import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
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

function buildHttpStructureIssueLead(kind: string) {
  if (kind === "actuator") {
    return "优先检查管理端点是否匿名暴露，并确认是否需要进入审批后的受控验证。"
  }

  if (kind === "graphql") {
    return "优先确认 GraphQL 入口是否匿名开放，并补充 introspection / schema 线索。"
  }

  if (kind === "openapi" || kind === "swagger-ui") {
    return "优先检查文档入口是否可匿名访问，并补齐接口截图与响应样本。"
  }

  return "建议继续补齐结构化请求样本、截图证据与可达性验证。"
}

function buildHttpStructureAssetType(kind: string) {
  return kind === "actuator" ? "entry" : "api"
}

function normalizeExecutionArtifacts(
  context: McpConnectorExecutionContext,
  rawResult: Extract<McpConnectorResult, { status: "succeeded" }>,
): NormalizedExecutionArtifacts {
  const timestamp = formatTimestamp()
  const linkedApprovalId = context.run.linkedApprovalId ?? ""
  const evidenceId = makeEvidenceId(context.run)
  const existingAssets = new Map(listStoredAssets(context.project.id).map((asset) => [asset.id, asset]))
  const actor = context.run.toolName

  if (context.run.toolName === "seed-normalizer") {
    const targets = (rawResult.structuredContent.normalizedTargets as string[]) ?? []

    return {
      actor,
      assets: [],
      evidence: [],
      findings: [],
      workLogs: [
        {
          id: `work-${context.run.id}`,
          category: "目标标准化",
          summary: `种子目标已规范化为 ${targets.join(" / ")}。`,
          projectName: context.project.name,
          actor,
          timestamp,
          status: "已完成",
        },
      ],
    }
  }

  if (context.run.toolName === "dns-census") {
    const discoveredSubdomains = (rawResult.structuredContent.discoveredSubdomains as string[]) ?? []
    const resolvedAddresses = (rawResult.structuredContent.resolvedAddresses as string[]) ?? []
    const certificate = rawResult.structuredContent.certificate as
      | {
          fingerprint256?: string
          subjectaltname?: string
          valid_to?: string
        }
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
        profile: "被动 DNS / 证书情报回流",
        scopeStatus: "已纳入",
        lastSeen: timestamp,
        host,
        ownership: `${context.project.name} 结果面候选域名`,
        confidence: "0.78",
        exposure:
          resolvedAddresses.length > 0
            ? `解析地址 ${resolvedAddresses.join(" / ")}；可继续衔接 Web 入口识别。`
            : "由被动子域与证书情报补采发现，可继续衔接 Web 入口识别。",
        linkedEvidenceId: evidenceId,
        linkedTaskTitle: context.run.requestedAction,
        issueLead: certificate?.fingerprint256
          ? `证书指纹 ${certificate.fingerprint256.slice(0, 18)}...`
          : "建议继续补采 Web 面入口、响应头和服务指纹。",
        relations: mergeRelations(existingAsset?.relations, [
          {
            id: buildStableRecordId("asset-rel", host, "evidence"),
            label: evidenceId,
            type: "evidence",
            relation: "发现证据",
            scopeStatus: "已纳入",
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
        scopeStatus: "已纳入",
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
            scopeStatus: "已纳入",
          },
        ]),
      } satisfies AssetRecord
    })
    const assets = [...domainAssets, ...ipAssets]

    return {
      actor,
      assets,
      evidence: [
        {
          id: evidenceId,
          projectId: context.project.id,
          projectName: context.project.name,
          title: "被动域名与子域情报回流",
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
          verdict: "当前结果作为资产基础盘使用，等待后续入口和归属补采。",
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

  if (context.run.toolName === "web-surface-map") {
    const webEntries =
      (rawResult.structuredContent.webEntries as Array<{
        fingerprint: string
        headers: string[]
        statusCode: number
        title: string
        url: string
      }>) ?? []
    const assets = webEntries.map((entry) => {
      const host = getHostFromTarget(entry.url)
      const assetId = buildStableRecordId("asset", context.project.id, "entry", entry.url)
      const existingAsset = existingAssets.get(assetId)

      return {
        id: assetId,
        projectId: context.project.id,
        projectName: context.project.name,
        type: entry.url.includes("/dashboard") ? "web" : "entry",
        label: entry.url,
        profile: `${entry.fingerprint} · ${entry.statusCode}`,
        scopeStatus: "已纳入",
        lastSeen: timestamp,
        host,
        ownership: `${context.project.name} Web 暴露面`,
        confidence: "0.81",
        exposure: `页面标题 ${entry.title}；响应头 ${entry.headers.join(" / ")}`,
        linkedEvidenceId: evidenceId,
        linkedTaskTitle: context.run.requestedAction,
        issueLead: "当前入口已可继续衔接受控验证或证据补采。",
        relations: mergeRelations(existingAsset?.relations, [
          {
            id: buildStableRecordId("asset-rel", entry.url, "host"),
            label: host,
            type: "domain",
            relation: "所属主机",
            scopeStatus: "已纳入",
          },
          {
            id: buildStableRecordId("asset-rel", entry.url, "evidence"),
            label: evidenceId,
            type: "evidence",
            relation: "页面识别证据",
            scopeStatus: "已纳入",
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
            "入口已进入域名 / Web 入口表格，可继续向高风险验证或证据补采流转。",
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

  if (context.run.toolName === "graphql-surface-check") {
    const webEntries =
      (rawResult.structuredContent.webEntries as Array<{
        fingerprint?: string
        finalUrl?: string
        headers: string[]
        statusCode: number
        title: string
        url: string
      }>) ?? []
    const structureEntries =
      (rawResult.structuredContent.structureEntries as Array<{
        kind: string
        label: string
        url: string
        confidence: string
        source: string
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
        type: entry.url.includes("/graphql") ? "api" : "entry",
        label: entry.url,
        profile: `${entry.fingerprint || entry.title} · ${entry.statusCode}`,
        scopeStatus: "已纳入",
        lastSeen: timestamp,
        host,
        ownership: `${context.project.name} HTTP / API 结构发现`,
        confidence: structureEntries[0]?.confidence ?? "0.68",
        exposure: `基础入口标题 ${entry.title}；响应头 ${entry.headers.join(" / ") || "未采集关键响应头"}`,
        linkedEvidenceId: evidenceId,
        linkedTaskTitle: context.run.requestedAction,
        issueLead: structureEntries.length > 0 ? `继续围绕 ${structureEntries[0].label} 候选入口补齐证据。` : "继续补采 API / 文档结构线索。",
        relations: mergeRelations(existingAsset?.relations, [
          {
            id: buildStableRecordId("asset-rel", entry.url, "host"),
            label: host,
            type: "domain",
            relation: "所属主机",
            scopeStatus: "已纳入",
          },
          {
            id: buildStableRecordId("asset-rel", entry.url, "evidence"),
            label: evidenceId,
            type: "evidence",
            relation: "结构发现证据",
            scopeStatus: "已纳入",
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
        scopeStatus: "已纳入",
        lastSeen: timestamp,
        host,
        ownership: `${context.project.name} API / 文档候选入口`,
        confidence: entry.confidence,
        exposure: `由 ${entry.source} 线索识别，当前作为 ${entry.label} 候选入口回流。`,
        linkedEvidenceId: evidenceId,
        linkedTaskTitle: context.run.requestedAction,
        issueLead: buildHttpStructureIssueLead(entry.kind),
        relations: mergeRelations(existingAsset?.relations, [
          {
            id: buildStableRecordId("asset-rel", entry.url, "host"),
            label: host,
            type: "domain",
            relation: "所属主机",
            scopeStatus: "已纳入",
          },
          {
            id: buildStableRecordId("asset-rel", entry.url, "evidence"),
            label: evidenceId,
            type: "evidence",
            relation: "结构候选证据",
            scopeStatus: "已纳入",
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
              ? `HTTP / API 结构发现已回流 ${structureEntries.length} 个候选入口。`
              : "HTTP / API 结构发现已执行，但未识别到明确候选入口。",
          projectName: context.project.name,
          actor,
          timestamp,
          status: "已完成",
        },
      ],
    }
  }

  if (context.run.toolName === "auth-guard-check") {
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
    const existingAsset = existingAssets.get(entryAssetId) ?? getStoredAssetById(entryAssetId)

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
          scopeStatus: "已纳入",
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
              scopeStatus: "已纳入",
            },
            {
              id: buildStableRecordId("asset-rel", context.run.target, "evidence"),
              label: evidenceId,
              type: "evidence",
              relation: "验证证据",
              scopeStatus: "已纳入",
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

  if (context.run.toolName === "capture-evidence") {
    const capturedUrl = (rawResult.structuredContent.capturedUrl as string | undefined) ?? context.run.target
    const pageTitle = (rawResult.structuredContent.pageTitle as string | undefined) ?? "Untitled"
    const statusCode = (rawResult.structuredContent.statusCode as number | undefined) ?? 0
    const htmlPreview = (rawResult.structuredContent.htmlPreview as string | undefined) ?? ""
    const screenshotArtifactPath = rawResult.structuredContent.screenshotArtifactPath as string | undefined
    const htmlArtifactPath = rawResult.structuredContent.htmlArtifactPath as string | undefined
    const targetHost = getHostFromTarget(capturedUrl)
    const entryAssetId = buildStableRecordId("asset", context.project.id, "entry", capturedUrl)
    const existingAsset = existingAssets.get(entryAssetId) ?? getStoredAssetById(entryAssetId)

    return {
      actor,
      assets: [
        {
          id: entryAssetId,
          projectId: context.project.id,
          projectName: context.project.name,
          type: capturedUrl.includes("/graphql") ? "api" : "entry",
          label: capturedUrl,
          profile: statusCode > 0 ? `页面采证 · HTTP ${statusCode}` : "页面采证",
          scopeStatus: "已纳入",
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
              scopeStatus: "已纳入",
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

function updateProjectExecutionMeta(project: ProjectRecord, run: McpRunRecord) {
  const store = readPrototypeStore()
  const projectIndex = store.projects.findIndex((item) => item.id === project.id)

  if (projectIndex < 0) {
    return
  }

  store.projects[projectIndex] = {
    ...store.projects[projectIndex],
    lastUpdated: formatTimestamp(),
    lastActor: `${run.toolName} · ${run.requestedAction}`,
  }
  store.auditLogs.unshift(buildExecutionAuditLog(project, run, "已完成"))
  writePrototypeStore(store)
}

function taskOwnershipLost(runId: string, ownership?: SchedulerTaskOwnership) {
  if (!ownership) {
    return false
  }

  const task = getStoredSchedulerTaskByRunId(runId)

  return Boolean(task && (task.workerId !== ownership.workerId || task.leaseToken !== ownership.leaseToken))
}

export async function executeStoredMcpRun(
  runId: string,
  priorOutputs: McpWorkflowSmokePayload["outputs"] = {},
  ownership?: SchedulerTaskOwnership,
  signal?: AbortSignal,
) {
  const run = getStoredMcpRunById(runId)

  if (!run) {
    return null
  }

  const project = getStoredProjectById(run.projectId)

  if (!project) {
    return null
  }

  const approval = run.linkedApprovalId ? getStoredApprovalById(run.linkedApprovalId) : null
  const executionContext: McpConnectorExecutionContext = {
    approval,
    priorOutputs,
    project,
    run,
    signal,
    tool: run.toolId ? getStoredMcpToolById(run.toolId) : null,
  }
  const connector = resolveMcpConnector(executionContext)

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
        run: getStoredMcpRunById(run.id) ?? run,
        outputs: priorOutputs,
      }
    }

    throw error
  }

  const cancelledTask = getStoredSchedulerTaskByRunId(run.id)

  if (cancelledTask?.status === "cancelled") {
    const cancelledRun = updateStoredMcpRun(run.id, {
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

  if (taskOwnershipLost(run.id, ownership)) {
    return {
      status: "ownership_lost" as const,
      connectorKey: rawResult.connectorKey,
      mode: rawResult.mode,
      summaryLines: rawResult.summaryLines,
      run: getStoredMcpRunById(run.id) ?? run,
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

  const artifacts = normalizeExecutionArtifacts(executionContext, rawResult)

  upsertStoredAssets(artifacts.assets)
  upsertStoredEvidence(artifacts.evidence)
  upsertStoredProjectFindings(artifacts.findings)
  upsertStoredWorkLogs(artifacts.workLogs)
  updateProjectExecutionMeta(project, run)

  const persistedRun = updateStoredMcpRun(run.id, {
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
        run.linkedApprovalId ? "审批已批准后的执行结果已回流到平台记录。" : "",
      ].filter(Boolean)),
    ),
  })

  refreshStoredProjectResults(project.id)

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
  const approval = getStoredApprovalById(approvalId)

  if (!approval || approval.status !== "已批准") {
    return null
  }

  const run = getStoredMcpRunById(
    readPrototypeStore().mcpRuns.find((item) => item.linkedApprovalId === approvalId)?.id ?? "",
  )

  if (!run) {
    return null
  }

  return executeStoredMcpRun(run.id)
}

export function getStoredAssetRecord(assetId: string) {
  return getStoredAssetById(assetId)
}

export function getStoredEvidenceRecord(evidenceId: string) {
  return getStoredEvidenceById(evidenceId)
}
