import * as projectRepo from "@/lib/repositories/project-repo"
import { prisma } from "@/lib/infra/prisma"

export async function getDashboardData() {
  const [projects, projectStats, findingStats, recentAudit] = await Promise.all([
    projectRepo.findAll(),
    projectRepo.countByLifecycle(),
    prisma.finding.groupBy({
      by: ["severity"],
      where: { status: "verified" },
      _count: true,
    }),
    prisma.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ])

  return {
    projectCount: projects.length,
    activeCount: projectStats
      .filter((s) => !["idle", "completed", "stopped", "failed"].includes(s.lifecycle))
      .reduce((sum, s) => sum + s._count, 0),
    projectStats,
    findingStats,
    recentProjects: projects.slice(0, 5),
    recentAudit,
  }
}
