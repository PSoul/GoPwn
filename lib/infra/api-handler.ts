import { NextResponse } from "next/server"
import { DomainError } from "@/lib/domain/errors"
import { requireAuth } from "@/lib/infra/auth"

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

interface ApiHandlerOptions {
  /** 跳过鉴权（仅用于 login/logout 等公开端点） */
  public?: boolean
}

export function apiHandler(handler: Handler, opts?: ApiHandlerOptions): Handler {
  return async (req, ctx) => {
    try {
      // 纵深防御：即使 middleware 失效也能拦截未认证请求
      if (!opts?.public) {
        await requireAuth()
      }
      return await handler(req, ctx)
    } catch (error) {
      if (error instanceof DomainError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode },
        )
      }
      console.error("[api]", error)
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL" },
        { status: 500 },
      )
    }
  }
}

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}
