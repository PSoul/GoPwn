import { open } from "node:fs/promises"

import { readSessionFromCookieHeader } from "@/lib/auth-session"
import { getArtifactContentType, resolveRuntimeArtifactPath } from "@/lib/runtime-artifacts"

type ArtifactRouteContext = {
  params: Promise<{ artifactPath: string[] }>
}

export async function GET(request: Request, { params }: ArtifactRouteContext) {
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

    return new Response(file.readableWebStream(), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": getArtifactContentType(resolved.relativePath),
      },
    })
  } catch {
    return Response.json({ error: `Artifact '${relativePath}' not found` }, { status: 404 })
  }
}
