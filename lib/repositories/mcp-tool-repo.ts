import { prisma } from "@/lib/infra/prisma"
import type { RiskLevel } from "@/lib/generated/prisma"

export async function findAll() {
  return prisma.mcpTool.findMany({
    orderBy: { toolName: "asc" },
  })
}

export async function findEnabled() {
  return prisma.mcpTool.findMany({
    where: { enabled: true },
    orderBy: { toolName: "asc" },
  })
}

export async function findByToolName(toolName: string) {
  return prisma.mcpTool.findUnique({ where: { toolName } })
}

export async function findByCapability(capability: string) {
  return prisma.mcpTool.findMany({
    where: { capability, enabled: true },
  })
}

export async function upsert(data: {
  serverName: string
  toolName: string
  capability: string
  boundary?: string
  riskLevel?: RiskLevel
  requiresApproval?: boolean
  description?: string
  inputSchema?: object
  timeout?: number
}) {
  return prisma.mcpTool.upsert({
    where: { toolName: data.toolName },
    create: {
      serverName: data.serverName,
      toolName: data.toolName,
      capability: data.capability,
      boundary: data.boundary ?? "external",
      riskLevel: data.riskLevel ?? "medium",
      requiresApproval: data.requiresApproval ?? false,
      description: data.description ?? "",
      inputSchema: data.inputSchema ?? {},
      timeout: data.timeout ?? 60000,
    },
    update: {
      serverName: data.serverName,
      capability: data.capability,
      boundary: data.boundary,
      riskLevel: data.riskLevel,
      requiresApproval: data.requiresApproval,
      description: data.description,
      inputSchema: data.inputSchema,
      timeout: data.timeout,
    },
  })
}

export async function findAllServers() {
  return prisma.mcpServer.findMany({ orderBy: { serverName: "asc" } })
}

export async function upsertServer(data: {
  serverName: string
  transport: string
  command?: string
  args?: string[]
  cwd?: string
  envJson?: string
  endpoint?: string
  enabled?: boolean
}) {
  return prisma.mcpServer.upsert({
    where: { serverName: data.serverName },
    create: data,
    update: {
      transport: data.transport,
      command: data.command,
      args: data.args,
      cwd: data.cwd,
      envJson: data.envJson,
      endpoint: data.endpoint,
      enabled: data.enabled,
    },
  })
}
