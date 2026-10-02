import { z } from "zod"

export class AiParseError extends Error {
  constructor(message = "AI trả về dữ liệu không đúng định dạng JSON") {
    super(message)
    this.name = "AiParseError"
  }
}

const strList = z.preprocess(
  (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : []),
  z.array(z.string()),
)
const optStr = z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().nullable())

export const JdSummarySchema = z.object({
  company: optStr,
  position: optStr,
  salary: optStr,
  location: optStr,
  seniority: optStr,
  required_skills: strList,
  nice_to_have: strList,
  summary: z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string()),
})
export type JdSummary = z.infer<typeof JdSummarySchema>

export const CvFitSchema = z.object({
  score: z.preprocess((v) => {
    const n = typeof v === "string" ? Number(v.replace("%", "").trim()) : v
    return typeof n === "number" && Number.isFinite(n) ? Math.round(Math.min(100, Math.max(0, n))) : v
  }, z.number()),
  matched_skills: strList,
  missing_skills: strList,
  suggestions: strList,
})
export type CvFit = z.infer<typeof CvFitSchema>

/** Stored form of a fit result: the AI output plus which CV it was scored against. */
export type StoredCvFit = CvFit & { cv_version_id: string | null; evaluated_at: string }

/** Pull the first balanced JSON object out of a model reply (fences, chatter tolerated). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{")
  if (start < 0) throw new AiParseError()
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === "\\") esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === "{") depth++
    else if (c === "}" && --depth === 0) {
      try {
        return JSON.parse(text.slice(start, i + 1))
      } catch {
        throw new AiParseError()
      }
    }
  }
  throw new AiParseError()
}

export function parseWith<T>(schema: z.ZodType<T>, text: string): T {
  const r = schema.safeParse(extractJson(text))
  if (!r.success) throw new AiParseError()
  return r.data
}
