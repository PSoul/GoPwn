import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

import { runHttpValidation } from "./http-validation-runtime.mjs"

const server = new McpServer({
  name: "http-validation-stdio",
  version: "0.1.0",
})

server.registerTool(
  "run_http_validation",
  {
    title: "Run HTTP Validation",
    description: "Execute an auditable HTTP validation request and return structured request/response evidence.",
    inputSchema: {
      targetUrl: z.string().url(),
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]).optional(),
      headers: z.record(z.string()).optional(),
      body: z.string().optional(),
      validationProfile: z.string().trim().min(1).optional(),
      timeoutMs: z.number().int().min(1000).max(30000).optional(),
      dockerContainerName: z.string().trim().min(1).optional(),
      internalTargetUrl: z.string().url().optional(),
    },
  },
  async ({
    targetUrl,
    method = "GET",
    headers = {},
    body = "",
    validationProfile = "generic-http-validation",
    timeoutMs = 10_000,
    dockerContainerName,
    internalTargetUrl,
  }) => {
    const result = await runHttpValidation({
      targetUrl,
      method,
      headers,
      body,
      validationProfile,
      timeoutMs,
      dockerContainerName,
      internalTargetUrl,
    })
    const findingTitle = result.finding?.title
    const leadSignal = result.matchedSignals[0] ?? "未命中明确验证信号"

    return {
      content: [
        {
          type: "text",
          text: findingTitle ? `HTTP 验证完成: ${findingTitle}` : `HTTP 验证完成: ${leadSignal}`,
        },
      ],
      structuredContent: {
        targetUrl,
        transport: result.transport,
        requestSummary: result.requestSummary,
        responseSummary: result.responseSummary,
        responseSignals: result.matchedSignals,
        finding: result.finding,
        verdict: result.verdict,
      },
    }
  },
)

const transport = new StdioServerTransport()

await server.connect(transport)
