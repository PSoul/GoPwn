import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"

import {
  appendStoredMcpServerInvocation,
  getStoredMcpServerCommandSummary,
} from "@/lib/mcp-server-repository"
import type { McpServerInvocationRecord, McpServerRecord } from "@/lib/prototype-types"

type McpToolCallSuccess = {
  structuredContent: Record<string, unknown>
  content: Array<{ type: string; text?: string }>
}

function extractTextContent(content: Array<{ type: string; text?: string }> | undefined) {
  return (content ?? [])
    .filter((entry) => entry.type === "text" && typeof entry.text === "string")
    .map((entry) => entry.text as string)
}

function buildInvocationSummary(parts: string[]) {
  return parts.filter(Boolean).join(" / ")
}

async function closeClientQuietly(client: Client | null, transport: StdioClientTransport | null) {
  try {
    if (client) {
      await client.close()
      return
    }
  } catch {
    // Ignore close errors and fall through to transport cleanup.
  }

  try {
    await transport?.close()
  } catch {
    // Best-effort cleanup.
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeoutHandle: NodeJS.Timeout | null = null

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`MCP 调用超时（>${timeoutMs}ms）`))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }
}

export async function callMcpServerTool<TStructuredContent extends Record<string, unknown>>(input: {
  server: McpServerRecord
  toolName: string
  arguments: Record<string, unknown>
  target: string
  timeoutMs?: number
}) {
  const startedAt = Date.now()
  const timeoutMs = input.timeoutMs ?? 15_000
  const transport = new StdioClientTransport({
    command: input.server.command,
    args: input.server.args,
    cwd: process.cwd(),
    stderr: "pipe",
  })
  const stderrChunks: string[] = []
  transport.stderr?.on("data", (chunk) => {
    stderrChunks.push(String(chunk))
  })

  const client = new Client(
    {
      name: "llm-pentest-platform",
      version: "0.1.0",
    },
    {
      capabilities: {},
    },
  )

  try {
    await withTimeout(client.connect(transport), timeoutMs)

    const toolList = await withTimeout(client.listTools(), timeoutMs)
    const toolExists = toolList.tools.some((tool) => tool.name === input.toolName)

    if (!toolExists) {
      throw new Error(`MCP server 未暴露工具 ${input.toolName}。`)
    }

    const result = await withTimeout(
      client.callTool({
        name: input.toolName,
        arguments: input.arguments,
      }),
      timeoutMs,
    )

    if ("isError" in result && result.isError) {
      const errorText = extractTextContent(result.content as Array<{ type: string; text?: string }>)
      throw new Error(errorText.join(" / ") || "MCP 工具返回错误结果。")
    }

    const structuredContent = (result.structuredContent ?? {}) as TStructuredContent
    const content = (result.content ?? []) as Array<{ type: string; text?: string }>
    const summary = buildInvocationSummary(extractTextContent(content))

    appendStoredMcpServerInvocation({
      serverId: input.server.id,
      toolName: input.toolName,
      status: "succeeded",
      target: input.target,
      summary: summary || `${input.toolName} 调用成功`,
      durationMs: Date.now() - startedAt,
    })

    return {
      structuredContent,
      content,
    } satisfies McpToolCallSuccess
  } catch (error) {
    const stderrOutput = stderrChunks.join("").trim()
    const message =
      error instanceof Error ? error.message : `MCP 调用失败：${getStoredMcpServerCommandSummary(input.server)}`
    const summary = stderrOutput ? `${message} / ${stderrOutput}` : message
    const status: McpServerInvocationRecord["status"] = message.includes("超时") ? "timeout" : "failed"

    appendStoredMcpServerInvocation({
      serverId: input.server.id,
      toolName: input.toolName,
      status,
      target: input.target,
      summary,
      durationMs: Date.now() - startedAt,
    })

    throw new Error(summary)
  } finally {
    await closeClientQuietly(client, transport)
  }
}
