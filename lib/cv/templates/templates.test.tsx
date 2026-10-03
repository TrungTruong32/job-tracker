import { renderToBuffer } from "@react-pdf/renderer"
import { beforeAll, describe, expect, it } from "vitest"
import { getDocumentProxy } from "unpdf"
import { measurePdf } from "../measure"
import { contentFromTags, resolveCv } from "../resolve"
import { CvPdf } from "./document"
import { registerFonts } from "./fonts"
import { TEMPLATE_KEYS, TEMPLATES } from "./registry"
import { SAMPLE_BASICS, SAMPLE_ITEMS } from "./sample"
import { SAMPLE_CV_BASICS, SAMPLE_CV_ITEMS, sampleCvContent } from "./sample-cv"

beforeAll(() => registerFonts("public/fonts"))

const build = (key: (typeof TEMPLATE_KEYS)[number], repeat = 1) => {
  const def = TEMPLATES[key]
  const items = Array.from({ length: repeat }, (_, r) => SAMPLE_ITEMS.map((i) => ({ ...i, id: `${i.id}-${r}`, data: { ...i.data, ...(i.data.experience_id ? { experience_id: `${i.data.experience_id}-${r}` } : {}) } }))).flat()
  const cv = resolveCv(contentFromTags(items, []), { basics: SAMPLE_BASICS, items }, { dateFormat: def.defaults.date_format, nestProjects: def.nestProjects, layout: def.layout })
  return { cv, style: def.defaults }
}

describe("harvard (overview) with the sample-cv content", () => {
  it("fits on one A4 page like the original", async () => {
    const def = TEMPLATES.harvard
    const cv = resolveCv(sampleCvContent(), { basics: SAMPLE_CV_BASICS, items: SAMPLE_CV_ITEMS }, { dateFormat: def.defaults.date_format, nestProjects: def.nestProjects, layout: def.layout })
    const pdf = await renderToBuffer(<CvPdf cv={cv} style={def.defaults} template="harvard" />)
    expect((await getDocumentProxy(new Uint8Array(pdf))).numPages).toBe(1)
  }, 30_000)
})

describe.each(TEMPLATE_KEYS)("template %s", (key) => {
  it("renders the sample on one A4 page and the measurement agrees", async () => {
    const { cv, style } = build(key)
    const pdf = await renderToBuffer(<CvPdf cv={cv} style={style} template={key} />)
    const pages = (await getDocumentProxy(new Uint8Array(pdf))).numPages
    const tall = await renderToBuffer(<CvPdf cv={cv} style={style} template={key} tall />)
    const fill = await measurePdf(new Uint8Array(tall), style.margin_mm * (72 / 25.4))
    expect(pages).toBe(1)
    expect(fill.pages).toBe(1)
    expect(fill.used).toBeGreaterThan(0.3)
  }, 30_000)

  it("detects overflow for three times the content", async () => {
    const { cv, style } = build(key, 3)
    const pdf = await renderToBuffer(<CvPdf cv={cv} style={style} template={key} />)
    const pages = (await getDocumentProxy(new Uint8Array(pdf))).numPages
    const tall = await renderToBuffer(<CvPdf cv={cv} style={style} template={key} tall />)
    const fill = await measurePdf(new Uint8Array(tall), style.margin_mm * (72 / 25.4))
    expect(pages).toBeGreaterThan(1)
    expect(fill.pages).toBe(pages)
  }, 30_000)
})
