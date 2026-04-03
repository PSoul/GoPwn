import { prisma } from "@/lib/infra/prisma"
import { toLlmProfileRecord } from "@/lib/infra/prisma-transforms"
import type { LlmProfileId, LlmProfileRecord } from "@/lib/prototype-types"

export async function listStoredLlmProfiles() {
  const rows = await prisma.llmProfile.findMany()
  return rows.map(toLlmProfileRecord)
}

export async function getStoredLlmProfile(profileId: LlmProfileId) {
  const row = await prisma.llmProfile.findUnique({ where: { id: profileId } })
  return row ? toLlmProfileRecord(row) : null
}

export async function updateStoredLlmProfile(profile: LlmProfileRecord) {
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
      contextWindowSize: profile.contextWindowSize,
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
