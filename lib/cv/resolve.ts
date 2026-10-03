import type { Basics, ProfileItem, Section } from "@/lib/profile/schema"

// A CV document stores references into the profile plus per-CV rewrites; resolveCv
// joins them into plain data that templates render.

export type DateFormat = "MMMM YYYY" | "MMM YYYY" | "MM/YYYY" | "YYYY"
export type CvSectionKey = Section | "summary"

export type CvItemRef = {
  item_id: string
  bullet_ids?: string[] | null // null/undefined = every bullet in profile order
  overrides?: Record<string, string>
  bullet_overrides?: Record<string, string>
}
export type CvSectionRef = { key: CvSectionKey; title?: string; visible: boolean; items: CvItemRef[] }
export type CvContent = { sections: CvSectionRef[]; summary_override?: string }

export type ResolvedBullet = { id: string; text: string; overridden: boolean }
export type ResolvedEntry = {
  id: string
  section: Section
  fields: Record<string, string> // text fields after overrides, plus `dates`
  bullets: ResolvedBullet[]
  tech: string[]
  list: string[] // skill items
  children: ResolvedEntry[] // sub-projects nested under an experience
}
export type ResolvedSection = { key: CvSectionKey; title: string; entries: ResolvedEntry[] }
export type ResolvedCv = {
  basics: Basics
  sections: ResolvedSection[]
  warnings: string[]
  /** sections the layout does not show (e.g. Publications in "overview") */
  omitted: { title: string; count: number }[]
}

/** "overview" = the owner's sample-cv.tex: only these sections, in this order. */
export type CvLayout = "overview"
export const OVERVIEW_SECTIONS: CvSectionKey[] = ["summary", "education", "experience", "skill"]

export const DEFAULT_TITLES: Record<CvSectionKey, string> = {
  summary: "Summary",
  experience: "Work Experience",
  education: "Education",
  project: "Projects",
  publication: "Publications",
  skill: "Skills",
  certification: "Certifications",
  award: "Awards",
  language: "Languages",
  custom: "Activities",
}

export const DEFAULT_ORDER: CvSectionKey[] = [
  "summary", "experience", "project", "education", "publication", "skill", "certification", "award", "language", "custom",
]

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

export function formatCvDate(v: string | undefined, fmt: DateFormat): string {
  if (!v) return ""
  if (v === "present") return "Present"
  const m = /^(\d{4})-(\d{2})$/.exec(v)
  if (!m) return v // "2024" or text we could not parse
  const [y, mm] = [m[1], +m[2]]
  switch (fmt) {
    case "MMMM YYYY":
      return `${MONTHS[mm - 1]} ${y}`
    case "MMM YYYY":
      return `${MONTHS[mm - 1].slice(0, 3)} ${y}`
    case "MM/YYYY":
      return `${m[2]}/${y}`
    case "YYYY":
      return y
  }
}

export function formatRange(start: string | undefined, end: string | undefined, fmt: DateFormat): string {
  return [formatCvDate(start, fmt), formatCvDate(end, fmt)].filter(Boolean).join(" - ")
}

const str = (v: unknown) => (typeof v === "string" ? v : "")

function resolveEntry(item: ProfileItem, ref: CvItemRef, fmt: DateFormat, warnings: string[]): ResolvedEntry {
  const d = item.data
  const fields: Record<string, string> = {}
  for (const [k, v] of Object.entries(d)) if (typeof v === "string") fields[k] = v
  Object.assign(fields, ref.overrides ?? {})
  fields.dates = "start" in d || "end" in d ? formatRange(str(d.start), str(d.end), fmt) : formatCvDate(str(d.date), fmt)

  const all = Array.isArray(d.bullets) ? (d.bullets as { id: string; text: string }[]).filter((b) => typeof b?.text === "string") : []
  const byId = new Map(all.map((b) => [b.id, b]))
  const chosen = ref.bullet_ids ? ref.bullet_ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : (warnings.push(`Bullet đã bị xoá khỏi hồ sơ (${item.id})`), []))) : all
  const bullets = chosen.map((b) => {
    const o = ref.bullet_overrides?.[b.id]
    return { id: b.id, text: o ?? b.text, overridden: o !== undefined && o !== b.text }
  })
  return {
    id: item.id,
    section: item.section,
    fields,
    bullets,
    tech: Array.isArray(d.tech) ? (d.tech as string[]) : [],
    list: Array.isArray(d.items) ? (d.items as string[]) : [],
    children: [],
  }
}

