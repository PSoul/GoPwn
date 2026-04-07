/**
 * Stdio MCP connector — launches an MCP server as a child process
 * and communicates via JSON-RPC over stdin/stdout.
 */

import { spawn, type ChildProcess } from "child_process"
import type { McpConnector, McpToolInput, McpToolResult } from "./connector"

type StdioConfig = {
  command: string
  args: string[]
  cwd?: string
  env?: Record<string, string>
  timeoutMs?: number
}

type JsonRpcMessage = {
  jsonrpc: "2.0"
  id?: number
  method?: string
  params?: unknown
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

export function createStdioConnector(config: StdioConfig): McpConnector {
  const { command, args, cwd, env: extraEnv, timeoutMs = 60_000 } = config

  let proc: ChildProcess | null = null
  let nextId = 1
  let buffer = ""
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

  function ensureProcess(): ChildProcess {
    if (proc && !proc.killed) return proc

    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd,
      env: { ...process.env, ...extraEnv },
      shell: process.platform === "win32",
    })

    // Register error handler IMMEDIATELY before any other listeners
    // to prevent unhandled 'error' events from crashing the process
    child.on("error", (err) => {
      console.error(`[stdio-connector] Process error (${command}): ${err.message}`)
      for (const [, p] of pending) {
        p.reject(new Error(`MCP server process error: ${err.message}`))
      }
      pending.clear()
      buffer = "" // Reset buffer on error to prevent corruption on next spawn
      proc = null
    })

    child.on("exit", (code) => {
      console.warn(`[stdio-connector] Process exited (${command}) code=${code}`)
      for (const [, p] of pending) {
        p.reject(new Error("MCP server process exited"))
      }
      pending.clear()
      buffer = "" // Reset buffer to prevent stale data from corrupting next process
      proc = null
    })

    // Capture stderr for diagnostics
    child.stderr?.setEncoding("utf8")
    child.stderr?.on("data", (chunk: string) => {
      // Only log first 500 chars per chunk to avoid flooding
      const trimmed = chunk.length > 500 ? chunk.slice(0, 500) + "..." : chunk
      console.error(`[stdio-connector:${command}:stderr] ${trimmed.trim()}`)
    })

    child.stdout!.setEncoding("utf8")
    child.stdout!.on("data", (chunk: string) => {
      buffer += chunk
      // Process complete JSON-RPC messages (newline-delimited)
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line) as JsonRpcMessage
          if (msg.id != null && pending.has(msg.id)) {
            const p = pending.get(msg.id)!
            pending.delete(msg.id)
            if (msg.error) {
              p.reject(new Error(`MCP error ${msg.error.code}: ${msg.error.message}`))
            } else {
              p.resolve(msg.result)
            }
          }
        } catch {
          // skip malformed
        }
      }
    })

    proc = child
    return proc
  }

  async function rpc(method: string, params?: unknown): Promise<unknown> {
    const p = ensureProcess()
    const id = nextId++

    const msg: JsonRpcMessage = { jsonrpc: "2.0", id, method, params }
    const line = JSON.stringify(msg) + "\n"

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        // Kill the hung process to prevent zombie MCP servers
        if (proc && !proc.killed) {
          console.warn(`[stdio-connector] Killing hung process after ${timeoutMs}ms timeout: ${command} ${method}`)
          proc.kill("SIGKILL")
          proc = null
        }
        reject(new Error(`MCP RPC timeout after ${timeoutMs}ms: ${method}`))
      }, timeoutMs)

      pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v) },
        reject: (e) => { clearTimeout(timer); reject(e) },
      })

      p.stdin!.write(line, (err) => {
        if (err) {
          clearTimeout(timer)
          pending.delete(id)
          // Kill the broken process to prevent orphaned zombies
          if (proc && !proc.killed) {
            proc.kill("SIGKILL")
            proc = null
          }
          reject(err)
        }
      })
    })
  }

  return {
    async callTool(toolName: string, input: McpToolInput): Promise<McpToolResult> {
      const start = Date.now()
      try {
        const result = (await rpc("tools/call", { name: toolName, arguments: input })) as {
          content?: Array<{ type: string; text?: string }>
          isError?: boolean
        }

        const textParts = (result?.content ?? [])
          .filter((c) => c.type === "text" && c.text)
          .map((c) => c.text!)

        return {
          content: textParts.join("\n"),
          isError: result?.isError ?? false,
          durationMs: Date.now() - start,
        }
      } catch (err) {
        return {
          content: err instanceof Error ? err.message : String(err),
          isError: true,
          durationMs: Date.now() - start,
        }
      }
    },

    async listTools() {
      const result = (await rpc("tools/list")) as {
        tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>
      }
      return (result?.tools ?? []).map((t) => ({
        name: t.name,
        description: t.description ?? "",
        inputSchema: t.inputSchema ?? {},
      }))
    },

    async close() {
      if (proc && !proc.killed) {
        proc.kill("SIGTERM")
        // Wait briefly for graceful shutdown
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            if (proc && !proc.killed) proc.kill("SIGKILL")
            resolve()
          }, 3000)
          proc!.on("exit", () => { clearTimeout(timer); resolve() })
        })
      }
      proc = null
      pending.clear()
    },
  }
}
