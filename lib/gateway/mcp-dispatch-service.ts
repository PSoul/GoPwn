import { listBuiltInMcpTools } from "@/lib/built-in-mcp-tools"
import { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { setLlmCodeForRun } from "@/lib/mcp-connectors/stdio-mcp-connector"
import {
  toMcpRunRecord,
  fromMcpRunRecord,
  toApprovalRecord,
  fromApprovalRecord,
  fromLogRecord,
} from "@/lib/prisma-transforms"
import { normalizeProjectSchedulerControl } from "@/lib/project-scheduler-lifecycle"
import { createStoredSchedulerTaskFromRun } from "@/lib/mcp-scheduler-repository"
import type {
  ApprovalRecord,
  McpDispatchInput,
  McpDispatchPayload,
  McpRunRecord,
  McpToolRecord,
  ProjectKnowledgeItem,
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

function buildRunId() {
  return `run-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
}

function buildApprovalId() {
  return `APR-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
}

function getToolBoundary(tool?: McpToolRecord) {
  return tool?.boundary ?? "外部目标交互"
}

function tokenizeForMatch(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
    .map((token) => token.trim())
    .filter(Boolean)
}

function scoreToolForRequestedAction(tool: McpToolRecord, requestedAction: string) {
  const actionTokens = tokenizeForMatch(requestedAction)

  if (actionTokens.length === 0) {
    return 0
  }

  const keywordBag = [
    tool.toolName,
    tool.category,
    tool.description,
    tool.notes,
    tool.endpoint,
  ]
    .join(" ")
    .toLowerCase()
  let score = 0

  for (const token of actionTokens) {
    if (keywordBag.includes(token)) {
      score += token.length >= 4 ? 3 : 1
    }
  }

  if (keywordBag.includes(requestedAction.trim().toLowerCase())) {
    score += 5
  }

  return score
}

function selectToolForCapability(tools: McpToolRecord[], input: McpDispatchInput) {
  // If LLM specified a preferred tool name, try direct match first (across all capabilities)
  if (input.preferredToolName) {
    const directMatch = tools.find(
      (tool) => tool.toolName === input.preferredToolName && tool.status === "启用",
    )
    if (directMatch) {
      return { enabledTool: directMatch, matchedTool: directMatch }
    }
  }

  const matchedTools = tools.filter((tool) => tool.capability === input.capability)
  const enabledTools = matchedTools.filter((tool) => tool.status === "启用")
  const enabledTool =
    enabledTools.length <= 1
      ? enabledTools[0]
      : [...enabledTools].sort((left, right) => {
          const scoreGap =
            scoreToolForRequestedAction(right, input.requestedAction) -
            scoreToolForRequestedAction(left, input.requestedAction)

          if (scoreGap !== 0) {
            return scoreGap
          }

          return left.toolName.localeCompare(right.toolName)
        })[0]

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
    queuePosition: 2147483647,
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

export async function dispatchStoredMcpRun(projectId: string, input: McpDispatchInput): Promise<McpDispatchPayload | null> {
  // Import transforms for reading tool records
  const { toProjectRecord, toProjectDetailRecord, toMcpToolRecord, toApprovalControlRecord: toGAC } = await import("@/lib/prisma-transforms")

  const [projectRow, detailRow] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.projectDetail.findUnique({ where: { projectId } }),
  ])
  if (!projectRow || !detailRow) return null

  const project = toProjectRecord(projectRow)
  const detail = toProjectDetailRecord(detailRow)
  const schedulerControlRow = await prisma.projectSchedulerControl.findUnique({ where: { projectId } })
  const schedulerControl = normalizeProjectSchedulerControl({
    control: schedulerControlRow
      ? (await import("@/lib/prisma-transforms")).toProjectSchedulerControlRecord(schedulerControlRow)
      : undefined,
    projectStatus: project.status,
    updatedAt: project.lastUpdated,
  })

  if (schedulerControl.lifecycle === "idle") {
    await prisma.projectSchedulerControl.upsert({
      where: { projectId },
      create: { projectId, lifecycle: "running", paused: false, note: "显式派发 MCP 动作后，项目已自动进入运行态。" },
      update: { lifecycle: "running", paused: false, note: "显式派发 MCP 动作后，项目已自动进入运行态。" },
    })
  }

  // Resolve tools — read from Prisma mcpTools + built-in
  const dbTools = (await prisma.mcpTool.findMany()).map(toMcpToolRecord)
  const { enabledTool, matchedTool } = selectToolForCapability(dbTools, input)
  const builtInSelection =
    enabledTool || matchedTool
      ? { enabledTool: undefined, matchedTool: undefined }
      : selectToolForCapability(listBuiltInMcpTools(), input)
  const resolvedEnabledTool = enabledTool ?? builtInSelection.enabledTool
  const resolvedMatchedTool = matchedTool ?? builtInSelection.matchedTool

  // Read global approval control
  const globalControlRow = await prisma.globalApprovalControl.findUnique({ where: { id: "global" } })
  const globalControl = globalControlRow
    ? toGAC(globalControlRow)
    : { enabled: true, mode: "", autoApproveLowRisk: true, description: "", note: "" }

  // Helper to push activity into detail JSON
  const pushActivityPrisma = async (title: string, detailText: string, tone: string) => {
    const latestDetail = await prisma.projectDetail.findUnique({ where: { projectId } })
    if (!latestDetail) return
    const currentActivity = (latestDetail.activity ?? []) as unknown as ProjectKnowledgeItem[]
    const newActivity = [
      { title, detail: detailText, meta: "MCP 网关", tone },
      ...currentActivity,
    ].slice(0, 8)
    const currentStage = (latestDetail.currentStage ?? {}) as Record<string, unknown>
    await prisma.projectDetail.update({
      where: { projectId },
      data: {
        activity: newActivity as unknown as Prisma.InputJsonArray,
        currentStage: { ...currentStage, updatedAt: formatTimestamp() } as unknown as Prisma.InputJsonObject,
      },
    })
  }

  if (!resolvedEnabledTool) {
    const blockedRun = createRunRecord({
      input,
      project,
      tool: resolvedMatchedTool,
      status: "已阻塞",
      dispatchMode: "阻塞",
      summaryLines: [
        `能力族 ${input.capability} 当前没有可用的启用工具。`,
        resolvedMatchedTool
          ? `${resolvedMatchedTool.toolName} 当前状态为 ${resolvedMatchedTool.status}，请先恢复健康或启用状态。`
          : "网关尚未接入对应能力的 MCP 工具，请先完成注册规范接入。",
      ],
    })

    await prisma.mcpRun.create({ data: fromMcpRunRecord(blockedRun) })
    await prisma.project.updateMany({
      where: { id: projectId },
      data: { status: "等待审批", lastActor: "MCP 网关 · 阻塞" },
    })
    await pushActivityPrisma(`${input.requestedAction} 已阻塞`, blockedRun.summaryLines[1], "danger")
    const auditLog = createAuditLog(`MCP 调度阻塞：${project.name} -> ${input.requestedAction}`, "已阻塞", project.name)
    await prisma.auditLog.create({ data: fromLogRecord(auditLog) })
    await createStoredSchedulerTaskFromRun(blockedRun)
    return { run: blockedRun }
  }

  const requiresApproval = shouldRequireApproval({
    input,
    projectControlEnabled: detail.approvalControl.enabled,
    projectAutoApproveLowRisk: detail.approvalControl.autoApproveLowRisk,
    globalControlEnabled: globalControl.enabled,
    globalAutoApproveLowRisk: globalControl.autoApproveLowRisk,
    tool: resolvedEnabledTool,
  })

  if (requiresApproval) {
    const approval = createApprovalRecord(project, resolvedEnabledTool, input)
    const pendingRun = createRunRecord({
      input,
      project,
      tool: resolvedEnabledTool,
      status: "待审批",
      dispatchMode: "审批后执行",
      linkedApprovalId: approval.id,
      summaryLines: [
        `${input.requestedAction} 已提交审批，等待研究员确认后再调用 ${resolvedEnabledTool.toolName}。`,
        "审批通过前，不会向目标环境发起实际探测或验证。",
      ],
    })

    await prisma.approval.create({ data: fromApprovalRecord(approval) })
    // Reorder approvals
    const allApprovals = (await prisma.approval.findMany()).map(toApprovalRecord)
    const reordered = reorderApprovals(allApprovals)
    for (const item of reordered) {
      await prisma.approval.update({ where: { id: item.id }, data: { queuePosition: item.queuePosition } })
    }

    await prisma.mcpRun.create({ data: fromMcpRunRecord(pendingRun) })
    const pendingCount = reordered.filter((a) => a.projectId === projectId && a.status === "待处理").length
    await prisma.project.updateMany({
      where: { id: projectId },
      data: { status: "等待审批", pendingApprovals: pendingCount, lastActor: "MCP 网关 · 待审批" },
    })
    await pushActivityPrisma(
      `${input.requestedAction} 已进入审批`,
      `MCP 网关已为 ${resolvedEnabledTool.toolName} 创建审批单，等待人工确认后继续调度。`,
      "warning",
    )
    const auditLog = createAuditLog(`MCP 调度待审批：${project.name} -> ${input.requestedAction}`, "待审批", project.name)
    await prisma.auditLog.create({ data: fromLogRecord(auditLog) })
    await createStoredSchedulerTaskFromRun(pendingRun, enabledTool?.retry)

    const finalApproval = await prisma.approval.findUnique({ where: { id: approval.id } })
    return {
      run: pendingRun,
      approval: finalApproval ? toApprovalRecord(finalApproval) : approval,
    }
  }

  // Auto-execute path
  const executedRun = createRunRecord({
    input,
    project,
    tool: resolvedEnabledTool,
    status: "执行中",
    dispatchMode: "自动执行",
    summaryLines: [
      `${input.requestedAction} 已进入调度队列，准备调用 ${resolvedEnabledTool.toolName}。`,
      "调度器将按连接器策略执行并把结构化结果同步到项目结果与证据链路。",
    ],
  })

  await prisma.mcpRun.create({ data: fromMcpRunRecord(executedRun) })
  // Store LLM-generated code for execute_code/execute_command tools
  if (input.code && (resolvedEnabledTool.toolName === "execute_code" || resolvedEnabledTool.toolName === "execute_command")) {
    setLlmCodeForRun(executedRun.id, input.code)
  }
  await prisma.project.updateMany({
    where: { id: projectId },
    data: {
      status: project.status === "已完成" ? project.status : "运行中",
      lastActor: "MCP 网关 · 已执行",
    },
  })
  await pushActivityPrisma(
    `${input.requestedAction} 已执行`,
    `${resolvedEnabledTool.toolName} 已自动完成该动作，结果已写入项目上下文。`,
    "success",
  )
  const auditLog = createAuditLog(`MCP 已入调度：${project.name} -> ${input.requestedAction}`, "执行中", project.name)
  await prisma.auditLog.create({ data: fromLogRecord(auditLog) })
  await createStoredSchedulerTaskFromRun(executedRun, resolvedEnabledTool.retry)
  return { run: executedRun }
}

export async function syncStoredMcpRunsAfterApprovalDecision(approval: ApprovalRecord) {
  const linkedRun = await prisma.mcpRun.findFirst({ where: { linkedApprovalId: approval.id } })
  if (!linkedRun) return null

  const currentRun = toMcpRunRecord(linkedRun)
  const nextStatus: McpRunRecord["status"] =
    approval.status === "已批准" ? "执行中" : approval.status === "已延后" ? "已延后" : "已拒绝"
  const nextSummary =
    approval.status === "已批准"
      ? `审批已批准，${currentRun.toolName} 已回到调度队列等待执行。`
      : approval.status === "已延后"
        ? "审批已延后，MCP 调度继续停留在待窗口确认状态。"
        : "审批已拒绝，MCP 调度已终止，不再向目标继续推进。"

  const updated = await prisma.mcpRun.update({
    where: { id: linkedRun.id },
    data: {
      status: nextStatus,
      summaryLines: [...currentRun.summaryLines, nextSummary],
    },
  })
  const auditLog = createAuditLog(
    `审批联动更新 MCP 调度：${approval.id} -> ${nextStatus}`,
    nextStatus,
    approval.projectName,
  )
  await prisma.auditLog.create({ data: fromLogRecord(auditLog) })
  return toMcpRunRecord(updated)
}
