import { callMcpServerTool } from "@/lib/mcp-client-service"
import { resolveLocalLabHttpTarget } from "@/lib/local-lab-catalog"
import { createExecutionAbortError, isExecutionAbortError, throwIfExecutionAborted } from "@/lib/mcp-execution-abort"
import { findStoredEnabledMcpServerByToolBinding } from "@/lib/mcp-server-repository"
import type { McpConnector, McpConnectorExecutionContext, McpConnectorResult } from "@/lib/mcp-connectors/types"

type HttpStructureStructuredContent = {
  structureEntries?: Array<{
    kind: string
    label: string
    url: string
    confidence: string
    source: string
  }>
  webEntries?: Array<{
    url: string
    finalUrl?: string
    title: string
    statusCode: number
    headers: string[]
    fingerprint?: string
  }>
  transport?: "host" | "docker"
}

function isHttpTarget(target: string) {
  return /^https?:\/\//i.test(target)
}

export const realHttpStructureMcpConnector: McpConnector = {
  key: "real-http-structure-mcp",
  mode: "real",
  supports: ({ project, run }) => {
    const target = run.target || project.seed

    return run.toolName === "graphql-surface-check" && isHttpTarget(target) && Boolean(findStoredEnabledMcpServerByToolBinding(run.toolName))
  },
  async execute(context: McpConnectorExecutionContext): Promise<McpConnectorResult> {
    throwIfExecutionAborted(context.signal)

    const target = context.run.target || context.project.seed
    const server = findStoredEnabledMcpServerByToolBinding(context.run.toolName)

    if (!server) {
      return {
        status: "failed",
        connectorKey: "real-http-structure-mcp",
        mode: "real",
        errorMessage: "未找到可用的 HTTP / API 结构发现 MCP server。",
        summaryLines: ["真实 HTTP / API 结构发现 MCP server 尚未连接。"],
      }
    }

    const localLabTarget = resolveLocalLabHttpTarget(target)

    try {
      const result = await callMcpServerTool<HttpStructureStructuredContent>({
        server,
        toolName: "discover_http_structure",
        arguments: {
          targetUrl: target,
          dockerContainerName: localLabTarget?.dockerContainerName,
          internalTargetUrl: localLabTarget?.internalTargetUrl,
        },
        signal: context.signal,
        target,
      })
      const structureEntries = result.structuredContent.structureEntries ?? []
      const transport = result.structuredContent.transport ?? "host"

      return {
        status: "succeeded",
        connectorKey: "real-http-structure-mcp",
        mode: "real",
        outputs: {},
        rawOutput: structureEntries.map((entry) => `${entry.kind}: ${entry.url}`),
        structuredContent: {
          structureEntries,
          transport,
          webEntries: result.structuredContent.webEntries ?? [],
        },
        summaryLines: [
          structureEntries.length > 0
            ? `真实 MCP 已识别 ${structureEntries.length} 个 HTTP / API 结构候选入口。`
            : "真实 MCP 已执行 HTTP / API 结构发现，但未识别到明确入口。",
          transport === "docker" ? "当前结果通过容器内 fallback 获取。" : "当前结果通过宿主机直连获取。",
        ],
      }
    } catch (error) {
      if (isExecutionAbortError(error) || context.signal?.aborted) {
        throw createExecutionAbortError(error)
      }

      return {
        status: "retryable_failure",
        connectorKey: "real-http-structure-mcp",
        mode: "real",
        errorMessage: error instanceof Error ? error.message : "真实 MCP HTTP / API 结构发现失败。",
        summaryLines: ["真实 MCP HTTP / API 结构发现失败，已保留为可重试状态。"],
        retryAfterMinutes: 5,
      }
    }
  },
}

