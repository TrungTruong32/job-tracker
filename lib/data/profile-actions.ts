"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { buildImportWrites, cleanBasicsPatch } from "@/lib/profile/import"
import { positionsForNew, swapPositions } from "@/lib/profile/positions"
import { BasicsSchema, ItemDataSchemas, SECTION_KEYS, type Section } from "@/lib/profile/schema"
import type { Json } from "@/lib/supabase/types"
import { workspaceContext } from "./queries"
import type { ActionResult } from "./types"

const uuid = z.uuid()
const SectionSchema = z.enum(SECTION_KEYS)
const TagsSchema = z.array(z.string().trim().toLowerCase().min(1).max(30)).max(20).default([])

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError) return { ok: false, error: `Dữ liệu chưa hợp lệ: ${e.issues[0]?.path.join(".")} ${e.issues[0]?.message ?? ""}`.trim() }
  return { ok: false, error: (e as { message?: string })?.message || "Có lỗi xảy ra" }
}
const done = <T,>(data: T): ActionResult<T> => (revalidatePath("/profile"), { ok: true, data })

function validData(section: Section, data: unknown) {
  return ItemDataSchemas[section].parse(data) as Record<string, unknown>
}

async function sectionPositions(section: Section) {
  const { supabase, ws } = await workspaceContext()
  const { data, error } = await supabase
    .from("profile_items")
    .select("id, position")
    .eq("workspace_id", ws.id)
    .eq("section", section)
    .order("position")
    .order("created_at")
  if (error) throw error
  return data
}

export async function saveBasics(input: unknown): Promise<ActionResult> {
  try {
    const basics = BasicsSchema.parse(input)
    const { supabase, ws } = await workspaceContext()
    const { error } = await supabase.from("profiles").upsert({ workspace_id: ws.id, basics: basics as NonNullable<Json> })
    if (error) throw error
    return done(undefined)
  } catch (e) {
    return fail(e)
  }
}

export async function createItem(section: Section, data: unknown, tags: string[] = []): Promise<ActionResult<{ id: string }>> {
  try {
    const s = SectionSchema.parse(section)
    const d = validData(s, data)
    const t = TagsSchema.parse(tags)
    const { supabase, ws } = await workspaceContext()
    const [position] = positionsForNew(s, (await sectionPositions(s)).map((x) => x.position), 1)
    const { data: row, error } = await supabase
      .from("profile_items")
      .insert({ workspace_id: ws.id, section: s, position, data: d as NonNullable<Json>, tags: t })
      .select("id")
      .single()
    if (error) throw error
    return done({ id: row.id })
  } catch (e) {
    return fail(e)
  }
}

export async function updateItem(id: string, section: Section, data: unknown, tags: string[] = []): Promise<ActionResult> {
  try {
    uuid.parse(id)
    const s = SectionSchema.parse(section)
    const d = validData(s, data)
    const t = TagsSchema.parse(tags)
    const { supabase, ws } = await workspaceContext()
    const { data: rows, error } = await supabase
      .from("profile_items")
      .update({ data: d as NonNullable<Json>, tags: t })
      .eq("workspace_id", ws.id)
      .eq("id", id)
      .select("id")
    if (error) throw error
    if (!rows.length) throw new Error("Mục này không còn tồn tại (có thể đã bị xoá hoặc bạn vừa đổi workspace). Tải lại trang.")
    return done(undefined)
  } catch (e) {
    return fail(e)
  }
}

export async function deleteItem(id: string): Promise<ActionResult> {
  try {
    uuid.parse(id)
    const { supabase, ws } = await workspaceContext()
    const { error } = await supabase.from("profile_items").delete().eq("workspace_id", ws.id).eq("id", id)
    if (error) throw error
    return done(undefined)
  } catch (e) {
    return fail(e)
  }
}

export async function duplicateItem(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    uuid.parse(id)
    const { supabase, ws } = await workspaceContext()
    const { data: src, error } = await supabase
      .from("profile_items")
      .select("section, data, tags")
      .eq("workspace_id", ws.id)
      .eq("id", id)
      .maybeSingle()
    if (error) throw error
    if (!src) throw new Error("Mục này không còn tồn tại. Tải lại trang.")
    const data = { ...(src.data as Record<string, unknown>) }
    // fresh ids only — re-parsing the text could strip leading numbers
    if (Array.isArray(data.bullets)) data.bullets = (data.bullets as { text: string }[]).map((b) => ({ ...b, id: crypto.randomUUID() }))
    return await createItem(src.section as Section, data, src.tags)
  } catch (e) {
    return fail(e)
  }
}

export async function moveItem(id: string, section: Section, dir: -1 | 1): Promise<ActionResult> {
  try {
    uuid.parse(id)
    const s = SectionSchema.parse(section)
    const { supabase, ws } = await workspaceContext()
    for (const u of swapPositions(await sectionPositions(s), id, dir)) {
      const { error } = await supabase.from("profile_items").update({ position: u.position }).eq("workspace_id", ws.id).eq("id", u.id)
      if (error) throw error
    }
    return done(undefined)
  } catch (e) {
    return fail(e)
  }
}

const ImportSchema = z.object({
  basics: z.record(z.string(), z.unknown()).default({}),
  rows: z
    .array(
      z.object({
        section: SectionSchema,
        data: z.record(z.string(), z.unknown()),
        action: z.enum(["add", "skip", "merge", "overwrite"]),
        matchId: uuid.nullable(),
        parent: z.string().max(200).optional(),
      }),
    )
    .max(500, "CV có quá nhiều mục (tối đa 500)"),
})

/**
 * Apply a reviewed import. Merges are recomputed from what is in the DB now (not from the
 * browser's copy), and everything is written in one transaction by the import_profile RPC.
 */
export async function commitImport(input: z.input<typeof ImportSchema>): Promise<ActionResult<{ added: number; updated: number }>> {
  try {
    const v = ImportSchema.parse(input)
    const { supabase, ws } = await workspaceContext()
    const { data: existing, error } = await supabase
      .from("profile_items")
      .select("id, section, position, data")
      .eq("workspace_id", ws.id)
    if (error) throw error
    const { inserts, updates } = buildImportWrites(
      existing.map((e) => ({ ...e, section: e.section as Section, data: (e.data ?? {}) as Record<string, unknown> })),
      v.rows,
    )
    const { error: rpcErr } = await supabase.rpc("import_profile", {
      p_ws: ws.id,
      p_basics: cleanBasicsPatch(v.basics) as Json,
      p_inserts: inserts as unknown as Json,
      p_updates: updates as unknown as Json,
    })
    if (rpcErr) throw rpcErr
    return done({ added: inserts.length, updated: updates.length })
  } catch (e) {
    return fail(e)
  }
}
