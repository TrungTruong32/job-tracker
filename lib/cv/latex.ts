import { parseInline } from "./inline"
import type { ResolvedCv, ResolvedEntry, ResolvedSection } from "./resolve"
import type { CvStyle, TemplateKey } from "./templates/types"

// .tex export. `mine` reproduces the structure of the owner's Overview.tex, `overview` that of
// sample-cv.tex (same look, education as bold bullets); `classic` is a Jake's-Resume-like layout. Both use only packages from Overview.tex so they compile on a
// stock TeX install (pdflatex, T1 + utf8).

const SPECIAL: [RegExp, string][] = [
  // emoji, dingbats and misc symbols have no glyph in the LaTeX fonts: drop them
  [/[\u2600-\u27BF\u2B00-\u2BFF\uFE0F]|[\u{1F000}-\u{1FAFF}]/gu, ""],
  [/\\/g, "\u0000BS\u0000"],
  [/([&%$#_{}])/g, "\\$1"],
  [/~/g, "$\\sim$"],
  [/\^/g, "\\textasciicircum{}"],
  [/\u0000BS\u0000/g, "\\textbackslash{}"],
  [/→/g, "$\\rightarrow$"],
  [/←/g, "$\\leftarrow$"],
  [/≥/g, "$\\geq$"],
  [/≤/g, "$\\leq$"],
  [/×/g, "$\\times$"],
  [/—/g, "---"],
  [/–/g, "--"],
  [/“/g, "``"],
  [/”/g, "''"],
  [/[’‘]/g, "'"],
]

export function escapeLatex(s: string): string {
  let out = s
  for (const [re, rep] of SPECIAL) out = out.replace(re, rep as string)
  return out
}

const escapeUrl = (u: string) => u.replace(/([%#&_])/g, "\\$1")

export function inlineToLatex(s: string): string {
  return parseInline(s)
    .map((r) => {
      let t = escapeLatex(r.text)
      if (r.href) t = `\\href{${escapeUrl(r.href)}}{\\underline{${t}}}`
      if (r.italic) t = `\\textit{${t}}`
      if (r.bold) t = `\\textbf{${t}}`
      return t
    })
    .join("")
}

const e = escapeLatex
const ITEMIZE = "\\begin{itemize}[leftmargin=*, itemsep=0.5mm, parsep=1pt, topsep=1mm]"

/** `exact`: the list exactly as sample-cv.tex writes it (`{}` only where a line starts with "["). */
function itemize(lines: string[], exact = false): string {
  if (!lines.length) return ""
  if (exact)
    return [ITEMIZE.replace(", topsep=1mm", ""), ...lines.map((l) => `    \\item${l.startsWith("[") ? "{}" : ""} ${l}`), "\\end{itemize}"].join("\n")
  return [ITEMIZE, ...lines.map((l) => `    \\item{} ${l}`), "\\end{itemize}"].join("\n")
}

type Flavor = "mine" | "overview" | "classic"

const projectLine = (c: ResolvedEntry) =>
  `\\cvproject{${e(c.fields.name ?? "")}}` +
  (c.tech.length ? ` \\quad|\\quad \\textit{${e(c.tech.join(", "))}}` : "") +
  (c.fields.url ? ` \\quad|\\quad \\href{${escapeUrl(c.fields.url)}}{\\textit{\\underline{${e(c.fields.link_label || "Link")}}}}` : "")

function entry(x: ResolvedEntry, flavor: Flavor): string {
  const f = x.fields
  const dates = e(f.dates ?? "")
  const exact = flavor === "overview"
  const bullets = () => itemize(x.bullets.map((b) => inlineToLatex(b.text)), exact)
  switch (x.section) {
    case "experience": {
      const head =
        flavor === "classic"
          ? `\\noindent\\textbf{${e(f.company ?? "")}} \\hfill ${dates}\\\\\n\\textit{${e(f.title ?? "")}} \\hfill \\textit{${e(f.location ?? "")}}`
          : `\\noindent\\textbf{${e(f.title ?? "")}} \\quad|\\quad \\textbf{${e(f.company ?? "")}} \\hfill ${dates}\\\\`
      const kids = x.children
        .map((c) => `${projectLine(c)}\n${itemize(c.bullets.map((b) => inlineToLatex(b.text)), exact)}`)
        .join("\n\\vspace{-1mm}%\n")
      return [head, bullets(), kids && exact ? `\\vspace{-1mm}%\n${kids}` : kids].filter(Boolean).join("\n")
    }
    case "education": {
      // degree / GPA / certifications are bullets (built in resolveCv); " | " is \quad|\quad as in sample-cv.tex
      const lines = x.bullets.map((b) => b.text.split(" | ").map(inlineToLatex).join(" \\quad|\\quad "))
      if (flavor === "overview") {
        const head = `\\noindent\\textbf{${e((f.school ?? "").toLocaleUpperCase("vi"))}} \\hfill ${dates}\\\\[1mm]`
        return [head, lines.length ? `\\vspace{-6mm}\n${itemize(lines, true)}` : ""].filter(Boolean).join("\n")
      }
      const school = flavor === "mine" ? e((f.school ?? "").toUpperCase()) : e(f.school ?? "")
      return [`\\noindent\\textbf{${school}} \\hfill ${dates}\\\\`, itemize(lines)].filter(Boolean).join("\n")
    }
    case "project":
      return `\\noindent${projectLine(x)} \\hfill ${dates}\n${bullets()}`
    case "publication": {
      const title = f.url ? `\\href{${escapeUrl(f.url)}}{\\textbf{${e(f.title ?? "")}}}` : `\\textbf{${e(f.title ?? "")}}`
      return `\\noindent ${title}${f.venue ? ` --- \\textit{${e(f.venue)}}` : ""}${f.authors ? `. ${e(f.authors)}` : ""} \\hfill ${dates}\\\\`
    }
    case "certification":
    case "award":
      return `\\noindent\\textbf{${e(f.name ?? f.title ?? "")}}${f.issuer ? ` --- ${e(f.issuer)}` : ""}${f.description ? `. ${e(f.description)}` : ""} \\hfill ${dates}\\\\`
    case "custom":
      return `\\noindent\\textbf{${e(f.title ?? "")}}${f.subtitle ? ` \\quad|\\quad ${e(f.subtitle)}` : ""} \\hfill ${dates}\\\\\n${bullets()}`
    default:
      return ""
  }
}

function section(s: ResolvedSection, cv: ResolvedCv, flavor: Flavor): string {
  const title = `\\cvsection{${e(flavor !== "classic" ? s.title.toLocaleUpperCase("vi") : s.title)}}`
  if (s.key === "summary") return `${title}\n${inlineToLatex(cv.basics.summary ?? "")}`
  if (s.key === "skill") return `${title}\n\\vspace{-3mm}\n${itemize(s.entries.map((x) => `\\textbf{${e(x.fields.category ?? "")}:} ${inlineToLatex(x.list.join(", "))}.`), flavor === "overview")}`
  if (s.key === "language") return `${title}\n${s.entries.map((x) => `${e(x.fields.name ?? "")}${x.fields.level ? ` \\textit{(${e(x.fields.level)})}` : ""}`).join(", ")}.`
  return `${title}\n${s.entries.map((x) => entry(x, flavor)).join("\n\\vspace{1mm}\n\n")}`
}

function shortHandle(url: string): string {
  try {
    const u = new URL(url)
    const seg = u.pathname.split("/").filter(Boolean).pop()
    return seg ? decodeURIComponent(seg) : u.host.replace(/^www\./, "")
  } catch {
    return url
  }
}

const PREAMBLE = (fontSize: number, marginIn: number, accent: string, sans: boolean) => `\\documentclass[${Math.round(fontSize) >= 11 ? 11 : 10}pt,a4paper]{article}

\\usepackage[utf8]{inputenc}
\\usepackage[T1,T5]{fontenc}
\\usepackage[left=${marginIn}in, right=${marginIn}in, top=${marginIn}in, bottom=${marginIn}in]{geometry}
\\usepackage{xcolor}
\\usepackage{hyperref}
\\usepackage{enumitem}
\\usepackage{graphicx}
${sans ? "\\usepackage{helvet}\n\\renewcommand{\\familydefault}{\\sfdefault}\n" : ""}\\pagestyle{empty}
\\usepackage{setspace}
\\setstretch{1.05}

\\definecolor{cvblue}{HTML}{${accent.replace("#", "").toUpperCase()}}
\\setlength{\\parindent}{0pt}
\\hypersetup{colorlinks=true, linkcolor=black, filecolor=black, urlcolor=black}
`

export function exportLatex(cv: ResolvedCv, style: CvStyle, template: TemplateKey): string {
  const flavor: Flavor = template === "classic" || template === "serif" ? "classic" : template === "harvard" ? "overview" : "mine"
  const marginIn = Math.round((style.margin_mm / 25.4) * 100) / 100
  const b = cv.basics
  const commands =
    flavor !== "classic"
      ? `\\newcommand{\\cvsection}[1]{
    \\vspace{1ex}
    \\noindent\\textbf{\\large\\color{cvblue} #1} \\textcolor{cvblue}{\\hrulefill}\\par
    \\vspace{1ex}
}
\\newcommand{\\cvproject}[1]{\\textcolor{cvblue}{\\textbf{\\textit{#1}}}}
`
      : `\\newcommand{\\cvsection}[1]{
    \\vspace{1.2ex}
    {\\large\\scshape #1}\\\\[-1.2ex]
    \\rule{\\linewidth}{0.4pt}\\par
    \\vspace{0.6ex}
}
\\newcommand{\\cvproject}[1]{\\textbf{#1}}
`
  const plain = [
    b.phone && `\\textbf{Phone:} ${e(b.phone)}`,
    b.email && `\\textbf{Email:} \\href{mailto:${escapeUrl(b.email)}}{${e(b.email)}}`,
    b.location && `\\textbf{Location:} ${e(b.location)}`,
  ].filter(Boolean)
  const links = b.links.map((l) => `\\textbf{${e(l.label || "Link")}:} \\href{${escapeUrl(l.url)}}{\\underline{${e(l.text || shortHandle(l.url))}}}`)
  const qr = flavor !== "classic" && style.show_qr
  const header =
    flavor !== "classic"
      ? `\\noindent
\\begin{minipage}[t]{\\textwidth}
    \\centering
    {\\Huge \\textbf{${e(b.full_name ?? "")}}}\\\\[1.5mm]
    ${b.headline ? `{\\Large \\textbf{${e(b.headline.toUpperCase())}}}\\\\[2mm]` : ""}
    \\small{
        ${[plain.join(" \\quad|\\quad "), links.join(" \\quad|\\quad ")].filter(Boolean).join(" \\\\\n        ")}
    }
\\end{minipage}
${
  qr
    ? `
% QR code: put a qrcode.png next to this file (e.g. generated from your portfolio link)
\\vspace{-2.35cm}
\\hfill
\\begin{minipage}[t]{0.18\\textwidth}
    \\raggedleft
    \\IfFileExists{qrcode.png}{\\includegraphics[width=2.02cm]{qrcode.png}\\\\
    \\scriptsize \\textbf{Portfolio QR Code}}{}
\\end{minipage}
`
    : ""
}
\\vspace{0.4cm}`
      : `\\begin{center}
    {\\Huge \\textbf{${e(b.full_name ?? "")}}}\\\\[1mm]
    ${b.headline ? `\\textit{${e(b.headline)}}\\\\[1mm]` : ""}
    \\small ${[...plain, ...links].join(" \\quad|\\quad ")}
\\end{center}`

  return `${PREAMBLE(style.font_size, marginIn, style.accent, flavor !== "classic")}
${commands}
\\begin{document}

${header}

${cv.sections.map((s) => section(s, cv, flavor)).join("\n\n")}

\\end{document}
`
}
