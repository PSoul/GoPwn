import { requireAuth } from "@/lib/infra/auth"
import { createPgListener } from "@/lib/infra/pg-listener"

export const dynamic = "force-dynamic"

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  // 鉴权：SSE 长连接必须在代码层验证，不能仅依赖 middleware
  try {
    await requireAuth()
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const { projectId } = await params
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", projectId })}\n\n`))

      let heartbeat: ReturnType<typeof setInterval> | null = null

      try {
        const listener = await createPgListener(
          "project_events",
          (payload) => {
            try {
              const event = JSON.parse(payload)
              if (event.projectId === projectId) {
                controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
              }
            } catch { /* skip malformed */ }
          },
          // onError: PG connection dropped — close stream so client reconnects
          () => {
            if (heartbeat) clearInterval(heartbeat)
            try { controller.close() } catch {}
          },
        )

        heartbeat = setInterval(() => {
          try { controller.enqueue(encoder.encode(": heartbeat\n\n")) }
          catch { if (heartbeat) clearInterval(heartbeat) }
        }, 15000)

        req.signal.addEventListener("abort", () => {
          if (heartbeat) clearInterval(heartbeat)
          listener.close().catch(() => {})
          try { controller.close() } catch {}
        })
      } catch (err) {
        // PG connection failed — close the stream immediately
        console.error("[sse] failed to create pg listener:", err instanceof Error ? err.message : err)
        try { controller.close() } catch {}
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
