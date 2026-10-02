"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ExternalLink, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ApplicationForm } from "@/components/application-form/application-form"
import { ResponsiveDialog } from "@/components/responsive-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/native-select"
import { deleteApplication, moveApplication } from "@/lib/data/actions"
import type { Application, CvVersion, PublicSettings, Stage, StageEvent } from "@/lib/data/types"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { AiPanels } from "./ai-panels"
import { Timeline } from "./timeline"

type Props = {
  app: Application
  events: StageEvent[]
  stages: Stage[]
  cvs: CvVersion[]
  settings: PublicSettings
}

export function ApplicationDetail({ app, events, stages, cvs, settings }: Props) {
  const [tab, setTab] = useState<"info" | "timeline">("info")
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const cv = cvs.find((c) => c.id === app.cv_version_id)

  function move(stageId: string) {
    startTransition(async () => {
      const res = await moveApplication(app.id, stageId)
      if (res.ok) toast.success(`Đã chuyển sang ${stages.find((s) => s.id === stageId)?.name}`)
      else toast.error(res.error)
    })
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteApplication(app.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Đã xoá đơn")
      router.replace("/")
    })
  }

  const info: [string, React.ReactNode][] = [
    ["Ngày nộp", formatDate(app.applied_at)],
    ["Nguồn", app.source],
    ["Lương", app.salary],
    ["Địa điểm", app.location],
    ["Bản CV", cv?.name],
    ["Việc tiếp", app.next_action ? `${app.next_action}${app.next_action_due ? ` (hạn ${formatDate(app.next_action_due)})` : ""}` : null],
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="space-y-3">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Đơn ứng tuyển
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold sm:text-2xl">{app.company}</h1>
            <p className="text-muted-foreground">{app.position}</p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <NativeSelect
              aria-label="Vòng hiện tại"
              className="flex-1 sm:w-44"
              value={app.stage_id}
              disabled={pending}
              onChange={(e) => move(e.target.value)}
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
            <Button variant="outline" size="lg" onClick={() => setEditing(true)}>
              <Pencil /> <span className="hidden sm:inline">Sửa</span>
            </Button>
            <Button variant="destructive" size="icon-lg" aria-label="Xoá đơn" onClick={() => setConfirmDelete(true)}>
              <Trash2 />
            </Button>
          </div>
        </div>
      </div>

      {/* Phone: tabs */}
      <div className="grid grid-cols-2 rounded-lg border p-0.5 sm:hidden" role="tablist">
        {(
          [
            ["info", "Thông tin"],
            ["timeline", `Timeline (${events.length})`],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            role="tab"
            aria-selected={tab === v}
            onClick={() => setTab(v)}
            className={cn("h-8 rounded-md text-sm text-muted-foreground", tab === v && "bg-muted font-medium text-foreground")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className={cn("space-y-4", tab !== "info" && "max-sm:hidden")}>
          <section className="rounded-xl border bg-card p-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              {info.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="truncate">{v || "—"}</dd>
                </div>
              ))}
            </dl>
            {app.jd_url && (
              <a
                href={app.jd_url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="size-4" /> Mở tin tuyển dụng gốc
              </a>
            )}
          </section>

          <AiPanels app={app} cvs={cvs} settings={settings} />

          {app.jd_text && (
            <details className="group rounded-xl border bg-card">
              <summary className="cursor-pointer list-none p-4 text-sm font-medium marker:hidden">
                Nội dung JD đầy đủ <span className="text-muted-foreground group-open:hidden">(bấm để mở)</span>
              </summary>
              <pre className="max-h-[60vh] overflow-auto border-t p-4 font-sans text-sm whitespace-pre-wrap">{app.jd_text}</pre>
            </details>
          )}
        </div>

        <div className={cn(tab !== "timeline" && "max-sm:hidden")}>
          <Timeline appId={app.id} events={events} stages={stages} />
        </div>
      </div>

      <ResponsiveDialog open={editing} onOpenChange={setEditing} title="Sửa đơn ứng tuyển">
        {editing && (
          <ApplicationForm
            stages={stages}
            cvs={cvs}
            settings={settings}
            application={app}
            onDone={() => setEditing(false)}
          />
        )}
      </ResponsiveDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá đơn {app.company}?</AlertDialogTitle>
            <AlertDialogDescription>Toàn bộ timeline của đơn này cũng bị xoá. Không thể hoàn tác.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove} disabled={pending}>
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
