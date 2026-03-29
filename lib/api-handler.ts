import { NextResponse } from "next/server"

/**
 * Structured API error with HTTP status code.
 * Throw this inside API handlers for controlled error responses.
 */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
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
          { error: error.message },
          { status: error.statusCode },
        )
      }

      const message = error instanceof Error ? error.message : String(error)
      console.error(`[API] Unhandled error: ${request.method} ${request.url}`, message)

      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      )
    }
  }
}
