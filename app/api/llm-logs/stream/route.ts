import { llmLogBus } from "@/lib/llm-call-logger"
import type { LlmLogEvent } from "@/lib/llm-call-logger"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const encoder = new TextEncoder()
  let cleanup: (() => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      // Send initial keepalive
      controller.enqueue(encoder.encode(": connected\n\n"))

      const onLog = (event: LlmLogEvent) => {
        try {
          const data = JSON.stringify(event)
          controller.enqueue(encoder.encode(`event: log\ndata: ${data}\n\n`))
        } catch {
          // Client disconnected — will be cleaned up by cancel()
        }
      }

      llmLogBus.on("log", onLog)

      // Heartbeat every 15s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"))
        } catch {
          clearInterval(heartbeat)
        }
      }, 15_000)

      cleanup = () => {
        llmLogBus.off("log", onLog)
        clearInterval(heartbeat)
      }
    },
    cancel() {
      cleanup?.()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
