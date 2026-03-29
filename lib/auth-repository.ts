import bcrypt from "bcryptjs"

import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import type { LogRecord, UserRecord, UserRole } from "@/lib/prototype-types"

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

// --------------- 用户管理 ---------------

/** Default seed users — created when user store is empty */
const DEFAULT_SEED_USERS: Array<Omit<UserRecord, "id" | "createdAt">> = [
  {
    email: "researcher@company.local",
    passwordHash: bcrypt.hashSync("Prototype@2026", 10),
    displayName: "研究员席位 A",
    role: "researcher",
    status: "active",
  },
]

function generateUserId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatTimestamp(date = new Date()) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

/**
 * Ensure at least the seed users exist. Also creates an admin user
 * from env vars if ADMIN_EMAIL is set and no admin exists yet.
 */
export function ensureSeedUsers(): void {
  const store = readPrototypeStore()
  let changed = false

  // Seed default users if store is empty
  if (store.users.length === 0) {
    for (const seed of DEFAULT_SEED_USERS) {
      store.users.push({
        id: generateUserId(),
        ...seed,
        createdAt: formatTimestamp(),
      })
    }
    changed = true
  }

  // Create admin from env vars if configured and no admin exists yet
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD
  if (adminEmail && adminPassword) {
    const existingAdmin = store.users.find((u) => u.email === adminEmail)
    if (!existingAdmin) {
      store.users.push({
        id: generateUserId(),
        email: adminEmail,
        passwordHash: bcrypt.hashSync(adminPassword, 10),
        displayName: process.env.ADMIN_DISPLAY_NAME || "管理员",
        role: "admin",
        status: "active",
        createdAt: formatTimestamp(),
      })
      changed = true
    }
  }

  if (changed) {
    writePrototypeStore(store)
  }
}

function stripPasswordHash(user: UserRecord): Omit<UserRecord, "passwordHash"> {
  const { passwordHash, ...rest } = user
  void passwordHash
  return rest
}

export function listUsers(): Omit<UserRecord, "passwordHash">[] {
  const store = readPrototypeStore()
  return store.users.map(stripPasswordHash)
}

export function getUserById(id: string): Omit<UserRecord, "passwordHash"> | null {
  const store = readPrototypeStore()
  const user = store.users.find((u) => u.id === id)
  if (!user) return null
  return stripPasswordHash(user)
}

export function createUser(input: {
  email: string
  password: string
  displayName: string
  role: UserRole
}): { error: string | null; user: Omit<UserRecord, "passwordHash"> | null } {
  const store = readPrototypeStore()

  // Check duplicate email
  if (store.users.some((u) => u.email === input.email)) {
    return { error: "该邮箱已被注册", user: null }
  }

  const newUser: UserRecord = {
    id: generateUserId(),
    email: input.email,
    passwordHash: bcrypt.hashSync(input.password, 10),
    displayName: input.displayName,
    role: input.role,
    status: "active",
    createdAt: formatTimestamp(),
  }

  store.users.push(newUser)
  writePrototypeStore(store)

  return { error: null, user: stripPasswordHash(newUser) }
}

export function updateUser(
  id: string,
  patch: { displayName?: string; role?: UserRole; status?: "active" | "disabled"; password?: string },
): { error: string | null; user: Omit<UserRecord, "passwordHash"> | null } {
  const store = readPrototypeStore()
  const idx = store.users.findIndex((u) => u.id === id)
  if (idx === -1) return { error: "用户不存在", user: null }

  const user = store.users[idx]
  if (patch.displayName !== undefined) user.displayName = patch.displayName
  if (patch.role !== undefined) user.role = patch.role
  if (patch.status !== undefined) user.status = patch.status
  if (patch.password) user.passwordHash = bcrypt.hashSync(patch.password, 10)

  store.users[idx] = user
  writePrototypeStore(store)

  return { error: null, user: stripPasswordHash(user) }
}

// --------------- 审计日志 ---------------

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

// --------------- 认证 ---------------

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

  // Ensure seed users exist on first login attempt
  ensureSeedUsers()

  const store = readPrototypeStore()
  const user = store.users.find((u) => u.email === input.account.trim())

  if (!user || !bcrypt.compareSync(input.password, user.passwordHash)) {
    return {
      error: "账号或密码不正确，请重新确认。",
      user: null,
    }
  }

  if (user.status === "disabled") {
    return {
      error: "该账号已被禁用，请联系管理员。",
      user: null,
    }
  }

  // Update last login time
  user.lastLoginAt = formatTimestamp()
  writePrototypeStore(store)

  appendAuditLog(`${user.displayName} 登录平台`, user.displayName, "已完成")

  return {
    error: null,
    user: {
      id: user.id,
      account: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
    },
  }
}

export function recordLogout(account?: string | null, displayName?: string | null) {
  appendAuditLog(`${displayName ?? account ?? "未知账号"} 退出登录`, displayName ?? account ?? "平台账号", "已记录")
}
