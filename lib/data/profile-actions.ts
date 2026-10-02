"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { mergeData } from "@/lib/profile/dedupe"
import { toBullets } from "@/lib/profile/normalize"
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
    if (Array.isArray(data.bullets)) data.bullets = toBullets((data.bullets as { text: string }[]).map((b) => b.text)) // fresh ids
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
  basics: BasicsSchema.partial().default({}),
  rows: z
    .array(
      z.object({
        section: SectionSchema,
        data: z.record(z.string(), z.unknown()),
        action: z.enum(["add", "skip", "merge", "overwrite"]),
        matchId: uuid.nullable(),
      }),
    )
    .max(300),
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
    const byId = new Map(existing.map((e) => [e.id, e]))

    const inserts: { section: Section; position: number; data: Record<string, unknown>; tags: string[] }[] = []
    const updates: { id: string; data: Record<string, unknown> }[] = []
    for (const s of SECTION_KEYS) {
      const adds = v.rows.filter((r) => r.section === s && r.action === "add")
      const taken = existing.filter((e) => e.section === s).map((e) => e.position)
      positionsForNew(s, taken, adds.length).forEach((position, i) =>
        inserts.push({ section: s, position, data: validData(s, adds[i].data), tags: [] }),
      )
    }
    for (const r of v.rows) {
      if (r.action !== "merge" && r.action !== "overwrite") continue
      const old = r.matchId ? byId.get(r.matchId) : undefined
      if (!old || old.section !== r.section) throw new Error("Mục trùng đã thay đổi hoặc bị xoá. Tải lại trang rồi nhập lại.")
      const next = r.action === "merge" ? mergeData(r.section, old.data as Record<string, unknown>, r.data) : r.data
      updates.push({ id: old.id, data: validData(r.section, next) })
    }

    const basics = Object.fromEntries(Object.entries(v.basics).filter(([, val]) => val !== undefined && val !== ""))
    const { error: rpcErr } = await supabase.rpc("import_profile", {
      p_ws: ws.id,
      p_basics: basics as Json,
      p_inserts: inserts as unknown as Json,
      p_updates: updates as unknown as Json,
    })
    if (rpcErr) throw rpcErr
    return done({ added: inserts.length, updated: updates.length })
  } catch (e) {
    return fail(e)
  }
}
