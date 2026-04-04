import { prisma } from "@/lib/infra/prisma"
import { toAssetRecord, fromAssetRecord } from "@/lib/infra/prisma-transforms"
import { emitProjectEvent } from "@/lib/infra/project-event-bus"
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

  // Emit SSE events per project
  const projectIds = [...new Set(records.map((r) => r.projectId))]
  for (const pid of projectIds) {
    const total = await prisma.asset.count({ where: { projectId: pid } })
    emitProjectEvent(pid, "asset_discovered", {
      message: `发现 ${records.filter((r) => r.projectId === pid).length} 个资产`,
      totalAssets: total,
    })
  }

  return records
}
