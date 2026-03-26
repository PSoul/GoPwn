import { formatTimestamp } from "@/lib/prototype-record-utils"
import {
  mapMcpServerInvocationRow,
  mapMcpServerRow,
  openMcpServerDatabase,
  type McpServerInvocationRow,
  type McpServerRow,
} from "@/lib/mcp-server-sqlite"
import type { McpServerInvocationRecord, McpServerRecord } from "@/lib/prototype-types"

function buildInvocationId(serverId: string, toolName: string) {
  return `mcp-server-invoke-${serverId}-${toolName}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
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
