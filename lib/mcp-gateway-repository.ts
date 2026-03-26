import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import type {
  ApprovalRecord,
  McpDispatchInput,
  McpDispatchPayload,
  McpRunRecord,
  McpToolRecord,
  ProjectDetailRecord,
  ProjectRecord,
} from "@/lib/prototype-types"

const approvalStatusPriority: Record<ApprovalRecord["status"], number> = {
  待处理: 0,
  已延后: 1,
  已批准: 2,
  已拒绝: 3,
}

function formatTimestamp(date = new Date()) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function createAuditLog(summary: string, status: string, projectName?: string) {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    category: "MCP 网关",
    summary,
    projectName,
    actor: "MCP 网关",
    timestamp: formatTimestamp(),
    status,
  }
}

function reorderApprovals(approvals: ApprovalRecord[]) {
  return [...approvals]
    .sort((left, right) => {
      const statusGap = approvalStatusPriority[left.status] - approvalStatusPriority[right.status]

      if (statusGap !== 0) {
        return statusGap
      }

      return left.queuePosition - right.queuePosition
    })
    .map((approval, index) => ({
      ...approval,
      queuePosition: index + 1,
    }))
}

function updateProjectPendingCounts(approvals: ApprovalRecord[]) {
  return approvals.reduce<Record<string, number>>((accumulator, approval) => {
    if (approval.status === "待处理") {
      accumulator[approval.projectId] = (accumulator[approval.projectId] ?? 0) + 1
    }

    return accumulator
  }, {})
}

function pushProjectActivity(
  detail: ProjectDetailRecord,
  title: string,
  detailText: string,
  tone: "success" | "warning" | "danger" | "info",
) {
  return {
    ...detail,
    activity: [
      {
        title,
        detail: detailText,
        meta: "MCP 网关",
        tone,
      },
      ...detail.activity,
    ].slice(0, 8),
    currentStage: {
      ...detail.currentStage,
      updatedAt: formatTimestamp(),
    },
  }
}

function buildRunId() {
  return `run-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
}

function buildApprovalId() {
  return `APR-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
}

function getToolBoundary(tool?: McpToolRecord) {
  return tool?.boundary ?? "外部目标交互"
}

function selectToolForCapability(tools: McpToolRecord[], capability: string) {
  const matchedTools = tools.filter((tool) => tool.capability === capability)
  const enabledTool = matchedTools.find((tool) => tool.status === "启用")

  return {
    enabledTool,
    matchedTool: matchedTools[0],
  }
}

function createRunRecord({
  input,
  project,
  tool,
  status,
  dispatchMode,
  linkedApprovalId,
  summaryLines,
}: {
  input: McpDispatchInput
  project: ProjectRecord
  tool?: McpToolRecord
  status: McpRunRecord["status"]
  dispatchMode: McpRunRecord["dispatchMode"]
  linkedApprovalId?: string
  summaryLines: string[]
}) {
  const timestamp = formatTimestamp()

  return {
    id: buildRunId(),
    projectId: project.id,
    projectName: project.name,
    capability: input.capability,
    toolId: tool?.id ?? "",
    toolName: tool?.toolName ?? "未匹配可用工具",
    requestedAction: input.requestedAction,
    target: input.target,
    riskLevel: input.riskLevel,
    boundary: getToolBoundary(tool),
    dispatchMode,
    status,
    requestedBy: "LLM 编排内核",
    createdAt: timestamp,
    updatedAt: timestamp,
    linkedApprovalId,
    summaryLines,
  } satisfies McpRunRecord
}

function createApprovalRecord(project: ProjectRecord, tool: McpToolRecord, input: McpDispatchInput): ApprovalRecord {
  return {
    id: buildApprovalId(),
    projectId: project.id,
    projectName: project.name,
    target: input.target,
    actionType: input.requestedAction,
    riskLevel: input.riskLevel,
    rationale: `该动作需要通过 ${tool.toolName} 触达目标环境，当前能力族为 ${input.capability}。`,
    impact: `将通过 ${tool.toolName} 对目标发起受控 ${input.capability} 调用。`,
    mcpCapability: input.capability,
    tool: tool.toolName,
    status: "待处理",
    parameterSummary: `target=${input.target}; capability=${input.capability}; tool=${tool.toolName}; endpoint=${tool.endpoint}`,
    prerequisites: ["确认目标仍在授权范围内", "确认当前时间窗口允许执行", "确认结果链路可正常留痕"],
    stopCondition: "出现异常回显、速率限制、目标波动或授权边界不清时立即停止。",
    blockingImpact: "审批通过前，该动作不会进入 MCP 实际执行阶段。",
    queuePosition: Number.MAX_SAFE_INTEGER,
    submittedAt: formatTimestamp(),
  }
}

