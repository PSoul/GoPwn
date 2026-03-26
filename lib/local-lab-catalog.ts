import { formatTimestamp } from "@/lib/prototype-record-utils"
import type { LocalLabRecord } from "@/lib/prototype-types"

type LocalLabListOptions = {
  probe?: boolean
}

const localLabSeed: Omit<LocalLabRecord, "status">[] = [
  {
    id: "juice-shop",
    name: "OWASP Juice Shop",
    description: "现代前后端一体化漏洞靶场，适合做本地 Web/API 低风险识别与审批链验证。",
    baseUrl: "http://127.0.0.1:3000",
    healthUrl: "http://127.0.0.1:3000",
    image: "bkimminich/juice-shop",
    ports: ["127.0.0.1:3000->3000"],
  },
  {
    id: "webgoat",
    name: "OWASP WebGoat",
    description: "经典教学靶场，适合后续扩展到更复杂的教学型验证与审批场景。",
    baseUrl: "http://127.0.0.1:8080/WebGoat",
    healthUrl: "http://127.0.0.1:8080/WebGoat",
    image: "webgoat/webgoat",
    ports: ["127.0.0.1:8080->8080", "127.0.0.1:9090->9090"],
  },
]

async function probeUrl(url: string) {
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), 2500)

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    })

    return response.ok ? ("online" as const) : ("offline" as const)
  } catch {
    return "offline" as const
  } finally {
    clearTimeout(timeoutHandle)
  }
}

export async function listLocalLabs(options: LocalLabListOptions = {}) {
  if (!options.probe) {
    return localLabSeed.map((lab) => ({
      ...lab,
      status: "unknown" as const,
    }))
  }

  const statuses = await Promise.all(localLabSeed.map((lab) => probeUrl(lab.healthUrl)))

  return localLabSeed.map((lab, index) => ({
    ...lab,
    status: statuses[index],
  }))
}

export async function getLocalLabById(labId: string, options: LocalLabListOptions = {}) {
  const labs = await listLocalLabs(options)

  return labs.find((lab) => lab.id === labId) ?? null
}

export function buildLocalLabPlanSummary(lab: LocalLabRecord, count: number) {
  return `${formatTimestamp()} 已为 ${lab.name} 生成 ${count} 条本地验证动作。`
}
