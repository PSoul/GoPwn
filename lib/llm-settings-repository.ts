import { formatTimestamp } from "@/lib/prototype-record-utils"
import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import type { LlmProfileId, LlmProfileRecord } from "@/lib/prototype-types"

function createAuditLog(summary: string) {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    category: "LLM 设置",
    summary,
    actor: "系统设置",
    timestamp: formatTimestamp(),
    status: "已更新",
  }
}

export function listStoredLlmProfiles() {
  return readPrototypeStore().llmProfiles
}

export function getStoredLlmProfile(profileId: LlmProfileId) {
  return readPrototypeStore().llmProfiles.find((profile) => profile.id === profileId) ?? null
}

export function updateStoredLlmProfile(profile: LlmProfileRecord) {
  const store = readPrototypeStore()
  const profileIndex = store.llmProfiles.findIndex((item) => item.id === profile.id)

  if (profileIndex < 0) {
    return null
  }

  store.llmProfiles[profileIndex] = profile
  store.auditLogs.unshift(createAuditLog(`更新 LLM 配置 ${profile.label}：${profile.enabled ? "已启用" : "已停用"} / ${profile.model || "未配置模型"}`))
  writePrototypeStore(store)

  return profile
}
