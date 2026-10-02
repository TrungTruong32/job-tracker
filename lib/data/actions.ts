"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { CvFitSchema, JdSummarySchema, type StoredCvFit } from "@/lib/ai/parse"
import { nextKeyAction } from "@/lib/ai/key-policy"
import { encryptSecret } from "@/lib/crypto"
import { todayStr } from "@/lib/format"
import { requireUser } from "@/lib/supabase/server"
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
  if (code === "23503") return { ok: false, error: "Không thể xoá vì đang được đơn ứng tuyển sử dụng" }
  if (code === "23505") return { ok: false, error: "Dữ liệu bị trùng" }
  const msg = (e as { message?: string })?.message
  return { ok: false, error: msg || "Có lỗi xảy ra" }
}

function refresh(...paths: string[]) {
  for (const p of ["/", "/dashboard", ...paths]) revalidatePath(p)
}

// ---------- applications ----------

export async function createApplication(input: ApplicationInput): Promise<ActionResult<{ id: string }>> {
  try {
    const v = ApplicationSchema.parse(input)
    const { supabase } = await requireUser()
    const { data, error } = await supabase
      .from("applications")
      .insert({ ...v, ai_summary: v.ai_summary as Json })
      .select("id")
      .single()
    if (error) throw error
    const { error: evErr } = await supabase
      .from("stage_events")
      .insert({ application_id: data.id, stage_id: v.stage_id, event_date: v.applied_at, type: "stage_change" })
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
    const { supabase } = await requireUser()
    const { data: current, error: curErr } = await supabase.from("applications").select("stage_id").eq("id", id).single()
    if (curErr) throw curErr
    const { stage_id, ...rest } = v
    const { error } = await supabase
      .from("applications")
      .update({ ...rest, ai_summary: rest.ai_summary as Json })
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
    const { supabase } = await requireUser()
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
    const { supabase } = await requireUser()
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
    const { supabase } = await requireUser()
    const { error } = await supabase.from("applications").update({ ai_summary: v as Json }).eq("id", id)
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
    const { supabase } = await requireUser()
    const { error } = await supabase.from("applications").update({ ai_fit: stored as Json }).eq("id", id)
    if (error) throw error
    refresh(`/applications/${id}`)
    return { ok: true, data: stored }
  } catch (e) {
    return fail(e)
  }
}

// ---------- timeline ----------

async function touch(applicationId: string) {
  const { supabase } = await requireUser()
  await supabase.from("applications").update({ last_activity_at: new Date().toISOString() }).eq("id", applicationId)
}

export async function addEvent(applicationId: string, input: EventInput): Promise<ActionResult> {
  try {
    const v = EventSchema.parse(input)
    const { supabase } = await requireUser()
    const { error } = await supabase.from("stage_events").insert({ ...v, application_id: applicationId })
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
    const { supabase } = await requireUser()
    const { error } = await supabase.from("stage_events").update(v).eq("id", id)
    if (error) throw error
    refresh(`/applications/${applicationId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}

export async function deleteEvent(id: string, applicationId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser()
    const { error } = await supabase.from("stage_events").delete().eq("id", id)
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
    const { supabase, user } = await requireUser()
    if (input.file_path && !input.file_path.startsWith(`${user.id}/`)) throw new Error("Đường dẫn file không hợp lệ")
    const { count } = await supabase.from("cv_versions").select("id", { count: "exact", head: true })
    const makeDefault = input.is_default || !count
    if (makeDefault) await supabase.from("cv_versions").update({ is_default: false }).eq("is_default", true)
    const { data, error } = await supabase
      .from("cv_versions")
      .insert({ ...v, file_path: input.file_path, file_type: input.file_type, is_default: makeDefault })
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
    const { supabase } = await requireUser()
    const { error } = await supabase.from("cv_versions").update(v).eq("id", id)
    if (error) throw error
    refresh("/cv")
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}

export async function setDefaultCv(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser()
    await supabase.from("cv_versions").update({ is_default: false }).eq("is_default", true)
    const { error } = await supabase.from("cv_versions").update({ is_default: true }).eq("id", id)
    if (error) throw error
    refresh("/cv")
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}

export async function deleteCv(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser()
    const { data: cv } = await supabase.from("cv_versions").select("file_path").eq("id", id).single()
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
  ai_provider: z.enum(["openrouter", "gemini", "ollama", "custom"]),
  ai_base_url: optText,
  ai_model: optText,
  ai_api_key: z.string().optional(), // undefined = keep, "" = remove, else replace
  stale_days: z.coerce.number().int().min(1, "Tối thiểu 1 ngày").max(90, "Tối đa 90 ngày"),
})

export async function saveSettings(input: z.input<typeof SettingsSchema>): Promise<ActionResult> {
  try {
    const v = SettingsSchema.parse(input)
    if (v.ai_base_url && !/^https?:\/\//.test(v.ai_base_url)) throw new Error("Base URL phải bắt đầu bằng http:// hoặc https://")
    const { supabase, user } = await requireUser()
    const patch: Record<string, unknown> = {
      user_id: user.id,
      ai_provider: v.ai_provider,
      ai_base_url: v.ai_base_url,
      ai_model: v.ai_model,
      stale_days: v.stale_days,
    }
    const { data: stored } = await supabase.from("settings").select("ai_base_url, ai_api_key_encrypted").maybeSingle()
    const action = nextKeyAction(
      { ai_base_url: stored?.ai_base_url ?? null, has_key: !!stored?.ai_api_key_encrypted },
      { baseUrl: v.ai_base_url, apiKey: v.ai_api_key },
    )
    if (action === "replace") {
      if (!process.env.AI_KEY_SECRET) throw new Error("Server chưa cấu hình AI_KEY_SECRET")
      patch.ai_api_key_encrypted = encryptSecret(v.ai_api_key!.trim(), process.env.AI_KEY_SECRET)
    } else if (action === "remove") {
      patch.ai_api_key_encrypted = null
    }
    const { error } = await supabase.from("settings").upsert(patch as never)
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
    const { supabase } = await requireUser()
    const { data: existing, error: exErr } = await supabase.from("stages").select("id")
    if (exErr) throw exErr
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
        ? await supabase.from("stages").update(row).eq("id", s.id)
        : await supabase.from("stages").insert(row)
      if (error) throw error
    }
    refresh("/settings")
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}
