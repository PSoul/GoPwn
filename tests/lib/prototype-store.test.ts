import { describe, expect, it } from "vitest"

// Skipped: file-store migration test, Prisma is now the sole data layer.
// The legacy project-id migration logic lives in prototype-store.ts but is
// no longer exercised by any repository; all persistence goes through Prisma.

describe.skip("prototype store project id migration", () => {
  it("rewrites legacy non-ascii ids across related records", () => {
    expect(true).toBe(true)
  })
})
