/**
 * llm-writeback-service.ts — LLM 工具结果分析 + Write-back 服务
 *
 * 替代原有的 normalizeExecutionArtifacts / normalizeStdioMcpArtifacts 硬编码解析器。
 * 核心思路：MCP 工具执行完后，将 rawOutput 发送给 LLM 分析，LLM 返回结构化的
 * findings/assets/evidence，平台直接写入数据库。
 *
 * 优势：
 * - 不依赖任何固定格式解析器，LLM 语义理解任何工具输出
 * - 新增 MCP 工具时零适配成本
 * - 发现漏洞的能力取决于 LLM 的分析能力，而非正则匹配
 */
import { createHash } from "crypto"
import type { McpConnectorExecutionContext, McpConnectorResult } from "@/lib/mcp-connectors/types"
import { resolveLlmProvider } from "@/lib/llm-provider/registry"
import type { LlmAnalysisResult } from "@/lib/llm-provider/types"
import { buildStableRecordId, formatTimestamp, formatDayStamp } from "@/lib/prototype-record-utils"
import { listStoredAssets } from "@/lib/data/asset-repository"
import { getHostFromTarget } from "@/lib/mcp-connectors/local-foundational-connectors"
import type {
  AssetRecord,
  EvidenceRecord,
  LogRecord,
  McpRunRecord,
  ProjectFindingRecord,
} from "@/lib/prototype-types"

type NormalizedExecutionArtifacts = {
  actor: string
  assets: AssetRecord[]
  evidence: EvidenceRecord[]
  findings: ProjectFindingRecord[]
  workLogs: LogRecord[]
}

const MAX_RAW_OUTPUT_CHARS = 8000

function makeEvidenceId(run: McpRunRecord) {
  const hash = createHash("md5").update(run.id).digest("hex").slice(0, 16)
  return `EV-${formatDayStamp()}-${hash}`
}

function buildRawOutputText(rawResult: Extract<McpConnectorResult, { status: "succeeded" }>): string {
  const parts: string[] = []

  // Include raw output lines
  if (rawResult.rawOutput && rawResult.rawOutput.length > 0) {
    parts.push(rawResult.rawOutput.join("\n"))
  }

  // Include structured content as JSON
  if (rawResult.structuredContent && Object.keys(rawResult.structuredContent).length > 0) {
    // For execute_code, extract stdout from structured content
    const sc = rawResult.structuredContent
    if (typeof sc.stdout === "string" && sc.stdout) {
      parts.push("=== 脚本 stdout ===")
      parts.push(sc.stdout)
    }
    if (typeof sc.stderr === "string" && sc.stderr) {
      parts.push("=== 脚本 stderr ===")
      parts.push(sc.stderr)
    }
    // For non-script tools, include the full structured content
    if (!sc.stdout && !sc.stderr) {
      parts.push("=== 结构化输出 ===")
      parts.push(JSON.stringify(sc, null, 2))
    }
  }

  // Include summary lines as additional context
  if (rawResult.summaryLines && rawResult.summaryLines.length > 0) {
    parts.push("=== 执行摘要 ===")
    parts.push(rawResult.summaryLines.join("\n"))
  }

  const fullText = parts.join("\n")

  // Truncate to prevent excessive token usage
  if (fullText.length > MAX_RAW_OUTPUT_CHARS) {
    return fullText.slice(0, MAX_RAW_OUTPUT_CHARS) + "\n...(输出过长，已截断)"
  }

  return fullText
}

function mapSeverity(severity: string): ProjectFindingRecord["severity"] {
  const s = severity.toLowerCase()
  if (s.includes("高") || s.includes("high") || s.includes("critical")) return "高危"
  if (s.includes("中") || s.includes("medium")) return "中危"
  if (s.includes("低") || s.includes("low")) return "低危"
  if (s.includes("信息") || s.includes("info")) return "信息"
  return "低危"
}

