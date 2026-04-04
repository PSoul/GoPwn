import { prisma } from "@/lib/infra/prisma"

export async function findByProject(projectId: string) {
  return prisma.evidence.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  })
}

export async function findById(id: string) {
  return prisma.evidence.findUnique({
    where: { id },
    include: { findings: true, asset: true, mcpRun: true },
  })
}

export async function create(data: {
  projectId: string
  assetId?: string
  mcpRunId?: string
  title: string
  toolName: string
  rawOutput: string
  summary?: string
  artifactPaths?: string[]
  capturedUrl?: string
}) {
  return prisma.evidence.create({
    data: {
      projectId: data.projectId,
      assetId: data.assetId,
      mcpRunId: data.mcpRunId,
      title: data.title,
      toolName: data.toolName,
      rawOutput: data.rawOutput,
      summary: data.summary ?? "",
      artifactPaths: data.artifactPaths ?? [],
      capturedUrl: data.capturedUrl,
    },
  })
}
