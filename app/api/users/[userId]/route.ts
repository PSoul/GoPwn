import { NextResponse } from "next/server"

import { withApiHandler, ApiError } from "@/lib/infra/api-handler"
import { getUserById, updateUser } from "@/lib/auth/auth-repository"
import { readSessionFromCookieHeader } from "@/lib/auth/auth-session"
import type { UserRole } from "@/lib/prototype-types"

export const GET = withApiHandler(async (request, context) => {
  const session = await readSessionFromCookieHeader(request.headers.get("cookie"))
  if (!session) throw new ApiError(401, "未登录")

  const { userId } = await context.params
  const user = await getUserById(userId)
  if (!user) throw new ApiError(404, "用户不存在")

  return NextResponse.json({ user })
})

export const PATCH = withApiHandler(async (request, context) => {
  const session = await readSessionFromCookieHeader(request.headers.get("cookie"))
  if (!session) throw new ApiError(401, "未登录")

  const { userId } = await context.params

  // Only admins can update other users; users can update their own display name
  const isSelf = session.userId === userId
  const isAdmin = session.role === "admin"
  if (!isSelf && !isAdmin) throw new ApiError(403, "无权操作")

  const body = await request.json()
  const patch: { displayName?: string; role?: UserRole; status?: "active" | "disabled"; password?: string } = {}

  if (body.displayName !== undefined) patch.displayName = body.displayName
  if (body.password !== undefined) {
    if (typeof body.password !== "string" || body.password.length < 8) {
      throw new ApiError(400, "密码长度不能少于 8 位")
    }
    patch.password = body.password
  }

  // Only admins can change role and status
  if (isAdmin) {
    if (body.role !== undefined) patch.role = body.role
    if (body.status !== undefined) patch.status = body.status
  }

  const result = await updateUser(userId, patch)
  if (result.error) throw new ApiError(400, result.error)

  return NextResponse.json({ user: result.user })
})
