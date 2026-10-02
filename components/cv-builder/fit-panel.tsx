"use client"

import { useState } from "react"
import { Loader2, Minimize2, Scissors, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { InlinePreview } from "@/components/profile/inline-preview"
import { Button } from "@/components/ui/button"
import { describeChainResult, runAiTask } from "@/lib/ai/browser"
import { fitStyle, rankDrops, type DropSuggestion } from "@/lib/cv/fit"
import type { Fill } from "@/lib/cv/measure"
import type { CvContent, ResolvedCv } from "@/lib/cv/resolve"
import { TEMPLATES } from "@/lib/cv/templates/registry"
import type { CvStyle, TemplateKey } from "@/lib/cv/templates/types"
import type { PublicSettings } from "@/lib/data/types"
import type { ProfileItem } from "@/lib/profile/schema"

type Shortened = { item_id: string; section: string; bullet_id: string; old: string; text: string; take: boolean }

export function FitPanel({
  fill,
  style,
  template,
  content,
  resolved,
  items,
  targetTags,
  settings,
  measure,
  onStyle,
  onApplyShortened,
  onApplyDrops,
}: {
  fill: Fill
  style: CvStyle
  template: TemplateKey
  content: CvContent
  resolved: ResolvedCv
  items: ProfileItem[]
  targetTags: string[]
  settings: PublicSettings
  measure: (s: CvStyle) => Promise<number>
  onStyle: (s: CvStyle) => void
  onApplyShortened: (rows: Shortened[]) => void
  onApplyDrops: (drops: DropSuggestion[]) => void
}) {
  const [busy, setBusy] = useState<"fit" | "ai" | null>(null)
  const [shortened, setShortened] = useState<Shortened[] | null>(null)
  const [drops, setDrops] = useState<(DropSuggestion & { take: boolean })[] | null>(null)
  const pct = Math.max(1, Math.round(fill.overflowPct * 100))

  async function autoFit() {
    setBusy("fit")
    try {
      // aim a little under a full page: column layouts can paginate a hair earlier than measured
      const r = await fitStyle(measure, style, TEMPLATES[template].bounds, 0.995)
      onStyle(r.style)
      if (r.ok) toast.success(`Đã co vừa 1 trang (cỡ chữ ${r.style.font_size}pt, giãn dòng ${r.style.line_height.toFixed(2)}, lề ${r.style.margin_mm}mm)`)
      else toast.warning("Đã co tối đa trong giới hạn của mẫu mà vẫn tràn — cần rút gọn hoặc bỏ bớt nội dung.")
    } catch (e) {
      toast.error("Không tự co được", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(null)
    }
  }

  async function aiShorten() {
    if (!settings.ai_ready) return void toast.error("Chưa cấu hình AI", { description: "Vào Cài đặt → AI." })
    // longest bullets first, enough to win back roughly the overflow (x2 margin), at most 8
    const all = resolved.sections.flatMap((s) =>
      s.entries.flatMap((e) => [e, ...e.children]).flatMap((e) => e.bullets.map((b) => ({ item_id: e.id, section: s.key, bullet_id: b.id, text: b.text }))),
    )
    const total = all.reduce((n, b) => n + b.text.length, 0)
    const need = Math.max(0.05, fill.overflowPct * 2) * total
    const pick: typeof all = []
    let gained = 0
    for (const b of [...all].sort((a, c) => c.text.length - a.text.length)) {
      if (gained >= need || pick.length >= 8) break
      pick.push(b)
      gained += b.text.length * 0.3
    }
    if (!pick.length) return
    setBusy("ai")
    try {
      const r = await runAiTask(settings, "shorten_bullets", { bullets: pick.map((b) => ({ id: b.bullet_id, text: b.text })), ratio: 0.7 })
      const byId = new Map(r.data.bullets.map((b) => [b.id, b.text.trim()]))
      setShortened(pick.flatMap((b) => {
        const text = byId.get(b.bullet_id)
        return text && text !== b.text ? [{ ...b, old: b.text, text, take: true }] : []
      }))
      const fb = describeChainResult(r)
      if (fb) toast.info(fb)
    } catch (e) {
      toast.error("AI không rút gọn được", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-rose-500/40 bg-rose-500/5 p-3" aria-label="Gợi ý thu gọn">
      <p className="text-sm font-medium text-rose-700 dark:text-rose-300">⚠ CV đang tràn {pct}% sang trang 2. Thu gọn để vừa đúng 1 trang A4:</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={autoFit} disabled={!!busy}>
          {busy === "fit" ? <Loader2 className="animate-spin" /> : <Minimize2 />} Tự co cho vừa
        </Button>
        <Button size="sm" variant="outline" onClick={aiShorten} disabled={!!busy}>
          {busy === "ai" ? <Loader2 className="animate-spin" /> : <Sparkles />} AI rút gọn bullet
        </Button>
        <Button size="sm" variant="outline" onClick={() => setDrops(rankDrops(content, items, targetTags).map((d) => ({ ...d, take: false })))} disabled={!!busy}>
          <Scissors /> Gợi ý bỏ
        </Button>
      </div>

      {shortened && (
        <div className="space-y-2 rounded-lg bg-background p-2">
          <p className="text-xs font-medium">AI đề xuất (chỉ áp dụng cho bản CV này):</p>
          {shortened.length === 0 && <p className="text-xs text-muted-foreground">AI không rút gọn được câu nào.</p>}
          {shortened.map((s, i) => (
            <label key={s.bullet_id} className="flex gap-2 text-xs">
              <input type="checkbox" checked={s.take} onChange={(e) => setShortened((r) => r!.map((x, j) => (j === i ? { ...x, take: e.target.checked } : x)))} />
              <span className="space-y-0.5">
                <span className="block text-muted-foreground line-through">
                  <InlinePreview text={s.old} />
                </span>
                <span className="block">
                  <InlinePreview text={s.text} />
                </span>
              </span>
            </label>
          ))}
          <div className="flex gap-2">
            <Button
              size="xs"
              disabled={!shortened.some((s) => s.take)}
              onClick={() => {
                onApplyShortened(shortened.filter((s) => s.take))
                setShortened(null)
              }}
            >
              Áp dụng
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setShortened(null)}>
              Đóng
            </Button>
          </div>
        </div>
      )}

      {drops && (
        <div className="space-y-1.5 rounded-lg bg-background p-2">
          <p className="text-xs font-medium">Có thể bỏ (ít liên quan vị trí mục tiêu, cũ, hoặc dài):</p>
          {drops.map((d, i) => (
            <label key={d.kind + d.item_id + (d.bullet_id ?? "")} className="flex gap-2 text-xs">
              <input type="checkbox" checked={d.take} onChange={(e) => setDrops((r) => r!.map((x, j) => (j === i ? { ...x, take: e.target.checked } : x)))} />
              <span>
                <b>{d.kind === "item" ? "Bỏ mục" : "Bỏ bullet"}:</b> {d.label} <span className="text-muted-foreground">({d.reason})</span>
              </span>
            </label>
          ))}
          <div className="flex gap-2">
            <Button
              size="xs"
              disabled={!drops.some((d) => d.take)}
              onClick={() => {
                onApplyDrops(drops.filter((d) => d.take))
                setDrops(null)
              }}
            >
              Bỏ các mục đã chọn
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setDrops(null)}>
              Đóng
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
