import * as assetRepo from "@/lib/repositories/asset-repo"
import { NotFoundError } from "@/lib/domain/errors"

export async function listByProject(projectId: string) {
  return assetRepo.findByProject(projectId)
}

export async function getAssetTree(projectId: string) {
  return assetRepo.findTreeRoots(projectId)
}

export async function getAsset(id: string) {
  const asset = await assetRepo.findById(id)
  if (!asset) throw new NotFoundError("Asset", id)
  return asset
}
