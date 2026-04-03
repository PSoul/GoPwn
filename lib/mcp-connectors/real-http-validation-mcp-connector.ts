import { createRealMcpConnector, isHttpTarget } from "@/lib/mcp-connectors/real-mcp-connector-base"

type HttpValidationStructuredContent = {
  transport?: "host" | "docker"
  requestSummary?: {
    method: string
    url: string
    headers: string[]
    bodyPreview: string
  }
  responseSummary?: {
    finalUrl?: string
    statusCode: number
    headers: string[]
    bodyPreview: string
    contentType?: string
  }
  responseSignals?: string[]
  finding?: {
    affectedSurface: string
    severity: "高危" | "中危" | "低危" | "信息"
    status: "待验证" | "已确认" | "待复核" | "已缓解"
    summary: string
    title: string
  }
  verdict?: string
}

export const realHttpValidationMcpConnector = createRealMcpConnector<HttpValidationStructuredContent>({
  connectorKey: "real-http-validation-mcp",
  label: "HTTP 受控验证",
  mcpToolName: "run_http_validation",

  supportsCheck: ({ run }, target) =>
    run.capability === "受控验证类" && isHttpTarget(target),

  buildArguments: (target, localLab, context) => ({
    targetUrl: target,
    method: "GET",
    headers: { accept: "application/json, */*" },
    validationProfile: "generic-http-validation",
    dockerContainerName: localLab?.dockerContainerName,
    internalTargetUrl: localLab?.internalTargetUrl,
  }),

  buildSuccess: (structured, target, localLab) => {
    const responseSummary = structured.responseSummary
    const responseSignals = structured.responseSignals ?? []
    const rawOutput = [
      structured.requestSummary ? `${structured.requestSummary.method} ${structured.requestSummary.url}` : "",
      responseSummary ? `HTTP ${responseSummary.statusCode}` : "",
      ...(responseSummary?.headers ?? []),
      ...responseSignals,
      responseSummary?.bodyPreview ? `body: ${responseSummary.bodyPreview}` : "",
    ].filter(Boolean)

    return {
      outputs: {
        validatedTargets: [target],
        generatedFindings: structured.finding?.title ? [structured.finding.title] : [],
      },
      rawOutput,
      structuredContent: { ...structured },
      summaryLines: [
        "真实 MCP 已完成 HTTP 受控验证。",
        structured.finding?.title ?? (responseSummary?.statusCode ? `响应状态 ${responseSummary.statusCode}` : "未返回响应状态"),
        responseSignals[0] ?? structured.verdict ?? "未命中明确验证信号。",
        localLab?.dockerContainerName ? "已为本地靶场注入 docker fallback 参数。" : "当前目标走宿主机直连验证。",
      ],
    }
  },
})
