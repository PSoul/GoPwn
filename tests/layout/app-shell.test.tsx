import { describe, expect, it } from "vitest"

import { prototypeNavigation } from "@/lib/navigation"

describe("prototype navigation", () => {
  it("defines the six primary console destinations", () => {
    expect(prototypeNavigation.map((item) => item.href)).toEqual([
      "/dashboard",
      "/projects",
      "/approvals",
      "/assets",
      "/evidence",
      "/settings",
    ])
  })
})
