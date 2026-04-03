import bcrypt from "bcryptjs"

import { prisma } from "@/lib/infra/prisma"
import { toUserRecord } from "@/lib/infra/prisma-transforms"
import type { UserRecord, UserRole } from "@/lib/prototype-types"

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

export async function generateCaptcha(): Promise<{ captchaId: string; code: string }> {
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

/**
 * Ensure at least the seed users exist. Also creates an admin user
 * from env vars if ADMIN_EMAIL is set and no admin exists yet.
 */
export async function ensureSeedUsers(): Promise<void> {
  const existing = await prisma.user.findMany()
  if (existing.length === 0) {
    for (const seed of DEFAULT_SEED_USERS) {
      await prisma.user.create({
        data: {
          account: seed.email,
          password: seed.passwordHash,
          displayName: seed.displayName,
          role: seed.role,
          status: seed.status,
        },
      })
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD
  if (adminEmail && adminPassword) {
    const existingAdmin = await prisma.user.findFirst({ where: { account: adminEmail } })
    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          account: adminEmail,
          password: bcrypt.hashSync(adminPassword, 10),
          displayName: process.env.ADMIN_DISPLAY_NAME || "管理员",
          role: "admin",
          status: "active",
        },
      })
    }
  }
}

function stripPasswordHash(user: UserRecord): Omit<UserRecord, "passwordHash"> {
  const { passwordHash, ...rest } = user
  void passwordHash
  return rest
}

export async function listUsers(): Promise<Omit<UserRecord, "passwordHash">[]> {
  const rows = await prisma.user.findMany()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows.map((r: any) => stripPasswordHash(toUserRecord(r)))
}

export async function getUserById(id: string): Promise<Omit<UserRecord, "passwordHash"> | null> {
  const row = await prisma.user.findUnique({ where: { id } })
  if (!row) return null
  return stripPasswordHash(toUserRecord(row))
}

export async function createUser(input: {
  email: string
  password: string
  displayName: string
  role: UserRole
}): Promise<{ error: string | null; user: Omit<UserRecord, "passwordHash"> | null }> {
  const existing = await prisma.user.findFirst({ where: { account: input.email } })
  if (existing) {
    return { error: "该邮箱已被注册", user: null }
  }
  const row = await prisma.user.create({
    data: {
      account: input.email,
      password: bcrypt.hashSync(input.password, 10),
      displayName: input.displayName,
      role: input.role,
      status: "active",
    },
  })
  return { error: null, user: stripPasswordHash(toUserRecord(row)) }
}

export async function updateUser(
  id: string,
  patch: { displayName?: string; role?: UserRole; status?: "active" | "disabled"; password?: string },
): Promise<{ error: string | null; user: Omit<UserRecord, "passwordHash"> | null }> {
  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) return { error: "用户不存在", user: null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}
  if (patch.displayName !== undefined) data.displayName = patch.displayName
  if (patch.role !== undefined) data.role = patch.role
  if (patch.status !== undefined) data.status = patch.status
  if (patch.password) data.password = bcrypt.hashSync(patch.password, 10)

  const row = await prisma.user.update({ where: { id }, data })
  return { error: null, user: stripPasswordHash(toUserRecord(row)) }
}

// --------------- 审计日志 ---------------

async function appendAuditLog(summary: string, actor: string, status: string) {
  await prisma.auditLog.create({
    data: {
      id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      category: "认证与会话",
      summary,
      actor,
      status,
    },
  })
}

// --------------- 认证 ---------------

export async function authenticateResearcher(input: {
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
  await ensureSeedUsers()

  const row = await prisma.user.findFirst({ where: { account: input.account.trim() } })

  if (!row || !bcrypt.compareSync(input.password, row.password)) {
    return {
      error: "账号或密码不正确，请重新确认。",
      user: null,
    }
  }

  if (row.status === "disabled") {
    return {
      error: "该账号已被禁用，请联系管理员。",
      user: null,
    }
  }

  // Prisma User model has no lastLoginAt — updatedAt serves as proxy
  await prisma.user.update({ where: { id: row.id }, data: { updatedAt: new Date() } })

  await appendAuditLog(`${row.displayName} 登录平台`, row.displayName, "已完成")

  return {
    error: null,
    user: {
      id: row.id,
      account: row.account,
      displayName: row.displayName,
      role: row.role,
      status: row.status,
    },
  }
}

export async function recordLogout(account?: string | null, displayName?: string | null) {
  await appendAuditLog(`${displayName ?? account ?? "未知账号"} 退出登录`, displayName ?? account ?? "平台账号", "已记录")
}
