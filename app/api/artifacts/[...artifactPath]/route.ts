import { open } from "node:fs/promises"

import { readSessionFromCookieHeader } from "@/lib/auth-session"
import { getArtifactContentType, resolveRuntimeArtifactPath } from "@/lib/runtime-artifacts"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async (request, { params }) => {
  const session = await readSessionFromCookieHeader(request.headers.get("cookie"))

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { artifactPath } = await params
  const relativePath = Array.isArray(artifactPath) ? artifactPath.join("/") : ""
  const resolved = resolveRuntimeArtifactPath(relativePath)

  if (!resolved) {
    return Response.json({ error: `Artifact '${relativePath}' not found` }, { status: 404 })
  }

  try {
    const file = await open(resolved.absolutePath)

    return new Response(file.readableWebStream() as unknown as BodyInit, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": getArtifactContentType(resolved.relativePath),
      },
    })
  } catch {
    return Response.json({ error: `Artifact '${relativePath}' not found` }, { status: 404 })
  }
})
