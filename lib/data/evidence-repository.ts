import { prisma } from "@/lib/infra/prisma"
import { toEvidenceRecord, fromEvidenceRecord } from "@/lib/infra/prisma-transforms"
import type { EvidenceRecord } from "@/lib/prototype-types"

export async function listStoredEvidence(projectId?: string) {
  const rows = await prisma.evidence.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { id: "desc" },
  })
  return rows.map(toEvidenceRecord)
}

export async function getStoredEvidenceById(evidenceId: string) {
  const row = await prisma.evidence.findUnique({ where: { id: evidenceId } })
  return row ? toEvidenceRecord(row) : null
}

export async function upsertStoredEvidence(records: EvidenceRecord[]) {
  if (!records.length) {
    return []
  }

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
