import { describe, expect, it } from "vitest"
import type { ProfileItem } from "@/lib/profile/schema"
import { contentFromTags, formatCvDate, formatRange, resolveCv, tidyLabeled, type CvContent } from "./resolve"

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

describe("resolveCv sections (sample-cv)", () => {
  const all: ProfileItem[] = [
    ...items,
    { id: "edu", section: "education", position: 0, tags: [], data: { school: "HCMUS", degree: "BSc", bullets: [] } },
    { id: "c1", section: "certification", position: 0, tags: [], data: { name: "VSTEP B2" } },
    { id: "c2", section: "certification", position: 1, tags: [], data: { name: "Docker", issuer: "Udemy" } },
    { id: "l1", section: "language", position: 0, tags: [], data: { name: "English", level: "B2" } },
    { id: "pub", section: "publication", position: 0, tags: [], data: { title: "Paper" } },
  ]
  const run = (c = contentFromTags(all, [])) => resolveCv(c, { basics, items: all }, { dateFormat: "YYYY" })

  it("keeps only Summary, Education, Work Experience, Key Skills in that order", () => {
    const r = run()
    expect(r.sections.map((s) => [s.key, s.title])).toEqual([
      ["summary", "Summary"],
      ["education", "Education"],
      ["experience", "Work Experience"],
      ["skill", "Key Skills"],
    ])
    // nested project stays under its job; the loose project is reported
    expect(r.sections[2].entries[0].children.map((c) => c.id)).toEqual(["prj1"])
    expect(r.omitted).toEqual([{ title: "Dự án chưa gắn vào kinh nghiệm", count: 1 }])
  })

  it("drops sections outside the four (older documents) and reports them", () => {
    const c = contentFromTags(all, [])
    c.sections.push({ key: "publication", visible: true, items: [{ item_id: "pub" }] })
    expect(run(c).omitted).toContainEqual({ title: "Publications", count: 1 })
    expect(run(c).sections.some((s) => s.key === "publication")).toBe(false)
  })

  it("folds certifications into Education and languages into Key Skills", () => {
    const r = run()
    expect(r.sections[1].entries[0].bullets.map((b) => b.text)).toEqual(["**BSc**", "**Certifications:** VSTEP B2, Docker - Udemy."])
    expect(r.sections[3].entries.at(-1)).toMatchObject({ fields: { category: "Languages" }, list: ["English *(B2)*"] })
  })

  it("respects a custom title and hidden certifications", () => {
    const c = contentFromTags(all, [])
    c.sections.find((s) => s.key === "skill")!.title = "Skills & Tools"
    c.sections.find((s) => s.key === "certification")!.visible = false
    const r = run(c)
    expect(r.sections[3].title).toBe("Skills & Tools")
    expect(r.sections[1].entries[0].bullets.map((b) => b.text)).toEqual(["**BSc**"])
  })

  it("does not repeat lines the education bullets already have, and bolds their labels", () => {
    const edu = {
      id: "edu",
      section: "education" as const,
      position: 0,
      tags: [],
      data: {
        school: "Example University of Science",
        degree: "Bachelor of Science",
        field: "Mathematics & Computer Science",
        gpa: "8.40/10 (3.55/4)",
        bullets: [
          { id: "x1", text: "Specialization: Applied Mathematics and Computer Science | GPA: 8.40/10 (3.55/4)" },
          { id: "x2", text: "Certifications: VSTEP B2 (English Proficiency), Docker - Udemy." },
        ],
      },
    }
    const list = [...all.filter((i) => i.section !== "education"), edu]
    const r = resolveCv(contentFromTags(list, []), { basics, items: list }, { dateFormat: "YYYY" })
    expect(r.sections[1].entries[0].bullets.map((b) => b.text)).toEqual([
      "**Bachelor of Science in Mathematics & Computer Science**",
      "**Specialization:** Applied Mathematics and Computer Science | **GPA:** 8.40/10 *(3.55/4)*",
      "**Certifications:** VSTEP B2 *(English Proficiency)*, Docker - Udemy.",
    ])
  })
})

describe("tidyLabeled", () => {
  it("bolds labels, italicizes notes, leaves other text alone", () => {
    expect(tidyLabeled("Honors: Merit (top 5%)")).toBe("**Honors:** Merit *(top 5%)*")
    expect(tidyLabeled("**GPA:** 8.2 *(3.4/4)*")).toBe("**GPA:** 8.2 *(3.4/4)*")
    expect(tidyLabeled("Built a pipeline (Python) at https://x.dev")).toBe("Built a pipeline (Python) at https://x.dev")
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
      { dateFormat: "MMM YYYY"},
    )
    const e = r.sections[0].entries[0]
    expect(e.fields.title).toBe("AI Engineer")
    expect(e.fields.dates).toBe("Jun 2026 - Present")
    expect(e.bullets.map((b) => b.text)).toEqual(["Second", "Built **ETL** fast"])
    expect(e.bullets[1].overridden).toBe(true)
  })

  it("null bullet_ids means all bullets in profile order", () => {
    const r = resolveCv(content([{ key: "experience", visible: true, items: [{ item_id: "exp1", bullet_ids: null }] }]), { basics, items }, { dateFormat: "YYYY" })
    expect(r.sections[0].entries[0].bullets.map((b) => b.id)).toEqual(["b1", "b2"])
  })

  it("nests sub-projects under their selected experience", () => {
    const c = content([
      { key: "experience", visible: true, items: [{ item_id: "exp1" }] },
      { key: "project", visible: true, items: [{ item_id: "prj1" }, { item_id: "prj2" }] },
    ])
    const nested = resolveCv(c, { basics, items }, { dateFormat: "YYYY" })
    expect(nested.sections[0].entries[0].children.map((x) => x.fields.name)).toEqual(["Order Pipeline"])
    expect(nested.omitted).toEqual([{ title: "Dự án chưa gắn vào kinh nghiệm", count: 1 }])
  })

  it("skips deleted items and missing bullets with warnings, hides invisible and empty sections", () => {
    const r = resolveCv(
      content([
        { key: "experience", visible: true, items: [{ item_id: "gone" }, { item_id: "exp1", bullet_ids: ["b1", "missing"] }] },
        { key: "skill", visible: false, items: [{ item_id: "sk1" }] },
        { key: "award", visible: true, items: [] },
      ]),
      { basics, items },
      { dateFormat: "YYYY"},
    )
    expect(r.sections.map((s) => s.key)).toEqual(["experience"])
    expect(r.sections[0].entries[0].bullets.map((b) => b.id)).toEqual(["b1"])
    expect(r.warnings.length).toBe(2)
  })

  it("uses the summary override and default titles", () => {
    const r = resolveCv(content([{ key: "summary", visible: true, items: [] }, { key: "skill", visible: true, items: [{ item_id: "sk1" }] }], { summary_override: "Tailored" }), { basics, items }, { dateFormat: "YYYY" })
    expect(r.basics.summary).toBe("Tailored")
    expect(r.sections.map((s) => s.title)).toEqual(["Summary", "Key Skills"])
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
