import { addDays, dayKey, daysSince } from "@/lib/domain"

/** Today (or `d`) as YYYY-MM-DD in the app's time zone. */
export function todayStr(d = new Date()): string {
  return dayKey(d)
}

/** YYYY-MM-DD `days` before today. */
export function daysAgoStr(days: number, d = new Date()): string {
  return addDays(dayKey(d), -days)
}

/** dd/MM/yyyy — built from the day key so server and browser render the same text. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return ""
  const [y, m, d] = dayKey(value).split("-")
  return `${d}/${m}/${y}`
}

export function formatDayMonth(value: string): string {
  const [, m, d] = dayKey(value).split("-")
  return `${d}/${m}`
}

/** "hôm nay", "hôm qua", "5 ngày trước". */
export function relativeDays(value: string, today = new Date()): string {
  const d = daysSince(value, today)
  if (d <= 0) return "hôm nay"
  if (d === 1) return "hôm qua"
  return `${d} ngày trước`
}
