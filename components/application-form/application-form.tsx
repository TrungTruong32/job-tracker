"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { aiExtractJd } from "@/lib/ai/browser"
import type { JdSummary } from "@/lib/ai/parse"
import { createApplication, updateApplication } from "@/lib/data/actions"
import type { Application, ApplicationInput, CvVersion, PublicSettings, Stage } from "@/lib/data/types"
import { todayStr } from "@/lib/format"
import { SOURCE_SUGGESTIONS } from "./sources"

type Props = {
  stages: Stage[]
  cvs: CvVersion[]
  settings: PublicSettings
  application?: Application
  onDone: (id?: string) => void
}

function initial(stages: Stage[], cvs: CvVersion[], app?: Application): ApplicationInput {
  if (app) {
    const { company, position, source, jd_url, jd_text, salary, location, applied_at, stage_id, cv_version_id, next_action, next_action_due, ai_summary } = app
    return { company, position, source, jd_url, jd_text, salary, location, applied_at, stage_id, cv_version_id, next_action, next_action_due, ai_summary }
  }
  return {
    company: "",
    position: "",
    source: null,
    jd_url: null,
    jd_text: null,
    salary: null,
    location: null,
    applied_at: todayStr(),
    stage_id: stages[0]?.id ?? "",
    cv_version_id: cvs.find((c) => c.is_default)?.id ?? null,
    next_action: null,
    next_action_due: null,
    ai_summary: null,
  }
}

export function ApplicationForm({ stages, cvs, settings, application, onDone }: Props) {
  const [v, setV] = useState<ApplicationInput>(() => initial(stages, cvs, application))
  const [aiLoading, setAiLoading] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const set = <K extends keyof ApplicationInput>(k: K, val: ApplicationInput[K]) => setV((p) => ({ ...p, [k]: val }))
  const str = (k: keyof ApplicationInput) => (v[k] as string | null) ?? ""

  async function runAi() {
    if (!settings.ai_ready && settings.ai_provider !== "ollama") {
      toast.error("Chưa cấu hình AI", { description: "Vào Cài đặt để chọn nhà cung cấp và nhập API key.", action: { label: "Mở Cài đặt", onClick: () => router.push("/settings") } })
      return
    }
    const jd = (v.jd_text ?? "").trim()
    if (jd.length < 30) {
      toast.error("Dán nội dung JD trước (ít nhất 30 ký tự)")
      return
    }
    setAiLoading(true)
    try {
      const s: JdSummary = await aiExtractJd(settings, jd)
      setV((p) => ({
        ...p,
        company: p.company || s.company || "",
        position: p.position || s.position || "",
        salary: p.salary || s.salary,
        location: p.location || s.location,
        ai_summary: s,
      }))
      toast.success("AI đã điền thông tin", { description: "Kiểm tra lại trước khi lưu." })
    } catch (e) {
      toast.error("AI không xử lý được", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setAiLoading(false)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = application ? await updateApplication(application.id, v) : await createApplication(v)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(application ? "Đã lưu thay đổi" : "Đã thêm đơn ứng tuyển")
      onDone(res.data && "id" in res.data ? (res.data as { id: string }).id : application?.id)
    })
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <section className="space-y-3 rounded-xl border bg-muted/30 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="jd_url">Link JD</Label>
            <Input id="jd_url" type="url" inputMode="url" placeholder="https://..." value={str("jd_url")} onChange={(e) => set("jd_url", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jd_text">Nội dung JD</Label>
            <Textarea id="jd_text" rows={6} className="max-h-72" placeholder="Dán toàn bộ nội dung tin tuyển dụng vào đây" value={str("jd_text")} onChange={(e) => set("jd_text", e.target.value)} />
          </div>
          <Button type="button" variant="secondary" onClick={runAi} disabled={aiLoading} className="w-full sm:w-auto">
            {aiLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {aiLoading ? "AI đang đọc JD…" : "AI điền giúp"}
          </Button>
          {v.ai_summary?.required_skills.length ? (
            <p className="text-xs text-muted-foreground">
              Skill yêu cầu: {v.ai_summary.required_skills.slice(0, 10).join(", ")}
            </p>
          ) : null}
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="company" label="Công ty *">
            <Input id="company" required value={v.company} onChange={(e) => set("company", e.target.value)} />
          </Field>
          <Field id="position" label="Vị trí *">
            <Input id="position" required value={v.position} onChange={(e) => set("position", e.target.value)} />
          </Field>
          <Field id="source" label="Nguồn">
            <Input id="source" list="source-list" placeholder="LinkedIn, TopCV…" value={str("source")} onChange={(e) => set("source", e.target.value)} />
            <datalist id="source-list">
              {SOURCE_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field id="applied_at" label="Ngày nộp">
            <Input id="applied_at" type="date" required value={v.applied_at} onChange={(e) => set("applied_at", e.target.value)} />
          </Field>
          <Field id="salary" label="Lương">
            <Input id="salary" value={str("salary")} onChange={(e) => set("salary", e.target.value)} />
          </Field>
          <Field id="location" label="Địa điểm">
            <Input id="location" value={str("location")} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field id="stage_id" label="Vòng hiện tại">
            <NativeSelect id="stage_id" value={v.stage_id} onChange={(e) => set("stage_id", e.target.value)}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="cv_version_id" label="Bản CV đã gửi">
            <NativeSelect id="cv_version_id" value={v.cv_version_id ?? ""} onChange={(e) => set("cv_version_id", e.target.value || null)}>
              <option value="">— Không chọn —</option>
              {cvs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.is_default ? " (mặc định)" : ""}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="next_action" label="Việc cần làm tiếp">
            <Input id="next_action" placeholder="vd: Follow-up HR" value={str("next_action")} onChange={(e) => set("next_action", e.target.value)} />
          </Field>
          <Field id="next_action_due" label="Hạn">
            <Input id="next_action_due" type="date" value={str("next_action_due")} onChange={(e) => set("next_action_due", e.target.value || null)} />
          </Field>
        </div>
      </div>
      <div className="flex gap-2 border-t bg-muted/40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end">
        <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => onDone()}>
          Huỷ
        </Button>
        <Button type="submit" className="flex-1 sm:flex-none" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {application ? "Lưu" : "Thêm đơn"}
        </Button>
      </div>
    </form>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
