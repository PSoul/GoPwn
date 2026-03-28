import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

import { probeHttpTarget } from "./http-runtime.mjs"

const server = new McpServer({
  name: "web-surface-stdio",
  version: "0.1.0",
})

server.registerTool(
  "probe_web_surface",
  {
    title: "Probe Web Surface",
    description: "Fetch a URL and return page title, status code, final URL, and selected response headers.",
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

    return {
      content: [
        {
          type: "text",
          text: `页面入口探测完成: ${probe.webEntry.title} (${probe.webEntry.statusCode})`,
        },
      ],
      structuredContent: {
        targetUrl,
        finalUrl: probe.webEntry.finalUrl,
        statusCode: probe.webEntry.statusCode,
        title: probe.webEntry.title,
        headers: probe.webEntry.headers,
        transport: probe.transport,
        webEntries: [probe.webEntry],
      },
    }
  },
)

const transport = new StdioServerTransport()

await server.connect(transport)
