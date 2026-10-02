import { daysSince, parseDay } from "@/lib/domain"

/** Today as YYYY-MM-DD in the viewer's local time. */
export function todayStr(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return ""
  return parseDay(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function formatDayMonth(value: string): string {
  return parseDay(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
}

/** "hôm nay", "hôm qua", "5 ngày trước". */
export function relativeDays(value: string, today = new Date()): string {
  const d = daysSince(value, today)
  if (d <= 0) return "hôm nay"
  if (d === 1) return "hôm qua"
  return `${d} ngày trước`
}
