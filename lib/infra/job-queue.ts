import { PgBoss } from "pg-boss"

export type JobOptions = {
  retryLimit?: number
  retryDelay?: number
  expireInSeconds?: number
  startAfter?: Date | string
  singletonKey?: string
}

export interface JobQueue {
  start(): Promise<void>
  stop(): Promise<void>
  publish(jobName: string, data: unknown, options?: JobOptions): Promise<string | null>
  subscribe<T = unknown>(jobName: string, handler: (data: T) => Promise<void>): Promise<void>
}

let bossInstance: PgBoss | null = null
let started = false

export function getBoss(): PgBoss {
  if (!bossInstance) {
    bossInstance = new PgBoss(process.env.DATABASE_URL!)
  }
  return bossInstance
}

/**
 * Ensure pg-boss is started. Safe to call multiple times — only starts once.
 */
async function ensureStarted(boss: PgBoss): Promise<void> {
  if (started) return
  await boss.start()
  started = true
}

export function createPgBossJobQueue(): JobQueue {
  const boss = getBoss()

  return {
    async start() {
      await ensureStarted(boss)
    },

    async stop() {
      await boss.stop()
      started = false
    },

    async publish(jobName, data, options) {
      await ensureStarted(boss)
      await boss.createQueue(jobName).catch(() => {}) // idempotent
      return boss.send(jobName, data as object, {
        retryLimit: options?.retryLimit ?? 3,
        retryDelay: options?.retryDelay ?? 5,
        expireInSeconds: options?.expireInSeconds ?? 600,
        startAfter: options?.startAfter ? new Date(options.startAfter) : undefined,
        singletonKey: options?.singletonKey,
      })
    },

    async subscribe<T = unknown>(jobName: string, handler: (data: T) => Promise<void>) {
      await ensureStarted(boss)
      await boss.createQueue(jobName).catch(() => {}) // idempotent
      await boss.work<T>(jobName, async (jobs) => {
        for (const job of jobs) {
          await handler(job.data)
        }
      })
    },
  }
}