export function resolveCv(
  content: CvContent,
  profile: { basics: Basics; items: ProfileItem[] },
  opts: { dateFormat: DateFormat; nestProjects: boolean; layout?: CvLayout },
): ResolvedCv {
  const warnings: string[] = []
  const byId = new Map(profile.items.map((i) => [i.id, i]))
  const basics: Basics = { ...profile.basics, summary: content.summary_override ?? profile.basics.summary }

  let sections: ResolvedSection[] = content.sections
    .filter((s) => s.visible)
    .map((s) => ({
      key: s.key,
      title: s.title?.trim() || (opts.layout === "overview" && s.key === "skill" ? "Key Skills" : DEFAULT_TITLES[s.key]),
      entries: s.items.flatMap((ref) => {
        const item = byId.get(ref.item_id)
        if (!item) {
          warnings.push(`Một mục đã bị xoá khỏi hồ sơ (${ref.item_id})`)
          return []
        }
        return [resolveEntry(item, ref, opts.dateFormat, warnings)]
      }),
    }))

  if (opts.nestProjects) {
    const exps = new Map(sections.flatMap((s) => (s.key === "experience" ? s.entries : [])).map((e) => [e.id, e]))
    for (const s of sections) {
      if (s.key !== "project") continue
      s.entries = s.entries.filter((p) => {
        const parent = exps.get(str(byId.get(p.id)?.data.experience_id))
        if (!parent) return true
        parent.children.push(p)
        return false
      })
    }
  }

  let omitted: ResolvedCv["omitted"] = []
  if (opts.layout === "overview") [sections, omitted] = shapeOverview(sections)

  sections = sections.filter((s) => s.entries.length || (s.key === "summary" && basics.summary))
  return { basics, sections, warnings, omitted }
}

const certText = (c: ResolvedEntry) => [c.fields.name ?? c.fields.title, c.fields.issuer].filter(Boolean).join(" - ")

/** Fold certifications into Education and languages into Key Skills; drop every other section. */
function shapeOverview(sections: ResolvedSection[]): [ResolvedSection[], ResolvedCv["omitted"]] {
  const get = (k: CvSectionKey) => sections.find((s) => s.key === k)
  const edu = get("education")
  const certs = get("certification")?.entries ?? []
  const folded = new Set<CvSectionKey>()
  if (edu?.entries.length && certs.length) {
    edu.entries[0].fields.certifications = certs.map(certText).join(", ") + "."
    folded.add("certification")
  }
  const langs = get("language")?.entries ?? []
  if (langs.length) {
    let skill = get("skill")
    if (!skill) sections.push((skill = { key: "skill", title: "Key Skills", entries: [] }))
    skill.entries.push({
      id: "languages",
      section: "skill",
      fields: { category: "Languages", dates: "" },
      bullets: [],
      tech: [],
      list: langs.map((l) => (l.fields.level ? `${l.fields.name} *(${l.fields.level})*` : l.fields.name)),
      children: [],
    })
    folded.add("language")
  }
  const omitted = sections
    .filter((s) => !OVERVIEW_SECTIONS.includes(s.key) && !folded.has(s.key) && s.entries.length)
    .map((s) => ({ title: s.title, count: s.entries.length }))
  const kept = OVERVIEW_SECTIONS.flatMap((k) => sections.filter((s) => s.key === k))
  return [kept, omitted]
}

const ALWAYS: Section[] = ["skill", "language"]

/** A starting document: items carrying any of `tags` (all items when no tags), skills/languages always. */
export function contentFromTags(items: ProfileItem[], tags: string[]): CvContent {
  const want = new Set(tags.map((t) => t.toLowerCase()))
  const keep = (i: ProfileItem) => !want.size || ALWAYS.includes(i.section) || i.tags.some((t) => want.has(t))
  return {
    sections: DEFAULT_ORDER.map((key) => ({
      key,
      visible: true,
      items:
        key === "summary"
          ? []
          : items
              .filter((i) => i.section === key && keep(i))
              .sort((a, b) => a.position - b.position)
              .map((i) => ({ item_id: i.id, bullet_ids: null })),
    })),
  }
}
