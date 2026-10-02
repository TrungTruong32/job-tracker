import type { JdSummary, StoredCvFit } from "@/lib/ai/parse"
import type { PublicConnection, PublicEntry } from "@/lib/ai/settings"
import type { StageKind } from "@/lib/domain"
import type { Database } from "@/lib/supabase/types"

type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]

export type Stage = Omit<Row<"stages">, "kind"> & { kind: StageKind }
export type CvVersion = Row<"cv_versions">
export type StageEvent = Row<"stage_events">
export type Application = Omit<Row<"applications">, "ai_summary" | "ai_fit" | "search"> & {
  ai_summary: JdSummary | null
  ai_fit: StoredCvFit | null
}

/** Settings as the browser may see them: never a key, only masks. */
export type PublicSettings = {
  connections: PublicConnection[]
  chain: PublicEntry[]
  ai_ready: boolean
  stale_days: number
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

export type ApplicationInput = {
  company: string
  position: string
  source: string | null
  jd_url: string | null
  jd_text: string | null
  salary: string | null
  location: string | null
  applied_at: string
  stage_id: string
  cv_version_id: string | null
  next_action: string | null
  next_action_due: string | null
  ai_summary: JdSummary | null
}

export type EventInput = {
  type: "stage_change" | "note" | "interview"
  stage_id: string | null
  event_date: string
  interviewer: string | null
  notes: string | null
  questions: string | null
}

export type Member = {
  id: string
  email: string
  role: "owner" | "member"
  joined: boolean
}
