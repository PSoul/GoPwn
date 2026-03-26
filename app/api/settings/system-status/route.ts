import { getSystemStatusPayload } from "@/lib/prototype-api"

export async function GET() {
  return Response.json(getSystemStatusPayload())
}
