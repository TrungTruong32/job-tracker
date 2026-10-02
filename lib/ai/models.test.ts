import { describe, expect, it } from "vitest"
import { normalizeModels } from "./models"

describe("normalizeModels", () => {
  it("reads OpenRouter pricing to flag free models and sorts free first", () => {
    const r = normalizeModels("openrouter", {
      data: [
        { id: "openai/gpt-4o", name: "GPT-4o", context_length: 128000, pricing: { prompt: "0.0000025", completion: "0.00001" } },
        { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B (free)", context_length: 131072, pricing: { prompt: "0", completion: "0" } },
      ],
    })
    expect(r.map((m) => [m.id, m.free])).toEqual([
      ["meta-llama/llama-3.3-70b-instruct:free", true],
      ["openai/gpt-4o", false],
    ])
    expect(r[0].context).toBe(131072)
  })

  it("strips the models/ prefix from Gemini ids", () => {
    const r = normalizeModels("gemini", { data: [{ id: "models/gemini-2.5-flash" }, { id: "models/embedding-001" }] })
    expect(r.map((m) => m.id)).toEqual(["gemini-2.5-flash"])
  })

  it("accepts plain OpenAI-style lists (Ollama/custom) with unknown price", () => {
    const r = normalizeModels("ollama", { data: [{ id: "qwen2.5:7b" }] })
    expect(r).toEqual([{ id: "qwen2.5:7b", name: "qwen2.5:7b", free: null, context: null }])
  })

  it("returns [] for junk", () => {
    expect(normalizeModels("custom", { nope: 1 })).toEqual([])
    expect(normalizeModels("custom", null)).toEqual([])
  })
})
