import { describe, expect, it } from "vitest"
import type { AppLite, StageLite } from "@/lib/domain"
import { getTodayItems } from "."

const stages: StageLite[] = [
  { id: "s0", name: "Đã nộp", position: 0, kind: "active" },
  { id: "s5", name: "Offer", position: 5, kind: "offer" },
  { id: "s6", name: "Rejected", position: 6, kind: "closed" },
]
const today = new Date("2026-10-10T09:00:00+07:00")

function app(over: Partial<AppLite>): AppLite {
  return {
    id: "a",
    company: "Acme",
    position: "AI Eng",
    stage_id: "s0",
    source: null,
    cv_version_id: null,
    applied_at: "2026-10-01",
    last_activity_at: "2026-10-10T09:00:00+07:00",
    next_action: null,
    next_action_due: null,
    ...over,
  }
}

describe("getTodayItems", () => {
  it("flags an action due today as warn with 0 days over", () => {
    const items = getTodayItems([app({ next_action: "Follow up", next_action_due: "2026-10-10" })], stages, 7, today)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ reason: "due", daysOver: 0, severity: "warn" })
  })

  it("marks an action overdue by more than 3 days as danger", () => {
    const items = getTodayItems([app({ next_action_due: "2026-10-05" })], stages, 7, today)
    expect(items[0]).toMatchObject({ reason: "due", daysOver: 5, severity: "danger" })
  })

  it("ignores future due dates", () => {
    expect(getTodayItems([app({ next_action_due: "2026-10-11" })], stages, 7, today)).toEqual([])
  })

  it("does not flag an app exactly at staleDays", () => {
    const at = "2026-10-03T23:00:00+07:00" // 7 days ago
    expect(getTodayItems([app({ last_activity_at: at })], stages, 7, today)).toEqual([])
  })

  it("flags an app one day past staleDays as warn", () => {
    const at = "2026-10-02T08:00:00+07:00" // 8 days ago
    const items = getTodayItems([app({ last_activity_at: at })], stages, 7, today)
    expect(items[0]).toMatchObject({ reason: "stale", daysOver: 1, severity: "warn" })
  })

  it("never flags closed or offer apps as stale", () => {
    const at = "2026-09-01T00:00:00+07:00"
    const items = getTodayItems(
      [app({ id: "x", stage_id: "s6", last_activity_at: at }), app({ id: "y", stage_id: "s5", last_activity_at: at })],
      stages,
      7,
      today,
    )
    expect(items).toEqual([])
  })

  it("returns one 'due' item when an app is both due and stale", () => {
    const at = "2026-09-01T00:00:00+07:00"
    const items = getTodayItems([app({ last_activity_at: at, next_action_due: "2026-10-09" })], stages, 7, today)
    expect(items).toHaveLength(1)
    expect(items[0].reason).toBe("due")
  })

  it("sorts the most overdue first", () => {
    const items = getTodayItems(
      [app({ id: "a1", next_action_due: "2026-10-09" }), app({ id: "a2", next_action_due: "2026-10-01" })],
      stages,
      7,
      today,
    )
    expect(items.map((i) => i.app.id)).toEqual(["a2", "a1"])
  })
})

describe("time zone", () => {
  it("uses Vietnam calendar days even when the server clock is UTC", () => {
    // 2026-10-09 18:00 UTC is already 2026-10-10 01:00 in Vietnam
    const utcEvening = new Date("2026-10-09T18:00:00Z")
    const items = getTodayItems([app({ next_action_due: "2026-10-10" })], stages, 7, utcEvening)
    expect(items[0]).toMatchObject({ reason: "due", daysOver: 0 })
  })
})
