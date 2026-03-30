import { getBuiltInMcpToolById } from "@/lib/built-in-mcp-tools"
import { prisma } from "@/lib/prisma"
import { toMcpToolRecord } from "@/lib/prisma-transforms"
import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import type { McpToolPatchInput, McpToolRecord } from "@/lib/prototype-types"

const USE_PRISMA = process.env.DATA_LAYER === "prisma"

function formatTimestamp(date = new Date()) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function createAuditLog(summary: string, status: string, actor = "MCP 网关") {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    category: "MCP 网关",
    summary,
    actor,
    timestamp: formatTimestamp(),
    status,
  }
}

async function appendMcpAuditLog(summary: string, status: string, actor = "MCP 网关") {
  await prisma.auditLog.create({
    data: {
      id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      category: "MCP 网关",
      summary,
      actor,
      status,
    },
  })
}

export async function listStoredMcpTools() {
  if (USE_PRISMA) {
    const rows = await prisma.mcpTool.findMany()
    return rows.map(toMcpToolRecord)
  }
  return readPrototypeStore().mcpTools
}

export async function getStoredMcpToolById(toolId: string) {
  if (USE_PRISMA) {
    const row = await prisma.mcpTool.findUnique({ where: { id: toolId } })
    if (row) return toMcpToolRecord(row)
    return getBuiltInMcpToolById(toolId)
  }
  return readPrototypeStore().mcpTools.find((tool) => tool.id === toolId) ?? getBuiltInMcpToolById(toolId)
}

export async function updateStoredMcpTool(toolId: string, patch: McpToolPatchInput) {
  if (USE_PRISMA) {
    const existing = await prisma.mcpTool.findUnique({ where: { id: toolId } })
    if (!existing) return null

    const row = await prisma.mcpTool.update({
      where: { id: toolId },
      data: { ...patch },
    })
    const nextTool = toMcpToolRecord(row)

    await appendMcpAuditLog(
      `更新 MCP 工具 ${nextTool.toolName}：${nextTool.status} / ${nextTool.defaultConcurrency} / ${nextTool.rateLimit}`,
      nextTool.status,
    )

    return nextTool
  }

  const store = readPrototypeStore()
  const toolIndex = store.mcpTools.findIndex((tool) => tool.id === toolId)

  if (toolIndex < 0) {
    return null
  }

  const currentTool = store.mcpTools[toolIndex]
  const nextTool: McpToolRecord = {
    ...currentTool,
    ...patch,
  }

  store.mcpTools[toolIndex] = nextTool
  store.auditLogs.unshift(
    createAuditLog(
      `更新 MCP 工具 ${nextTool.toolName}：${nextTool.status} / ${nextTool.defaultConcurrency} / ${nextTool.rateLimit}`,
      nextTool.status,
    ),
  )
  writePrototypeStore(store)

  return nextTool
}

export async function runStoredMcpHealthCheck(toolId: string) {
  if (USE_PRISMA) {
    const existing = await prisma.mcpTool.findUnique({ where: { id: toolId } })
    if (!existing) return null

    const currentTool = toMcpToolRecord(existing)
    const nextStatus: McpToolRecord["status"] = currentTool.status === "异常" ? "启用" : currentTool.status
    const nextNotes =
      currentTool.status === "异常"
        ? "最近一次巡检已恢复健康，建议继续观察后再放大并发。"
        : currentTool.notes

    const row = await prisma.mcpTool.update({
      where: { id: toolId },
      data: {
        status: nextStatus,
        lastCheck: formatTimestamp(),
        notes: nextNotes,
      },
    })
    const nextTool = toMcpToolRecord(row)

    await appendMcpAuditLog(
      currentTool.status === "异常"
        ? `MCP 工具 ${nextTool.toolName} 巡检恢复，重新允许进入调度候选池`
        : `执行 MCP 工具 ${nextTool.toolName} 健康检查`,
      nextTool.status,
    )

    return nextTool
  }

  const store = readPrototypeStore()
  const toolIndex = store.mcpTools.findIndex((tool) => tool.id === toolId)

  if (toolIndex < 0) {
    return null
  }

  const currentTool = store.mcpTools[toolIndex]
  const nextStatus: McpToolRecord["status"] = currentTool.status === "异常" ? "启用" : currentTool.status
  const nextNotes =
    currentTool.status === "异常"
      ? "最近一次巡检已恢复健康，建议继续观察后再放大并发。"
      : currentTool.notes
  const nextTool: McpToolRecord = {
    ...currentTool,
    status: nextStatus,
    lastCheck: formatTimestamp(),
    notes: nextNotes,
  }

  store.mcpTools[toolIndex] = nextTool
  store.auditLogs.unshift(
    createAuditLog(
      currentTool.status === "异常"
        ? `MCP 工具 ${nextTool.toolName} 巡检恢复，重新允许进入调度候选池`
        : `执行 MCP 工具 ${nextTool.toolName} 健康检查`,
      nextTool.status,
    ),
  )
  writePrototypeStore(store)

  return nextTool
}
