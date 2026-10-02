"use client"

import Link from "next/link"
import { AlarmClock, CheckCircle2 } from "lucide-react"
import type { TodoItem } from "@/lib/followup"
import { cn } from "@/lib/utils"

function describe(item: TodoItem): string {
  if (item.reason === "due") {
    const what = item.app.next_action || "Việc cần làm"
    return item.daysOver === 0 ? `${what} — hạn hôm nay` : `${what} — quá hạn ${item.daysOver} ngày`
  }
  return `Không có cập nhật — quá ${item.daysOver} ngày so với ngưỡng follow-up`
}

export function TodayPanel({ items }: { items: TodoItem[] }) {
  if (!items.length) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
        <CheckCircle2 className="size-4 text-emerald-600" />
        Không có việc cần follow-up hôm nay.
      </div>
    )
  }
  return (
    <section aria-labelledby="today-title" className="rounded-xl border bg-card p-3 sm:p-4">
      <h2 id="today-title" className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <AlarmClock className="size-4" /> Cần làm hôm nay
        <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground tabular-nums">{items.length}</span>
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.app.id}>
            <Link
              href={`/applications/${item.app.id}`}
              className={cn(
                "block rounded-lg border-l-4 bg-muted/40 px-3 py-2 text-sm transition-colors hover:bg-muted",
                item.severity === "danger" ? "border-l-rose-500" : "border-l-amber-500",
              )}
            >
              <span className="font-medium">{item.app.company}</span>
              <span className="text-muted-foreground"> · {item.app.position}</span>
              <span className="block text-xs text-muted-foreground">{describe(item)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
