import { describe, expect, it } from "vitest"
import { buildImportWrites, cleanBasicsPatch } from "./import"

describe("cleanBasicsPatch", () => {
  it("never sends an empty links array (which would wipe stored links)", () => {
    expect(cleanBasicsPatch({ full_name: "A" })).toEqual({ full_name: "A" })
    expect(cleanBasicsPatch({ full_name: "A", links: [] })).toEqual({ full_name: "A" })
  })

  it("keeps real links and drops empty / null values", () => {
    expect(cleanBasicsPatch({ email: "", phone: null, links: [{ label: "GitHub", url: "https://github.com/x" }] })).toEqual({
      links: [{ label: "GitHub", url: "https://github.com/x" }],
    })
  })
})

describe("buildImportWrites", () => {
  const existing = [
    { id: "e1", section: "experience" as const, position: 0, data: { company: "X", title: "Y", bullets: [{ id: "b1", text: "Old" }], tech: [] } },
  ]
  const row = (bullets: string[], action: "merge" | "overwrite" | "add" = "merge") => ({
    section: "experience" as const,
    action,
    matchId: action === "add" ? null : "e1",
    data: { company: "X", title: "Y", bullets: bullets.map((text, i) => ({ id: `n${i}${text}`, text })), tech: [] },
  })

  it("merges several rows into the same item cumulatively", () => {
    const w = buildImportWrites(existing, [row(["A"]), row(["B"])])
    expect(w.updates).toHaveLength(1)
    expect((w.updates[0].data.bullets as { text: string }[]).map((b) => b.text)).toEqual(["Old", "A", "B"])
  })

  it("overwrite keeps the ids of bullets whose text did not change", () => {
    const w = buildImportWrites(existing, [row(["old", "New"], "overwrite")])
    const bullets = w.updates[0].data.bullets as { id: string; text: string }[]
    expect(bullets[0]).toEqual({ id: "b1", text: "old" })
    expect(bullets[1].text).toBe("New")
  })

  it("places new items with positions and rejects a match that vanished", () => {
    expect(buildImportWrites(existing, [row(["Z"], "add")]).inserts[0].position).toBe(-1)
    expect(() => buildImportWrites([], [row(["Z"])])).toThrow(/Tải lại/)
  })
})
