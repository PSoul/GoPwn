"use client"

import { useEffect, useReducer, useCallback, useRef } from "react"
import type { ProjectEventType } from "@/lib/infra/project-event-bus"

interface ProjectEventData {
  type: ProjectEventType
  projectId: string
  timestamp: string
  data: Record<string, unknown>
}

export interface ProjectLiveState {
  connected: boolean
  assetCount: number
  vulnCount: number
  highCount: number
  currentRound: number
  status: string
  pendingApprovals: number
  logs: Array<{ type: string; message: string; timestamp: string }>
}

type Action =
  | { type: "connected" }
  | { type: "disconnected" }
  | { type: "event"; event: ProjectEventData }
  | { type: "reset" }

const MAX_LOGS = 50

function reducer(state: ProjectLiveState, action: Action): ProjectLiveState {
  switch (action.type) {
    case "connected":
      return { ...state, connected: true }
    case "disconnected":
      return { ...state, connected: false }
    case "reset":
      return { ...initialState }
    case "event": {
      const { event } = action
      const log = {
        type: event.type,
        message: (event.data.message as string) ?? event.type,
        timestamp: event.timestamp,
      }
      const logs = [log, ...state.logs].slice(0, MAX_LOGS)

      switch (event.type) {
        case "asset_discovered":
          return {
            ...state,
            assetCount: (event.data.totalAssets as number) ?? state.assetCount + 1,
            logs,
          }
        case "vuln_found":
          return {
            ...state,
            vulnCount: (event.data.totalVulns as number) ?? state.vulnCount + 1,
            highCount: (event.data.totalHigh as number) ?? state.highCount,
            logs,
          }
        case "stats_updated":
          return {
            ...state,
            assetCount: (event.data.assetCount as number) ?? state.assetCount,
            vulnCount: (event.data.vulnCount as number) ?? state.vulnCount,
            highCount: (event.data.highCount as number) ?? state.highCount,
            pendingApprovals: (event.data.pendingApprovals as number) ?? state.pendingApprovals,
            logs,
          }
        case "approval_needed":
          return { ...state, pendingApprovals: state.pendingApprovals + 1, logs }
        case "approval_resolved":
          return { ...state, pendingApprovals: Math.max(0, state.pendingApprovals - 1), logs }
        case "round_completed":
          return {
            ...state,
            currentRound: (event.data.round as number) ?? state.currentRound + 1,
            logs,
          }
        case "project_completed":
          return { ...state, status: "已完成", logs }
        case "progress":
          return {
            ...state,
            status: (event.data.status as string) ?? state.status,
            logs,
          }
        default:
          return { ...state, logs }
      }
    }
  }
}

const initialState: ProjectLiveState = {
  connected: false,
  assetCount: 0,
  vulnCount: 0,
  highCount: 0,
  currentRound: 0,
  status: "",
  pendingApprovals: 0,
  logs: [],
}

export function useProjectEvents(projectId: string | null) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const esRef = useRef<EventSource | null>(null)

  const connect = useCallback(() => {
    if (!projectId) return

    const es = new EventSource(`/api/projects/${projectId}/events`)
    esRef.current = es

    es.onopen = () => dispatch({ type: "connected" })

    es.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data) as Record<string, unknown>
        if (parsed.type === "connected") {
          dispatch({ type: "connected" })
        } else {
          dispatch({ type: "event", event: parsed as unknown as ProjectEventData })
        }
      } catch {
        // ignore malformed events
      }
    }

    es.onerror = () => {
      dispatch({ type: "disconnected" })
      es.close()
      // Auto-reconnect after 3 seconds
      setTimeout(() => connect(), 3000)
    }
  }, [projectId])

  useEffect(() => {
    dispatch({ type: "reset" })
    connect()

    return () => {
      esRef.current?.close()
      esRef.current = null
    }
  }, [connect])

  return state
}
