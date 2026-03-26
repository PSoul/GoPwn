import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import type { EvidenceRecord } from "@/lib/prototype-types"

export function listStoredEvidence(projectId?: string) {
  const evidenceRecords = readPrototypeStore().evidenceRecords

  if (!projectId) {
    return evidenceRecords
  }

  return evidenceRecords.filter((record) => record.projectId === projectId)
}

export function getStoredEvidenceById(evidenceId: string) {
  return readPrototypeStore().evidenceRecords.find((record) => record.id === evidenceId) ?? null
}

export function upsertStoredEvidence(records: EvidenceRecord[]) {
  if (!records.length) {
    return []
  }

  const store = readPrototypeStore()
  const currentRecords = new Map(store.evidenceRecords.map((record) => [record.id, record]))

  for (const record of records) {
    currentRecords.set(record.id, record)
  }

  store.evidenceRecords = Array.from(currentRecords.values()).sort((left, right) =>
    right.timeline[0]?.localeCompare(left.timeline[0] ?? "") || right.id.localeCompare(left.id),
  )
  writePrototypeStore(store)

  return records
}
