import { z } from "zod"

// Structured career profile: one `basics` per workspace + typed items per section.

export const SECTIONS = [
  { key: "experience", label: "Kinh nghiệm", newestFirst: true },
  { key: "education", label: "Học vấn", newestFirst: true },
  { key: "project", label: "Dự án", newestFirst: true },
  { key: "publication", label: "Công bố", newestFirst: true },
  { key: "skill", label: "Kỹ năng", newestFirst: false },
  { key: "certification", label: "Chứng chỉ", newestFirst: false },
  { key: "award", label: "Giải thưởng", newestFirst: false },
  { key: "language", label: "Ngoại ngữ", newestFirst: false },
  { key: "custom", label: "Mục khác", newestFirst: false },
] as const

export type Section = (typeof SECTIONS)[number]["key"]
export const SECTION_KEYS = SECTIONS.map((s) => s.key) as [Section, ...Section[]]
export const sectionLabel = (s: Section) => SECTIONS.find((x) => x.key === s)!.label

export const BulletSchema = z.object({ id: z.string().min(1), text: z.string().min(1) })
export type Bullet = z.infer<typeof BulletSchema>

const str = z.string().trim().min(1)
const opt = z.string().trim().optional()
const date = z.string().trim().optional() // "YYYY-MM" | "YYYY" | raw text we could not parse
const end = z.string().trim().optional() // same, or "present"
const bullets = z.array(BulletSchema).default([])
const list = z.array(z.string().trim().min(1)).default([])

export const ItemDataSchemas = {
  experience: z.object({ company: str, title: str, location: opt, start: date, end, bullets, tech: list }),
  education: z.object({ school: str, degree: opt, field: opt, start: date, end, gpa: opt, bullets }),
  project: z.object({ name: str, role: opt, url: opt, start: date, end, bullets, tech: list }),
  publication: z.object({ title: str, venue: opt, authors: opt, date, url: opt }),
  skill: z.object({ category: str, items: list }),
  certification: z.object({ name: str, issuer: opt, date, url: opt }),
  award: z.object({ title: str, issuer: opt, date, description: opt }),
  language: z.object({ name: str, level: opt }),
  custom: z.object({ section_title: str, title: str, subtitle: opt, date, bullets }),
} satisfies Record<Section, z.ZodType>

export type ItemData<S extends Section = Section> = z.infer<(typeof ItemDataSchemas)[S]>

export const LinkSchema = z.object({ label: z.string().trim(), url: z.string().trim().min(1) })
export const BasicsSchema = z.object({
  full_name: opt,
  headline: opt,
  email: opt,
  phone: opt,
  location: opt,
  links: z.array(LinkSchema).default([]),
  summary: opt,
})
export type Basics = z.infer<typeof BasicsSchema>
export const BASICS_FIELDS = ["full_name", "headline", "email", "phone", "location", "summary"] as const

export type ProfileItem = { id: string; section: Section; position: number; data: Record<string, unknown>; tags: string[] }

/** Parse stored data; null when it no longer matches the schema (render raw instead of crashing). */
export function safeItem<S extends Section>(section: S, data: unknown): ItemData<S> | null {
  const r = ItemDataSchemas[section].safeParse(data)
  return r.success ? (r.data as ItemData<S>) : null
}

// ---- display helpers (also used for duplicate detection) ----

type Any = Record<string, unknown>
const s = (v: unknown) => (typeof v === "string" ? v : "")

export function itemTitle(section: Section, d: Any): string {
  switch (section) {
    case "experience":
      return s(d.title)
    case "education":
      return s(d.school)
    case "project":
      return s(d.name)
    case "skill":
      return s(d.category)
    case "certification":
      return s(d.name)
    case "language":
      return s(d.name)
    default:
      return s(d.title)
  }
}

export function itemSubtitle(section: Section, d: Any): string {
  switch (section) {
    case "experience":
      return [s(d.company), s(d.location)].filter(Boolean).join(" · ")
    case "education":
      return [s(d.degree), s(d.field)].filter(Boolean).join(", ")
    case "project":
      return s(d.role)
    case "publication":
      return s(d.venue)
    case "skill":
      return Array.isArray(d.items) ? (d.items as string[]).join(", ") : ""
    case "certification":
    case "award":
      return s(d.issuer)
    case "language":
      return s(d.level)
    case "custom":
      return [s(d.section_title), s(d.subtitle)].filter(Boolean).join(" · ")
  }
}

const fmt = (v: string) => (v === "present" ? "nay" : /^\d{4}-\d{2}$/.test(v) ? `${v.slice(5)}/${v.slice(0, 4)}` : v)

export function itemDates(d: Any): string {
  const start = s(d.start)
  const endV = s(d.end)
  if (start || endV) return [start && fmt(start), endV && fmt(endV)].filter(Boolean).join(" – ")
  return s(d.date) ? fmt(s(d.date)) : ""
}
