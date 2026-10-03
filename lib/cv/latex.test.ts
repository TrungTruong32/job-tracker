import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { escapeLatex, exportLatex, inlineToLatex } from "./latex"
import { contentFromTags, resolveCv } from "./resolve"
import { TEMPLATES } from "./templates/registry"
import { SAMPLE_BASICS, SAMPLE_ITEMS } from "./templates/sample"
import { SAMPLE_CV_BASICS, SAMPLE_CV_ITEMS, sampleCvContent } from "./templates/sample-cv"

describe("escapeLatex", () => {
  it("escapes every special character", () => {
    expect(escapeLatex(String.raw`a & b % c $ d # e _ f { g } h ~9 ^ i \ j`)).toBe(
      String.raw`a \& b \% c \$ d \# e \_ f \{ g \} h $\sim$9 \textasciicircum{} i \textbackslash{} j`,
    )
  })
  it("maps symbols pdflatex cannot take directly", () => {
    expect(escapeLatex("A → B ≥ 3 × 2 “q” it’s")).toBe("A $\\rightarrow$ B $\\geq$ 3 $\\times$ 2 ``q'' it's")
  })
})

describe("escapeLatex extras", () => {
  it("drops emoji and pictographs pdflatex cannot typeset", () => {
    expect(escapeLatex("Shipped ✓ fast 🚀 ★")).toBe("Shipped  fast  ")
  })
})

describe("inlineToLatex", () => {
  it("converts markup", () => {
    expect(inlineToLatex("Built **~120K rows** for *16 brands* — [paper](https://dl.acm.org/x_1%20y)")).toBe(
      String.raw`Built \textbf{$\sim$120K rows} for \textit{16 brands} --- \href{https://dl.acm.org/x\_1\%20y}{\underline{paper}}`,
    )
  })
})

const cvFor = (key: "mine" | "classic" | "harvard") => {
  const def = TEMPLATES[key]
  return resolveCv(contentFromTags(SAMPLE_ITEMS, []), { basics: SAMPLE_BASICS, items: SAMPLE_ITEMS }, { dateFormat: def.defaults.date_format, nestProjects: def.nestProjects, layout: def.layout })
}

describe("harvard (overview) export", () => {
  // body of a .tex without comments/blank lines, whitespace collapsed
  const body = (tex: string) =>
    tex
      .slice(tex.indexOf("\\cvsection{"), tex.indexOf("\\end{document}"))
      .split("\n")
      .map((l) => l.replace(/(?<!\\)%.*$/, "").replace(/\s+/g, " ").trim())
      .filter(Boolean)

  it("reproduces sample-cv.tex from the same content", () => {
    const def = TEMPLATES.harvard
    const cv = resolveCv(sampleCvContent(), { basics: SAMPLE_CV_BASICS, items: SAMPLE_CV_ITEMS }, { dateFormat: def.defaults.date_format, nestProjects: def.nestProjects, layout: def.layout })
    const tex = exportLatex(cv, def.defaults, "harvard")
    const ref = readFileSync("test/fixtures/sample-cv.tex", "utf8")
    // only difference: section titles are uppercased in JS (\uppercase breaks on UTF-8)
    expect(body(tex)).toEqual(body(ref).map((l) => l.replace(/^\\cvsection\{(.*)\}$/, (_, t: string) => `\\cvsection{${t.toUpperCase()}}`)))
    expect(tex).toContain(String.raw`\textbf{Web Portfolio:} \href{https://an-nguyen.example.com/my\_portfolio/}{\underline{portfolio\_an}}`)
    expect(tex).toContain(String.raw`{\Large \textbf{PRODUCT ENGINEER -- APPLIED AI}}`)
  })
})

describe("exportLatex", () => {
  it("mine follows Overview.tex structure", () => {
    const tex = exportLatex(cvFor("mine"), TEMPLATES.mine.defaults, "mine")
    expect(tex).toContain("\\documentclass[10pt,a4paper]{article}")
    expect(tex).toContain("\\definecolor{cvblue}{HTML}{1F4E79}")
    expect(tex).toContain("\\cvsection{WORK EXPERIENCE}") // uppercased in JS: \uppercase breaks on UTF-8
    expect(tex).toContain("\\cvproject{Order Sync Pipeline \\& Nightly Backfill}")
    expect(tex).toContain("\\textbf{$\\sim$120K validated rows}")
    expect(tex).toContain("\\includegraphics[width=2.02cm]{qrcode.png}")
  })

  it("only includes the QR image when the file exists", () => {
    const tex = exportLatex(cvFor("mine"), TEMPLATES.mine.defaults, "mine")
    expect(tex).toContain(String.raw`\IfFileExists{qrcode.png}`)
  })

  it("keeps bullets that start with a bracket as bullets", () => {
    const cv = cvFor("mine")
    cv.sections.find((s) => s.key === "experience")!.entries[0].children[0].bullets[0].text = "[Lead] did things"
    expect(exportLatex(cv, TEMPLATES.mine.defaults, "mine")).toContain(String.raw`\item{} [Lead] did things`)
  })

  it("omits the QR when disabled", () => {
    const tex = exportLatex(cvFor("mine"), { ...TEMPLATES.mine.defaults, show_qr: false }, "mine")
    expect(tex).not.toContain("qrcode.png")
  })

  const pdflatex = (() => {
    try {
      execFileSync("pdflatex", ["--version"], { stdio: "ignore" })
      return true
    } catch {
      return false
    }
  })()

  // Vietnamese letters, a Vietnamese section title, and a header with links only
  const vietnamese = (key: "mine" | "classic" | "harvard") => {
    const cv = cvFor(key)
    cv.basics = { full_name: "Nguyễn Minh An", headline: "Kỹ sư AI", links: [{ label: "GitHub", url: "https://github.com/x_y" }] }
    cv.sections[0].title = "Kinh nghiệm làm việc"
    cv.sections.find((s) => s.key === "education")!.entries[0].fields.school = "Đại học Khoa học Tự nhiên, Đà Nẵng"
    return cv
  }

  it.skipIf(!pdflatex).each(["mine", "classic", "harvard"] as const)("%s compiles with pdflatex (Vietnamese, links-only header, QR on)", (key) => {
    const dir = mkdtempSync(join(tmpdir(), "cvtex-"))
    const tex = exportLatex(vietnamese(key), TEMPLATES[key].defaults, key)
    writeFileSync(join(dir, "cv.tex"), tex)
    execFileSync("pdflatex", ["-interaction=nonstopmode", "-halt-on-error", "cv.tex"], { cwd: dir, stdio: "pipe", timeout: 120_000 })
  }, 150_000)
})
