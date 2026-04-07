import { prisma } from "@/lib/infra/prisma"
export async function getLlmProfiles() {
  return prisma.llmProfile.findMany()
}

export async function upsertLlmProfile(id: string, data: {
  provider?: string
  apiKey?: string
  baseUrl?: string
  model?: string
  timeoutMs?: number
  temperature?: number
}) {
  return prisma.llmProfile.upsert({
    where: { id },
    create: { id, ...data },
    update: data,
  })
}

export async function getGlobalConfig() {
  const config = await prisma.globalConfig.findUnique({ where: { id: "global" } })
  return config ?? prisma.globalConfig.create({ data: { id: "global" } })
}

export async function updateGlobalConfig(data: {
  approvalEnabled?: boolean
  autoApproveLowRisk?: boolean
  autoApproveMediumRisk?: boolean
}) {
  return prisma.globalConfig.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  })
}

export async function getSystemStatus() {
  const [toolCount, serverCount, profileCount] = await Promise.all([
    prisma.mcpTool.count({ where: { enabled: true } }),
    prisma.mcpServer.count({ where: { enabled: true } }),
    prisma.llmProfile.count(),
  ])

  return {
    database: "connected",
    tools: toolCount,
    servers: serverCount,
    llmProfiles: profileCount,
  }
}
