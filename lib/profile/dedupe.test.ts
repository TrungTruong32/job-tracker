import { describe, expect, it } from "vitest"
import { findDuplicate, mergeData, planImport, similarity, textKey } from "./dedupe"

const b = (...texts: string[]) => texts.map((text, i) => ({ id: `b${i}-${text}`, text }))

describe("textKey / similarity", () => {
  it("ignores case, accents, punctuation and company suffixes", () => {
    expect(textKey("Acme Co., Ltd.")).toBe(textKey("acme"))
    expect(textKey("Công ty Cổ phần FPT")).toBe(textKey("FPT JSC"))
    expect(textKey("Đại học Khoa học Tự nhiên")).toBe("dai hoc khoa hoc tu nhien")
  })

  it("scores word overlap", () => {
    expect(similarity("AI Engineer", "Senior AI Engineer")).toBeGreaterThanOrEqual(0.6)
    expect(similarity("Data Analyst", "Backend Developer")).toBe(0)
  })
})

describe("findDuplicate", () => {
  const existing = [
    { id: "e1", section: "experience" as const, data: { company: "Acme Co., Ltd", title: "AI Engineer", bullets: [], tech: [] } },
    { id: "u1", section: "education" as const, data: { school: "HCMUS", degree: "BSc", bullets: [] } },
    { id: "p1", section: "publication" as const, data: { title: "Multimodal Retrieval for Product Catalogs" } },
    { id: "s1", section: "skill" as const, data: { category: "ML / AI", items: ["PyTorch"] } },
  ]

  it("matches experience by company + similar title", () => {
    expect(findDuplicate("experience", { company: "ACME", title: "Senior AI Engineer" }, existing)).toBe("e1")
    expect(findDuplicate("experience", { company: "Acme", title: "Sales Manager" }, existing)).toBeNull()
    expect(findDuplicate("experience", { company: "VNG", title: "AI Engineer" }, existing)).toBeNull()
  })

  it("treats a promotion (different start date) at the same company as a new role", () => {
    const ex = [{ id: "e2", section: "experience" as const, data: { company: "FPT Software", title: "AI Engineer", start: "2022-01" } }]
    expect(findDuplicate("experience", { company: "FPT Software Co., Ltd", title: "Senior AI Engineer", start: "2024-03" }, ex)).toBeNull()
    expect(findDuplicate("experience", { company: "FPT Software", title: "AI Engineer", start: "2022-01" }, ex)).toBe("e2")
  })

  it("matches education when degrees agree or one is missing", () => {
    expect(findDuplicate("education", { school: "hcmus", degree: "" }, existing)).toBe("u1")
    expect(findDuplicate("education", { school: "HCMUS", degree: "MSc" }, existing)).toBeNull()
  })

  it("matches titled sections and skill categories by name", () => {
    expect(findDuplicate("publication", { title: "multimodal retrieval for product catalogs." }, existing)).toBe("p1")
    expect(findDuplicate("skill", { category: "ml/ai", items: [] }, existing)).toBe("s1")
  })

  it("never matches across sections", () => {
    expect(findDuplicate("project", { name: "HCMUS" }, existing)).toBeNull()
  })
})

describe("mergeData", () => {
  it("adds only new bullets and tech, keeping old ids and order", () => {
    const old = { company: "Acme", title: "AI Engineer", bullets: b("Built RAG"), tech: ["Python"] }
    const incoming = { company: "Acme", title: "AI Engineer", location: "HCMC", bullets: b("built rag ", "Cut cost 40%"), tech: ["python", "LangChain"] }
    const m = mergeData("experience", old, incoming) as typeof old & { location: string }
    expect(m.bullets.map((x) => x.text)).toEqual(["Built RAG", "Cut cost 40%"])
    expect(m.bullets[0].id).toBe(old.bullets[0].id)
    expect(m.tech).toEqual(["Python", "LangChain"])
    expect(m.location).toBe("HCMC") // empty field filled
  })

  it("does not overwrite existing scalar fields", () => {
    expect(mergeData("language", { name: "English", level: "IELTS 7.5" }, { name: "English", level: "C1" })).toEqual({
      name: "English",
      level: "IELTS 7.5",
    })
  })

  it("unions skill items", () => {
    expect(mergeData("skill", { category: "ML", items: ["PyTorch"] }, { category: "ML", items: ["pytorch", "RAG"] })).toEqual({
      category: "ML",
      items: ["PyTorch", "RAG"],
    })
  })
})

describe("planImport", () => {
  it("adds new items, skips duplicates by default and lists what a merge would add", () => {
    const existing = [{ id: "e1", section: "experience" as const, data: { company: "Acme", title: "AI Engineer", bullets: b("Built RAG"), tech: [] } }]
    const rows = planImport(existing, [
      { section: "experience", data: { company: "Acme", title: "AI Engineer", bullets: b("Built RAG", "Cut cost 40%"), tech: ["vLLM"] } },
      { section: "project", data: { name: "Job Tracker", bullets: [], tech: [] } },
    ])
    expect(rows.map((r) => [r.action, r.match?.id ?? null])).toEqual([
      ["skip", "e1"],
      ["add", null],
    ])
    expect(rows[0].newBits).toEqual(["Cut cost 40%", "vLLM"])
  })

  it("marks a duplicate with nothing new so the user knows a merge is pointless", () => {
    const existing = [{ id: "l1", section: "language" as const, data: { name: "English" } }]
    const [row] = planImport(existing, [{ section: "language", data: { name: "english" } }])
    expect(row.newBits).toEqual([])
  })

  it("does not match two incoming items to each other", () => {
    const rows = planImport([], [
      { section: "language", data: { name: "English" } },
      { section: "language", data: { name: "English" } },
    ])
    expect(rows.map((r) => r.action)).toEqual(["add", "add"])
  })
})
