import type { McpToolRecord } from "@/lib/prototype-types"

function formatTimestamp(date = new Date()) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function buildBuiltInTools(): McpToolRecord[] {
  const lastCheck = formatTimestamp()

  return [
    {
      id: "builtin-tool-seed-normalizer",
      capability: "目标解析类",
      toolName: "seed-normalizer",
      version: "1.0.0",
      riskLevel: "低",
      status: "启用",
      category: "平台内置",
      description: "标准化项目种子目标，给后续真实 MCP 调度提供稳定输入。",
      inputMode: "json",
      outputMode: "json",
      boundary: "平台内部处理",
      requiresApproval: false,
      endpoint: "builtin://seed-normalizer",
      owner: "平台内置",
      defaultConcurrency: "1",
      rateLimit: "n/a",
      timeout: "5s",
      retry: "0",
      lastCheck,
      notes: "平台内建基础能力，不依赖额外 MCP 注册。",
    },
    {
      id: "builtin-tool-report-exporter",
      capability: "报告导出类",
      toolName: "report-exporter",
      version: "1.0.0",
      riskLevel: "低",
      status: "启用",
      category: "平台内置",
      description: "把当前项目的结果摘要整理为可导出的报告记录。",
      inputMode: "json",
      outputMode: "json",
      boundary: "平台内部处理",
      requiresApproval: false,
      endpoint: "builtin://report-exporter",
      owner: "平台内置",
      defaultConcurrency: "1",
      rateLimit: "n/a",
      timeout: "5s",
      retry: "0",
      lastCheck,
      notes: "平台内建报告摘要导出能力，不依赖额外 MCP 注册。",
    },
  ]
}

export function listBuiltInMcpTools() {
  return buildBuiltInTools()
}

export function getBuiltInMcpToolById(toolId: string) {
  return buildBuiltInTools().find((tool) => tool.id === toolId) ?? null
}
