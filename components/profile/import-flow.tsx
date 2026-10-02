"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, FileUp, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { startNavigation } from "@/components/nav/top-progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { describeChainResult, runAiTask } from "@/lib/ai/browser"
import { MAX_CV_BYTES, cvTypeOf } from "@/lib/cv/file-type"
import { commitImport } from "@/lib/data/profile-actions"
import type { CvVersion, PublicSettings } from "@/lib/data/types"
import { planImport, type ImportAction, type ImportRow } from "@/lib/profile/dedupe"
import { normalizeParsed } from "@/lib/profile/normalize"
import { BASICS_FIELDS, itemDates, itemSubtitle, itemTitle, SECTIONS, type Basics, type ProfileItem } from "@/lib/profile/schema"
import { cn } from "@/lib/utils"

const BASICS_LABEL: Record<(typeof BASICS_FIELDS)[number], string> = {
  full_name: "Họ tên",
  headline: "Tiêu đề",
  email: "Email",
  phone: "Điện thoại",
  location: "Địa chỉ",
  summary: "Giới thiệu",
}

type BasicsRow = { key: (typeof BASICS_FIELDS)[number]; current: string; incoming: string; take: boolean }

export function ImportFlow({
  basics,
  items,
  cvs,
  settings,
}: {
  basics: Basics
  items: ProfileItem[]
  cvs: CvVersion[]
  settings: PublicSettings
}) {
  const [source, setSource] = useState<"file" | "cv" | "paste">(cvs.length ? "cv" : "file")
  const [cvId, setCvId] = useState(cvs.find((c) => c.is_default)?.id ?? cvs[0]?.id ?? "")
  const [text, setText] = useState("")
  const [fileName, setFileName] = useState<string | null>(null)
  const [busy, setBusy] = useState<"reading" | "ai" | null>(null)
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [basicsRows, setBasicsRows] = useState<BasicsRow[]>([])
  const [newLinks, setNewLinks] = useState<Basics["links"]>([])
  const [dropped, setDropped] = useState(0)
  const [pending, startTransition] = useTransition()
  const fileInput = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const cvText = source === "cv" ? (cvs.find((c) => c.id === cvId)?.extracted_text ?? "") : text

  async function onFile(file: File | undefined) {
    if (!file) return
    if (!cvTypeOf(file.name)) return void toast.error("Chỉ hỗ trợ file .pdf hoặc .tex")
    if (file.size > MAX_CV_BYTES) return void toast.error("File quá lớn (tối đa 4MB)")
    setBusy("reading")
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch("/api/cv/extract", { method: "POST", body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setText(data.text)
      setFileName(file.name)
      if (data.tooShort) toast.warning("Rút được rất ít chữ (PDF dạng ảnh?). Hãy dán nội dung CV vào ô bên dưới.")
    } catch (e) {
      toast.error("Không đọc được file", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(null)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  async function analyze() {
    if (!settings.ai_ready) return void toast.error("Chưa cấu hình AI", { description: "Vào Cài đặt → AI để thêm kết nối và model." })
    setBusy("ai")
    try {
      const r = await runAiTask(settings, "parse_cv", { cvText })
      const parsed = normalizeParsed(r.data)
      if (!parsed.items.length) throw new Error("AI không tách được mục nào từ CV này. Thử model khác hoặc kiểm tra nội dung text.")
      setRows(planImport(items.map((i) => ({ id: i.id, section: i.section, data: i.data })), parsed.items))
      setDropped(parsed.dropped)
      setBasicsRows(
        BASICS_FIELDS.flatMap((key) => {
          const incoming = (parsed.basics[key] ?? "").trim()
          const current = (basics[key] ?? "").trim()
          if (!incoming || incoming === current) return []
          return [{ key, current, incoming, take: !current }]
        }),
      )
      const have = new Set(basics.links.map((l) => l.url.replace(/\/+$/, "").toLowerCase()))
      setNewLinks(parsed.basics.links.filter((l) => !have.has(l.url.replace(/\/+$/, "").toLowerCase())))
      const fb = describeChainResult(r)
      if (fb) toast.info(fb)
    } catch (e) {
      toast.error("Không phân tích được CV", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(null)
    }
  }

  const counts = useMemo(() => {
    const c = { add: 0, merge: 0, overwrite: 0, skip: 0 }
    for (const r of rows ?? []) c[r.action]++
    return c
  }, [rows])

  const setAction = (key: string, action: ImportAction) => setRows((rs) => rs!.map((r) => (r.key === key ? { ...r, action } : r)))

  function commit() {
    const basicsPatch: Partial<Basics> = {}
    for (const b of basicsRows) if (b.take) basicsPatch[b.key] = b.incoming
    if (newLinks.length) basicsPatch.links = [...basics.links, ...newLinks]
    startTransition(async () => {
      const res = await commitImport({
        basics: basicsPatch,
        rows: rows!.filter((r) => r.action !== "skip").map((r) => ({ section: r.section, data: r.data, action: r.action, matchId: r.match?.id ?? null })),
      })
      if (!res.ok) return void toast.error(res.error)
      toast.success(`Đã nhập: thêm ${res.data.added}, cập nhật ${res.data.updated} mục`)
      startNavigation()
      router.push("/profile")
    })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/profile" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Hồ sơ
      </Link>
      <h1 className="text-xl font-semibold sm:text-2xl">Nhập từ CV</h1>

      {!rows ? (
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <div className="grid grid-cols-3 rounded-lg border p-0.5 text-sm" role="tablist" aria-label="Nguồn CV">
            {(
              [
                ["cv", "Bản CV đã lưu"],
                ["file", "Upload file"],
                ["paste", "Dán text"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={source === k}
                disabled={k === "cv" && !cvs.length}
                onClick={() => setSource(k)}
                className={cn("h-8 rounded-md text-muted-foreground disabled:opacity-40", source === k && "bg-muted font-medium text-foreground")}
              >
                {label}
              </button>
            ))}
          </div>

          {source === "cv" && (
            <NativeSelect aria-label="Chọn bản CV" value={cvId} onChange={(e) => setCvId(e.target.value)}>
              {cvs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.extracted_text.length.toLocaleString("vi-VN")} ký tự)
                </option>
              ))}
            </NativeSelect>
          )}
          {source === "file" && (
            <div className="space-y-2">
              <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={busy === "reading"}>
                {busy === "reading" ? <Loader2 className="animate-spin" /> : <FileUp />} Chọn file .pdf / .tex
              </Button>
              <input ref={fileInput} type="file" accept=".pdf,.tex,application/pdf" className="hidden" data-testid="import-file" onChange={(e) => onFile(e.target.files?.[0])} />
              {fileName && <p className="text-sm text-muted-foreground">Đã đọc {fileName}. Có thể sửa text bên dưới trước khi phân tích.</p>}
            </div>
          )}
          {(source === "paste" || (source === "file" && text)) && (
            <Textarea aria-label="Nội dung CV" rows={10} className="font-mono text-xs" placeholder="Dán toàn bộ nội dung CV" value={text} onChange={(e) => setText(e.target.value)} />
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={analyze} disabled={busy !== null || cvText.trim().length < 200}>
              {busy === "ai" ? <Loader2 className="animate-spin" /> : <Sparkles />} {busy === "ai" ? "AI đang đọc CV…" : "Phân tích bằng AI"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {cvText.trim().length < 200 ? "Cần ít nhất 200 ký tự nội dung CV" : "Model miễn phí có thể mất 1–2 phút"}
            </span>
          </div>
        </section>
      ) : (
        <>
          <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
            <p className="flex-1 text-sm">
              Thêm <b>{counts.add}</b> · Gộp <b>{counts.merge}</b> · Ghi đè <b>{counts.overwrite}</b> · Bỏ qua <b>{counts.skip}</b>
            </p>
            <Button variant="outline" onClick={() => setRows(null)} disabled={pending}>
              Làm lại
            </Button>
            <Button onClick={commit} disabled={pending || counts.add + counts.merge + counts.overwrite + basicsRows.filter((b) => b.take).length + newLinks.length === 0}>
              {pending && <Loader2 className="animate-spin" />} Nhập vào hồ sơ
            </Button>
          </div>

          {dropped > 0 && (
            <p className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-2 text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="size-4" /> {dropped} mục AI trả về không đọc được nên đã bị bỏ qua.
            </p>
          )}

          {(basicsRows.length > 0 || newLinks.length > 0) && (
            <section className="space-y-2 rounded-xl border bg-card p-4">
              <h2 className="font-semibold">Thông tin cá nhân</h2>
              {basicsRows.map((b) => (
                <label key={b.key} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={b.take}
                    onChange={(e) => setBasicsRows((rs) => rs.map((x) => (x.key === b.key ? { ...x, take: e.target.checked } : x)))}
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{BASICS_LABEL[b.key]}:</span> <span className="line-clamp-3">{b.incoming}</span>
                    {b.current && <span className="block text-xs text-muted-foreground">Hiện tại: {b.current} (tick để thay)</span>}
                  </span>
                </label>
              ))}
              {newLinks.length > 0 && <p className="text-sm">Thêm link: {newLinks.map((l) => l.label || l.url).join(", ")}</p>}
            </section>
          )}

          {SECTIONS.map(({ key, label }) => {
            const list = rows.filter((r) => r.section === key)
            if (!list.length) return null
            return (
              <section key={key} className="space-y-2" data-testid={`import-${key}`}>
                <h2 className="font-semibold">
                  {label} <span className="text-sm font-normal text-muted-foreground">({list.length})</span>
                </h2>
                {list.map((r) => {
                  const bullets = Array.isArray(r.data.bullets) ? (r.data.bullets as { id: string; text: string }[]) : []
                  return (
                    <article
                      key={r.key}
                      className={cn("space-y-2 rounded-xl border bg-card p-3 text-sm", r.action === "skip" && "opacity-60")}
                      data-testid="import-row"
                    >
                      <div className="flex flex-wrap items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{itemTitle(r.section, r.data)}</p>
                          <p className="text-muted-foreground">{[itemSubtitle(r.section, r.data), itemDates(r.data)].filter(Boolean).join(" · ")}</p>
                        </div>
                        {r.match ? (
                          <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">
                            Trùng với “{itemTitle(r.match.section, r.match.data)}”
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-600 text-white">Mới</Badge>
                        )}
                      </div>
                      {bullets.length > 0 && !r.match && (
                        <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                          {bullets.slice(0, 4).map((b) => (
                            <li key={b.id}>{b.text}</li>
                          ))}
                          {bullets.length > 4 && <li>…và {bullets.length - 4} bullet nữa</li>}
                        </ul>
                      )}
                      {r.match && (
                        <>
                          {r.newBits.length ? (
                            <div className="rounded-md bg-emerald-500/10 p-2">
                              <p className="mb-1 text-xs font-medium text-emerald-800 dark:text-emerald-200">Gộp sẽ thêm:</p>
                              <ul className="list-disc space-y-0.5 pl-5">
                                {r.newBits.map((t) => (
                                  <li key={t}>{t}</li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Không có gì mới so với mục đã có.</p>
                          )}
                          <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={`Xử lý mục ${itemTitle(r.section, r.data)}`}>
                            {(
                              [
                                ["skip", "Bỏ qua"],
                                ["merge", "Gộp"],
                                ["overwrite", "Ghi đè"],
                              ] as const
                            ).map(([a, l]) => (
                              <label key={a} className="flex items-center gap-1.5">
                                <input type="radio" name={r.key} checked={r.action === a} onChange={() => setAction(r.key, a)} /> {l}
                              </label>
                            ))}
                          </div>
                        </>
                      )}
                      {!r.match && (
                        <label className="flex items-center gap-1.5">
                          <input type="checkbox" checked={r.action === "add"} onChange={(e) => setAction(r.key, e.target.checked ? "add" : "skip")} /> Thêm vào hồ sơ
                        </label>
                      )}
                    </article>
                  )
                })}
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}
