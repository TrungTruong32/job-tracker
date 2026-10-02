import type { AiProvider } from "./providers"

export type ModelInfo = { id: string; name: string; free: boolean | null; context: number | null }

type RawModel = {
  id?: unknown
  name?: unknown
  context_length?: unknown
  pricing?: { prompt?: unknown; completion?: unknown }
}

const isZero = (v: unknown) => v !== undefined && v !== null && Number(v) === 0

/** Normalize an OpenAI-style `GET /models` response; free models first. */
export function normalizeModels(provider: AiProvider, body: unknown): ModelInfo[] {
  const data = (body as { data?: unknown } | null)?.data
  if (!Array.isArray(data)) return []
  const out: ModelInfo[] = []
  for (const raw of data as RawModel[]) {
    if (typeof raw?.id !== "string" || !raw.id) continue
    let id = raw.id
    if (provider === "gemini") {
      id = id.replace(/^models\//, "")
      if (!id.startsWith("gemini")) continue // skip embedding / imagen / aqa models
    }
    const free =
      provider === "openrouter" ? (raw.pricing ? isZero(raw.pricing.prompt) && isZero(raw.pricing.completion) : id.endsWith(":free")) : null
    out.push({
      id,
      name: typeof raw.name === "string" && raw.name ? raw.name : id,
      free,
      context: typeof raw.context_length === "number" ? raw.context_length : null,
    })
  }
  return out.sort((a, b) => Number(b.free === true) - Number(a.free === true) || a.id.localeCompare(b.id))
}
