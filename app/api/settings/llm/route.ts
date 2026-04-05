import { apiHandler, json } from "@/lib/infra/api-handler"
import * as settingsService from "@/lib/services/settings-service"

export const GET = apiHandler(async () => {
  const profiles = await settingsService.getLlmProfiles()
  return json(profiles)
})

export const PUT = apiHandler(async (req) => {
  const { id, ...data } = (await req.json()) as { id: string; [key: string]: unknown }
  const profile = await settingsService.upsertLlmProfile(id, data)
  const profiles = await settingsService.getLlmProfiles()
  return json({ profile, profiles })
})

export const PATCH = apiHandler(async (req) => {
  const { id, ...data } = (await req.json()) as { id: string; [key: string]: unknown }
  const profile = await settingsService.upsertLlmProfile(id, data)
  const profiles = await settingsService.getLlmProfiles()
  return json({ profile, profiles })
})
