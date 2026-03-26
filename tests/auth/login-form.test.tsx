import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { LoginForm } from "@/components/auth/login-form"

describe("LoginForm", () => {
  it("renders account, password, captcha, and submit controls", () => {
    render(<LoginForm />)

    expect(screen.getByLabelText("账号")).toBeInTheDocument()
    expect(screen.getByLabelText("密码")).toBeInTheDocument()
    expect(screen.getByLabelText("验证码")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "登录平台" })).toBeInTheDocument()
  })
})
