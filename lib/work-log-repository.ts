import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import type { LogRecord } from "@/lib/prototype-types"

export function listStoredWorkLogs(projectName?: string) {
  const workLogs = readPrototypeStore().workLogs

  if (!projectName) {
    return workLogs
  }

  return workLogs.filter((log) => log.projectName === projectName)
}

export function upsertStoredWorkLogs(records: LogRecord[]) {
  if (!records.length) {
    return []
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
