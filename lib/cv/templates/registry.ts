import type { CvStyle, TemplateDef, TemplateKey } from "./types"

// Template metadata only (no React-PDF import) so the editor UI can list templates cheaply.
export const TEMPLATES: Record<TemplateKey, TemplateDef> = {
  mine: {
    key: "mine",
    label: "CV của bạn",
    description: "Theo Overview.tex: tên giữa, QR, tiêu đề mục in hoa màu nhấn, dự án lồng trong công ty",
    defaults: { font_size: 10, line_height: 1.25, margin_mm: 12.7, accent: "#1F4E79", date_format: "MMMM YYYY", show_qr: true },
    bounds: { font_size: [8.5, 11], line_height: [1.05, 1.4], margin_mm: [9, 16] },
  },
  classic: {
    key: "classic",
    label: "Classic",
    description: "Kiểu Jake's Resume: serif, gọn, 2 dòng tiêu đề cho mỗi kinh nghiệm",
    defaults: { font_size: 10.5, line_height: 1.2, margin_mm: 12, accent: "#111111", date_format: "MMM YYYY", show_qr: false },
    bounds: { font_size: [9, 11.5], line_height: [1.05, 1.4], margin_mm: [9, 16] },
  },
  harvard: {
    key: "harvard",
    label: "Harvard (Overview)",
    description: "Đúng bố cục sample-cv: chỉ Summary, Education, Work Experience, Key Skills; chứng chỉ gộp vào Education, ngoại ngữ gộp vào Key Skills",
    defaults: { font_size: 10, line_height: 1.25, margin_mm: 12.7, accent: "#1F4E79", date_format: "MMMM YYYY", show_qr: true },
    bounds: { font_size: [8.5, 11], line_height: [1.05, 1.4], margin_mm: [9, 16] },
  },
  serif: {
    key: "serif",
    label: "Serif cổ điển",
    description: "Serif kinh điển, tiêu đề mục căn giữa in hoa",
    defaults: { font_size: 11, line_height: 1.2, margin_mm: 15, accent: "#111111", date_format: "MMM YYYY", show_qr: false },
    bounds: { font_size: [9.5, 12], line_height: [1.05, 1.4], margin_mm: [10, 20] },
  },
  modern: {
    key: "modern",
    label: "Modern",
    description: "Header dải màu, kỹ năng dạng chip, thoáng",
    defaults: { font_size: 10, line_height: 1.3, margin_mm: 13, accent: "#2a78d6", date_format: "MMM YYYY", show_qr: false },
    bounds: { font_size: [8.5, 11], line_height: [1.1, 1.5], margin_mm: [9, 18] },
  },
  compact: {
    key: "compact",
    label: "Compact",
    description: "Như 'CV của bạn' nhưng cỡ chữ và khoảng cách tối thiểu",
    defaults: { font_size: 9, line_height: 1.15, margin_mm: 10, accent: "#1F4E79", date_format: "MMM YYYY", show_qr: false },
    bounds: { font_size: [8, 10], line_height: [1.0, 1.3], margin_mm: [8, 13] },
  },
  sidebar: {
    key: "sidebar",
    label: "Hai cột",
    description: "Cột trái: liên hệ, kỹ năng, ngôn ngữ, chứng chỉ; cột phải: nội dung chính",
    defaults: { font_size: 9.5, line_height: 1.25, margin_mm: 11, accent: "#1F4E79", date_format: "MMM YYYY", show_qr: false },
    bounds: { font_size: [8, 10.5], line_height: [1.05, 1.4], margin_mm: [8, 15] },
  },
}

export const TEMPLATE_KEYS = Object.keys(TEMPLATES) as TemplateKey[]

/** Style after switching template: settings the user never changed follow the new template's defaults. */
export function switchTemplateStyle(from: TemplateKey, to: TemplateKey, style: CvStyle): CvStyle {
  const a = TEMPLATES[from].defaults
  const b = TEMPLATES[to].defaults
  const pick = <K extends keyof CvStyle>(k: K) => (style[k] === a[k] ? b[k] : style[k])
  return clampStyle(to, {
    ...style,
    font_size: pick("font_size"),
    line_height: pick("line_height"),
    margin_mm: pick("margin_mm"),
    accent: pick("accent"),
    date_format: pick("date_format"),
    show_qr: pick("show_qr"),
  })
}

export function clampStyle<T extends { font_size: number; line_height: number; margin_mm: number }>(key: TemplateKey, s: T): T {
  const b = TEMPLATES[key].bounds
  const c = (v: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, v))
  return { ...s, font_size: c(s.font_size, b.font_size), line_height: c(s.line_height, b.line_height), margin_mm: c(s.margin_mm, b.margin_mm) }
}
