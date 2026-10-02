import { describe, expect, it } from "vitest"
import { AI_TIMEOUT_DEFAULT_S, aiTimeoutMs } from "./timeout"

describe("aiTimeoutMs", () => {
  it("uses the workspace setting in seconds", () => {
    expect(aiTimeoutMs({ ai_timeout_s: 45 })).toBe(45_000)
  })

  it("defaults to 90s when unset", () => {
    expect(AI_TIMEOUT_DEFAULT_S).toBe(90)
    expect(aiTimeoutMs(null)).toBe(90_000)
    expect(aiTimeoutMs({ ai_timeout_s: null })).toBe(90_000)
  })

  it("clamps to 15-120s so two tries stay under Vercel's 300s function limit", () => {
    expect(aiTimeoutMs({ ai_timeout_s: 5 })).toBe(15_000)
    expect(aiTimeoutMs({ ai_timeout_s: 999 })).toBe(120_000)
  })
})
