import { listApprovalsPayload } from "@/lib/prototype-api"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async () => {
  return Response.json(listApprovalsPayload())
})
