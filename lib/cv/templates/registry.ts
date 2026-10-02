import type { TemplateDef, TemplateKey } from "./types"

// Template metadata only (no React-PDF import) so the editor UI can list templates cheaply.
export const TEMPLATES: Record<TemplateKey, TemplateDef> = {
  mine: {
    key: "mine",
    label: "CV của bạn",
    description: "Theo Overview.tex: tên giữa, QR, tiêu đề mục in hoa màu nhấn, dự án lồng trong công ty",
    nestProjects: true,
    defaults: { font_size: 10, line_height: 1.25, margin_mm: 12.7, accent: "#1F4E79", date_format: "MMMM YYYY", show_qr: true },
    bounds: { font_size: [8.5, 11], line_height: [1.05, 1.4], margin_mm: [9, 16] },
  },
  classic: {
    key: "classic",
    label: "Classic",
    description: "Kiểu Jake's Resume: serif, gọn, 2 dòng tiêu đề cho mỗi kinh nghiệm",
    nestProjects: false,
    defaults: { font_size: 10.5, line_height: 1.2, margin_mm: 12, accent: "#111111", date_format: "MMM YYYY", show_qr: false },
    bounds: { font_size: [9, 11.5], line_height: [1.05, 1.4], margin_mm: [9, 16] },
  },
  harvard: {
    key: "harvard",
    label: "Harvard",
    description: "Serif kinh điển, tiêu đề mục căn giữa in hoa",
    nestProjects: false,
    defaults: { font_size: 11, line_height: 1.2, margin_mm: 15, accent: "#111111", date_format: "MMM YYYY", show_qr: false },
    bounds: { font_size: [9.5, 12], line_height: [1.05, 1.4], margin_mm: [10, 20] },
  },
  modern: {
    key: "modern",
    label: "Modern",
    description: "Header dải màu, kỹ năng dạng chip, thoáng",
    nestProjects: true,
    defaults: { font_size: 10, line_height: 1.3, margin_mm: 13, accent: "#2a78d6", date_format: "MMM YYYY", show_qr: false },
    bounds: { font_size: [8.5, 11], line_height: [1.1, 1.5], margin_mm: [9, 18] },
  },
  compact: {
    key: "compact",
    label: "Compact",
    description: "Như 'CV của bạn' nhưng cỡ chữ và khoảng cách tối thiểu",
    nestProjects: true,
    defaults: { font_size: 9, line_height: 1.15, margin_mm: 10, accent: "#1F4E79", date_format: "MMM YYYY", show_qr: false },
    bounds: { font_size: [8, 10], line_height: [1.0, 1.3], margin_mm: [8, 13] },
  },
  sidebar: {
    key: "sidebar",
    label: "Hai cột",
    description: "Cột trái: liên hệ, kỹ năng, ngôn ngữ, chứng chỉ; cột phải: nội dung chính",
    nestProjects: true,
    defaults: { font_size: 9.5, line_height: 1.25, margin_mm: 11, accent: "#1F4E79", date_format: "MMM YYYY", show_qr: false },
    bounds: { font_size: [8, 10.5], line_height: [1.05, 1.4], margin_mm: [8, 15] },
  },
}

export const TEMPLATE_KEYS = Object.keys(TEMPLATES) as TemplateKey[]

export function clampStyle<T extends { font_size: number; line_height: number; margin_mm: number }>(key: TemplateKey, s: T): T {
  const b = TEMPLATES[key].bounds
  const c = (v: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, v))
  return { ...s, font_size: c(s.font_size, b.font_size), line_height: c(s.line_height, b.line_height), margin_mm: c(s.margin_mm, b.margin_mm) }
}
