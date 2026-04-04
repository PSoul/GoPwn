import { prisma } from "@/lib/infra/prisma"
import type { AssetKind } from "@/lib/generated/prisma"

export async function findByProject(projectId: string) {
  return prisma.asset.findMany({
    where: { projectId },
    include: {
      fingerprints: true,
      _count: { select: { children: true, findings: true } },
    },
    orderBy: { firstSeenAt: "desc" },
  })
}

export async function findTreeRoots(projectId: string) {
  return prisma.asset.findMany({
    where: { projectId, parentId: null },
    include: {
      fingerprints: true,
      children: {
        include: {
          fingerprints: true,
          children: {
            include: {
              fingerprints: true,
              children: {
                include: {
                  fingerprints: true,
                  children: {
                    include: { fingerprints: true, children: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { firstSeenAt: "asc" },
  })
}

export async function findById(id: string) {
  return prisma.asset.findUnique({
    where: { id },
    include: {
      fingerprints: true,
      parent: true,
      children: { include: { fingerprints: true } },
      findings: true,
      evidence: true,
    },
  })
}

export async function upsert(data: {
  projectId: string
  kind: AssetKind
  value: string
  label: string
  parentId?: string
  confidence?: number
}) {
  return prisma.asset.upsert({
    where: {
      projectId_kind_value: {
        projectId: data.projectId,
        kind: data.kind,
        value: data.value,
      },
    },
    create: {
      projectId: data.projectId,
      kind: data.kind,
      value: data.value,
      label: data.label,
      parentId: data.parentId,
      confidence: data.confidence ?? 0,
    },
    update: {
      lastSeenAt: new Date(),
      confidence: data.confidence,
      label: data.label,
    },
  })
}

export async function addFingerprint(assetId: string, data: {
  category: string
  value: string
  source: string
  confidence?: number
}) {
  return prisma.fingerprint.create({
    data: {
      assetId,
      category: data.category,
      value: data.value,
      source: data.source,
      confidence: data.confidence ?? 0,
    },
  })
}

export async function countByProject(projectId: string) {
  return prisma.asset.count({ where: { projectId } })
}
