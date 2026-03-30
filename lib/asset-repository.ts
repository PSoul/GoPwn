import { prisma } from "@/lib/prisma"
import { toAssetRecord, fromAssetRecord } from "@/lib/prisma-transforms"
import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import type { AssetRecord } from "@/lib/prototype-types"

const USE_PRISMA = process.env.DATA_LAYER === "prisma"

export async function listStoredAssets(projectId?: string) {
  if (USE_PRISMA) {
    const rows = await prisma.asset.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { lastSeen: "desc" },
    })
    return rows.map(toAssetRecord)
  }

  const assets = readPrototypeStore().assets

  if (!projectId) {
    return assets
  }

  return assets.filter((asset) => asset.projectId === projectId)
}

export async function getStoredAssetById(assetId: string) {
  if (USE_PRISMA) {
    const row = await prisma.asset.findUnique({ where: { id: assetId } })
    return row ? toAssetRecord(row) : null
  }

  return readPrototypeStore().assets.find((asset) => asset.id === assetId) ?? null
}

export async function upsertStoredAssets(records: AssetRecord[]) {
  if (!records.length) {
    return []
  }

  if (USE_PRISMA) {
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

  const store = readPrototypeStore()
  const currentAssets = new Map(store.assets.map((asset) => [asset.id, asset]))

  for (const record of records) {
    currentAssets.set(record.id, record)
  }

  store.assets = Array.from(currentAssets.values()).sort((left, right) =>
    right.lastSeen.localeCompare(left.lastSeen),
  )
  writePrototypeStore(store)

  return records
}
