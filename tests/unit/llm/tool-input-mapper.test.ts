import { describe, it, expect, vi } from "vitest"
import { looksLikeCode, buildFallbackScript } from "@/lib/llm/tool-input-mapper"

// ── Mock mcp-tool-repo（buildToolInput / buildToolInputFromFunctionArgs 需要） ──
vi.mock("@/lib/repositories/mcp-tool-repo", () => ({
  findByToolName: vi.fn(),
}))

import * as mcpToolRepo from "@/lib/repositories/mcp-tool-repo"
import { buildToolInput, buildToolInputFromFunctionArgs } from "@/lib/llm/tool-input-mapper"

describe("tool-input-mapper: looksLikeCode()", () => {
  it("识别 Node.js 代码", () => {
    const code = "const http = require('http');\nhttp.get('http://localhost');"
    expect(looksLikeCode(code)).toBe(true)
  })

  it("识别 async/await 代码", () => {
    const code = "const result = await fetch('http://target');\nconsole.log(result);"
    expect(looksLikeCode(code)).toBe(true)
  })

  it("自然语言描述不被识别为代码", () => {
    expect(looksLikeCode("扫描目标端口 80 和 443")).toBe(false)
  })

  it("短字符串不被识别为代码", () => {
    expect(looksLikeCode("short")).toBe(false)
  })

  it("空字符串返回 false", () => {
    expect(looksLikeCode("")).toBe(false)
  })
})

describe("tool-input-mapper: buildFallbackScript()", () => {
  it("HTTP 目标生成 http.get 脚本", () => {
    const script = buildFallbackScript("http://127.0.0.1:8080", "探测服务")
    expect(script).toContain("http.get")
    expect(script).toContain("127.0.0.1:8080")
  })

  it("HTTPS 目标使用 https 模块", () => {
    const script = buildFallbackScript("https://example.com", "探测")
    expect(script).toContain("require('https')")
  })

  it("TCP 目标生成 net.Socket 脚本", () => {
    const script = buildFallbackScript("tcp://192.168.1.1:22", "banner grab")
    expect(script).toContain("net.Socket")
    expect(script).toContain("192.168.1.1")
  })

  it("host:port 格式生成 TCP 脚本", () => {
    const script = buildFallbackScript("10.0.0.1:3306", "探测 MySQL")
    expect(script).toContain("net.Socket")
    expect(script).toContain("3306")
  })

  it("无 scheme 的普通主机名生成 HTTP 脚本", () => {
    const script = buildFallbackScript("example.com", "探测")
    expect(script).toContain("http.get")
    expect(script).toContain("http://example.com")
  })
})

describe("tool-input-mapper: buildToolInput()", () => {
  it("根据 schema 将 target 映射到对应参数名", async () => {
    vi.mocked(mcpToolRepo.findByToolName).mockResolvedValueOnce({
      inputSchema: {
        properties: {
          url: { type: "string" },
          action: { type: "string" },
        },
        required: ["url"],
      },
    } as never)

    const input = await buildToolInput("curl_http_request", "http://127.0.0.1", "GET 请求")
    expect(input.url).toBe("http://127.0.0.1")
    expect(input.action).toBe("GET 请求")
  })

  it("schema 无 properties 时返回默认 target+action", async () => {
    vi.mocked(mcpToolRepo.findByToolName).mockResolvedValueOnce({
      inputSchema: {},
    } as never)

    const input = await buildToolInput("unknown_tool", "target-val", "action-val")
    expect(input.target).toBe("target-val")
    expect(input.action).toBe("action-val")
  })

  it("工具不存在时返回默认 target+action", async () => {
    vi.mocked(mcpToolRepo.findByToolName).mockResolvedValueOnce(null as never)

    const input = await buildToolInput("missing_tool", "t", "a")
    expect(input.target).toBe("t")
    expect(input.action).toBe("a")
  })

  it("host 参数映射到 hostname", async () => {
    vi.mocked(mcpToolRepo.findByToolName).mockResolvedValueOnce({
      inputSchema: {
        properties: {
          host: { type: "string" },
          port: { type: "number" },
        },
      },
    } as never)

    const input = await buildToolInput("tcp_tool", "http://example.com:8080/path", "scan")
    expect(input.host).toBe("example.com")
    expect(input.port).toBe(8080)
  })

  it("array 类型的 targets 参数映射为数组", async () => {
    vi.mocked(mcpToolRepo.findByToolName).mockResolvedValueOnce({
      inputSchema: {
        properties: {
          targets: { type: "array" },
        },
      },
    } as never)

    const input = await buildToolInput("batch_scan", "10.0.0.1,10.0.0.2", "扫描")
    expect(input.targets).toEqual(["10.0.0.1", "10.0.0.2"])
  })
})

describe("tool-input-mapper: buildToolInputFromFunctionArgs()", () => {
  it("LLM 参数完整时直接使用 LLM 参数", async () => {
    vi.mocked(mcpToolRepo.findByToolName).mockResolvedValueOnce({
      inputSchema: {
        properties: { target: { type: "string" } },
        required: ["target"],
      },
    } as never)

    const input = await buildToolInputFromFunctionArgs(
      "fscan_port_scan",
      { target: "192.168.1.1", ports: "1-1000" },
      "192.168.1.1",
      "扫描端口",
    )
    expect(input).toEqual({ target: "192.168.1.1", ports: "1-1000" })
  })

  it("LLM 参数缺少必填字段时合并 schema 映射", async () => {
    vi.mocked(mcpToolRepo.findByToolName).mockResolvedValueOnce({
      inputSchema: {
        properties: {
          target: { type: "string" },
          action: { type: "string" },
        },
        required: ["target"],
      },
    } as never)

    const input = await buildToolInputFromFunctionArgs(
      "some_tool",
      { action: "自定义操作" },  // 缺少 required target
      "http://example.com",
      "默认操作",
    )
    // target 应该从 schema 映射补充
    expect(input.target).toBe("http://example.com")
    // LLM 参数优先
    expect(input.action).toBe("自定义操作")
  })

  it("空 functionArgs 时回退到 buildToolInput", async () => {
    vi.mocked(mcpToolRepo.findByToolName).mockResolvedValueOnce({
      inputSchema: {
        properties: { url: { type: "string" } },
        required: ["url"],
      },
    } as never)

    const input = await buildToolInputFromFunctionArgs(
      "tool",
      {},
      "http://target.com",
      "scan",
    )
    expect(input.url).toBe("http://target.com")
  })
})
