"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { CvContentSchema, CvStyleSchema, TemplateKeySchema } from "@/lib/cv/document-schema"
import { contentFromTags } from "@/lib/cv/resolve"
import { TEMPLATES } from "@/lib/cv/templates/registry"
import type { TemplateKey } from "@/lib/cv/templates/types"
import type { Bullet, Section } from "@/lib/profile/schema"
import { ItemDataSchemas } from "@/lib/profile/schema"
import type { Json } from "@/lib/supabase/types"
import { workspaceContext } from "./queries"
import type { ActionResult } from "./types"

const uuid = z.uuid()
const TagsSchema = z.array(z.string().trim().toLowerCase().min(1).max(30)).max(20)

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError) return { ok: false, error: `Dữ liệu chưa hợp lệ: ${e.issues[0]?.path.join(".")} ${e.issues[0]?.message ?? ""}`.trim() }
  return { ok: false, error: (e as { message?: string })?.message || "Có lỗi xảy ra" }
}

const CreateSchema = z.object({
  name: z.string().trim().min(1, "Cần đặt tên").max(80),
  template: TemplateKeySchema.default("mine"),
  target_role: z.string().trim().max(80).optional(),
  tags: TagsSchema.default([]),
  copyFrom: uuid.optional(),
  target_application_id: uuid.optional(),
})

export async function createCvDocument(input: z.input<typeof CreateSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const v = CreateSchema.parse(input)
    const { supabase, ws } = await workspaceContext()
    let row: { template: string; style: Json; content: Json; target_tags: string[]; target_role: string | null }
    if (v.copyFrom) {
      const { data, error } = await supabase
        .from("cv_documents")
        .select("template, style, content, target_tags, target_role")
        .eq("workspace_id", ws.id)
        .eq("id", v.copyFrom)
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error("Bản CV gốc không còn tồn tại")
      row = data
    } else {
      const { data: items, error } = await supabase.from("profile_items").select("id, section, position, data, tags").eq("workspace_id", ws.id)
      if (error) throw error
      const key = v.template as TemplateKey
      row = {
        template: key,
        style: TEMPLATES[key].defaults as unknown as Json,
        content: contentFromTags(items.map((i) => ({ ...i, section: i.section as Section, data: i.data as Record<string, unknown> })), v.tags) as unknown as Json,
        target_tags: v.tags,
        target_role: v.target_role ?? null,
      }
    }
    const { data, error } = await supabase
      .from("cv_documents")
      .insert({
        workspace_id: ws.id,
        name: v.name,
        ...row,
        style: row.style ?? {},
        content: row.content ?? { sections: [] },
        ...(v.target_application_id ? { target_application_id: v.target_application_id } : {}),
      })
      .select("id")
      .single()
    if (error) throw error
    revalidatePath("/cv")
    return { ok: true, data: { id: data.id } }
  } catch (e) {
    return fail(e)
  }
}

const UpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  template: TemplateKeySchema.optional(),
  target_role: z.string().trim().max(80).nullable().optional(),
  target_tags: TagsSchema.optional(),
  style: CvStyleSchema.optional(),
  content: CvContentSchema.optional(),
  target_application_id: uuid.nullable().optional(),
  target_jd: z.string().max(30_000).nullable().optional(),
  jd_keywords: z
    .object({
      jd_hash: z.string().max(20),
      extracted_at: z.string().max(40),
      keywords: z
        .array(z.object({ term: z.string().max(60), aliases: z.array(z.string().max(60)).max(10), weight: z.enum(["required", "preferred"]), category: z.string().max(40).optional() }))
        .max(60),
    })
    .nullable()
    .optional(),
})

/** Autosave from the editor (no revalidate: the editor holds the state). */
export async function updateCvDocument(id: string, patch: z.input<typeof UpdateSchema>): Promise<ActionResult<{ updated_at: string }>> {
  try {
    uuid.parse(id)
    const v = UpdateSchema.parse(patch)
    const { supabase, ws } = await workspaceContext()
    const { data, error } = await supabase
      .from("cv_documents")
      .update({
        ...v,
        style: v.style as NonNullable<Json> | undefined,
        content: v.content as NonNullable<Json> | undefined,
        jd_keywords: v.jd_keywords as Json | undefined,
      })
      .eq("workspace_id", ws.id)
      .eq("id", id)
      .select("updated_at")
    if (error) throw error
    if (!data.length) throw new Error("Bản CV không còn tồn tại (hoặc bạn vừa đổi workspace). Tải lại trang.")
    return { ok: true, data: { updated_at: data[0].updated_at } }
  } catch (e) {
    return fail(e)
  }
}

export async function deleteCvDocument(id: string): Promise<ActionResult> {
  try {
    uuid.parse(id)
    const { supabase, ws } = await workspaceContext()
    const { error } = await supabase.from("cv_documents").delete().eq("workspace_id", ws.id).eq("id", id)
    if (error) throw error
    revalidatePath("/cv")
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}

const SaveVersionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  file_path: z.string().min(1),
  text: z.string().max(60_000),
})

/** The PDF is uploaded by the browser to cvs/{ws}/…; this records it as a submittable CV version. */
export async function saveDocumentVersion(documentId: string, input: z.input<typeof SaveVersionSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    uuid.parse(documentId)
    const v = SaveVersionSchema.parse(input)
    const { supabase, ws } = await workspaceContext()
    if (!v.file_path.startsWith(`${ws.id}/`)) throw new Error("Đường dẫn file không hợp lệ")
    const { data, error } = await supabase
      .from("cv_versions")
      .insert({ workspace_id: ws.id, name: v.name, file_path: v.file_path, file_type: "pdf", extracted_text: v.text, document_id: documentId })
      .select("id")
      .single()
    if (error) throw error
    revalidatePath("/cv")
    revalidatePath("/")
    return { ok: true, data: { id: data.id } }
  } catch (e) {
    return fail(e)
  }
}

/** "Cập nhật vào hồ sơ": copy a CV-specific rewrite back into the profile item. */
export async function promoteToProfile(
  itemId: string,
  change: { kind: "bullet"; bulletId: string; text: string } | { kind: "field"; field: string; value: string },
): Promise<ActionResult> {
  try {
    uuid.parse(itemId)
    const { supabase, ws } = await workspaceContext()
    const { data: item, error } = await supabase.from("profile_items").select("section, data").eq("workspace_id", ws.id).eq("id", itemId).maybeSingle()
    if (error) throw error
    if (!item) throw new Error("Mục này không còn trong hồ sơ")
    const data = { ...(item.data as Record<string, unknown>) }
    if (change.kind === "bullet") {
      const bullets = (Array.isArray(data.bullets) ? data.bullets : []) as Bullet[]
      if (!bullets.some((b) => b.id === change.bulletId)) throw new Error("Bullet này không còn trong hồ sơ")
      data.bullets = bullets.map((b) => (b.id === change.bulletId ? { ...b, text: change.text.trim() } : b))
    } else {
      data[change.field] = change.value.trim()
    }
    const valid = ItemDataSchemas[item.section as Section].parse(data)
    const { error: upErr } = await supabase.from("profile_items").update({ data: valid as NonNullable<Json> }).eq("workspace_id", ws.id).eq("id", itemId)
    if (upErr) throw upErr
    revalidatePath("/profile")
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}
