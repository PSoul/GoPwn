import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LoginForm } from "@/components/auth/login-form"

const push = vi.fn()
const refresh = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    refresh,
  }),
  useSearchParams: () => new URLSearchParams("from=/projects"),
}))

describe("login ui", () => {
  beforeEach(() => {
    push.mockReset()
    refresh.mockReset()
    global.fetch = vi.fn() as unknown as typeof fetch
  })

  it("submits credentials to the auth api and redirects to the requested route", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        redirectTo: "/projects",
        user: {
          displayName: "研究员席位 A",
        },
      }),
    } as Response)

    render(<LoginForm />)

    fireEvent.change(screen.getByLabelText("账号"), { target: { value: "researcher@company.local" } })
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "Prototype@2026" } })
    fireEvent.change(screen.getByLabelText("验证码"), { target: { value: "7K2Q" } })
    fireEvent.submit(screen.getByRole("button", { name: "登录平台" }).closest("form")!)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          method: "POST",
        }),
      )
    })

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/projects")
    })
  })
})
