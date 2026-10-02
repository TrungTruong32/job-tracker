import { execFileSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { escapeLatex, exportLatex, inlineToLatex } from "./latex"
import { contentFromTags, resolveCv } from "./resolve"
import { TEMPLATES } from "./templates/registry"
import { SAMPLE_BASICS, SAMPLE_ITEMS } from "./templates/sample"

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

describe("inlineToLatex", () => {
  it("converts markup", () => {
    expect(inlineToLatex("Built **~120K rows** for *16 brands* — [paper](https://dl.acm.org/x_1%20y)")).toBe(
      String.raw`Built \textbf{$\sim$120K rows} for \textit{16 brands} --- \href{https://dl.acm.org/x\_1\%20y}{\underline{paper}}`,
    )
  })
})

const cvFor = (key: "mine" | "classic") => {
  const def = TEMPLATES[key]
  return resolveCv(contentFromTags(SAMPLE_ITEMS, []), { basics: SAMPLE_BASICS, items: SAMPLE_ITEMS }, { dateFormat: def.defaults.date_format, nestProjects: def.nestProjects })
}

describe("exportLatex", () => {
  it("mine follows Overview.tex structure", () => {
    const tex = exportLatex(cvFor("mine"), TEMPLATES.mine.defaults, "mine")
    expect(tex).toContain("\\documentclass[10pt,a4paper]{article}")
    expect(tex).toContain("\\definecolor{cvblue}{HTML}{1F4E79}")
    expect(tex).toContain("\\cvsection{Work Experience}")
    expect(tex).toContain("\\cvproject{Order Sync Pipeline \\& Nightly Backfill}")
    expect(tex).toContain("\\textbf{$\\sim$120K validated rows}")
    expect(tex).toContain("\\includegraphics[width=2.02cm]{qrcode.png}")
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

  it.skipIf(!pdflatex).each(["mine", "classic"] as const)("%s compiles with pdflatex", (key) => {
    const dir = mkdtempSync(join(tmpdir(), "cvtex-"))
    const tex = exportLatex(cvFor(key), { ...TEMPLATES[key].defaults, show_qr: false }, key)
    writeFileSync(join(dir, "cv.tex"), tex)
    execFileSync("pdflatex", ["-interaction=nonstopmode", "-halt-on-error", "cv.tex"], { cwd: dir, stdio: "pipe", timeout: 120_000 })
  }, 150_000)
})
