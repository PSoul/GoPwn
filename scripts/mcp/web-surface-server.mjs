import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

const server = new McpServer({
  name: "web-surface-stdio",
  version: "0.1.0",
})

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)

  return match?.[1]?.trim() || "Untitled"
}

function buildSelectedHeaders(response) {
  const allowedHeaders = new Set(["content-type", "location", "server", "set-cookie", "x-frame-options", "x-powered-by"])

  return Array.from(response.headers.entries())
    .filter(([key]) => allowedHeaders.has(key.toLowerCase()) || key.toLowerCase().startsWith("x-"))
    .map(([key, value]) => `${key}: ${value}`)
}

function buildFingerprint(headers, title) {
  const serverHeader = headers.find((header) => header.toLowerCase().startsWith("server:"))
  const poweredByHeader = headers.find((header) => header.toLowerCase().startsWith("x-powered-by:"))

  return [serverHeader, poweredByHeader, title].filter(Boolean).join(" / ")
}

server.registerTool(
  "probe_web_surface",
  {
    title: "Probe Web Surface",
    description: "Fetch a URL and return page title, status code, final URL, and selected response headers.",
    inputSchema: {
      targetUrl: z.string().url(),
      timeoutMs: z.number().int().min(1000).max(30000).optional(),
    },
  },
  async ({ targetUrl, timeoutMs = 8000 }) => {
    const response = await fetch(targetUrl, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    })
    const html = await response.text()
    const headers = buildSelectedHeaders(response)
    const title = extractTitle(html)
    const webEntry = {
      url: targetUrl,
      finalUrl: response.url,
      title,
      statusCode: response.status,
      headers,
      fingerprint: buildFingerprint(headers, title),
    }

    return {
      content: [
        {
          type: "text",
          text: `页面入口探测完成: ${webEntry.title} (${webEntry.statusCode})`,
        },
      ],
      structuredContent: {
        targetUrl,
        finalUrl: response.url,
        statusCode: response.status,
        title,
        headers,
        webEntries: [webEntry],
      },
    }
  },
)

const transport = new StdioServerTransport()

await server.connect(transport)
