import { execFile } from "node:child_process"
import { promisify } from "node:util"

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_DOCKER_TIMEOUT_SECONDS = 10
const BODY_PREVIEW_LIMIT = 700
const SELECTED_HEADER_NAMES = new Set([
  "cache-control",
  "content-type",
  "location",
  "server",
  "set-cookie",
  "www-authenticate",
  "x-frame-options",
  "x-powered-by",
])

function previewBody(text) {
  const normalized = String(text ?? "").trim()

  if (!normalized) {
    return ""
  }

  return normalized.length > BODY_PREVIEW_LIMIT ? `${normalized.slice(0, BODY_PREVIEW_LIMIT)}...` : normalized
}

function buildSelectedHeadersFromEntries(entries) {
  return entries
    .filter(([key]) => {
      const normalizedKey = key.toLowerCase()
      return SELECTED_HEADER_NAMES.has(normalizedKey) || normalizedKey.startsWith("x-")
    })
    .map(([key, value]) => `${key}: ${value}`)
}

function buildRequestHeaderEntries(headers = {}) {
  return Object.entries(headers)
    .map(([key, value]) => [String(key).trim(), String(value).trim()])
    .filter(([key, value]) => key && value)
}

function buildRequestHeaderLines(headers = {}) {
  return buildRequestHeaderEntries(headers).map(([key, value]) => `${key}: ${value}`)
}

function parseDockerResponseOutput(output, fallbackUrl) {
  const lines = output.split(/\r?\n/)
  const headerEntries = []
  const bodyLines = []
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

    bodyLines.push(line)
  }

  const bodyText = bodyLines.join("\n")
  const locationHeader = headerEntries.find(([key]) => key.toLowerCase() === "location")?.[1]

  return {
    bodyText,
    finalUrl: locationHeader || fallbackUrl,
    headers: buildSelectedHeadersFromEntries(headerEntries),
    statusCode: currentStatusCode || 200,
  }
}

async function requestHostTarget({
  targetUrl,
  method,
  headers,
  body,
  timeoutMs,
  fetchImpl,
}) {
  const hasBody = typeof body === "string" && body.length > 0
  const response = await fetchImpl(targetUrl, {
    ...(hasBody ? { body } : {}),
    headers,
    method,
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  })
  const bodyText = method === "HEAD" ? "" : await response.text()

  return {
    transport: "host",
    requestSummary: {
      method,
      url: targetUrl,
      headers: buildRequestHeaderLines(headers),
      bodyPreview: previewBody(body),
    },
    responseSummary: {
      finalUrl: response.url,
      statusCode: response.status,
      headers: buildSelectedHeadersFromEntries(Array.from(response.headers.entries())),
      bodyPreview: previewBody(bodyText),
      contentType: response.headers.get("content-type") ?? "",
    },
    bodyText,
  }
}

async function requestDockerTarget({
  dockerContainerName,
  execFileImpl,
  internalTargetUrl,
  method,
  timeoutSeconds,
  body,
  headers,
  targetUrl,
}) {
  if (body || method !== "GET" || buildRequestHeaderEntries(headers).length > 0) {
    throw new Error("当前 docker fallback 仅支持无请求体、无自定义请求头的 GET 请求。")
  }

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
  const contentTypeHeader = parsed.headers.find((header) => header.toLowerCase().startsWith("content-type:"))

  return {
    transport: "docker",
    requestSummary: {
      method,
      url: targetUrl,
      headers: [],
      bodyPreview: "",
    },
    responseSummary: {
      finalUrl: parsed.finalUrl,
      statusCode: parsed.statusCode,
      headers: parsed.headers,
      bodyPreview: previewBody(parsed.bodyText),
      contentType: contentTypeHeader ? contentTypeHeader.split(":").slice(1).join(":").trim() : "",
    },
    bodyText: parsed.bodyText,
  }
}

