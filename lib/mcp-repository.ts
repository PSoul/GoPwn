import { getBuiltInMcpToolById } from "@/lib/built-in-mcp-tools"
import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import type { McpToolPatchInput, McpToolRecord } from "@/lib/prototype-types"

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

export function listStoredMcpTools() {
  return readPrototypeStore().mcpTools
}

export function getStoredMcpToolById(toolId: string) {
  return readPrototypeStore().mcpTools.find((tool) => tool.id === toolId) ?? getBuiltInMcpToolById(toolId)
}

export function updateStoredMcpTool(toolId: string, patch: McpToolPatchInput) {
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

export function runStoredMcpHealthCheck(toolId: string) {
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
