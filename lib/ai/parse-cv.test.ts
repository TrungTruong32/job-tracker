import { describe, expect, it } from "vitest"
import { buildParseCvMessages } from "./prompts"
import { AI_TASKS } from "./tasks"

describe("parse_cv task", () => {
  it("asks for the profile JSON shape and clips very long CVs at 15000 chars", () => {
    const msgs = buildParseCvMessages("x".repeat(20_000))
    expect(msgs[0].content).toMatch(/"section"/)
    expect(msgs[0].content).toMatch(/experience/)
    expect(msgs[1].content.length).toBeLessThan(15_100)
  })

  it("requires at least 200 characters of CV text", () => {
    expect(AI_TASKS.parse_cv.input.safeParse({ cvText: "short" }).success).toBe(false)
    expect(AI_TASKS.parse_cv.input.safeParse({ cvText: "a".repeat(250) }).success).toBe(true)
  })

  it("accepts a loose result and leaves validation to normalizeParsed", () => {
    expect(AI_TASKS.parse_cv.output.safeParse({ basics: { full_name: "A" }, items: [{ section: "x" }] }).success).toBe(true)
    expect(AI_TASKS.parse_cv.output.safeParse({ items: "nope" }).success).toBe(false)
  })
})