function shouldRequireApproval({
  input,
  projectControlEnabled,
  projectAutoApproveLowRisk,
  globalControlEnabled,
  globalAutoApproveLowRisk,
  tool,
}: {
  input: McpDispatchInput
  projectControlEnabled: boolean
  projectAutoApproveLowRisk: boolean
  globalControlEnabled: boolean
  globalAutoApproveLowRisk: boolean
  tool: McpToolRecord
}) {
  if (!globalControlEnabled || !projectControlEnabled) {
    return false
  }

  if (tool.requiresApproval || input.riskLevel === "高") {
    return true
  }

  if (input.riskLevel === "低") {
    return !(globalAutoApproveLowRisk && projectAutoApproveLowRisk)
  }

  return true
}

export function listStoredMcpRuns(projectId?: string) {
  const runs = readPrototypeStore().mcpRuns

  if (!projectId) {
    return runs
  }

  return runs.filter((run) => run.projectId === projectId)
}

export function getStoredMcpRunById(runId: string) {
  return readPrototypeStore().mcpRuns.find((run) => run.id === runId) ?? null
}

export function updateStoredMcpRun(
  runId: string,
  patch: Partial<Pick<McpRunRecord, "status" | "summaryLines" | "updatedAt">>,
) {
  const store = readPrototypeStore()
  const runIndex = store.mcpRuns.findIndex((run) => run.id === runId)

  if (runIndex < 0) {
    return null
  }

  const nextRun: McpRunRecord = {
    ...store.mcpRuns[runIndex],
    ...patch,
    updatedAt: patch.updatedAt ?? formatTimestamp(),
  }

  store.mcpRuns[runIndex] = nextRun
  writePrototypeStore(store)

  return nextRun
}

export function updateStoredMcpRunResult(runId: string, summaryLines: string[]) {
  return updateStoredMcpRun(runId, { summaryLines })
}

