import type { z } from "zod"
import { AiParseError, parseWith } from "./parse"

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string }
export type AiConfig = { baseUrl: string; apiKey: string | null; model: string }

/** input = bad request (stop); auth = wrong key (skip this connection); others may work on another model. */
export type AiErrorKind = "input" | "auth" | "quota" | "not_found" | "server" | "timeout" | "network" | "parse" | "unknown"

export class AiError extends Error {
  constructor(
    message: string,
    public kind: AiErrorKind = "unknown",
  ) {
    super(message)
    this.name = "AiError"
  }
}

const RETRY_REMINDER: ChatMessage = {
  role: "user",
  content: "Chỉ trả về đúng một object JSON hợp lệ theo schema đã nêu, không kèm giải thích hay markdown.",
}

function httpError(status: number, body: string): AiError {
  if (status === 401 || status === 403) return new AiError("API key không hợp lệ hoặc không có quyền dùng model này", "auth")
  if (status === 429) return new AiError("Hết quota / vượt giới hạn gọi API, thử lại sau hoặc đổi model", "quota")
  if (status === 404) return new AiError("Không tìm thấy model hoặc Base URL sai", "not_found")
  if (status >= 500) return new AiError(`Nhà cung cấp AI đang lỗi (${status})`, "server")
  return new AiError(`Nhà cung cấp AI báo lỗi ${status}: ${body.slice(0, 200)}`)
}

async function complete(
  cfg: AiConfig,
  messages: ChatMessage[],
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`
    const res = await fetchImpl(`${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: cfg.model, messages, temperature: 0.2 }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw httpError(res.status, await res.text().catch(() => ""))
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content
    if (typeof content !== "string") throw new AiParseError()
    return content
  } catch (e) {
    if (e instanceof AiError || e instanceof AiParseError) throw e
    if (e instanceof Error && e.name === "AbortError") {
      throw new AiError(`Quá thời gian chờ ${Math.round(timeoutMs / 1000)}s, thử lại hoặc đổi model nhanh hơn`, "timeout")
    }
    throw new AiError(`Không kết nối được tới nhà cung cấp AI: ${e instanceof Error ? e.message : String(e)}`, "network")
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Call an OpenAI-compatible /chat/completions endpoint and parse the reply as JSON.
 * A malformed reply gets exactly one retry with a "JSON only" reminder.
 */
export async function chatJson<T>(
  cfg: AiConfig,
  messages: ChatMessage[],
  schema: z.ZodType<T>,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 30_000
  const fetchImpl = opts.fetchImpl ?? fetch
  const first = await complete(cfg, messages, timeoutMs, fetchImpl)
  try {
    return parseWith(schema, first)
  } catch (e) {
    if (!(e instanceof AiParseError)) throw e
  }
  const second = await complete(
    cfg,
    [...messages, { role: "assistant", content: first }, RETRY_REMINDER],
    timeoutMs,
    fetchImpl,
  )
  try {
    return parseWith(schema, second)
  } catch {
    throw new AiError("AI trả về dữ liệu không đúng định dạng JSON (đã thử lại 1 lần). Thử model khác.", "parse")
  }
}
