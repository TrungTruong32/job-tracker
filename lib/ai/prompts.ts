import type { ChatMessage } from "./client"

const MAX_CHARS = 12_000

const clip = (s: string) => (s.length > MAX_CHARS ? s.slice(0, MAX_CHARS) + "\n…(đã cắt bớt)" : s)

export function buildExtractMessages(jdText: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Bạn trích xuất thông tin từ tin tuyển dụng (JD). Trả về DUY NHẤT một object JSON:
{
  "company": string | null,
  "position": string | null,
  "salary": string | null,        // giữ nguyên cách ghi trong JD, null nếu không có
  "location": string | null,
  "seniority": string | null,     // Intern/Fresher/Junior/Middle/Senior/Lead...
  "required_skills": string[],    // kỹ năng/công nghệ bắt buộc, ngắn gọn
  "nice_to_have": string[],
  "summary": string               // 2-4 câu tiếng Việt tóm tắt công việc
}
Không bịa thông tin không có trong JD.`,
    },
    { role: "user", content: clip(jdText) },
  ]
}

export function buildMatchMessages(jdText: string, cvText: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Bạn là chuyên gia tuyển dụng. So sánh CV với JD và trả về DUY NHẤT một object JSON:
{
  "score": number,             // 0-100, mức phù hợp tổng thể
  "matched_skills": string[],  // yêu cầu trong JD mà CV đáp ứng
  "missing_skills": string[],  // yêu cầu trong JD mà CV thiếu hoặc không thể hiện
  "suggestions": string[]      // 2-5 gợi ý tiếng Việt: nên nhấn mạnh/chỉnh gì trong CV hoặc chuẩn bị gì khi phỏng vấn
}
Chấm khách quan, dựa trên bằng chứng trong CV.`,
    },
    { role: "user", content: `# JD\n${clip(jdText)}\n\n# CV\n${clip(cvText)}` },
  ]
}

export function buildPingMessages(): ChatMessage[] {
  return [{ role: "user", content: 'Trả về đúng JSON: {"ok": true}' }]
}

const CV_MAX_CHARS = 15_000

export function buildParseCvMessages(cvText: string): ChatMessage[] {
  const text = cvText.length > CV_MAX_CHARS ? cvText.slice(0, CV_MAX_CHARS) + "\n…(truncated)" : cvText
  return [
    {
      role: "system",
      content: `You convert a CV/resume into structured JSON. Return ONLY one JSON object:
{
  "basics": { "full_name", "headline", "email", "phone", "location", "summary": string|null, "links": [{"label","url"}] },
  "items": [ { "section": <section>, "data": <fields for that section> } ]
}
Sections and their data fields (dates as "MMM YYYY" or "YYYY", end may be "Present"):
- "experience": company, title, location, start, end, bullets: string[], tech: string[]
- "education": school, degree, field, specialization, start, end, gpa, bullets: string[]
- "project": name, role, url, link_label (the visible text of the link, e.g. "Paper link"), start, end, bullets: string[], tech: string[], parent_company (when the project is listed under a job, the company of that job)
- "publication": title, venue, authors, date, url
- "skill": category, items: string[]   (one item per skill group as written in the CV)
- "certification": name, issuer, date, url
- "award": title, issuer, date, description
- "language": name, level
- "custom": section_title, title, subtitle, date, bullets: string[]   (anything else, e.g. activities)
Rules: copy bullet text verbatim (no rewriting, no invented facts); keep emphasis as **bold** / *italic* and links as [text](url) when visible; keep the CV's original order; omit fields that are absent.`,
    },
    { role: "user", content: text },
  ]
}

/** Shorten CV bullets to about `ratio` of their length, keeping facts, numbers and markup. */
export function buildShortenMessages(bullets: { id: string; text: string }[], ratio: number): ChatMessage[] {
  return [
    {
      role: "system",
      content: `You tighten CV bullet points so the CV fits on one page. Rewrite each bullet to about ${Math.round(ratio * 100)}% of its length.
Keep every number, metric and named technology; keep **bold** / *italic* / [text](url) markup on the same facts; start with a strong verb; no new facts.
Return ONLY JSON: {"bullets": [{"id": <same id>, "text": <shorter bullet>}]} with the same ids in the same order.`,
    },
    { role: "user", content: JSON.stringify({ bullets }) },
  ]
}

export function buildKeywordMessages(jdText: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: `You extract ATS keywords from a job description. Return ONLY JSON:
{"keywords": [{"term": string, "aliases": string[], "weight": "required" | "preferred", "category": string}]}
- at most 40 keywords; each term 1-4 words, as it would appear on a CV (e.g. "PyTorch", "RAG", "CI/CD", "stakeholder management")
- aliases: abbreviations / full forms / common variants ("LLM" <-> "large language model", "K8s" <-> "Kubernetes"); [] if none
- weight "required" for must-haves / core responsibilities, "preferred" for nice-to-have / bonus
- category: short group name (Language, Framework, Cloud, AI/ML, Data, Soft skill, Domain...)
- skip generic words (team, work, experience, years) and benefits.`,
    },
    { role: "user", content: jdText.length > 12_000 ? jdText.slice(0, 12_000) : jdText },
  ]
}

export function buildSuggestMessages(input: {
  jdSummary: string
  missing: string[]
  weak: string[]
  bullets: { id: string; text: string }[]
  summary?: string
}): ChatMessage[] {
  return [
    {
      role: "system",
      content: `You improve CV bullets for a specific job. Return ONLY JSON:
{"bullets": [{"id": <same id>, "text": <improved bullet>, "reason": <short reason in Vietnamese>, "keywords": string[]}], "summary": {"text": string, "reason": string} | null}
Rules:
- Never invent facts, numbers, tools or responsibilities. Only rephrase what the bullet already says.
- Add a missing/weak keyword ONLY when the bullet already describes that work (e.g. "deployed containers to the cluster" -> "Kubernetes" is OK only if the bullet implies it).
- Start with a strong past-tense verb, keep it to about 2 lines, keep **bold** / *italic* / [text](url) markup and every number.
- Return only bullets you actually improved (none is fine). "keywords" = JD keywords the new text now contains.
- summary: rewrite the CV summary for this job with the same facts (or null if no summary was given).`,
    },
    { role: "user", content: JSON.stringify(input) },
  ]
}
