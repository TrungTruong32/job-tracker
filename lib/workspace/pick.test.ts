import { describe, expect, it } from "vitest"
import { pickWorkspace } from "./pick"

const mine = { id: "w1", name: "Của tôi", role: "owner" as const }
const shared = { id: "w2", name: "Chung", role: "member" as const }

describe("pickWorkspace", () => {
  it("uses the remembered workspace when still a member", () => {
    expect(pickWorkspace([mine, shared], "w2")).toBe(shared)
  })

  it("falls back to an owned workspace when the cookie is stale", () => {
    expect(pickWorkspace([shared, mine], "gone")).toBe(mine)
  })

  it("falls back to the first membership when nothing is owned", () => {
    expect(pickWorkspace([shared], undefined)).toBe(shared)
  })

  it("returns null without memberships", () => {
    expect(pickWorkspace([], "w1")).toBeNull()
  })
})
