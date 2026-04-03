import type { Tone } from "./project"

export type LlmProfileId = "orchestrator" | "reviewer" | "analyzer"

export interface LlmProfileRecord {
  id: LlmProfileId
  provider: string
  label: string
  apiKey: string
  baseUrl: string
  model: string
  timeoutMs: number
  temperature: number
  enabled: boolean
  contextWindowSize: number
}

export interface LlmSettingsPayload {
  profiles: LlmProfileRecord[]
}

export interface LlmProviderStatus {
  provider: string
  enabled: boolean
  baseUrl: string
  orchestratorModel: string
  reviewerModel: string
  analyzerModel: string
  note: string
}

export interface LlmSettingRecord {
  title: string
  value: string
  description: string
  owner: string
}

export interface SettingsSectionRecord {
  title: string
  href: string
  description: string
  metric: string
  tone: Tone
}

export interface LocalLabRecord {
  id: string
  name: string
  description: string
  baseUrl: string
  healthUrl: string
  image: string
  ports: string[]
  status: "online" | "offline" | "unknown"
  availability: "host" | "container" | "none" | "unknown"
  statusNote: string
  dockerContainerName?: string
  internalBaseUrl?: string
  internalHealthUrl?: string
  effectiveHostPort?: number
}
