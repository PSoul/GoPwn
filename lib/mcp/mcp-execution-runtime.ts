const activeExecutionControllers = new Map<string, AbortController>()

export function registerActiveExecution(runId: string, controller: AbortController) {
  const priorController = activeExecutionControllers.get(runId)

  if (priorController && priorController !== controller && !priorController.signal.aborted) {
    priorController.abort("Superseded by a newer active execution controller.")
  }

  activeExecutionControllers.set(runId, controller)
}

export function abortActiveExecution(runId: string, reason = "Execution aborted.") {
  const controller = activeExecutionControllers.get(runId)

  if (!controller || controller.signal.aborted) {
    return false
  }

  controller.abort(reason)
  return true
}

export function unregisterActiveExecution(runId: string, controller?: AbortController) {
  const currentController = activeExecutionControllers.get(runId)

  if (!currentController) {
    return false
  }

  if (controller && currentController !== controller) {
    return false
  }

  activeExecutionControllers.delete(runId)
  return true
}

export function abortAllActiveExecutions(reason = "All active executions aborted.") {
  for (const [, controller] of activeExecutionControllers) {
    if (!controller.signal.aborted) {
      controller.abort(reason)
    }
  }
  activeExecutionControllers.clear()
}

export function resetActiveExecutionRegistry() {
  activeExecutionControllers.clear()
}
