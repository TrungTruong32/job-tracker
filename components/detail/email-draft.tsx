"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bold, Check, Copy, ExternalLink, Eye, Loader2, Mail, PenLine, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { describeChainResult, runAiTask } from "@/lib/ai/browser"
import { saveEmailDraft } from "@/lib/data/actions"
import type { Application, CvVersion, PublicSettings } from "@/lib/data/types"
import { bodyToHtml, bodyToText, findEmails, gmailComposeUrl, htmlToBody, keepKnownEmails, type EmailDraft } from "@/lib/email/draft"
import { formatDate } from "@/lib/format"
import type { Basics } from "@/lib/profile/schema"
import { useStoredChoice } from "@/lib/use-stored-choice"
import { cn } from "@/lib/utils"

type Draft = Omit<EmailDraft, "updated_at">
type Lang = "auto" | "vi" | "en"

const snap = (d: Draft | EmailDraft | null) => (d ? JSON.stringify({ ...d, updated_at: undefined }) : "null")

const EMPTY: Draft = { to: "", subject: "", body: "", subject_from_jd: false, generated_at: null, edited: false }

/** Copy rich HTML (what Gmail keeps on paste) plus a plain-text fallback. */
async function copyRich(html: string, text: string) {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ])
      return
    } catch {
      // fall through to the copy-event path (older Firefox, denied permission)
    }
  }
  const onCopy = (e: ClipboardEvent) => {
    e.clipboardData?.setData("text/html", html)
    e.clipboardData?.setData("text/plain", text)
    e.preventDefault()
  }
  document.addEventListener("copy", onCopy)
  try {
    if (!document.execCommand("copy")) throw new Error("Trình duyệt không cho copy")
  } finally {
    document.removeEventListener("copy", onCopy)
  }
}

function CopyButton({ label, onCopy, disabled }: { label: string; onCopy: () => Promise<void>; disabled?: boolean }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={async () => {
        try {
          await onCopy()
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch (e) {
          toast.error("Không copy được", { description: e instanceof Error ? e.message : String(e) })
        }
      }}
    >
      {done ? <Check className="text-emerald-600" /> : <Copy />}
    </Button>
  )
}

