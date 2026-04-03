import { createRealMcpConnector, isHttpTarget } from "@/lib/mcp-connectors/real-mcp-connector-base"

type StructureEntry = {
  kind: string
  label: string
  url: string
  confidence: string
  source: string
}

type WebEntry = {
  url: string
  finalUrl?: string
  title: string
  statusCode: number
  headers: string[]
  fingerprint?: string
}

type HttpStructureStructuredContent = {
  structureEntries?: StructureEntry[]
  webEntries?: WebEntry[]
  transport?: "host" | "docker"
}

function summarizeStructureEntry(entry: StructureEntry) {
  return `${entry.label} -> ${entry.url} (${entry.source} / ${entry.confidence})`
}

export const realHttpStructureMcpConnector = createRealMcpConnector<HttpStructureStructuredContent>({
  connectorKey: "real-http-structure-mcp",
  label: "HTTP / API 结构发现",
  mcpToolName: "discover_http_structure",

  supportsCheck: ({ run }, target) =>
    run.toolName === "graphql-surface-check" && isHttpTarget(target),

  buildArguments: (target, localLab) => ({
    targetUrl: target,
    dockerContainerName: localLab?.dockerContainerName,
    internalTargetUrl: localLab?.internalTargetUrl,
  }),

  buildSuccess: (structured) => {
    const structureEntries = structured.structureEntries ?? []
    const webEntries = structured.webEntries ?? []
    const transport = structured.transport ?? "host"
    const discoveredEntryUrls = Array.from(
      new Set([...webEntries.map((e) => e.url), ...structureEntries.map((e) => e.url)]),
    )

    return {
      outputs: { webEntries: discoveredEntryUrls },
      rawOutput: [
        ...webEntries.flatMap((e) => [`${e.url} -> ${e.statusCode}`, ...e.headers]),
        ...structureEntries.map(summarizeStructureEntry),
      ],
      structuredContent: { structureEntries, transport, webEntries },
      summaryLines: [
        structureEntries.length > 0
          ? `真实 MCP 已识别 ${structureEntries.length} 个 HTTP / API 结构候选入口。`
          : "真实 MCP 已执行 HTTP / API 结构发现，但未识别到明确入口。",
        structureEntries[0] ? summarizeStructureEntry(structureEntries[0]) : "当前结果暂未给出更具体的结构候选入口。",
        transport === "docker" ? "当前结果通过容器内 fallback 获取。" : "当前结果通过宿主机直连获取。",
      ],
    }
  },
})