function convertAnalysisToArtifacts(
  analysis: LlmAnalysisResult,
  context: McpConnectorExecutionContext,
  rawResult: Extract<McpConnectorResult, { status: "succeeded" }>,
  existingAssets: Map<string, AssetRecord>,
): NormalizedExecutionArtifacts {
  const timestamp = formatTimestamp()
  const evidenceId = makeEvidenceId(context.run)
  const actor = context.run.toolName
  const linkedApprovalId = context.run.linkedApprovalId ?? ""

  // Convert LLM analysis assets to platform AssetRecords
  const assets: AssetRecord[] = []
  for (const llmAsset of analysis.assets) {
    const value = llmAsset.value.trim()
    if (!value) continue

    const assetType = llmAsset.type || "host"
    const host = getHostFromTarget(value) || value
    const assetId = buildStableRecordId("asset", context.project.id, assetType, value)

    if (assets.some((a) => a.id === assetId)) continue
    const existing = existingAssets.get(assetId)

    assets.push({
      id: assetId,
      projectId: context.project.id,
      projectName: context.project.name,
      type: assetType,
      label: value,
      profile: llmAsset.detail ?? `${actor} 发现`,
      scopeStatus: "已确认",
      lastSeen: timestamp,
      host,
      ownership: `${context.project.name} MCP 结果`,
      confidence: "0.80",
      exposure: llmAsset.detail ?? `由 ${actor} 在 ${context.run.requestedAction} 中发现。`,
      linkedEvidenceId: evidenceId,
      linkedTaskTitle: context.run.requestedAction,
      issueLead: "可继续采集详细信息。",
      relations: [
        ...(existing?.relations ?? []),
        {
          id: buildStableRecordId("asset-rel", value, "evidence"),
          label: evidenceId,
          type: "evidence",
          relation: "发现证据",
          scopeStatus: "已确认",
        },
      ],
    })
  }

  // Convert LLM analysis findings to platform ProjectFindingRecords
  const findings: ProjectFindingRecord[] = []
  for (const llmFinding of analysis.findings) {
    const severity = mapSeverity(llmFinding.severity)
    const target = llmFinding.target ?? context.run.target
    const findingId = buildStableRecordId("finding", context.project.id, target, llmFinding.title)

    if (findings.some((f) => f.id === findingId)) continue

    findings.push({
      id: findingId,
      projectId: context.project.id,
      severity,
      status: "待复核",
      title: llmFinding.title,
      summary: [
        llmFinding.detail,
        llmFinding.recommendation ? `修复建议：${llmFinding.recommendation}` : "",
      ].filter(Boolean).join("\n"),
      affectedSurface: target,
      evidenceId,
      owner: actor,
      createdAt: timestamp,
      updatedAt: timestamp,
      rawOutput: [],
    })
  }

  // Build evidence record
  const summaryParts: string[] = []
  if (assets.length > 0) summaryParts.push(`发现 ${assets.length} 个资产`)
  if (findings.length > 0) summaryParts.push(`发现 ${findings.length} 个漏洞/问题`)
  const summaryText = summaryParts.length > 0 ? summaryParts.join("，") : analysis.summary

  const evidence: EvidenceRecord[] = [{
    id: evidenceId,
    projectId: context.project.id,
    projectName: context.project.name,
    title: `${actor} 执行结果`,
    source: context.run.capability,
    confidence: findings.length > 0 ? "0.85" : "0.78",
    conclusion: findings.length > 0 ? "待复核问题" : "结果已归档",
    linkedApprovalId,
    rawOutput: rawResult.rawOutput ?? [],
    screenshotNote: "当前为 MCP 工具结构化输出。",
    structuredSummary: [summaryText, analysis.summary],
    linkedTaskTitle: context.run.requestedAction,
    linkedAssetLabel: assets[0]?.label ?? context.run.target,
    timeline: [`${timestamp} ${actor} 执行完成`, `${timestamp} LLM 分析完成`],
    verdict: findings.length > 0
      ? "LLM 分析发现安全问题，建议进一步复核确认。"
      : "LLM 分析未发现明显安全问题，结果已归档。",
  }]

  return {
    actor,
    assets,
    evidence,
    findings,
    workLogs: [{
      id: `work-${context.run.id}`,
      category: context.run.capability,
      summary: `[LLM 分析] ${summaryText}`,
      projectName: context.project.name,
      actor,
      timestamp,
      status: findings.length > 0 ? "待复核" : "已完成",
    }],
  }
}

