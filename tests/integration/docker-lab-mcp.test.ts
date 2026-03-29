/**
 * Docker 靶场 MCP 集成测试
 *
 * 通过 callMcpServerTool() 直接调用纯 JS MCP Server，
 * 对 Docker 靶场进行真实网络请求验证。
 *
 * 需要 Docker 靶场运行 + 环境变量 ENABLE_DOCKER_LAB_TESTS=1
 */
import { describe, it, expect, beforeAll } from "vitest"
import { callMcpServerTool } from "@/lib/mcp-client-service"
import { getDiscoveredMcpServerConfig, getServerKeyByToolName } from "@/lib/mcp-auto-discovery"
import type { McpServerRecord } from "@/lib/prototype-types"

const ENABLED = process.env.ENABLE_DOCKER_LAB_TESTS === "1"
const describeIf = ENABLED ? describe : describe.skip

function resolveServer(toolName: string): McpServerRecord | null {
  const serverKey = getServerKeyByToolName(toolName)

  if (!serverKey) {
    return null
  }

  const config = getDiscoveredMcpServerConfig(serverKey)

  if (!config) {
    return null
  }

  return {
    id: `test-${serverKey}`,
    serverName: `${serverKey}-mcp-server`,
    transport: "stdio",
    command: config.command,
    args: config.args,
    endpoint: "",
    enabled: true,
    status: "已连接",
    toolBindings: [],
    notes: `integration test: ${serverKey}`,
    lastSeen: new Date().toISOString(),
  }
}

async function callTool(toolName: string, args: Record<string, unknown>) {
  const server = resolveServer(toolName)

  if (!server) {
    throw new Error(`MCP server not found for tool: ${toolName}`)
  }

  const config = getDiscoveredMcpServerConfig(getServerKeyByToolName(toolName)!)

  return callMcpServerTool({
    server,
    toolName,
    arguments: args,
    target: String(args.url ?? args.host ?? args.target ?? ""),
    timeoutMs: 30_000,
    cwd: config?.cwd,
    env: config?.env,
  })
}

function extractText(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text!)
    .join("\n")
}

