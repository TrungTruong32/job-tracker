"use client"

import { useMemo, useState } from "react"
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import type { Application, Stage } from "@/lib/data/types"
import { cn } from "@/lib/utils"
import { AppCard } from "./app-card"

type Props = {
  apps: Application[]
  stages: Stage[]
  onMove: (appId: string, stageId: string) => void
  today: Date
}

function DraggableCard({ app, ...rest }: { app: Application } & Omit<Props, "apps">) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: app.id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="listitem"
      aria-roledescription="thẻ có thể kéo"
      className={cn("touch-manipulation", isDragging && "opacity-30")}
      data-testid="kanban-card"
    >
      <AppCard app={app} {...rest} />
    </div>
  )
}

function Column({
  stage,
  apps,
  className,
  ...rest
}: { stage: Stage; apps: Application[]; className?: string } & Omit<Props, "apps">) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  return (
    <section
      ref={setNodeRef}
      aria-label={stage.name}
      data-testid={`column-${stage.name}`}
      className={cn(
        "flex min-h-40 flex-col rounded-2xl bg-muted/50 p-2 transition-colors",
        isOver && "bg-primary/10 ring-2 ring-primary/30",
        className,
      )}
    >
      <header className="flex items-center justify-between px-1.5 pt-1 pb-2">
        <h2 className="text-sm font-semibold">{stage.name}</h2>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
          {apps.length}
        </span>
      </header>
      <div role="list" className="flex flex-1 flex-col gap-2">
        {apps.map((a) => (
          <DraggableCard key={a.id} app={a} {...rest} />
        ))}
        {!apps.length && <p className="px-1.5 py-6 text-center text-xs text-muted-foreground">Trống</p>}
      </div>
    </section>
  )
}

export function Kanban({ apps, stages, onMove, today }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mobileStage, setMobileStage] = useState(stages[0]?.id)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const byStage = useMemo(() => {
    const m = new Map<string, Application[]>(stages.map((s) => [s.id, []]))
    for (const a of apps) m.get(a.stage_id)?.push(a)
    return m
  }, [apps, stages])

  const active = activeId ? apps.find((a) => a.id === activeId) : undefined

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const appId = String(e.active.id)
    const stageId = e.over ? String(e.over.id) : null
    const app = apps.find((a) => a.id === appId)
    if (app && stageId && stageId !== app.stage_id) onMove(appId, stageId)
  }

  const common = { stages, onMove, today }
  const current = stages.find((s) => s.id === mobileStage) ?? stages[0]

  return (
    <>
      {/* Phone: one column at a time, chips to switch */}
      <div className="sm:hidden">
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Chọn vòng">
          {stages.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={s.id === current?.id}
              onClick={() => setMobileStage(s.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
                s.id === current?.id ? "border-primary bg-primary text-primary-foreground" : "bg-background",
              )}
            >
              {s.name}
              <span className="text-xs opacity-70 tabular-nums">{byStage.get(s.id)?.length ?? 0}</span>
            </button>
          ))}
        </div>
        {current && (
          <div className="flex flex-col gap-2">
            {(byStage.get(current.id) ?? []).map((a) => (
              <AppCard key={a.id} app={a} {...common} />
            ))}
            {!byStage.get(current.id)?.length && (
              <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                Chưa có đơn ở vòng {current.name}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Tablet / laptop: drag between columns */}
      <div className="hidden sm:block">
        <DndContext
          sensors={sensors}
          onDragStart={(e) => setActiveId(String(e.active.id))}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
          accessibility={{
            screenReaderInstructions: { draggable: "Nhấn Space để nhấc thẻ, dùng phím mũi tên để di chuyển, Space để thả." },
          }}
        >
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
            {stages.map((s) => (
              <Column
                key={s.id}
                stage={s}
                apps={byStage.get(s.id) ?? []}
                {...common}
                className="w-64 shrink-0 xl:w-auto xl:min-w-52 xl:flex-1"
              />
            ))}
          </div>
          <DragOverlay>{active ? <AppCard app={active} {...common} dragging /> : null}</DragOverlay>
        </DndContext>
      </div>
    </>
  )
}
