// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { realEvidenceCaptureMcpConnector } from "@/lib/mcp-connectors/real-evidence-capture-mcp-connector"
import type { McpConnectorExecutionContext } from "@/lib/mcp-connectors/types"
import { registerStoredMcpServer } from "@/lib/mcp-server-repository"

describe.skipIf(process.env.SKIP_MCP_INTEGRATION === "1")("real evidence-capture MCP connector", () => {
  let server: ReturnType<typeof createServer>
  let tempDir: string
  let targetUrl: string

  beforeEach(async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-real-evidence-mcp-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir

    server = createServer((_request, response) => {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
      })
      response.end(`
        <html>
          <head><title>Fixture Evidence Portal</title></head>
          <body><main><h1>Evidence Fixture</h1><p>capture me</p></main></body>
        </html>
      `)
    })

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve())
    })

    const { port } = server.address() as AddressInfo
    targetUrl = `http://127.0.0.1:${port}/login`
  })

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })

    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("captures screenshot and HTML artifacts through a real MCP stdio server", async () => {
    await registerStoredMcpServer({
      serverName: "evidence-capture-stdio",
      version: "1.0.0",
      transport: "stdio",
      command: "node",
      args: ["scripts/mcp/evidence-capture-server.mjs"],
      endpoint: "stdio://evidence-capture-stdio",
      enabled: true,
      notes: "真实截图与证据采集 MCP server",
      tools: [
        {
          toolName: "capture-evidence",
          title: "截图与证据采集",
          description: "采集整页截图和 HTML 快照。",
          version: "1.0.0",
          capability: "截图与证据采集类",
          boundary: "外部目标交互",
          riskLevel: "低",
          requiresApproval: false,
          resultMappings: ["evidence", "workLogs"],
          inputSchema: {
            type: "object",
            properties: {
              targetUrl: {
                type: "string",
              },
              screenshotPath: {
                type: "string",
              },
              htmlPath: {
                type: "string",
              },
            },
            required: ["targetUrl", "screenshotPath", "htmlPath"],
            additionalProperties: false,
          },
          outputSchema: {
            type: "object",
          },
          defaultConcurrency: "1",
          rateLimit: "6 req/min",
          timeout: "20s",
          retry: "1 次",
          owner: "测试夹具",
        },
      ],
    })

    const context: McpConnectorExecutionContext = {
      approval: null,
      priorOutputs: {},
      project: {
        id: "proj-evidence",
        code: "PRJ-20260328-001",
        name: "Evidence Connector Fixture",
        targetInput: targetUrl,
        targets: [targetUrl],
        description: "测试真实证据采集链路。",
        stage: "证据归档与结果判定",
        status: "运行中",
        pendingApprovals: 0,
        openTasks: 1,
        assetCount: 0,
        evidenceCount: 0,
        createdAt: "2026-03-28 10:00",
        lastUpdated: "2026-03-28 10:00",
        lastActor: "测试",
        riskSummary: "测试",
        summary: "测试",
      },
      run: {
        id: "run-evidence-capture-real",
        projectId: "proj-evidence",
        projectName: "Evidence Connector Fixture",
        capability: "截图与证据采集类",
        toolId: "tool-capture-evidence",
        toolName: "capture-evidence",
        requestedAction: "采集关键页面截图与 HTML 证据",
        target: targetUrl,
        riskLevel: "低",
        boundary: "外部目标交互",
        dispatchMode: "自动执行",
        status: "执行中",
        requestedBy: "测试",
        createdAt: "2026-03-28 10:00",
        updatedAt: "2026-03-28 10:00",
        connectorMode: "real",
        summaryLines: [],
      },
      tool: null,
    }

    const result = await realEvidenceCaptureMcpConnector.execute(context)

    expect(result.status).toBe("succeeded")

    if (result.status !== "succeeded") {
      throw new Error("Expected a successful evidence capture result.")
    }

    expect(result.structuredContent.pageTitle).toBe("Fixture Evidence Portal")
    expect(result.structuredContent.capturedUrl).toBe(targetUrl)

    const screenshotRelativePath = result.structuredContent.screenshotArtifactPath as string
    const htmlRelativePath = result.structuredContent.htmlArtifactPath as string
    const screenshotAbsolutePath = path.join(tempDir, "artifacts", ...screenshotRelativePath.split("/"))
    const htmlAbsolutePath = path.join(tempDir, "artifacts", ...htmlRelativePath.split("/"))

    expect(existsSync(screenshotAbsolutePath)).toBe(true)
    expect(existsSync(htmlAbsolutePath)).toBe(true)
    expect(readFileSync(htmlAbsolutePath, "utf8")).toContain("Evidence Fixture")
  }, 30_000)
})
