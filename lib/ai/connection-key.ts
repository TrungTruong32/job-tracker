import "server-only"
import { decryptSecret } from "@/lib/crypto"
import { readAi } from "./settings"

const norm = (u: string) => u.trim().replace(/\/+$/, "")

/**
 * Key to use for a (possibly unsaved) connection: a freshly typed key, or the stored key of
 * `connectionId` — but only when the URL is still the one that key was saved with.
 */
export function keyForConnection(
  row: { ai_connections: unknown; ai_chain: unknown } | null,
  input: { baseUrl: string; connectionId?: string; apiKey?: string },
): string | null {
  const typed = input.apiKey?.trim()
  if (typed) return typed
  if (!input.connectionId || !process.env.AI_KEY_SECRET) return null
  const conn = readAi(row).connections.find((c) => c.id === input.connectionId)
  if (!conn?.key_enc || norm(conn.base_url) !== norm(input.baseUrl)) return null
  try {
    return decryptSecret(conn.key_enc, process.env.AI_KEY_SECRET)
  } catch {
    return null
  }
}
