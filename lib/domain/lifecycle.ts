import type { ProjectLifecycle } from "@/lib/generated/prisma"
import { InvalidTransitionError } from "./errors"

type LifecycleEvent =
  | "START"
  | "PLAN_READY"
  | "PLAN_FAILED"
  | "ALL_DONE"
  | "APPROVAL_NEEDED"
  | "RESOLVED"
  | "CONTINUE"
  | "SETTLE"
  | "SETTLED"
  | "FAILED"
  | "STOP"
  | "STOPPED"
  | "RETRY"
  | "START_REACT"
  | "CONTINUE_REACT"
  | "RETRY_REACT"

const TRANSITIONS: Record<string, Partial<Record<LifecycleEvent, ProjectLifecycle>>> = {
  idle:             { START: "planning", START_REACT: "executing" },
  planning:         { PLAN_READY: "executing", PLAN_FAILED: "failed", START_REACT: "executing", STOP: "stopping" },
  executing:        { ALL_DONE: "reviewing", APPROVAL_NEEDED: "waiting_approval", STOP: "stopping" },
  waiting_approval: { RESOLVED: "executing", STOP: "stopping" },
  reviewing:        { CONTINUE: "planning", CONTINUE_REACT: "executing", SETTLE: "settling", STOP: "stopping" },
  settling:         { SETTLED: "completed", FAILED: "failed" },
  stopping:         { STOPPED: "stopped" },
  completed:        {},
  stopped:          {},
  failed:           { RETRY: "planning", RETRY_REACT: "executing", STOP: "stopping" },
}

export function transition(current: ProjectLifecycle, event: LifecycleEvent): ProjectLifecycle {
  const next = TRANSITIONS[current]?.[event]
  if (!next) {
    throw new InvalidTransitionError(current, event)
  }
  return next
}

export function isTerminal(lifecycle: ProjectLifecycle): boolean {
  return lifecycle === "completed" || lifecycle === "stopped"
}

/** 项目已结束或正在收尾，不应再接受新的作业 */
export function isTerminalOrSettling(lifecycle: ProjectLifecycle): boolean {
  return lifecycle === "completed" || lifecycle === "stopped" || lifecycle === "settling" || lifecycle === "stopping"
}

export function isActive(lifecycle: ProjectLifecycle): boolean {
  return !isTerminal(lifecycle) && lifecycle !== "idle" && lifecycle !== "failed"
}
