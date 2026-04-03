import { allocateRunArtifactTargets } from "@/lib/data/runtime-artifacts"
import { createRealMcpConnector, isHttpTarget } from "@/lib/mcp-connectors/real-mcp-connector-base"

type EvidenceCaptureStructuredContent = {
  finalUrl?: string
  pageTitle?: string
  statusCode?: number
  contentType?: string
  htmlPreview?: string
}

export const realEvidenceCaptureMcpConnector = createRealMcpConnector<EvidenceCaptureStructuredContent>({
  connectorKey: "real-evidence-capture-mcp",
  label: "截图与证据采集",
  mcpToolName: "capture_page_evidence",

  supportsCheck: ({ run }, target) =>
    run.toolName === "capture-evidence" && isHttpTarget(target),

  buildArguments: (target, _localLab, context) => {
    const artifactTargets = allocateRunArtifactTargets({
      projectId: context.project.id,
      runId: context.run.id,
      target,
    })

    return {
      targetUrl: target,
      screenshotPath: artifactTargets.screenshotAbsolutePath,
      htmlPath: artifactTargets.htmlAbsolutePath,
      fullPage: true,
      timeoutMs: 15_000,
    }
  },

  buildSuccess: (structured, target, _localLab, context) => {
    const artifactTargets = allocateRunArtifactTargets({
      projectId: context.project.id,
      runId: context.run.id,
      target,
    })
    const capturedUrl = structured.finalUrl ?? target

    return {
      outputs: {},
      rawOutput: [
        `captured: ${capturedUrl}`,
        structured.pageTitle ? `title: ${structured.pageTitle}` : "",
        structured.statusCode ? `status: ${structured.statusCode}` : "",
        `screenshot: ${artifactTargets.screenshotRelativePath}`,
        `html: ${artifactTargets.htmlRelativePath}`,
        structured.htmlPreview ? `html-preview: ${structured.htmlPreview}` : "",
      ].filter(Boolean),
      structuredContent: {
        ...structured,
        capturedUrl,
        screenshotArtifactPath: artifactTargets.screenshotRelativePath,
        htmlArtifactPath: artifactTargets.htmlRelativePath,
      },
      summaryLines: [
        "真实 MCP 已完成页面截图与 HTML 快照采集。",
        structured.pageTitle ?? "已采集目标页面上下文。",
        structured.statusCode ? `主响应状态 ${structured.statusCode}` : "当前未返回明确状态码。",
      ],
    }
  },
})
