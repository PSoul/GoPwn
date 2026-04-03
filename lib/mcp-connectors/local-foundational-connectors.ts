import { listStoredAssets } from "@/lib/data/asset-repository"
import { listStoredEvidence } from "@/lib/data/evidence-repository"
import { throwIfExecutionAborted } from "@/lib/mcp/mcp-execution-abort"
import { getProjectPrimaryTarget } from "@/lib/project/project-targets"
import { listStoredProjectFindings } from "@/lib/project/project-results-repository"

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
    const discoveredSubdomains = [host]

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
        `Smoke test: 仅返回原始主机名，真实子域发现需通过 MCP 工具执行。`,
        host,
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
    const webEntries = targets.map((target) => ({
      url: target.startsWith("http") ? target : `https://${target}`,
      title: "(待探测)",
      statusCode: 0,
      headers: [],
      fingerprint: "(smoke test placeholder)",
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
      summaryLines: [`Smoke test: ${webEntries.length} 个占位 Web 入口，真实探测需通过 MCP 工具执行。`],
    }
  },
}

const localAuthGuardConnector: McpConnector = {
  key: "local-auth-guard-check",
  mode: "local",
  supports: ({ run }) => run.toolName === "auth-guard-check",
  execute: ({ run, signal }) => {
    throwIfExecutionAborted(signal)

    return {
      status: "succeeded",
      connectorKey: "local-auth-guard-check",
      mode: "local",
      outputs: {
        validatedTargets: [run.target],
      },
      rawOutput: ["Smoke test: 受控验证占位，真实验证需通过 MCP 工具执行。"],
      structuredContent: {
        validatedTarget: run.target,
      },
      summaryLines: [
        "Smoke test: 受控验证占位，真实验证需通过 MCP 工具执行。",
      ],
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