export function EmailDraftPanel({
  app,
  cvs,
  settings,
  initial,
  sender,
}: {
  app: Application
  cvs: CvVersion[]
  settings: PublicSettings
  initial: EmailDraft | null
  sender: Basics
}) {
  const [draft, setDraft] = useState<Draft | null>(initial)
  const [savedAt, setSavedAt] = useState<string | null>(initial?.updated_at ?? null)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [preview, setPreview] = useState(false)
  const [lang, setLang] = useStoredChoice<Lang>("jt-email-lang", ["auto", "vi", "en"], "auto")
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  // what the server has, so autosave only fires on real changes
  const persisted = useRef<string>(snap(initial))
  // saves run one after another, so a slow one can't land after a newer one (or after a delete)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const latest = useRef<Draft | null>(initial)
  useEffect(() => {
    latest.current = draft
  }, [draft])

  const cv = cvs.find((c) => c.id === app.cv_version_id) ?? cvs.find((c) => c.is_default)
  const jd = app.jd_text?.trim() ?? ""
  const jdEmails = findEmails(app.jd_text ?? "")
  const canGenerate = settings.ai_ready && jd.length >= 30 && !!cv

  const persist = useCallback(
    (d: Draft | null) =>
      (queue.current = queue.current.then(async () => {
        const snapshot = snap(d)
        if (snapshot === persisted.current) return
        setSaving(true)
        const res = await saveEmailDraft(app.id, d)
        setSaving(false)
        if (!res.ok) {
          toast.error("Không lưu được email", { description: res.error })
          return
        }
        persisted.current = snapshot
        setSavedAt(res.data?.updated_at ?? null)
      })),
    [app.id],
  )

  // autosave (debounced); the editor keeps its own state, the page is not re-rendered
  useEffect(() => {
    if (!draft || snap(draft) === persisted.current) return
    const t = setTimeout(() => persist(draft), 800)
    return () => clearTimeout(t)
  }, [draft, persist])

  // don't lose the last keystrokes when leaving the page within the debounce window
  useEffect(() => {
    const flush = () => {
      if (latest.current && snap(latest.current) !== persisted.current) persist(latest.current)
    }
    window.addEventListener("pagehide", flush)
    return () => {
      window.removeEventListener("pagehide", flush)
      flush()
    }
  }, [persist])

  function edit(patch: Partial<Draft>) {
    setDraft((d) => ({ ...(d ?? EMPTY), ...patch, edited: (d ?? EMPTY).generated_at ? true : false }))
  }

  async function generate() {
    if (!cv) return
    setConfirmRegen(false)
    setGenerating(true)
    try {
      const r = await runAiTask(settings, "write_email", {
        jdText: jd,
        cvText: cv.extracted_text,
        company: app.company,
        position: app.position,
        sender: { full_name: sender.full_name, email: sender.email, phone: sender.phone, links: sender.links.slice(0, 10) },
        jdEmails,
        language: lang,
      })
      const to = keepKnownEmails(r.data.to, jdEmails) || (jdEmails.length === 1 ? jdEmails[0] : "")
      setDraft({
        to,
        subject: r.data.subject,
        body: r.data.body,
        subject_from_jd: r.data.subject_from_jd,
        generated_at: new Date().toISOString(),
        edited: false,
      })
      setPreview(true)
      toast.success("Đã viết email", { description: describeChainResult(r) })
    } catch (e) {
      toast.error("AI không viết được email", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setGenerating(false)
    }
  }

  function remove() {
    setConfirmDelete(false)
    const previous = draft
    // clearing the editor cancels the pending autosave; the delete queues behind any save in flight
    latest.current = null
    setDraft(null)
    persist(null).then(() => {
      if (persisted.current !== snap(null)) setDraft(previous)
      else setSavedAt(null)
    })
  }

  /** Wrap the selection in **…** (or unwrap it). */
  function toggleBold() {
    const el = bodyRef.current
    if (!el || !draft) return
    const { selectionStart: a, selectionEnd: b, value } = el
    const before = value.slice(0, a)
    const sel = value.slice(a, b)
    const after = value.slice(b)
    let next: string
    let start: number
    let end: number
    if (before.endsWith("**") && after.startsWith("**")) {
      next = before.slice(0, -2) + sel + after.slice(2)
      start = a - 2
      end = b - 2
    } else if (/^\*\*[\s\S]*\*\*$/.test(sel) && sel.length >= 4) {
      next = before + sel.slice(2, -2) + after
      start = a
      end = b - 4
    } else {
      next = before + `**${sel}**` + after
      start = a + 2
      end = b + 2
    }
    edit({ body: next })
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start, end)
    })
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const html = e.clipboardData.getData("text/html")
    if (!html) return
    const md = htmlToBody(html)
    if (!md) return
    e.preventDefault()
    const el = e.currentTarget
    const { selectionStart: a, selectionEnd: b, value } = el
    edit({ body: value.slice(0, a) + md + value.slice(b) })
    requestAnimationFrame(() => el.setSelectionRange(a + md.length, a + md.length))
  }

  const copyBody = () => (draft ? copyRich(bodyToHtml(draft.body), bodyToText(draft.body)) : Promise.resolve())
  const copyPlain = (s: string) => navigator.clipboard.writeText(s)

  async function openGmail() {
    if (!draft) return
    // copy while this tab still has focus (the clipboard refuses a background tab), then open
    try {
      await copyBody()
      toast.success("Đã copy nội dung email", { description: "Bấm vào ô nội dung trong Gmail rồi dán (Ctrl+V / ⌘V)." })
    } catch (e) {
      toast.error("Không copy được nội dung", { description: e instanceof Error ? e.message : String(e) })
    }
    window.open(gmailComposeUrl(draft), "_blank", "noopener,noreferrer")
  }

  const missingTo = draft ? jdEmails.filter((e) => !findEmails(draft.to).includes(e)) : []

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4" data-testid="email-draft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Mail className="size-4 text-primary" /> Email ứng tuyển
        </h2>
        <div className="flex items-center gap-2">
          {canGenerate && (
            <NativeSelect aria-label="Ngôn ngữ email" className="h-8 w-32" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
              <option value="auto">Theo JD</option>
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </NativeSelect>
          )}
          {canGenerate && (
            <Button
              size="sm"
              variant={draft ? "ghost" : "default"}
              disabled={generating}
              onClick={() => (draft?.edited || (draft && !draft.generated_at && draft.body.trim()) ? setConfirmRegen(true) : generate())}
            >
              {generating ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {draft ? "Viết lại" : "Viết bằng AI"}
            </Button>
          )}
        </div>
      </div>

      {!draft ? (
        <div className="space-y-2 text-sm text-muted-foreground">
          {!settings.ai_ready ? (
            <p>
              Chưa cấu hình AI.{" "}
              <Link href="/settings" className="text-primary underline">
                Vào Cài đặt
              </Link>{" "}
              hoặc tự viết email.
            </p>
          ) : jd.length < 30 ? (
            <p>Cần nội dung JD để AI viết email. Bấm Sửa để dán JD, hoặc tự viết email.</p>
          ) : !cv ? (
            <p>
              Chưa có bản CV nào để AI dựa vào.{" "}
              <Link href="/cv" className="text-primary underline">
                Upload CV
              </Link>
            </p>
          ) : (
            <p>
              AI viết email dựa trên JD và “{cv.name}”: người nhận, tiêu đề (theo format JD nếu có), nội dung tô đậm ý chính.
            </p>
          )}
          <Button size="sm" variant="outline" onClick={() => setDraft({ ...EMPTY, to: jdEmails.length === 1 ? jdEmails[0] : "" })}>
            <PenLine /> Tự viết / dán email
          </Button>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <label htmlFor="email-to" className="text-xs font-medium text-muted-foreground">
              Người nhận
            </label>
            <div className="flex items-center gap-1">
              <Input id="email-to" value={draft.to} placeholder="hr@congty.com" onChange={(e) => edit({ to: e.target.value })} />
              <CopyButton label="Copy người nhận" disabled={!draft.to.trim()} onCopy={() => copyPlain(draft.to.trim())} />
            </div>
            {missingTo.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                Email trong JD:
                {missingTo.map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="rounded-md border px-1.5 py-0.5 hover:bg-muted"
                    onClick={() => edit({ to: [draft.to.trim(), e].filter(Boolean).join(", ") })}
                  >
                    + {e}
                  </button>
                ))}
              </div>
            )}
            {!draft.to.trim() && jdEmails.length === 0 && <p className="text-xs text-muted-foreground">JD không ghi email nhận hồ sơ.</p>}
          </div>

          <div className="space-y-1">
            <label htmlFor="email-subject" className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              Tiêu đề
              {draft.subject_from_jd && (
                <Badge variant="secondary" className="h-auto py-0 text-[11px]">
                  theo format JD
                </Badge>
              )}
            </label>
            <div className="flex items-center gap-1">
              <Input id="email-subject" value={draft.subject} onChange={(e) => edit({ subject: e.target.value })} />
              <CopyButton label="Copy tiêu đề" disabled={!draft.subject.trim()} onCopy={() => copyPlain(draft.subject.trim())} />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Nội dung</span>
              <div className="flex items-center gap-1">
                {!preview && (
                  <Button type="button" size="xs" variant="ghost" onMouseDown={(e) => e.preventDefault()} onClick={toggleBold} title="In đậm (Ctrl+B)">
                    <Bold /> Đậm
                  </Button>
                )}
                <div className="grid grid-cols-2 rounded-lg border p-0.5" role="tablist">
                  {(
                    [
                      [false, "Soạn", PenLine],
                      [true, "Xem trước", Eye],
                    ] as const
                  ).map(([v, label, Icon]) => (
                    <button
                      key={label}
                      type="button"
                      role="tab"
                      aria-selected={preview === v}
                      onClick={() => setPreview(v)}
                      className={cn(
                        "inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground",
                        preview === v && "bg-muted font-medium text-foreground",
                      )}
                    >
                      <Icon className="size-3" /> {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {preview ? (
              <div
                className="email-preview min-h-40 rounded-lg border bg-background p-3 leading-relaxed [&_a]:text-primary [&_a]:underline [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-6"
                // bodyToHtml escapes the text before adding its own tags
                dangerouslySetInnerHTML={{ __html: bodyToHtml(draft.body) || "<div><br></div>" }}
                onDoubleClick={() => setPreview(false)}
              />
            ) : (
              <>
                <Textarea
                  ref={bodyRef}
                  value={draft.body}
                  rows={14}
                  className="min-h-60 font-sans leading-relaxed"
                  placeholder={"Kính gửi anh/chị,\n\nEm xin ứng tuyển vị trí **…**\n\nTrân trọng,"}
                  onChange={(e) => edit({ body: e.target.value })}
                  onPaste={onPaste}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
                      e.preventDefault()
                      toggleBold()
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  **chữ** = in đậm · dòng bắt đầu bằng “- ” = gạch đầu dòng · dòng trống = đoạn mới. Dán từ Gmail/Word vẫn giữ chữ đậm.
                </p>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={!draft.body.trim()}
              onClick={async () => {
                try {
                  await copyBody()
                  toast.success("Đã copy nội dung", { description: "Dán vào Gmail sẽ giữ chữ đậm và gạch đầu dòng." })
                } catch (e) {
                  toast.error("Không copy được", { description: e instanceof Error ? e.message : String(e) })
                }
              }}
            >
              <Copy /> Copy nội dung
            </Button>
            <Button size="sm" variant="outline" disabled={!draft.body.trim()} onClick={openGmail}>
              <ExternalLink /> Mở Gmail
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Xoá
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">
              {saving ? "Đang lưu…" : savedAt ? `Đã lưu · ${formatDate(savedAt)}` : ""}
              {draft.generated_at && !saving && ` · AI viết ${formatDate(draft.generated_at)}${draft.edited ? ", đã sửa" : ""}`}
            </span>
          </div>
        </div>
      )}

      <AlertDialog open={confirmRegen} onOpenChange={setConfirmRegen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Viết lại email?</AlertDialogTitle>
            <AlertDialogDescription>Email hiện tại (có chỉnh sửa của bạn) sẽ bị thay bằng bản AI mới.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={generate}>Viết lại</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá email này?</AlertDialogTitle>
            <AlertDialogDescription>Không thể hoàn tác.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
