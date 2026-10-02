import "server-only"
import { cache } from "react"
import { resolveAiConfig } from "@/lib/ai/config"
import type { AiProvider } from "@/lib/ai/providers"
import { decryptSecret, maskKey } from "@/lib/crypto"
import { requireUser } from "@/lib/supabase/server"
import type { Application, CvVersion, PublicSettings, Stage, StageEvent } from "./types"

const APP_COLUMNS =
  "id,user_id,company,position,source,jd_url,jd_text,salary,location,applied_at,stage_id,cv_version_id,next_action,next_action_due,ai_summary,ai_fit,last_activity_at,created_at,updated_at"

/** Seed stages/settings on first visit; cached per request. */
export const ensureSetup = cache(async () => {
  const { supabase } = await requireUser()
  await supabase.rpc("ensure_user_setup")
})

export const getStages = cache(async (): Promise<Stage[]> => {
  const { supabase } = await requireUser()
  const { data, error } = await supabase.from("stages").select("*").order("position")
  if (error) throw error
  return data as Stage[]
})

export const getCvs = cache(async (): Promise<CvVersion[]> => {
  const { supabase } = await requireUser()
  const { data, error } = await supabase.from("cv_versions").select("*").order("created_at", { ascending: false })
  if (error) throw error
  return data
})

export async function getApplications(): Promise<Application[]> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase.from("applications").select(APP_COLUMNS).order("applied_at", { ascending: false })
  if (error) throw error
  return data as unknown as Application[]
}

export async function getApplication(id: string): Promise<Application | null> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase.from("applications").select(APP_COLUMNS).eq("id", id).maybeSingle()
  if (error) throw error
  return data as unknown as Application | null
}

export async function getEvents(applicationId?: string): Promise<StageEvent[]> {
  const { supabase } = await requireUser()
  let q = supabase.from("stage_events").select("*")
  if (applicationId) q = q.eq("application_id", applicationId)
  const { data, error } = await q.order("event_date", { ascending: false }).order("created_at", { ascending: false })
  if (error) throw error
  return data
}

export const getSettingsRow = cache(async () => {
  const { supabase } = await requireUser()
  const { data, error } = await supabase.from("settings").select("*").maybeSingle()
  if (error) throw error
  return data
})

export async function getPublicSettings(): Promise<PublicSettings> {
  const row = await getSettingsRow()
  let mask: string | null = null
  if (row?.ai_api_key_encrypted && process.env.AI_KEY_SECRET) {
    try {
      mask = maskKey(decryptSecret(row.ai_api_key_encrypted, process.env.AI_KEY_SECRET))
    } catch {
      mask = null
    }
  }
  const provider = (row?.ai_provider ?? "openrouter") as AiProvider
  return {
    ai_provider: provider,
    ai_base_url: row?.ai_base_url ?? null,
    ai_model: row?.ai_model ?? null,
    ai_key_mask: mask,
    stale_days: row?.stale_days ?? 7,
    ai_ready: !!resolveAiConfig(row, process.env.AI_KEY_SECRET),
  }
}

/** Server-side AI config (decrypted key) — never send this to the client. */
export async function getServerAiConfig() {
  return resolveAiConfig(await getSettingsRow(), process.env.AI_KEY_SECRET)
}
