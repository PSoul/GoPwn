import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/infra/prisma"
import { signToken, setAuthCookie } from "@/lib/infra/auth"
import { apiHandler, json } from "@/lib/infra/api-handler"

export const POST = apiHandler(async (req) => {
  const { account, password } = (await req.json()) as { account: string; password: string }

  const user = await prisma.user.findUnique({ where: { account } })
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const token = await signToken({
    userId: user.id,
    account: user.account,
    role: user.role,
  })

  await setAuthCookie(token)

  return json({
    user: { id: user.id, account: user.account, displayName: user.displayName, role: user.role },
  })
}, { public: true })
