import { createRealMcpConnector, isHttpTarget, resolveTarget } from "@/lib/mcp-connectors/real-mcp-connector-base"

type WebSurfaceEntry = {
  url: string
  finalUrl?: string
  title: string
  statusCode: number
  headers: string[]
  fingerprint?: string
}

type WebSurfaceStructuredContent = {
  webEntries?: WebSurfaceEntry[]
}

export const realWebSurfaceMcpConnector = createRealMcpConnector<WebSurfaceStructuredContent>({
  connectorKey: "real-web-surface-mcp",
  label: "Web 页面探测",
  mcpToolName: "probe_web_surface",

  supportsCheck: ({ run }, target) =>
    run.toolName === "web-surface-map" && isHttpTarget(target),

  buildArguments: (target, localLab) => ({
    targetUrl: target,
    dockerContainerName: localLab?.dockerContainerName,
    internalTargetUrl: localLab?.internalTargetUrl,
  }),

  buildSuccess: (structured, _target, localLab) => {
    const webEntries = structured.webEntries ?? []

    return {
      outputs: { webEntries: webEntries.map((e) => e.url) },
      rawOutput: webEntries.flatMap((e) => [`url: ${e.url}`, `title: ${e.title}`, ...e.headers]),
      structuredContent: { webEntries },
      summaryLines: webEntries.length > 0
        ? [
            `真实 MCP 已完成 ${webEntries.length} 个 Web 页面入口探测。`,
            [`状态 ${webEntries[0].statusCode}`, webEntries[0].title || "无标题", webEntries[0].url].filter(Boolean).join(" / "),
            localLab?.dockerContainerName ? "已为本地靶场注入 docker fallback 参数。" : "当前目标走宿主机直连探测。",
          ]
        : ["真实 MCP 已执行，但未返回可用的页面入口结果。"],
    }
  },
})
