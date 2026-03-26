import { getStoredApprovalById } from "@/lib/approval-repository"
import { getStoredAssetById, listStoredAssets, upsertStoredAssets } from "@/lib/asset-repository"
import { getStoredEvidenceById, listStoredEvidence, upsertStoredEvidence } from "@/lib/evidence-repository"
import {
  getStoredMcpRunById,
  listStoredMcpRuns,
  updateStoredMcpRun,
} from "@/lib/mcp-gateway-repository"
import { buildStableRecordId, formatDayStamp, formatTimestamp } from "@/lib/prototype-record-utils"
import {
  refreshStoredProjectResults,
  upsertStoredProjectFindings,
} from "@/lib/project-results-repository"
import { getStoredProjectById } from "@/lib/project-repository"
import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import type {
  ApprovalRecord,
  AssetRecord,
  EvidenceRecord,
  LogRecord,
  McpRunRecord,
  McpWorkflowSmokePayload,
  ProjectFindingRecord,
  ProjectRecord,
} from "@/lib/prototype-types"
import { upsertStoredWorkLogs } from "@/lib/work-log-repository"

type LocalToolExecutionContext = {
  approval: ApprovalRecord | null
  priorOutputs: McpWorkflowSmokePayload["outputs"]
  project: ProjectRecord
  run: McpRunRecord
}

type LocalToolRawResult = {
  outputs: Partial<McpWorkflowSmokePayload["outputs"]>
  structuredContent: Record<string, unknown>
  summaryLines: string[]
}

type NormalizedExecutionArtifacts = {
  actor: string
  assets: AssetRecord[]
  evidence: EvidenceRecord[]
  findings: ProjectFindingRecord[]
  workLogs: LogRecord[]
}

