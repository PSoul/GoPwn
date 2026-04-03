function resolveAbortMessage(reason: unknown) {
  if (typeof reason === "string" && reason.trim()) {
    return reason
  }

  if (reason instanceof Error && reason.message.trim()) {
    return reason.message
  }

  return "Execution aborted."
}

export function createExecutionAbortError(reason?: unknown) {
  const error = new Error(resolveAbortMessage(reason))
  error.name = "AbortError"
  return error
}

export function isExecutionAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError"
}

export function throwIfExecutionAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createExecutionAbortError(signal.reason)
  }
}

export function bindAbortListener(signal: AbortSignal | undefined, listener: () => void) {
  if (!signal) {
    return () => undefined
  }

  if (signal.aborted) {
    listener()
    return () => undefined
  }

  signal.addEventListener("abort", listener, { once: true })

  return () => {
    signal.removeEventListener("abort", listener)
  }
}

export async function withAbortSignal<T>(
  promiseFactory: () => Promise<T>,
  input: {
    signal?: AbortSignal
    onAbort?: () => void | Promise<void>
  } = {},
) {
  const { signal, onAbort } = input

  throwIfExecutionAborted(signal)

  if (!signal) {
    return promiseFactory()
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false

    const cleanup = bindAbortListener(signal, () => {
      if (settled) {
        return
      }

      settled = true
      void Promise.resolve(onAbort?.()).finally(() => {
        reject(createExecutionAbortError(signal.reason))
      })
    })

    void promiseFactory().then(
      (value) => {
        if (settled) {
          return
        }

        settled = true
        cleanup()
        resolve(value)
      },
      (error) => {
        if (settled) {
          return
        }

        settled = true
        cleanup()
        reject(error)
      },
    )
  })
}
