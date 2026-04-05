"use client"

import { useCallback, useRef, useState } from "react"
import { useProjectEvents, type ProjectEvent } from "./use-project-events"

export type ReactStepEvent = {
  round: number
  stepIndex: number
  thought?: string
  toolName?: string
  target?: string
  status?: string
  outputPreview?: string
}

export type ReactRoundProgress = {
  round: number
  currentStep: number
  maxSteps: number
  phase?: string
}

/**
 * Hook that listens to SSE events for ReAct step updates.
 * Maintains a local list of in-progress steps and round progress.
 */
export function useReactSteps(projectId: string | null) {
  const [activeSteps, setActiveSteps] = useState<ReactStepEvent[]>([])
  const [roundProgress, setRoundProgress] = useState<ReactRoundProgress | null>(null)
  const stepsRef = useRef<ReactStepEvent[]>([])

  const handleEvent = useCallback((event: ProjectEvent) => {
    switch (event.type) {
      case "react_step_started": {
        const step: ReactStepEvent = {
          round: event.data.round as number,
          stepIndex: event.data.stepIndex as number,
          thought: event.data.thought as string | undefined,
          toolName: event.data.toolName as string | undefined,
          target: event.data.target as string | undefined,
          status: "running",
        }
        stepsRef.current = [...stepsRef.current, step]
        setActiveSteps(stepsRef.current)
        break
      }
      case "react_step_completed": {
        const updated = stepsRef.current.map((s) =>
          s.round === (event.data.round as number) &&
          s.stepIndex === (event.data.stepIndex as number)
            ? {
                ...s,
                status: event.data.status as string,
                outputPreview: event.data.outputPreview as string | undefined,
              }
            : s,
        )
        stepsRef.current = updated
        setActiveSteps(updated)
        break
      }
      case "react_round_progress": {
        setRoundProgress({
          round: event.data.round as number,
          currentStep: event.data.currentStep as number,
          maxSteps: event.data.maxSteps as number,
          phase: event.data.phase as string | undefined,
        })
        break
      }
      case "round_reviewed":
      case "lifecycle_changed": {
        stepsRef.current = []
        setActiveSteps([])
        setRoundProgress(null)
        break
      }
    }
  }, [])

  const { connected } = useProjectEvents(projectId, handleEvent)

  return { activeSteps, roundProgress, connected }
}
