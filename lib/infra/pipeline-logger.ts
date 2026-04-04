import { createJobLogger } from "./logger"
import * as pipelineLogRepo from "@/lib/repositories/pipeline-log-repo"

export type PipelineLogger = ReturnType<typeof createPipelineLogger>

export function createPipelineLogger(
  projectId: string,
  jobType: string,
  options?: { round?: number; jobId?: string },
) {
  const log = createJobLogger(jobType, projectId, { round: options?.round })

  function write(
    level: "debug" | "info" | "warn" | "error",
    stage: string,
    message: string,
    data?: unknown,
    duration?: number,
  ) {
    // Always write to Pino (stdout)
    log[level]({ stage, data, duration }, message)

    // Write to DB: debug only when LOG_PIPELINE_DEBUG=1, others always
    if (level === "debug" && process.env.LOG_PIPELINE_DEBUG !== "1") return

    pipelineLogRepo
      .create({
        projectId,
        round: options?.round,
        jobType,
        jobId: options?.jobId,
        stage,
        level,
        message,
        data: data ?? undefined,
        duration,
      })
      .catch(() => {}) // best-effort, never block pipeline
  }

  return {
    debug: (stage: string, message: string, data?: unknown) =>
      write("debug", stage, message, data),
    info: (stage: string, message: string, data?: unknown, duration?: number) =>
      write("info", stage, message, data, duration),
    warn: (stage: string, message: string, data?: unknown) =>
      write("warn", stage, message, data),
    error: (stage: string, message: string, data?: unknown) =>
      write("error", stage, message, data),

    /** Returns a timer — call timer.elapsed() to get ms since creation */
    startTimer() {
      const start = Date.now()
      return { elapsed: () => Date.now() - start }
    },
  }
}
