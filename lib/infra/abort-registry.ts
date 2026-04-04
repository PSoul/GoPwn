/**
 * Global abort registry — allows stopping in-flight LLM calls per project.
 * Workers register their AbortController before starting LLM calls.
 * The stop endpoint aborts all controllers for a given project.
 */

const controllers = new Map<string, Set<AbortController>>()

export function registerAbort(projectId: string, controller: AbortController): void {
  if (!controllers.has(projectId)) {
    controllers.set(projectId, new Set())
  }
  controllers.get(projectId)!.add(controller)
}

export function unregisterAbort(projectId: string, controller: AbortController): void {
  controllers.get(projectId)?.delete(controller)
}

export function abortAllForProject(projectId: string): void {
  const set = controllers.get(projectId)
  if (!set) return
  for (const controller of set) {
    controller.abort()
  }
  set.clear()
  controllers.delete(projectId)
}
