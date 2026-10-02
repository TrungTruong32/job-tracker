import type { Section } from "@/lib/profile/schema"

export type FieldType = "text" | "url" | "month" | "end" | "list" | "textarea"
export type Field = { key: string; label: string; type: FieldType; required?: boolean; placeholder?: string; wide?: boolean }

// Form layout per section; keys match lib/profile/schema.ts.
export const FIELDS: Record<Section, Field[]> = {
  experience: [
    { key: "title", label: "Chức danh", type: "text", required: true, placeholder: "AI Engineer" },
    { key: "company", label: "Công ty", type: "text", required: true },
    { key: "location", label: "Địa điểm", type: "text" },
    { key: "start", label: "Từ", type: "month" },
    { key: "end", label: "Đến", type: "end" },
    { key: "tech", label: "Công nghệ", type: "list", wide: true, placeholder: "Python, LangChain, vLLM" },
  ],
  education: [
    { key: "school", label: "Trường", type: "text", required: true },
    { key: "degree", label: "Bằng cấp", type: "text", placeholder: "BSc" },
    { key: "field", label: "Chuyên ngành", type: "text" },
    { key: "gpa", label: "GPA", type: "text" },
    { key: "start", label: "Từ", type: "month" },
    { key: "end", label: "Đến", type: "end" },
  ],
  project: [
    { key: "name", label: "Tên dự án", type: "text", required: true },
    { key: "role", label: "Vai trò", type: "text" },
    { key: "url", label: "Link", type: "url", wide: true },
    { key: "start", label: "Từ", type: "month" },
    { key: "end", label: "Đến", type: "end" },
    { key: "tech", label: "Công nghệ", type: "list", wide: true },
  ],
  publication: [
    { key: "title", label: "Tên bài", type: "text", required: true, wide: true },
    { key: "venue", label: "Hội nghị / tạp chí", type: "text", placeholder: "ExampleConf 2025" },
    { key: "date", label: "Năm", type: "month" },
    { key: "authors", label: "Tác giả", type: "text", wide: true },
    { key: "url", label: "Link", type: "url", wide: true },
  ],
  skill: [
    { key: "category", label: "Nhóm kỹ năng", type: "text", required: true, placeholder: "ML / AI" },
    { key: "items", label: "Kỹ năng", type: "list", wide: true, placeholder: "PyTorch, RAG, LangChain" },
  ],
  certification: [
    { key: "name", label: "Tên chứng chỉ", type: "text", required: true, wide: true },
    { key: "issuer", label: "Đơn vị cấp", type: "text" },
    { key: "date", label: "Ngày", type: "month" },
    { key: "url", label: "Link", type: "url", wide: true },
  ],
  award: [
    { key: "title", label: "Giải thưởng", type: "text", required: true, wide: true },
    { key: "issuer", label: "Đơn vị", type: "text" },
    { key: "date", label: "Ngày", type: "month" },
    { key: "description", label: "Mô tả", type: "textarea", wide: true },
  ],
  language: [
    { key: "name", label: "Ngôn ngữ", type: "text", required: true },
    { key: "level", label: "Trình độ", type: "text", placeholder: "IELTS 7.0" },
  ],
  custom: [
    { key: "section_title", label: "Tên mục", type: "text", required: true, placeholder: "Activities" },
    { key: "title", label: "Tiêu đề", type: "text", required: true },
    { key: "subtitle", label: "Phụ đề", type: "text" },
    { key: "date", label: "Thời gian", type: "month" },
  ],
}

export const HAS_BULLETS: Section[] = ["experience", "education", "project", "custom"]
