import { apiHandler, json } from "@/lib/infra/api-handler"
import { getProject } from "@/lib/services/project-service"
import { prisma } from "@/lib/infra/prisma"

export const POST = apiHandler(async (_req, ctx) => {
  const { projectId } = await ctx.params
  const project = await getProject(projectId)

  const [assetCount, findingCount] = await Promise.all([
    prisma.asset.count({ where: { projectId } }),
    prisma.finding.count({ where: { projectId } }),
  ])

  const summary = `项目「${project.name}」报告：共发现 ${assetCount} 个资产、${findingCount} 个漏洞/发现。`

  const result = {
    id: `export-${Date.now()}`,
    summary,
    assetCount,
    findingCount,
    exportedAt: new Date().toISOString(),
  }

  return json({ export: result, totalExports: 1 })
})
