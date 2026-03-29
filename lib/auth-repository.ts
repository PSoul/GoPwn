import bcrypt from "bcryptjs"

import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import type { LogRecord } from "@/lib/prototype-types"

const CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const CAPTCHA_LENGTH = 4

/**
 * In-memory captcha store. Attached to globalThis so it survives Next.js
 * dev-mode hot reloads. In production this should be backed by a
 * short-lived cache (Redis / DB) so it survives multi-instance deployments.
 */
const globalForCaptcha = globalThis as unknown as {
  __captchaStore?: Map<string, { code: string; expiresAt: number }>
}
const captchaStore = (globalForCaptcha.__captchaStore ??= new Map())

export function generateCaptcha(): { captchaId: string; code: string } {
  const code = Array.from({ length: CAPTCHA_LENGTH }, () =>
    CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)],
  ).join("")
  const captchaId = `cap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  captchaStore.set(captchaId, { code, expiresAt: Date.now() + 5 * 60 * 1000 })

  // Purge expired entries
  for (const [key, value] of captchaStore) {
    if (value.expiresAt < Date.now()) captchaStore.delete(key)
  }

  return { captchaId, code }
}

function verifyCaptcha(captchaId: string, userInput: string): boolean {
  // In E2E test mode, accept any captcha to avoid timing issues
  if (process.env.E2E_TEST_MODE === "true") return true

  const entry = captchaStore.get(captchaId)
  if (!entry) return false
  captchaStore.delete(captchaId) // one-time use
  if (entry.expiresAt < Date.now()) return false
  return entry.code === userInput.trim().toUpperCase()
}

// Pre-hashed passwords for seeded users (bcrypt cost 10)
// Original: "Prototype@2026"
const SEEDED_PASSWORD_HASH = bcrypt.hashSync("Prototype@2026", 10)

const seededUsers = [
  {
    id: "user-researcher-a",
    account: "researcher@company.local",
    passwordHash: SEEDED_PASSWORD_HASH,
    displayName: "研究员席位 A",
    role: "研究员",
    status: "active" as const,
  },
]

function formatTimestamp(date = new Date()) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function appendAuditLog(summary: string, actor: string, status: string) {
  const store = readPrototypeStore()
  const log: LogRecord = {
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    category: "认证与会话",
    summary,
    actor,
    timestamp: formatTimestamp(),
    status,
  }

  store.auditLogs.unshift(log)
  writePrototypeStore(store)
}

export function authenticateResearcher(input: {
  account: string
  password: string
  captcha: string
  captchaId: string
}) {
  if (!verifyCaptcha(input.captchaId, input.captcha)) {
    return {
      error: "验证码不正确或已过期，请刷新后重新输入。",
      user: null,
    }
  }

  const user = seededUsers.find((item) => item.account === input.account.trim())

  if (!user || !bcrypt.compareSync(input.password, user.passwordHash)) {
    return {
      error: "账号或密码不正确，请重新确认。",
      user: null,
    }
  }

  appendAuditLog(`${user.displayName} 登录平台`, user.displayName, "已完成")

  return {
    error: null,
    user: {
      id: user.id,
      account: user.account,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
    },
  }
}

export function recordLogout(account?: string | null, displayName?: string | null) {
  appendAuditLog(`${displayName ?? account ?? "未知账号"} 退出登录`, displayName ?? account ?? "平台账号", "已记录")
}
