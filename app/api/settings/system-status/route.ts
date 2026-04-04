import { apiHandler, json } from "@/lib/infra/api-handler"
import * as settingsService from "@/lib/services/settings-service"

export const GET = apiHandler(async () => {
  const status = await settingsService.getSystemStatus()
  return json(status)
})
