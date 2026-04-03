import path from "node:path"

const STORE_DIRECTORY = ".prototype-store"
const ARTIFACTS_DIRECTORY = "artifacts"

function sanitizeSegment(value: string) {
  const sanitized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")

  return sanitized || "artifact"
}

function normalizeRelativeArtifactPath(relativePath: string) {
  return relativePath
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/")
}

export function getPrototypeDataDirectory() {
  return process.env.PROTOTYPE_DATA_DIR ?? path.join(process.cwd(), STORE_DIRECTORY)
}

export function getRuntimeArtifactsDirectory() {
  return path.join(getPrototypeDataDirectory(), ARTIFACTS_DIRECTORY)
}

export function allocateRunArtifactTargets(input: {
  projectId: string
  runId: string
  target: string
}) {
  const artifactRoot = getRuntimeArtifactsDirectory()
  const slug = sanitizeSegment(
    input.target
      .replace(/^https?:\/\//i, "")
      .replace(/[/?#].*$/, "")
      .replace(/:\d+$/, ""),
  )
  const relativeDirectory = normalizeRelativeArtifactPath(
    [sanitizeSegment(input.projectId), sanitizeSegment(input.runId), slug].join("/"),
  )
  const screenshotRelativePath = normalizeRelativeArtifactPath(`${relativeDirectory}/page.png`)
  const htmlRelativePath = normalizeRelativeArtifactPath(`${relativeDirectory}/page.html`)

  return {
    artifactRoot,
    relativeDirectory,
    screenshotRelativePath,
    htmlRelativePath,
    screenshotAbsolutePath: path.join(artifactRoot, ...screenshotRelativePath.split("/")),
    htmlAbsolutePath: path.join(artifactRoot, ...htmlRelativePath.split("/")),
  }
}

export function resolveRuntimeArtifactPath(relativePath: string) {
  const normalizedRelativePath = normalizeRelativeArtifactPath(relativePath)

  if (!normalizedRelativePath) {
    return null
  }

  const segments = normalizedRelativePath.split("/")

  if (segments.some((segment) => segment === "." || segment === "..")) {
    return null
  }

  const artifactRoot = path.resolve(getRuntimeArtifactsDirectory())
  const absolutePath = path.resolve(artifactRoot, ...segments)
  const rootWithSeparator = artifactRoot.endsWith(path.sep) ? artifactRoot : `${artifactRoot}${path.sep}`

  if (absolutePath !== artifactRoot && !absolutePath.startsWith(rootWithSeparator)) {
    return null
  }

  return {
    absolutePath,
    relativePath: normalizedRelativePath,
  }
}

export function buildRuntimeArtifactUrl(relativePath?: string | null) {
  if (!relativePath) {
    return null
  }

  const normalizedRelativePath = normalizeRelativeArtifactPath(relativePath)

  if (!normalizedRelativePath) {
    return null
  }

  const encodedPath = normalizedRelativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")

  return `/api/artifacts/${encodedPath}`
}

export function getArtifactContentType(relativePath: string) {
  const extension = path.extname(relativePath).toLowerCase()

  switch (extension) {
    case ".png":
      return "image/png"
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".webp":
      return "image/webp"
    case ".html":
      return "text/html; charset=utf-8"
    case ".json":
      return "application/json; charset=utf-8"
    case ".txt":
      return "text/plain; charset=utf-8"
    default:
      return "application/octet-stream"
  }
}
