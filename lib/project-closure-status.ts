import type {
  ProjectClosureBlockerRecord,
  ProjectClosureState,
  ProjectClosureStatusRecord,
  ProjectSchedulerLifecycle,
  ProjectStatus,
  Tone,
} from "@/lib/prototype-types"

type BuildProjectClosureStatusInput = {
  finalConclusionGenerated: boolean
  lifecycle: ProjectSchedulerLifecycle
  pendingApprovals: number
  projectStatus: ProjectStatus
  queuedTaskCount: number
  reportExported: boolean
  runningTaskCount: number
  waitingApprovalTaskCount: number
}

const stateLabelMap: Record<ProjectClosureState, string> = {
  waiting_start: "等待手动开始",
  running: "运行中",
  blocked: "存在收束阻塞",
  settling: "等待自动收束",
  completed: "已完成当前轮次",
  stopped: "已停止",
}

const stateToneMap: Record<ProjectClosureState, Tone> = {
  waiting_start: "warning",
  running: "info",
  blocked: "danger",
  settling: "info",
  completed: "success",
  stopped: "neutral",
}

function buildStateRecord(
  state: ProjectClosureState,
  summary: string,
  blockers: ProjectClosureBlockerRecord[],
  input: BuildProjectClosureStatusInput,
): ProjectClosureStatusRecord {
  return {
    state,
    label: stateLabelMap[state],
    tone: stateToneMap[state],
    summary,
    blockers,
    reportExported: input.reportExported,
    finalConclusionGenerated: input.finalConclusionGenerated,
  }
}

export function buildProjectClosureStatus(input: BuildProjectClosureStatusInput): ProjectClosureStatusRecord {
  if (input.projectStatus === "已停止" || input.lifecycle === "stopped") {
    return buildStateRecord(
      "stopped",
      "项目已经被研究员停止，当前不会再继续派发新的 LLM 编排或 MCP 调度动作。",
      [
        {
          title: "项目已进入终止态",
          detail: "如需继续测试，请新建下一轮项目，而不是在当前项目上恢复执行。",
          tone: "neutral",
        },
      ],
      input,
    )
  }

  if (
    input.finalConclusionGenerated ||
    (input.projectStatus === "已完成" &&
      input.pendingApprovals === 0 &&
      input.waitingApprovalTaskCount === 0 &&
      input.runningTaskCount === 0 &&
      input.queuedTaskCount === 0)
  ) {
    return buildStateRecord(
      "completed",
      input.finalConclusionGenerated
        ? "当前轮次已经自动收束，报告与最终结论都已稳定落库。"
        : "项目已经处于终态，当前不再继续派发新的调度动作。",
      [],
      input,
    )
  }

  if (input.projectStatus === "待处理" || input.lifecycle === "idle") {
    return buildStateRecord(
      "waiting_start",
      "项目还没有手动开始，LLM 与调度器尚未接管目标。",
      [
        {
          title: "等待研究员开始项目",
          detail: "只有点击开始后，系统才会把目标发送给 LLM 生成首轮计划并进入调度。",
          tone: "warning",
        },
      ],
      input,
    )
  }

  const blockers: ProjectClosureBlockerRecord[] = []
  const paused = input.projectStatus === "已暂停" || input.lifecycle === "paused"
  const hasApprovalBlocker = input.pendingApprovals > 0 || input.waitingApprovalTaskCount > 0

  if (paused) {
    blockers.push({
      title: "项目当前已暂停",
      detail: "暂停期间不会继续认领队列，也不会继续向 LLM 请求下一轮动作。",
      tone: "warning",
    })
  }

  if (hasApprovalBlocker) {
    blockers.push({
      title: "待审批动作尚未清理",
      detail: `当前仍有 ${Math.max(input.pendingApprovals, input.waitingApprovalTaskCount)} 个审批阻塞项，清理后才能继续自动收束。`,
      tone: "danger",
    })
  }

  if (input.runningTaskCount > 0) {
    blockers.push({
      title: "仍有任务正在执行",
      detail: `当前有 ${input.runningTaskCount} 个运行中的任务，项目会在这些动作完成后继续判断是否可以收束。`,
      tone: "info",
    })
  }

  if (input.queuedTaskCount > 0) {
    blockers.push({
      title: "队列中仍有待运行任务",
      detail: `当前仍有 ${input.queuedTaskCount} 个排队中的任务，队列跑空前不会进入报告导出与最终结论。`,
      tone: "info",
    })
  }

  if (paused || hasApprovalBlocker) {
    return buildStateRecord(
      "blocked",
      paused
        ? "项目当前已被人工暂停，恢复运行后系统才会继续自动收束。"
        : "项目当前仍存在审批阻塞，相关动作清理后才会继续自动收束。",
      blockers,
      input,
    )
  }

  if (input.runningTaskCount > 0 || input.queuedTaskCount > 0) {
    return buildStateRecord(
      "running",
      "当前仍有任务在执行或排队，项目会在队列跑空后再进入自动收束。",
      blockers,
      input,
    )
  }

  if (!input.reportExported) {
    return buildStateRecord(
      "settling",
      "队列已经跑空，系统正在等待报告导出，以便进入最终结论阶段。",
      [
        {
          title: "等待报告导出",
          detail: "报告导出完成后，系统才会继续生成并持久化本轮最终结论。",
          tone: "info",
        },
      ],
      input,
    )
  }

  return buildStateRecord(
    "settling",
    "报告已经导出，系统正在等待最终结论生成并把项目收束到完成态。",
    [
      {
        title: "等待最终结论生成",
        detail: "当前报告已经可读，但还需要把资产、证据和发现汇总成项目级结论。",
        tone: "info",
      },
    ],
    input,
  )
}
