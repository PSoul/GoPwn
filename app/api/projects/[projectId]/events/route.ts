import { createPgListener } from "@/lib/infra/pg-listener"

export const dynamic = "force-dynamic"

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", projectId })}\n\n`))

      const listener = await createPgListener("project_events", (payload) => {
        try {
          const event = JSON.parse(payload)
          if (event.projectId === projectId) {
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
          }
        } catch { /* skip malformed */ }
      })

      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(": heartbeat\n\n")) }
        catch { clearInterval(heartbeat) }
      }, 15000)

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat)
        listener.close().catch(() => {})
        try { controller.close() } catch {}
      })
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
