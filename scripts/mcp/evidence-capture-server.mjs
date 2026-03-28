import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

import { capturePageEvidence } from "./evidence-capture-runtime.mjs"

const server = new McpServer({
  name: "evidence-capture-stdio",
  version: "0.1.0",
})

server.registerTool(
  "capture_page_evidence",
  {
    title: "Capture Page Evidence",
    description: "Capture a full-page screenshot and HTML snapshot for a target URL using Playwright.",
    inputSchema: {
      targetUrl: z.string().url(),
      screenshotPath: z.string().trim().min(1),
      htmlPath: z.string().trim().min(1),
      timeoutMs: z.number().int().min(1000).max(60000).optional(),
      fullPage: z.boolean().optional(),
    },
  },
  async ({ targetUrl, screenshotPath, htmlPath, timeoutMs = 15_000, fullPage = true }) => {
    const result = await capturePageEvidence({
      targetUrl,
      screenshotPath,
      htmlPath,
      timeoutMs,
      fullPage,
    })

    return {
      content: [
        {
          type: "text",
          text: `页面证据采集完成: ${result.pageTitle} (${result.statusCode || "n/a"})`,
        },
      ],
      structuredContent: {
        targetUrl,
        ...result,
      },
    }
  },
)

const transport = new StdioServerTransport()

await server.connect(transport)
