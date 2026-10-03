import { Document, Image, Link, Page, Text, View } from "@react-pdf/renderer"
import type { Style } from "@react-pdf/types"
import { A4_H, A4_W, MM, TALL_H } from "../measure"
import type { ResolvedCv, ResolvedSection } from "../resolve"
import { contactParts, SectionBody, themeFrom, type Theme } from "./kit"
import type { CvStyle, TemplateKey } from "./types"

type HeaderKind = "mine" | "centered" | "band"
type TitleKind = "upper-rule" | "smallcaps-rule" | "center-upper" | "accent-bar"

const CONFIG: Record<Exclude<TemplateKey, "sidebar">, { font: Theme["font"]; header: HeaderKind; title: TitleKind; theme?: Partial<Theme> }> = {
  mine: { font: "Arimo", header: "mine", title: "upper-rule" },
  compact: { font: "Arimo", header: "mine", title: "upper-rule" },
  classic: { font: "Tinos", header: "centered", title: "smallcaps-rule", theme: { entryHeader: "two-line", projectTitleAccent: false, skills: "lines" } },
  harvard: { font: "Arimo", header: "mine", title: "upper-rule", theme: { layout: "overview" } },
  serif: { font: "Tinos", header: "centered", title: "center-upper", theme: { entryHeader: "two-line", projectTitleAccent: false, skills: "lines" } },
  modern: { font: "Arimo", header: "band", title: "accent-bar", theme: { skills: "chips" } },
}

function SectionTitle({ title, kind, t }: { title: string; kind: TitleKind; t: Theme }) {
  const base: Style =
    t.layout === "overview"
      ? { fontWeight: 700, marginTop: t.fs * 0.84, marginBottom: t.fs * 0.48 } // measured from sample-cv.pdf
      : { fontWeight: 700, marginTop: t.gap * 1.2, marginBottom: t.gap * 0.6 }
  switch (kind) {
    case "upper-rule":
      return (
        <View style={{ ...base, flexDirection: "row", alignItems: "center" }} wrap={false}>
          <Text style={{ color: t.accent, fontSize: t.fs * 1.2, lineHeight: 1.2 }}>{title.toUpperCase()}</Text>
          <View style={{ flex: 1, borderBottomWidth: 0.8, borderBottomColor: t.accent, marginLeft: 4, marginTop: t.fs * 0.3 }} />
        </View>
      )
    case "smallcaps-rule":
      return (
        <View style={{ ...base, borderBottomWidth: 0.6, borderBottomColor: "#000", paddingBottom: 1 }} wrap={false}>
          <Text style={{ fontSize: t.fs * 1.15, letterSpacing: 0.6 , lineHeight: 1.2 }}>{title.toUpperCase()}</Text>
        </View>
      )
    case "center-upper":
      return (
        <View style={{ ...base, borderBottomWidth: 0.6, borderBottomColor: "#000", paddingBottom: 1 }} wrap={false}>
          <Text style={{ fontSize: t.fs * 1.05, textAlign: "center", letterSpacing: 1 , lineHeight: 1.2 }}>{title.toUpperCase()}</Text>
        </View>
      )
    case "accent-bar":
      return (
        <View style={{ ...base, flexDirection: "row", alignItems: "center" }} wrap={false}>
          <View style={{ width: 3, height: t.fs * 1.1, backgroundColor: t.accent, marginRight: 5 }} />
          <Text style={{ fontSize: t.fs * 1.15, color: t.accent , lineHeight: 1.2 }}>{title}</Text>
        </View>
      )
  }
}

function Contact({ cv, t, labeled, align = "center", color }: { cv: ResolvedCv; t: Theme; labeled: boolean; align?: "center" | "left"; color?: string }) {
  const c = contactParts(cv)
  const line = (parts: { label: string; text: string; href?: string }[], underline: boolean) =>
    parts.length ? (
      <Text style={{ textAlign: align, fontSize: t.fs * 0.9, color }}>
        {parts.map((p, i) => (
          <Text key={i}>
            {i ? "   |   " : ""}
            {labeled ? <Text style={{ fontWeight: 700 }}>{p.label}: </Text> : null}
            {p.href ? (
              <Link src={p.href} style={{ color: color ?? "inherit", textDecoration: underline ? "underline" : "none" }}>
                {p.text}
              </Link>
            ) : (
              p.text
            )}
          </Text>
        ))}
      </Text>
    ) : null
  return labeled ? (
    <View>
      {line(c.plain, false)}
      {line(c.links, true)}
    </View>
  ) : (
    line([...c.plain, ...c.links], false)
  )
}

