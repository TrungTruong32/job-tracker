"use client"

import { createElement, useCallback, useEffect, useRef, useState } from "react"
import { MM, type Fill } from "@/lib/cv/measure"
import type { ResolvedCv } from "@/lib/cv/resolve"
import type { CvStyle, TemplateKey } from "@/lib/cv/templates/types"

// Renders the CV in the browser: the A4 PDF (preview + export) and a tall single page (measure).
// Heavy libraries load on first use.

type Engine = {
  pdf: typeof import("@react-pdf/renderer").pdf
  CvPdf: typeof import("@/lib/cv/templates/document").CvPdf
  measurePdf: typeof import("@/lib/cv/measure").measurePdf
  getDocumentProxy: typeof import("unpdf").getDocumentProxy
  qr: (url: string) => Promise<string>
}

let enginePromise: Promise<Engine> | null = null
function engine(): Promise<Engine> {
  enginePromise ??= (async () => {
    const [rp, doc, measure, fonts, unpdf, qrcode] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/lib/cv/templates/document"),
      import("@/lib/cv/measure"),
      import("@/lib/cv/templates/fonts"),
      import("unpdf"),
      import("qrcode"),
    ])
    fonts.registerFonts(`${location.origin}/fonts`)
    return {
      pdf: rp.pdf,
      CvPdf: doc.CvPdf,
      measurePdf: measure.measurePdf,
      getDocumentProxy: unpdf.getDocumentProxy,
      qr: (url) => qrcode.toDataURL(url, { margin: 0, width: 300 }),
    }
  })()
  return enginePromise
}

export type RenderInput = { cv: ResolvedCv; style: CvStyle; template: TemplateKey; qrUrl: string | null }

async function renderBlob(e: Engine, input: RenderInput, tall: boolean): Promise<Blob> {
  const qr = input.style.show_qr && input.qrUrl ? await e.qr(input.qrUrl) : null
  return e.pdf(createElement(e.CvPdf, { cv: input.cv, style: input.style, template: input.template, qrDataUrl: qr, tall }) as never).toBlob()
}

/** Used page fraction for a style (for the auto-fit search). */
export async function measureStyle(input: RenderInput): Promise<Fill> {
  const e = await engine()
  const blob = await renderBlob(e, input, true)
  return e.measurePdf(new Uint8Array(await blob.arrayBuffer()), input.style.margin_mm * MM)
}

export async function renderPdfBlob(input: RenderInput): Promise<Blob> {
  return renderBlob(await engine(), input, false)
}

async function pageImages(e: Engine, blob: Blob): Promise<string[]> {
  const pdf = await e.getDocumentProxy(new Uint8Array(await blob.arrayBuffer()))
  const out: string[] = []
  const scale = Math.min(2.5, (window.devicePixelRatio || 1) * 1.4)
  for (let n = 1; n <= Math.min(pdf.numPages, 3); n++) {
    const page = await pdf.getPage(n)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport, canvas } as never).promise
    out.push(canvas.toDataURL("image/png"))
  }
  return out
}

/** Debounced live render: preview images + one-page measurement. */
export function useCvRender(input: RenderInput, delay = 600) {
  const [pages, setPages] = useState<string[]>([])
  const [fill, setFill] = useState<Fill | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const run = useRef(0)
  const key = JSON.stringify(input)

  const render = useCallback(async (inp: RenderInput) => {
    const id = ++run.current
    setBusy(true)
    try {
      const e = await engine()
      const [a4, tall] = await Promise.all([renderBlob(e, inp, false), renderBlob(e, inp, true)])
      const [imgs, f] = await Promise.all([pageImages(e, a4), e.measurePdf(new Uint8Array(await tall.arrayBuffer()), inp.style.margin_mm * MM)])
      if (id !== run.current) return // a newer render started
      setPages(imgs)
      setFill(f)
      setError(null)
    } catch (err) {
      if (id === run.current) setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (id === run.current) setBusy(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => render(JSON.parse(key) as RenderInput), delay)
    return () => clearTimeout(t)
  }, [key, delay, render])

  return { pages, fill, busy, error }
}