function buildFallbackArtifacts(
  context: McpConnectorExecutionContext,
  rawResult: Extract<McpConnectorResult, { status: "succeeded" }>,
  errorMessage: string,
): NormalizedExecutionArtifacts {
  const timestamp = formatTimestamp()
  const evidenceId = makeEvidenceId(context.run)
  const actor = context.run.toolName

  return {
    actor,
    assets: [],
    evidence: [{
      id: evidenceId,
      projectId: context.project.id,
      projectName: context.project.name,
      title: `${actor} 执行结果（LLM 分析不可用）`,
      source: context.run.capability,
      confidence: "0.50",
      conclusion: "结果已归档（未经 LLM 分析）",
      linkedApprovalId: context.run.linkedApprovalId ?? "",
      rawOutput: rawResult.rawOutput ?? [],
      screenshotNote: "LLM 分析不可用，原始输出已保存。",
      structuredSummary: [
        `${actor} 已执行完成，但 LLM 分析不可用：${errorMessage}`,
        "原始输出已保存为证据，将在下一轮由 LLM 补充分析。",
      ],
      linkedTaskTitle: context.run.requestedAction,
      linkedAssetLabel: context.run.target,
      timeline: [`${timestamp} ${actor} 执行完成`, `${timestamp} LLM 分析失败：${errorMessage}`],
      verdict: "原始结果已归档，等待后续 LLM 分析。",
    }],
    findings: [],
    workLogs: [{
      id: `work-${context.run.id}`,
      category: context.run.capability,
      summary: `${actor} 已执行，LLM 分析暂不可用（${errorMessage}）。原始结果已保存。`,
      projectName: context.project.name,
      actor,
      timestamp,
      status: "已完成",
    }],
  }
}

/**
 * 核心函数：使用 LLM 分析工具执行结果并生成平台记录。
 *
 * 替代原有的 normalizeExecutionArtifacts 中的工具特定解析器。
 * 如果 LLM 不可用或调用失败，降级为保存原始输出。
 */
export async function analyzeAndWriteback(
  context: McpConnectorExecutionContext,
  rawResult: Extract<McpConnectorResult, { status: "succeeded" }>,
): Promise<NormalizedExecutionArtifacts> {
  const rawOutputText = buildRawOutputText(rawResult)

  // If there's no meaningful output, return minimal artifacts
  if (!rawOutputText.trim()) {
    return buildFallbackArtifacts(context, rawResult, "工具未产生有意义的输出")
  }

  const existingAssets = new Map(
    (await listStoredAssets(context.project.id)).map((asset) => [asset.id, asset]),
  )

  // Resolve LLM provider
  const provider = await resolveLlmProvider()

  if (!provider) {
    console.warn(`[writeback] LLM 未配置，${context.run.toolName}(${context.run.target}) 结果降级保存。`)
    return buildFallbackArtifacts(context, rawResult, "LLM 未配置")
  }

  try {
    const analysis = await provider.analyzeToolOutput({
      toolName: context.run.toolName,
      target: context.run.target,
      capability: context.run.capability,
      requestedAction: context.run.requestedAction,
      rawOutput: rawOutputText,
      projectId: context.project.id,
    })

    console.info(
      `[writeback] LLM 分析完成 ${context.run.toolName}(${context.run.target}): ` +
      `${analysis.findings.length} findings, ${analysis.assets.length} assets`,
    )

    return convertAnalysisToArtifacts(analysis, context, rawResult, existingAssets)
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误"
    console.error(`[writeback] LLM 分析失败 ${context.run.toolName}(${context.run.target}): ${message}`)
    return buildFallbackArtifacts(context, rawResult, message)
  }
}
