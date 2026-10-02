"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2, Plus, RefreshCw, Sparkles, XCircle } from "lucide-react"
import { toast } from "sonner"
import { InlinePreview } from "@/components/profile/inline-preview"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { describeChainResult, runAiTask } from "@/lib/ai/browser"
import { plainText } from "@/lib/cv/inline"
import type { CvContent, ResolvedCv } from "@/lib/cv/resolve"
import { jdHash, profileHits, scoreCv, type KeywordHit, type ProfileHit, type Where } from "@/lib/cv/score"
import type { JdKeywords } from "@/lib/data/cv-documents"
import type { PublicSettings } from "@/lib/data/types"
import type { ProfileItem } from "@/lib/profile/schema"
import { cn } from "@/lib/utils"

export type ScoreApp = { id: string; label: string; jd_text: string | null; jd_summary: string | null }
type Suggestion = { kind: "bullet" | "summary"; item_id?: string; bullet_id?: string; old: string; text: string; reason: string; keywords: string[] }

const COLOR: Record<KeywordHit["found"], string> = {
  evidence: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  skills: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  missing: "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200",
}

export function ScorePanel({
  resolved,
  content,
  items,
  onePage,
  settings,
  apps,
  targetAppId,
  targetJd,
  keywords,
  onTarget,
  onKeywords,
  onAddFromProfile,
  onApplyBullet,
  onApplySummary,
  onFocus,
}: {
  resolved: ResolvedCv
  content: CvContent
  items: ProfileItem[]
  onePage: boolean
  settings: PublicSettings
  apps: ScoreApp[]
  targetAppId: string | null
  targetJd: string | null
  keywords: JdKeywords | null
  onTarget: (t: { appId: string | null; jd: string | null }) => void
  onKeywords: (k: JdKeywords) => void
  onAddFromProfile: (h: ProfileHit) => void
  onApplyBullet: (itemId: string, bulletId: string, text: string) => void
  onApplySummary: (text: string) => void
  onFocus: (w: Where) => void
}) {
  const [busy, setBusy] = useState<"kw" | "ai" | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const app = apps.find((a) => a.id === targetAppId) ?? null
  const jd = (app ? app.jd_text : targetJd) ?? ""
  const stale = !!keywords && !!jd.trim() && keywords.jd_hash !== jdHash(jd)
  const score = useMemo(() => scoreCv(resolved, keywords?.keywords ?? [], { onePage }), [resolved, keywords, onePage])
  const groups = useMemo(() => {
    const m = new Map<string, KeywordHit[]>()
    for (const h of score.hits) m.set(h.keyword.category || "Khác", [...(m.get(h.keyword.category || "Khác") ?? []), h])
    return [...m]
  }, [score.hits])

  async function analyze() {
    if (!settings.ai_ready) return void toast.error("Chưa cấu hình AI", { description: "Vào Cài đặt → AI." })
    setBusy("kw")
    try {
      const r = await runAiTask(settings, "extract_keywords", { jdText: jd })
      const seen = new Set<string>()
      const list = r.data.keywords.filter((k) => !seen.has(k.term.toLowerCase()) && seen.add(k.term.toLowerCase())).slice(0, 40)
      onKeywords({ jd_hash: jdHash(jd), keywords: list, extracted_at: new Date().toISOString() })
      const fb = describeChainResult(r)
      toast.success(`Đã phân tích JD: ${list.length} keyword`, { description: fb })
    } catch (e) {
      toast.error("Không phân tích được JD", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(null)
    }
  }

  async function suggest() {
    if (!settings.ai_ready) return void toast.error("Chưa cấu hình AI", { description: "Vào Cài đặt → AI." })
    const bullets = resolved.sections
      .filter((s) => s.key === "experience" || s.key === "project" || s.key === "custom")
      .flatMap((s) => s.entries.flatMap((e) => [e, ...e.children]).flatMap((e) => e.bullets.map((b) => ({ id: b.id, text: b.text, item_id: e.id }))))
      .slice(0, 25)
    if (!bullets.length) return void toast.error("Bản CV chưa có bullet nào để gợi ý")
    setBusy("ai")
    try {
      const r = await runAiTask(settings, "suggest_edits", {
        jdSummary: (app?.jd_summary || jd).slice(0, 4000),
        missing: score.hits.filter((h) => h.found === "missing").map((h) => h.keyword.term),
        weak: score.hits.filter((h) => h.found === "skills").map((h) => h.keyword.term),
        bullets: bullets.map(({ id, text }) => ({ id, text })),
        summary: resolved.basics.summary || undefined,
      })
      const byId = new Map(bullets.map((b) => [b.id, b]))
      const list: Suggestion[] = r.data.bullets.flatMap((s) => {
        const b = byId.get(s.id)
        return b && s.text.trim() !== b.text.trim() ? [{ kind: "bullet" as const, item_id: b.item_id, bullet_id: b.id, old: b.text, text: s.text.trim(), reason: s.reason, keywords: s.keywords }] : []
      })
      if (r.data.summary?.text && resolved.basics.summary && r.data.summary.text.trim() !== resolved.basics.summary.trim())
        list.unshift({ kind: "summary", old: resolved.basics.summary, text: r.data.summary.text.trim(), reason: r.data.summary.reason, keywords: [] })
      setSuggestions(list)
      const fb = describeChainResult(r)
      if (fb) toast.info(fb)
    } catch (e) {
      toast.error("AI không gợi ý được", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(null)
    }
  }

  const apply = (s: Suggestion) => {
    if (s.kind === "summary") onApplySummary(s.text)
    else onApplyBullet(s.item_id!, s.bullet_id!, s.text)
    setSuggestions((l) => l!.filter((x) => x !== s))
  }

  return (
    <div className="space-y-4" data-testid="score-panel">
      <section className="space-y-2 rounded-xl border bg-card p-3">
        <h2 className="text-sm font-semibold">Chấm theo JD</h2>
        <NativeSelect
          aria-label="Nguồn JD"
          value={targetAppId ?? (targetJd !== null ? "__paste" : "")}
          onChange={(e) => {
            const v = e.target.value
            if (v === "__paste") onTarget({ appId: null, jd: targetJd ?? "" })
            else onTarget({ appId: v || null, jd: null })
          }}
        >
          <option value="">— Chọn đơn ứng tuyển hoặc dán JD —</option>
          {apps.filter((a) => a.jd_text?.trim()).map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
          <option value="__paste">Dán JD…</option>
        </NativeSelect>
        {targetAppId === null && targetJd !== null && (
          <Textarea rows={6} maxLength={30000} aria-label="Nội dung JD" placeholder="Dán nội dung tin tuyển dụng" value={targetJd} onChange={(e) => onTarget({ appId: null, jd: e.target.value })} />
        )}
        {jd.trim().length >= 30 && (!keywords || stale) && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={analyze} disabled={!!busy}>
              {busy === "kw" ? <Loader2 className="animate-spin" /> : <Sparkles />} {stale ? "JD đã đổi — phân tích lại" : "Phân tích JD"}
            </Button>
            <span className="text-xs text-muted-foreground">AI đọc JD một lần để lấy keyword; điểm sau đó tính ngay khi bạn sửa CV.</span>
          </div>
        )}
        {keywords && !stale && (
          <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={analyze} disabled={!!busy}>
            <RefreshCw className="size-3" /> Phân tích lại ({keywords.keywords.length} keyword)
          </button>
        )}
      </section>

      {keywords && (
        <>
          <section className="space-y-3 rounded-xl border bg-card p-3">
            <div className="flex items-center gap-4">
              <div
                className="flex size-20 shrink-0 items-center justify-center rounded-full text-2xl font-bold tabular-nums"
                style={{ background: `conic-gradient(var(--series-1) ${score.total * 3.6}deg, var(--muted) 0deg)` }}
                role="img"
                aria-label={`Điểm ${score.total} trên 100`}
              >
                <span className="flex size-16 items-center justify-center rounded-full bg-card" data-testid="score-total">
                  {score.total}
                </span>
              </div>
              <dl className="flex-1 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt>Keyword bắt buộc ({score.parts.required.matched}/{score.parts.required.count})</dt>
                  <dd className="tabular-nums">{Math.round(score.parts.required.score)}/{score.parts.required.max}</dd>
                </div>
                {score.parts.preferred.max > 0 && (
                  <div className="flex justify-between">
                    <dt>Keyword điểm cộng ({score.parts.preferred.matched}/{score.parts.preferred.count})</dt>
                    <dd className="tabular-nums">{Math.round(score.parts.preferred.score)}/{score.parts.preferred.max}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt>Trình bày</dt>
                  <dd className="tabular-nums">{score.parts.format.score}/{score.parts.format.max}</dd>
                </div>
              </dl>
            </div>
            <ul className="space-y-0.5 text-xs">
              {score.parts.format.checks.map((c) => (
                <li key={c.key} className="flex items-center gap-1.5">
                  {c.ok ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <XCircle className="size-3.5 text-rose-600" />} {c.label}
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3 rounded-xl border bg-card p-3">
            <p className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>🟢 có trong kinh nghiệm/dự án</span>
              <span>🟡 chỉ có ở Kỹ năng (tính 70%)</span>
              <span>🔴 thiếu</span>
            </p>
            {groups.map(([cat, list]) => (
              <div key={cat} className="space-y-1.5">
                <h3 className="text-xs font-medium text-muted-foreground">{cat}</h3>
                <ul className="flex flex-wrap gap-1.5">
                  {list.map((h) => (
                    <li key={h.keyword.term}>
                      <button
                        type="button"
                        className={cn("rounded-full border px-2 py-0.5 text-xs", COLOR[h.found], h.keyword.weight === "required" && "font-semibold")}
                        title={`${h.keyword.weight === "required" ? "Bắt buộc" : "Điểm cộng"}${h.keyword.aliases.length ? ` · ${h.keyword.aliases.join(", ")}` : ""}`}
                        onClick={() => h.where[0] && onFocus(h.where.find((w) => w.bullet_id) ?? h.where[0])}
                        data-testid={`kw-${h.found}`}
                      >
                        {h.keyword.term}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <MissingList hits={score.hits.filter((h) => h.found === "missing")} items={items} content={content} onAdd={onAddFromProfile} />
          </section>

          <section className="space-y-2 rounded-xl border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Gợi ý sửa</h2>
              <Button size="sm" variant="outline" onClick={suggest} disabled={!!busy}>
                {busy === "ai" ? <Loader2 className="animate-spin" /> : <Sparkles />} Gợi ý sửa bằng AI
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">AI chỉ viết lại những gì bullet đã nói — không thêm việc bạn chưa làm. Áp dụng chỉ đổi bản CV này.</p>
            {suggestions?.length === 0 && <p className="text-sm text-muted-foreground">AI không có gợi ý nào thêm.</p>}
            {suggestions?.map((s, i) => (
              <article key={i} className="space-y-1.5 rounded-lg border p-2 text-sm" data-testid="suggestion">
                <p className="text-xs font-medium">{s.kind === "summary" ? "Summary" : "Bullet"} · {s.reason}</p>
                <p className="text-muted-foreground line-through">
                  <InlinePreview text={s.old} />
                </p>
                <p>
                  <InlinePreview text={s.text} />
                </p>
                {s.keywords.length > 0 && <p className="text-xs text-emerald-700 dark:text-emerald-300">+ {s.keywords.join(", ")}</p>}
                <div className="flex gap-1.5">
                  <Button size="xs" onClick={() => apply(s)}>
                    Áp dụng
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setSuggestions((l) => l!.filter((x) => x !== s))}>
                    Bỏ qua
                  </Button>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  )
}

function MissingList({ hits, items, content, onAdd }: { hits: KeywordHit[]; items: ProfileItem[]; content: CvContent; onAdd: (h: ProfileHit) => void }) {
  if (!hits.length) return null
  return (
    <div className="space-y-1.5 border-t pt-2">
      <h3 className="text-xs font-medium">Keyword thiếu</h3>
      <ul className="space-y-1.5 text-sm">
        {hits.map((h) => {
          const found = profileHits(h.keyword, items, content)[0]
          return (
            <li key={h.keyword.term} className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full border px-2 py-0.5 text-xs", COLOR.missing)}>{h.keyword.term}</span>
              {found ? (
                <>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={found.label}>
                    Có trong hồ sơ: {plainText(found.label)}
                  </span>
                  <Button size="xs" variant="outline" onClick={() => onAdd(found)} aria-label={`Thêm ${h.keyword.term} từ hồ sơ`}>
                    <Plus /> Thêm từ hồ sơ
                  </Button>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Chưa có trong hồ sơ — chỉ thêm nếu bạn thực sự có kinh nghiệm này ·{" "}
                  <Link href="/profile" className="underline">
                    Hồ sơ
                  </Link>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
