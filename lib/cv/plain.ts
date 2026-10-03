import { plainText } from "./inline"
import type { ResolvedCv, ResolvedEntry } from "./resolve"

// Plain-text rendering of a resolved CV: stored as a CV version's text so "So với CV" works.

function entryLines(e: ResolvedEntry, indent = ""): string[] {
  const f = e.fields
  const dates = f.dates ? ` (${f.dates})` : ""
  let head: string
  switch (e.section) {
    case "experience":
      head = `${f.title} | ${f.company}${dates}`
      break
    case "education":
      head = `${f.school}${dates}` // degree / GPA are bullets
      break
    case "project":
      head = `${f.name}${e.tech.length ? ` | ${e.tech.join(", ")}` : ""}${dates}`
      break
    case "skill":
      head = `${f.category}: ${e.list.join(", ")}`
      break
    case "language":
      head = `${f.name}${f.level ? ` (${f.level})` : ""}`
      break
    default:
      head = [f.title ?? f.name, f.venue ?? f.issuer ?? f.subtitle].filter(Boolean).join(" — ") + dates
  }
  return [
    indent + head,
    ...e.bullets.map((b) => `${indent}- ${plainText(b.text)}`),
    ...e.children.flatMap((c) => entryLines(c, indent + "  ")),
  ]
}

export function cvToPlainText(cv: ResolvedCv): string {
  const b = cv.basics
  const out = [b.full_name, b.headline, [b.email, b.phone, b.location, ...b.links.map((l) => l.url)].filter(Boolean).join(" | ")].filter(Boolean) as string[]
  for (const s of cv.sections) {
    out.push("", s.title.toUpperCase())
    if (s.key === "summary") out.push(plainText(b.summary ?? ""))
    else for (const e of s.entries) out.push(...entryLines(e))
  }
  return out.join("\n")
}
