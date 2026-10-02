"use client"

import type { PublicSettings } from "@/lib/data/types"
import { AiError, chatJson } from "./client"
import { CvFitSchema, JdSummarySchema, type CvFit, type JdSummary } from "./parse"
import { buildExtractMessages, buildMatchMessages, buildPingMessages } from "./prompts"
import { isBrowserProvider } from "./providers"
import { z } from "zod"

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  } catch {
    throw new AiError("Mất kết nối tới server")
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new AiError((data as { error?: string }).error ?? `Lỗi ${res.status}`)
  return data as T
}

function ollamaConfig(s: PublicSettings) {
  if (!s.ai_base_url || !s.ai_model) throw new AiError("Chưa cấu hình Base URL / model cho Ollama trong Cài đặt")
  return { baseUrl: s.ai_base_url, model: s.ai_model, apiKey: null }
}

function wrapOllama(e: unknown): never {
  if (e instanceof AiError && e.message.startsWith("Không kết nối")) {
    throw new AiError(
      "Không gọi được Ollama trên máy này. Kiểm tra Ollama đang chạy và OLLAMA_ORIGINS cho phép domain của app.",
    )
  }
  throw e
}

/** Hosted providers go through our server (key stays there); Ollama is called from the browser. */
export async function aiExtractJd(settings: PublicSettings, jdText: string): Promise<JdSummary> {
  if (isBrowserProvider(settings.ai_provider)) {
    return chatJson(ollamaConfig(settings), buildExtractMessages(jdText), JdSummarySchema).catch(wrapOllama)
  }
  return postJson("/api/ai/extract", { jdText })
}

export async function aiMatchCv(settings: PublicSettings, jdText: string, cvText: string): Promise<CvFit> {
  if (isBrowserProvider(settings.ai_provider)) {
    return chatJson(ollamaConfig(settings), buildMatchMessages(jdText, cvText), CvFitSchema).catch(wrapOllama)
  }
  return postJson("/api/ai/match", { jdText, cvText })
}

export async function aiTestConnection(input: {
  provider: PublicSettings["ai_provider"]
  baseUrl: string
  model: string
  apiKey?: string
}): Promise<{ ms: number }> {
  if (isBrowserProvider(input.provider)) {
    const started = performance.now()
    await chatJson({ baseUrl: input.baseUrl, model: input.model, apiKey: null }, buildPingMessages(), z.object({ ok: z.unknown() }), {
      timeoutMs: 20_000,
    }).catch(wrapOllama)
    return { ms: Math.round(performance.now() - started) }
  }
  return postJson("/api/ai/test", { baseUrl: input.baseUrl, model: input.model, apiKey: input.apiKey || undefined })
}
