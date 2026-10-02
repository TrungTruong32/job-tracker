import { describe, expect, it } from "vitest"
import type { ProfileItem } from "@/lib/profile/schema"
import { contentFromTags, formatCvDate, formatRange, resolveCv, type CvContent } from "./resolve"

const items: ProfileItem[] = [
  {
    id: "exp1",
    section: "experience",
    position: 0,
    tags: ["ai"],
    data: { company: "Acme", title: "AI Engineer Intern", start: "2026-06", end: "present", bullets: [{ id: "b1", text: "Built **ETL**" }, { id: "b2", text: "Second" }], tech: [] },
  },
  { id: "exp2", section: "experience", position: 1, tags: ["sales"], data: { company: "Shop", title: "Sales", bullets: [], tech: [] } },
  {
    id: "prj1",
    section: "project",
    position: 0,
    tags: ["ai"],
    data: { name: "Order Pipeline", experience_id: "exp1", tech: ["Python"], bullets: [{ id: "p1", text: "120K rows" }] },
  },
  { id: "prj2", section: "project", position: 1, tags: [], data: { name: "Job Tracker", tech: [], bullets: [] } },
  { id: "sk1", section: "skill", position: 0, tags: [], data: { category: "AI / ML", items: ["PyTorch", "RAG"] } },
]
const basics = { full_name: "An", summary: "Profile summary", links: [] }

const content = (sections: CvContent["sections"], extra: Partial<CvContent> = {}): CvContent => ({ sections, ...extra })

describe("formatCvDate / formatRange", () => {
  it("formats per style", () => {
    expect(formatCvDate("2026-06", "MMMM YYYY")).toBe("June 2026")
    expect(formatCvDate("2026-06", "MMM YYYY")).toBe("Jun 2026")
    expect(formatCvDate("2026-06", "MM/YYYY")).toBe("06/2026")
    expect(formatCvDate("2026-06", "YYYY")).toBe("2026")
    expect(formatCvDate("2024", "MMM YYYY")).toBe("2024")
    expect(formatCvDate("present", "MMM YYYY")).toBe("Present")
    expect(formatCvDate("Summer 2023", "MMM YYYY")).toBe("Summer 2023")
  })
  it("builds ranges and tolerates missing ends", () => {
    expect(formatRange("2026-06", "present", "MMMM YYYY")).toBe("June 2026 - Present")
    expect(formatRange(undefined, "2025-09", "YYYY")).toBe("2025")
    expect(formatRange(undefined, undefined, "YYYY")).toBe("")
  })
})

describe("resolveCv", () => {
  it("applies field and bullet overrides, bullet selection and order", () => {
    const r = resolveCv(
      content([
        {
          key: "experience",
          visible: true,
          items: [{ item_id: "exp1", bullet_ids: ["b2", "b1"], overrides: { title: "AI Engineer" }, bullet_overrides: { b1: "Built **ETL** fast" } }],
        },
      ]),
      { basics, items },
      { dateFormat: "MMM YYYY", nestProjects: false },
    )
    const e = r.sections[0].entries[0]
    expect(e.fields.title).toBe("AI Engineer")
    expect(e.fields.dates).toBe("Jun 2026 - Present")
    expect(e.bullets.map((b) => b.text)).toEqual(["Second", "Built **ETL** fast"])
    expect(e.bullets[1].overridden).toBe(true)
  })

  it("null bullet_ids means all bullets in profile order", () => {
    const r = resolveCv(content([{ key: "experience", visible: true, items: [{ item_id: "exp1", bullet_ids: null }] }]), { basics, items }, { dateFormat: "YYYY", nestProjects: false })
    expect(r.sections[0].entries[0].bullets.map((b) => b.id)).toEqual(["b1", "b2"])
  })

  it("nests sub-projects under their selected experience when the template asks for it", () => {
    const c = content([
      { key: "experience", visible: true, items: [{ item_id: "exp1" }] },
      { key: "project", visible: true, items: [{ item_id: "prj1" }, { item_id: "prj2" }] },
    ])
    const nested = resolveCv(c, { basics, items }, { dateFormat: "YYYY", nestProjects: true })
    expect(nested.sections[0].entries[0].children.map((x) => x.fields.name)).toEqual(["Order Pipeline"])
    expect(nested.sections.find((s) => s.key === "project")!.entries.map((x) => x.fields.name)).toEqual(["Job Tracker"])
    const flat = resolveCv(c, { basics, items }, { dateFormat: "YYYY", nestProjects: false })
    expect(flat.sections.find((s) => s.key === "project")!.entries).toHaveLength(2)
  })

  it("skips deleted items and missing bullets with warnings, hides invisible and empty sections", () => {
    const r = resolveCv(
      content([
        { key: "experience", visible: true, items: [{ item_id: "gone" }, { item_id: "exp1", bullet_ids: ["b1", "missing"] }] },
        { key: "skill", visible: false, items: [{ item_id: "sk1" }] },
        { key: "award", visible: true, items: [] },
      ]),
      { basics, items },
      { dateFormat: "YYYY", nestProjects: false },
    )
    expect(r.sections.map((s) => s.key)).toEqual(["experience"])
    expect(r.sections[0].entries[0].bullets.map((b) => b.id)).toEqual(["b1"])
    expect(r.warnings.length).toBe(2)
  })

  it("uses the summary override and default titles", () => {
    const r = resolveCv(content([{ key: "summary", visible: true, items: [] }, { key: "skill", visible: true, items: [{ item_id: "sk1" }] }], { summary_override: "Tailored" }), { basics, items }, { dateFormat: "YYYY", nestProjects: false })
    expect(r.basics.summary).toBe("Tailored")
    expect(r.sections.map((s) => s.title)).toEqual(["Summary", "Skills"])
    expect(r.sections[1].entries[0].list).toEqual(["PyTorch", "RAG"])
  })
})

describe("contentFromTags", () => {
  it("selects tagged items, keeps skills/languages, orders sections by default", () => {
    const c = contentFromTags(items, ["ai"])
    const ids = c.sections.flatMap((s) => s.items.map((i) => i.item_id))
    expect(ids).toEqual(["exp1", "prj1", "sk1"])
    expect(c.sections[0].key).toBe("summary")
  })
  it("selects everything when no tags are given", () => {
    expect(contentFromTags(items, []).sections.flatMap((s) => s.items).length).toBe(5)
  })
})
