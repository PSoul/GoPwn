import { NextRequest } from "next/server"
import type { RequestInit as NextRequestInit } from "next/dist/server/web/spec-extension/request"
import { signToken } from "@/lib/infra/auth"

// 构造带 auth cookie 的 NextRequest
export async function createAuthRequest(
  url: string,
  options: NextRequestInit & {
    userId?: string
    account?: string
    role?: string
  } = {},
) {
  const {
    userId = "user-1",
    account = "researcher",
    role = "researcher",
    ...init
  } = options
  const token = await signToken({ userId, account, role })
  const req = new NextRequest(new URL(url, "http://localhost:3000"), init)
  req.cookies.set("pentest_token", token)
  return req
}

// 无 auth cookie 的 NextRequest
export function createAnonRequest(url: string, options: NextRequestInit = {}) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options)
}

// 构造 route ctx（params）
export function routeCtx(params: Record<string, string>) {
  return { params: Promise.resolve(params) }
}