function normalizeSeed(seed: string) {
  const cleaned = seed.trim().toLowerCase().replace(/^https?:\/\//, "")
  const [hostWithMaybePath] = cleaned.split("?")
  const [host] = hostWithMaybePath.split("/")

  return {
    cleaned,
    host,
    normalizedTargets: Array.from(new Set([cleaned, host].filter(Boolean))),
  }
}

function getRootDomain(host: string) {
  const parts = host.split(".").filter(Boolean)

  if (parts.length >= 2) {
    return parts.slice(-2).join(".")
  }

  return host
}

function getHostFromTarget(target: string) {
  if (target.startsWith("http://") || target.startsWith("https://")) {
    try {
      return new URL(target).host
    } catch {
      return normalizeSeed(target).host
    }
  }

  return normalizeSeed(target).host
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

function buildLocalToolRawResult(context: LocalToolExecutionContext): LocalToolRawResult {
  const { priorOutputs, project, run } = context

  if (run.toolName === "seed-normalizer") {
    const normalized = normalizeSeed(run.target || project.seed).normalizedTargets

    return {
      outputs: {
        normalizedTargets: normalized,
      },
      structuredContent: {
        host: normalizeSeed(run.target || project.seed).host,
        normalizedTargets: normalized,
      },
      summaryLines: [
        `标准化得到 ${normalized.length} 个种子目标。`,
        normalized.join(" / "),
      ],
    }
  }

  if (run.toolName === "dns-census") {
    const host = getHostFromTarget(run.target || project.seed)
    const root = getRootDomain(host)
    const discoveredSubdomains = Array.from(new Set([host, `admin.${root}`, `assets.${root}`]))

    return {
      outputs: {
        discoveredSubdomains,
      },
      structuredContent: {
        discoveredSubdomains,
        rootDomain: root,
        source: host,
      },
      summaryLines: [
        `被动发现 ${discoveredSubdomains.length} 个候选域名或子域。`,
        discoveredSubdomains.join(" / "),
      ],
    }
  }

  if (run.toolName === "web-surface-map") {
    const targets = priorOutputs.discoveredSubdomains?.length
      ? priorOutputs.discoveredSubdomains
      : [getHostFromTarget(run.target || project.seed)]
    const webEntries = targets.map((target, index) => ({
      url: index === 0 ? `https://${target}/login` : `https://${target}/dashboard`,
      title: index === 0 ? `${project.name} 统一入口` : `${project.name} 管理台`,
      statusCode: index === 0 ? 200 : 302,
      headers: [
        "server: nginx",
        "x-powered-by: Next.js",
        index === 0 ? "x-frame-options: deny" : "location: /dashboard",
      ],
      fingerprint: index === 0 ? "Next.js + nginx 登录入口" : "管理台跳转入口",
    }))

    return {
      outputs: {
        webEntries: webEntries.map((entry) => entry.url),
      },
      structuredContent: {
        webEntries,
      },
      summaryLines: [
        `识别到 ${webEntries.length} 个 Web 入口。`,
        webEntries.map((entry) => entry.url).join(" / "),
      ],
    }
  }

  if (run.toolName === "auth-guard-check") {
    const validatedTarget = run.target
    const findingTitle = run.requestedAction.includes("登录")
      ? "登录链路存在受控认证绕过候选"
      : "匿名接口存在鉴权防护缺口候选"
    const responseSignals = run.requestedAction.includes("登录")
      ? [
          "GET /login -> 200",
          "POST /login?preview=1 返回 legacy-auth 调试头",
          "跳转链路暴露 dashboard 前置上下文标识",
        ]
      : [
          "GET /report/list -> 200",
          "响应头暴露内部 trace id",
          "匿名请求可抵达预期资源模型",
        ]

    return {
      outputs: {
        validatedTargets: [validatedTarget],
        generatedFindings: [findingTitle],
      },
      structuredContent: {
        validatedTarget,
        finding: {
          affectedSurface: validatedTarget,
          severity: "高危",
          status: "待复核",
          summary: "审批通过后的受控验证命中高价值异常响应，需要继续结合证据和人工复核形成最终结论。",
          title: findingTitle,
        },
        responseSignals,
        verdict: "当前结果先进入漏洞与发现列表，等待研究员继续复核证据。",
      },
      summaryLines: [
        "审批通过后的受控验证已执行，产生了新的高价值结果。",
        findingTitle,
      ],
    }
  }

  if (run.toolName === "report-exporter") {
    const currentAssets = listStoredAssets(project.id).length
    const currentEvidence = listStoredEvidence(project.id).length
    const currentFindings = refreshStoredProjectResults(project.id)?.detail.findings.length ?? 0
    const reportDigest = [
      `种子目标 ${priorOutputs.normalizedTargets?.length ?? 0} 个`,
      `域名与入口 ${currentAssets} 条`,
      `证据锚点 ${currentEvidence} 条`,
      `漏洞与发现 ${currentFindings} 条`,
    ]

    return {
      outputs: {
        reportDigest,
      },
      structuredContent: {
        reportDigest,
      },
      summaryLines: [
        "已生成基础流程测试报告摘要。",
        reportDigest.join("；"),
      ],
    }
  }

  return {
    outputs: {},
    structuredContent: {},
    summaryLines: [`${run.toolName} 已执行，但当前没有定义额外的本地结果展开逻辑。`],
  }
}

function normalizeExecutionArtifacts(
  context: LocalToolExecutionContext,
  rawResult: LocalToolRawResult,
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
    const assets = discoveredSubdomains.map((host) => {
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
        exposure: "由被动子域与证书情报补采发现，可继续衔接 Web 入口识别。",
        linkedEvidenceId: evidenceId,
        linkedTaskTitle: context.run.requestedAction,
        issueLead: "建议继续补采 Web 面入口、响应头和服务指纹。",
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
          rawOutput: discoveredSubdomains.map((item) => `subdomain=${item}`),
          screenshotNote: "当前为被动情报结果，无页面截图。",
          structuredSummary: [
            `被动发现 ${discoveredSubdomains.length} 条域名或子域结果。`,
            "结果已同步进入域名 / Web 入口表格，可继续向 Web 与服务识别流转。",
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
          summary: `被动情报新增 ${discoveredSubdomains.length} 条域名 / 子域结果。`,
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

export function executeStoredMcpRun(
  runId: string,
  priorOutputs: McpWorkflowSmokePayload["outputs"] = {},
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
  const executionContext: LocalToolExecutionContext = {
    approval,
    priorOutputs,
    project,
    run,
  }
  const rawResult = buildLocalToolRawResult(executionContext)
  const artifacts = normalizeExecutionArtifacts(executionContext, rawResult)

  upsertStoredAssets(artifacts.assets)
  upsertStoredEvidence(artifacts.evidence)
  upsertStoredProjectFindings(artifacts.findings)
  upsertStoredWorkLogs(artifacts.workLogs)
  updateProjectExecutionMeta(project, run)

  const persistedRun = updateStoredMcpRun(run.id, {
    status: "已执行",
    summaryLines: Array.from(
      new Set([
        ...run.summaryLines,
        ...rawResult.summaryLines,
        artifacts.assets.length > 0 ? `资产中心已新增或刷新 ${artifacts.assets.length} 条记录。` : "",
        artifacts.evidence.length > 0 ? `证据中心已新增或刷新 ${artifacts.evidence.length} 条记录。` : "",
        artifacts.findings.length > 0 ? `漏洞与发现已新增 ${artifacts.findings.length} 条。` : "",
        run.linkedApprovalId ? "审批已批准后的执行结果已回流到平台记录。" : "",
      ].filter(Boolean)),
    ),
  })

  refreshStoredProjectResults(project.id)

  return {
    outputs: {
      ...priorOutputs,
      ...rawResult.outputs,
    },
    run: persistedRun ?? run,
  }
}

export function resumeStoredApprovedMcpRun(approvalId: string) {
  const approval = getStoredApprovalById(approvalId)

  if (!approval || approval.status !== "已批准") {
    return null
  }

  const run = listStoredMcpRuns().find((item) => item.linkedApprovalId === approvalId)

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
