import { NextResponse } from "next/server"

export type ApiErrorCode =
  | "VALIDATION"
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "INTERNAL"
  | "SERVICE_UNAVAILABLE"

const STATUS_TO_CODE: Record<number, ApiErrorCode> = {
  400: "VALIDATION",
  401: "AUTH_REQUIRED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  429: "RATE_LIMITED",
  500: "INTERNAL",
  503: "SERVICE_UNAVAILABLE",
}

/**
 * Structured API error with HTTP status code and machine-readable error code.
 * Throw this inside API handlers for controlled error responses.
 */
export class ApiError extends Error {
  public readonly code: ApiErrorCode

  constructor(
    public readonly statusCode: number,
    message: string,
    code?: ApiErrorCode,
  ) {
    super(message)
    this.name = "ApiError"
    this.code = code ?? STATUS_TO_CODE[statusCode] ?? "INTERNAL"
  }
}

type RouteContext = { params: Promise<Record<string, string>> }

type HandlerFn = (request: Request, context: RouteContext) => Promise<Response>

/**
 * Wraps an API route handler with unified error handling.
 *
 * - Catches thrown `ApiError` and returns its statusCode + message
 * - Catches unexpected errors and returns a generic 500
 * - Logs unexpected errors to stderr for server-side observability
 */
export function withApiHandler(handler: HandlerFn): HandlerFn {
  return async (request: Request, context: RouteContext) => {
    try {
      return await handler(request, context)
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode },
        )
      }

      const message = error instanceof Error ? error.message : String(error)
      console.error(`[API] Unhandled error: ${request.method} ${request.url}`, message)

      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL" as ApiErrorCode },
        { status: 500 },
      )
    }
  }
}
