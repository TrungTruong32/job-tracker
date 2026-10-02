import { describe, expect, it } from "vitest"
import type { ProfileItem } from "@/lib/profile/schema"
import { contentFromTags, resolveCv, type CvContent } from "./resolve"
import { containsTerm, jdHash, profileHits, scoreCv, tokens, type Keyword } from "./score"

const kw = (term: string, weight: Keyword["weight"] = "required", aliases: string[] = []): Keyword => ({ term, aliases, weight, category: "x" })

describe("matching", () => {
  const has = (text: string, term: string) => containsTerm(tokens(text), tokens(term))
  it("handles C++, C#, Node.js, .NET and case/diacritics", () => {
    expect(has("Strong C++ and C# skills", "c++")).toBe(true)
    expect(has("Strong C++ and C# skills", "c#")).toBe(true)
    expect(has("Built APIs in Node.js.", "node.js")).toBe(true)
    expect(has("ASP .NET core", ".net")).toBe(true)
    expect(has("Xây dựng hệ thống RAG", "xay dung")).toBe(true)
    expect(has("C programming", "c++")).toBe(false)
  })
  it("respects word boundaries but allows simple plurals", () => {
    expect(has("good results", "go")).toBe(false)
    expect(has("Deployed microservices", "microservice")).toBe(true)
    expect(has("Built an API", "APIs")).toBe(true)
    expect(has("large language models in production", "large language model")).toBe(true)
  })
})

describe("jdHash", () => {
  it("ignores whitespace/case differences and changes with content", () => {
    expect(jdHash("We need  Python\n")).toBe(jdHash("we need python"))
    expect(jdHash("We need Python")).not.toBe(jdHash("We need Go"))
  })
})

const items: ProfileItem[] = [
  { id: "e1", section: "experience", position: 0, tags: [], data: { company: "Acme", title: "AI Engineer", start: "2024-01", end: "present", tech: ["Python"], bullets: [{ id: "b1", text: "Built a **RAG** assistant on LangChain, cutting cost 40%" }, { id: "b2", text: "Deployed with Docker" }] } },
  { id: "e2", section: "experience", position: 1, tags: [], data: { company: "Old", title: "Intern", tech: [], bullets: [{ id: "c1", text: "Wrote Kubernetes manifests for 3 services" }] } },
  { id: "s1", section: "skill", position: 0, tags: [], data: { category: "ML", items: ["PyTorch", "LLM"] } },
]
const basics = { full_name: "T", summary: "AI engineer focused on RAG and LangChain", links: [] }
const content = (): CvContent => ({
  sections: [
    { key: "summary", visible: true, items: [] },
    { key: "experience", visible: true, items: [{ item_id: "e1", bullet_ids: null }] },
    { key: "skill", visible: true, items: [{ item_id: "s1" }] },
  ],
})
const cv = () => resolveCv(content(), { basics, items }, { dateFormat: "YYYY", nestProjects: false })

describe("scoreCv", () => {
  const keywords = [
    kw("RAG"),
    kw("LangChain"),
    kw("PyTorch"),
    kw("Kubernetes"),
    kw("large language model", "required", ["LLM"]),
    kw("Docker", "preferred"),
    kw("Terraform", "preferred"),
  ]

  it("classifies evidence / skills-only / missing with locations", () => {
    const r = scoreCv(cv(), keywords, { onePage: true })
    const by = Object.fromEntries(r.hits.map((h) => [h.keyword.term, h]))
    expect(by.RAG.found).toBe("evidence")
    expect(by.RAG.where.some((w) => w.bullet_id === "b1")).toBe(true)
    expect(by.PyTorch.found).toBe("skills")
    expect(by["large language model"].found).toBe("skills") // via alias LLM
    expect(by.Kubernetes.found).toBe("missing")
    expect(by.Terraform.found).toBe("missing")
  })

  it("computes the 60/20/20 score", () => {
    const r = scoreCv(cv(), keywords, { onePage: true })
    // required: RAG 1 + LangChain 1 + PyTorch .7 + K8s 0 + LLM .7 = 3.4 / 5 -> 40.8
    expect(r.parts.required.score).toBeCloseTo(40.8, 1)
    // preferred: Docker 1 + Terraform 0 -> 10
    expect(r.parts.preferred.score).toBe(10)
    // format: one page ✓, quantified 1/2 bullets ✓ (50%), summary has RAG+LangChain ✓, no long bullet ✓
    expect(r.parts.format.score).toBe(20)
    expect(r.total).toBe(71)
  })

  it("moves the preferred points to required when the JD has no preferred keywords", () => {
    const r = scoreCv(cv(), [kw("RAG"), kw("Kubernetes")], { onePage: false })
    expect(r.parts.required.max).toBe(80)
    expect(r.parts.required.score).toBe(40)
    expect(r.parts.format.checks.find((c) => c.key === "one_page")!.ok).toBe(false)
  })

  it("scores format only (scaled) when there are no keywords yet", () => {
    const r = scoreCv(cv(), [], { onePage: true })
    expect(r.total).toBe(100)
    expect(r.parts.required.max).toBe(0)
  })
})

describe("profileHits", () => {
  it("finds unselected bullets and items in the profile that contain a missing keyword", () => {
    const hits = profileHits(kw("Kubernetes"), items, content())
    expect(hits).toEqual([{ kind: "item", section: "experience", item_id: "e2", bullet_id: "c1", label: "Intern | Old — Wrote Kubernetes manifests for 3 services" }])
  })

  it("prefers a hidden bullet of an item that is already selected", () => {
    const c = content()
    c.sections[1].items[0].bullet_ids = ["b1"] // b2 (Docker) deselected
    const hits = profileHits(kw("Docker", "preferred"), items, c)
    expect(hits[0]).toMatchObject({ kind: "bullet", item_id: "e1", bullet_id: "b2" })
  })

  it("returns nothing when the keyword is already in the CV", () => {
    expect(profileHits(kw("RAG"), items, contentFromTags(items, []))).toEqual([])
  })
})
