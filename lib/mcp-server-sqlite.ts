import { existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

import type { McpServerInvocationRecord, McpServerRecord } from "@/lib/prototype-types"

const STORE_DIRECTORY = ".prototype-store"
const DATABASE_FILENAME = "mcp-server-registry.sqlite"

function getPrototypeStoreDirectory() {
  return process.env.PROTOTYPE_DATA_DIR ?? path.join(process.cwd(), STORE_DIRECTORY)
}

function getDatabasePath() {
  return path.join(getPrototypeStoreDirectory(), DATABASE_FILENAME)
}

function ensureDatabaseDirectory() {
  const storeDirectory = getPrototypeStoreDirectory()

  if (!existsSync(storeDirectory)) {
    mkdirSync(storeDirectory, { recursive: true })
  }
}

function applySchema(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      server_name TEXT NOT NULL,
      transport TEXT NOT NULL,
      command TEXT NOT NULL,
      args_json TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      status TEXT NOT NULL,
      tool_bindings_json TEXT NOT NULL,
      notes TEXT NOT NULL,
      last_seen TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS mcp_server_invocations (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      status TEXT NOT NULL,
      target TEXT NOT NULL,
      summary TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (server_id) REFERENCES mcp_servers(id)
    ) STRICT;

    CREATE INDEX IF NOT EXISTS idx_mcp_server_invocations_server_id
      ON mcp_server_invocations(server_id, created_at DESC);
  `)
}

export function openMcpServerDatabase() {
  ensureDatabaseDirectory()
  const database = new DatabaseSync(getDatabasePath())

  applySchema(database)

  return database
}

export type McpServerRow = {
  id: string
  server_name: string
  transport: McpServerRecord["transport"]
  command: string
  args_json: string
  endpoint: string
  enabled: number
  status: McpServerRecord["status"]
  tool_bindings_json: string
  notes: string
  last_seen: string
}

export type McpServerInvocationRow = {
  id: string
  server_id: string
  tool_name: string
  status: McpServerInvocationRecord["status"]
  target: string
  summary: string
  duration_ms: number
  created_at: string
}

export function mapMcpServerRow(row: McpServerRow): McpServerRecord {
  return {
    id: row.id,
    serverName: row.server_name,
    transport: row.transport,
    command: row.command,
    args: JSON.parse(row.args_json) as string[],
    endpoint: row.endpoint,
    enabled: Boolean(row.enabled),
    status: row.status,
    toolBindings: JSON.parse(row.tool_bindings_json) as string[],
    notes: row.notes,
    lastSeen: row.last_seen,
  }
}

export function mapMcpServerInvocationRow(row: McpServerInvocationRow): McpServerInvocationRecord {
  return {
    id: row.id,
    serverId: row.server_id,
    toolName: row.tool_name,
    status: row.status,
    target: row.target,
    summary: row.summary,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
  }
}
