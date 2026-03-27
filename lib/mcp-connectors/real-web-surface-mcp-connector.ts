import { callMcpServerTool } from "@/lib/mcp-client-service"
import { createExecutionAbortError, isExecutionAbortError, throwIfExecutionAborted } from "@/lib/mcp-execution-abort"
import { findStoredEnabledMcpServerByToolBinding } from "@/lib/mcp-server-repository"
import type { McpConnector, McpConnectorExecutionContext, McpConnectorResult } from "@/lib/mcp-connectors/types"

type WebSurfaceStructuredContent = {
  webEntries?: Array<{
    url: string
    finalUrl?: string
    title: string
    statusCode: number
    headers: string[]
    fingerprint?: string
  }>
}

function isHttpTarget(target: string) {
  return /^https?:\/\//i.test(target)
}

function summarizeEntry(entry: NonNullable<WebSurfaceStructuredContent["webEntries"]>[number]) {
  return [`状态 ${entry.statusCode}`, entry.title || "无标题", entry.url].filter(Boolean).join(" / ")
}

export const realWebSurfaceMcpConnector: McpConnector = {
  key: "real-web-surface-mcp",
  mode: "real",
  supports: ({ project, run }) => {
    const target = run.target || project.seed

    return run.toolName === "web-surface-map" && isHttpTarget(target) && Boolean(findStoredEnabledMcpServerByToolBinding(run.toolName))
  },
  async execute(context: McpConnectorExecutionContext): Promise<McpConnectorResult> {
    throwIfExecutionAborted(context.signal)

    const target = context.run.target || context.project.seed
    const server = findStoredEnabledMcpServerByToolBinding(context.run.toolName)

    if (!server) {
      return {
        status: "failed",
        connectorKey: "real-web-surface-mcp",
        mode: "real",
        errorMessage: "未找到可用的 Web 页面探测 MCP server。",
        summaryLines: ["真实 MCP server 尚未连接，当前动作无法走 stdio 实链路。"],
      }
    }

    try {
      const result = await callMcpServerTool<WebSurfaceStructuredContent>({
        server,
        toolName: "probe_web_surface",
        arguments: {
          targetUrl: target,
        },
        signal: context.signal,
        target,
      })
      const webEntries = result.structuredContent.webEntries ?? []

      return {
        status: "succeeded",
        connectorKey: "real-web-surface-mcp",
        mode: "real",
        outputs: {
          webEntries: webEntries.map((entry) => entry.url),
        },
        rawOutput: webEntries.flatMap((entry) => [`url: ${entry.url}`, `title: ${entry.title}`, ...entry.headers]),
        structuredContent: {
          webEntries,
        },
        summaryLines: webEntries.length > 0 ? [`真实 MCP 已完成 ${webEntries.length} 个 Web 页面入口探测。`, summarizeEntry(webEntries[0])] : ["真实 MCP 已执行，但未返回可用的页面入口结果。"],
      }
    } catch (error) {
      if (isExecutionAbortError(error) || context.signal?.aborted) {
        throw createExecutionAbortError(error)
      }

      return {
        status: "retryable_failure",
        connectorKey: "real-web-surface-mcp",
        mode: "real",
        errorMessage: error instanceof Error ? error.message : "真实 MCP Web 页面探测失败。",
        summaryLines: ["真实 MCP Web 页面探测失败，已保留为可重试状态。"],
        retryAfterMinutes: 5,
      }
    }
  },
}
