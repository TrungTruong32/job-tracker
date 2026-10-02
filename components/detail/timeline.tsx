"use client"

import { useState, useTransition } from "react"
import { ArrowRightLeft, Loader2, MessageSquareText, Pencil, Plus, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import { ResponsiveDialog } from "@/components/responsive-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { addEvent, deleteEvent, updateEvent } from "@/lib/data/actions"
import type { EventInput, Stage, StageEvent } from "@/lib/data/types"
import { formatDate, todayStr } from "@/lib/format"

const TYPE_LABEL: Record<EventInput["type"], string> = {
  stage_change: "Chuyển vòng",
  interview: "Phỏng vấn",
  note: "Ghi chú",
}
const TYPE_ICON = { stage_change: ArrowRightLeft, interview: Users, note: MessageSquareText }

export function Timeline({ appId, events, stages }: { appId: string; events: StageEvent[]; stages: Stage[] }) {
  const [editing, setEditing] = useState<StageEvent | "new" | null>(null)
  const [pending, startTransition] = useTransition()
  const stageName = (id: string | null) => stages.find((s) => s.id === id)?.name

  function remove(ev: StageEvent) {
    if (!confirm("Xoá sự kiện này?")) return
    startTransition(async () => {
      const res = await deleteEvent(ev.id, appId)
      if (!res.ok) toast.error(res.error)
    })
  }

  return (
    <section className="rounded-xl border bg-card p-4" aria-labelledby="timeline-title">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="timeline-title" className="font-semibold">
          Timeline
        </h2>
        <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
          <Plus /> Thêm sự kiện
        </Button>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có sự kiện.</p>
      ) : (
        <ol className="relative space-y-4 border-l pl-5" data-testid="timeline">
          {events.map((ev) => {
            const type = ev.type as EventInput["type"]
            const Icon = TYPE_ICON[type] ?? MessageSquareText
            return (
              <li key={ev.id} className="group relative">
                <span className="absolute top-0.5 -left-[31px] flex size-5 items-center justify-center rounded-full border bg-background">
                  <Icon className="size-3" />
                </span>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">
                      {type === "stage_change" ? `→ ${stageName(ev.stage_id) ?? "Vòng đã xoá"}` : TYPE_LABEL[type]}
                      {type !== "stage_change" && ev.stage_id && (
                        <span className="font-normal text-muted-foreground"> · {stageName(ev.stage_id)}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(ev.event_date)}
                      {ev.interviewer && ` · ${ev.interviewer}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                    <Button size="icon-xs" variant="ghost" aria-label="Sửa sự kiện" onClick={() => setEditing(ev)}>
                      <Pencil />
                    </Button>
                    <Button size="icon-xs" variant="ghost" aria-label="Xoá sự kiện" disabled={pending} onClick={() => remove(ev)}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                {ev.notes && <p className="mt-1 text-sm whitespace-pre-wrap">{ev.notes}</p>}
                {ev.questions && (
                  <div className="mt-2 rounded-lg bg-muted/50 p-2 text-sm">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Câu hỏi đã gặp</p>
                    <p className="whitespace-pre-wrap">{ev.questions}</p>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <ResponsiveDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === "new" ? "Thêm sự kiện" : "Sửa sự kiện"}
      >
        {editing !== null && (
          <EventForm
            appId={appId}
            stages={stages}
            event={editing === "new" ? undefined : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </ResponsiveDialog>
    </section>
  )
}

function EventForm({ appId, stages, event, onDone }: { appId: string; stages: Stage[]; event?: StageEvent; onDone: () => void }) {
  const [v, setV] = useState<EventInput>(
    event
      ? {
          type: event.type as EventInput["type"],
          stage_id: event.stage_id,
          event_date: event.event_date,
          interviewer: event.interviewer,
          notes: event.notes,
          questions: event.questions,
        }
      : { type: "interview", stage_id: null, event_date: todayStr(), interviewer: null, notes: null, questions: null },
  )
  const [pending, startTransition] = useTransition()
  const set = <K extends keyof EventInput>(k: K, val: EventInput[K]) => setV((p) => ({ ...p, [k]: val }))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = event ? await updateEvent(event.id, appId, v) : await addEvent(appId, v)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      onDone()
    })
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="ev-type">Loại</Label>
            <NativeSelect id="ev-type" value={v.type} onChange={(e) => set("type", e.target.value as EventInput["type"])} disabled={!!event && event.type === "stage_change"}>
              <option value="interview">Phỏng vấn</option>
              <option value="note">Ghi chú</option>
              {event?.type === "stage_change" && <option value="stage_change">Chuyển vòng</option>}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-stage">Vòng</Label>
            <NativeSelect id="ev-stage" value={v.stage_id ?? ""} onChange={(e) => set("stage_id", e.target.value || null)}>
              <option value="">—</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-date">Ngày</Label>
            <Input id="ev-date" type="date" required value={v.event_date} onChange={(e) => set("event_date", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-interviewer">Người phỏng vấn</Label>
          <Input id="ev-interviewer" value={v.interviewer ?? ""} onChange={(e) => set("interviewer", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-notes">Ghi chú</Label>
          <Textarea id="ev-notes" rows={4} value={v.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-questions">Câu hỏi đã gặp</Label>
          <Textarea id="ev-questions" rows={4} placeholder="Mỗi câu một dòng" value={v.questions ?? ""} onChange={(e) => set("questions", e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2 border-t bg-muted/40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end">
        <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={onDone}>
          Huỷ
        </Button>
        <Button type="submit" className="flex-1 sm:flex-none" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Lưu
        </Button>
      </div>
    </form>
  )
}
