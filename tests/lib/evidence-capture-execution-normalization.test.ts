// @vitest-environment node
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { listStoredAssets } from "@/lib/asset-repository"
import { getStoredEvidenceById, listStoredEvidence } from "@/lib/evidence-repository"
import { executeStoredMcpRun } from "@/lib/mcp-execution-service"
import { dispatchStoredMcpRun, getStoredMcpRunById } from "@/lib/mcp-gateway-repository"
import { registerStoredMcpServer } from "@/lib/mcp-server-repository"
import { buildRuntimeArtifactUrl } from "@/lib/runtime-artifacts"
import { createStoredProjectFixture } from "@/tests/helpers/project-fixtures"

describe.skipIf(process.env.SKIP_MCP_INTEGRATION === "1")("evidence capture execution normalization", () => {
  let tempDir: string
  let targetServer: ReturnType<typeof createServer>
  let targetUrl: string

  beforeEach(async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-evidence-normalization-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir

    targetServer = createServer((_request, response) => {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
      })
      response.end(`
        <html>
          <head><title>Fixture Normalization Portal</title></head>
          <body><h1>Normalization Fixture</h1><p>archive this page</p></body>
        </html>
      `)
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

  it("persists real screenshot and HTML artifacts into evidence detail payloads", async () => {
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
          description: "采集关键页面截图和 HTML 快照。",
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

    const fixture = await createStoredProjectFixture({
      targetInput: targetUrl,
      description: "测试截图与证据采集归档。",
    })
    const payload = await dispatchStoredMcpRun(fixture.project.id, {
      capability: "截图与证据采集类",
      requestedAction: "采集关键页面截图与 HTML 证据",
      target: targetUrl,
      riskLevel: "低",
    })

    expect(payload?.run.toolName).toBe("capture-evidence")

    const result = await executeStoredMcpRun(payload!.run.id)

    expect(result?.status).toBe("succeeded")
    expect((await getStoredMcpRunById(payload!.run.id))?.status).toBe("已执行")

    const evidence = await listStoredEvidence(fixture.project.id)
    const record = evidence[0]

    expect(record.source).toBe("截图与证据采集类")
    expect(record.screenshotArtifactPath).toBeTruthy()
    expect(record.htmlArtifactPath).toBeTruthy()
    expect(record.structuredSummary[0]).toContain("采证完成")

    const screenshotAbsolutePath = path.join(tempDir, "artifacts", ...(record.screenshotArtifactPath ?? "").split("/"))
    const htmlAbsolutePath = path.join(tempDir, "artifacts", ...(record.htmlArtifactPath ?? "").split("/"))

    expect(existsSync(screenshotAbsolutePath)).toBe(true)
    expect(existsSync(htmlAbsolutePath)).toBe(true)
    expect((await listStoredAssets(fixture.project.id)).some((asset) => asset.label === targetUrl)).toBe(true)

    const detailRecord = await getStoredEvidenceById(record.id)
    const detailPayload = detailRecord ? { record: detailRecord, artifacts: { screenshotUrl: buildRuntimeArtifactUrl(detailRecord.screenshotArtifactPath) ?? undefined, htmlUrl: buildRuntimeArtifactUrl(detailRecord.htmlArtifactPath) ?? undefined } } : null

    expect(detailPayload?.artifacts?.screenshotUrl).toContain("/api/artifacts/")
    expect(detailPayload?.artifacts?.htmlUrl).toContain("/api/artifacts/")
    expect((await getStoredEvidenceById(record.id))?.capturedUrl).toBe(targetUrl)
  }, 30_000)
})
