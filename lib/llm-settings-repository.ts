import { prisma } from "@/lib/prisma"
import { toLlmProfileRecord } from "@/lib/prisma-transforms"
import { formatTimestamp } from "@/lib/prototype-record-utils"
import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import type { LlmProfileId, LlmProfileRecord } from "@/lib/prototype-types"

const USE_PRISMA = process.env.DATA_LAYER === "prisma"

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

export async function listStoredLlmProfiles() {
  if (USE_PRISMA) {
    const rows = await prisma.llmProfile.findMany()
    return rows.map(toLlmProfileRecord)
  }
  return readPrototypeStore().llmProfiles
}

export async function getStoredLlmProfile(profileId: LlmProfileId) {
  if (USE_PRISMA) {
    const row = await prisma.llmProfile.findUnique({ where: { id: profileId } })
    return row ? toLlmProfileRecord(row) : null
  }
  return readPrototypeStore().llmProfiles.find((profile) => profile.id === profileId) ?? null
}

export async function updateStoredLlmProfile(profile: LlmProfileRecord) {
  if (USE_PRISMA) {
    const existing = await prisma.llmProfile.findUnique({ where: { id: profile.id } })
    if (!existing) return null

    const row = await prisma.llmProfile.update({
      where: { id: profile.id },
      data: {
        provider: profile.provider,
        label: profile.label,
        apiKey: profile.apiKey,
        baseUrl: profile.baseUrl,
        model: profile.model,
        timeoutMs: profile.timeoutMs,
        temperature: profile.temperature,
        enabled: profile.enabled,
      },
    })

    await prisma.auditLog.create({
      data: {
        id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        category: "LLM 设置",
        summary: `更新 LLM 配置 ${profile.label}：${profile.enabled ? "已启用" : "已停用"} / ${profile.model || "未配置模型"}`,
        actor: "系统设置",
        status: "已更新",
      },
    })

    return toLlmProfileRecord(row)
  }

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
