import { getLlmCallLogById } from "@/lib/llm/llm-call-logger"
import { withApiHandler } from "@/lib/infra/api-handler"

export const GET = withApiHandler(async (_request, context) => {
  const { logId } = (await context.params) as { projectId: string; logId: string }
  const log = await getLlmCallLogById(logId)

  if (!log) {
    return Response.json({ error: "Log not found" }, { status: 404 })
  }

  return Response.json(log)
})
