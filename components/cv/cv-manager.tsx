"use client"

import { useRef, useState, useTransition } from "react"
import { Download, FileText, Loader2, Pencil, Star, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { ResponsiveDialog } from "@/components/responsive-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { MAX_CV_BYTES, cvTypeOf, type CvFileType } from "@/lib/cv/file-type"
import { createCv, deleteCv, setDefaultCv, updateCv } from "@/lib/data/actions"
import type { CvVersion } from "@/lib/data/types"
import { formatDate } from "@/lib/format"
import { createClient } from "@/lib/supabase/client"

type Draft = { name: string; text: string; file: File | null; type: CvFileType | null; isDefault: boolean; tooShort: boolean }

export function CvManager({ cvs, usage, workspaceId }: { cvs: CvVersion[]; usage: Record<string, number>; workspaceId: string }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editing, setEditing] = useState<CvVersion | null>(null)
  const [reading, setReading] = useState(false)
  const [pending, startTransition] = useTransition()
  const fileInput = useRef<HTMLInputElement>(null)

  async function onFile(file: File | undefined) {
    if (!file) return
    const type = cvTypeOf(file.name)
    if (!type) return toast.error("Chỉ hỗ trợ file .pdf hoặc .tex")
    if (file.size > MAX_CV_BYTES) return toast.error("File quá lớn (tối đa 4MB)")
    setReading(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch("/api/cv/extract", { method: "POST", body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDraft({
        name: file.name.replace(/\.(pdf|tex)$/i, ""),
        text: data.text,
        file,
        type,
        isDefault: cvs.length === 0,
        tooShort: data.tooShort,
      })
    } catch (e) {
      toast.error("Không đọc được file", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setReading(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  function saveDraft() {
    if (!draft) return
    startTransition(async () => {
      let filePath: string | null = null
      if (draft.file && draft.type) {
        const supabase = createClient()
        filePath = `${workspaceId}/${crypto.randomUUID()}.${draft.type}`
        const { error } = await supabase.storage.from("cvs").upload(filePath, draft.file, {
          contentType: draft.type === "pdf" ? "application/pdf" : "text/plain",
        })
        if (error) return void toast.error("Upload file thất bại", { description: error.message })
      }
      const res = await createCv({
        name: draft.name,
        extracted_text: draft.text,
        file_path: filePath,
        file_type: draft.type,
        is_default: draft.isDefault,
      })
      if (!res.ok) {
        if (filePath) await createClient().storage.from("cvs").remove([filePath])
        return void toast.error(res.error)
      }
      toast.success("Đã lưu bản CV")
      setDraft(null)
    })
  }

  async function download(cv: CvVersion) {
    if (!cv.file_path) return
    const { data, error } = await createClient().storage.from("cvs").createSignedUrl(cv.file_path, 60, {
      download: `${cv.name}.${cv.file_type}`,
    })
    if (error) return toast.error(error.message)
    window.location.href = data.signedUrl
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const res = await fn()
      if (res.ok) toast.success(success)
      else toast.error(res.error)
    })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Các phiên bản CV</h1>
          <p className="text-sm text-muted-foreground">Upload file .pdf hoặc .tex — AI dùng phần text để so với JD.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setDraft({ name: "", text: "", file: null, type: null, isDefault: cvs.length === 0, tooShort: false })}
          >
            <Pencil /> Dán text
          </Button>
          <Button onClick={() => fileInput.current?.click()} disabled={reading}>
            {reading ? <Loader2 className="animate-spin" /> : <Upload />} Upload CV
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.tex,application/pdf"
            className="hidden"
            data-testid="cv-file"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
      </div>

      {cvs.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Chưa có bản CV nào. Upload file CV (PDF xuất từ LaTeX hoặc file .tex).
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {cvs.map((cv) => (
            <li key={cv.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    <span className="truncate">{cv.name}</span>
                    {cv.is_default && <Badge>Mặc định</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(cv.created_at)} · {cv.file_type ? cv.file_type.toUpperCase() : "Text"} · dùng cho {usage[cv.id] ?? 0} đơn ·{" "}
                    {cv.extracted_text.length.toLocaleString("vi-VN")} ký tự
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => setEditing(cv)}>
                  <Pencil /> Xem / sửa text
                </Button>
                {!cv.is_default && (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setDefaultCv(cv.id), "Đã đặt làm mặc định")}>
                    <Star /> Đặt mặc định
                  </Button>
                )}
                {cv.file_path && (
                  <Button size="sm" variant="ghost" onClick={() => download(cv)}>
                    <Download /> Tải file
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={pending}
                  onClick={() => {
                    if (usage[cv.id]) {
                      toast.error(`Bản CV đang được ${usage[cv.id]} đơn sử dụng`, { description: "Đổi tên thay vì xoá, hoặc đổi bản CV của các đơn đó trước." })
                      return
                    }
                    if (confirm(`Xoá bản CV “${cv.name}”?`)) run(() => deleteCv(cv.id), "Đã xoá bản CV")
                  }}
                >
                  <Trash2 /> Xoá
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ResponsiveDialog
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        title="Lưu bản CV mới"
        description="Kiểm tra phần text đã rút ra — đây là nội dung AI sẽ đọc."
      >
        {draft && (
          <CvForm
            name={draft.name}
            text={draft.text}
            warning={draft.file && draft.tooShort ? "Rút được rất ít chữ (có thể PDF là ảnh scan). Hãy dán nội dung CV vào ô bên dưới." : undefined}
            isDefault={draft.isDefault}
            onChange={(p) => setDraft((d) => (d ? { ...d, ...p } : d))}
            onCancel={() => setDraft(null)}
            onSave={saveDraft}
            pending={pending}
          />
        )}
      </ResponsiveDialog>

      <ResponsiveDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title="Sửa bản CV">
        {editing && (
          <EditCv
            cv={editing}
            pending={pending}
            onCancel={() => setEditing(null)}
            onSave={(name, text) =>
              startTransition(async () => {
                const res = await updateCv(editing.id, { name, extracted_text: text })
                if (!res.ok) return void toast.error(res.error)
                toast.success("Đã lưu")
                setEditing(null)
              })
            }
          />
        )}
      </ResponsiveDialog>
    </div>
  )
}

function EditCv({ cv, pending, onCancel, onSave }: { cv: CvVersion; pending: boolean; onCancel: () => void; onSave: (name: string, text: string) => void }) {
  const [name, setName] = useState(cv.name)
  const [text, setText] = useState(cv.extracted_text)
  return (
    <CvForm
      name={name}
      text={text}
      onChange={(p) => {
        if (p.name !== undefined) setName(p.name)
        if (p.text !== undefined) setText(p.text)
      }}
      onCancel={onCancel}
      onSave={() => onSave(name, text)}
      pending={pending}
    />
  )
}

function CvForm({
  name,
  text,
  warning,
  isDefault,
  onChange,
  onCancel,
  onSave,
  pending,
}: {
  name: string
  text: string
  warning?: string
  isDefault?: boolean
  onChange: (p: Partial<{ name: string; text: string; isDefault: boolean }>) => void
  onCancel: () => void
  onSave: () => void
  pending: boolean
}) {
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        onSave()
      }}
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <div className="space-y-1.5">
          <Label htmlFor="cv-name">Tên bản CV *</Label>
          <Input id="cv-name" required placeholder="vd: AI Engineer v3" value={name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        {warning && <p className="rounded-lg bg-amber-500/10 p-2 text-sm text-amber-800 dark:text-amber-200">{warning}</p>}
        <div className="space-y-1.5">
          <Label htmlFor="cv-text">Nội dung (text)</Label>
          <Textarea id="cv-text" rows={14} className="font-mono text-xs" value={text} onChange={(e) => onChange({ text: e.target.value })} />
        </div>
        {isDefault !== undefined && (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={isDefault} onCheckedChange={(c) => onChange({ isDefault: c })} /> Đặt làm bản mặc định
          </label>
        )}
      </div>
      <div className="flex gap-2 border-t bg-muted/40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end">
        <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={onCancel}>
          Huỷ
        </Button>
        <Button type="submit" className="flex-1 sm:flex-none" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Lưu
        </Button>
      </div>
    </form>
  )
}
