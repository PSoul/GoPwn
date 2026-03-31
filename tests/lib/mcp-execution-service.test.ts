// @vitest-environment node
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"

import { afterEach, describe, expect, it } from "vitest"

import { listStoredAssets } from "@/lib/asset-repository"
import { listStoredEvidence } from "@/lib/evidence-repository"
import { executeStoredMcpRun } from "@/lib/mcp-execution-service"
import { dispatchStoredMcpRun, getStoredMcpRunById } from "@/lib/mcp-gateway-repository"
import { registerStoredMcpServer } from "@/lib/mcp-server-repository"
import { getStoredSchedulerTaskByRunId, updateStoredSchedulerTask } from "@/lib/mcp-scheduler-repository"
import { listStoredProjectFindings } from "@/lib/project-results-repository"
import { createStoredProjectFixture, seedWorkflowReadyMcpTools } from "@/tests/helpers/project-fixtures"

describe("MCP execution service cancellation guard", () => {
  let fixtureServer: ReturnType<typeof createServer> | null = null
  let fixtureUrl = ""

  afterEach(async () => {
    if (fixtureServer) {
      await new Promise<void>((resolve, reject) => {
        fixtureServer!.close((error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      })
      fixtureServer = null
    }
  })

  it("does not commit normalized execution results when the scheduler task is already cancelled", async () => {
    await seedWorkflowReadyMcpTools()
    const fixture = await createStoredProjectFixture()
    const payload = await dispatchStoredMcpRun(fixture.project.id, {
      capability: "DNS / 子域 / 证书情报类",
      requestedAction: "采集证书与子域情报",
      target: fixture.project.seed!,
      riskLevel: "低",
    })

    const task = await getStoredSchedulerTaskByRunId(payload!.run.id)
    await updateStoredSchedulerTask(task!.id, {
      status: "cancelled",
      summaryLines: [...task!.summaryLines, "研究员请求停止当前运行中的任务。"],
    })

    const result = await executeStoredMcpRun(payload!.run.id)

    expect(result?.status).toBe("aborted")
    expect((await getStoredMcpRunById(payload!.run.id))?.status).toBe("已取消")
    expect(await listStoredAssets(fixture.project.id)).toHaveLength(0)
  })

  it("does not commit normalized execution results when the lease ownership has moved to a newer worker", async () => {
    await seedWorkflowReadyMcpTools()
    const fixture = await createStoredProjectFixture()
    const payload = await dispatchStoredMcpRun(fixture.project.id, {
      capability: "DNS / 子域 / 证书情报类",
      requestedAction: "采集证书与子域情报",
      target: fixture.project.seed!,
      riskLevel: "低",
    })

    const task = await getStoredSchedulerTaskByRunId(payload!.run.id)
    await updateStoredSchedulerTask(task!.id, {
      heartbeatAt: "2026-03-27 16:20",
      leaseExpiresAt: "2026-03-27 16:21",
      leaseStartedAt: "2026-03-27 16:20",
      leaseToken: "lease-new",
      status: "running",
      summaryLines: [...task!.summaryLines, "任务已由新的 durable worker 重新认领。"],
      workerId: "worker-new",
    })

    const result = await executeStoredMcpRun(payload!.run.id, {}, {
      leaseToken: "lease-old",
      workerId: "worker-old",
    })

    expect(result?.status).toBe("ownership_lost")
    expect((await getStoredMcpRunById(payload!.run.id))?.status).toBe("执行中")
    expect(await listStoredAssets(fixture.project.id)).toHaveLength(0)
  })

  it("falls back to built-in target normalization when a fresh workspace has not registered any tools yet", async () => {
    const fixture = await createStoredProjectFixture({
      seed: "http://127.0.0.1:18080/WebGoat",
      targetType: "url",
    })
    const payload = await dispatchStoredMcpRun(fixture.project.id, {
      capability: "目标解析类",
      requestedAction: "标准化 WebGoat 种子目标",
      target: fixture.project.seed!,
      riskLevel: "低",
    })

    expect(payload?.run.toolName).toBe("seed-normalizer")
    expect(payload?.run.status).toBe("执行中")

    const result = await executeStoredMcpRun(payload!.run.id)

    expect(result?.status).toBe("succeeded")
    expect((await getStoredMcpRunById(payload!.run.id))?.status).toBe("已执行")
    expect((await getStoredMcpRunById(payload!.run.id))?.toolName).toBe("seed-normalizer")
  })

  it("falls back to the built-in report exporter when no explicit report tool has been registered", async () => {
    const fixture = await createStoredProjectFixture({
      seed: "http://127.0.0.1:18080/WebGoat",
      targetType: "url",
    })
    const payload = await dispatchStoredMcpRun(fixture.project.id, {
      capability: "报告导出类",
      requestedAction: "导出项目报告",
      target: fixture.project.code,
      riskLevel: "低",
    })

    expect(payload?.run.toolName).toBe("report-exporter")
    expect(payload?.run.status).toBe("执行中")

    const result = await executeStoredMcpRun(payload!.run.id)

    expect(result?.status).toBe("succeeded")
    expect((await getStoredMcpRunById(payload!.run.id))?.status).toBe("已执行")
    expect((await getStoredMcpRunById(payload!.run.id))?.toolName).toBe("report-exporter")
  })

  it.skipIf(process.env.SKIP_MCP_INTEGRATION === "1")("normalizes findings and evidence for a generic controlled-validation tool binding that reuses the shared HTTP validation MCP shape", async () => {
    fixtureServer = createServer((_request, response) => {
      response.writeHead(200, {
        "content-type": "application/vnd.spring-boot.actuator.v3+json",
        server: "fixture-spring",
      })
      response.end(
        JSON.stringify({
          _links: {
            self: { href: "http://127.0.0.1/actuator" },
            health: { href: "http://127.0.0.1/actuator/health" },
            env: { href: "http://127.0.0.1/actuator/env" },
          },
        }),
      )
    })

    await new Promise<void>((resolve) => {
      fixtureServer!.listen(0, "127.0.0.1", () => resolve())
    })

    const { port } = fixtureServer.address() as AddressInfo
    fixtureUrl = `http://127.0.0.1:${port}/actuator`

    await registerStoredMcpServer({
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
          toolName: "http-request-workbench",
          title: "HTTP 请求工作台",
          description: "执行需要审批的通用 HTTP 受控验证。",
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
          },
          defaultConcurrency: "1",
          rateLimit: "2 req/min",
          timeout: "20s",
          retry: "1 次",
          owner: "测试夹具",
        },
      ],
    })

    const fixture = await createStoredProjectFixture({
      seed: fixtureUrl,
      targetType: "url",
    })
    const payload = await dispatchStoredMcpRun(fixture.project.id, {
      capability: "受控验证类",
      requestedAction: "验证 actuator 工作台示例",
      target: fixtureUrl,
      riskLevel: "高",
    })

    expect(payload?.run.toolName).toBe("http-request-workbench")

    const result = await executeStoredMcpRun(payload!.run.id)

    expect(result?.status).toBe("succeeded")
    expect((await getStoredMcpRunById(payload!.run.id))?.status).toBe("已执行")
    const findings = await listStoredProjectFindings(fixture.project.id)
    expect(findings.some((item) => item.projectId === fixture.project.id)).toBe(true)
    const evidence = await listStoredEvidence(fixture.project.id)
    expect(evidence.some((item) => item.projectId === fixture.project.id)).toBe(true)
  })
})
