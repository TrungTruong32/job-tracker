import { describe, expect, it } from "vitest"
import type { AppLite, EventLite, StageLite } from "@/lib/domain"
import { computeStats } from "."

const stages: StageLite[] = [
  { id: "s0", name: "Đã nộp", position: 0, kind: "active" },
  { id: "s1", name: "Screening", position: 1, kind: "active" },
  { id: "s5", name: "Offer", position: 5, kind: "offer" },
  { id: "s6", name: "Rejected", position: 6, kind: "closed" },
  { id: "s7", name: "Ghosted", position: 7, kind: "closed" },
]
const today = new Date(2026, 9, 10)

function app(id: string, over: Partial<AppLite> = {}): AppLite {
  return {
    id,
    company: "C" + id,
    position: "P",
    stage_id: "s0",
    source: "LinkedIn",
    cv_version_id: "cv1",
    applied_at: "2026-10-05",
    last_activity_at: "2026-10-05T00:00:00Z",
    next_action: null,
    next_action_due: null,
    ...over,
  }
}
const ev = (application_id: string, stage_id: string): EventLite => ({ application_id, stage_id, type: "stage_change" })

describe("computeStats", () => {
  const apps = [
    app("a"), // still in first stage: no response
    app("b", { stage_id: "s6" }), // rejected after screening
    app("c", { stage_id: "s6", source: "TopCV" }), // rejected straight from first stage
    app("d", { stage_id: "s7", source: "TopCV", cv_version_id: "cv2" }), // ghosted
    app("e", { stage_id: "s5", cv_version_id: "cv2" }), // offer
  ]
  const events = [
    ev("a", "s0"),
    ev("b", "s0"), ev("b", "s1"), ev("b", "s6"),
    ev("c", "s0"), ev("c", "s6"),
    ev("d", "s0"), ev("d", "s7"),
    ev("e", "s0"), ev("e", "s1"), ev("e", "s5"),
  ]
  const s = computeStats(apps, events, stages, { cv1: "CV AI v1", cv2: "CV AI v2" }, today)

  it("counts totals, active and offers", () => {
    expect(s.total).toBe(5)
    expect(s.active).toBe(1)
    expect(s.offers).toBe(1)
  })

  it("counts interviewed via history even when now rejected", () => {
    expect(s.interviewed).toBe(2) // b, e
  })

  it("treats a straight rejection as a response but ghosted as none", () => {
    // responded: b, c, e = 3 of 5
    expect(s.responseRate).toBeCloseTo(0.6)
  })

  it("returns 12 weekly buckets ending with the current week", () => {
    expect(s.weekly).toHaveLength(12)
    expect(s.weekly[11]).toEqual({ week: "2026-10-05", count: 5 })
  })

  it("builds a funnel of apps that ever reached each non-closed stage", () => {
    expect(s.funnel).toEqual([
      { stage: "Đã nộp", count: 5 },
      { stage: "Screening", count: 2 },
      { stage: "Offer", count: 1 },
    ])
  })

  it("breaks down interview rate by source and by CV name", () => {
    expect(s.bySource).toEqual([
      { key: "LinkedIn", total: 3, interviewed: 2, rate: 2 / 3 },
      { key: "TopCV", total: 2, interviewed: 0, rate: 0 },
    ])
    expect(s.byCv).toEqual([
      { key: "CV AI v1", total: 3, interviewed: 1, rate: 1 / 3 },
      { key: "CV AI v2", total: 2, interviewed: 1, rate: 0.5 },
    ])
  })

  it("handles an empty dataset", () => {
    const e = computeStats([], [], stages, {}, today)
    expect(e.total).toBe(0)
    expect(e.responseRate).toBe(0)
    expect(e.bySource).toEqual([])
  })
})
