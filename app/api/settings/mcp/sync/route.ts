import { apiHandler, json } from "@/lib/infra/api-handler"
import { bootstrapMcp } from "@/lib/services/mcp-bootstrap"

export const POST = apiHandler(async () => {
  const result = await bootstrapMcp()
  return json(result)
})
