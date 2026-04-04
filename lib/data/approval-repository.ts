import { syncStoredMcpRunsAfterApprovalDecision } from "@/lib/mcp/mcp-gateway-repository"
import { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/infra/prisma"
import {
  toApprovalRecord,
  toApprovalControlRecord,
  fromApprovalControlRecord,
  toPolicyRecord,
  toDbTimestamp,
  fromLogRecord,
} from "@/lib/infra/prisma-transforms"
import type {
  ApprovalControl,
  ApprovalControlPatch,
  ApprovalDecisionInput,
  ApprovalRecord,
  ProjectKnowledgeItem,
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

function buildApprovalMode(enabled: boolean, autoApproveLowRisk: boolean) {
  if (!enabled) {
    return "审批关闭，保留审计与速率限制"
  }

  return autoApproveLowRisk ? "高风险审批，低风险自动通过" : "中高风险动作审批"
}

function buildGlobalApprovalDescription(enabled: boolean, autoApproveLowRisk: boolean) {
  if (!enabled) {
    return "审批闸门已临时关闭，平台将继续保留审计、速率限制和紧急停止能力。"
  }

  return autoApproveLowRisk
    ? "大部分 MCP 调用直接执行并写入审计，只有高风险验证和敏感探测动作进入人工审批。"
    : "中高风险 MCP 动作默认进入人工审批，只有低风险被动采集与轻量识别会直接执行。"
}

function buildProjectApprovalDescription(enabled: boolean, autoApproveLowRisk: boolean) {
  if (!enabled) {
    return "当前项目已关闭审批闸门，仅保留审计、速率限制和人工接管能力。"
  }

  return autoApproveLowRisk
    ? "项目保留高风险审批，低风险采集、被动识别和常规日志刷新默认放行。"
    : "项目当前对中高风险动作都要求人工确认，适合结果面已复杂、需要更稳妥推进的阶段。"
}

function createAuditLog(summary: string, actor: string, status: string, projectName?: string) {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    category: "审批与策略",
    summary,
    projectName,
    actor,
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

export async function listStoredApprovals() {
  const rows = await prisma.approval.findMany({ orderBy: { submittedAt: "desc" } })
  return rows.map(toApprovalRecord)
}

export async function getStoredApprovalById(approvalId: string) {
  const row = await prisma.approval.findUnique({ where: { id: approvalId } })
  return row ? toApprovalRecord(row) : null
}

export async function listStoredProjectApprovals(projectId: string) {
  const rows = await prisma.approval.findMany({
    where: { projectId },
    orderBy: { submittedAt: "desc" },
  })
  return rows.map(toApprovalRecord)
}

export async function getStoredGlobalApprovalControl() {
  const row = await prisma.globalApprovalControl.findUnique({ where: { id: "global" } })
  if (row) return toApprovalControlRecord(row)
  // Return sensible default if no row yet
  return {
    enabled: true,
    mode: "高风险需审批",
    autoApproveLowRisk: true,
    autoApproveMediumRisk: true,
    description: "大部分 MCP 调用直接执行并写入审计，只有高风险验证和敏感探测动作进入人工审批。",
    note: "",
  } satisfies ApprovalControl
}

export async function listStoredApprovalPolicies() {
  const rows = await prisma.approvalPolicy.findMany()
  return rows.map(toPolicyRecord)
}

export async function listStoredScopeRules() {
  const rows = await prisma.scopeRule.findMany()
  return rows.map(toPolicyRecord)
}

export async function updateStoredApprovalDecision(approvalId: string, input: ApprovalDecisionInput) {
  const existing = await prisma.approval.findUnique({ where: { id: approvalId } })
  if (!existing) return null

  const currentApproval = toApprovalRecord(existing)
  const now = formatTimestamp()
  const nextSubmittedAt = `${currentApproval.submittedAt} · 已处理 ${now.slice(11)}`

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update the approval status
    const updatedRow = await tx.approval.update({
      where: { id: approvalId },
      data: {
        status: input.decision,
        submittedAt: toDbTimestamp(nextSubmittedAt),
      },
    })
    const nextApproval = toApprovalRecord(updatedRow)

    // 2. Reorder remaining approvals (recalculate queuePosition)
    const allApprovals = (await tx.approval.findMany()).map(toApprovalRecord)
    const reordered = reorderApprovals(allApprovals)
    for (const item of reordered) {
      await tx.approval.update({
        where: { id: item.id },
        data: { queuePosition: item.queuePosition },
      })
    }

    // 3. Update project.pendingApprovals count
    const pendingCount = reordered.filter(
      (a) => a.projectId === nextApproval.projectId && a.status === "待处理",
    ).length
    await tx.project.update({
      where: { id: nextApproval.projectId },
      data: {
        pendingApprovals: pendingCount,
        lastActor: `审批中心 · ${input.decision}`,
      },
    })

    // 4. Push activity to projectDetail
    const detail = await tx.projectDetail.findUnique({
      where: { projectId: nextApproval.projectId },
    })
    if (detail) {
      const tone: "success" | "warning" | "danger" =
        input.decision === "已批准" ? "success" : input.decision === "已延后" ? "warning" : "danger"
      const detailText =
        input.decision === "已批准"
          ? `${nextApproval.actionType} 已批准，可按当前项目策略恢复受控调度。`
          : input.decision === "已延后"
            ? `${nextApproval.actionType} 已延后，等待更合适的时间窗口或前置条件满足。`
            : `${nextApproval.actionType} 已拒绝，当前主路径需要重新规划验证方式。`
      const currentActivity = (detail.activity ?? []) as unknown as ProjectKnowledgeItem[]
      const newActivity = [
        { title: `${nextApproval.id} ${input.decision}`, detail: detailText, meta: "审批中心", tone },
        ...currentActivity,
      ].slice(0, 8)
      const currentStage = (detail.currentStage ?? {}) as Record<string, unknown>
      await tx.projectDetail.update({
        where: { projectId: nextApproval.projectId },
        data: {
          activity: newActivity as unknown as Prisma.InputJsonArray,
          currentStage: { ...currentStage, updatedAt: now } as unknown as Prisma.InputJsonObject,
        },
      })
    }

    // 5. Create audit log
    const auditLog = createAuditLog(
      `审批单 ${nextApproval.id} ${input.decision}`,
      "审批中心",
      input.decision,
      nextApproval.projectName,
    )
    await tx.auditLog.create({ data: fromLogRecord(auditLog) })

    return nextApproval
  })

  // 6. Sync MCP runs (outside transaction — it manages its own writes) with retry
  let syncAttempt = 0
  while (syncAttempt < 2) {
    try {
      await syncStoredMcpRunsAfterApprovalDecision(result)
      break
    } catch (error) {
      syncAttempt++
      if (syncAttempt >= 2) {
        console.error(`[approval] syncStoredMcpRunsAfterApprovalDecision failed after retry:`, error)
      }
    }
  }
  // Re-read the approval to get the latest queuePosition
  const final = await prisma.approval.findUnique({ where: { id: approvalId } })
  return final ? toApprovalRecord(final) : result
}

export async function updateStoredGlobalApprovalControl(patch: ApprovalControlPatch) {
  const current = await getStoredGlobalApprovalControl()
  const enabled = patch.enabled ?? current.enabled
  const autoApproveLowRisk = patch.autoApproveLowRisk ?? current.autoApproveLowRisk
  const autoApproveMediumRisk = patch.autoApproveMediumRisk ?? current.autoApproveMediumRisk
  const nextControl: ApprovalControl = {
    ...current,
    enabled,
    autoApproveLowRisk,
    autoApproveMediumRisk,
    mode: buildApprovalMode(enabled, autoApproveLowRisk),
    description: buildGlobalApprovalDescription(enabled, autoApproveLowRisk),
    note: patch.note ?? current.note,
  }
  await prisma.globalApprovalControl.upsert({
    where: { id: "global" },
    create: { id: "global", ...fromApprovalControlRecord(nextControl) },
    update: fromApprovalControlRecord(nextControl),
  })
  const auditLog = createAuditLog(
    `更新全局审批策略：${nextControl.mode}`,
    "系统设置",
    enabled ? "已生效" : "已关闭",
  )
  await prisma.auditLog.create({ data: fromLogRecord(auditLog) })
  return nextControl
}

export async function updateStoredProjectApprovalControl(projectId: string, patch: ApprovalControlPatch) {
  const [project, detail] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.projectDetail.findUnique({ where: { projectId } }),
  ])
  if (!project || !detail) return null

  const currentControl = (detail.approvalControl ?? {}) as unknown as ApprovalControl
  const enabled = patch.enabled ?? currentControl.enabled
  const autoApproveLowRisk = patch.autoApproveLowRisk ?? currentControl.autoApproveLowRisk
  const autoApproveMediumRisk = patch.autoApproveMediumRisk ?? currentControl.autoApproveMediumRisk
  const nextMode = buildApprovalMode(enabled, autoApproveLowRisk)
  const nextNote = patch.note ?? currentControl.note
  const now = formatTimestamp()
  const nextApprovalControl = {
    ...currentControl,
    enabled,
    autoApproveLowRisk,
    autoApproveMediumRisk,
    mode: nextMode,
    description: buildProjectApprovalDescription(enabled, autoApproveLowRisk),
    note: nextNote,
  }
  const currentStage = (detail.currentStage ?? {}) as Record<string, unknown>

  const [updatedProject, updatedDetail] = await Promise.all([
    prisma.project.update({
      where: { id: projectId },
      data: { lastActor: "项目审批策略调整" },
    }),
    prisma.projectDetail.update({
      where: { projectId },
      data: {
        approvalControl: nextApprovalControl as unknown as Prisma.InputJsonObject,
        currentStage: { ...currentStage, updatedAt: now } as unknown as Prisma.InputJsonObject,
      },
    }),
  ])

  const auditLog = createAuditLog(
    `更新项目审批策略：${project.name} -> ${nextMode}`,
    "项目设置",
    enabled ? "已生效" : "已关闭",
    project.name,
  )
  await prisma.auditLog.create({ data: fromLogRecord(auditLog) })

  // Import transforms inline to avoid circular dependencies
  const { toProjectRecord, toProjectDetailRecord } = await import("@/lib/infra/prisma-transforms")
  return {
    project: toProjectRecord(updatedProject),
    detail: toProjectDetailRecord(updatedDetail),
  }
}
