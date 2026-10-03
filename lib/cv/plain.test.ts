import { describe, expect, it } from "vitest"
import { AI_TASKS } from "@/lib/ai/tasks"
import { buildShortenMessages } from "@/lib/ai/prompts"
import { cvToPlainText } from "./plain"
import { contentFromTags, resolveCv } from "./resolve"
import { SAMPLE_BASICS, SAMPLE_ITEMS } from "./templates/sample"

describe("cvToPlainText", () => {
  it("lists header, sections, nested projects and bullets without markup", () => {
    const cv = resolveCv(contentFromTags(SAMPLE_ITEMS, []), { basics: SAMPLE_BASICS, items: SAMPLE_ITEMS }, { dateFormat: "MMM YYYY" })
    const t = cvToPlainText(cv)
    expect(t.startsWith("Nguyen Minh An\nAI Engineer")).toBe(true)
    expect(t).toContain("WORK EXPERIENCE")
    expect(t).toContain("AI Engineer | Acme Commerce (Jul 2025 - Present)")
    expect(t).toContain("  Order Sync Pipeline & Nightly Backfill | Python, PostgreSQL, Airflow")
    expect(t).toContain("- Built an ETL pipeline replacing a manual spreadsheet export: ~120K validated rows")
    expect(t).not.toContain("**")
  })
})

describe("shorten_bullets task", () => {
  it("keeps ids and asks to preserve numbers and markup", () => {
    const m = buildShortenMessages([{ id: "b1", text: "Built **~120K rows** pipeline for 16 brands" }], 0.7)
    expect(m[0].content).toMatch(/every number/)
    expect(m[1].content).toContain('"id":"b1"')
    expect(AI_TASKS.shorten_bullets.output.safeParse({ bullets: [{ id: "b1", text: "x" }] }).success).toBe(true)
    expect(AI_TASKS.shorten_bullets.input.safeParse({ bullets: [], ratio: 0.7 }).success).toBe(false)
  })
})
