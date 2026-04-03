import { getSystemStatusPayload } from "@/lib/infra/api-compositions"
import { withApiHandler } from "@/lib/infra/api-handler"

export const GET = withApiHandler(async () => {
  return Response.json(await getSystemStatusPayload())
})
