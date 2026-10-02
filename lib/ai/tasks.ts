import { z } from "zod"
import type { ChatMessage } from "./client"
import { CvFitSchema, JdSummarySchema } from "./parse"
import { buildExtractMessages, buildMatchMessages, buildPingMessages } from "./prompts"

/** The AI jobs the app runs; same definitions on the server and in the browser (Ollama). */
export const AI_TASKS = {
  extract: {
    input: z.object({ jdText: z.string().trim().min(30, "JD quá ngắn để AI phân tích (cần ít nhất 30 ký tự)") }),
    messages: (i: { jdText: string }): ChatMessage[] => buildExtractMessages(i.jdText),
    output: JdSummarySchema,
    timeoutMs: 30_000,
  },
  match: {
    input: z.object({
      jdText: z.string().trim().min(30, "Đơn này chưa có nội dung JD để so sánh"),
      cvText: z.string().trim().min(50, "Bản CV chưa có nội dung text để so sánh"),
    }),
    messages: (i: { jdText: string; cvText: string }): ChatMessage[] => buildMatchMessages(i.jdText, i.cvText),
    output: CvFitSchema,
    timeoutMs: 30_000,
  },
  ping: {
    input: z.object({}),
    messages: (): ChatMessage[] => buildPingMessages(),
    output: z.object({ ok: z.unknown() }),
    timeoutMs: 20_000,
  },
} as const

export type AiTask = keyof typeof AI_TASKS
export type AiTaskInput<T extends AiTask> = z.infer<(typeof AI_TASKS)[T]["input"]>
export type AiTaskOutput<T extends AiTask> = z.infer<(typeof AI_TASKS)[T]["output"]>
