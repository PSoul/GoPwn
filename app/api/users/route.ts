import { NextResponse } from "next/server"

import { withApiHandler, ApiError } from "@/lib/infra/api-handler"
import { listUsers, createUser } from "@/lib/auth/auth-repository"
import { readSessionFromCookieHeader } from "@/lib/auth/auth-session"
import type { UserRole } from "@/lib/prototype-types"

export const GET = withApiHandler(async (request) => {
  const session = await readSessionFromCookieHeader(request.headers.get("cookie"))
  if (!session) throw new ApiError(401, "未登录")

  const users = await listUsers()
  return NextResponse.json({ items: users, total: users.length })
})

export const POST = withApiHandler(async (request) => {
  const session = await readSessionFromCookieHeader(request.headers.get("cookie"))
  if (!session) throw new ApiError(401, "未登录")
  if (session.role !== "admin") throw new ApiError(403, "仅管理员可创建用户")

  const body = await request.json()
  const { email, password, displayName, role } = body as {
    email?: string
    password?: string
    displayName?: string
    role?: UserRole
  }

  if (!email || !password || !displayName || !role) {
    throw new ApiError(400, "缺少必要字段: email, password, displayName, role")
  }

  if (!["admin", "researcher", "approver"].includes(role)) {
    throw new ApiError(400, "无效的角色")
  }

  if (password.length < 8) {
    throw new ApiError(400, "密码长度不能少于 8 位")
  }

  const result = await createUser({ email, password, displayName, role })
  if (result.error) throw new ApiError(409, result.error)

  return NextResponse.json({ user: result.user }, { status: 201 })
})
