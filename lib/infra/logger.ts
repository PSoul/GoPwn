import pino from "pino"

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
      : undefined,
})

/**
 * Create a child logger with job context.
 * All log lines from this child automatically include jobType + projectId.
 */
export function createJobLogger(
  jobType: string,
  projectId: string,
  extra?: Record<string, unknown>,
) {
  return logger.child({ jobType, projectId, ...extra })
}
