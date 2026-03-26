import { resolve4, resolve6, resolveMx, resolveNs, resolveTxt, reverse } from "node:dns/promises"
import tls from "node:tls"

import { getHostFromTarget, getRootDomain } from "@/lib/mcp-connectors/local-foundational-connectors"
import type { McpConnector, McpConnectorExecutionContext, McpConnectorResult } from "@/lib/mcp-connectors/types"

type CertificateSummary = {
  fingerprint256?: string
  issuer?: Record<string, string | string[]>
  subject?: Record<string, string | string[]>
  subjectaltname?: string
  valid_from?: string
  valid_to?: string
}

type RealDnsConnectorAdapters = {
  resolve4: typeof resolve4
  resolve6: typeof resolve6
  resolveMx: typeof resolveMx
  resolveNs: typeof resolveNs
  resolveTxt: typeof resolveTxt
  reverse: typeof reverse
  probeCertificate: (host: string) => Promise<CertificateSummary | null>
}

let adapters: RealDnsConnectorAdapters = {
  resolve4,
  resolve6,
  resolveMx,
  resolveNs,
  resolveTxt,
  reverse,
  probeCertificate,
}

function isIpAddress(value: string) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(value) || value.includes(":")
}

function isCidr(value: string) {
  return value.includes("/")
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

async function safeResolve<T>(resolver: () => Promise<T>, fallback: T) {
  try {
    return await resolver()
  } catch {
    return fallback
  }
}

function parseCertificateDnsNames(subjectAltName?: string) {
  if (!subjectAltName) {
    return []
  }

  return subjectAltName
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.startsWith("DNS:"))
    .map((item) => item.replace(/^DNS:/, "").replace(/^\*\./, ""))
    .filter(Boolean)
}

function flattenTxtRecords(records: string[][]) {
  return records.map((parts) => parts.join(""))
}

async function probeCertificate(host: string) {
  return new Promise<CertificateSummary | null>((resolve) => {
    const socket = tls.connect(
      {
        host,
        port: 443,
        servername: host,
        rejectUnauthorized: false,
      },
      () => {
        const certificate = socket.getPeerCertificate()
        socket.end()

        if (!certificate || Object.keys(certificate).length === 0) {
          resolve(null)
          return
        }

        resolve({
          fingerprint256: certificate.fingerprint256,
          issuer: certificate.issuer,
          subject: certificate.subject,
          subjectaltname: certificate.subjectaltname,
          valid_from: certificate.valid_from,
          valid_to: certificate.valid_to,
        })
      },
    )

    socket.setTimeout(4000, () => {
      socket.destroy()
      resolve(null)
    })

    socket.on("error", () => {
      resolve(null)
    })
  })
}

