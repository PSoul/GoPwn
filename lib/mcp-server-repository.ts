import type { McpServerRegistrationInput } from "@/lib/mcp-registration-schema"
import { buildStableRecordId, formatTimestamp } from "@/lib/prototype-record-utils"
import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import {
  openMcpServerDatabase,
  type McpServerInvocationRow,
  type McpServerRow,
  mapMcpServerInvocationRow,
  mapMcpServerRow,
} from "@/lib/mcp-server-sqlite"
import type {
  McpServerContractSummaryRecord,
  McpServerInvocationRecord,
  McpServerRecord,
  McpToolContractSummaryRecord,
  McpToolRecord,
} from "@/lib/prototype-types"

function buildInvocationId(serverId: string, toolName: string) {
  return `mcp-server-invoke-${serverId}-${toolName}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function buildServerId(serverName: string) {
  return buildStableRecordId("mcp-server", serverName)
}

function formatSchemaMode(schema?: Record<string, unknown>, fallback = "json-schema") {
  if (!schema) {
    return fallback
  }

  if (typeof schema.type === "string") {
    return `json-schema:${schema.type}`
  }

  return "json-schema"
}

function createAuditLog(summary: string, status = "已注册") {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    category: "MCP 网关",
    summary,
    actor: "MCP 注册器",
    timestamp: formatTimestamp(),
    status,
  }
}

function buildServerContract(serverId: string, input: McpServerRegistrationInput, updatedAt: string): McpServerContractSummaryRecord {
  return {
    serverId,
    serverName: input.serverName,
    version: input.version,
    transport: input.transport,
    enabled: input.enabled,
    toolNames: input.tools.map((tool) => tool.toolName),
    command: input.command,
    endpoint: input.endpoint ?? "",
    updatedAt,
  }
}

function buildToolContract(
  serverId: string,
  input: McpServerRegistrationInput,
  tool: McpServerRegistrationInput["tools"][number],
  updatedAt: string,
): McpToolContractSummaryRecord {
  return {
    serverId,
    serverName: input.serverName,
    toolName: tool.toolName,
    title: tool.title,
    capability: tool.capability,
    boundary: tool.boundary,
    riskLevel: tool.riskLevel,
    requiresApproval: tool.requiresApproval,
    resultMappings: tool.resultMappings,
    updatedAt,
  }
}

function buildToolRecord(
  input: McpServerRegistrationInput,
  tool: McpServerRegistrationInput["tools"][number],
  updatedAt: string,
  currentTool?: McpToolRecord,
): McpToolRecord {
  return {
    id: currentTool?.id ?? buildStableRecordId("tool", tool.toolName),
    capability: tool.capability,
    toolName: tool.toolName,
    version: tool.version,
    riskLevel: tool.riskLevel,
    status: input.enabled ? (currentTool?.status === "异常" ? "异常" : "启用") : "禁用",
    category: input.serverName,
    description: tool.description,
    inputMode: formatSchemaMode(tool.inputSchema),
    outputMode: formatSchemaMode(tool.outputSchema, "structuredContent"),
    boundary: tool.boundary,
    requiresApproval: tool.requiresApproval,
    endpoint: input.endpoint ?? "",
    owner: tool.owner,
    defaultConcurrency: tool.defaultConcurrency,
    rateLimit: tool.rateLimit,
    timeout: tool.timeout,
    retry: tool.retry,
    lastCheck: updatedAt,
    notes: input.notes ?? "",
  }
}

export function registerStoredMcpServer(input: McpServerRegistrationInput) {
  const database = openMcpServerDatabase()
  const updatedAt = formatTimestamp()
  const serverId = buildServerId(input.serverName)

  try {
    database
      .prepare(`
        INSERT INTO mcp_servers (
          id,
          server_name,
          transport,
          command,
          args_json,
          endpoint,
          enabled,
          status,
          tool_bindings_json,
          notes,
          last_seen
        ) VALUES (
          :id,
          :serverName,
          :transport,
          :command,
          :argsJson,
          :endpoint,
          :enabled,
          :status,
          :toolBindingsJson,
          :notes,
          :lastSeen
        )
        ON CONFLICT(id) DO UPDATE SET
          server_name = excluded.server_name,
          transport = excluded.transport,
          command = excluded.command,
          args_json = excluded.args_json,
          endpoint = excluded.endpoint,
          enabled = excluded.enabled,
          status = excluded.status,
          tool_bindings_json = excluded.tool_bindings_json,
          notes = excluded.notes,
          last_seen = excluded.last_seen
      `)
      .run({
        id: serverId,
        serverName: input.serverName,
        transport: input.transport,
        command: input.command ?? "",
        argsJson: JSON.stringify(input.args),
        endpoint: input.endpoint ?? "",
        enabled: input.enabled ? 1 : 0,
        status: input.enabled ? "已连接" : "停用",
        toolBindingsJson: JSON.stringify(input.tools.map((tool) => tool.toolName)),
        notes: input.notes ?? "",
        lastSeen: updatedAt,
      })
  } finally {
    database.close()
  }

  const store = readPrototypeStore()
  const previousToolContracts = store.mcpToolContracts.filter((contract) => contract.serverId === serverId)
  const currentToolNames = new Set(input.tools.map((tool) => tool.toolName))
  const serverContract = buildServerContract(serverId, input, updatedAt)
  const toolContracts = input.tools.map((tool) => buildToolContract(serverId, input, tool, updatedAt))
  const toolRecords = input.tools.map((tool) =>
    buildToolRecord(input, tool, updatedAt, store.mcpTools.find((item) => item.toolName === tool.toolName)),
  )

  store.mcpServerContracts = [
    serverContract,
    ...store.mcpServerContracts.filter((contract) => contract.serverId !== serverId),
  ]
  store.mcpToolContracts = [
    ...toolContracts,
    ...store.mcpToolContracts.filter((contract) => contract.serverId !== serverId),
  ]
  store.mcpTools = [
    ...toolRecords,
    ...store.mcpTools.filter((tool) => {
      if (currentToolNames.has(tool.toolName)) {
        return false
      }

      const previousContract = previousToolContracts.find((contract) => contract.toolName === tool.toolName)
      return !previousContract
    }),
  ]
  store.auditLogs.unshift(
    createAuditLog(`MCP server ${input.serverName} 已完成契约校验并注册 ${input.tools.length} 个工具。`),
  )
  writePrototypeStore(store)

  const server = getStoredMcpServerById(serverId)

  if (!server) {
    throw new Error(`registered MCP server '${input.serverName}' could not be reloaded`)
  }

  return {
    server,
    serverContract,
    toolContracts,
    toolRecords,
  }
}

export function listStoredMcpServers() {
  const database = openMcpServerDatabase()

  try {
    const rows = database
      .prepare(`
        SELECT
          id,
          server_name,
          transport,
          command,
          args_json,
          endpoint,
          enabled,
          status,
          tool_bindings_json,
          notes,
          last_seen
        FROM mcp_servers
        ORDER BY server_name ASC
      `)
      .all() as McpServerRow[]

    return rows.map(mapMcpServerRow)
  } finally {
    database.close()
  }
}

export function getStoredMcpServerById(serverId: string) {
  const database = openMcpServerDatabase()

  try {
    const row = database
      .prepare(`
        SELECT
          id,
          server_name,
          transport,
          command,
          args_json,
          endpoint,
          enabled,
          status,
          tool_bindings_json,
          notes,
          last_seen
        FROM mcp_servers
        WHERE id = ?
        LIMIT 1
      `)
      .get(serverId) as McpServerRow | undefined

    return row ? mapMcpServerRow(row) : null
  } finally {
    database.close()
  }
}

export function findStoredMcpServerByToolBinding(toolName: string, options?: { enabledOnly?: boolean }) {
  const matchedServer =
    listStoredMcpServers().find((server) => {
      if (options?.enabledOnly && !server.enabled) {
        return false
      }

      return server.toolBindings.includes(toolName)
    }) ?? null

  return matchedServer
}

export function appendStoredMcpServerInvocation(
  input: Omit<McpServerInvocationRecord, "createdAt" | "id"> & Partial<Pick<McpServerInvocationRecord, "createdAt" | "id">>,
) {
  const database = openMcpServerDatabase()

  try {
    const record: McpServerInvocationRecord = {
      id: input.id ?? buildInvocationId(input.serverId, input.toolName),
      serverId: input.serverId,
      toolName: input.toolName,
      status: input.status,
      target: input.target,
      summary: input.summary,
      durationMs: input.durationMs,
      createdAt: input.createdAt ?? formatTimestamp(),
    }

    try {
      database
        .prepare(`
          INSERT INTO mcp_server_invocations (
            id,
            server_id,
            tool_name,
            status,
            target,
            summary,
            duration_ms,
            created_at
          ) VALUES (
            :id,
            :serverId,
            :toolName,
            :status,
            :target,
            :summary,
            :durationMs,
            :createdAt
          )
        `)
        .run({
          id: record.id,
          serverId: record.serverId,
          toolName: record.toolName,
          status: record.status,
          target: record.target,
          summary: record.summary,
          durationMs: record.durationMs,
          createdAt: record.createdAt,
        })
    } catch {
      // Best-effort: FK constraint may fail for synthetic/auto-discovered server IDs
      // Invocation logging is non-critical — the execution itself should still proceed
    }

    return record
  } finally {
    database.close()
  }
}

export function listStoredMcpServerInvocations(serverId?: string, limit = 8) {
  const database = openMcpServerDatabase()

  try {
    const statement = serverId
      ? database.prepare(`
          SELECT
            id,
            server_id,
            tool_name,
            status,
            target,
            summary,
            duration_ms,
            created_at
          FROM mcp_server_invocations
          WHERE server_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT ?
        `)
      : database.prepare(`
          SELECT
            id,
            server_id,
            tool_name,
            status,
            target,
            summary,
            duration_ms,
            created_at
          FROM mcp_server_invocations
          ORDER BY created_at DESC, id DESC
          LIMIT ?
        `)

    const rows = (
      serverId ? statement.all(serverId, limit) : statement.all(limit)
    ) as McpServerInvocationRow[]

    return rows.map(mapMcpServerInvocationRow)
  } finally {
    database.close()
  }
}

export function findStoredEnabledMcpServerByToolBinding(toolName: string) {
  return findStoredMcpServerByToolBinding(toolName, { enabledOnly: true })
}

export function getStoredMcpServerCommandSummary(server: McpServerRecord) {
  return [server.command, ...server.args].join(" ").trim()
}
