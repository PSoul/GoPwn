import { prisma } from "@/lib/prisma"
import { toAssetRecord, fromAssetRecord } from "@/lib/prisma-transforms"
import type { AssetRecord } from "@/lib/prototype-types"

export async function listStoredAssets(projectId?: string) {
  const rows = await prisma.asset.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { lastSeen: "desc" },
  })
  return rows.map(toAssetRecord)
}

export async function listStoredAssetsByTypes(projectId: string, types: string[]) {
  const rows = await prisma.asset.findMany({
    where: { projectId, type: { in: types } },
    orderBy: { lastSeen: "desc" },
  })
  return rows.map(toAssetRecord)
}

export async function getStoredAssetById(assetId: string) {
  const row = await prisma.asset.findUnique({ where: { id: assetId } })
  return row ? toAssetRecord(row) : null
}

export async function upsertStoredAssets(records: AssetRecord[]) {
  if (!records.length) {
    return []
  }

  await prisma.$transaction(
    records.map((record) => {
      const data = fromAssetRecord(record)
      return prisma.asset.upsert({
        where: { id: record.id },
        create: data,
        update: data,
      })
    }),
  )
  return records
}
