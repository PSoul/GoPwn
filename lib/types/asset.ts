export type AssetViewKey =
  | "domains-web"
  | "hosts-ip"
  | "ports-services"
  | "fingerprints"
  | "pending-review"

export interface AssetRelation {
  id: string
  label: string
  type: string
  relation: string
  scopeStatus: "已确认" | "待验证" | "需人工判断"
}

export interface AssetRecord {
  id: string
  projectId: string
  projectName: string
  type: string
  label: string
  profile: string
  scopeStatus: "已确认" | "待验证" | "需人工判断"
  lastSeen: string
  host: string
  ownership: string
  confidence: string
  exposure: string
  linkedEvidenceId: string
  linkedTaskTitle: string
  issueLead: string
  relations: AssetRelation[]
}

export interface AssetCollectionView {
  key: AssetViewKey
  label: string
  description: string
  count: number
  items: AssetRecord[]
}
