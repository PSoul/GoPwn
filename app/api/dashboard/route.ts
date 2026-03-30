import { getDashboardPayload } from "@/lib/api-compositions"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async () => {
  return Response.json(await getDashboardPayload())
})
