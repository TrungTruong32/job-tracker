import { describe, expect, it } from "vitest"
import { stripLatex } from "./strip-latex"

describe("stripLatex", () => {
  it("drops the preamble and document wrapper", () => {
    const src = "\\documentclass{article}\n\\usepackage{hyperref}\n\\begin{document}\nHello\n\\end{document}\n"
    expect(stripLatex(src)).toBe("Hello")
  })

  it("works without \\begin{document}", () => {
    expect(stripLatex("\\textbf{An} Nguyen")).toBe("An Nguyen")
  })

  it("keeps link text and url, even when nested", () => {
    expect(stripLatex("\\textbf{\\href{https://x.y}{Site}}")).toBe("Site (https://x.y)")
  })

  it("turns items into dashes and sections into headings", () => {
    const out = stripLatex("\\section{Experience}\n\\begin{itemize}\n\\item Built RAG\n\\item Fine-tuned\n\\end{itemize}")
    expect(out).toBe("## Experience\n- Built RAG\n- Fine-tuned")
  })

  it("removes comments but keeps escaped percent", () => {
    expect(stripLatex("Accuracy 94\\% % secret note\nNext")).toBe("Accuracy 94%\nNext")
  })

  it("drops layout-only commands and their arguments", () => {
    expect(stripLatex("A\\vspace{2mm}\\hfill B\\\\\nC")).toBe("A B\nC")
  })

  it("keeps the content of unknown formatting commands", () => {
    expect(stripLatex("\\resumeItem{Led team} and \\emph{shipped}")).toBe("Led team and shipped")
  })

  it("collapses blank lines", () => {
    expect(stripLatex("A\n\n\n\nB")).toBe("A\n\nB")
  })

  it("drops preamble commands when there is no \\begin{document}", () => {
    const src = String.raw`\hypersetup{colorlinks=true, urlcolor=blue}
\newcommand\resumeItem[1]{\item\small{#1}}
\def\x{y}
An Nguyen`
    expect(stripLatex(src)).toBe("An Nguyen")
  })

  it("skips the optional spacing after a line break", () => {
    expect(stripLatex(String.raw`A\\[4pt]B`)).toBe("A\nB")
  })

  it("drops tabular column specs", () => {
    expect(stripLatex(String.raw`\begin{tabular*}{\textwidth}[t]{l@{\extracolsep{\fill}}r}Acme & 2024\end{tabular*}`)).toBe("Acme 2024")
  })

  it("unescapes characters inside URLs", () => {
    expect(stripLatex(String.raw`\href{https://x.com/a\_b}{Site}`)).toBe("Site (https://x.com/a_b)")
  })
})