export function dispatchStoredMcpRun(projectId: string, input: McpDispatchInput): McpDispatchPayload | null {
  const store = readPrototypeStore()
  const projectIndex = store.projects.findIndex((project) => project.id === projectId)
  const detailIndex = store.projectDetails.findIndex((detail) => detail.projectId === projectId)

  if (projectIndex < 0 || detailIndex < 0) {
    return null
  }

  const project = store.projects[projectIndex]
  const detail = store.projectDetails[detailIndex]
  const { enabledTool, matchedTool } = selectToolForCapability(store.mcpTools, input.capability)

  if (!enabledTool) {
    const blockedRun = createRunRecord({
      input,
      project,
      tool: matchedTool,
      status: "已阻塞",
      dispatchMode: "阻塞",
      summaryLines: [
        `能力族 ${input.capability} 当前没有可用的启用工具。`,
        matchedTool
          ? `${matchedTool.toolName} 当前状态为 ${matchedTool.status}，请先恢复健康或启用状态。`
          : "网关尚未接入对应能力的 MCP 工具，请先完成注册规范接入。",
      ],
    })

    store.mcpRuns.unshift(blockedRun)
    store.projects[projectIndex] = {
      ...project,
      status: "已阻塞",
      lastUpdated: formatTimestamp(),
      lastActor: "MCP 网关 · 阻塞",
    }
    store.projectDetails[detailIndex] = pushProjectActivity(
      detail,
      `${input.requestedAction} 已阻塞`,
      blockedRun.summaryLines[1],
      "danger",
    )
    store.auditLogs.unshift(
      createAuditLog(`MCP 调度阻塞：${project.name} -> ${input.requestedAction}`, "已阻塞", project.name),
    )
    writePrototypeStore(store)

    return { run: blockedRun }
  }

  const requiresApproval = shouldRequireApproval({
    input,
    projectControlEnabled: detail.approvalControl.enabled,
    projectAutoApproveLowRisk: detail.approvalControl.autoApproveLowRisk,
    globalControlEnabled: store.globalApprovalControl.enabled,
    globalAutoApproveLowRisk: store.globalApprovalControl.autoApproveLowRisk,
    tool: enabledTool,
  })

  if (requiresApproval) {
    const approval = createApprovalRecord(project, enabledTool, input)
    const pendingRun = createRunRecord({
      input,
      project,
      tool: enabledTool,
      status: "待审批",
      dispatchMode: "审批后执行",
      linkedApprovalId: approval.id,
      summaryLines: [
        `${input.requestedAction} 已提交审批，等待研究员确认后再调用 ${enabledTool.toolName}。`,
        "审批通过前，不会向目标环境发起实际探测或验证。",
      ],
    })

    store.approvals = reorderApprovals([...store.approvals, approval])
    store.mcpRuns.unshift(pendingRun)

    const pendingCountByProjectId = updateProjectPendingCounts(store.approvals)
    store.projects[projectIndex] = {
      ...project,
      status: "已阻塞",
      pendingApprovals: pendingCountByProjectId[project.id] ?? 0,
      lastUpdated: formatTimestamp(),
      lastActor: "MCP 网关 · 待审批",
    }
    store.projectDetails[detailIndex] = pushProjectActivity(
      detail,
      `${input.requestedAction} 已进入审批`,
      `MCP 网关已为 ${enabledTool.toolName} 创建审批单，等待人工确认后继续调度。`,
      "warning",
    )
    store.auditLogs.unshift(
      createAuditLog(`MCP 调度待审批：${project.name} -> ${input.requestedAction}`, "待审批", project.name),
    )
    writePrototypeStore(store)

    return {
      run: pendingRun,
      approval: store.approvals.find((item) => item.id === approval.id) ?? approval,
    }
  }

  const executedRun = createRunRecord({
    input,
    project,
    tool: enabledTool,
    status: "已执行",
    dispatchMode: "自动执行",
    summaryLines: [
      `已通过 ${enabledTool.toolName} 自动执行 ${input.requestedAction}。`,
      "结构化结果已回流到项目结果与证据链路，可继续由编排内核推进后续阶段。",
    ],
  })

  store.mcpRuns.unshift(executedRun)
  store.projects[projectIndex] = {
    ...project,
    status: project.status === "已完成" ? project.status : "运行中",
    lastUpdated: formatTimestamp(),
    lastActor: "MCP 网关 · 已执行",
  }
  store.projectDetails[detailIndex] = pushProjectActivity(
    detail,
    `${input.requestedAction} 已执行`,
    `${enabledTool.toolName} 已自动完成该动作，结果已写入项目上下文。`,
    "success",
  )
  store.auditLogs.unshift(
    createAuditLog(`MCP 已执行：${project.name} -> ${input.requestedAction}`, "已执行", project.name),
  )
  writePrototypeStore(store)

  return { run: executedRun }
}

export function syncStoredMcpRunsAfterApprovalDecision(approval: ApprovalRecord) {
  const store = readPrototypeStore()
  const runIndex = store.mcpRuns.findIndex((run) => run.linkedApprovalId === approval.id)

  if (runIndex < 0) {
    return null
  }

  const currentRun = store.mcpRuns[runIndex]
  const nextStatus: McpRunRecord["status"] =
    approval.status === "已批准" ? "已执行" : approval.status === "已延后" ? "已延后" : "已拒绝"
  const nextSummary =
    approval.status === "已批准"
      ? `审批已批准，MCP 网关已恢复调用 ${currentRun.toolName} 执行。`
      : approval.status === "已延后"
        ? "审批已延后，MCP 调度继续停留在待窗口确认状态。"
        : "审批已拒绝，MCP 调度已终止，不再向目标继续推进。"

  const nextRun: McpRunRecord = {
    ...currentRun,
    status: nextStatus,
    updatedAt: formatTimestamp(),
    summaryLines: [...currentRun.summaryLines, nextSummary],
  }

  store.mcpRuns[runIndex] = nextRun
  store.auditLogs.unshift(
    createAuditLog(`审批联动更新 MCP 调度：${approval.id} -> ${nextRun.status}`, nextRun.status, approval.projectName),
  )
  writePrototypeStore(store)

  return nextRun
}
