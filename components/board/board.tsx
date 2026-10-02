"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Columns3, Plus, Rows3 } from "lucide-react"
import { toast } from "sonner"
import { ApplicationForm } from "@/components/application-form/application-form"
import { ResponsiveDialog } from "@/components/responsive-dialog"
import { Button } from "@/components/ui/button"
import { moveApplication } from "@/lib/data/actions"
import type { Application, CvVersion, PublicSettings, Stage } from "@/lib/data/types"
import { getTodayItems } from "@/lib/followup"
import { cn } from "@/lib/utils"
import { Kanban } from "./kanban"
import { TableView } from "./table-view"
import { TodayPanel } from "./today-panel"

type View = "kanban" | "table"
const VIEW_KEY = "jt:view"

export function Board({
  initialApps,
  stages,
  cvs,
  settings,
}: {
  initialApps: Application[]
  stages: Stage[]
  cvs: CvVersion[]
  settings: PublicSettings
}) {
  const [apps, setApps] = useState(initialApps)
  const [view, setView] = useState<View>("kanban")
  const [adding, setAdding] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()
  const today = useMemo(() => new Date(), [])

  useEffect(() => setApps(initialApps), [initialApps])
  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY)
      if (v === "kanban" || v === "table") setView(v)
    } catch {}
  }, [])

  function changeView(v: View) {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {}
  }

  function move(appId: string, stageId: string) {
    const before = apps
    setApps((list) => list.map((a) => (a.id === appId ? { ...a, stage_id: stageId, last_activity_at: new Date().toISOString() } : a)))
    startTransition(async () => {
      const res = await moveApplication(appId, stageId)
      if (!res.ok) {
        setApps(before)
        toast.error("Không chuyển được vòng", { description: res.error })
      } else {
        toast.success(`Đã chuyển sang ${stages.find((s) => s.id === stageId)?.name}`)
      }
    })
  }

  const todayItems = useMemo(() => getTodayItems(apps, stages, settings.stale_days, today), [apps, stages, settings.stale_days, today])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl">Đơn ứng tuyển</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5" role="group" aria-label="Kiểu hiển thị">
            {(
              [
                ["kanban", Columns3, "Kanban"],
                ["table", Rows3, "Bảng"],
              ] as const
            ).map(([v, Icon, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => changeView(v)}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground",
                  view === v && "bg-muted text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <Button onClick={() => setAdding(true)} className="hidden sm:inline-flex">
            <Plus /> Thêm đơn
          </Button>
        </div>
      </div>

      <TodayPanel items={todayItems} />

      {apps.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="font-medium">Chưa có đơn ứng tuyển nào</p>
          <p className="mt-1 text-sm text-muted-foreground">Thêm đơn đầu tiên: dán JD và để AI điền giúp.</p>
          <Button className="mt-4" onClick={() => setAdding(true)}>
            <Plus /> Thêm đơn
          </Button>
        </div>
      ) : view === "kanban" ? (
        <Kanban apps={apps} stages={stages} onMove={move} today={today} />
      ) : (
        <TableView apps={apps} stages={stages} cvs={cvs} onMove={move} today={today} />
      )}

      {/* Phone FAB */}
      <Button
        onClick={() => setAdding(true)}
        size="icon-lg"
        aria-label="Thêm đơn"
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-lg sm:hidden"
      >
        <Plus className="size-6" />
      </Button>

      <ResponsiveDialog open={adding} onOpenChange={setAdding} title="Thêm đơn ứng tuyển">
        {adding && (
          <ApplicationForm
            stages={stages}
            cvs={cvs}
            settings={settings}
            onDone={(id) => {
              setAdding(false)
              if (id) router.refresh()
            }}
          />
        )}
      </ResponsiveDialog>
    </div>
  )
}
