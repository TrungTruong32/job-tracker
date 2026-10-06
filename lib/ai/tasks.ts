import { z } from "zod"
import type { ChatMessage } from "./client"
import { CvFitSchema, JdSummarySchema } from "./parse"
import {
  buildEmailMessages,
  buildExtractMessages,
  buildKeywordMessages,
  buildMatchMessages,
  buildParseCvMessages,
  buildPingMessages,
  buildShortenMessages,
  buildSuggestMessages,
} from "./prompts"

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
  extract_keywords: {
    input: z.object({ jdText: z.string().trim().min(30, "JD quá ngắn để phân tích (cần ít nhất 30 ký tự)") }),
    messages: (i: { jdText: string }): ChatMessage[] => buildKeywordMessages(i.jdText),
    output: z.object({
      keywords: z
        .array(
          z.object({
            term: z.string().trim().min(1).max(60),
            // clamped to what updateCvDocument accepts, so a chatty model cannot block autosave
            aliases: z.preprocess(
              (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, 10).map((x: string) => x.trim().slice(0, 60)) : []),
              z.array(z.string()),
            ),
            weight: z.preprocess(
              (v) => (typeof v === "string" && /required|must|mandatory|essential|core/i.test(v) ? "required" : "preferred"),
              z.enum(["required", "preferred"]),
            ),
            category: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 40) : "Khác"), z.string()),
          }),
        )
        .max(60),
    }),
  },
  suggest_edits: {
    input: z.object({
      jdSummary: z.string().max(4000),
      missing: z.array(z.string()).max(40),
      weak: z.array(z.string()).max(40),
      bullets: z.array(z.object({ id: z.string(), text: z.string().min(1) })).min(1).max(25),
      summary: z.string().max(3000).optional(),
    }),
    messages: (i: { jdSummary: string; missing: string[]; weak: string[]; bullets: { id: string; text: string }[]; summary?: string }): ChatMessage[] =>
      buildSuggestMessages(i),
    output: z.object({
      bullets: z
        .array(
          z.object({
            id: z.string(),
            text: z.string().min(1),
            reason: z.preprocess((v) => (typeof v === "string" ? v : ""), z.string()),
            keywords: z.preprocess((v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []), z.array(z.string())),
          }),
        )
        .default([]),
      summary: z.object({ text: z.string().min(1), reason: z.preprocess((v) => (typeof v === "string" ? v : ""), z.string()) }).nullable().optional(),
    }),
  },
  write_email: {
    input: z.object({
      jdText: z.string().trim().min(30, "Đơn này chưa có nội dung JD để viết email"),
      cvText: z.string().trim().min(50, "Bản CV chưa có nội dung text để viết email"),
      company: z.string().max(200),
      position: z.string().max(200),
      sender: z.object({
        full_name: z.string().max(200).nullish(),
        email: z.string().max(200).nullish(),
        phone: z.string().max(60).nullish(),
        links: z.array(z.object({ label: z.string().max(100), url: z.string().max(500) })).max(10).optional(),
      }),
      jdEmails: z.array(z.string().max(200)).max(20),
      language: z.enum(["auto", "vi", "en"]),
    }),
    messages: (i: Parameters<typeof buildEmailMessages>[0]): ChatMessage[] => buildEmailMessages(i),
    output: z.object({
      to: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().nullable()),
      to_name: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().nullable()),
      subject: z.preprocess((v) => (typeof v === "string" ? v.trim().slice(0, 300) : ""), z.string()),
      subject_from_jd: z.preprocess((v) => v === true || v === "true", z.boolean()),
      body: z.string().trim().min(1).max(20_000),
    }),
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
