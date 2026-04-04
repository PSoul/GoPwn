import { prisma } from "./prisma"

export type ProjectEvent = {
  type: string
  projectId: string
  timestamp: string
  data: Record<string, unknown>
}

/**
 * Publish a project event via PostgreSQL NOTIFY.
 * Channel name: "project_events"
 * Payload: JSON string of ProjectEvent
 */
export async function publishEvent(event: ProjectEvent) {
  const payload = JSON.stringify(event)
  // PostgreSQL NOTIFY payload limit is 8000 bytes. Truncate data if needed.
  const safePayload = payload.length > 7900
    ? JSON.stringify({ ...event, data: { truncated: true } })
    : payload
  await prisma.$executeRawUnsafe(`SELECT pg_notify('project_events', $1)`, safePayload)
}

/**
 * Subscribe to project events via PostgreSQL LISTEN.
 * Returns an async generator that yields events.
 * Must be used with a raw pg connection (not Prisma — Prisma doesn't support LISTEN).
 *
 * For SSE endpoints, use createPgListener() instead.
 */
export { createPgListener } from "./pg-listener"
