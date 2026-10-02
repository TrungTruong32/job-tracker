"use client"

import Link from "next/link"
import type { RangeKey } from "@/app/(app)/dashboard/page"
import type { Stats } from "@/lib/stats"
import { cn } from "@/lib/utils"
import { BarsH, WeeklyBars } from "./charts"

const RANGE_OPTIONS: [RangeKey, string][] = [
  ["30", "30 ngày"],
  ["90", "90 ngày"],
  ["365", "1 năm"],
  ["all", "Tất cả"],
]

const pct = (x: number) => `${Math.round(x * 100)}%`

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function Dashboard({ stats, range }: { stats: Stats; range: RangeKey }) {
  const empty = stats.total === 0
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl">Dashboard</h1>
        <nav className="flex rounded-lg border p-0.5" aria-label="Khoảng thời gian">
          {RANGE_OPTIONS.map(([k, label]) => (
            <Link
              key={k}
              href={k === "all" ? "/dashboard" : `/dashboard?range=${k}`}
              aria-current={range === k ? "page" : undefined}
              className={cn("rounded-md px-2.5 py-1 text-sm text-muted-foreground", range === k && "bg-muted text-foreground")}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Tile label="Tổng số đơn" value={stats.total} />
        <Tile label="Đang chạy" value={stats.active} />
        <Tile label="Được gọi phỏng vấn" value={stats.interviewed} hint={stats.total ? pct(stats.interviewed / stats.total) : undefined} />
        <Tile label="Offer" value={stats.offers} />
        <Tile label="Tỉ lệ phản hồi" value={pct(stats.responseRate)} hint="Không tính Ghosted" />
      </div>

      {empty ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Chưa có dữ liệu trong khoảng thời gian này.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Số đơn nộp mỗi tuần" subtitle="12 tuần gần nhất">
            <WeeklyBars data={stats.weekly} />
          </Panel>
          <Panel title="Phễu theo vòng" subtitle="Số đơn từng đạt tới mỗi vòng">
            <BarsH data={stats.funnel.map((f) => ({ label: f.stage, value: f.count, text: String(f.count) }))} />
          </Panel>
          <Panel title="Tỉ lệ được gọi PV theo nguồn">
            <BarsH
              percent
              data={stats.bySource.map((b) => ({ label: b.key, value: b.rate, text: `${pct(b.rate)} (${b.interviewed}/${b.total})` }))}
            />
          </Panel>
          <Panel title="Tỉ lệ được gọi PV theo bản CV">
            <BarsH
              percent
              data={stats.byCv.map((b) => ({ label: b.key, value: b.rate, text: `${pct(b.rate)} (${b.interviewed}/${b.total})` }))}
            />
          </Panel>
        </div>
      )}
    </div>
  )
}
