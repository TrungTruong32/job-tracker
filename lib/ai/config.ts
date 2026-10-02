import { decryptSecret } from "@/lib/crypto"
import type { AiConfig } from "./client"

type AiSettingsRow = {
  ai_provider: string
  ai_base_url: string | null
  ai_model: string | null
  ai_api_key_encrypted: string | null
}

/** Usable AI config from stored settings, or null when AI isn't set up yet. */
export function resolveAiConfig(row: AiSettingsRow | null, secretB64: string | undefined): AiConfig | null {
  if (!row) return null
  const baseUrl = row.ai_base_url?.trim()
  const model = row.ai_model?.trim()
  if (!baseUrl || !model) return null

  let apiKey: string | null = null
  if (row.ai_api_key_encrypted && secretB64) {
    try {
      apiKey = decryptSecret(row.ai_api_key_encrypted, secretB64)
    } catch {
      apiKey = null
    }
  }
  if (!apiKey && row.ai_provider !== "ollama") return null
  return { baseUrl, apiKey, model }
}
