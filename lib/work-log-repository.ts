import { prisma } from "@/lib/prisma"
import { toLogRecord, fromLogRecord } from "@/lib/prisma-transforms"
import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import type { LogRecord } from "@/lib/prototype-types"

const USE_PRISMA = process.env.DATA_LAYER === "prisma"

export async function listStoredWorkLogs(projectName?: string) {
  if (USE_PRISMA) {
    const rows = await prisma.workLog.findMany({
      where: projectName ? { projectName } : undefined,
      orderBy: { timestamp: "desc" },
    })
    return rows.map(toLogRecord)
  }

  const workLogs = readPrototypeStore().workLogs

  if (!projectName) {
    return workLogs
  }

  return workLogs.filter((log) => log.projectName === projectName)
}

export async function upsertStoredWorkLogs(records: LogRecord[]) {
  if (!records.length) {
    return []
  }

  if (USE_PRISMA) {
    await prisma.$transaction(
      records.map((record) => {
        const data = fromLogRecord(record)
        return prisma.workLog.upsert({
          where: { id: record.id },
          create: data,
          update: data,
        })
      }),
    )
    return records
  }

  const store = readPrototypeStore()
  const currentRecords = new Map(store.workLogs.map((record) => [record.id, record]))

  for (const record of records) {
    currentRecords.set(record.id, record)
  }

  store.workLogs = Array.from(currentRecords.values()).sort((left, right) =>
    right.timestamp.localeCompare(left.timestamp),
  )
  writePrototypeStore(store)

  return records
}
