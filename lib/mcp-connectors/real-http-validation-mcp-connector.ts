import { callMcpServerTool } from "@/lib/mcp-client-service"
import { resolveLocalLabHttpTarget } from "@/lib/local-lab-catalog"
import { createExecutionAbortError, isExecutionAbortError, throwIfExecutionAborted } from "@/lib/mcp-execution-abort"
import { findStoredEnabledMcpServerByToolBinding } from "@/lib/mcp-server-repository"
import type { McpConnector, McpConnectorExecutionContext, McpConnectorResult } from "@/lib/mcp-connectors/types"

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
    severity: "高危" | "中危" | "低危" | "情报"
    status: "待验证" | "已确认" | "待复核" | "已缓解"
    summary: string
    title: string
  }
  verdict?: string
}

function isHttpTarget(target: string) {
  return /^https?:\/\//i.test(target)
}

function inferValidationProfile(context: McpConnectorExecutionContext) {
  const text = `${context.run.requestedAction} ${context.run.target}`.toLowerCase()

  if (text.includes("actuator")) {
    return "spring-actuator-exposure"
  }

  return "generic-http-validation"
}

function buildSummaryLines(
  result: HttpValidationStructuredContent,
  hasLocalLabFallback: boolean,
) {
  const responseStatus = result.responseSummary?.statusCode
  const leadSignal = result.responseSignals?.[0]

  return [
    "真实 MCP 已完成 HTTP 受控验证。",
    result.finding?.title ?? (responseStatus ? `响应状态 ${responseStatus}` : "未返回响应状态"),
    leadSignal ?? result.verdict ?? "未命中明确验证信号。",
    hasLocalLabFallback ? "已为本地靶场注入 docker fallback 参数。" : "当前目标走宿主机直连验证。",
  ]
}

export const realHttpValidationMcpConnector: McpConnector = {
  key: "real-http-validation-mcp",
  mode: "real",
  supports: ({ project, run }) => {
    const target = run.target || project.seed

    return run.toolName === "auth-guard-check" && isHttpTarget(target) && Boolean(findStoredEnabledMcpServerByToolBinding(run.toolName))
  },
  async execute(context: McpConnectorExecutionContext): Promise<McpConnectorResult> {
    throwIfExecutionAborted(context.signal)

    const target = context.run.target || context.project.seed
    const server = findStoredEnabledMcpServerByToolBinding(context.run.toolName)

    if (!server) {
      return {
        status: "failed",
        connectorKey: "real-http-validation-mcp",
        mode: "real",
        errorMessage: "未找到可用的 HTTP 受控验证 MCP server。",
        summaryLines: ["真实 HTTP 受控验证 MCP server 尚未连接。"],
      }
    }

    try {
      const localLabTarget = resolveLocalLabHttpTarget(target)
      const result = await callMcpServerTool<HttpValidationStructuredContent>({
        server,
        toolName: "run_http_validation",
        arguments: {
          targetUrl: target,
          method: "GET",
          headers: {
            accept: "application/json, */*",
          },
          validationProfile: inferValidationProfile(context),
          dockerContainerName: localLabTarget?.dockerContainerName,
          internalTargetUrl: localLabTarget?.internalTargetUrl,
        },
        signal: context.signal,
        target,
      })
      const responseSummary = result.structuredContent.responseSummary
      const responseSignals = result.structuredContent.responseSignals ?? []
      const rawOutput = [
        result.structuredContent.requestSummary
          ? `${result.structuredContent.requestSummary.method} ${result.structuredContent.requestSummary.url}`
          : "",
        responseSummary ? `HTTP ${responseSummary.statusCode}` : "",
        ...(responseSummary?.headers ?? []),
        ...(responseSignals ?? []),
        responseSummary?.bodyPreview ? `body: ${responseSummary.bodyPreview}` : "",
      ].filter(Boolean)

      return {
        status: "succeeded",
        connectorKey: "real-http-validation-mcp",
        mode: "real",
        outputs: {
          validatedTargets: [target],
          generatedFindings: result.structuredContent.finding?.title ? [result.structuredContent.finding.title] : [],
        },
        rawOutput,
        structuredContent: {
          ...result.structuredContent,
        },
        summaryLines: buildSummaryLines(result.structuredContent, Boolean(localLabTarget?.dockerContainerName)),
      }
    } catch (error) {
      if (isExecutionAbortError(error) || context.signal?.aborted) {
        throw createExecutionAbortError(error)
      }

      return {
        status: "retryable_failure",
        connectorKey: "real-http-validation-mcp",
        mode: "real",
        errorMessage: error instanceof Error ? error.message : "真实 HTTP 受控验证失败。",
        summaryLines: ["真实 HTTP 受控验证失败，已保留为可重试状态。"],
        retryAfterMinutes: 5,
      }
    }
  },
}
