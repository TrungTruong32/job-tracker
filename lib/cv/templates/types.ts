import type { CvLayout, DateFormat, ResolvedCv } from "../resolve"
import type { StyleBounds } from "../fit"

export type CvStyle = {
  font_size: number
  line_height: number
  margin_mm: number
  accent: string
  date_format: DateFormat
  show_qr: boolean
  qr_url?: string
}

export type TemplateKey = "mine" | "classic" | "harvard" | "serif" | "modern" | "compact" | "sidebar"

export type TemplateProps = { cv: ResolvedCv; style: CvStyle; qrDataUrl?: string | null }

export type TemplateDef = {
  key: TemplateKey
  label: string
  description: string
  nestProjects: boolean
  layout?: CvLayout
  defaults: CvStyle
  bounds: StyleBounds
}