describeIf("Docker Lab MCP Integration", () => {
  beforeAll(() => {
    // Ensure MCP servers are discoverable
    expect(resolveServer("http_request")).not.toBeNull()
  })

  // ── HTTP 靶场 (curl-mcp-server) ───────────────────────────

  describe("curl-mcp-server → HTTP targets", () => {
    it("DVWA returns HTML", async () => {
      const result = await callTool("http_request", {
        url: "http://127.0.0.1:8081",
        method: "GET",
      })
      const text = extractText(result.content)
      expect(text).toBeTruthy()
      // DVWA typically returns login page or setup page
      expect(text.toLowerCase()).toMatch(/dvwa|login|damn vulnerable/i)
    }, 30_000)

    it("WordPress returns page", async () => {
      const result = await callTool("http_request", {
        url: "http://127.0.0.1:8082",
        method: "GET",
      })
      const text = extractText(result.content)
      expect(text).toBeTruthy()
      expect(text.toLowerCase()).toMatch(/wordpress|wp-/i)
    }, 30_000)

    it("Tomcat Manager returns auth challenge", async () => {
      const result = await callTool("http_request", {
        url: "http://127.0.0.1:8888/manager/html",
        method: "GET",
      })
      const text = extractText(result.content)
      expect(text).toBeTruthy()
      // Tomcat returns 401 or manager page
      expect(text.toLowerCase()).toMatch(/tomcat|401|unauthorized|manager/i)
    }, 30_000)

    it("Elasticsearch returns cluster info JSON", async () => {
      const result = await callTool("http_request", {
        url: "http://127.0.0.1:9200",
        method: "GET",
      })
      const text = extractText(result.content)
      expect(text).toBeTruthy()

      // Elasticsearch returns JSON with cluster_name
      try {
        const json = JSON.parse(text)
        expect(json).toHaveProperty("cluster_name")
        expect(json).toHaveProperty("version")
      } catch {
        // If not parseable JSON, at least contains elasticsearch markers
        expect(text.toLowerCase()).toMatch(/elasticsearch|cluster_name/)
      }
    }, 30_000)

    it("phpMyAdmin returns login page", async () => {
      const result = await callTool("http_request", {
        url: "http://127.0.0.1:8083",
        method: "GET",
      })
      const text = extractText(result.content)
      expect(text).toBeTruthy()
      expect(text.toLowerCase()).toMatch(/phpmyadmin|pma|mysql/i)
    }, 30_000)
  })

  // ── TCP 靶场 (netcat-mcp-server) ──────────────────────────

  describe("netcat-mcp-server → TCP targets", () => {
    it("MySQL banner on port 13307", async () => {
      const result = await callTool("tcp_banner_grab", {
        host: "127.0.0.1",
        port: 13307,
      })
      const text = extractText(result.content)
      expect(text).toBeTruthy()
      // MySQL protocol greeting contains version string
      expect(text.toLowerCase()).toMatch(/mysql|mariadb|5\.\d|8\.\d|protocol/i)
    }, 30_000)

    it("Redis responds to PING on port 6379", async () => {
      const result = await callTool("tcp_connect", {
        host: "127.0.0.1",
        port: 6379,
        data: "PING\r\n",
      })
      const text = extractText(result.content)
      expect(text).toBeTruthy()
      expect(text).toMatch(/PONG|redis|\+/i)
    }, 30_000)

    it("SSH banner on port 2222", async () => {
      const result = await callTool("tcp_banner_grab", {
        host: "127.0.0.1",
        port: 2222,
      })
      const text = extractText(result.content)
      expect(text).toBeTruthy()
      expect(text).toMatch(/SSH-2\.0|OpenSSH/i)
    }, 30_000)

    it("MongoDB connection on port 27017", async () => {
      const result = await callTool("tcp_banner_grab", {
        host: "127.0.0.1",
        port: 27017,
      })
      const text = extractText(result.content)
      // MongoDB may not return a readable banner, but connection should succeed
      expect(text).toBeTruthy()
    }, 30_000)
  })

  // ── 编码工具 (encode-mcp-server) ──────────────────────────

  describe("encode-mcp-server → standalone tools", () => {
    it("base64 encode returns valid result", async () => {
      const result = await callTool("encode_decode", {
        input: "hello-docker-lab-test",
        operation: "encode",
        algorithm: "base64",
      })
      const text = extractText(result.content)
      expect(text).toBeTruthy()

      // The encode tool returns JSON with a "result" field containing the base64 string
      try {
        const json = JSON.parse(text)
        expect(json).toHaveProperty("result")
        expect(json.algorithm).toBe("base64")
        // Verify the base64 is valid by checking it decodes correctly
        const decoded = Buffer.from(json.result, "base64").toString("utf-8")
        expect(decoded).toBe("hello-docker-lab-test")
      } catch {
        // If not JSON, the raw text should contain the base64 encoded value
        expect(text).toContain("aGVsbG8tZG9ja2VyLWxhYi10ZXN0")
      }
    }, 30_000)

    it("MD5 hash computation", async () => {
      const result = await callTool("hash_compute", {
        input: "test",
        algorithm: "md5",
      })
      const text = extractText(result.content)
      expect(text).toBeTruthy()
      // MD5 of "test" is 098f6bcd4621d373cade4e832627b4f6
      expect(text.toLowerCase()).toContain("098f6bcd4621d373cade4e832627b4f6")
    }, 30_000)
  })

  // ── 全链路验证 ────────────────────────────────────────────

  describe("full pipeline: lab catalog → orchestrator", () => {
    it("local lab catalog lists all configured labs", async () => {
      const { listLocalLabs } = await import("@/lib/local-lab-catalog")
      const labs = await listLocalLabs()
      expect(labs.length).toBeGreaterThanOrEqual(11)

      const ids = labs.map((lab) => lab.id)
      expect(ids).toContain("dvwa")
      expect(ids).toContain("redis-noauth")
      expect(ids).toContain("ssh-weak")
      expect(ids).toContain("tomcat-weak")
      expect(ids).toContain("elasticsearch-noauth")
      expect(ids).toContain("mongodb-noauth")
    })

    it("local lab catalog probes and finds online labs", async () => {
      const { listLocalLabs } = await import("@/lib/local-lab-catalog")
      const labs = await listLocalLabs({ probe: true })
      const onlineLabs = labs.filter((lab) => lab.status === "online")
      // At least some labs should be online if Docker is running
      expect(onlineLabs.length).toBeGreaterThan(0)
    }, 60_000)
  })
})
