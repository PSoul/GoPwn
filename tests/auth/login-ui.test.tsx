import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LoginForm } from "@/components/auth/login-form"

const assign = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams("from=/projects"),
}))

describe("login ui", () => {
  beforeEach(() => {
    assign.mockReset()
    global.fetch = vi.fn() as unknown as typeof fetch
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        assign,
      },
    })
  })

  it("submits credentials to the auth api and redirects to the requested route", async () => {
    // First call is captcha fetch, second is login
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ captchaId: "cap-test-123", code: "AB12" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          redirectTo: "/projects",
          user: {
            displayName: "研究员席位 A",
          },
        }),
      } as Response)

    render(<LoginForm />)

    // Wait for captcha to load
    await waitFor(() => {
      expect(screen.getByText("AB12")).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText("账号"), { target: { value: "researcher@company.local" } })
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "Prototype@2026" } })
    fireEvent.change(screen.getByLabelText("验证码"), { target: { value: "AB12" } })
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
      expect(assign).toHaveBeenCalledWith("/projects")
    })
  })
})
