function getSessionSecret(): string {
  const secret = process.env.PROTOTYPE_SESSION_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("PROTOTYPE_SESSION_SECRET environment variable is required in production")
    }
    console.warn("[auth] PROTOTYPE_SESSION_SECRET not set — using insecure default. Set it before deploying.")
    return "prototype-session-secret-dev-only"
  }
  return secret
}

export const AUTH_COOKIE_NAME = "prototype_session"
const SESSION_TTL_MS = 1000 * 60 * 60 * 8

export type SessionUser = {
  userId: string
  account: string
  displayName: string
  role: string
}

type SessionPayload = SessionUser & {
  expiresAt: number
}

function encodePayload(payload: SessionPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url")
}

function decodePayload(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as SessionPayload
}

function bufferToBase64Url(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString("base64url")
}

async function sign(value: string) {
  const encoder = new TextEncoder()
  const secret = encoder.encode(getSessionSecret())
  const data = encoder.encode(value)
  const key = await crypto.subtle.importKey(
    "raw",
    secret,
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  )

  const signature = await crypto.subtle.sign("HMAC", key, data)
  return bufferToBase64Url(signature)
}

export async function createSessionToken(user: SessionUser) {
  const payload = encodePayload({
    ...user,
    expiresAt: Date.now() + SESSION_TTL_MS,
  })
  const signature = await sign(payload)

  return `${payload}.${signature}`
}

export async function readSessionToken(token?: string | null) {
  if (!token) {
    return null
  }

  const [payload, signature] = token.split(".")

  if (!payload || !signature) {
    return null
  }

  const expectedSignature = await sign(payload)

  if (signature !== expectedSignature) {
    return null
  }

  const decoded = decodePayload(payload)

  if (decoded.expiresAt <= Date.now()) {
    return null
  }

  return decoded
}

export async function readSessionFromCookieHeader(cookieHeader?: string | null) {
  if (!cookieHeader) {
    return null
  }

  const cookieValue = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.slice(`${AUTH_COOKIE_NAME}=`.length)

  return readSessionToken(cookieValue)
}
