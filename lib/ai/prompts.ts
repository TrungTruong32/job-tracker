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
