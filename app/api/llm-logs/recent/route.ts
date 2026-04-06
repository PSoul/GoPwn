import { apiHandler, json } from "@/lib/infra/api-handler"
import { prisma } from "@/lib/infra/prisma"

export const GET = apiHandler(async (req) => {
  const url = new URL(req.url)
  const rawLimit = Number(url.searchParams.get("limit") ?? "50")
  const limit = Math.min(Number.isNaN(rawLimit) ? 50 : rawLimit, 100)
  const projectId = url.searchParams.get("projectId") ?? undefined

  const logs = await prisma.llmCallLog.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  return json({ items: logs })
})
