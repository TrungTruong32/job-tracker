"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { describeChainResult, runAiTask } from "@/lib/ai/browser"
import { saveAiFit, saveAiSummary } from "@/lib/data/actions"
import type { Application, CvVersion, PublicSettings } from "@/lib/data/types"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { scoreClass } from "@/components/board/app-card"

function Chips({ items, tone }: { items: string[]; tone?: "good" | "bad" }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">—</p>
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <li key={s}>
          <Badge
            variant="secondary"
            className={cn(
              "h-auto py-0.5 whitespace-normal",
              tone === "good" && "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
              tone === "bad" && "bg-rose-500/15 text-rose-800 dark:text-rose-200",
            )}
          >
            {s}
          </Badge>
        </li>
      ))}
    </ul>
  )
}

export function AiPanels({ app, cvs, settings }: { app: Application; cvs: CvVersion[]; settings: PublicSettings }) {
  const [loading, setLoading] = useState<"summary" | "fit" | null>(null)
  const aiUsable = settings.ai_ready
  const cv = cvs.find((c) => c.id === app.cv_version_id) ?? cvs.find((c) => c.is_default)
  const jd = app.jd_text?.trim() ?? ""
  const s = app.ai_summary
  const fit = app.ai_fit
  const fitStale = fit && cv && fit.cv_version_id !== cv.id

  async function summarize() {
    setLoading("summary")
    try {
      const r = await runAiTask(settings, "extract", { jdText: jd })
      const res = await saveAiSummary(app.id, r.data)
      if (!res.ok) throw new Error(res.error)
      toast.success("Đã tóm tắt JD", { description: describeChainResult(r) })
    } catch (e) {
      toast.error("AI không tóm tắt được", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(null)
    }
  }

  async function match() {
    if (!cv) return
    setLoading("fit")
    try {
      const r = await runAiTask(settings, "match", { jdText: jd, cvText: cv.extracted_text })
      const res = await saveAiFit(app.id, r.data, cv.id)
      if (!res.ok) throw new Error(res.error)
      toast.success(`Điểm phù hợp: ${res.data.score}%`, { description: describeChainResult(r) })
    } catch (e) {
      toast.error("AI không chấm được", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(null)
    }
  }

  const notReady = !aiUsable && (
    <p className="text-sm text-muted-foreground">
      Chưa cấu hình AI.{" "}
      <Link href="/settings" className="text-primary underline">
        Vào Cài đặt
      </Link>
    </p>
  )

  return (
    <>
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-4 text-primary" /> AI tóm tắt JD
          </h2>
          {aiUsable && jd.length >= 30 && (
            <Button size="sm" variant="ghost" onClick={summarize} disabled={!!loading}>
              {loading === "summary" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {s ? "Tóm tắt lại" : "Tóm tắt"}
            </Button>
          )}
        </div>
        {s ? (
          <div className="space-y-3 text-sm">
            {s.summary && <p className="leading-relaxed">{s.summary}</p>}
            {s.seniority && (
              <p>
                <span className="text-muted-foreground">Cấp bậc:</span> {s.seniority}
              </p>
            )}
            <div className="space-y-1.5">
              <h3 className="text-xs font-medium text-muted-foreground">Skill bắt buộc</h3>
              <Chips items={s.required_skills} />
            </div>
            {s.nice_to_have.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="text-xs font-medium text-muted-foreground">Điểm cộng</h3>
                <Chips items={s.nice_to_have} />
              </div>
            )}
          </div>
        ) : (
          notReady || (
            <p className="text-sm text-muted-foreground">
              {jd.length >= 30 ? "Chưa có tóm tắt." : "Đơn này chưa có nội dung JD. Bấm Sửa để dán JD."}
            </p>
          )
        )}
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4" data-testid="cv-fit">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">So với CV</h2>
          {aiUsable && cv && jd.length >= 30 && (
            <Button size="sm" variant={fit ? "ghost" : "default"} onClick={match} disabled={!!loading}>
              {loading === "fit" ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {fit ? "Chấm lại" : "Chấm điểm"}
            </Button>
          )}
        </div>
        {!cv ? (
          <p className="text-sm text-muted-foreground">
            Chưa có bản CV nào.{" "}
            <Link href="/cv" className="text-primary underline">
              Upload CV
            </Link>
          </p>
        ) : fit ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <span className={cn("rounded-lg px-3 py-1.5 text-2xl font-semibold tabular-nums", scoreClass(fit.score))}>{fit.score}%</span>
              <span className="text-xs text-muted-foreground">
                Chấm với “{cvs.find((c) => c.id === fit.cv_version_id)?.name ?? "bản CV đã xoá"}” · {formatDate(fit.evaluated_at)}
              </span>
            </div>
            {fitStale && (
              <p className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200">
                <AlertTriangle className="size-4 shrink-0" /> Bản CV của đơn đã đổi sang “{cv.name}”. Bấm Chấm lại để cập nhật.
              </p>
            )}
            <div className="space-y-1.5">
              <h3 className="text-xs font-medium text-muted-foreground">Đã đáp ứng</h3>
              <Chips items={fit.matched_skills} tone="good" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xs font-medium text-muted-foreground">Còn thiếu</h3>
              <Chips items={fit.missing_skills} tone="bad" />
            </div>
            {fit.suggestions.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="text-xs font-medium text-muted-foreground">Gợi ý</h3>
                <ul className="list-disc space-y-1 pl-5">
                  {fit.suggestions.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          notReady || (
            <p className="text-sm text-muted-foreground">
              {jd.length >= 30 ? `Chưa chấm. Sẽ so với “${cv.name}”.` : "Cần nội dung JD để so sánh."}
            </p>
          )
        )}
      </section>
    </>
  )
}
