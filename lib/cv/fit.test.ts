import { describe, expect, it } from "vitest"
import type { ProfileItem } from "@/lib/profile/schema"
import { fitStyle, rankDrops, type StyleBounds } from "./fit"
import { computeFill } from "./measure"
import type { CvContent } from "./resolve"

describe("computeFill", () => {
  it("measures from the lowest text line plus the bottom margin", () => {
    // tall page 3*841.89 high; lowest baseline 2000pt from bottom -> used from top = 2525.67-2000 + descent
    const r = computeFill([{ y: 2400, h: 10 }, { y: 2000, h: 10 }], 841.89 * 3, 36)
    expect(r.used).toBeCloseTo((841.89 * 3 - 2000 + 2.5 + 36) / 841.89, 3)
    expect(r.pages).toBe(1)
    expect(r.overflowPct).toBe(0)
  })

  it("reports overflow and pages", () => {
    const r = computeFill([{ y: 841.89 * 3 - 1000, h: 10 }], 841.89 * 3, 36)
    expect(r.pages).toBe(2)
    expect(r.overflowPct).toBeGreaterThan(0)
  })

  it("handles an empty page without NaN", () => {
    expect(computeFill([], 841.89 * 3, 36)).toEqual({ used: 0, pages: 1, overflowPct: 0 })
  })
})

describe("fitStyle", () => {
  const bounds: StyleBounds = { font_size: [9, 11], line_height: [1.0, 1.3], margin_mm: [10, 15] }
  const start = { font_size: 10, line_height: 1.2, margin_mm: 12.7 }
  // fake "used page fraction": grows with every parameter
  const fake = (k: number) => async (s: typeof start) => (s.font_size / 10) * (s.line_height / 1.2) * (0.9 + (s.margin_mm - 10) * 0.02) * k

  it("does nothing when it already fits", async () => {
    const r = await fitStyle(fake(0.9), start, bounds)
    expect(r).toMatchObject({ ok: true, style: start, tries: 1 })
  })

  it("shrinks line height first and stops as soon as it fits", async () => {
    const r = await fitStyle(fake(1.1), start, bounds) // 1.049 of a page at the start
    expect(r.ok).toBe(true)
    expect(r.style.font_size).toBe(10)
    expect(r.style.line_height).toBeLessThan(1.2)
    expect(r.used).toBeLessThanOrEqual(1)
  })

  it("can aim below a full page to leave a safety margin", async () => {
    const r = await fitStyle(fake(1.1), start, bounds, 0.95)
    expect(r.used).toBeLessThanOrEqual(0.95)
  })

  it("gives up within the bounds and reports failure", async () => {
    const r = await fitStyle(fake(3), start, bounds)
    expect(r.ok).toBe(false)
    expect(r.tries).toBeLessThanOrEqual(30)
    expect(r.style).toMatchObject({ font_size: 9, line_height: 1.0, margin_mm: 10 })
  })
})

describe("rankDrops", () => {
  const items: ProfileItem[] = [
    { id: "new", section: "experience", position: 0, tags: ["ai"], data: { company: "A", title: "AI", end: "present", bullets: [{ id: "a1", text: "short" }, { id: "a2", text: "x".repeat(200) }], tech: [] } },
    { id: "old", section: "experience", position: 1, tags: ["sales"], data: { company: "B", title: "Sales", end: "2019-01", bullets: [{ id: "o1", text: "sold things" }], tech: [] } },
  ]
  const content: CvContent = { sections: [{ key: "experience", visible: true, items: [{ item_id: "new" }, { item_id: "old" }] }] }

  it("puts off-target, older items first and never suggests the last bullet of an item", () => {
    const r = rankDrops(content, items, ["ai"])
    expect(r[0]).toMatchObject({ kind: "item", item_id: "old" })
    expect(r.find((x) => x.kind === "bullet" && x.bullet_id === "o1")).toBeUndefined()
    const bulletIdx = r.findIndex((x) => x.kind === "bullet" && x.bullet_id === "a2")
    expect(bulletIdx).toBeGreaterThan(0)
  })

  it("caps the list", () => {
    expect(rankDrops(content, items, [], 1)).toHaveLength(1)
  })
})
