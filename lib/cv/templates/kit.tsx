import { Link, Text, View } from "@react-pdf/renderer"
import type { Style } from "@react-pdf/types"
import { parseInline } from "../inline"
import type { ResolvedEntry, ResolvedSection } from "../resolve"
import type { CvStyle } from "./types"

// Building blocks shared by all templates. Sizes derive from the base font size so the
// auto-fit search (font_size / line_height / margin) scales every template consistently.

export type Theme = {
  font: "Arimo" | "Tinos"
  accent: string
  fs: number
  /** vertical rhythm unit */
  gap: number
  entryHeader: "inline" | "two-line"
  projectTitleAccent: boolean
  skills: "labeled-bullets" | "lines" | "chips"
  /** "overview": sample-cv details (education as bold bullets, skill lines end with ".") */
  layout?: "overview"
}

export function themeFrom(style: CvStyle, font: Theme["font"], overrides: Partial<Theme> = {}): Theme {
  return {
    font,
    accent: style.accent,
    fs: style.font_size,
    gap: style.font_size * 0.45 * (style.line_height / 1.2),
    entryHeader: "inline",
    projectTitleAccent: true,
    skills: "labeled-bullets",
    ...overrides,
  }
}

/** **bold** / *italic* / [link](url) text. */
export function Rich({ text, style }: { text: string; style?: Style }) {
  return (
    <Text style={style}>
      {parseInline(text).map((r, i) => {
        const s: Style = {}
        if (r.bold) s.fontWeight = 700
        if (r.italic) s.fontStyle = "italic"
        if (r.href)
          return (
            <Link key={i} src={r.href} style={{ ...s, color: "inherit", textDecoration: "underline" }}>
              {r.text}
            </Link>
          )
        return (
          <Text key={i} style={s}>
            {r.text}
          </Text>
        )
      })}
    </Text>
  )
}

// "overview" spacing is measured from sample-cv.pdf (LaTeX itemize: topsep, itemsep 0.5mm + parsep 1pt)
const ov = (t: Theme) => t.layout === "overview"
const sep = (t: Theme) => (ov(t) ? "   |   " : "  |  ") // \quad|\quad

export function Bullets({ items, t, top }: { items: { id: string; text: string }[]; t: Theme; top?: number }) {
  if (!items.length) return null
  return (
    <View style={{ marginTop: top ?? (ov(t) ? t.fs * 0.45 : t.gap * 0.3) }}>
      {items.map((b) => (
        <View key={b.id} style={{ flexDirection: "row", marginBottom: ov(t) ? t.fs * 0.24 : t.gap * 0.15 }} wrap={false}>
          <Text style={{ width: t.fs * 0.9 }}>•</Text>
          <Rich text={ov(t) ? b.text.replace(/ \| /g, sep(t)) : b.text} style={{ flex: 1 }} />
        </View>
      ))}
    </View>
  )
}

/** Left content + right-aligned dates on one line. */
export function Row({ left, right, style }: { left: React.ReactNode; right?: string; style?: Style }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", ...style }}>
      <View style={{ flex: 1, paddingRight: 6 }}>{left}</View>
      {right ? <Text style={{ textAlign: "right" }}>{right}</Text> : null}
    </View>
  )
}

const join = (parts: (string | undefined)[], sep = "  |  ") => parts.filter(Boolean).join(sep)

function SubProject({ e, t, first }: { e: ResolvedEntry; t: Theme; first: boolean }) {
  const f = e.fields
  return (
    <View style={{ marginTop: ov(t) ? (first ? 0 : t.fs * 0.2) : t.gap * 0.5 }}>
      <Row
        left={
          <Text>
            <Text style={{ fontWeight: 700, fontStyle: "italic", color: t.projectTitleAccent ? t.accent : undefined }}>{f.name}</Text>
            {e.tech.length ? <Text style={{ fontStyle: "italic" }}>{sep(t) + e.tech.join(", ")}</Text> : null}
            {f.url ? (
              <Text>
                {sep(t)}
                <Link src={f.url} style={{ color: "inherit", fontStyle: "italic", textDecoration: "underline" }}>
                  {f.link_label || "Link"}
                </Link>
              </Text>
            ) : null}
          </Text>
        }
        right={f.dates}
      />
      <Bullets items={e.bullets} t={t} />
    </View>
  )
}

