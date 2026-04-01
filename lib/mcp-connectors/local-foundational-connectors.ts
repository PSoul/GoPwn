import { listStoredAssets } from "@/lib/asset-repository"
import { listStoredEvidence } from "@/lib/evidence-repository"
import { throwIfExecutionAborted } from "@/lib/mcp-execution-abort"
import { getProjectPrimaryTarget } from "@/lib/project-targets"
import { listStoredProjectFindings } from "@/lib/project-results-repository"

import type { McpConnector } from "@/lib/mcp-connectors/types"

export function normalizeSeed(seed: string) {
  const cleaned = seed.trim().toLowerCase().replace(/^https?:\/\//, "")
  const [hostWithMaybePath] = cleaned.split("?")
  const [host] = hostWithMaybePath.split("/")

  return {
    cleaned,
    host,
    normalizedTargets: Array.from(new Set([cleaned, host].filter(Boolean))),
  }
}

export function getRootDomain(host: string) {
  const parts = host.split(".").filter(Boolean)

  if (parts.length >= 2) {
    return parts.slice(-2).join(".")
  }

  return host
}

export function getHostFromTarget(target: string) {
  if (target.startsWith("http://") || target.startsWith("https://")) {
    try {
      return new URL(target).host
    } catch {
      return normalizeSeed(target).host
    }
  }

  return normalizeSeed(target).host
}

const seedNormalizerConnector: McpConnector = {
  key: "local-seed-normalizer",
  mode: "local",
  supports: ({ run }) => run.toolName === "seed-normalizer",
  execute: ({ project, run, signal }) => {
    throwIfExecutionAborted(signal)

    const normalized = normalizeSeed(run.target || getProjectPrimaryTarget(project)).normalizedTargets

    return {
      status: "succeeded",
      connectorKey: "local-seed-normalizer",
      mode: "local",
      outputs: {
        normalizedTargets: normalized,
      },
      rawOutput: normalized.map((target) => `normalized: ${target}`),
      structuredContent: {
        host: normalizeSeed(run.target || getProjectPrimaryTarget(project)).host,
        normalizedTargets: normalized,
      },
      summaryLines: [`标准化得到 ${normalized.length} 个种子目标。`, normalized.join(" / ")],
    }
  },
}

// 以下本地 connector 仅用于 smoke workflow 测试夹具，不参与真实编排器流程。
// 真实编排器流程要求 LLM 已配置，且使用真实 MCP 工具（stdio connector）执行。

const localDnsConnector: McpConnector = {
  key: "local-dns-census",
  mode: "local",
  supports: ({ run }) => run.toolName === "dns-census",
  execute: ({ project, run, signal }) => {
    throwIfExecutionAborted(signal)

    const host = getHostFromTarget(run.target || getProjectPrimaryTarget(project))
    const root = getRootDomain(host)
    const discoveredSubdomains = Array.from(new Set([host, `admin.${root}`, `assets.${root}`]))

    return {
      status: "succeeded",
      connectorKey: "local-dns-census",
      mode: "local",
      outputs: {
        discoveredSubdomains,
      },
      rawOutput: discoveredSubdomains.map((target) => `subdomain: ${target}`),
      structuredContent: {
        discoveredSubdomains,
        rootDomain: root,
        source: host,
      },
      summaryLines: [
        `被动发现 ${discoveredSubdomains.length} 个候选域名或子域。`,
        discoveredSubdomains.join(" / "),
      ],
    }
  },
}

const localWebSurfaceConnector: McpConnector = {
  key: "local-web-surface-map",
  mode: "local",
  supports: ({ run }) => run.toolName === "web-surface-map",
  execute: ({ priorOutputs, project, run, signal }) => {
    throwIfExecutionAborted(signal)

    const targets = priorOutputs.discoveredSubdomains?.length
      ? priorOutputs.discoveredSubdomains
      : [getHostFromTarget(run.target || getProjectPrimaryTarget(project))]
    const webEntries = targets.map((target, index) => ({
      url: index === 0 ? `https://${target}/login` : `https://${target}/dashboard`,
      title: index === 0 ? `${project.name} 统一入口` : `${project.name} 管理台`,
      statusCode: index === 0 ? 200 : 302,
      headers: [
        "server: nginx",
        "x-powered-by: Next.js",
        index === 0 ? "x-frame-options: deny" : "location: /dashboard",
      ],
      fingerprint: index === 0 ? "Next.js + nginx 登录入口" : "管理台跳转入口",
    }))

    return {
      status: "succeeded",
      connectorKey: "local-web-surface-map",
      mode: "local",
      outputs: {
        webEntries: webEntries.map((entry) => entry.url),
      },
      rawOutput: webEntries.flatMap((entry) => [`url: ${entry.url}`, `title: ${entry.title}`]),
      structuredContent: {
        webEntries,
      },
      summaryLines: [`识别到 ${webEntries.length} 个 Web 入口。`, webEntries.map((entry) => entry.url).join(" / ")],
    }
  },
}

const localAuthGuardConnector: McpConnector = {
  key: "local-auth-guard-check",
  mode: "local",
  supports: ({ run }) => run.toolName === "auth-guard-check",
  execute: ({ run, signal }) => {
    throwIfExecutionAborted(signal)

    const validatedTarget = run.target
    const findingTitle = run.requestedAction.includes("登录")
      ? "登录链路存在受控认证绕过候选"
      : "匿名接口存在鉴权防护缺口候选"
    const responseSignals = run.requestedAction.includes("登录")
      ? [
          "GET /login -> 200",
          "POST /login?preview=1 返回 legacy-auth 调试头",
          "跳转链路暴露 dashboard 前置上下文标识",
        ]
      : [
          "GET /report/list -> 200",
          "响应头暴露内部 trace id",
          "匿名请求可抵达预期资源模型",
        ]

    return {
      status: "succeeded",
      connectorKey: "local-auth-guard-check",
      mode: "local",
      outputs: {
        validatedTargets: [validatedTarget],
        generatedFindings: [findingTitle],
      },
      rawOutput: responseSignals,
      structuredContent: {
        validatedTarget,
        finding: {
          affectedSurface: validatedTarget,
          severity: "高危",
          status: "待复核",
          summary: "审批通过后的受控验证命中高价值异常响应，需要继续结合证据和人工复核形成最终结论。",
          title: findingTitle,
        },
        responseSignals,
        verdict: "当前结果先进入漏洞与发现列表，等待研究员继续复核证据。",
      },
      summaryLines: ["审批通过后的受控验证已执行，产生了新的高价值结果。", findingTitle],
    }
  },
}

const localReportExporterConnector: McpConnector = {
  key: "local-report-exporter",
  mode: "local",
  supports: ({ run }) => run.toolName === "report-exporter",
  execute: async ({ priorOutputs, project, signal }) => {
    throwIfExecutionAborted(signal)

    const reportDigest = [
      `种子目标 ${priorOutputs.normalizedTargets?.length ?? 0} 个`,
      `域名与入口 ${(await listStoredAssets(project.id)).length} 条`,
      `证据记录 ${(await listStoredEvidence(project.id)).length} 条`,
      `漏洞与发现 ${(await listStoredProjectFindings(project.id)).length} 条`,
    ]

    return {
      status: "succeeded",
      connectorKey: "local-report-exporter",
      mode: "local",
      outputs: {
        reportDigest,
      },
      rawOutput: reportDigest,
      structuredContent: {
        reportDigest,
      },
      summaryLines: ["已生成基础流程测试报告摘要。", reportDigest.join("；")],
    }
  },
}

export const localFoundationalConnectors: McpConnector[] = [
  seedNormalizerConnector,
  localDnsConnector,
  localWebSurfaceConnector,
  localAuthGuardConnector,
  localReportExporterConnector,
]