function Header({ cv, kind, t, qr }: { cv: ResolvedCv; kind: HeaderKind; t: Theme; qr?: string | null }) {
  const b = cv.basics
  if (kind === "band")
    return (
      <View style={{ backgroundColor: t.accent, color: "#fff", padding: t.fs * 1.2, marginBottom: t.gap, borderRadius: 3 }}>
        <Text style={{ fontSize: t.fs * 2.2, fontWeight: 700 , lineHeight: 1.2 }}>{b.full_name}</Text>
        {b.headline ? <Text style={{ fontSize: t.fs * 1.2, marginTop: 2 , lineHeight: 1.2 }}>{b.headline}</Text> : null}
        <View style={{ marginTop: t.gap * 0.6 }}>
          <Contact cv={cv} t={t} labeled={false} align="left" color="#fff" />
        </View>
      </View>
    )
  if (kind === "centered")
    return (
      <View style={{ marginBottom: t.gap * 0.4 }}>
        <Text style={{ fontSize: t.fs * 2.1, fontWeight: 700, textAlign: "center" , lineHeight: 1.2 }}>{b.full_name}</Text>
        {b.headline ? <Text style={{ textAlign: "center", fontStyle: "italic", marginBottom: 2 }}>{b.headline}</Text> : null}
        <Contact cv={cv} t={t} labeled={false} />
      </View>
    )
  // "mine": centered name + uppercase headline + labeled contact lines, QR at the right
  const qrSize = 57 // ~2.02cm, as in Overview.tex
  return (
    <View style={{ position: "relative", minHeight: qr ? qrSize + t.fs : undefined, marginBottom: t.gap * 0.2 }}>
      <View style={{ paddingHorizontal: qr ? qrSize * 0.9 : 0 }}>
        <Text style={{ fontSize: t.fs * 2.4, fontWeight: 700, textAlign: "center" , lineHeight: 1.2 }}>{b.full_name}</Text>
        {b.headline ? <Text style={{ fontSize: t.fs * 1.45, fontWeight: 700, textAlign: "center", marginBottom: t.gap * 0.5 , lineHeight: 1.2 }}>{b.headline.toUpperCase()}</Text> : null}
        <Contact cv={cv} t={t} labeled />
      </View>
      {qr ? (
        <View style={{ position: "absolute", right: 0, top: 0, alignItems: "flex-end" }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- React-PDF's Image has no alt; the caption below names it */}
          <Image src={qr} style={{ width: qrSize, height: qrSize }} />
          <Text style={{ fontSize: t.fs * 0.6, fontWeight: 700 }}>Portfolio QR Code</Text>
        </View>
      ) : null}
    </View>
  )
}

function Sections({ cv, t, title, sections }: { cv: ResolvedCv; t: Theme; title: TitleKind; sections: ResolvedSection[] }) {
  return (
    <>
      {sections.map((s) => (
        <View key={s.key}>
          <SectionTitle title={s.title} kind={title} t={t} />
          <SectionBody s={s} t={t} summary={cv.basics.summary} />
        </View>
      ))}
    </>
  )
}

const SIDE_KEYS = new Set(["skill", "language", "certification", "award"])

function Sidebar({ cv, style }: { cv: ResolvedCv; style: CvStyle }) {
  const t = themeFrom(style, "Arimo", { skills: "lines" })
  const side = cv.sections.filter((s) => SIDE_KEYS.has(s.key))
  const main = cv.sections.filter((s) => !SIDE_KEYS.has(s.key))
  const c = contactParts(cv)
  return (
    <View style={{ flexDirection: "row" }}>
      <View style={{ width: "31%", paddingRight: t.fs * 1.2, borderRightWidth: 0.6, borderRightColor: "#cbd5e1" }}>
        <Text style={{ fontSize: t.fs * 2, fontWeight: 700, color: t.accent , lineHeight: 1.2 }}>{cv.basics.full_name}</Text>
        {cv.basics.headline ? <Text style={{ fontWeight: 700, marginTop: 2 }}>{cv.basics.headline}</Text> : null}
        <View style={{ marginTop: t.gap }}>
          {[...c.plain, ...c.links].map((p, i) => (
            <Text key={i} style={{ fontSize: t.fs * 0.9, marginBottom: 2 }}>
              <Text style={{ fontWeight: 700 }}>{p.label}: </Text>
              {p.href ? (
                <Link src={p.href} style={{ color: "inherit" }}>
                  {p.text}
                </Link>
              ) : (
                p.text
              )}
            </Text>
          ))}
        </View>
        <Sections cv={cv} t={t} title="accent-bar" sections={side} />
      </View>
      <View style={{ flex: 1, paddingLeft: t.fs * 1.2 }}>
        <Sections cv={cv} t={t} title="upper-rule" sections={main} />
      </View>
    </View>
  )
}

/** The CV as a React-PDF document. `tall` renders one 3xA4-high page for measuring. */
export function CvPdf({ cv, style, template, qrDataUrl, tall }: { cv: ResolvedCv; style: CvStyle; template: TemplateKey; qrDataUrl?: string | null; tall?: boolean }) {
  const font = template === "sidebar" ? "Arimo" : CONFIG[template].font
  const margin = style.margin_mm * MM
  const pageStyle: Style = {
    fontFamily: font,
    fontSize: style.font_size,
    lineHeight: style.line_height,
    paddingTop: margin,
    paddingBottom: margin,
    paddingHorizontal: margin,
    color: "#111",
  }
  return (
    <Document title={`${cv.basics.full_name ?? "CV"}`} author={cv.basics.full_name} creator="Job Tracker">
      <Page size={tall ? [A4_W, TALL_H] : [A4_W, A4_H]} style={pageStyle}>
        {template === "sidebar" ? (
          <Sidebar cv={cv} style={style} />
        ) : (
          (() => {
            const cfg = CONFIG[template]
            const t = themeFrom(style, cfg.font, cfg.theme)
            return (
              <>
                <Header cv={cv} kind={cfg.header} t={t} qr={style.show_qr ? qrDataUrl : null} />
                <Sections cv={cv} t={t} title={cfg.title} sections={cv.sections} />
              </>
            )
          })()
        )}
      </Page>
    </Document>
  )
}
