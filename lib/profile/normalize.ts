import { BasicsSchema, ItemDataSchemas, SECTION_KEYS, type Basics, type Bullet, type Section } from "./schema"

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}
const pad = (m: number) => String(m).padStart(2, "0")
const ok = (y: number, m: number) => y >= 1950 && y <= 2100 && m >= 1 && m <= 12

/** "Jan 2024" | "01/2024" | "2024-1" | "03.2022" | "2024" -> "YYYY-MM" / "YYYY"; unknown text kept as is. */
export function normalizeMonth(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null
  const t = raw.trim()
  let m: RegExpExecArray | null
  if ((m = /^(\d{4})[-/.](\d{1,2})$/.exec(t)) && ok(+m[1], +m[2])) return `${m[1]}-${pad(+m[2])}`
  if ((m = /^(\d{1,2})[-/.](\d{4})$/.exec(t)) && ok(+m[2], +m[1])) return `${m[2]}-${pad(+m[1])}`
  if ((m = /^([a-z]{3})[a-z]*\.?\s+(\d{4})$/i.exec(t)) && MONTHS[m[1].toLowerCase()]) {
    return `${m[2]}-${pad(MONTHS[m[1].toLowerCase()])}`
  }
  if ((m = /^th[aá]ng\s+(\d{1,2})[\s,/]+(\d{4})$/i.exec(t)) && ok(+m[2], +m[1])) return `${m[2]}-${pad(+m[1])}`
  if (/^\d{4}$/.test(t)) return t
  return t
}

const PRESENT = /^(present|now|current|currently|today|ongoing|hiện tại|hien tai|nay|đến nay)$/i

export function normalizeEnd(raw: unknown): string | null {
  if (typeof raw === "string" && PRESENT.test(raw.trim())) return "present"
  return normalizeMonth(raw)
}

const newId = () => crypto.randomUUID()

/** Bullets from a string ("• a\n- b"), string[] or {id?, text}[]; empties dropped, ids kept or created. */
export function toBullets(raw: unknown): Bullet[] {
  const parts: { id?: string; text: string }[] = []
  if (typeof raw === "string") {
    for (const line of raw.split(/\r?\n/)) parts.push({ text: line })
  } else if (Array.isArray(raw)) {
    for (const x of raw) {
      if (typeof x === "string") parts.push({ text: x })
      else if (x && typeof x === "object" && typeof (x as { text?: unknown }).text === "string") {
        const o = x as { id?: unknown; text: string }
        parts.push({ id: typeof o.id === "string" ? o.id : undefined, text: o.text })
      }
    }
  }
  return parts
    .map((p) => ({ id: p.id || newId(), text: p.text.replace(/^\s*(?:[•\-*–·]|\d+[.)])\s*/, "").trim() }))
    .filter((b) => b.text)
}

/** "a, b; c" or ["a", "b"] -> ["a", "b", "c"] */
function toList(raw: unknown): string[] {
  const arr = typeof raw === "string" ? raw.split(/[,;\n]/) : Array.isArray(raw) ? raw : []
  return arr.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean)
}

const DATE_FIELDS = ["start", "date"]
const BULLET_SECTIONS = new Set<Section>(["experience", "education", "project", "custom"])
const LIST_FIELDS = ["tech", "items"]

function normalizeData(section: Section, raw: Record<string, unknown>): Record<string, unknown> {
  const d: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (DATE_FIELDS.includes(k)) d[k] = normalizeMonth(v) ?? undefined
    else if (k === "end") d[k] = normalizeEnd(v) ?? undefined
    else if (k === "bullets") d[k] = toBullets(v)
    else if (LIST_FIELDS.includes(k)) d[k] = toList(v)
    else if (typeof v === "string") d[k] = v.trim() || undefined
    else if (typeof v === "number") d[k] = String(v)
  }
  if (BULLET_SECTIONS.has(section) && !d.bullets) d.bullets = []
  return d
}

export type ParsedItem = { section: Section; data: Record<string, unknown> }

/** Clean up an AI `parse_cv` result; items that don't fit their schema are dropped and counted. */
export function normalizeParsed(raw: unknown): { basics: Basics; items: ParsedItem[]; dropped: number } {
  const obj = (raw && typeof raw === "object" ? raw : {}) as { basics?: unknown; items?: unknown }
  const b = BasicsSchema.safeParse(
    Object.fromEntries(
      Object.entries((obj.basics && typeof obj.basics === "object" ? obj.basics : {}) as Record<string, unknown>).map(([k, v]) => [
        k,
        typeof v === "string" ? v.trim() || undefined : v,
      ]),
    ),
  )
  const basics = b.success ? b.data : ({ links: [] } as Basics)
  const items: ParsedItem[] = []
  let dropped = 0
  for (const it of Array.isArray(obj.items) ? obj.items : []) {
    const section = (it as { section?: unknown })?.section
    const data = (it as { data?: unknown })?.data
    if (!SECTION_KEYS.includes(section as Section) || !data || typeof data !== "object") {
      dropped++
      continue
    }
    const parsed = ItemDataSchemas[section as Section].safeParse(normalizeData(section as Section, data as Record<string, unknown>))
    if (parsed.success) items.push({ section: section as Section, data: parsed.data as Record<string, unknown> })
    else dropped++
  }
  return { basics: raw ? basics : ({} as Basics), items, dropped }
}
