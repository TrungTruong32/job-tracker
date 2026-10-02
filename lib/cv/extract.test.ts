import { describe, expect, it } from "vitest"
import { MAX_CV_BYTES, cvTypeOf, extractCvText } from "./extract"

// Minimal one-page PDF with the text "An Nguyen AI Engineer" (pdf.js repairs the xref).
function tinyPdf(text: string): Uint8Array {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`
  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${stream.length} >> stream
${stream}
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
trailer << /Root 1 0 R >>
%%EOF`
  return new TextEncoder().encode(pdf)
}

describe("cvTypeOf", () => {
  it("accepts .pdf and .tex case-insensitively", () => {
    expect(cvTypeOf("CV.PDF")).toBe("pdf")
    expect(cvTypeOf("resume.v3.tex")).toBe("tex")
  })
  it("rejects anything else", () => {
    expect(cvTypeOf("cv.docx")).toBeNull()
    expect(cvTypeOf("pdf")).toBeNull()
  })
})

describe("extractCvText", () => {
  it("reads text from a PDF", async () => {
    const r = await extractCvText(tinyPdf("An Nguyen AI Engineer"), "pdf")
    expect(r.text).toContain("An Nguyen AI Engineer")
  })

  it("strips LaTeX from a .tex file", async () => {
    const src = new TextEncoder().encode("\\documentclass{article}\\begin{document}\\textbf{An} Nguyen\\end{document}")
    const r = await extractCvText(src, "tex")
    expect(r.text).toBe("An Nguyen")
  })

  it("flags too-little text (e.g. a scanned PDF)", async () => {
    const r = await extractCvText(tinyPdf("Hi"), "pdf")
    expect(r.tooShort).toBe(true)
  })

  it("rejects files over 5MB", async () => {
    await expect(extractCvText(new Uint8Array(MAX_CV_BYTES + 1), "tex")).rejects.toThrow(/5MB/)
  })

  it("reports an unreadable PDF clearly", async () => {
    await expect(extractCvText(new TextEncoder().encode("not a pdf"), "pdf")).rejects.toThrow(/Không đọc được file PDF/)
  })
})
