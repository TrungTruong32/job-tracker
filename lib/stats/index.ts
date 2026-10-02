import { addDays, dayKey, sortStages, weekdayMon0, type AppLite, type EventLite, type StageLite } from "@/lib/domain"

export type Breakdown = { key: string; total: number; interviewed: number; rate: number }

export type Stats = {
  total: number
  active: number
  interviewed: number
  offers: number
  responseRate: number
  weekly: { week: string; count: number }[]
  funnel: { stage: string; count: number }[]
  bySource: Breakdown[]
  byCv: Breakdown[]
}

const WEEKS = 12
const UNKNOWN = "Không rõ"
const GHOSTED = "ghosted"

/** Monday (day key) of the week containing `key`. */
function weekStart(key: string): string {
  return addDays(key, -weekdayMon0(key))
}

function breakdown(apps: AppLite[], keyOf: (a: AppLite) => string, interviewed: Set<string>): Breakdown[] {
  const map = new Map<string, Breakdown>()
  for (const a of apps) {
    const key = keyOf(a)
    const b = map.get(key) ?? { key, total: 0, interviewed: 0, rate: 0 }
    b.total++
    if (interviewed.has(a.id)) b.interviewed++
    map.set(key, b)
  }
  return [...map.values()]
    .map((b) => ({ ...b, rate: b.interviewed / b.total }))
    .sort((x, y) => y.total - x.total || x.key.localeCompare(y.key))
}

export function computeStats(
  apps: AppLite[],
  events: EventLite[],
  stages: StageLite[],
  cvNames: Record<string, string>,
  today: Date,
): Stats {
  const ordered = sortStages(stages)
  const first = ordered[0]
  const byId = new Map(ordered.map((s) => [s.id, s]))

  // every stage each app has ever been in (history + current)
  const reached = new Map<string, Set<string>>()
  for (const a of apps) reached.set(a.id, new Set([a.stage_id]))
  for (const e of events) {
    if (e.stage_id && reached.has(e.application_id)) reached.get(e.application_id)!.add(e.stage_id)
  }

  const interviewed = new Set<string>()
  let responded = 0
  for (const a of apps) {
    const hist = [...reached.get(a.id)!].map((id) => byId.get(id)).filter((s) => s !== undefined)
    if (hist.some((s) => (s.kind === "active" && s.id !== first?.id) || s.kind === "offer")) interviewed.add(a.id)
    if (hist.some((s) => s.id !== first?.id && s.name.trim().toLowerCase() !== GHOSTED)) responded++
  }

  const thisWeek = weekStart(dayKey(today))
  const weekly = Array.from({ length: WEEKS }, (_, i) => ({ week: addDays(thisWeek, -7 * (WEEKS - 1 - i)), count: 0 }))
  const weekIndex = new Map(weekly.map((w, i) => [w.week, i]))
  for (const a of apps) {
    const i = weekIndex.get(weekStart(dayKey(a.applied_at)))
    if (i !== undefined) weekly[i].count++
  }

  const funnel = ordered
    .filter((s) => s.kind !== "closed")
    .map((s) => ({ stage: s.name, count: apps.filter((a) => reached.get(a.id)!.has(s.id)).length }))
  if (first && funnel.length) funnel[0].count = apps.length // everyone starts at the first stage

  return {
    total: apps.length,
    active: apps.filter((a) => byId.get(a.stage_id)?.kind === "active").length,
    interviewed: interviewed.size,
    offers: apps.filter((a) => byId.get(a.stage_id)?.kind === "offer").length,
    responseRate: apps.length ? responded / apps.length : 0,
    weekly,
    funnel,
    bySource: breakdown(apps, (a) => a.source?.trim() || UNKNOWN, interviewed),
    byCv: breakdown(apps, (a) => (a.cv_version_id && cvNames[a.cv_version_id]) || UNKNOWN, interviewed),
  }
}
