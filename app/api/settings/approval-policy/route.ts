import { apiHandler, json } from "@/lib/infra/api-handler"
import { getGlobalConfig, updateGlobalConfig } from "@/lib/services/settings-service"

export const GET = apiHandler(async () => {
  const config = await getGlobalConfig()
  return json(config)
})

export const PATCH = apiHandler(async (req) => {
  const body = await req.json() as {
    approvalEnabled?: boolean
    autoApproveLowRisk?: boolean
    autoApproveMediumRisk?: boolean
  }
  const config = await updateGlobalConfig(body)
  return json(config)
})
