"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { CvFitSchema, JdSummarySchema, type StoredCvFit } from "@/lib/ai/parse"
import { AiUpdateSchema, applyAiUpdate } from "@/lib/ai/settings"
import { encryptSecret } from "@/lib/crypto"
import { todayStr } from "@/lib/format"
import { cookies } from "next/headers"
import { WS_COOKIE, getCurrentWorkspace, getWorkspaces, workspaceContext } from "./queries"
import type { Json } from "@/lib/supabase/types"
import type { ActionResult, ApplicationInput, EventInput } from "./types"

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ")
const optText = z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().nullable())
const uuid = z.uuid()

const ApplicationSchema = z.object({
  company: z.string().trim().min(1, "Cần nhập tên công ty"),
  position: z.string().trim().min(1, "Cần nhập vị trí"),
  source: optText,
  jd_url: optText,
  jd_text: optText,
  salary: optText,
  location: optText,
  applied_at: day,
  stage_id: uuid,
  cv_version_id: uuid.nullable(),
  next_action: optText,
  next_action_due: day.nullable(),
  ai_summary: JdSummarySchema.nullable(),
})

const EventSchema = z.object({
  type: z.enum(["stage_change", "note", "interview"]),
  stage_id: uuid.nullable(),
  event_date: day,
  interviewer: optText,
  notes: optText,
  questions: optText,
})

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Dữ liệu không hợp lệ" }
  const code = (e as { code?: string })?.code
  if (code === "23503")
    return { ok: false, error: "Dữ liệu đang được dùng ở nơi khác hoặc đã thay đổi (có thể bạn vừa đổi workspace ở tab khác). Tải lại trang rồi thử lại." }
  if (code === "42501") return { ok: false, error: "Bạn không có quyền làm việc này" }
  if (code === "23505") return { ok: false, error: "Dữ liệu bị trùng" }
  const msg = (e as { message?: string })?.message
  return { ok: false, error: msg || "Có lỗi xảy ra" }
}

/** The page was rendered for another workspace (switched in another tab) or the row is gone. */
class StaleError extends Error {
  constructor() {
    super("Dữ liệu không thuộc workspace đang chọn (có thể bạn vừa đổi workspace ở tab khác). Tải lại trang.")
  }
}

async function assertInWorkspace(table: "applications" | "stages" | "cv_versions", id: string) {
  uuid.parse(id)
  const { supabase, ws } = await workspaceContext()
  const { data, error } = await supabase.from(table).select("id").eq("workspace_id", ws.id).eq("id", id).maybeSingle()
  if (error) throw error
  if (!data) throw new StaleError()
}

function refresh(...paths: string[]) {
  for (const p of ["/", "/dashboard", ...paths]) revalidatePath(p)
}

// ---------- applications ----------

export async function createApplication(input: ApplicationInput): Promise<ActionResult<{ id: string }>> {
  try {
    const v = ApplicationSchema.parse(input)
    const { supabase, ws } = await workspaceContext()
    await assertInWorkspace("stages", v.stage_id)
    if (v.cv_version_id) await assertInWorkspace("cv_versions", v.cv_version_id)
    const { data, error } = await supabase
      .from("applications")
      .insert({ ...v, workspace_id: ws.id, ai_summary: v.ai_summary as Json })
      .select("id")
      .single()
    if (error) throw error
    const { error: evErr } = await supabase
      .from("stage_events")
      .insert({ workspace_id: ws.id, application_id: data.id, stage_id: v.stage_id, event_date: v.applied_at, type: "stage_change" })
    if (evErr) throw evErr
    refresh()
    return { ok: true, data: { id: data.id } }
  } catch (e) {
    return fail(e)
  }
}

