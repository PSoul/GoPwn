import { apiHandler, json } from "@/lib/infra/api-handler"
import * as dashboardService from "@/lib/services/dashboard-service"

export const GET = apiHandler(async () => {
  const data = await dashboardService.getDashboardData()
  return json(data)
})
