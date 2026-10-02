import type { Metadata } from "next"
import { Dashboard } from "@/components/dashboard/dashboard"
import { getApplications, getCvs, getEvents, getStages } from "@/lib/data/queries"
import { daysAgoStr } from "@/lib/format"
import { computeStats } from "@/lib/stats"

export const metadata: Metadata = { title: "Dashboard" }

const RANGES = { "30": 30, "90": 90, "365": 365 } as const
export type RangeKey = keyof typeof RANGES | "all"

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { range: raw } = await searchParams
  const range: RangeKey = typeof raw === "string" && raw in RANGES ? (raw as RangeKey) : "all"

  const [stages, apps, events, cvs] = await Promise.all([getStages(), getApplications(), getEvents(), getCvs()])
  const today = new Date()
  let inRange = apps
  if (range !== "all") {
    const fromStr = daysAgoStr(RANGES[range], today)
    inRange = apps.filter((a) => a.applied_at >= fromStr)
  }
  const ids = new Set(inRange.map((a) => a.id))
  const stats = computeStats(
    inRange,
    events.filter((e) => ids.has(e.application_id)),
    stages,
    Object.fromEntries(cvs.map((c) => [c.id, c.name])),
    today,
  )
  // Weekly trend always shows the last 12 weeks, regardless of the range filter.
  const weekly = range === "all" ? stats.weekly : computeStats(apps, [], stages, {}, today).weekly

  return (
    <div className="p-4 sm:p-6">
      <Dashboard stats={{ ...stats, weekly }} range={range} />
    </div>
  )
}
