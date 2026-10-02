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

/**
 * All calendar math happens in one fixed zone so the server (UTC on Vercel) and
 * the browser agree on "today" — otherwise SSR output and hydration disagree.
 */
export const APP_TZ = "Asia/Ho_Chi_Minh"

const keyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit" })

/** "YYYY-MM-DD" of a date-only string (as is) or an instant (in APP_TZ). */
export function dayKey(value: string | Date): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return keyFormat.format(typeof value === "string" ? new Date(value) : value)
}

/** Days since 1970-01-01 for a day key. */
export function dayNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}

/** Day key `n` days after `key` (negative = before). */
export function addDays(key: string, n: number): string {
  return new Date((dayNumber(key) + n) * DAY_MS).toISOString().slice(0, 10)
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayMon0(key: string): number {
  return (new Date(dayNumber(key) * DAY_MS).getUTCDay() + 6) % 7
}

/** Whole calendar days from `value` to `today` (positive = in the past). */
export function daysSince(value: string, today: Date): number {
  return dayNumber(dayKey(today)) - dayNumber(dayKey(value))
}

export function sortStages<T extends { position: number }>(stages: T[]): T[] {
  return [...stages].sort((a, b) => a.position - b.position)
}
