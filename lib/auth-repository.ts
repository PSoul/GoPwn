import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import type { LogRecord } from "@/lib/prototype-types"

const SEEDED_CAPTCHA = "7K2Q"

const seededUsers = [
  {
    id: "user-researcher-a",
    account: "researcher@company.local",
    password: "Prototype@2026",
    displayName: "研究员席位 A",
    role: "研究员",
    status: "active",
  },
] as const

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

export function getSeededCaptcha() {
  return SEEDED_CAPTCHA
}

export function authenticateResearcher(input: {
  account: string
  password: string
  captcha: string
}) {
  if (input.captcha.trim().toUpperCase() !== SEEDED_CAPTCHA) {
    return {
      error: "验证码不正确，请重新输入。",
      user: null,
    }
  }

  const user = seededUsers.find(
    (item) => item.account === input.account.trim() && item.password === input.password,
  )

  if (!user) {
    return {
      error: "账号或密码不正确，请重新确认。",
      user: null,
    }
  }

  appendAuditLog(`${user.displayName} 登录平台`, user.displayName, "已完成")

  return {
    error: null,
    user,
  }
}

export function recordLogout(account?: string | null, displayName?: string | null) {
  appendAuditLog(`${displayName ?? account ?? "未知账号"} 退出登录`, displayName ?? account ?? "平台账号", "已记录")
}
