import { describe, expect, it } from "vitest"
import { normalizeEnd, normalizeMonth, normalizeParsed, toBullets } from "./normalize"

describe("normalizeMonth", () => {
  it.each([
    ["Jan 2024", "2024-01"],
    ["January 2024", "2024-01"],
    ["Sept. 2023", "2023-09"],
    ["01/2024", "2024-01"],
    ["2024-1", "2024-01"],
    ["2024/03", "2024-03"],
    ["03.2022", "2022-03"],
    ["2024", "2024"],
    ["Tháng 5 2021", "2021-05"],
  ])("%s -> %s", (raw, out) => {
    expect(normalizeMonth(raw)).toBe(out)
  })

  it("keeps text it cannot understand instead of dropping it", () => {
    expect(normalizeMonth("Summer 2023")).toBe("Summer 2023")
  })

  it("returns null for empty input", () => {
    expect(normalizeMonth("  ")).toBeNull()
    expect(normalizeMonth(undefined)).toBeNull()
  })
})

describe("normalizeEnd", () => {
  it.each(["Present", "now", "Current", "Hiện tại", "nay"])("%s means present", (raw) => {
    expect(normalizeEnd(raw)).toBe("present")
  })
  it("otherwise behaves like a month", () => {
    expect(normalizeEnd("Dec 2022")).toBe("2022-12")
  })
})

describe("toBullets", () => {
  it("splits a string on newlines and bullet markers", () => {
    const b = toBullets("• Built RAG\n- Fine-tuned LLM\n\n* Led 3 people")
    expect(b.map((x) => x.text)).toEqual(["Built RAG", "Fine-tuned LLM", "Led 3 people"])
    expect(new Set(b.map((x) => x.id)).size).toBe(3)
  })

  it("accepts arrays of strings or {text} objects and drops empties", () => {
    expect(toBullets(["A", " ", { text: "B" }, { nope: 1 }]).map((x) => x.text)).toEqual(["A", "B"])
  })

  it("keeps existing ids", () => {
    expect(toBullets([{ id: "keep-me", text: "A" }])[0].id).toBe("keep-me")
  })
})

describe("normalizeParsed", () => {
  it("normalizes dates, bullets and drops items missing their main field", () => {
    const r = normalizeParsed({
      basics: { full_name: " An Nguyen ", links: [{ label: "GitHub", url: "https://github.com/x" }] },
      items: [
        { section: "experience", data: { company: "Acme", title: "AI Engineer", start: "Mar 2024", end: "Present", bullets: "• A\n• B", tech: ["Python"] } },
        { section: "experience", data: { title: "no company" } },
        { section: "skill", data: { category: "ML", items: "PyTorch, LangChain; RAG" } },
        { section: "unknown", data: { x: 1 } },
      ],
    })
    expect(r.basics.full_name).toBe("An Nguyen")
    expect(r.items).toHaveLength(2)
    expect(r.items[0].data).toMatchObject({ company: "Acme", start: "2024-03", end: "present" })
    expect((r.items[0].data as { bullets: unknown[] }).bullets).toHaveLength(2)
    expect(r.items[1].data).toMatchObject({ category: "ML", items: ["PyTorch", "LangChain", "RAG"] })
    expect(r.dropped).toBe(2)
  })

  it("survives junk", () => {
    expect(normalizeParsed(null)).toEqual({ basics: {}, items: [], dropped: 0 })
  })
})
