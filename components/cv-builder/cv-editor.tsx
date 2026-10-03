"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { ArrowLeft, Check, Download, FileCode2, Loader2, Paintbrush, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import * as ops from "@/lib/cv/content-ops"
import { exportLatex } from "@/lib/cv/latex"
import { cvToPlainText } from "@/lib/cv/plain"
import { resolveCv, type CvContent } from "@/lib/cv/resolve"
import { clampStyle, TEMPLATES } from "@/lib/cv/templates/registry"
import type { CvStyle, TemplateKey } from "@/lib/cv/templates/types"
import { saveDocumentVersion, updateCvDocument } from "@/lib/data/cv-document-actions"
import type { CvDocument, JdKeywords } from "@/lib/data/cv-documents"
import type { PublicSettings } from "@/lib/data/types"
import type { Basics, ProfileItem } from "@/lib/profile/schema"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { ContentTree, type Focus } from "./content-tree"
import { FitPanel } from "./fit-panel"
import { ScorePanel, type ScoreApp } from "./score-panel"
import { StylePanel } from "./style-panel"
import { measureStyle, renderPdfBlob, useCvRender, type RenderInput } from "./use-cv-render"

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  Object.assign(document.createElement("a"), { href: url, download: name }).click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

const fileSafe = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "")

