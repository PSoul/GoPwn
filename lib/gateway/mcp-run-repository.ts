import { prisma } from "@/lib/infra/prisma"
import { toMcpRunRecord } from "@/lib/infra/prisma-transforms"
import type { McpRunRecord } from "@/lib/prototype-types"

export async function listStoredMcpRuns(projectId?: string) {
  const rows = await prisma.mcpRun.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { createdAt: "desc" },
  })
  return rows.map(toMcpRunRecord)
}

export async function getStoredMcpRunById(runId: string) {
  const row = await prisma.mcpRun.findUnique({ where: { id: runId } })
  return row ? toMcpRunRecord(row) : null
}

export async function updateStoredMcpRun(
  runId: string,
  patch: Partial<Pick<McpRunRecord, "status" | "summaryLines" | "updatedAt" | "connectorMode">>,
) {
  const existing = await prisma.mcpRun.findUnique({ where: { id: runId } })
  if (!existing) return null
  const data: Record<string, unknown> = {}
  if (patch.status !== undefined) data.status = patch.status
  if (patch.summaryLines !== undefined) data.summaryLines = patch.summaryLines
  if (patch.connectorMode !== undefined) data.connectorMode = patch.connectorMode
  // Use updateMany to avoid throwing when the run was concurrently removed
  const result = await prisma.mcpRun.updateMany({ where: { id: runId }, data })
  if (result.count === 0) return null
  const refreshed = await prisma.mcpRun.findUnique({ where: { id: runId } })
  return refreshed ? toMcpRunRecord(refreshed) : null
}

export async function updateStoredMcpRunResult(runId: string, summaryLines: string[]) {
  return updateStoredMcpRun(runId, { summaryLines })
}
