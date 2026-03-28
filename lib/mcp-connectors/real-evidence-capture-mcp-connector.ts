import { callMcpServerTool } from "@/lib/mcp-client-service"
import { createExecutionAbortError, isExecutionAbortError, throwIfExecutionAborted } from "@/lib/mcp-execution-abort"
import { findStoredEnabledMcpServerByToolBinding } from "@/lib/mcp-server-repository"
import { getProjectPrimaryTarget } from "@/lib/project-targets"
import { allocateRunArtifactTargets } from "@/lib/runtime-artifacts"
import type { McpConnector, McpConnectorExecutionContext, McpConnectorResult } from "@/lib/mcp-connectors/types"

type EvidenceCaptureStructuredContent = {
  finalUrl?: string
  pageTitle?: string
  statusCode?: number
  contentType?: string
  htmlPreview?: string
}

function isHttpTarget(target: string) {
  return /^https?:\/\//i.test(target)
}

function buildSummaryLines(result: EvidenceCaptureStructuredContent) {
  return [
    "真实 MCP 已完成页面截图与 HTML 快照采集。",
    result.pageTitle ?? "已采集目标页面上下文。",
    result.statusCode ? `主响应状态 ${result.statusCode}` : "当前未返回明确状态码。",
  ]
}

export const realEvidenceCaptureMcpConnector: McpConnector = {
  key: "real-evidence-capture-mcp",
  mode: "real",
  supports: ({ project, run }) => {
    const target = run.target || getProjectPrimaryTarget(project)

    return run.toolName === "capture-evidence" && isHttpTarget(target) && Boolean(findStoredEnabledMcpServerByToolBinding(run.toolName))
  },
  async execute(context: McpConnectorExecutionContext): Promise<McpConnectorResult> {
    throwIfExecutionAborted(context.signal)

    const target = context.run.target || getProjectPrimaryTarget(context.project)
    const server = findStoredEnabledMcpServerByToolBinding(context.run.toolName)

    if (!server) {
      return {
        status: "failed",
        connectorKey: "real-evidence-capture-mcp",
        mode: "real",
        errorMessage: "未找到可用的截图与证据采集 MCP server。",
        summaryLines: ["真实截图与证据采集 MCP server 尚未连接。"],
      }
    }

    const artifactTargets = allocateRunArtifactTargets({
      projectId: context.project.id,
      runId: context.run.id,
      target,
    })

    try {
      const result = await callMcpServerTool<EvidenceCaptureStructuredContent>({
        server,
        toolName: "capture_page_evidence",
        arguments: {
          targetUrl: target,
          screenshotPath: artifactTargets.screenshotAbsolutePath,
          htmlPath: artifactTargets.htmlAbsolutePath,
          fullPage: true,
          timeoutMs: 15_000,
        },
        signal: context.signal,
        target,
      })
      const capturedUrl = result.structuredContent.finalUrl ?? target

      return {
        status: "succeeded",
        connectorKey: "real-evidence-capture-mcp",
        mode: "real",
        outputs: {},
        rawOutput: [
          `captured: ${capturedUrl}`,
          result.structuredContent.pageTitle ? `title: ${result.structuredContent.pageTitle}` : "",
          result.structuredContent.statusCode ? `status: ${result.structuredContent.statusCode}` : "",
          `screenshot: ${artifactTargets.screenshotRelativePath}`,
          `html: ${artifactTargets.htmlRelativePath}`,
          result.structuredContent.htmlPreview ? `html-preview: ${result.structuredContent.htmlPreview}` : "",
        ].filter(Boolean),
        structuredContent: {
          ...result.structuredContent,
          capturedUrl,
          screenshotArtifactPath: artifactTargets.screenshotRelativePath,
          htmlArtifactPath: artifactTargets.htmlRelativePath,
        },
        summaryLines: buildSummaryLines(result.structuredContent),
      }
    } catch (error) {
      if (isExecutionAbortError(error) || context.signal?.aborted) {
        throw createExecutionAbortError(error)
      }

      return {
        status: "retryable_failure",
        connectorKey: "real-evidence-capture-mcp",
        mode: "real",
        errorMessage: error instanceof Error ? error.message : "真实截图与证据采集失败。",
        summaryLines: ["真实截图与证据采集失败，已保留为可重试状态。"],
        retryAfterMinutes: 5,
      }
    }
  },
}