function EntryHeader({ e, t }: { e: ResolvedEntry; t: Theme }) {
  const f = e.fields
  const bold = { fontWeight: 700 } as const
  switch (e.section) {
    case "experience":
      return t.entryHeader === "two-line" ? (
        <View>
          <Row left={<Text style={bold}>{f.company}</Text>} right={f.dates} />
          <Row left={<Text style={{ fontStyle: "italic" }}>{f.title}</Text>} right={f.location} />
        </View>
      ) : (
        <Row
          left={
            <Text>
              <Text style={bold}>{f.title}</Text>
              <Text>{sep(t)}</Text>
              <Text style={bold}>{f.company}</Text>
              {f.location ? <Text>{", " + f.location}</Text> : null}
            </Text>
          }
          right={f.dates}
        />
      )
    case "education":
      // degree / GPA / certifications are bullets (built in resolveCv)
      return <Row left={<Text style={bold}>{t.entryHeader === "inline" ? (f.school ?? "").toUpperCase() : f.school}</Text>} right={f.dates} />
    case "project":
      return (
        <Row
          left={
            <Text>
              <Text style={{ fontWeight: 700, color: t.projectTitleAccent ? t.accent : undefined }}>{f.name}</Text>
              {f.role ? <Text>{"  |  " + f.role}</Text> : null}
              {e.tech.length ? <Text style={{ fontStyle: "italic" }}>{"  |  " + e.tech.join(", ")}</Text> : null}
            </Text>
          }
          right={f.dates}
        />
      )
    case "publication":
      return (
        <Row
          left={
            <Text>
              {f.url ? (
                <Link src={f.url} style={{ color: "inherit", fontWeight: 700 }}>
                  {f.title}
                </Link>
              ) : (
                <Text style={bold}>{f.title}</Text>
              )}
              {f.venue ? <Text style={{ fontStyle: "italic" }}>{" — " + f.venue}</Text> : null}
              {f.authors ? <Text>{". " + f.authors}</Text> : null}
            </Text>
          }
          right={f.dates}
        />
      )
    case "certification":
    case "award":
      return (
        <Row
          left={
            <Text>
              <Text style={bold}>{f.name ?? f.title}</Text>
              {f.issuer ? <Text>{" — " + f.issuer}</Text> : null}
              {f.description ? <Text>{". " + f.description}</Text> : null}
            </Text>
          }
          right={f.dates}
        />
      )
    case "language":
      return (
        <Text>
          <Text style={bold}>{f.name}</Text>
          {f.level ? <Text style={{ fontStyle: "italic" }}>{` (${f.level})`}</Text> : null}
        </Text>
      )
    case "custom":
      return <Row left={<Text>{join([f.title, f.subtitle])}</Text>} right={f.dates} />
    default:
      return null
  }
}

function Skills({ s, t }: { s: ResolvedSection; t: Theme }) {
  if (t.skills === "chips")
    return (
      <View>
        {s.entries.map((e) => (
          <View key={e.id} style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginBottom: t.gap * 0.4 }}>
            <Text style={{ fontWeight: 700, marginRight: 4 }}>{e.fields.category}:</Text>
            {e.list.map((x) => (
              <Text key={x} style={{ backgroundColor: "#eef2f7", borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1, marginRight: 3, marginBottom: 2, fontSize: t.fs * 0.9 }}>
                <Rich text={x} />
              </Text>
            ))}
          </View>
        ))}
      </View>
    )
  if (t.skills === "lines")
    return (
      <View>
        {s.entries.map((e) => (
          <Text key={e.id} style={{ marginBottom: t.gap * 0.2 }}>
            <Text style={{ fontWeight: 700 }}>{e.fields.category}: </Text>
            <Rich text={e.list.join(", ")} />
          </Text>
        ))}
      </View>
    )
  const end = t.layout === "overview" ? "." : ""
  return <Bullets items={s.entries.map((e) => ({ id: e.id, text: `**${e.fields.category}:** ${e.list.join(", ")}${end}` }))} t={t} />
}



/** Body of one section (everything below its title). */
export function SectionBody({ s, t, summary }: { s: ResolvedSection; t: Theme; summary?: string }) {
  if (s.key === "summary") return summary ? <Rich text={summary} style={{ textAlign: "justify" }} /> : null
  if (s.key === "skill") return <Skills s={s} t={t} />
  if (s.key === "language" && t.skills !== "chips")
    return <Text>{s.entries.map((e) => e.fields.name + (e.fields.level ? ` (${e.fields.level})` : "")).join(", ")}</Text>
  return (
    <View>
      {s.entries.map((e, i) => (
        <View key={e.id} style={{ marginTop: i ? (ov(t) ? t.fs * 0.75 : t.gap * 0.8) : 0 }}>
          <EntryHeader e={e} t={t} />
          <Bullets
            top={ov(t) && e.section === "education" ? t.fs * 0.75 : undefined}
            items={e.bullets}
            t={t}
          />
          {e.children.map((c, j) => (
            <SubProject key={c.id} e={c} t={t} first={j === 0 && !e.bullets.length} />
          ))}
        </View>
      ))}
    </View>
  )
}

/** "label: value" pieces for the contact block; links show a short handle. */
export function contactParts(cv: { basics: { email?: string; phone?: string; location?: string; links: { label: string; url: string; text?: string }[] } }) {
  const short = (url: string) => {
    try {
      const u = new URL(url)
      const seg = u.pathname.split("/").filter(Boolean).pop()
      return seg ? decodeURIComponent(seg) : u.host.replace(/^www\./, "")
    } catch {
      return url
    }
  }
  const b = cv.basics
  return {
    plain: [
      b.phone && { label: "Phone", text: b.phone },
      b.email && { label: "Email", text: b.email, href: `mailto:${b.email}` },
      b.location && { label: "Location", text: b.location },
    ].filter(Boolean) as { label: string; text: string; href?: string }[],
    links: b.links.map((l) => ({ label: l.label || "Link", text: l.text || short(l.url), href: l.url })),
  }
}
