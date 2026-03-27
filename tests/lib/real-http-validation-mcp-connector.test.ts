import { mkdtempSync, rmSync } from "node:fs"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { realHttpValidationMcpConnector } from "@/lib/mcp-connectors/real-http-validation-mcp-connector"
import type { McpConnectorExecutionContext } from "@/lib/mcp-connectors/types"
import { registerStoredMcpServer } from "@/lib/mcp-server-repository"

describe("real http-validation MCP connector", () => {
  let server: ReturnType<typeof createServer>
  let tempDir: string
  let targetUrl: string
  let targetPort = 0

  beforeEach(async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-real-http-validation-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir

    server = createServer((request, response) => {
      if (request.url === "/WebGoat/actuator") {
        response.writeHead(200, {
          "content-type": "application/vnd.spring-boot.actuator.v3+json",
          server: "fixture-spring",
          "x-powered-by": "fixture-webgoat",
        })
        response.end(
          JSON.stringify({
            _links: {
              self: { href: targetUrl },
              health: { href: `${targetUrl}/health` },
              env: { href: `${targetUrl}/env` },
              configprops: { href: `${targetUrl}/configprops` },
            },
          }),
        )
        return
      }

      response.writeHead(404, {
        "content-type": "application/json",
      })
      response.end(JSON.stringify({ error: "not found" }))
    })

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve())
    })

    targetPort = (server.address() as AddressInfo).port
    targetUrl = `http://127.0.0.1:${targetPort}/WebGoat/actuator`
  })

  afterEach(async () => {
    delete process.env.WEBGOAT_HOST_PORT
    delete process.env.PROTOTYPE_DATA_DIR

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })

    rmSync(tempDir, { force: true, recursive: true })
  })

  function registerValidationServer() {
    registerStoredMcpServer({
      serverName: "http-validation-stdio",
      version: "1.0.0",
      transport: "stdio",
      command: "node",
      args: ["scripts/mcp/http-validation-server.mjs"],
      endpoint: "stdio://http-validation-stdio",
      enabled: true,
      notes: "真实 HTTP 受控验证 MCP server",
      tools: [
        {
          toolName: "auth-guard-check",
          title: "HTTP 受控验证",
          description: "执行需要审批的高风险 HTTP 受控验证。",
          version: "1.0.0",
          capability: "受控验证类",
          boundary: "外部目标交互",
          riskLevel: "高",
          requiresApproval: true,
          resultMappings: ["findings", "evidence", "workLogs"],
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
              responseSignals: {
                type: "array",
                items: {
                  type: "string",
                },
              },
            },
          },
          defaultConcurrency: "1",
          rateLimit: "2 req/min",
          timeout: "20s",
          retry: "1 次",
          owner: "测试夹具",
        },
      ],
    })
  }

  function buildContext(target: string): McpConnectorExecutionContext {
    return {
      approval: null,
      priorOutputs: {},
      project: {
        id: "proj-webgoat",
        code: "PRJ-20260327-003",
        name: "WebGoat Local Validation",
        seed: `http://127.0.0.1:${targetPort}/WebGoat`,
        targetType: "url",
        targetSummary: `http://127.0.0.1:${targetPort}/WebGoat`,
        owner: "研究员席位 A",
        priority: "高",
        stage: "受控 PoC 验证",
        status: "运行中",
        pendingApprovals: 0,
        openTasks: 1,
        assetCount: 0,
        evidenceCount: 0,
        createdAt: "2026-03-27 10:00",
        lastUpdated: "2026-03-27 10:00",
        lastActor: "测试",
        riskSummary: "测试",
        summary: "测试",
        authorizationSummary: "测试",
        scopeSummary: "测试",
        forbiddenActions: "测试",
        defaultConcurrency: "1",
        rateLimit: "5 req/min",
        timeout: "30s",
        approvalMode: "高风险审批，低风险自动通过",
        tags: ["测试"],
      },
      run: {
        id: "run-webgoat-auth-guard-real",
        projectId: "proj-webgoat",
        projectName: "WebGoat Local Validation",
        capability: "受控验证类",
        toolId: "tool-auth-guard-check",
        toolName: "auth-guard-check",
        requestedAction: "验证 WebGoat Actuator 匿名暴露",
        target,
        riskLevel: "高",
        boundary: "外部目标交互",
        dispatchMode: "审批后执行",
        status: "执行中",
        requestedBy: "测试",
        createdAt: "2026-03-27 10:01",
        updatedAt: "2026-03-27 10:01",
        connectorMode: "real",
        linkedApprovalId: "APR-test",
        summaryLines: [],
      },
      tool: null,
    }
  }

  it("executes an auditable GET validation request through a real MCP stdio server", async () => {
    registerValidationServer()
    const context = buildContext(targetUrl)

    expect(realHttpValidationMcpConnector.supports(context)).toBe(true)

    const result = await realHttpValidationMcpConnector.execute(context)

    expect(result.status).toBe("succeeded")
    expect(result.mode).toBe("real")

    if (result.status !== "succeeded") {
      throw new Error("Expected a successful real HTTP validation result.")
    }

    expect(result.outputs.validatedTargets).toEqual([targetUrl])
    expect(result.outputs.generatedFindings).toContain("Spring Actuator 管理端点匿名暴露")
    expect(result.summaryLines[0]).toContain("真实 MCP")

    const finding = result.structuredContent.finding as {
      title: string
      severity: string
    }
    const responseSignals = result.structuredContent.responseSignals as string[]
    const responseSummary = result.structuredContent.responseSummary as {
      statusCode: number
      headers: string[]
      bodyPreview: string
    }

    expect(finding.title).toContain("Actuator")
    expect(finding.severity).toBe("中危")
    expect(responseSummary.statusCode).toBe(200)
    expect(responseSummary.headers.some((header) => header.includes("fixture-spring"))).toBe(true)
    expect(responseSummary.bodyPreview).toContain("\"env\"")
    expect(responseSignals.some((signal) => signal.includes("env"))).toBe(true)
  })

  it("notes docker fallback injection for WebGoat-shaped local lab targets", async () => {
    registerValidationServer()
    process.env.WEBGOAT_HOST_PORT = String(targetPort)

    const result = await realHttpValidationMcpConnector.execute(buildContext(targetUrl))

    expect(result.status).toBe("succeeded")

    if (result.status !== "succeeded") {
      throw new Error("Expected a successful real HTTP validation result.")
    }

    expect(result.summaryLines.join(" ")).toContain("docker fallback")
  })
})
