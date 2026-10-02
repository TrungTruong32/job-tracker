import "server-only"
import { cache } from "react"
import { cookies } from "next/headers"
import { publicAi } from "@/lib/ai/settings"
import { aiTimeoutMs } from "@/lib/ai/timeout"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireUser } from "@/lib/supabase/server"
import { pickWorkspace, type WorkspaceLite, type WorkspaceRole } from "@/lib/workspace/pick"
import type { Application, CvVersion, Member, PublicSettings, Stage, StageEvent } from "./types"

export const WS_COOKIE = "jt_ws"

const APP_COLUMNS =
  "id,workspace_id,company,position,source,jd_url,jd_text,salary,location,applied_at,stage_id,cv_version_id,next_action,next_action_due,ai_summary,ai_fit,last_activity_at,created_at,updated_at"

/**
 * Claim pending invites; for allowlisted users also create the personal workspace
 * (server-side with the service role — users cannot create workspaces). Cached per request.
 */
export const ensureSetup = cache(async () => {
  const { supabase, user, canOwn } = await requireUser()
  const { error } = await supabase.rpc("ensure_user_setup")
  if (error) throw error
  if (canOwn && user.email) {
    const { error: wsErr } = await createAdminClient().rpc("create_personal_workspace", {
      p_user: user.id,
      p_email: user.email,
    })
    if (wsErr) throw wsErr
  }
})

export const getWorkspaces = cache(async (): Promise<WorkspaceLite[]> => {
  // Layout and page render in parallel: make sure first-login setup ran before reading memberships.
  await ensureSetup()
  const { supabase, user } = await requireUser()
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspace:workspaces(id, name)")
    .eq("user_id", user.id)
    .order("created_at")
  if (error) throw error
  return data
    .filter((m) => m.workspace)
    .map((m) => ({ id: m.workspace!.id, name: m.workspace!.name, role: m.role as WorkspaceRole }))
})

export class NoWorkspaceError extends Error {
  constructor() {
    super("Bạn chưa thuộc workspace nào")
  }
}

/** The workspace every page and action works in (cookie, else owned, else first). */
export const getCurrentWorkspace = cache(async (): Promise<WorkspaceLite> => {
  const remembered = (await cookies()).get(WS_COOKIE)?.value
  const ws = pickWorkspace(await getWorkspaces(), remembered)
  if (!ws) throw new NoWorkspaceError()
  return ws
})

/** Supabase client + user + current workspace, for queries and actions. */
export async function workspaceContext() {
  const [{ supabase, user }, ws] = await Promise.all([requireUser(), getCurrentWorkspace()])
  return { supabase, user, ws }
}

export const getStages = cache(async (): Promise<Stage[]> => {
  const { supabase, ws } = await workspaceContext()
  const { data, error } = await supabase.from("stages").select("*").eq("workspace_id", ws.id).order("position")
  if (error) throw error
  return data as Stage[]
})

export const getCvs = cache(async (): Promise<CvVersion[]> => {
  const { supabase, ws } = await workspaceContext()
  const { data, error } = await supabase
    .from("cv_versions")
    .select("*")
    .eq("workspace_id", ws.id)
    .order("created_at", { ascending: false })
  if (error) throw error
  return data
})

export async function getApplications(): Promise<Application[]> {
  const { supabase, ws } = await workspaceContext()
  const { data, error } = await supabase
    .from("applications")
    .select(APP_COLUMNS)
    .eq("workspace_id", ws.id)
    .order("applied_at", { ascending: false })
  if (error) throw error
  return data as unknown as Application[]
}

export async function getApplication(id: string): Promise<Application | null> {
  const { supabase, ws } = await workspaceContext()
  const { data, error } = await supabase
    .from("applications")
    .select(APP_COLUMNS)
    .eq("workspace_id", ws.id)
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data as unknown as Application | null
}

export async function getEvents(applicationId?: string): Promise<StageEvent[]> {
  const { supabase, ws } = await workspaceContext()
  let q = supabase.from("stage_events").select("*").eq("workspace_id", ws.id)
  if (applicationId) q = q.eq("application_id", applicationId)
  const { data, error } = await q.order("event_date", { ascending: false }).order("created_at", { ascending: false })
  if (error) throw error
  return data
}

export async function getMembers(): Promise<Member[]> {
  const { supabase, ws } = await workspaceContext()
  const { data, error } = await supabase
    .from("workspace_members")
    .select("id, email, role, user_id, created_at")
    .eq("workspace_id", ws.id)
    .order("created_at")
  if (error) throw error
  return data.map((m) => ({ id: m.id, email: m.email, role: m.role as WorkspaceRole, joined: !!m.user_id }))
}

export const getSettingsRow = cache(async () => {
  const { supabase, ws } = await workspaceContext()
  const { data, error } = await supabase.from("settings").select("*").eq("workspace_id", ws.id).maybeSingle()
  if (error) throw error
  return data
})

export async function getPublicSettings(): Promise<PublicSettings> {
  const row = await getSettingsRow()
  const ai = publicAi(row, process.env.AI_KEY_SECRET)
  return {
    connections: ai.connections,
    chain: ai.chain,
    ai_ready: ai.ready,
    ai_timeout_s: aiTimeoutMs(row) / 1000,
    stale_days: row?.stale_days ?? 7,
  }
}
