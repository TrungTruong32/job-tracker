import { describe, expect, it } from "vitest"
import { daysAgoStr, formatDate, formatDayMonth, relativeDays, todayStr } from "./format"

describe("format", () => {
  it("formats date-only strings without shifting the day", () => {
    expect(formatDate("2026-10-02")).toBe("02/10/2026")
    expect(formatDayMonth("2026-01-05")).toBe("05/01")
  })

  it("formats instants in Vietnam time", () => {
    expect(formatDate("2026-10-01T20:30:00Z")).toBe("02/10/2026")
  })

  it("gives today and N days ago in Vietnam time", () => {
    const d = new Date("2026-10-01T20:30:00Z")
    expect(todayStr(d)).toBe("2026-10-02")
    expect(daysAgoStr(30, d)).toBe("2026-09-02")
  })

  it("describes relative days", () => {
    const today = new Date("2026-10-10T09:00:00+07:00")
    expect(relativeDays("2026-10-10T01:00:00+07:00", today)).toBe("hôm nay")
    expect(relativeDays("2026-10-09T23:00:00+07:00", today)).toBe("hôm qua")
    expect(relativeDays("2026-10-01", today)).toBe("9 ngày trước")
  })
})
