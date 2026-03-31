import type { OrchestratorPlanItem, ProjectRecord } from "@/lib/prototype-types"

// ---------------------------------------------------------------------------
// Target classification & normalisation
// ---------------------------------------------------------------------------

export function isWebGoatBaseUrl(baseUrl: string) {
  return /\/webgoat\/?$/i.test(baseUrl)
}

export function normalizeUrlTarget(target: string) {
  return target.trim().replace(/\/+$/, "")
}

export function classifyTarget(target: string) {
  const trimmed = target.trim()

  if (/^https?:\/\//i.test(trimmed)) {
    return "url" as const
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}$/.test(trimmed)) {
    return "cidr" as const
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(trimmed)) {
    return "ip" as const
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) {
    return "domain" as const
  }

  return "other" as const
}

export function extractHostCandidate(target: string) {
  const trimmed = target.trim()

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).hostname
    } catch {
      return trimmed
    }
  }

  return trimmed
}

export function toWebTarget(target: string) {
  const trimmed = target.trim()

  if (/^https?:\/\//i.test(trimmed)) {
    return normalizeUrlTarget(trimmed)
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(trimmed)) {
    return `http://${trimmed}`
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) {
    return `https://${trimmed}`
  }

  return null
}

export function isLocalHost(value: string) {
  return ["localhost", "127.0.0.1"].includes(value.trim().toLowerCase())
}

// ---------------------------------------------------------------------------
// IPv4 / CIDR helpers (private)
// ---------------------------------------------------------------------------

function ipv4ToNumber(ip: string) {
  const parts = ip.split(".").map((part) => Number(part))

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null
  }

  return parts.reduce((accumulator, part) => (accumulator << 8) + part, 0) >>> 0
}

function isIpv4InCidr(ip: string, cidr: string) {
  const [baseIp, rawMask] = cidr.split("/")
  const candidate = ipv4ToNumber(ip)
  const base = ipv4ToNumber(baseIp)
  const maskBits = Number(rawMask)

  if (candidate === null || base === null || Number.isNaN(maskBits) || maskBits < 0 || maskBits > 32) {
    return false
  }

  const mask = maskBits === 0 ? 0 : ((0xffffffff << (32 - maskBits)) >>> 0)

  return (candidate & mask) === (base & mask)
}

// ---------------------------------------------------------------------------
// Scope matching
// ---------------------------------------------------------------------------

function extractComparableHost(target: string) {
  const trimmed = target.trim()

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).hostname.toLowerCase()
    } catch {
      return trimmed.toLowerCase()
    }
  }

  return trimmed.toLowerCase()
}

function isTargetWithinProjectScope(project: ProjectRecord, candidateTarget: string) {
  const candidate = candidateTarget.trim()

  if (!candidate) {
    return false
  }

  const candidateHost = extractComparableHost(candidate)

  return project.targets.some((projectTarget) => {
    const normalizedProjectTarget = projectTarget.trim()
    const projectHost = extractComparableHost(normalizedProjectTarget)
    const projectType = classifyTarget(projectHost)

    if (candidate.toLowerCase() === normalizedProjectTarget.toLowerCase()) {
      return true
    }

    if (candidateHost === projectHost || (isLocalHost(candidateHost) && isLocalHost(projectHost))) {
      return true
    }

    if (projectType === "domain") {
      return candidateHost === projectHost || candidateHost.endsWith(`.${projectHost}`)
    }

    if (projectType === "url") {
      const urlHost = extractComparableHost(normalizedProjectTarget)

      if (isLocalHost(urlHost)) {
        return isLocalHost(candidateHost)
      }

      return candidateHost === urlHost
    }

    if (projectType === "ip") {
      return candidateHost === projectHost
    }

    if (projectType === "cidr") {
      return isIpv4InCidr(candidateHost, projectHost)
    }

    return false
  })
}

export function filterPlanItemsToProjectScope(project: ProjectRecord, items: OrchestratorPlanItem[]) {
  return items.filter((item) => isTargetWithinProjectScope(project, item.target))
}

// ---------------------------------------------------------------------------
// TCP target helpers
// ---------------------------------------------------------------------------

export function parseTcpTarget(target: string): { host: string; port: number } | null {
  const match = target.match(/^tcp:\/\/([^:]+):(\d+)$/i)

  if (match) {
    return { host: match[1], port: Number(match[2]) }
  }

  // Also handle bare host:port
  const bareMatch = target.match(/^([^/:]+):(\d+)$/)

  if (bareMatch && !/^https?$/i.test(bareMatch[1])) {
    return { host: bareMatch[1], port: Number(bareMatch[2]) }
  }

  return null
}
