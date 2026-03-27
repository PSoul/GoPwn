import { llmProfileWriteSchema } from "@/lib/llm-settings-write-schema"
import { getLlmSettingsPayload, updateLlmSettingsPayload } from "@/lib/prototype-api"

export async function GET() {
  return Response.json(getLlmSettingsPayload())
}

export async function PATCH(request: Request) {
  const body = await request.json()
  const parsed = llmProfileWriteSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid LLM settings payload" }, { status: 400 })
  }

  const profile = updateLlmSettingsPayload(parsed.data)

  if (!profile) {
    return Response.json({ error: `LLM profile '${parsed.data.id}' not found` }, { status: 404 })
  }

  return Response.json({
    profile,
    profiles: getLlmSettingsPayload().profiles,
  })
}
