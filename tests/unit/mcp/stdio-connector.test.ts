import { vi, describe, it, expect, beforeEach } from "vitest"
import { createMockChildProcess } from "../../helpers/mock-child-process"

const { mockSpawn } = vi.hoisted(() => ({ mockSpawn: vi.fn() }))
vi.mock("child_process", () => ({ spawn: mockSpawn }))

import { createStdioConnector } from "@/lib/mcp/stdio-connector"

describe("stdio-connector", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockSpawn.mockReset()
  })

  it("正常 JSON-RPC 通信 — callTool 返回解析结果", async () => {
    const { proc, stdout } = createMockChildProcess()
    mockSpawn.mockReturnValue(proc)

    const connector = createStdioConnector({ command: "node", args: ["server.js"] })
    const promise = connector.callTool("scan", { target: "127.0.0.1" })

    // 等一个 tick 让 stdin.write 执行
    await new Promise((r) => setTimeout(r, 10))

    // 模拟 MCP server 返回 JSON-RPC 响应
    const response = {
      jsonrpc: "2.0",
      id: 1,
      result: { content: [{ type: "text", text: "ok" }] },
    }
    stdout.write(JSON.stringify(response) + "\n")

    const result = await promise
    expect(result.content).toBe("ok")
    expect(result.isError).toBe(false)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it("并发请求 ID 隔离 — 各自 resolve 正确值", async () => {
    const { proc, stdout } = createMockChildProcess()
    mockSpawn.mockReturnValue(proc)

    const connector = createStdioConnector({ command: "node", args: ["server.js"] })
    const p1 = connector.callTool("tool1", {})
    const p2 = connector.callTool("tool2", {})
    const p3 = connector.callTool("tool3", {})

    await new Promise((r) => setTimeout(r, 10))

    // 乱序返回响应
    stdout.write(JSON.stringify({ jsonrpc: "2.0", id: 3, result: { content: [{ type: "text", text: "third" }] } }) + "\n")
    stdout.write(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: "first" }] } }) + "\n")
    stdout.write(JSON.stringify({ jsonrpc: "2.0", id: 2, result: { content: [{ type: "text", text: "second" }] } }) + "\n")

    const [r1, r2, r3] = await Promise.all([p1, p2, p3])
    expect(r1.content).toBe("first")
    expect(r2.content).toBe("second")
    expect(r3.content).toBe("third")
  })

  it("请求超时 — reject 并 kill 进程", async () => {
    const { proc } = createMockChildProcess()
    mockSpawn.mockReturnValue(proc)

    const connector = createStdioConnector({
      command: "node",
      args: ["server.js"],
      timeoutMs: 50,
    })

    const result = await connector.callTool("slow_tool", {})
    // callTool catches errors and returns isError:true
    expect(result.isError).toBe(true)
    expect(result.content).toContain("timeout")
    expect(proc.killed).toBe(true)
  })

  it("stdin.write 失败 — reject 并 kill 进程", async () => {
    const { proc } = createMockChildProcess()
    // Override stdin.write to simulate write error
    const originalWrite = proc.stdin.write.bind(proc.stdin)
    proc.stdin.write = ((data: unknown, encodingOrCb?: unknown, cb?: unknown) => {
      const callback = typeof encodingOrCb === "function" ? encodingOrCb : cb
      if (typeof callback === "function") {
        callback(new Error("stdin write failed"))
      }
      return false
    }) as typeof proc.stdin.write

    mockSpawn.mockReturnValue(proc)

    const connector = createStdioConnector({ command: "node", args: ["server.js"] })
    const result = await connector.callTool("tool", {})

    expect(result.isError).toBe(true)
    expect(result.content).toContain("stdin write failed")
    expect(proc.killed).toBe(true)
  })

  it("进程异常退出 — 所有 pending reject", async () => {
    const { proc } = createMockChildProcess()
    mockSpawn.mockReturnValue(proc)

    const connector = createStdioConnector({ command: "node", args: ["server.js"] })
    const promise = connector.callTool("tool", {})

    await new Promise((r) => setTimeout(r, 10))

    // 模拟进程异常退出
    proc.emit("exit", 1)

    const result = await promise
    expect(result.isError).toBe(true)
    expect(result.content).toContain("exited")
  })

  it("stderr 消费 — 不抛异常，写入 console.error", async () => {
    const { proc, stderr } = createMockChildProcess()
    mockSpawn.mockReturnValue(proc)

    const spy = vi.spyOn(console, "error").mockImplementation(() => {})

    const connector = createStdioConnector({ command: "node", args: ["server.js"] })
    // 触发 ensureProcess() 来绑定 stderr listener
    const promise = connector.callTool("tool", {})

    await new Promise((r) => setTimeout(r, 10))

    stderr.write("some warning message")

    await new Promise((r) => setTimeout(r, 10))

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("some warning message"),
    )

    // 清理：让 pending 请求完成
    proc.emit("exit", 0)
    await promise

    spy.mockRestore()
  })

  it("close() 清理 — proc.kill(SIGTERM) 被调用", async () => {
    const { proc } = createMockChildProcess()
    // Override kill to NOT emit exit synchronously — this mimics real process
    // behavior where the process takes time to terminate.
    const killCalls: string[] = []
    proc.kill = function (this: typeof proc, signal?: string) {
      killCalls.push(signal ?? "SIGTERM")
      this.killed = true
      // Emit exit asynchronously like a real process
      setTimeout(() => proc.emit("exit", 0, signal), 5)
    } as typeof proc.kill

    mockSpawn.mockReturnValue(proc)

    const connector = createStdioConnector({ command: "node", args: ["server.js"] })
    // 触发 ensureProcess() — start a callTool but we don't need it to resolve
    const promise = connector.callTool("tool", {})

    await new Promise((r) => setTimeout(r, 10))

    await connector.close()

    expect(killCalls[0]).toBe("SIGTERM")
    // promise settled due to exit event
    await promise
  })
})