export function CvEditor({
  doc,
  basics,
  items,
  settings,
  workspaceId,
  apps,
  initialTab,
}: {
  apps: ScoreApp[]
  initialTab?: "preview" | "score"
  doc: CvDocument
  basics: Basics
  items: ProfileItem[]
  settings: PublicSettings
  workspaceId: string
}) {
  const [name, setName] = useState(doc.name)
  const [template, setTemplate] = useState<TemplateKey>(doc.template)
  const [style, setStyle] = useState<CvStyle>(() => clampStyle(doc.template, { ...TEMPLATES[doc.template].defaults, ...doc.style }))
  const [content, setContent] = useState<CvContent>(() =>
    ops.pruneMissing(doc.content, (id) => {
      const it = items.find((i) => i.id === id)
      if (!it) return null
      return Array.isArray(it.data.bullets) ? (it.data.bullets as { id: string }[]).map((b) => b.id) : []
    }),
  )
  const [tab, setTab] = useState<"content" | "preview" | "score">(initialTab ?? "content")
  const [rightTab, setRightTab] = useState<"preview" | "score">(initialTab === "score" ? "score" : "preview")
  const [targetAppId, setTargetAppId] = useState<string | null>(doc.target_application_id)
  const [targetJd, setTargetJd] = useState<string | null>(doc.target_jd)
  const [keywords, setKeywords] = useState<JdKeywords | null>(doc.jd_keywords)
  const [focus, setFocus] = useState<Focus | null>(null)
  const [showStyle, setShowStyle] = useState(false)
  const [save, setSave] = useState<"saved" | "saving" | "error">("saved")
  const [exporting, startExport] = useTransition()
  const first = useRef(true)

  const qrUrl = style.qr_url || basics.links.find((l) => /portfolio|website|web/i.test(l.label))?.url || basics.links[0]?.url || null
  const resolved = useMemo(
    () => resolveCv(content, { basics, items }, { dateFormat: style.date_format, nestProjects: TEMPLATES[template].nestProjects, layout: TEMPLATES[template].layout }),
    [content, basics, items, style.date_format, template],
  )
  const input: RenderInput = { cv: resolved, style, template, qrUrl }
  const { pages, fill, busy, error } = useCvRender(input)
  const overflow = !!fill && (fill.overflowPct > 0.0005 || pages.length > 1)
  const measured = !!fill && !busy

  // autosave (debounced); a pending save is flushed when leaving the editor
  const pending = useRef<Parameters<typeof updateCvDocument>[1] | null>(null)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const payload = {
      ...(name.trim() ? { name: name.trim() } : {}),
      template,
      style,
      content,
      target_application_id: targetAppId,
      target_jd: targetJd,
      jd_keywords: keywords,
    }
    pending.current = payload
    setSave("saving")
    const t = setTimeout(async () => {
      pending.current = null
      const res = await updateCvDocument(doc.id, payload)
      setSave(res.ok ? "saved" : "error")
      if (!res.ok) toast.error("Không lưu được", { description: res.error })
    }, 800)
    return () => clearTimeout(t)
  }, [doc.id, name, template, style, content, targetAppId, targetJd, keywords])
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current) e.preventDefault()
    }
    window.addEventListener("beforeunload", warn)
    return () => {
      window.removeEventListener("beforeunload", warn)
      if (pending.current) void updateCvDocument(doc.id, pending.current) // left via in-app navigation
    }
  }, [doc.id])

  function changeTemplate(t: TemplateKey) {
    setTemplate(t)
    setStyle((s) => clampStyle(t, { ...s, accent: s.accent === TEMPLATES[template].defaults.accent ? TEMPLATES[t].defaults.accent : s.accent }))
  }

  const bulletsOf = (id: string) => {
    const it = items.find((i) => i.id === id)
    return Array.isArray(it?.data.bullets) ? (it!.data.bullets as { id: string }[]).map((b) => b.id) : []
  }

  function exportPdf() {
    if (overflow && !confirm(`CV đang tràn sang trang 2. Vẫn xuất PDF ${Math.max(2, pages.length)} trang?`)) return
    startExport(async () => {
      try {
        download(await renderPdfBlob(input), `${fileSafe(basics.full_name ?? "CV")}_${fileSafe(name)}.pdf`)
      } catch (e) {
        toast.error("Không xuất được PDF", { description: e instanceof Error ? e.message : String(e) })
      }
    })
  }

  function exportTex() {
    download(new Blob([exportLatex(resolved, style, template)], { type: "application/x-tex" }), `${fileSafe(name)}.tex`)
    if (!["mine", "harvard", "classic", "serif"].includes(template)) toast.info("File .tex dùng bố cục 'CV của bạn' (mẫu này chưa có bản LaTeX riêng).")
  }

  function saveVersion() {
    if (overflow && !confirm("CV đang tràn sang trang 2. Vẫn lưu bản này để nộp?")) return
    startExport(async () => {
      try {
        const blob = await renderPdfBlob(input)
        const path = `${workspaceId}/${crypto.randomUUID()}.pdf`
        const { error: upErr } = await createClient().storage.from("cvs").upload(path, blob, { contentType: "application/pdf" })
        if (upErr) throw upErr
        const stamp = new Date().toLocaleDateString("vi-VN")
        const res = await saveDocumentVersion(doc.id, { name: `${name} (${stamp})`, file_path: path, text: cvToPlainText(resolved) })
        if (!res.ok) throw new Error(res.error)
        toast.success("Đã lưu thành bản CV để nộp", { description: "Chọn được ở “Bản CV đã gửi” khi thêm/sửa đơn." })
      } catch (e) {
        toast.error("Không lưu được bản CV", { description: e instanceof Error ? e.message : String(e) })
      }
    })
  }

  const indicator = !fill ? (
    <span className="text-xs text-muted-foreground">Đang đo…</span>
  ) : overflow ? (
    <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-medium text-rose-700 dark:text-rose-300" data-testid="page-indicator">
      ⚠ Tràn {Math.max(1, Math.round(fill.overflowPct * 100))}% sang trang 2
    </span>
  ) : (
    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300" data-testid="page-indicator">
      ✓ 1 trang · còn {Math.max(0, Math.round((1 - fill.used) * 100))}%
    </span>
  )

  return (
    <div className="mx-auto max-w-7xl space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/cv" aria-label="Về trang CV" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <Input aria-label="Tên bản CV" maxLength={80} className="h-9 w-56 max-w-full font-semibold" value={name} onChange={(e) => setName(e.target.value)} />
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {save === "saving" ? "Đang lưu…" : save === "error" ? "Lỗi lưu" : (
            <span className="inline-flex items-center gap-1">
              <Check className="size-3" /> Đã lưu
            </span>
          )}
        </span>
        <span className="flex-1" />
        {indicator}
        <Button size="sm" variant="outline" onClick={() => setShowStyle(!showStyle)} aria-expanded={showStyle}>
          <Paintbrush /> Trình bày
        </Button>
        <Button size="sm" variant="outline" onClick={exportTex}>
          <FileCode2 /> .tex
        </Button>
        <Button size="sm" variant="outline" onClick={exportPdf} disabled={exporting || !measured} title={measured ? undefined : "Đang đo số trang…"}>
          {exporting ? <Loader2 className="animate-spin" /> : <Download />} PDF
        </Button>
        <Button size="sm" onClick={saveVersion} disabled={exporting || !measured} title={measured ? undefined : "Đang đo số trang…"}>
          <Save /> Lưu để nộp
        </Button>
      </div>

      {showStyle && <StylePanel template={template} style={style} onTemplate={changeTemplate} onStyle={setStyle} />}

      {overflow && fill && (
        <FitPanel
          fill={fill}
          style={style}
          template={template}
          content={content}
          resolved={resolved}
          items={items}
          targetTags={doc.target_tags}
          settings={settings}
          measure={async (s) => (await measureStyle({ ...input, style: s })).used}
          onStyle={setStyle}
          onApplyShortened={(rows) => {
            let c = content
            for (const r of rows) {
              const sec = c.sections.find((s) => s.items.some((i) => i.item_id === r.item_id))
              const orig = items.find((i) => i.id === r.item_id)?.data.bullets as { id: string; text: string }[] | undefined
              if (sec) c = ops.setBulletOverride(c, sec.key, r.item_id, r.bullet_id, r.text, orig?.find((b) => b.id === r.bullet_id)?.text ?? "")
            }
            setContent(c)
            toast.success(`Đã áp dụng ${rows.length} câu rút gọn cho bản CV này`)
          }}
          onApplyDrops={(drops) => setContent(ops.applyDrops(content, drops, bulletsOf))}
        />
      )}
      {TEMPLATES[template].layout === "overview" && resolved.omitted.length > 0 && (
        <p className="rounded-lg bg-sky-500/10 p-2 text-xs text-sky-800 dark:text-sky-200">
          Mẫu {TEMPLATES[template].label} chỉ dùng Summary, Education, Work Experience, Key Skills (chứng chỉ gộp vào Education, ngoại ngữ gộp vào Key Skills;
          dự án phải gắn vào một kinh nghiệm). Không hiện: {resolved.omitted.map((o) => `${o.title} (${o.count})`).join(", ")}.
        </p>
      )}
      {resolved.warnings.length > 0 && (
        <p className="rounded-lg bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200">
          {resolved.warnings.length} mục/bullet đã bị xoá khỏi hồ sơ nên không hiện trong CV.
        </p>
      )}

      <div className="grid grid-cols-3 rounded-lg border p-0.5 lg:hidden" role="tablist">
        {(
          [
            ["content", "Nội dung"],
            ["preview", "Xem trước"],
            ["score", "Chấm điểm"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => {
              setTab(k)
              if (k !== "content") setRightTab(k)
            }}
            className={cn("h-8 rounded-md text-sm text-muted-foreground", tab === k && "bg-muted font-medium text-foreground")}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className={cn(tab !== "content" && "max-lg:hidden")}>
          <ContentTree content={content} onChange={setContent} items={items} basics={basics} focus={focus} />
        </div>
        <div className={cn("lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto", tab === "content" && "max-lg:hidden")}>
          <div className="mb-3 hidden grid-cols-2 rounded-lg border p-0.5 lg:grid" role="tablist" aria-label="Bảng bên phải">
            {(
              [
                ["preview", "Xem trước"],
                ["score", "Chấm điểm"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={rightTab === k} onClick={() => setRightTab(k)} className={cn("h-8 rounded-md text-sm text-muted-foreground", rightTab === k && "bg-muted font-medium text-foreground")}>
                {l}
              </button>
            ))}
          </div>
          {rightTab === "score" && (
            <ScorePanel
              resolved={resolved}
              content={content}
              items={items}
              onePage={!fill || !overflow} // not measured yet: don't penalize
              settings={settings}
              apps={apps}
              targetAppId={targetAppId}
              targetJd={targetJd}
              keywords={keywords}
              onTarget={({ appId, jd }) => {
                setTargetAppId(appId)
                setTargetJd(jd)
              }}
              onKeywords={setKeywords}
              onAddFromProfile={(h) => {
                const c = h.kind === "bullet" ? ops.toggleBullet(content, h.section, h.item_id, h.bullet_id!, true, bulletsOf(h.item_id)) : ops.toggleEntry(content, h.section, h.item_id, true)
                setContent(ops.toggleSection(c, h.section, true)) // a hidden section would swallow it
                toast.success("Đã thêm vào bản CV", { description: h.label })
              }}
              onApplyBullet={(itemId, bulletId, text) => {
                const sec = content.sections.find((s) => s.items.some((i) => i.item_id === itemId))
                const orig = (items.find((i) => i.id === itemId)?.data.bullets as { id: string; text: string }[] | undefined)?.find((b) => b.id === bulletId)?.text ?? ""
                if (!sec) return void toast.error("Mục này đã bị bỏ khỏi bản CV, không áp dụng được gợi ý")
                setContent(ops.setBulletOverride(content, sec.key, itemId, bulletId, text, orig))
              }}
              onApplySummary={(text) => setContent({ ...ops.toggleSection(content, "summary", true), summary_override: text })}
              onFocus={(w) => {
                setFocus((f) => ({ item_id: w.item_id, bullet_id: w.bullet_id, n: (f?.n ?? 0) + 1 }))
                setTab("content")
              }}
            />
          )}
          <div className={cn("relative space-y-3", rightTab !== "preview" && "hidden")} data-testid="cv-preview">
            {busy && (
              <span className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-xs shadow">
                <Loader2 className="size-3 animate-spin" /> Đang dựng
              </span>
            )}
            {error && <p className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">Lỗi dựng PDF: {error}</p>}
            {pages.map((src, i) => (
              <figure key={i} className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL rendered by pdf.js */}
                <img src={src} alt={`Trang ${i + 1} của CV`} className={cn("w-full rounded border bg-white shadow-sm", i > 0 && "ring-2 ring-rose-500")} />
                <figcaption className="text-center text-xs text-muted-foreground">Trang {i + 1}{i > 0 ? " (tràn)" : ""}</figcaption>
              </figure>
            ))}
            {!pages.length && !error && <div className="aspect-[210/297] w-full animate-pulse rounded border bg-muted" />}
          </div>
        </div>
      </div>
    </div>
  )
}
