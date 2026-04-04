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

  const connect = useCallback(() => {
    if (!projectId) return

    const es = new EventSource(`/api/projects/${projectId}/events`)
    esRef.current = es

    es.onopen = () => setConnected(true)

    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as ProjectEvent
        setLastEvent(event)
        onEvent?.(event)
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => {
      setConnected(false)
      es.close()
      // Reconnect after 3s
      setTimeout(connect, 3000)
    }
  }, [projectId, onEvent])

  useEffect(() => {
    connect()
    return () => {
      esRef.current?.close()
      esRef.current = null
    }
  }, [connect])

  return { lastEvent, connected }
}
