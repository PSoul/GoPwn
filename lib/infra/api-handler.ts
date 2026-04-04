import { NextResponse } from "next/server"
import { DomainError } from "@/lib/domain/errors"

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

export function apiHandler(handler: Handler): Handler {
  return async (req, ctx) => {
    try {
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
