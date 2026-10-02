const norm = (u: string | null | undefined) => (u ?? "").trim().replace(/\/+$/, "")

/**
 * What to do with the stored API key on save. A key is only ever sent to the
 * endpoint it was saved for, so changing the base URL without a new key drops it.
 */
export function nextKeyAction(
  stored: { ai_base_url: string | null; has_key: boolean },
  input: { baseUrl: string | null; apiKey: string | undefined },
): "keep" | "replace" | "remove" {
  if (input.apiKey !== undefined) return input.apiKey.trim() ? "replace" : "remove"
  if (stored.has_key && norm(stored.ai_base_url) !== norm(input.baseUrl)) return "remove"
  return "keep"
}
