import type { AssetCollectionView } from "@/lib/prototype-types"

export function getPreferredAssetViewKey(
  views: AssetCollectionView[],
  requestedKey?: string | null,
) {
  if (requestedKey && views.some((view) => view.key === requestedKey)) {
    return requestedKey as AssetCollectionView["key"]
  }

  return views.find((view) => view.count > 0)?.key ?? views[0]?.key
}
