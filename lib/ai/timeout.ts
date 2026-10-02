// Free models often queue, so the wait per model is configurable per workspace.
// A model may be called twice (JSON retry), so 2 x 120s stays under Vercel's 300s limit.
export const AI_TIMEOUT_DEFAULT_S = 90
export const AI_TIMEOUT_MIN_S = 15
export const AI_TIMEOUT_MAX_S = 120

export function aiTimeoutMs(row: { ai_timeout_s?: number | null } | null): number {
  const s = row?.ai_timeout_s ?? AI_TIMEOUT_DEFAULT_S
  return Math.min(AI_TIMEOUT_MAX_S, Math.max(AI_TIMEOUT_MIN_S, s)) * 1000
}
