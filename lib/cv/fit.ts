import { plainText } from "./inline"
import type { CvContent } from "./resolve"
import type { ProfileItem } from "@/lib/profile/schema"

export type FitParams = { font_size: number; line_height: number; margin_mm: number }
export type StyleBounds = { [K in keyof FitParams]: [min: number, max: number] }

// Shrink the cheapest-looking parameter first: spacing, then margins, then text size.
const ORDER: (keyof FitParams)[] = ["line_height", "margin_mm", "font_size"]
const STEP: Record<keyof FitParams, number> = { line_height: 0.01, margin_mm: 0.25, font_size: 0.25 }
const roundTo = (v: number, step: number) => Math.round(v / step) * step

/**
 * Find the largest style (within bounds) that fits one page. `measure` returns the used
 * page fraction for a style. Each dimension is shrunk fully only if needed, else binary-searched.
 */
export async function fitStyle<S extends FitParams>(
  measure: (s: S) => Promise<number>,
  start: S,
  bounds: StyleBounds,
): Promise<{ ok: boolean; style: S; used: number; tries: number }> {
  let tries = 1
  let cur = { ...start }
  let used = await measure(cur)
  if (used <= 1) return { ok: true, style: cur, used, tries }

  for (const d of ORDER) {
    const min = bounds[d][0]
    if (cur[d] <= min) continue
    const atMin = { ...cur, [d]: min }
    tries++
    const usedMin = await measure(atMin)
    if (usedMin > 1) {
      cur = atMin
      used = usedMin
      continue
    }
    // fits at min: binary search the largest value that still fits
    let lo = min // fits
    let hi = cur[d] // does not fit
    let best = { style: atMin, used: usedMin }
    while (hi - lo > STEP[d]) {
      const mid = roundTo((lo + hi) / 2, STEP[d])
      if (mid <= lo || mid >= hi) break
      const s = { ...cur, [d]: mid }
      tries++
      const u = await measure(s)
      if (u <= 1) {
        lo = mid
        best = { style: s, used: u }
      } else hi = mid
    }
    return { ok: true, style: best.style, used: best.used, tries }
  }
  return { ok: false, style: cur, used, tries }
}

export type DropSuggestion = {
  kind: "item" | "bullet"
  item_id: string
  bullet_id?: string
  label: string
  reason: string
  score: number
}

function yearsAgo(end: unknown): number {
  if (end === "present" || typeof end !== "string") return 0
  const y = parseInt(end.slice(0, 4), 10)
  return Number.isFinite(y) ? Math.max(0, new Date().getFullYear() - y) : 0
}

/** What to cut first: off-target items, then older ones, then long bullets. Never an item's last bullet. */
export function rankDrops(content: CvContent, items: ProfileItem[], targetTags: string[], limit = 8): DropSuggestion[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  const want = new Set(targetTags.map((t) => t.toLowerCase()))
  const out: DropSuggestion[] = []
  for (const s of content.sections) {
    if (!s.visible || s.key === "summary") continue
    for (const ref of s.items) {
      const it = byId.get(ref.item_id)
      if (!it) continue
      const onTarget = !want.size || it.tags.some((t) => want.has(t))
      const age = yearsAgo(it.data.end ?? it.data.date)
      const title = [it.data.title ?? it.data.name ?? it.data.category ?? it.data.school, it.data.company].filter(Boolean).join(" | ")
      out.push({
        kind: "item",
        item_id: it.id,
        label: String(title),
        reason: [!onTarget && "không khớp vị trí mục tiêu", age >= 3 && `${age} năm trước`].filter(Boolean).join(", ") || "ít ưu tiên",
        score: (onTarget ? 0 : 10) + age,
      })
      const all = Array.isArray(it.data.bullets) ? (it.data.bullets as { id: string; text: string }[]) : []
      const ids = ref.bullet_ids ?? all.map((b) => b.id)
      if (ids.length < 2) continue
      for (const id of ids) {
        const b = all.find((x) => x.id === id)
        if (!b) continue
        const text = plainText(ref.bullet_overrides?.[id] ?? b.text)
        out.push({
          kind: "bullet",
          item_id: it.id,
          bullet_id: id,
          label: text.length > 90 ? text.slice(0, 87) + "…" : text,
          reason: [`${text.length} ký tự`, !onTarget && "mục không khớp vị trí"].filter(Boolean).join(", "),
          score: (onTarget ? 0 : 5) + text.length / 100 + age * 0.5,
        })
      }
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit)
}
