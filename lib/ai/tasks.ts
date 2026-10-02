import { z } from "zod"
import type { ChatMessage } from "./client"
import { CvFitSchema, JdSummarySchema } from "./parse"
import { buildExtractMessages, buildMatchMessages, buildParseCvMessages, buildPingMessages, buildShortenMessages } from "./prompts"

/** The AI jobs the app runs; same definitions on the server and in the browser (Ollama). */
export const AI_TASKS = {
  extract: {
    input: z.object({ jdText: z.string().trim().min(30, "JD quá ngắn để AI phân tích (cần ít nhất 30 ký tự)") }),
    messages: (i: { jdText: string }): ChatMessage[] => buildExtractMessages(i.jdText),
    output: JdSummarySchema,
  },
  match: {
    input: z.object({
      jdText: z.string().trim().min(30, "Đơn này chưa có nội dung JD để so sánh"),
      cvText: z.string().trim().min(50, "Bản CV chưa có nội dung text để so sánh"),
    }),
    messages: (i: { jdText: string; cvText: string }): ChatMessage[] => buildMatchMessages(i.jdText, i.cvText),
    output: CvFitSchema,
  },
  parse_cv: {
    input: z.object({ cvText: z.string().trim().min(200, "CV quá ngắn để phân tích (cần ít nhất 200 ký tự)") }),
    messages: (i: { cvText: string }): ChatMessage[] => buildParseCvMessages(i.cvText),
    // loose on purpose: lib/profile/normalize.ts validates each item and counts the rest as dropped
    output: z.object({ basics: z.record(z.string(), z.unknown()).optional(), items: z.array(z.unknown()) }),
  },
  shorten_bullets: {
    input: z.object({
      bullets: z.array(z.object({ id: z.string(), text: z.string().min(1) })).min(1).max(20),
      ratio: z.number().min(0.3).max(0.95),
    }),
    messages: (i: { bullets: { id: string; text: string }[]; ratio: number }): ChatMessage[] => buildShortenMessages(i.bullets, i.ratio),
    output: z.object({ bullets: z.array(z.object({ id: z.string(), text: z.string() })) }),
  },
  ping: {
    input: z.object({}),
    messages: (): ChatMessage[] => buildPingMessages(),
    output: z.object({ ok: z.unknown() }),
  },
} as const

export type AiTask = keyof typeof AI_TASKS
export type AiTaskInput<T extends AiTask> = z.infer<(typeof AI_TASKS)[T]["input"]>
export type AiTaskOutput<T extends AiTask> = z.infer<(typeof AI_TASKS)[T]["output"]>
