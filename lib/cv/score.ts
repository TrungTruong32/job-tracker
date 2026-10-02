import type { ProfileItem, Section } from "@/lib/profile/schema"
import { plainText } from "./inline"
import type { CvContent, CvSectionKey, ResolvedCv } from "./resolve"

// Transparent JD-keyword scoring: AI extracts keywords once; matching and scoring are
// deterministic so the score is stable and updates instantly while editing.

export type Keyword = { term: string; aliases: string[]; weight: "required" | "preferred"; category?: string }
export type Where = { section: CvSectionKey; item_id?: string; bullet_id?: string }
export type KeywordHit = { keyword: Keyword; found: "evidence" | "skills" | "missing"; where: Where[] }
export type FormatCheck = { key: "one_page" | "quantified" | "summary_keywords" | "bullet_length"; label: string; ok: boolean }
export type ScoreResult = {
  total: number
  parts: {
    required: { score: number; max: number; matched: number; count: number }
    preferred: { score: number; max: number; matched: number; count: number }
    format: { score: number; max: number; checks: FormatCheck[] }
  }
  hits: KeywordHit[]
}

/** Lowercase, no accents, tokens that keep C++ / C# / Node.js / .NET intact. */
export function tokens(s: string): string[] {
  const t = s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    // short pairs are one term: CI/CD, A/B, R&D, Q&A (so "R" does not match "R&D")
    .replace(/(?<![a-z0-9])([a-z0-9]{1,3})[/&]([a-z0-9]{1,3})(?![a-z0-9])/g, "$1$2")
    // hyphenated compounds: fine-tuning == finetuning, GPT-4 == gpt4
    .replace(/([a-z0-9])-(?=[a-z0-9])/g, "$1")
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .replace(/\.(?![a-z0-9])/g, " ") // sentence dots, not "node.js" / ".net"
    .replace(/(^|[^a-z0-9])[+#]+/g, "$1 ") // stray + / #
  return t
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/\.js$/, "").replace(/^([a-z]{3,})js$/, "$1")) // React.js / NodeJS == React / Node
}

// plural folding only for real words (so "go" != "goes", "ai" != "ais")
const tokEq = (a: string, b: string) =>
  a === b || (a.length >= 3 && b.length >= 3 && (a + "s" === b || b + "s" === a || a + "es" === b || b + "es" === a))

// common equivalents, so matching does not depend on the AI remembering every alias
const BUILTIN_ALIASES: Record<string, string[]> = {
  go: ["golang"],
  golang: ["go"],
  aws: ["amazon web services"],
  "amazon web services": ["aws"],
  gcp: ["google cloud", "google cloud platform"],
  k8s: ["kubernetes"],
  kubernetes: ["k8s"],
  js: ["javascript"],
  javascript: ["js"],
  ts: ["typescript"],
  typescript: ["ts"],
  ml: ["machine learning"],
  "machine learning": ["ml"],
  llm: ["large language model"],
  "large language model": ["llm"],
  nlp: ["natural language processing"],
  "natural language processing": ["nlp"],
  postgres: ["postgresql"],
  postgresql: ["postgres"],
}

export function containsTerm(hay: string[], term: string[]): boolean {
  if (!term.length) return false
  outer: for (let i = 0; i + term.length <= hay.length; i++) {
    for (let j = 0; j < term.length; j++) if (!tokEq(hay[i + j], term[j])) continue outer
    return true
  }
  return false
}

const termsOf = (k: Keyword) => {
  const base = [k.term, ...k.aliases]
  const extra = base.flatMap((t) => BUILTIN_ALIASES[tokens(t).join(" ")] ?? [])
  return [...base, ...extra].map(tokens).filter((t) => t.length)
}
const matches = (text: string, k: Keyword) => {
  const hay = tokens(text)
  return termsOf(k).some((t) => containsTerm(hay, t))
}
export const keywordMatches = matches

const NUMBER = /\d[\d.,]*\s*(?:%|[kKmMbB]\b|\+|x\b|×)?/g
const numberKey = (n: string) => n.replace(/\s+/g, "").replace(/,/g, "").toLowerCase()

/** Truthfulness check for an AI rewrite: numbers it introduced, and JD keywords it really added. */
export function verifySuggestion(oldText: string, newText: string, keywords: Keyword[]): { newNumbers: string[]; added: string[] } {
  const had = new Set((plainText(oldText).match(NUMBER) ?? []).map(numberKey))
  const newNumbers = (plainText(newText).match(NUMBER) ?? []).map((n) => n.trim()).filter((n) => !had.has(numberKey(n)))
  const added = keywords.filter((k) => matches(plainText(newText), k) && !matches(plainText(oldText), k)).map((k) => k.term)
  return { newNumbers, added }
}

/** FNV-1a over the normalized JD: tells when the JD changed since keywords were extracted. */
export function jdHash(jd: string): string {
  let h = 0x811c9dc5
  for (const ch of tokens(jd).join(" ")) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, "0")
}

type Segment = Where & { text: string; kind: "evidence" | "skills" }
const SKILL_SECTIONS = new Set<CvSectionKey>(["skill", "language", "certification"])

function segments(cv: ResolvedCv): Segment[] {
  const out: Segment[] = []
  if (cv.sections.some((s) => s.key === "summary") && cv.basics.summary) out.push({ section: "summary", text: plainText(cv.basics.summary), kind: "evidence" })
  for (const s of cv.sections) {
    const kind = SKILL_SECTIONS.has(s.key) ? "skills" : "evidence"
    for (const e of s.entries.flatMap((x) => [x, ...x.children])) {
      const head = [...Object.entries(e.fields).filter(([k]) => k !== "dates").map(([, v]) => v), ...e.tech, ...e.list].join(" ; ")
      out.push({ section: s.key, item_id: e.id, text: head, kind })
      for (const b of e.bullets) out.push({ section: s.key, item_id: e.id, bullet_id: b.id, text: plainText(b.text), kind })
    }
  }
  return out
}

