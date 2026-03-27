import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { formatTimestamp } from "@/lib/prototype-record-utils"
import type { LocalLabRecord } from "@/lib/prototype-types"

type LocalLabListOptions = {
  probe?: boolean
}

type LocalLabSeedRecord = Omit<LocalLabRecord, "availability" | "status" | "statusNote">

type ProbeAdapters = {
  execFile: typeof execFile
  fetch: typeof fetch
}

type UrlProbeResult = {
  ok: boolean
  statusCode?: number
  error?: string
}

const DEFAULT_WEBGOAT_HOST_PORT = 18080
const hostProbeTimeoutMs = 4_000
const dockerProbeTimeoutSeconds = 6

let probeAdapters: ProbeAdapters = {
  execFile,
  fetch,
}

function getConfiguredWebGoatHostPort() {
  const rawPort = Number(process.env.WEBGOAT_HOST_PORT ?? DEFAULT_WEBGOAT_HOST_PORT)

  if (!Number.isFinite(rawPort) || rawPort <= 0) {
    return DEFAULT_WEBGOAT_HOST_PORT
  }

  return Math.trunc(rawPort)
}

function buildLocalLabSeed() {
  const webgoatHostPort = getConfiguredWebGoatHostPort()

  return [
    {
      id: "juice-shop",
      name: "OWASP Juice Shop",
      description: "现代前后端一体化漏洞靶场，适合做本地 Web/API 低风险识别与审批链验证。",
      baseUrl: "http://127.0.0.1:3000",
      healthUrl: "http://127.0.0.1:3000",
      image: "bkimminich/juice-shop",
      ports: ["127.0.0.1:3000->3000"],
      dockerContainerName: "llm-pentest-juice-shop",
      internalBaseUrl: "http://127.0.0.1:3000",
      internalHealthUrl: "http://127.0.0.1:3000",
      effectiveHostPort: 3000,
    },
    {
      id: "webgoat",
      name: "OWASP WebGoat",
      description: "经典教学靶场，适合后续扩展到更复杂的教学型验证与审批场景。",
      baseUrl: `http://127.0.0.1:${webgoatHostPort}/WebGoat`,
      healthUrl: `http://127.0.0.1:${webgoatHostPort}/WebGoat/actuator/health`,
      image: "webgoat/webgoat",
      ports: [`127.0.0.1:${webgoatHostPort}->8080`, "127.0.0.1:19090->9090"],
      dockerContainerName: "llm-pentest-webgoat",
      internalBaseUrl: "http://127.0.0.1:8080/WebGoat",
      internalHealthUrl: "http://127.0.0.1:8080/WebGoat/actuator/health",
      effectiveHostPort: webgoatHostPort,
    },
  ] satisfies LocalLabSeedRecord[]
}

function buildUnknownLab(seed: LocalLabSeedRecord): LocalLabRecord {
  return {
    ...seed,
    availability: "unknown",
    status: "unknown",
    statusNote:
      seed.id === "webgoat"
        ? `当前使用宿主机端口 ${seed.effectiveHostPort ?? DEFAULT_WEBGOAT_HOST_PORT}；默认建议使用 18080，如需覆盖请设置 WEBGOAT_HOST_PORT 后重启靶场。`
        : "尚未执行可达性探测。",
  }
}

async function probeHttpUrl(url: string): Promise<UrlProbeResult> {
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), hostProbeTimeoutMs)

  try {
    const response = await probeAdapters.fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    })
    const statusCode = typeof response.status === "number" ? response.status : undefined
    const isOkStatus = typeof statusCode === "number" ? statusCode >= 200 && statusCode < 400 : Boolean(response.ok)

    return {
      ok: isOkStatus,
      statusCode,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timeoutHandle)
  }
}

async function probeDockerUrl(containerName: string, url: string): Promise<UrlProbeResult> {
  try {
    const exec = promisify(probeAdapters.execFile)
    await exec("docker", [
      "exec",
      containerName,
      "wget",
      "--quiet",
      "--output-document=-",
      `--timeout=${dockerProbeTimeoutSeconds}`,
      "--tries=1",
      url,
    ])

    return { ok: true, statusCode: 200 }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error && "stderr" in error
          ? String((error as { stderr?: string }).stderr)
          : String(error)

    return {
      ok: false,
      error: message.trim(),
    }
  }
}

