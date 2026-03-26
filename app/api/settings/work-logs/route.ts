import { listWorkLogsPayload } from "@/lib/prototype-api"

export async function GET() {
  return Response.json(listWorkLogsPayload())
}
