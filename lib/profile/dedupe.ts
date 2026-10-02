import { normalize } from "@/lib/board/filter"
import type { Bullet, Section } from "./schema"

type Data = Record<string, unknown>
type Existing = { id: string; section: Section; data: Data }

// Legal-form words that vary between CVs ("Co., Ltd", "JSC", "Công ty Cổ phần").
const COMPANY_PHRASES = [/\bcong ty (co phan|tnhh)\b/g, /\bcong ty\b/g]
const COMPANY_WORDS = new Set(["co", "ltd", "inc", "jsc", "llc", "corp", "corporation", "company", "plc", "tnhh", "gmbh", "pte"])

/** Comparable form: no accents/case/punctuation/legal suffixes, single spaces. */
export function textKey(s: unknown): string {
  if (typeof s !== "string") return ""
  let t = normalize(s).replace(/[^a-z0-9]+/g, " ")
  for (const re of COMPANY_PHRASES) t = t.replace(re, " ")
  return t
    .split(" ")
    .filter((w) => w && !COMPANY_WORDS.has(w))
    .join(" ")
}

/** Jaccard overlap of words, 0..1. */
export function similarity(a: unknown, b: unknown): number {
  const A = new Set(textKey(a).split(" ").filter(Boolean))
  const B = new Set(textKey(b).split(" ").filter(Boolean))
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const w of A) if (B.has(w)) inter++
  return inter / (A.size + B.size - inter)
}

const same = (a: unknown, b: unknown) => !!textKey(a) && textKey(a) === textKey(b)
const TITLE_SIMILARITY = 0.6

function isDuplicate(section: Section, a: Data, b: Data): boolean {
  switch (section) {
    case "experience":
      return same(a.company, b.company) && similarity(a.title, b.title) >= TITLE_SIMILARITY
    case "education":
      return same(a.school, b.school) && (!textKey(a.degree) || !textKey(b.degree) || same(a.degree, b.degree))
    case "project":
    case "certification":
    case "language":
      return same(a.name, b.name)
    case "skill":
      return same(a.category, b.category)
    case "custom":
      return same(a.section_title, b.section_title) && same(a.title, b.title)
    default: // publication, award
      return same(a.title, b.title)
  }
}

export function findDuplicate(section: Section, data: Data, existing: Existing[]): string | null {
  return existing.find((e) => e.section === section && isDuplicate(section, e.data, data))?.id ?? null
}

const bulletKey = (t: string) => normalize(t).replace(/\s+/g, " ").trim()

function newBullets(oldB: unknown, newB: unknown): Bullet[] {
  const have = new Set((Array.isArray(oldB) ? (oldB as Bullet[]) : []).map((x) => bulletKey(x.text)))
  return (Array.isArray(newB) ? (newB as Bullet[]) : []).filter((x) => !have.has(bulletKey(x.text)))
}

function newStrings(oldL: unknown, newL: unknown): string[] {
  const have = new Set((Array.isArray(oldL) ? (oldL as string[]) : []).map(bulletKey))
  return (Array.isArray(newL) ? (newL as string[]) : []).filter((x) => !have.has(bulletKey(x)))
}

/** What a merge would add: new bullets, then new tech / skill items. */
export function mergeAdds(oldData: Data, newData: Data): string[] {
  return [
    ...newBullets(oldData.bullets, newData.bullets).map((x) => x.text),
    ...newStrings(oldData.tech, newData.tech),
    ...newStrings(oldData.items, newData.items),
  ]
}

/** Keep everything old; append new bullets/tech/items; fill only empty fields. */
export function mergeData(_section: Section, oldData: Data, newData: Data): Data {
  const out: Data = { ...oldData }
  for (const [k, v] of Object.entries(newData)) {
    if (k === "bullets") out.bullets = [...((oldData.bullets as Bullet[]) ?? []), ...newBullets(oldData.bullets, v)]
    else if (k === "tech" || k === "items") out[k] = [...((oldData[k] as string[]) ?? []), ...newStrings(oldData[k], v)]
    else if ((out[k] === undefined || out[k] === "") && v !== undefined && v !== "") out[k] = v
  }
  return out
}

export type ImportAction = "add" | "skip" | "merge" | "overwrite"
export type ImportRow = {
  key: string
  section: Section
  data: Data
  match: Existing | null
  action: ImportAction
  newBits: string[]
}

/** Pair each parsed item with an existing duplicate (if any) and a default action. */
export function planImport(existing: Existing[], parsed: { section: Section; data: Data }[]): ImportRow[] {
  return parsed.map((p, i) => {
    const id = findDuplicate(p.section, p.data, existing)
    const match = id ? existing.find((e) => e.id === id)! : null
    return {
      key: `row-${i}`,
      section: p.section,
      data: p.data,
      match,
      action: match ? "skip" : "add",
      newBits: match ? mergeAdds(match.data, p.data) : [],
    }
  })
}
