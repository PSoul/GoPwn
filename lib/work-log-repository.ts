import { prisma } from "@/lib/prisma"
import { toLogRecord, fromLogRecord } from "@/lib/prisma-transforms"
import type { LogRecord } from "@/lib/prototype-types"

export async function listStoredWorkLogs(projectName?: string) {
  const rows = await prisma.workLog.findMany({
    where: projectName ? { projectName } : undefined,
    orderBy: { timestamp: "desc" },
  })
  return rows.map(toLogRecord)
}

export async function upsertStoredWorkLogs(records: LogRecord[]) {
  if (!records.length) {
    return []
  }

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
