import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

const DEFAULT_TIMEOUT_MS = 8_000
const DEFAULT_DOCKER_TIMEOUT_SECONDS = 8
const SELECTED_HEADER_NAMES = new Set([
  "content-type",
  "location",
  "server",
  "set-cookie",
  "x-frame-options",
  "x-powered-by",
])

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)

  return match?.[1]?.trim() || "Untitled"
}

function buildSelectedHeadersFromEntries(entries) {
  return entries
    .filter(([key]) => {
      const normalizedKey = key.toLowerCase()
      return SELECTED_HEADER_NAMES.has(normalizedKey) || normalizedKey.startsWith("x-")
    })
    .map(([key, value]) => `${key}: ${value}`)
}

function buildFingerprint(headers, title) {
  const serverHeader = headers.find((header) => header.toLowerCase().startsWith("server:"))
  const poweredByHeader = headers.find((header) => header.toLowerCase().startsWith("x-powered-by:"))

  return [serverHeader, poweredByHeader, title].filter(Boolean).join(" / ")
}

function parseDockerResponseOutput(output, fallbackUrl) {
  const lines = output.split(/\r?\n/)
  const headerEntries = []
  const htmlLines = []
  let currentStatusCode = 0
  let parsingHeaders = true

  for (const line of lines) {
    const trimmed = line.trim()

    if (parsingHeaders && /^HTTP\/\d+(?:\.\d+)?\s+\d{3}/i.test(trimmed)) {
      const statusMatch = trimmed.match(/\s(\d{3})\b/)
      currentStatusCode = statusMatch ? Number(statusMatch[1]) : currentStatusCode
      continue
    }

    if (parsingHeaders && !trimmed) {
      parsingHeaders = false
      continue
    }

    if (parsingHeaders) {
      const delimiterIndex = line.indexOf(":")

      if (delimiterIndex > 0) {
        const key = line.slice(0, delimiterIndex).trim()
        const value = line.slice(delimiterIndex + 1).trim()
        headerEntries.push([key, value])
      }

      continue
    }

    htmlLines.push(line)
  }

  const html = htmlLines.join("\n")
  const headers = buildSelectedHeadersFromEntries(headerEntries)
  const locationHeader = headerEntries.find(([key]) => key.toLowerCase() === "location")?.[1]
  const finalUrl = locationHeader || fallbackUrl
  const title = extractTitle(html)

  return {
    html,
    finalUrl,
    headers,
    statusCode: currentStatusCode || 200,
    title,
  }
}

async function fetchHostTarget(targetUrl, timeoutMs, fetchImpl) {
  const response = await fetchImpl(targetUrl, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
  })
  const html = await response.text()
  const headers = buildSelectedHeadersFromEntries(Array.from(response.headers.entries()))
  const title = extractTitle(html)

  return {
    transport: "host",
    html,
    webEntry: {
      url: targetUrl,
      finalUrl: response.url,
      title,
      statusCode: response.status,
      headers,
      fingerprint: buildFingerprint(headers, title),
    },
  }
}

async function fetchDockerTarget({
  dockerContainerName,
  execFileImpl,
  internalTargetUrl,
  targetUrl,
  timeoutSeconds,
}) {
  const { stdout, stderr } = await promisify(execFileImpl)("docker", [
    "exec",
    dockerContainerName,
    "wget",
    "--server-response",
    "--quiet",
    "--output-document=-",
    `--timeout=${timeoutSeconds}`,
    "--tries=1",
    internalTargetUrl,
  ])
  const parsed = parseDockerResponseOutput([stderr ?? "", stdout ?? ""].filter(Boolean).join("\n"), internalTargetUrl)

  return {
    transport: "docker",
    html: parsed.html,
    webEntry: {
      url: targetUrl,
      finalUrl: parsed.finalUrl,
      title: parsed.title,
      statusCode: parsed.statusCode,
      headers: parsed.headers,
      fingerprint: buildFingerprint(parsed.headers, parsed.title),
    },
  }
}

export async function probeHttpTarget({
  targetUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  dockerTimeoutSeconds = DEFAULT_DOCKER_TIMEOUT_SECONDS,
  dockerContainerName,
  internalTargetUrl,
  adapters = {},
}) {
  const fetchImpl = adapters.fetch ?? fetch
  const execFileImpl = adapters.execFile ?? execFile

  try {
    return await fetchHostTarget(targetUrl, timeoutMs, fetchImpl)
  } catch (hostError) {
    if (!dockerContainerName || !internalTargetUrl) {
      throw hostError
    }

    try {
      return await fetchDockerTarget({
        dockerContainerName,
        execFileImpl,
        internalTargetUrl,
        targetUrl,
        timeoutSeconds: dockerTimeoutSeconds,
      })
    } catch (dockerError) {
      const hostMessage = hostError instanceof Error ? hostError.message : String(hostError)
      const dockerMessage = dockerError instanceof Error ? dockerError.message : String(dockerError)
      throw new Error(`宿主机探测失败：${hostMessage}；容器内 fallback 失败：${dockerMessage}`)
    }
  }
}

export function extractLinkedHttpStructure({ html, targetUrl, finalUrl, headers }) {
  const loweredHtml = html.toLowerCase()
  const candidates = [
    { kind: "openapi", label: "OpenAPI 文档", matcher: /openapi|swagger/i, path: "/v3/api-docs" },
    { kind: "swagger-ui", label: "Swagger UI", matcher: /swagger-ui|swagger ui/i, path: "/swagger-ui/index.html" },
    { kind: "graphql", label: "GraphQL 入口", matcher: /graphql/i, path: "/graphql" },
    { kind: "actuator", label: "Spring Actuator", matcher: /actuator/i, path: "/actuator" },
  ]

  return candidates
    .filter((candidate) => candidate.matcher.test(loweredHtml) || headers.some((header) => candidate.matcher.test(header)))
    .map((candidate) => ({
      kind: candidate.kind,
      label: candidate.label,
      url: new URL(candidate.path, finalUrl || targetUrl).toString(),
      confidence: candidate.matcher.test(loweredHtml) ? "0.74" : "0.58",
      source: candidate.matcher.test(loweredHtml) ? "html" : "headers",
    }))
}
