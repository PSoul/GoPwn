import { prisma } from "@/lib/prisma"
import { toEvidenceRecord, fromEvidenceRecord } from "@/lib/prisma-transforms"
import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import type { EvidenceRecord } from "@/lib/prototype-types"

const USE_PRISMA = process.env.DATA_LAYER === "prisma"

export async function listStoredEvidence(projectId?: string) {
  if (USE_PRISMA) {
    const rows = await prisma.evidence.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { id: "desc" },
    })
    return rows.map(toEvidenceRecord)
  }

  const evidenceRecords = readPrototypeStore().evidenceRecords

  if (!projectId) {
    return evidenceRecords
  }

  return evidenceRecords.filter((record) => record.projectId === projectId)
}

export async function getStoredEvidenceById(evidenceId: string) {
  if (USE_PRISMA) {
    const row = await prisma.evidence.findUnique({ where: { id: evidenceId } })
    return row ? toEvidenceRecord(row) : null
  }

  return readPrototypeStore().evidenceRecords.find((record) => record.id === evidenceId) ?? null
}

export async function upsertStoredEvidence(records: EvidenceRecord[]) {
  if (!records.length) {
    return []
  }

  if (USE_PRISMA) {
    await prisma.$transaction(
      records.map((record) => {
        const data = fromEvidenceRecord(record)
        return prisma.evidence.upsert({
          where: { id: record.id },
          create: data,
          update: data,
        })
      }),
    )
    return records
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
