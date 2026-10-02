"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatDayMonth } from "@/lib/format"

/** Weekly volume: one series, 2px gaps between bars, rounded data-ends, hover tooltip. */
export function WeeklyBars({ data }: { data: { week: string; count: number }[] }) {
  return (
    <div className="h-56" role="img" aria-label={`Số đơn mỗi tuần: ${data.map((d) => `${formatDayMonth(d.week)}: ${d.count}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -24 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="week"
            tickFormatter={formatDayMonth}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                  <p className="text-muted-foreground">Tuần từ {formatDayMonth(String(payload[0].payload.week))}</p>
                  <p className="font-semibold tabular-nums">{payload[0].value} đơn</p>
                </div>
              ) : null
            }
          />
          <Bar dataKey="count" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Horizontal bars with the value written beside each bar (few rows, so every row is labeled). */
export function BarsH({ data, percent }: { data: { label: string; value: number; text: string }[]; percent?: boolean }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">Chưa có dữ liệu</p>
  const max = percent ? 1 : Math.max(1, ...data.map((d) => d.value))
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[minmax(0,7rem)_1fr] items-center gap-3 text-sm sm:grid-cols-[minmax(0,9rem)_1fr]" title={`${d.label}: ${d.text}`}>
          <span className="truncate text-muted-foreground">{d.label}</span>
          <span className="flex items-center gap-2">
            <span className="h-3 flex-1 rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-(--series-1) transition-[width]"
                style={{ width: `${Math.max(d.value > 0 ? 2 : 0, (d.value / max) * 100)}%` }}
              />
            </span>
            <span className="w-24 shrink-0 text-right text-xs tabular-nums">{d.text}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
