import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { UnauthorizedError } from "@/lib/domain/errors"

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable must be set in production")
  }
  return new TextEncoder().encode(secret || "dev-secret-change-in-production")
}

const JWT_SECRET = getJwtSecret()
const COOKIE_NAME = "pentest_token"
const EXPIRES_IN = "7d"

type TokenPayload = {
  userId: string
  account: string
  role: string
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET)
  return payload as unknown as TokenPayload
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  })
}

export async function clearAuthCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function requireAuth(): Promise<TokenPayload> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) throw new UnauthorizedError()
  try {
    return await verifyToken(token)
  } catch {
    throw new UnauthorizedError("Invalid or expired token")
  }
}
