/**
 * project-event-bus.ts — 进程内事件总线，按 projectId 分发 SSE 事件
 *
 * 所有发射操作 catch 吞掉异常，不影响主流程。
 * 订阅者通过 subscribe(projectId, callback) 注册，返回 unsubscribe 函数。
 */
import { EventEmitter } from "events"

export type ProjectEventType =
  | "progress"
  | "asset_discovered"
  | "vuln_found"
  | "tool_started"
  | "tool_completed"
  | "approval_needed"
  | "approval_resolved"
  | "round_completed"
  | "project_completed"
  | "stats_updated"

export interface ProjectEvent {
  type: ProjectEventType
  projectId: string
  timestamp: string
  data: Record<string, unknown>
}

const emitter = new EventEmitter()
emitter.setMaxListeners(200)

function channelKey(projectId: string) {
  return `project:${projectId}`
}

export function emitProjectEvent(projectId: string, type: ProjectEventType, data: Record<string, unknown> = {}) {
  try {
    const event: ProjectEvent = {
      type,
      projectId,
      timestamp: new Date().toISOString(),
      data,
    }
    emitter.emit(channelKey(projectId), event)
  } catch {
    // swallow — event emission must never break the main flow
  }
}

export type ProjectEventListener = (event: ProjectEvent) => void

export function subscribeProjectEvents(projectId: string, listener: ProjectEventListener): () => void {
  const key = channelKey(projectId)
  emitter.on(key, listener)
  return () => {
    emitter.off(key, listener)
  }
}

export function getProjectSubscriberCount(projectId: string): number {
  return emitter.listenerCount(channelKey(projectId))
}