export const LONG_BULLET = 220

export function scoreCv(cv: ResolvedCv, keywords: Keyword[], opts: { onePage: boolean }): ScoreResult {
  const segs = segments(cv)
  const hits: KeywordHit[] = keywords.map((k) => {
    const where = segs.filter((s) => matches(s.text, k))
    const found = where.some((w) => w.kind === "evidence") ? "evidence" : where.length ? "skills" : "missing"
    return { keyword: k, found, where: where.map(({ section, item_id, bullet_id }) => ({ section, item_id, bullet_id })) }
  })
  const credit = (h: KeywordHit) => (h.found === "evidence" ? 1 : h.found === "skills" ? 0.7 : 0)
  const req = hits.filter((h) => h.keyword.weight === "required")
  const pref = hits.filter((h) => h.keyword.weight === "preferred")
  // 80 keyword points shared 60/20; all to one kind when the JD only has that kind
  const reqMax = req.length ? (pref.length ? 60 : 80) : 0
  const prefMax = pref.length ? (req.length ? 20 : 80) : 0
  const part = (list: KeywordHit[], max: number) => ({
    score: list.length ? Math.round((max * list.reduce((n, h) => n + credit(h), 0)) / list.length) : 0,
    max,
    matched: list.filter((h) => h.found !== "missing").length,
    count: list.length,
  })

  const bullets = cv.sections.flatMap((s) => s.entries.flatMap((e) => [e, ...e.children]).flatMap((e) => e.bullets.map((b) => plainText(b.text))))
  const quantified = bullets.filter((b) => /\d|%/.test(b)).length
  const summary = cv.sections.some((s) => s.key === "summary") ? plainText(cv.basics.summary ?? "") : ""
  const needInSummary = Math.min(2, req.length)
  const checks: FormatCheck[] = [
    { key: "one_page", label: "Vừa 1 trang A4", ok: opts.onePage },
    { key: "quantified", label: `≥ 50% bullet có số liệu (${quantified}/${bullets.length})`, ok: bullets.length > 0 && quantified / bullets.length >= 0.5 },
    {
      key: "summary_keywords",
      label: needInSummary ? `Summary chứa ≥ ${needInSummary} keyword bắt buộc` : "Summary (JD không có keyword bắt buộc)",
      ok: req.filter((h) => matches(summary, h.keyword)).length >= needInSummary,
    },
    { key: "bullet_length", label: `Không bullet nào dài quá ${LONG_BULLET} ký tự (~2 dòng)`, ok: bullets.every((b) => b.length <= LONG_BULLET) },
  ]
  const format = { score: checks.filter((c) => c.ok).length * 5, max: 20, checks }
  const required = part(req, reqMax)
  const preferred = part(pref, prefMax)
  // parts are already integers, so the total always equals what the breakdown shows
  const total = keywords.length ? required.score + preferred.score + format.score : format.score * 5
  return { total, parts: { required, preferred, format }, hits }
}

export type ProfileHit = { kind: "bullet" | "item"; section: Section; item_id: string; bullet_id?: string; label: string }

/** Where the profile has a keyword that the CV does not show yet (hidden bullet of a chosen item, or an unchosen item). */
export function profileHits(k: Keyword, items: ProfileItem[], content: CvContent): ProfileHit[] {
  const chosen = new Map<string, string[] | null>()
  for (const s of content.sections) if (s.visible) for (const r of s.items) chosen.set(r.item_id, r.bullet_ids ?? null)
  const bulletsOf = (it: ProfileItem) => (Array.isArray(it.data.bullets) ? (it.data.bullets as { id: string; text: string }[]) : [])
  const headText = (it: ProfileItem) => Object.values(it.data).flatMap((v) => (typeof v === "string" ? [v] : Array.isArray(v) && typeof v[0] === "string" ? (v as string[]) : [])).join(" ; ")

  // already visible somewhere in the CV -> nothing to add
  for (const it of items) {
    if (!chosen.has(it.id)) continue
    const ids = chosen.get(it.id)
    if (matches(headText(it), k) || bulletsOf(it).some((b) => (ids === null || ids!.includes(b.id)) && matches(b.text, k))) return []
  }

  const title = (it: ProfileItem) => [it.data.title ?? it.data.name ?? it.data.category ?? it.data.school, it.data.company].filter(Boolean).join(" | ")
  const out: ProfileHit[] = []
  for (const it of items) {
    if (!chosen.has(it.id)) continue
    const ids = chosen.get(it.id)
    for (const b of bulletsOf(it)) if (ids && !ids.includes(b.id) && matches(b.text, k)) out.push({ kind: "bullet", section: it.section, item_id: it.id, bullet_id: b.id, label: plainText(b.text) })
  }
  for (const it of [...items].sort((a, b) => a.position - b.position)) {
    if (chosen.has(it.id)) continue
    const b = bulletsOf(it).find((x) => matches(x.text, k))
    if (b) out.push({ kind: "item", section: it.section, item_id: it.id, bullet_id: b.id, label: `${title(it)} — ${plainText(b.text)}` })
    else if (matches(headText(it), k)) out.push({ kind: "item", section: it.section, item_id: it.id, label: title(it) })
  }
  return out
}
