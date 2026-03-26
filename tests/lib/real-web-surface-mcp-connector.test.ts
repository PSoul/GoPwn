import { createServer } from "node:http"
import type { AddressInfo } from "node:net"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { realWebSurfaceMcpConnector } from "@/lib/mcp-connectors/real-web-surface-mcp-connector"
import type { McpConnectorExecutionContext } from "@/lib/mcp-connectors/types"

describe("real web-surface MCP connector", () => {
  let server: ReturnType<typeof createServer>
  let targetUrl: string

  beforeEach(async () => {
    server = createServer((_request, response) => {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        server: "fixture-nginx",
        "x-powered-by": "fixture-next",
      })
      response.end("<html><head><title>Fixture Portal</title></head><body>Hello</body></html>")
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
  })

  it("executes the web-surface capability through a real MCP stdio server", async () => {
    const context: McpConnectorExecutionContext = {
      approval: null,
      priorOutputs: {},
      project: {
        id: "proj-huayao",
        code: "PRJ-20260326-001",
        name: "华曜科技匿名外网面梳理",
        seed: targetUrl,
        targetType: "url",
        targetSummary: targetUrl,
        owner: "研究员席位 A",
        priority: "高",
        stage: "发现与指纹识别",
        status: "运行中",
        pendingApprovals: 0,
        openTasks: 1,
        assetCount: 0,
        evidenceCount: 0,
        createdAt: "2026-03-26 12:00",
        lastUpdated: "2026-03-26 12:00",
        lastActor: "测试",
        riskSummary: "测试",
        summary: "测试",
        authorizationSummary: "测试",
        scopeSummary: "测试",
        forbiddenActions: "测试",
        defaultConcurrency: "1",
        rateLimit: "10 req/min",
        timeout: "30s",
        approvalMode: "高风险审批，低风险自动通过",
        tags: ["测试"],
      },
      run: {
        id: "run-web-surface-real",
        projectId: "proj-huayao",
        projectName: "华曜科技匿名外网面梳理",
        capability: "Web 页面探测类",
        toolId: "mcp-07",
        toolName: "web-surface-map",
        requestedAction: "识别页面入口与响应特征",
        target: targetUrl,
        riskLevel: "低",
        boundary: "外部目标交互",
        dispatchMode: "自动执行",
        status: "执行中",
        requestedBy: "测试",
        createdAt: "2026-03-26 12:01",
        updatedAt: "2026-03-26 12:01",
        connectorMode: "real",
        summaryLines: [],
      },
      tool: null,
    }

    expect(realWebSurfaceMcpConnector.supports(context)).toBe(true)

    const result = await realWebSurfaceMcpConnector.execute(context)

    expect(result.status).toBe("succeeded")
    expect(result.mode).toBe("real")

    if (result.status !== "succeeded") {
      throw new Error("Expected a successful MCP connector result.")
    }

    const webEntries = result.structuredContent.webEntries as Array<{
      title: string
      url: string
      statusCode: number
      headers: string[]
    }>

    expect(webEntries[0].title).toBe("Fixture Portal")
    expect(webEntries[0].url).toBe(targetUrl)
    expect(webEntries[0].statusCode).toBe(200)
    expect(webEntries[0].headers.some((header) => header.includes("fixture-nginx"))).toBe(true)
  })
})
