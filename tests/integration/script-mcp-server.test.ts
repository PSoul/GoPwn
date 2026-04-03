/**
 * Script MCP Server 集成测试
 *
 * 验证 LLM 自主脚本执行能力：
 *   - execute_code: Node.js 代码执行
 *   - execute_command: Shell 命令执行
 *   - read_file / write_file: 文件 I/O
 *
 * 需要 Docker 靶场运行 + ENABLE_DOCKER_LAB_TESTS=1
 */
import { describe, it, expect } from "vitest"
import { callMcpServerTool } from "@/lib/mcp/mcp-client-service"
import { getDiscoveredMcpServerConfig, getServerKeyByToolName } from "@/lib/mcp/mcp-auto-discovery"
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
    target: String(args.url ?? args.host ?? args.target ?? args.path ?? ""),
    timeoutMs: 60_000,
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

function parseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

describeIf("Script MCP Server — LLM Agent Capabilities", () => {
  // ── execute_code ──────────────────────────────────────────

  describe("execute_code → Node.js script execution", () => {
    it("executes basic Node.js code", async () => {
      const result = await callTool("execute_code", {
        code: 'console.log(JSON.stringify({ message: "hello from LLM script", pid: process.pid }))',
        description: "基础 Node.js 执行测试",
        timeout_seconds: 10,
      })
      const text = extractText(result.content)
      const json = parseJson(text)
      expect(json.exitCode).toBe(0)
      expect(json.stdout).toContain("hello from LLM script")
    }, 30_000)

    it("probes Redis via TCP (LLM-generated script)", async () => {
      const code = `
const net = require('net');
const client = net.connect({ host: '127.0.0.1', port: 6379, timeout: 5000 });
let buf = '';
let sentInfo = false;
client.on('connect', () => { client.write('PING\\r\\n'); });
client.on('data', (chunk) => {
  buf += chunk.toString();
  if (!sentInfo && buf.includes('+PONG')) {
    sentInfo = true;
    client.write('INFO server\\r\\n');
  }
});
client.on('error', (e) => { console.error(JSON.stringify({ error: e.message })); });
setTimeout(() => {
  const versionMatch = buf.match(/redis_version:([\\d.]+)/);
  console.log(JSON.stringify({
    service: 'redis',
    response: buf.includes('+PONG') ? '+PONG' : buf.slice(0, 100),
    version: versionMatch ? versionMatch[1] : 'unknown',
    unauthorized_access: true,
    severity: 'high',
    finding: 'Redis 未授权访问 - 无需认证即可执行命令'
  }));
  client.destroy();
  process.exit(0);
}, 2000);
`.trim()

      const result = await callTool("execute_code", {
        code,
        description: "Redis 未授权访问检测",
        timeout_seconds: 10,
      })
      const text = extractText(result.content)
      const json = parseJson(text)
      expect(json.exitCode).toBe(0)
      expect(json.stdout).toContain("redis")
    }, 30_000)

    it("probes SSH banner via TCP", async () => {
      const code = `
const net = require('net');
const client = net.connect({ host: '127.0.0.1', port: 2222, timeout: 5000 });
let banner = '';
client.on('data', (data) => {
  banner += data.toString();
  console.log(JSON.stringify({ banner: banner.trim(), service: 'ssh', port: 2222 }));
  client.destroy();
});
client.on('error', (e) => { console.error(JSON.stringify({ error: e.message })); });
setTimeout(() => client.destroy(), 5000);
`.trim()

      const result = await callTool("execute_code", {
        code,
        description: "SSH Banner 抓取",
        timeout_seconds: 10,
      })
      const text = extractText(result.content)
      const json = parseJson(text)
      expect(json.exitCode).toBe(0)
      expect(json.stdout).toMatch(/SSH/i)
    }, 30_000)

    it("probes MySQL via TCP handshake", async () => {
      const code = `
const net = require('net');
const client = net.connect({ host: '127.0.0.1', port: 13307, timeout: 5000 });
client.on('data', (data) => {
  const hex = data.toString('hex');
  const ascii = data.toString('ascii').replace(/[^\\x20-\\x7E]/g, '.');
  console.log(JSON.stringify({
    service: 'mysql',
    port: 13307,
    banner_hex: hex.slice(0, 200),
    banner_ascii: ascii.slice(0, 200),
    protocol_detected: hex.startsWith('') ? true : false,
  }));
  client.destroy();
});
client.on('error', (e) => console.error(JSON.stringify({ error: e.message })));
setTimeout(() => client.destroy(), 5000);
`.trim()

      const result = await callTool("execute_code", {
        code,
        description: "MySQL 协议握手探测",
        timeout_seconds: 10,
      })
      const text = extractText(result.content)
      const json = parseJson(text)
      expect(json.exitCode).toBe(0)
      expect(json.stdout).toContain("mysql")
    }, 30_000)

    it("sends HTTP request to Elasticsearch (unauthorized info leak)", async () => {
      const code = `
const http = require('http');
const req = http.request({ hostname: '127.0.0.1', port: 9200, path: '/', method: 'GET', timeout: 5000 }, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      const info = JSON.parse(body);
      console.log(JSON.stringify({
        service: 'elasticsearch',
        cluster_name: info.cluster_name,
        version: info.version?.number,
        unauthorized_access: true,
        severity: 'high',
        finding: 'Elasticsearch 集群信息泄露 - 无需认证即可获取集群详情'
      }));
    } catch(e) {
      console.log(JSON.stringify({ raw: body.slice(0, 500) }));
    }
  });
});
req.on('error', (e) => console.error(JSON.stringify({ error: e.message })));
req.end();
`.trim()

      const result = await callTool("execute_code", {
        code,
        description: "Elasticsearch 未授权信息泄露检测",
        timeout_seconds: 10,
      })
      const text = extractText(result.content)
      const json = parseJson(text)
      expect(json.exitCode).toBe(0)
      expect(json.stdout).toContain("elasticsearch")
    }, 30_000)
  })

  // ── execute_command ───────────────────────────────────────

  describe("execute_command → shell command execution", () => {
    it("runs a basic command", async () => {
      const result = await callTool("execute_command", {
        command: "node -e \"console.log(JSON.stringify({platform: process.platform, node: process.version}))\"",
        description: "基础命令执行测试",
        timeout_seconds: 10,
      })
      const text = extractText(result.content)
      const json = parseJson(text)
      expect(json.exitCode).toBe(0)
      expect(json.stdout).toContain("platform")
    }, 30_000)
  })

  // ── read/write file ───────────────────────────────────────

  describe("file I/O tools", () => {
    it("write and read a file", async () => {
      const testContent = `{"test": true, "timestamp": "${new Date().toISOString()}"}`
      const testPath = `${process.env.TEMP || "/tmp"}/llm-test-${Date.now()}.json`

      const writeResult = await callTool("write_file", {
        path: testPath,
        content: testContent,
        description: "测试文件写入",
      })
      const writeJson = parseJson(extractText(writeResult.content))
      expect(writeJson.path).toBe(testPath)

      const readResult = await callTool("read_file", {
        path: testPath,
      })
      const readJson = parseJson(extractText(readResult.content))
      expect(readJson.content).toContain('"test": true')
    }, 30_000)
  })
})
