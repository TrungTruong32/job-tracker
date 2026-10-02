"use client"

import Link from "next/link"
import { CalendarClock, MoreHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Application, Stage } from "@/lib/data/types"
import { formatDayMonth, relativeDays } from "@/lib/format"
import { cn } from "@/lib/utils"

export function scoreClass(score: number) {
  if (score >= 75) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
  if (score >= 50) return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
  return "bg-rose-500/15 text-rose-700 dark:text-rose-300"
}

export function MoveMenu({
  app,
  stages,
  onMove,
}: {
  app: Application
  stages: Stage[]
  onMove: (appId: string, stageId: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Chuyển vòng cho ${app.company}`}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Chuyển vòng</DropdownMenuLabel>
          {stages.map((s) => (
            <DropdownMenuItem key={s.id} disabled={s.id === app.stage_id} onClick={() => onMove(app.id, s.id)}>
              {s.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppCard({
  app,
  stages,
  onMove,
  dragging,
  today,
}: {
  app: Application
  stages: Stage[]
  onMove: (appId: string, stageId: string) => void
  dragging?: boolean
  today: Date
}) {
  const due = app.next_action_due
  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card p-3 text-sm shadow-xs transition-shadow hover:shadow-md",
        dragging && "rotate-1 shadow-lg ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-start gap-2">
        <Link
          href={`/applications/${app.id}`}
          className="min-w-0 flex-1 after:absolute after:inset-0 after:content-['']"
          draggable={false}
        >
          <p className="truncate font-semibold">{app.company}</p>
          <p className="truncate text-muted-foreground">{app.position}</p>
        </Link>
        <div className="relative z-10 -mt-1 -mr-1">
          <MoveMenu app={app} stages={stages} onMove={onMove} />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span title="Hoạt động gần nhất">{relativeDays(app.last_activity_at, today)}</span>
        {app.ai_fit && (
          <Badge variant="secondary" className={cn("h-5 px-1.5", scoreClass(app.ai_fit.score))}>
            {app.ai_fit.score}%
          </Badge>
        )}
        {due && (
          <span className="inline-flex items-center gap-1" title={app.next_action ?? undefined}>
            <CalendarClock className="size-3" />
            {formatDayMonth(due)}
          </span>
        )}
      </div>
    </div>
  )
}
