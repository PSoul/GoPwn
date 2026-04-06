"use client"

import { useEffect, useRef, useCallback, useState } from "react"

export type ProjectEvent = {
  type: string
  projectId: string
  timestamp: string
  data: Record<string, unknown>
}

export function useProjectEvents(
  projectId: string | null,
  onEvent?: (event: ProjectEvent) => void,
) {
  const [lastEvent, setLastEvent] = useState<ProjectEvent | null>(null)
  const [connected, setConnected] = useState(false)
  const esRef = useRef<EventSource | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!projectId) return

    function connect() {
      const es = new EventSource(`/api/projects/${projectId}/events`)
      esRef.current = es

      es.onopen = () => setConnected(true)

      es.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data) as ProjectEvent
          setLastEvent(event)
          onEventRef.current?.(event)
        } catch {
          // ignore parse errors
        }
      }

      es.onerror = () => {
        setConnected(false)
        es.close()
        reconnectTimer.current = setTimeout(connect, 3000)
      }
    }

    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      esRef.current?.close()
      esRef.current = null
    }
  }, [projectId])

  return { lastEvent, connected }
}
