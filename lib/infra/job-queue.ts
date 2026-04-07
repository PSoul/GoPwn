import { PgBoss } from "pg-boss"
import { prisma } from "@/lib/infra/prisma"

export type JobOptions = {
  retryLimit?: number
  retryDelay?: number
  expireInSeconds?: number
  startAfter?: Date | string
  singletonKey?: string
}

export type SubscribeOptions = {
  batchSize?: number
  localConcurrency?: number
  pollingIntervalSeconds?: number
}

export interface JobQueue {
  start(): Promise<void>
  stop(): Promise<void>
  publish(jobName: string, data: unknown, options?: JobOptions): Promise<string | null>
  subscribe<T = unknown>(jobName: string, handler: (data: T) => Promise<void>, options?: SubscribeOptions): Promise<void>
  cancelByProject(projectId: string): Promise<number>
}

let bossInstance: PgBoss | null = null
let startPromise: Promise<unknown> | null = null

export function getBoss(): PgBoss {
  if (!bossInstance) {
    bossInstance = new PgBoss(process.env.DATABASE_URL!)
  }
  return bossInstance
}

/**
 * Ensure pg-boss is started. Safe to call concurrently — deduplicates via shared promise.
 */
async function ensureStarted(boss: PgBoss): Promise<void> {
  if (!startPromise) {
    startPromise = boss.start()
  }
  await startPromise
}

export function createPgBossJobQueue(): JobQueue {
  const boss = getBoss()

  return {
    async start() {
      await ensureStarted(boss)
    },

    async stop() {
      await boss.stop()
      bossInstance = null
      startPromise = null
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

    async subscribe<T = unknown>(jobName: string, handler: (data: T) => Promise<void>, options?: SubscribeOptions) {
      await ensureStarted(boss)
      await boss.createQueue(jobName).catch(() => {}) // idempotent
      await boss.work<T>(
        jobName,
        {
          batchSize: options?.batchSize ?? 1,
          localConcurrency: options?.localConcurrency ?? 1,
          pollingIntervalSeconds: options?.pollingIntervalSeconds ?? 2,
        },
        async (jobs) => {
          for (const job of jobs) {
            await handler(job.data)
          }
        },
      )
    },

    async cancelByProject(projectId: string): Promise<number> {
      // 只取消排队中的作业（created/retry），不删除正在执行的（active）
      // active 状态的作业通过 abort registry 信号终止
      const result = await prisma.$executeRawUnsafe(
        `DELETE FROM pgboss.job WHERE state IN ('created', 'retry') AND data->>'projectId' = $1`,
        projectId,
      )
      return result
    },
  }
}
