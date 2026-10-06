"use client"

import { useState } from "react"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ResponsiveDialog } from "@/components/responsive-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { saveEmailTemplate } from "@/lib/data/profile-actions"
import { TEMPLATE_LANG_LABEL, TEMPLATE_LANGS, htmlToBody, type EmailTemplate, type EmailTemplates, type TemplateLang } from "@/lib/email/draft"
import { cn } from "@/lib/utils"

const BLANK: EmailTemplate = { subject: "", body: "" }

/** Edit the user's sample email per language; the AI follows it when drafting. */
export function EmailTemplatesDialog({
  open,
  onOpenChange,
  templates,
  onSaved,
  current,
  initialLang,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: EmailTemplates
  onSaved: (templates: EmailTemplates) => void
  /** the email open in the editor, offered as a starting point */
  current: EmailTemplate | null
  initialLang: TemplateLang
}) {
  const [lang, setLang] = useState<TemplateLang>(initialLang)
  // unsaved edits per language, so switching tabs keeps them
  const [edits, setEdits] = useState<Partial<Record<TemplateLang, EmailTemplate>>>({})
  const [busy, setBusy] = useState(false)
  const value = edits[lang] ?? templates[lang] ?? BLANK
  const dirty = !!edits[lang] && JSON.stringify(edits[lang]) !== JSON.stringify(templates[lang] ?? BLANK)

  const set = (patch: Partial<EmailTemplate>) => setEdits((e) => ({ ...e, [lang]: { ...value, ...patch } }))

  async function save(next: EmailTemplate | null) {
    setBusy(true)
    const res = await saveEmailTemplate(lang, next)
    setBusy(false)
    if (!res.ok) {
      toast.error("Không lưu được mẫu", { description: res.error })
      return
    }
    onSaved(res.data)
    setEdits((e) => ({ ...e, [lang]: undefined }))
    toast.success(next ? `Đã lưu mẫu ${TEMPLATE_LANG_LABEL[lang]}` : `Đã xoá mẫu ${TEMPLATE_LANG_LABEL[lang]}`)
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Mẫu email"
      description="AI giữ bố cục, giọng văn, lời chào, chữ ký và kiểu tiêu đề của mẫu; chỉ thay phần riêng của từng job."
    >
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        <div className="inline-grid grid-cols-2 rounded-lg border p-0.5" role="tablist" aria-label="Ngôn ngữ mẫu">
          {TEMPLATE_LANGS.map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={lang === l}
              onClick={() => setLang(l)}
              className={cn("h-7 rounded-md px-3 text-xs text-muted-foreground", lang === l && "bg-muted font-medium text-foreground")}
            >
              {TEMPLATE_LANG_LABEL[l]}
              {templates[l] ? " ✓" : ""}
              {edits[l] ? " •" : ""}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <label htmlFor="tpl-subject" className="text-xs font-medium text-muted-foreground">
            Tiêu đề mẫu
          </label>
          <Input
            id="tpl-subject"
            value={value.subject}
            placeholder={lang === "vi" ? "[Ứng tuyển] {Vị trí} - {Họ tên}" : "Application for {Position} - {Full name}"}
            onChange={(e) => set({ subject: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="tpl-body" className="text-xs font-medium text-muted-foreground">
              Nội dung mẫu
            </label>
            {current?.body.trim() && (
              <Button type="button" size="xs" variant="ghost" onClick={() => set({ subject: current.subject, body: current.body })}>
                Lấy từ email đang mở
              </Button>
            )}
          </div>
          <Textarea
            id="tpl-body"
            value={value.body}
            rows={14}
            className="min-h-64 leading-relaxed"
            placeholder={
              lang === "vi"
                ? "Kính gửi anh/chị {người tuyển dụng},\n\nEm là …, em xin ứng tuyển vị trí **{Vị trí}** tại {Công ty}.\n\n…\n\nTrân trọng,\n{Họ tên}"
                : "Dear {Hiring manager},\n\nI am writing to apply for the **{Position}** role at {Company}.\n\n…\n\nBest regards,\n{Full name}"
            }
            onChange={(e) => set({ body: e.target.value })}
            onPaste={(e) => {
              const html = e.clipboardData.getData("text/html")
              const md = html ? htmlToBody(html) : ""
              if (!md) return
              e.preventDefault()
              const el = e.currentTarget
              set({ body: el.value.slice(0, el.selectionStart) + md + el.value.slice(el.selectionEnd) })
            }}
          />
          <p className="text-xs text-muted-foreground">
            Viết như một email thật bạn hay gửi. Chỗ thay đổi theo job có thể để {"{Vị trí}"}, {"{Công ty}"}… **chữ** = in đậm. Dán từ Gmail vẫn giữ chữ đậm.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t px-4 py-3">
        {templates[lang] && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={busy} onClick={() => save(null)}>
            <Trash2 /> Xoá mẫu
          </Button>
        )}
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => onOpenChange(false)}>
          Đóng
        </Button>
        <Button size="sm" disabled={busy || !dirty || !value.body.trim()} onClick={() => save(value)}>
          {busy && <Loader2 className="animate-spin" />} Lưu mẫu {TEMPLATE_LANG_LABEL[lang]}
        </Button>
      </div>
    </ResponsiveDialog>
  )
}
