// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { listStoredAssets } from "@/lib/asset-repository"
import { listStoredEvidence } from "@/lib/evidence-repository"
import { executeStoredMcpRun } from "@/lib/mcp-execution-service"
import { dispatchStoredMcpRun, getStoredMcpRunById } from "@/lib/mcp-gateway-repository"
import { registerStoredMcpServer } from "@/lib/mcp-server-repository"
import { getStoredProjectDetailById } from "@/lib/project-repository"
import { createStoredProjectFixture } from "@/tests/helpers/project-fixtures"

describe.skipIf(process.env.SKIP_MCP_INTEGRATION === "1")("HTTP structure execution normalization", () => {
  let tempDir: string
  let targetServer: ReturnType<typeof createServer>
  let targetUrl: string

  beforeEach(async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-http-structure-normalization-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir

    targetServer = createServer((request, response) => {
      if (request.url === "/portal") {
        response.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          server: "fixture-nginx",
          "x-powered-by": "fixture-api-gateway",
        })
        response.end(`
          <html>
            <head><title>Fixture API Portal</title></head>
            <body>
              <h1>Swagger UI</h1>
              <p>GraphQL explorer</p>
              <p>Actuator endpoints</p>
            </body>
          </html>
        `)
        return
      }

      response.writeHead(404, {
        "content-type": "text/plain; charset=utf-8",
      })
      response.end("not found")
    })

    await new Promise<void>((resolve) => {
      targetServer.listen(0, "127.0.0.1", () => resolve())
    })

    const { port } = targetServer.address() as AddressInfo
    targetUrl = `http://127.0.0.1:${port}/portal`
  })

  afterEach(async () => {
    delete process.env.PROTOTYPE_DATA_DIR

    await new Promise<void>((resolve, reject) => {
      targetServer.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })

    rmSync(tempDir, { force: true, recursive: true })
  })

  it("persists real HTTP/API structure candidates into assets, evidence, and project knowledge", async () => {
    await registerStoredMcpServer({
      serverName: "http-structure-stdio",
      version: "1.0.0",
      transport: "stdio",
      command: "node",
      args: ["scripts/mcp/http-structure-server.mjs"],
      endpoint: "stdio://http-structure-stdio",
      enabled: true,
      notes: "真实 HTTP / API 结构发现 MCP server",
      tools: [
        {
          toolName: "graphql-surface-check",
          title: "HTTP / API 结构发现",
          description: "识别 GraphQL、Swagger、OpenAPI 和 Actuator 等候选入口。",
          version: "1.0.0",
          capability: "HTTP / API 结构发现类",
          boundary: "外部目标交互",
          riskLevel: "低",
          requiresApproval: false,
          resultMappings: ["webEntries", "evidence", "workLogs"],
          inputSchema: {
            type: "object",
            properties: {
              targetUrl: {
                type: "string",
              },
            },
            required: ["targetUrl"],
            additionalProperties: false,
          },
          outputSchema: {
            type: "object",
            properties: {
              structureEntries: {
                type: "array",
                items: {
                  type: "object",
                },
              },
            },
          },
          defaultConcurrency: "1",
          rateLimit: "8 req/min",
          timeout: "15s",
          retry: "1 次",
          owner: "测试夹具",
        },
      ],
    })

    const fixture = await createStoredProjectFixture({
      seed: targetUrl,
      targetType: "url",
      targetSummary: targetUrl,
    })
    const payload = await dispatchStoredMcpRun(fixture.project.id, {
      capability: "HTTP / API 结构发现类",
      requestedAction: "识别 API / 文档候选入口",
      target: targetUrl,
      riskLevel: "低",
    })

    expect(payload?.run.toolName).toBe("graphql-surface-check")

    const result = await executeStoredMcpRun(payload!.run.id)

    expect(result?.status).toBe("succeeded")
    expect(result?.outputs?.webEntries).toContain(targetUrl)
    expect((await getStoredMcpRunById(payload!.run.id))?.status).toBe("已执行")

    const assets = await listStoredAssets(fixture.project.id)
    const evidence = await listStoredEvidence(fixture.project.id)
    const detail = await getStoredProjectDetailById(fixture.project.id)

    expect(assets.some((asset) => asset.label.endsWith("/graphql") && asset.type === "api")).toBe(true)
    expect(assets.some((asset) => asset.label.endsWith("/swagger-ui/index.html"))).toBe(true)
    expect(assets.some((asset) => asset.label.endsWith("/actuator"))).toBe(true)
    expect(
      evidence.some(
        (record) =>
          record.source === "HTTP / API 结构发现类" &&
          record.structuredSummary[0]?.includes("HTTP / API 结构候选入口"),
      ),
    ).toBe(true)
    expect(
      evidence.some((record) => record.rawOutput.some((line) => line.includes("Swagger UI") || line.includes("GraphQL"))),
    ).toBe(true)
    expect(
      detail?.discoveredInfo.some(
        (item) => item.title === "HTTP / API 结构线索识别" && item.detail.includes("候选入口"),
      ),
    ).toBe(true)
  })
})
