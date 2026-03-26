import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import type {
  ApprovalControl,
  ApprovalControlPatch,
  ApprovalDecisionInput,
  ApprovalRecord,
  ProjectDetailRecord,
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
    ? "项目保留高风险审批，低风险补采、被动识别和常规日志刷新默认放行。"
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

function updateProjectApprovalCounts(approvals: ApprovalRecord[]) {
  const countByProjectId = approvals.reduce<Record<string, number>>((accumulator, approval) => {
    if (approval.status === "待处理") {
      accumulator[approval.projectId] = (accumulator[approval.projectId] ?? 0) + 1
    }

    return accumulator
  }, {})

  return countByProjectId
}

function pushProjectActivity(detail: ProjectDetailRecord, title: string, detailText: string, tone: "success" | "warning" | "danger") {
  return {
    ...detail,
    activity: [
      {
        title,
        detail: detailText,
        meta: "审批中心",
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

export function listStoredApprovals() {
  return readPrototypeStore().approvals
}

export function getStoredApprovalById(approvalId: string) {
  return readPrototypeStore().approvals.find((approval) => approval.id === approvalId) ?? null
}

export function listStoredProjectApprovals(projectId: string) {
  return readPrototypeStore().approvals.filter((approval) => approval.projectId === projectId)
}

export function getStoredGlobalApprovalControl() {
  return readPrototypeStore().globalApprovalControl
}

export function listStoredApprovalPolicies() {
  return readPrototypeStore().approvalPolicies
}

export function listStoredScopeRules() {
  return readPrototypeStore().scopeRules
}

export function updateStoredApprovalDecision(approvalId: string, input: ApprovalDecisionInput) {
  const store = readPrototypeStore()
  const approvalIndex = store.approvals.findIndex((approval) => approval.id === approvalId)

  if (approvalIndex < 0) {
    return null
  }

  const currentApproval = store.approvals[approvalIndex]
  const nextApproval = {
    ...currentApproval,
    status: input.decision,
    submittedAt: `${currentApproval.submittedAt} · 已处理 ${formatTimestamp().slice(11)}`,
  }

  store.approvals = reorderApprovals(
    store.approvals.map((approval, index) => (index === approvalIndex ? nextApproval : approval)),
  )

  const pendingCountByProjectId = updateProjectApprovalCounts(store.approvals)
  store.projects = store.projects.map((project) =>
    project.id === nextApproval.projectId
      ? {
          ...project,
          pendingApprovals: pendingCountByProjectId[project.id] ?? 0,
          lastUpdated: formatTimestamp(),
          lastActor: `审批中心 · ${input.decision}`,
        }
      : project,
  )

  const detailIndex = store.projectDetails.findIndex((detail) => detail.projectId === nextApproval.projectId)

  if (detailIndex >= 0) {
    const tone =
      input.decision === "已批准" ? "success" : input.decision === "已延后" ? "warning" : "danger"
    const detailText =
      input.decision === "已批准"
        ? `${nextApproval.actionType} 已批准，可按当前项目策略恢复受控调度。`
        : input.decision === "已延后"
          ? `${nextApproval.actionType} 已延后，等待更合适的时间窗口或前置条件满足。`
          : `${nextApproval.actionType} 已拒绝，当前主路径需要重新规划验证方式。`

    store.projectDetails[detailIndex] = pushProjectActivity(
      store.projectDetails[detailIndex],
      `${nextApproval.id} ${input.decision}`,
      detailText,
      tone,
    )
  }

  store.auditLogs.unshift(
    createAuditLog(
      `审批单 ${nextApproval.id} ${input.decision}`,
      "审批中心",
      input.decision,
      nextApproval.projectName,
    ),
  )
  writePrototypeStore(store)

  return store.approvals.find((approval) => approval.id === approvalId) ?? nextApproval
}

export function updateStoredGlobalApprovalControl(patch: ApprovalControlPatch) {
  const store = readPrototypeStore()
  const current = store.globalApprovalControl
  const enabled = patch.enabled ?? current.enabled
  const autoApproveLowRisk = patch.autoApproveLowRisk ?? current.autoApproveLowRisk
  const nextControl: ApprovalControl = {
    ...current,
    enabled,
    autoApproveLowRisk,
    mode: buildApprovalMode(enabled, autoApproveLowRisk),
    description: buildGlobalApprovalDescription(enabled, autoApproveLowRisk),
    note: patch.note ?? current.note,
  }

  store.globalApprovalControl = nextControl
  store.auditLogs.unshift(
    createAuditLog(
      `更新全局审批策略：${nextControl.mode}`,
      "系统设置",
      enabled ? "已生效" : "已关闭",
    ),
  )
  writePrototypeStore(store)

  return nextControl
}

export function updateStoredProjectApprovalControl(projectId: string, patch: ApprovalControlPatch) {
  const store = readPrototypeStore()
  const projectIndex = store.projects.findIndex((project) => project.id === projectId)
  const detailIndex = store.projectDetails.findIndex((detail) => detail.projectId === projectId)

  if (projectIndex < 0 || detailIndex < 0) {
    return null
  }

  const currentControl = store.projectDetails[detailIndex].approvalControl
  const enabled = patch.enabled ?? currentControl.enabled
  const autoApproveLowRisk = patch.autoApproveLowRisk ?? currentControl.autoApproveLowRisk
  const nextMode = buildApprovalMode(enabled, autoApproveLowRisk)
  const nextNote = patch.note ?? currentControl.note

  store.projectDetails[detailIndex] = {
    ...store.projectDetails[detailIndex],
    approvalControl: {
      ...currentControl,
      enabled,
      autoApproveLowRisk,
      mode: nextMode,
      description: buildProjectApprovalDescription(enabled, autoApproveLowRisk),
      note: nextNote,
    },
    currentStage: {
      ...store.projectDetails[detailIndex].currentStage,
      updatedAt: formatTimestamp(),
    },
  }

  store.projects[projectIndex] = {
    ...store.projects[projectIndex],
    approvalMode: nextMode,
    lastUpdated: formatTimestamp(),
    lastActor: "项目审批策略调整",
  }

  store.auditLogs.unshift(
    createAuditLog(
      `更新项目审批策略：${store.projects[projectIndex].name} -> ${nextMode}`,
      "项目设置",
      enabled ? "已生效" : "已关闭",
      store.projects[projectIndex].name,
    ),
  )
  writePrototypeStore(store)

  return {
    project: store.projects[projectIndex],
    detail: store.projectDetails[detailIndex],
  }
}
