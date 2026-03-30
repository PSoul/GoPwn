export interface EvidenceRecord {
  id: string
  projectId: string
  projectName: string
  title: string
  source: string
  confidence: string
  conclusion: string
  linkedApprovalId: string
  rawOutput: string[]
  screenshotNote: string
  structuredSummary: string[]
  linkedTaskTitle: string
  linkedAssetLabel: string
  timeline: string[]
  verdict: string
  capturedUrl?: string
  screenshotArtifactPath?: string
  htmlArtifactPath?: string
}
