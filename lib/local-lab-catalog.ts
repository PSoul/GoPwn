import { execFile } from "node:child_process"
import net from "node:net"
import { promisify } from "node:util"

import { formatTimestamp } from "@/lib/prototype-record-utils"
import type { LocalLabRecord } from "@/lib/prototype-types"

type LocalLabListOptions = {
  probe?: boolean
}

type LocalLabSeedRecord = Omit<LocalLabRecord, "availability" | "status" | "statusNote"> & {
  protocol?: "http" | "tcp"
}

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
    {
      id: "dvwa",
      name: "DVWA",
      description: "经典 PHP 漏洞靶场（SQL注入/XSS/命令注入/文件上传等）。",
      baseUrl: "http://127.0.0.1:8081",
      healthUrl: "http://127.0.0.1:8081",
      image: "vulnerables/web-dvwa",
      ports: ["127.0.0.1:8081->80"],
      dockerContainerName: "llm-pentest-dvwa",
      internalBaseUrl: "http://127.0.0.1:80",
      internalHealthUrl: "http://127.0.0.1:80",
      effectiveHostPort: 8081,
    },
    {
      id: "wordpress",
      name: "WordPress (弱口令 CMS)",
      description: "WordPress 6.4 靶场，适合 CMS 识别和默认配置检测。",
      baseUrl: "http://127.0.0.1:8082",
      healthUrl: "http://127.0.0.1:8082",
      image: "wordpress:6.4-apache",
      ports: ["127.0.0.1:8082->80"],
      dockerContainerName: "llm-pentest-wordpress",
      internalBaseUrl: "http://127.0.0.1:80",
      internalHealthUrl: "http://127.0.0.1:80",
      effectiveHostPort: 8082,
    },
    {
      id: "phpmyadmin",
      name: "phpMyAdmin",
      description: "数据库管理面板暴露面，连接多个 MySQL 实例。",
      baseUrl: "http://127.0.0.1:8083",
      healthUrl: "http://127.0.0.1:8083",
      image: "phpmyadmin/phpmyadmin",
      ports: ["127.0.0.1:8083->80"],
      dockerContainerName: "llm-pentest-phpmyadmin",
      internalBaseUrl: "http://127.0.0.1:80",
      internalHealthUrl: "http://127.0.0.1:80",
      effectiveHostPort: 8083,
    },
    {
      id: "mysql-weak",
      name: "MySQL 弱口令",
      description: "独立 MySQL 5.7 靶标（root/123456），适合数据库弱口令检测。",
      baseUrl: "tcp://127.0.0.1:13307",
      healthUrl: "tcp://127.0.0.1:13307",
      image: "mysql:5.7",
      ports: ["127.0.0.1:13307->3306"],
      dockerContainerName: "llm-pentest-mysql-weak",
      effectiveHostPort: 13307,
      protocol: "tcp",
    },
    {
      id: "redis-noauth",
      name: "Redis 无认证",
      description: "Redis 7 未授权访问靶标，无密码保护。",
      baseUrl: "tcp://127.0.0.1:6379",
      healthUrl: "tcp://127.0.0.1:6379",
      image: "redis:7-alpine",
      ports: ["127.0.0.1:6379->6379"],
      dockerContainerName: "llm-pentest-redis-noauth",
      effectiveHostPort: 6379,
      protocol: "tcp",
    },
    {
      id: "ssh-weak",
      name: "SSH 弱口令",
      description: "SSH 靶标（root/root），适合弱口令爆破检测。",
      baseUrl: "tcp://127.0.0.1:2222",
      healthUrl: "tcp://127.0.0.1:2222",
      image: "panubo/sshd",
      ports: ["127.0.0.1:2222->22"],
      dockerContainerName: "llm-pentest-ssh-weak",
      effectiveHostPort: 2222,
      protocol: "tcp",
    },
    {
      id: "tomcat-weak",
      name: "Tomcat 弱管理员",
      description: "Tomcat 9 靶标（tomcat/tomcat 默认密码），Manager 面板暴露。",
      baseUrl: "http://127.0.0.1:8888",
      healthUrl: "http://127.0.0.1:8888",
      image: "tomcat:9-jdk11",
      ports: ["127.0.0.1:8888->8080"],
      dockerContainerName: "llm-pentest-tomcat-weak",
      internalBaseUrl: "http://127.0.0.1:8080",
      internalHealthUrl: "http://127.0.0.1:8080",
      effectiveHostPort: 8888,
    },
    {
      id: "elasticsearch-noauth",
      name: "Elasticsearch 无认证",
      description: "Elasticsearch 7.17 未授权访问靶标，集群信息泄露。",
      baseUrl: "http://127.0.0.1:9200",
      healthUrl: "http://127.0.0.1:9200",
      image: "elasticsearch:7.17.18",
      ports: ["127.0.0.1:9200->9200"],
      dockerContainerName: "llm-pentest-elasticsearch-noauth",
      effectiveHostPort: 9200,
    },
    {
      id: "mongodb-noauth",
      name: "MongoDB 无认证",
      description: "MongoDB 6 未授权访问靶标，无认证绑定全网段。",
      baseUrl: "tcp://127.0.0.1:27017",
      healthUrl: "tcp://127.0.0.1:27017",
      image: "mongo:6",
      ports: ["127.0.0.1:27017->27017"],
      dockerContainerName: "llm-pentest-mongodb-noauth",
      effectiveHostPort: 27017,
      protocol: "tcp",
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

async function probeTcpPort(host: string, port: number): Promise<UrlProbeResult> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: hostProbeTimeoutMs })

    socket.once("connect", () => {
      socket.destroy()
      resolve({ ok: true, statusCode: port })
    })

    socket.once("timeout", () => {
      socket.destroy()
      resolve({ ok: false, error: `TCP 连接超时 (${host}:${port})` })
    })

    socket.once("error", (error) => {
      socket.destroy()
      resolve({ ok: false, error: error.message })
    })
  })
}

function parseTcpUrl(url: string): { host: string; port: number } | null {
  const match = url.match(/^tcp:\/\/([^:]+):(\d+)$/)

  if (!match) {
    return null
  }

  return { host: match[1], port: Number(match[2]) }
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
  // TCP protocol targets use TCP socket probing
  if (seed.protocol === "tcp") {
    const parsed = parseTcpUrl(seed.healthUrl)

    if (parsed) {
      const tcpProbe = await probeTcpPort(parsed.host, parsed.port)

      if (tcpProbe.ok) {
        return buildOnlineLab(
          seed,
          "host",
          `宿主机 TCP ${parsed.host}:${parsed.port} 可达。`,
        )
      }

      return buildOfflineLab(
        seed,
        `TCP 探测失败：${tcpProbe.error ?? "未收到有效响应"}。`,
      )
    }
  }

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

    // For TCP labs, also match host:port format
    if (lab.protocol === "tcp") {
      const parsed = parseTcpUrl(hostBaseUrl)

      if (parsed && normalizedTarget === `${parsed.host}:${parsed.port}`) {
        return true
      }
    }

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
