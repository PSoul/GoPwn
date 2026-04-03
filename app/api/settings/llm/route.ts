import { llmProfileWriteSchema } from "@/lib/settings/llm-settings-write-schema"
import { listStoredLlmProfiles, updateStoredLlmProfile } from "@/lib/llm/llm-settings-repository"
import { withApiHandler } from "@/lib/infra/api-handler"

export const GET = withApiHandler(async () => {
  return Response.json({ profiles: await listStoredLlmProfiles() })
})

export const PATCH = withApiHandler(async (request) => {
  const body = await request.json()
  const parsed = llmProfileWriteSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid LLM settings payload" }, { status: 400 })
  }

  const profile = await updateStoredLlmProfile(parsed.data)

  if (!profile) {
    return Response.json({ error: `LLM profile '${parsed.data.id}' not found` }, { status: 404 })
  }

  return Response.json({
    profile,
    profiles: await listStoredLlmProfiles(),
  })
})
