import {
  systemControlOverview,
} from "@/lib/platform-config"
import {
  getStoredGlobalApprovalControl,
  listStoredApprovalPolicies,
  listStoredScopeRules,
  updateStoredApprovalDecision,
} from "@/lib/approval-repository"
import { listStoredMcpRuns } from "@/lib/mcp-gateway-repository"
import {
  runProjectLifecycleKickoff,
} from "@/lib/orchestrator-service"
import {
  drainStoredSchedulerTasks,
  syncStoredSchedulerTaskAfterApprovalDecision,
} from "@/lib/mcp-scheduler-service"
import {
  getStoredProjectSchedulerControl,
  stopStoredProjectSchedulerTasks,
  updateStoredProjectSchedulerControl,
} from "@/lib/project-scheduler-control-repository"
import {
  getStoredProjectById,
  getStoredProjectDetailById,
} from "@/lib/project-repository"
import type {
  ApprovalDecisionInput,
  ApprovalPolicyPayload,
} from "@/lib/prototype-types"

// ──────────────────────────────────────────────
// Exported
// ──────────────────────────────────────────────

export async function updateApprovalDecisionPayload(approvalId: string, input: ApprovalDecisionInput) {
  const approval = await updateStoredApprovalDecision(approvalId, input)

  if (!approval) {
    return approval
  }

  await syncStoredSchedulerTaskAfterApprovalDecision(approval)

  if (approval.status === "已批准") {
    const linkedRunId = (await listStoredMcpRuns()).find((item) => item.linkedApprovalId === approval.id)?.id

    if (linkedRunId) {
      await drainStoredSchedulerTasks({
        runId: linkedRunId,
        ignoreProjectLifecycle: true,
      })
    }

    const schedulerControl = await getStoredProjectSchedulerControl(approval.projectId)

    if (schedulerControl?.lifecycle === "running") {
      await runProjectLifecycleKickoff(approval.projectId, {
        controlCommand: "resume",
        note: "审批通过后，继续根据当前结果推进项目后续动作并判断是否可以收束。",
      })
    }
  }

  return approval
}

export async function updateProjectSchedulerControlPayload(
  projectId: string,
  patch: Parameters<typeof updateStoredProjectSchedulerControl>[1],
) {
  const payload = await updateStoredProjectSchedulerControl(projectId, patch)

  if (!payload) {
    return null
  }

  if ("status" in payload && typeof payload.status === "number" && "error" in payload) {
    return payload
  }

  if (!('transition' in payload)) {
    return payload
  }

  if (payload.transition.changedLifecycle) {
    if (payload.transition.nextLifecycle === "running") {
      await runProjectLifecycleKickoff(projectId, {
        controlCommand: payload.transition.previousLifecycle === "paused" ? "resume" : "start",
        note: payload.schedulerControl.note,
      })
    }

    if (payload.transition.nextLifecycle === "stopped") {
      await stopStoredProjectSchedulerTasks(projectId, payload.schedulerControl.note)
    }
  }

  const refreshedProject = await getStoredProjectById(projectId)
  const refreshedDetail = await getStoredProjectDetailById(projectId)
  const refreshedControl = await getStoredProjectSchedulerControl(projectId)

  if (!refreshedProject || !refreshedDetail || !refreshedControl) {
    return payload
  }

  return {
    detail: refreshedDetail,
    project: refreshedProject,
    schedulerControl: refreshedControl,
    transition: payload.transition,
  }
}

export async function getApprovalPolicyPayload(): Promise<ApprovalPolicyPayload> {
  const approvalControl = await getStoredGlobalApprovalControl()

  return {
    overview: systemControlOverview.map((item, index) =>
      index === 3
        ? {
            ...item,
            value: approvalControl.enabled ? "审批链路已开启" : "审批链路已关闭",
            description: approvalControl.note,
          }
        : item,
    ),
    approvalControl,
    approvalPolicies: await listStoredApprovalPolicies(),
    scopeRules: await listStoredScopeRules(),
  }
}
