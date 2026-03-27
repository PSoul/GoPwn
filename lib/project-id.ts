import { createHash, randomUUID } from "node:crypto"

export const PROJECT_ID_PATTERN = /^proj-\d{8}-[a-f0-9]{8}$/

function formatDayStamp(date: Date) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}${month}${day}`
}

function buildHexSuffix(seed = randomUUID()) {
  return createHash("sha256").update(seed).digest("hex").slice(0, 8)
}

export function isAsciiProjectId(id: string) {
  return PROJECT_ID_PATTERN.test(id)
}

export function generateProjectId(date = new Date(), seed?: string) {
  return `proj-${formatDayStamp(date)}-${buildHexSuffix(seed)}`
}