function buildOnlineLab(seed: LocalLabSeedRecord, availability: LocalLabRecord["availability"], note: string): LocalLabRecord {
  return {
    ...seed,
    availability,
    status: "online",
    statusNote: note,
  }
}

function buildOfflineLab(seed: LocalLabSeedRecord, note: string): LocalLabRecord {
  return {
    ...seed,
    availability: "none",
    status: "offline",
    statusNote: note,
  }
}

async function probeLab(seed: LocalLabSeedRecord): Promise<LocalLabRecord> {
  const hostProbe = await probeHttpUrl(seed.healthUrl)

  if (hostProbe.ok) {
    return buildOnlineLab(
      seed,
      "host",
      `宿主机 ${seed.healthUrl} 可达（HTTP ${hostProbe.statusCode ?? 200}）。`,
    )
  }

  if (seed.dockerContainerName && seed.internalHealthUrl) {
    const containerProbe = await probeDockerUrl(seed.dockerContainerName, seed.internalHealthUrl)

    if (containerProbe.ok) {
      const hostPort = seed.effectiveHostPort ?? DEFAULT_WEBGOAT_HOST_PORT
      return buildOnlineLab(
        seed,
        "container",
        `容器内 ${seed.internalHealthUrl} 可达，但宿主机 ${seed.healthUrl} 不可达。请检查 host port ${hostPort} 是否被占用；默认建议使用 18080，并在覆盖时同步设置 WEBGOAT_HOST_PORT 后重启靶场。`,
      )
    }
  }

  return buildOfflineLab(
    seed,
    `宿主机探测失败：${hostProbe.error ?? "未收到有效响应"}。${
      seed.id === "webgoat"
        ? ` 当前宿主机端口为 ${seed.effectiveHostPort ?? DEFAULT_WEBGOAT_HOST_PORT}；默认建议使用 18080，如需覆盖请同步设置 WEBGOAT_HOST_PORT 并重启靶场。`
        : ""
    }`,
  )
}

function normalizeUrl(url: string) {
  return url.trim().replace(/\/+$/, "")
}

export function resolveLocalLabByTarget(target: string) {
  const normalizedTarget = normalizeUrl(target)

  return buildLocalLabSeed().find((lab) => {
    const hostBaseUrl = normalizeUrl(lab.baseUrl)
    const internalBaseUrl = lab.internalBaseUrl ? normalizeUrl(lab.internalBaseUrl) : null

    return normalizedTarget.startsWith(hostBaseUrl) || (internalBaseUrl ? normalizedTarget.startsWith(internalBaseUrl) : false)
  }) ?? null
}

export function resolveLocalLabHttpTarget(target: string) {
  const matchedLab = resolveLocalLabByTarget(target)

  if (!matchedLab) {
    return null
  }

  const normalizedTarget = normalizeUrl(target)
  const hostBaseUrl = normalizeUrl(matchedLab.baseUrl)
  const internalBaseUrl = matchedLab.internalBaseUrl ? normalizeUrl(matchedLab.internalBaseUrl) : null
  const internalTargetUrl =
    internalBaseUrl && normalizedTarget.startsWith(hostBaseUrl)
      ? `${internalBaseUrl}${normalizedTarget.slice(hostBaseUrl.length)}`
      : normalizedTarget

  return {
    dockerContainerName: matchedLab.dockerContainerName,
    internalTargetUrl,
    lab: matchedLab,
  }
}

export async function listLocalLabs(options: LocalLabListOptions = {}) {
  const labSeed = buildLocalLabSeed()

  if (!options.probe) {
    return labSeed.map(buildUnknownLab)
  }

  return Promise.all(labSeed.map((lab) => probeLab(lab)))
}

export async function getLocalLabById(labId: string, options: LocalLabListOptions = {}) {
  const labs = await listLocalLabs(options)

  return labs.find((lab) => lab.id === labId) ?? null
}

export function buildLocalLabPlanSummary(lab: LocalLabRecord, count: number) {
  const suffix = lab.availability === "container" ? "（当前通过容器内探测路径继续闭环）" : ""
  return `${formatTimestamp()} 已为 ${lab.name} 生成 ${count} 条本地验证动作${suffix}。`
}

export function setLocalLabCatalogTestAdapters(nextAdapters: Partial<ProbeAdapters>) {
  probeAdapters = {
    ...probeAdapters,
    ...nextAdapters,
  }
}

export function resetLocalLabCatalogTestAdapters() {
  probeAdapters = {
    execFile,
    fetch,
  }
}
