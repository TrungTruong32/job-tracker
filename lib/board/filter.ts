import type { AppLite } from "@/lib/domain"

export type BoardFilters = {
  q?: string
  stageId?: string
  source?: string
  cvId?: string
  from?: string // YYYY-MM-DD inclusive
  to?: string
}

export type SortKey = "applied_at" | "company" | "last_activity_at"

type Searchable = AppLite & { jd_text?: string | null; location?: string | null }

/** Lowercase and drop Vietnamese diacritics so "ky su" matches "Kỹ sư". */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
}

export function filterApps<T extends Searchable>(apps: T[], f: BoardFilters): T[] {
  const terms = f.q ? normalize(f.q).split(/\s+/).filter(Boolean) : []
  return apps.filter((a) => {
    if (f.stageId && a.stage_id !== f.stageId) return false
    if (f.source && (a.source ?? "") !== f.source) return false
    if (f.cvId && a.cv_version_id !== f.cvId) return false
    if (f.from && a.applied_at < f.from) return false
    if (f.to && a.applied_at > f.to) return false
    if (terms.length) {
      const hay = normalize([a.company, a.position, a.location, a.source, a.jd_text].filter(Boolean).join(" "))
      if (!terms.every((t) => hay.includes(t))) return false
    }
    return true
  })
}

export function sortApps<T extends AppLite>(apps: T[], key: SortKey, dir: "asc" | "desc"): T[] {
  const sign = dir === "asc" ? 1 : -1
  return [...apps].sort((a, b) => sign * String(a[key]).localeCompare(String(b[key]), "vi"))
}
