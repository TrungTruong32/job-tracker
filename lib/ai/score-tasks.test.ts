import { describe, expect, it } from "vitest"
import { buildKeywordMessages, buildSuggestMessages } from "./prompts"
import { AI_TASKS } from "./tasks"

describe("extract_keywords", () => {
  it("asks for weighted keywords with aliases and caps the list", () => {
    const m = buildKeywordMessages("We need Python, LLM experience. Nice: Kubernetes.")
    expect(m[0].content).toMatch(/aliases/)
    expect(m[0].content).toMatch(/at most 40/)
    const out = AI_TASKS.extract_keywords.output.parse({
      keywords: [{ term: "LLM", aliases: ["large language model"], weight: "required", category: "AI" }, { term: "K8s", weight: "nice" }],
    })
    expect(out.keywords[1]).toEqual({ term: "K8s", aliases: [], weight: "preferred", category: "Khác" })
  })

  it("normalizes weights and clamps aliases/categories to what can be saved", () => {
    const out = AI_TASKS.extract_keywords.output.parse({
      keywords: [
        { term: "A", aliases: Array.from({ length: 15 }, (_, i) => "alias" + i + "x".repeat(80)), weight: "Must-have", category: "C".repeat(80) },
        { term: "B", weight: "REQUIRED" },
        { term: "C", weight: "mandatory" },
      ],
    })
    expect(out.keywords.map((k) => k.weight)).toEqual(["required", "required", "required"])
    expect(out.keywords[0].aliases).toHaveLength(10)
    expect(out.keywords[0].aliases[0].length).toBeLessThanOrEqual(60)
    expect(out.keywords[0].category!.length).toBeLessThanOrEqual(40)
  })
})

describe("suggest_edits", () => {
  it("states the truthfulness rule and returns per-bullet suggestions", () => {
    const m = buildSuggestMessages({ jdSummary: "AI role", missing: ["Kubernetes"], weak: ["PyTorch"], bullets: [{ id: "b1", text: "Built RAG" }], summary: "AI engineer" })
    expect(m[0].content).toMatch(/Never invent/)
    expect(m[1].content).toContain('"b1"')
    const ok = AI_TASKS.suggest_edits.output.safeParse({ bullets: [{ id: "b1", text: "Built RAG", reason: "x" }], summary: { text: "s", reason: "r" } })
    expect(ok.success).toBe(true)
    expect(AI_TASKS.suggest_edits.input.safeParse({ jdSummary: "", missing: [], weak: [], bullets: [] }).success).toBe(false)
  })
})
