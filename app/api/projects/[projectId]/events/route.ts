import { subscribeProjectEvents } from "@/lib/infra/project-event-bus"
import { getStoredProjectById } from "@/lib/project/project-repository"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const project = await getStoredProjectById(projectId)

  if (!project) {
    return Response.json({ error: `Project '${projectId}' not found` }, { status: 404 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", projectId })}\n\n`))

      // Subscribe to project events
      const unsubscribe = subscribeProjectEvents(projectId, (event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          // stream closed
          unsubscribe()
        }
      })

      // Keepalive every 15 seconds
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(":keepalive\n\n"))
        } catch {
          clearInterval(keepalive)
          unsubscribe()
        }
      }, 15_000)

      // Handle abort (client disconnect)
      _request.signal.addEventListener("abort", () => {
        clearInterval(keepalive)
        unsubscribe()
        try {
          controller.close()
        } catch {
          // already closed
        }
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
