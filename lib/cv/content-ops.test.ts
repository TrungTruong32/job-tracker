import { describe, expect, it } from "vitest"
import { applyDrops, moveBullet, moveEntry, moveSection, moveSectionAmong, pruneMissing, renameSection, setBulletOverride, setFieldOverride, toggleBullet, toggleEntry, toggleSection } from "./content-ops"
import type { CvContent } from "./resolve"

const base = (): CvContent => ({
  sections: [
    { key: "summary", visible: true, items: [] },
    { key: "experience", visible: true, items: [{ item_id: "e1", bullet_ids: null }, { item_id: "e2", bullet_ids: null }] },
    { key: "skill", visible: true, items: [] },
  ],
})
const ALL = ["b1", "b2", "b3"]

describe("content ops", () => {
  it("toggles entries in and out, appending to the section", () => {
    let c = toggleEntry(base(), "skill", "s1", true)
    expect(c.sections[2].items.map((i) => i.item_id)).toEqual(["s1"])
    c = toggleEntry(c, "experience", "e1", false)
    expect(c.sections[1].items.map((i) => i.item_id)).toEqual(["e2"])
    expect(toggleEntry(c, "skill", "s1", true).sections[2].items).toHaveLength(1) // idempotent
  })

  it("creates a missing section when an item of that kind is added", () => {
    const c = toggleEntry(base(), "award", "a1", true)
    expect(c.sections.at(-1)).toMatchObject({ key: "award", visible: true, items: [{ item_id: "a1" }] })
  })

  it("moves entries and sections within bounds", () => {
    expect(moveEntry(base(), "experience", "e2", -1).sections[1].items.map((i) => i.item_id)).toEqual(["e2", "e1"])
    expect(moveEntry(base(), "experience", "e1", -1).sections[1].items.map((i) => i.item_id)).toEqual(["e1", "e2"])
    expect(moveSection(base(), "skill", -1).sections.map((s) => s.key)).toEqual(["summary", "skill", "experience"])
  })

  it("toggles a bullet by materializing the full list first", () => {
    let c = toggleBullet(base(), "experience", "e1", "b2", false, ALL)
    expect(c.sections[1].items[0].bullet_ids).toEqual(["b1", "b3"])
    c = toggleBullet(c, "experience", "e1", "b2", true, ALL)
    expect(c.sections[1].items[0].bullet_ids).toEqual(["b1", "b3", "b2"])
  })

  it("moves a bullet within the chosen list", () => {
    const c = moveBullet(base(), "experience", "e1", "b3", -1, ALL)
    expect(c.sections[1].items[0].bullet_ids).toEqual(["b1", "b3", "b2"])
  })

  it("sets and clears overrides (clearing when equal to the profile text)", () => {
    let c = setBulletOverride(base(), "experience", "e1", "b1", "Short", "Original long")
    expect(c.sections[1].items[0].bullet_overrides).toEqual({ b1: "Short" })
    c = setBulletOverride(c, "experience", "e1", "b1", "Original long", "Original long")
    expect(c.sections[1].items[0].bullet_overrides).toEqual({})
    c = setFieldOverride(c, "experience", "e1", "title", "AI Engineer", "AI Engineer Intern")
    expect(c.sections[1].items[0].overrides).toEqual({ title: "AI Engineer" })
  })

  it("hides and shows sections", () => {
    expect(toggleSection(base(), "skill", false).sections[2].visible).toBe(false)
  })

  it("applies drop suggestions to items and bullets", () => {
    const c = applyDrops(base(), [
      { kind: "item", item_id: "e2" },
      { kind: "bullet", item_id: "e1", bullet_id: "b3" },
    ], (id) => (id === "e1" ? ALL : []))
    expect(c.sections[1].items.map((i) => i.item_id)).toEqual(["e1"])
    expect(c.sections[1].items[0].bullet_ids).toEqual(["b1", "b2"])
  })

  it("never mutates its input", () => {
    const c = base()
    const snapshot = JSON.stringify(c)
    toggleBullet(c, "experience", "e1", "b1", false, ALL)
    moveSection(c, "skill", -1)
    expect(JSON.stringify(c)).toBe(snapshot)
  })

  it("keeps spaces while typing a section title and allows clearing it", () => {
    expect(renameSection(base(), "skill", "Key ").sections[2].title).toBe("Key ")
    expect(renameSection(base(), "skill", "").sections[2].title).toBe("")
  })

  it("moves a section past hidden neighbours", () => {
    const c: CvContent = { sections: [{ key: "experience", visible: true, items: [] }, { key: "publication", visible: true, items: [] }, { key: "skill", visible: true, items: [] }] }
    expect(moveSectionAmong(c, "skill", -1, ["experience", "skill"]).sections.map((s) => s.key)).toEqual(["skill", "publication", "experience"])
    expect(moveSectionAmong(c, "experience", -1, ["experience", "skill"]).sections.map((s) => s.key)).toEqual(["experience", "publication", "skill"])
  })

  it("prunes references to deleted items and bullets", () => {
    const c: CvContent = { sections: [{ key: "experience", visible: true, items: [{ item_id: "e1", bullet_ids: ["b1", "gone"], bullet_overrides: { gone: "x", b1: "y" } }, { item_id: "deleted" }] }] }
    const p = pruneMissing(c, (id) => (id === "e1" ? ["b1", "b2"] : null))
    expect(p.sections[0].items).toEqual([{ item_id: "e1", bullet_ids: ["b1"], bullet_overrides: { b1: "y" } }])
  })
})
