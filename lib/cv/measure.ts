// One-page rule: render the CV on a very tall page (A4 width, 3 x A4 height), find the lowest
// line of text, and express the used height as a fraction of one A4 page.

export const A4_W = 595.28
export const A4_H = 841.89
export const TALL_H = A4_H * 3
export const MM = 72 / 25.4

export type Fill = { used: number; pages: number; overflowPct: number }

/** `lines`: text baselines (y from the bottom, pdf.js convention) with their font height. */
export function computeFill(lines: { y: number; h: number }[], pageHeight: number, bottomMarginPt: number): Fill {
  if (!lines.length) return { used: 0, pages: 1, overflowPct: 0 }
  const lowest = Math.min(...lines.map((l) => l.y - 0.25 * l.h)) // include descenders
  const used = (pageHeight - lowest + bottomMarginPt) / A4_H
  return { used, pages: Math.max(1, Math.ceil(used - 1e-6)), overflowPct: Math.max(0, used - 1) }
}

/** Measure a tall-page PDF (works in the browser and in Node). */
export async function measurePdf(bytes: Uint8Array, bottomMarginPt: number): Promise<Fill> {
  const { getDocumentProxy } = await import("unpdf")
  const pdf = await getDocumentProxy(bytes)
  const page = await pdf.getPage(1)
  const { height } = page.getViewport({ scale: 1 })
  const tc = await page.getTextContent()
  const lines: { y: number; h: number }[] = []
  for (const it of tc.items as { str?: string; transform?: number[]; height?: number }[]) {
    if (it.str?.trim() && it.transform) lines.push({ y: it.transform[5], h: it.height ?? 10 })
  }
  return computeFill(lines, height, bottomMarginPt)
}