export async function updateApplication(id: string, input: ApplicationInput): Promise<ActionResult> {
  try {
    const v = ApplicationSchema.parse(input)
    const { supabase, ws } = await workspaceContext()
    await assertInWorkspace("stages", v.stage_id)
    if (v.cv_version_id) await assertInWorkspace("cv_versions", v.cv_version_id)
    const { data: current, error: curErr } = await supabase
      .from("applications")
      .select("stage_id")
      .eq("workspace_id", ws.id)
      .eq("id", id)
      .maybeSingle()
    if (curErr) throw curErr
    if (!current) throw new StaleError()
    const { stage_id, ...rest } = v
    const { error } = await supabase
      .from("applications")
      .update({ ...rest, ai_summary: rest.ai_summary as Json })
      .eq("workspace_id", ws.id)
      .eq("id", id)
    if (error) throw error
    // Stage changes always go through move_application so the timeline stays complete.
    if (current.stage_id !== stage_id) {
      const { error: mvErr } = await supabase.rpc("move_application", { p_app: id, p_stage: stage_id, p_date: todayStr() })
      if (mvErr) throw mvErr
    }
    refresh(`/applications/${id}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}

export async function deleteApplication(id: string): Promise<ActionResult> {
  try {
    uuid.parse(id)
    const { supabase } = await workspaceContext()
    await assertInWorkspace("applications", id)
    const { error } = await supabase.from("applications").delete().eq("id", id)
    if (error) throw error
    refresh()
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}

export async function moveApplication(id: string, stageId: string): Promise<ActionResult> {
  try {
    uuid.parse(id)
    uuid.parse(stageId)
    const { supabase } = await workspaceContext()
    await assertInWorkspace("applications", id)
    await assertInWorkspace("stages", stageId)
    const { error } = await supabase.rpc("move_application", { p_app: id, p_stage: stageId, p_date: todayStr() })
    if (error) throw error
    refresh(`/applications/${id}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}

export async function saveAiSummary(id: string, summary: unknown): Promise<ActionResult> {
  try {
    const v = JdSummarySchema.parse(summary)
    const { supabase } = await workspaceContext()
    const { error } = await supabase
      .from("applications")
      .update({ ai_summary: v as Json })
      .eq("workspace_id", (await getCurrentWorkspace()).id)
      .eq("id", id)
    if (error) throw error
    refresh(`/applications/${id}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}

export async function saveAiFit(id: string, fit: unknown, cvVersionId: string | null): Promise<ActionResult<StoredCvFit>> {
  try {
    const stored: StoredCvFit = {
      ...CvFitSchema.parse(fit),
      cv_version_id: cvVersionId,
      evaluated_at: new Date().toISOString(),
    }
    const { supabase } = await workspaceContext()
    const { error } = await supabase
      .from("applications")
      .update({ ai_fit: stored as Json })
      .eq("workspace_id", (await getCurrentWorkspace()).id)
      .eq("id", id)
    if (error) throw error
    refresh(`/applications/${id}`)
    return { ok: true, data: stored }
  } catch (e) {
    return fail(e)
  }
}

// ---------- timeline ----------

async function touch(applicationId: string) {
  const { supabase } = await workspaceContext()
  const { error } = await supabase
    .from("applications")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("workspace_id", (await getCurrentWorkspace()).id)
    .eq("id", applicationId)
  if (error) throw error
}

export async function addEvent(applicationId: string, input: EventInput): Promise<ActionResult> {
  try {
    const v = EventSchema.parse(input)
    const { supabase, ws } = await workspaceContext()
    await assertInWorkspace("applications", applicationId)
    const { error } = await supabase.from("stage_events").insert({ ...v, workspace_id: ws.id, application_id: applicationId })
    if (error) throw error
    await touch(applicationId)
    refresh(`/applications/${applicationId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}

export async function updateEvent(id: string, applicationId: string, input: EventInput): Promise<ActionResult> {
  try {
    const v = EventSchema.parse(input)
    const { supabase } = await workspaceContext()
    const { error } = await supabase.from("stage_events").update(v).eq("workspace_id", (await getCurrentWorkspace()).id).eq("id", id)
    if (error) throw error
    refresh(`/applications/${applicationId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}

export async function deleteEvent(id: string, applicationId: string): Promise<ActionResult> {
  try {
    const { supabase } = await workspaceContext()
    const { error } = await supabase.from("stage_events").delete().eq("workspace_id", (await getCurrentWorkspace()).id).eq("id", id)
    if (error) throw error
    refresh(`/applications/${applicationId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}

// ---------- CV versions ----------

const CvSchema = z.object({
  name: z.string().trim().min(1, "Cần đặt tên cho bản CV"),
  extracted_text: z.string(),
})

export async function createCv(input: {
  name: string
  extracted_text: string
  file_path: string | null
  file_type: "pdf" | "tex" | null
  is_default: boolean
}): Promise<ActionResult<{ id: string }>> {
  try {
    const v = CvSchema.parse(input)
    const { supabase, ws } = await workspaceContext()
    if (input.file_path && !input.file_path.startsWith(`${ws.id}/`)) throw new Error("Đường dẫn file không hợp lệ")
    const { count } = await supabase.from("cv_versions").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id)
    const makeDefault = input.is_default || !count
    if (makeDefault) await supabase.from("cv_versions").update({ is_default: false }).eq("workspace_id", ws.id).eq("is_default", true)
    const { data, error } = await supabase
      .from("cv_versions")
      .insert({ ...v, workspace_id: ws.id, file_path: input.file_path, file_type: input.file_type, is_default: makeDefault })
      .select("id")
      .single()
    if (error) throw error
    refresh("/cv")
    return { ok: true, data: { id: data.id } }
  } catch (e) {
    return fail(e)
  }
}

export async function updateCv(id: string, input: { name: string; extracted_text: string }): Promise<ActionResult> {
  try {
    const v = CvSchema.parse(input)
    const { supabase } = await workspaceContext()
    const { error } = await supabase.from("cv_versions").update(v).eq("workspace_id", (await getCurrentWorkspace()).id).eq("id", id)
    if (error) throw error
    refresh("/cv")
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}

export async function setDefaultCv(id: string): Promise<ActionResult> {
  try {
    const { supabase, ws } = await workspaceContext()
    await assertInWorkspace("cv_versions", id)
    await supabase.from("cv_versions").update({ is_default: false }).eq("workspace_id", ws.id).eq("is_default", true)
    const { error } = await supabase.from("cv_versions").update({ is_default: true }).eq("workspace_id", ws.id).eq("id", id)
    if (error) throw error
    refresh("/cv")
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}

export async function deleteCv(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await workspaceContext()
    const { data: cv } = await supabase
      .from("cv_versions")
      .select("file_path")
      .eq("workspace_id", (await getCurrentWorkspace()).id)
      .eq("id", id)
      .maybeSingle()
    if (!cv) throw new StaleError()
    const { error } = await supabase.from("cv_versions").delete().eq("id", id)
    if (error) throw error
    if (cv?.file_path) await supabase.storage.from("cvs").remove([cv.file_path])
    refresh("/cv")
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}

// ---------- settings ----------

const SettingsSchema = z.object({
  ai: AiUpdateSchema,
  ai_timeout_s: z.coerce.number().int().min(15, "Thời gian chờ tối thiểu 15 giây").max(120, "Thời gian chờ tối đa 120 giây"),
  stale_days: z.coerce.number().int().min(1, "Tối thiểu 1 ngày").max(90, "Tối đa 90 ngày"),
})

export async function saveSettings(input: z.input<typeof SettingsSchema>): Promise<ActionResult> {
  try {
    const v = SettingsSchema.parse(input)
    const { supabase, ws } = await workspaceContext()
    if (ws.role !== "owner") throw new Error("Chỉ chủ workspace được đổi cài đặt")
    const { data: stored, error: readErr } = await supabase
      .from("settings")
      .select("ai_connections, ai_chain")
      .eq("workspace_id", ws.id)
      .maybeSingle()
    if (readErr) throw readErr
    const secret = process.env.AI_KEY_SECRET
    const ai = applyAiUpdate(stored, v.ai, (plain) => {
      if (!secret) throw new Error("Server chưa cấu hình AI_KEY_SECRET")
      return encryptSecret(plain, secret)
    })
    const { error } = await supabase
      .from("settings")
      .update({ ai_connections: ai.ai_connections as NonNullable<Json>, ai_chain: ai.ai_chain as NonNullable<Json>, ai_timeout_s: v.ai_timeout_s, stale_days: v.stale_days })
      .eq("workspace_id", ws.id)
    if (error) throw error
    refresh("/settings")
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}

const StageListSchema = z.array(
  z.object({
    id: uuid.nullable(),
    name: z.string().trim().min(1, "Tên vòng không được trống"),
    kind: z.enum(["active", "offer", "closed"]),
  }),
)

/** Replace the stage list: upsert in the given order, delete the ones left out. */
export async function saveStages(input: z.input<typeof StageListSchema>): Promise<ActionResult> {
  try {
    const list = StageListSchema.parse(input)
    if (!list.length) throw new Error("Cần ít nhất một vòng")
    if (!list.some((s) => s.kind === "active")) throw new Error("Cần ít nhất một vòng loại 'đang chạy'")
    const { supabase, ws } = await workspaceContext()
    const { data: existing, error: exErr } = await supabase.from("stages").select("id").eq("workspace_id", ws.id)
    if (exErr) throw exErr
    const existingIds = new Set(existing.map((s) => s.id))
    if (list.some((s) => s.id && !existingIds.has(s.id))) throw new StaleError()
    const keep = new Set(list.map((s) => s.id).filter(Boolean))
    const removed = existing.filter((s) => !keep.has(s.id)).map((s) => s.id)
    if (removed.length) {
      const { count } = await supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .in("stage_id", removed)
      if (count) throw new Error("Không thể xoá vòng đang có đơn ứng tuyển. Hãy chuyển các đơn sang vòng khác trước.")
      const { error } = await supabase.from("stages").delete().in("id", removed)
      if (error) throw error
    }
    for (const [position, s] of list.entries()) {
      const row = { name: s.name, kind: s.kind, position }
      const { error } = s.id
        ? await supabase.from("stages").update(row).eq("workspace_id", ws.id).eq("id", s.id)
        : await supabase.from("stages").insert({ ...row, workspace_id: ws.id })
      if (error) throw error
    }
    refresh("/settings")
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}

// ---------- workspaces ----------

export async function switchWorkspace(id: string): Promise<ActionResult> {
  try {
    uuid.parse(id)
    if (!(await getWorkspaces()).some((w) => w.id === id)) throw new Error("Bạn không thuộc workspace này")
    const jar = await cookies()
    jar.set(WS_COOKIE, id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true })
    revalidatePath("/", "layout")
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}

export async function renameWorkspace(name: string): Promise<ActionResult> {
  try {
    const v = z.string().trim().min(1, "Tên workspace không được trống").max(80).parse(name)
    const { supabase, ws } = await workspaceContext()
    if (ws.role !== "owner") throw new Error("Chỉ chủ workspace được đổi tên")
    const { error } = await supabase.from("workspaces").update({ name: v }).eq("id", ws.id)
    if (error) throw error
    revalidatePath("/", "layout")
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}

export async function inviteMember(email: string): Promise<ActionResult> {
  try {
    const v = z.email("Email không hợp lệ").parse(email.trim().toLowerCase())
    const { supabase, ws } = await workspaceContext()
    if (ws.role !== "owner") throw new Error("Chỉ chủ workspace được mời thành viên")
    const { error } = await supabase.rpc("invite_member", { p_ws: ws.id, p_email: v })
    if (error?.code === "23505") throw new Error("Email này đã có trong workspace")
    if (error) throw error
    refresh("/settings")
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  try {
    uuid.parse(memberId)
    const { supabase, ws } = await workspaceContext()
    if (ws.role !== "owner") throw new Error("Chỉ chủ workspace được xoá thành viên")
    const { data, error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("workspace_id", ws.id)
      .eq("id", memberId)
      .eq("role", "member")
      .select("id")
    if (error) throw error
    if (!data.length) throw new Error("Không xoá được thành viên này")
    refresh("/settings")
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}

export async function leaveWorkspace(): Promise<ActionResult> {
  try {
    const { supabase, user, ws } = await workspaceContext()
    if (ws.role === "owner") throw new Error("Chủ workspace không thể rời workspace của mình")
    const { error } = await supabase.from("workspace_members").delete().eq("workspace_id", ws.id).eq("user_id", user.id)
    if (error) throw error
    const jar = await cookies()
    jar.delete(WS_COOKIE)
    revalidatePath("/", "layout")
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}
