import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import type { AssetRecord } from "@/lib/prototype-types"

export function listStoredAssets(projectId?: string) {
  const assets = readPrototypeStore().assets

  if (!projectId) {
    return assets
  }

  return assets.filter((asset) => asset.projectId === projectId)
}

export function getStoredAssetById(assetId: string) {
  return readPrototypeStore().assets.find((asset) => asset.id === assetId) ?? null
}

export function upsertStoredAssets(records: AssetRecord[]) {
  if (!records.length) {
    return []
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
