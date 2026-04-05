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

/** Find all port assets that are children of the given IP asset */
export async function findPortsByIpAsset(ipAssetId: string) {
  return prisma.asset.findMany({
    where: { parentId: ipAssetId, kind: "port" },
    include: {
      children: { where: { kind: "service" } }, // service assets
    },
    orderBy: { value: "asc" },
  })
}

/** Find webapp/api_endpoint assets that are descendants of ports under this IP */
export async function findWebAppsByIpAsset(ipAssetId: string) {
  // Get port IDs first
  const ports = await prisma.asset.findMany({
    where: { parentId: ipAssetId, kind: "port" },
    select: { id: true },
  })
  const portIds = ports.map((p) => p.id)
  if (portIds.length === 0) return []

  // Find webapp/api_endpoint with parent being one of the ports (or their services)
  const services = await prisma.asset.findMany({
    where: { parentId: { in: portIds }, kind: "service" },
    select: { id: true },
  })
  const parentIds = [...portIds, ...services.map((s) => s.id)]

  return prisma.asset.findMany({
    where: {
      parentId: { in: parentIds },
      kind: { in: ["webapp", "api_endpoint"] },
    },
    orderBy: { value: "asc" },
  })
}
