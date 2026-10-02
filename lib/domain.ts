// Shared lightweight shapes used by pure logic (followup, stats) and UI.

export type StageKind = "active" | "offer" | "closed"

export type StageLite = {
  id: string
  name: string
  position: number
  kind: StageKind
}

export type AppLite = {
  id: string
  company: string
  position: string
  stage_id: string
  source: string | null
  cv_version_id: string | null
  applied_at: string // YYYY-MM-DD
  last_activity_at: string // ISO timestamp
  next_action: string | null
  next_action_due: string | null // YYYY-MM-DD
}

export type EventLite = {
  application_id: string
  stage_id: string | null
  type: string
}

const DAY_MS = 86_400_000

/** Local calendar-day number for a date (ignores time of day). */
function dayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS)
}

/** Parse "YYYY-MM-DD" (or an ISO timestamp) as a local calendar date. */
export function parseDay(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(value)
}

/** Whole calendar days from `value` to `today` (positive = in the past). */
export function daysSince(value: string, today: Date): number {
  return dayNumber(today) - dayNumber(parseDay(value))
}

export function sortStages<T extends { position: number }>(stages: T[]): T[] {
  return [...stages].sort((a, b) => a.position - b.position)
}
