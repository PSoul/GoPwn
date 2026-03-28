import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

import { extractLinkedHttpStructure, probeHttpTarget } from "./http-runtime.mjs"

const server = new McpServer({
  name: "http-structure-stdio",
  version: "0.1.0",
})

server.registerTool(
  "discover_http_structure",
  {
    title: "Discover HTTP Structure",
    description: "Probe an HTTP target and infer likely API, Swagger, GraphQL, or actuator structure hints.",
    inputSchema: {
      targetUrl: z.string().url(),
      timeoutMs: z.number().int().min(1000).max(30000).optional(),
      dockerContainerName: z.string().trim().min(1).optional(),
      internalTargetUrl: z.string().url().optional(),
    },
  },
  async ({ targetUrl, timeoutMs = 8000, dockerContainerName, internalTargetUrl }) => {
    const probe = await probeHttpTarget({
      targetUrl,
      timeoutMs,
      dockerContainerName,
      internalTargetUrl,
    })
    const structureEntries = extractLinkedHttpStructure({
      html: probe.html,
      targetUrl,
      finalUrl: probe.webEntry.finalUrl,
      headers: probe.webEntry.headers,
    })

    return {
      content: [
        {
          type: "text",
          text:
            structureEntries.length > 0
              ? `结构发现完成: ${structureEntries.length} 个候选入口`
              : "结构发现完成: 暂未识别到明确的 API / 文档入口",
        },
      ],
      structuredContent: {
        targetUrl,
        transport: probe.transport,
        webEntries: [probe.webEntry],
        structureEntries,
      },
    }
  },
)

const transport = new StdioServerTransport()

await server.connect(transport)