async function executeRealDnsCollection(context: McpConnectorExecutionContext): Promise<McpConnectorResult> {
  const rawTarget = context.run.target || context.project.seed
  const host = getHostFromTarget(rawTarget)

  if (!host || isCidr(rawTarget)) {
    return {
      status: "failed",
      connectorKey: "real-dns-intelligence",
      mode: "real",
      errorMessage: "当前目标不是可执行 DNS 情报采集的单一主机名或 IP。",
      summaryLines: ["当前目标更适合走本地基础连接器或后续网段能力族，不进入真实 DNS 采集。"],
    }
  }

  if (isIpAddress(host)) {
    const reverseHostnames = await safeResolve(() => adapters.reverse(host), [] as string[])
    const discoveredSubdomains = reverseHostnames.length ? reverseHostnames : [host]

    return {
      status: "succeeded",
      connectorKey: "real-dns-intelligence",
      mode: "real",
      outputs: {
        discoveredSubdomains,
      },
      rawOutput: reverseHostnames.map((item) => `PTR ${host} -> ${item}`),
      structuredContent: {
        discoveredSubdomains,
        resolvedAddresses: [host],
        reverseHostnames,
        source: host,
      },
      summaryLines: [
        reverseHostnames.length > 0
          ? `已对 ${host} 完成真实 PTR 反查，得到 ${reverseHostnames.length} 条主机名线索。`
          : `已对 ${host} 发起真实 PTR 反查，但未命中可用主机名，保留原 IP 作为资产候选。`,
      ],
    }
  }

  const rootDomain = getRootDomain(host)
  const [aRecords, aaaaRecords, mxRecords, nsRecords, txtRecords, certificate] = await Promise.all([
    safeResolve(() => adapters.resolve4(host), [] as string[]),
    safeResolve(() => adapters.resolve6(host), [] as string[]),
    safeResolve(() => adapters.resolveMx(host), [] as Awaited<ReturnType<typeof resolveMx>>),
    safeResolve(() => adapters.resolveNs(host), [] as string[]),
    safeResolve(() => adapters.resolveTxt(host), [] as string[][]),
    adapters.probeCertificate(host),
  ])

  const resolvedAddresses = uniqueStrings([...aRecords, ...aaaaRecords])
  const reverseHostnames = uniqueStrings(
    (
      await Promise.all(
        resolvedAddresses.map((address) => safeResolve(() => adapters.reverse(address), [] as string[])),
      )
    ).flat(),
  )
  const certificateDnsNames = parseCertificateDnsNames(certificate?.subjectaltname)
  const mxHostnames = mxRecords.map((record) => record.exchange)
  const discoveredSubdomains = uniqueStrings([
    host,
    ...certificateDnsNames.filter((item) => item === rootDomain || item.endsWith(`.${rootDomain}`)),
    ...mxHostnames.filter((item) => item === rootDomain || item.endsWith(`.${rootDomain}`)),
    ...nsRecords.filter((item) => item === rootDomain || item.endsWith(`.${rootDomain}`)),
    ...reverseHostnames.filter((item) => item === rootDomain || item.endsWith(`.${rootDomain}`)),
  ])
  const txtValues = flattenTxtRecords(txtRecords)
  const rawOutput = [
    ...aRecords.map((record) => `A ${host} -> ${record}`),
    ...aaaaRecords.map((record) => `AAAA ${host} -> ${record}`),
    ...mxRecords.map((record) => `MX ${host} -> ${record.exchange} (${record.priority})`),
    ...nsRecords.map((record) => `NS ${host} -> ${record}`),
    ...txtValues.map((record) => `TXT ${host} -> ${record}`),
    ...reverseHostnames.map((record) => `PTR -> ${record}`),
    certificate?.fingerprint256 ? `TLS ${host} -> ${certificate.fingerprint256}` : "",
  ].filter(Boolean)

  return {
    status: "succeeded",
    connectorKey: "real-dns-intelligence",
    mode: "real",
    outputs: {
      discoveredSubdomains: discoveredSubdomains.length > 0 ? discoveredSubdomains : [host],
    },
    rawOutput,
    structuredContent: {
      certificate,
      discoveredSubdomains: discoveredSubdomains.length > 0 ? discoveredSubdomains : [host],
      mxRecords,
      nsRecords,
      resolvedAddresses,
      reverseHostnames,
      rootDomain,
      source: host,
      txtRecords: txtValues,
    },
    summaryLines: [
      `已通过真实 DNS / TLS 采集 ${host} 的被动情报。`,
      `域名候选 ${Math.max(discoveredSubdomains.length, 1)} 条，解析地址 ${resolvedAddresses.length} 条，证书 ${certificate ? "已获取" : "未获取"}。`,
    ],
  }
}

export function setRealDnsConnectorTestAdapters(patch: Partial<RealDnsConnectorAdapters>) {
  adapters = {
    ...adapters,
    ...patch,
  }
}

export function resetRealDnsConnectorTestAdapters() {
  adapters = {
    resolve4,
    resolve6,
    resolveMx,
    resolveNs,
    resolveTxt,
    reverse,
    probeCertificate,
  }
}

export const realDnsIntelligenceConnector: McpConnector = {
  key: "real-dns-intelligence",
  mode: "real",
  supports: ({ project, run }) => {
    const rawTarget = run.target || project.seed
    const host = getHostFromTarget(rawTarget)

    return run.toolName === "dns-census" && Boolean(host) && !isCidr(rawTarget)
  },
  execute: executeRealDnsCollection,
}