function evaluateSpringActuatorExposure({ responseSummary, bodyText, targetUrl }) {
  const loweredBody = bodyText.toLowerCase()
  const loweredHeaders = responseSummary.headers.join("\n").toLowerCase()
  const matchedSignals = []
  const hasActuatorMediaType =
    loweredHeaders.includes("application/vnd.spring-boot.actuator") ||
    responseSummary.contentType.toLowerCase().includes("application/vnd.spring-boot.actuator")
  const exposesDiscoveryLinks = loweredBody.includes("\"_links\"")
  const exposesHealthLink = loweredBody.includes("\"health\"")
  const exposesEnvLink = loweredBody.includes("\"env\"")
  const exposesConfigPropsLink = loweredBody.includes("\"configprops\"")
  const isSuccessStatus = responseSummary.statusCode >= 200 && responseSummary.statusCode < 300

  if (isSuccessStatus) {
    matchedSignals.push(`匿名请求返回 HTTP ${responseSummary.statusCode}`)
  }

  if (hasActuatorMediaType) {
    matchedSignals.push("响应声明 Spring Boot Actuator 媒体类型")
  }

  if (exposesDiscoveryLinks) {
    matchedSignals.push("响应体暴露 Actuator `_links` 目录")
  }

  if (exposesHealthLink) {
    matchedSignals.push("响应体可见 `health` 端点链接")
  }

  if (exposesEnvLink) {
    matchedSignals.push("响应体可见 `env` 端点链接")
  }

  if (exposesConfigPropsLink) {
    matchedSignals.push("响应体可见 `configprops` 端点链接")
  }

  const findingConfirmed =
    isSuccessStatus && (hasActuatorMediaType || exposesDiscoveryLinks || exposesEnvLink || exposesConfigPropsLink)

  if (!findingConfirmed) {
    return {
      matchedSignals,
      verdict: "本次受控验证未形成明确的 Spring Actuator 暴露结论。",
    }
  }

  const exposedEndpoints = [
    exposesHealthLink ? "health" : "",
    exposesEnvLink ? "env" : "",
    exposesConfigPropsLink ? "configprops" : "",
  ].filter(Boolean)
  const exposedSummary =
    exposedEndpoints.length > 0 ? `并暴露 ${exposedEndpoints.join(" / ")} 等管理端点链接` : "并返回 Spring Actuator 管理目录"

  return {
    matchedSignals,
    verdict: "已确认匿名可访问的 Spring Actuator 暴露，需要收敛管理端点暴露范围。",
    finding: {
      affectedSurface: targetUrl,
      severity: "中危",
      status: "已确认",
      summary: `匿名请求直接访问 ${targetUrl}，${exposedSummary}。`,
      title: "Spring Actuator 管理端点匿名暴露",
    },
  }
}

function evaluateValidationProfile({ profile, responseSummary, bodyText, targetUrl }) {
  if (profile === "spring-actuator-exposure") {
    return evaluateSpringActuatorExposure({
      responseSummary,
      bodyText,
      targetUrl,
    })
  }

  const matchedSignals =
    responseSummary.statusCode >= 200 && responseSummary.statusCode < 300
      ? [`匿名请求返回 HTTP ${responseSummary.statusCode}`]
      : []

  return {
    matchedSignals,
    verdict:
      matchedSignals.length > 0 ? "本次 HTTP 受控验证已完成，可结合业务规则继续人工研判。" : "本次 HTTP 受控验证未命中预期响应。",
  }
}

export async function runHttpValidation({
  targetUrl,
  method = "GET",
  headers = {},
  body = "",
  validationProfile = "generic-http-validation",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  dockerTimeoutSeconds = DEFAULT_DOCKER_TIMEOUT_SECONDS,
  dockerContainerName,
  internalTargetUrl,
  adapters = {},
}) {
  const fetchImpl = adapters.fetch ?? fetch
  const execFileImpl = adapters.execFile ?? execFile

  try {
    const hostResult = await requestHostTarget({
      body,
      fetchImpl,
      headers,
      method,
      targetUrl,
      timeoutMs,
    })
    const evaluation = evaluateValidationProfile({
      bodyText: hostResult.bodyText,
      profile: validationProfile,
      responseSummary: hostResult.responseSummary,
      targetUrl,
    })

    return {
      transport: "host",
      requestSummary: hostResult.requestSummary,
      responseSummary: hostResult.responseSummary,
      matchedSignals: evaluation.matchedSignals,
      finding: evaluation.finding,
      verdict: evaluation.verdict,
    }
  } catch (hostError) {
    if (!dockerContainerName || !internalTargetUrl) {
      throw hostError
    }

    try {
      const dockerResult = await requestDockerTarget({
        body,
        dockerContainerName,
        execFileImpl,
        headers,
        internalTargetUrl,
        method,
        targetUrl,
        timeoutSeconds: dockerTimeoutSeconds,
      })
      const evaluation = evaluateValidationProfile({
        bodyText: dockerResult.bodyText,
        profile: validationProfile,
        responseSummary: dockerResult.responseSummary,
        targetUrl,
      })

      return {
        transport: "docker",
        requestSummary: dockerResult.requestSummary,
        responseSummary: dockerResult.responseSummary,
        matchedSignals: evaluation.matchedSignals,
        finding: evaluation.finding,
        verdict: evaluation.verdict,
      }
    } catch (dockerError) {
      const hostMessage = hostError instanceof Error ? hostError.message : String(hostError)
      const dockerMessage = dockerError instanceof Error ? dockerError.message : String(dockerError)
      throw new Error(`宿主机验证失败：${hostMessage}；容器内 fallback 失败：${dockerMessage}`)
    }
  }
}
