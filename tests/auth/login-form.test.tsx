import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { LoginForm } from "@/components/auth/login-form"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

describe("LoginForm", () => {
  it("renders account, password, captcha, and submit controls", () => {
    render(<LoginForm />)

    expect(screen.getByLabelText("账号")).toBeInTheDocument()
    expect(screen.getByLabelText("密码")).toBeInTheDocument()
    expect(screen.getByLabelText("验证码")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "登录平台" })).toBeInTheDocument()
  })
})
