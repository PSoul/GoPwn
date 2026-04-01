import type {
  ProjectSchedulerControl,
  ProjectSchedulerLifecycle,
  ProjectStatus,
} from "@/lib/prototype-types"

function getLifecycleNote(lifecycle: ProjectSchedulerLifecycle) {
  switch (lifecycle) {
    case "idle":
      return "等待启动后交给 LLM 规划与执行控制。"
    case "running":
      return "项目正在运行，LLM 会继续规划低风险动作并驱动 MCP 调度。"
    case "paused":
      return "项目已暂停，平台不会继续推进新的 AI 规划或任务认领。"
    case "stopped":
      return "项目已停止，后续不会再重新开始。"
  }
}

export function buildDefaultProjectSchedulerControl(
  updatedAt: string,
  lifecycle: ProjectSchedulerLifecycle = "idle",
): ProjectSchedulerControl {
  return {
    lifecycle,
    paused: lifecycle === "paused" || lifecycle === "stopped",
    autoReplan: true,
    maxRounds: 5,
    currentRound: 0,
    note: getLifecycleNote(lifecycle),
    updatedAt,
  }
}

export function inferProjectSchedulerLifecycle(input: {
  control?: Partial<ProjectSchedulerControl> | null
  projectStatus: ProjectStatus
}): ProjectSchedulerLifecycle {
  if (input.control?.lifecycle) {
    return input.control.lifecycle
  }

  if (input.projectStatus === "已停止" || input.projectStatus === "已完成") {
    return "stopped"
  }

  if (input.projectStatus === "已暂停" || input.control?.paused) {
    return "paused"
  }

  if (input.projectStatus === "运行中" || input.projectStatus === "等待审批") {
    return "running"
  }

  return "idle"
}

export function normalizeProjectSchedulerControl(input: {
  control?: Partial<ProjectSchedulerControl> | null
  projectStatus: ProjectStatus
  updatedAt: string
}): ProjectSchedulerControl {
  const lifecycle = inferProjectSchedulerLifecycle(input)
  const base = buildDefaultProjectSchedulerControl(input.updatedAt, lifecycle)

  return {
    ...base,
    ...input.control,
    lifecycle,
    paused:
      typeof input.control?.paused === "boolean"
        ? lifecycle === "running"
          ? input.control.paused
          : lifecycle === "paused" || lifecycle === "stopped"
        : base.paused,
    autoReplan: typeof input.control?.autoReplan === "boolean" ? input.control.autoReplan : base.autoReplan,
    maxRounds: typeof input.control?.maxRounds === "number" ? input.control.maxRounds : base.maxRounds,
    currentRound: typeof input.control?.currentRound === "number" ? input.control.currentRound : base.currentRound,
    note: input.control?.note?.trim() || base.note,
    updatedAt: input.control?.updatedAt ?? input.updatedAt,
  }
}

export function isProjectSchedulerRunning(control: ProjectSchedulerControl | null | undefined) {
  return Boolean(control && control.lifecycle === "running" && control.paused === false)
}
