import { bulletKey, mergeData, textKey } from "./dedupe"
import { positionsForNew } from "./positions"
import { BasicsSchema, ItemDataSchemas, SECTION_KEYS, type Basics, type Bullet, type Section } from "./schema"

type Data = Record<string, unknown>
type Existing = { id: string; section: Section; position: number; data: Data }
export type ImportWriteRow = {
  section: Section
  data: Data
  action: "add" | "skip" | "merge" | "overwrite"
  matchId: string | null
  parent?: string
}

/**
 * Only the basics fields the user chose to set. Never an empty `links` array: the DB merges
 * basics with `||`, so `links: []` would wipe the links already saved.
 */
export function cleanBasicsPatch(raw: Record<string, unknown>): Partial<Basics> {
  const out: Partial<Basics> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (k === "links") {
      const links = BasicsSchema.shape.links.safeParse(v)
      if (links.success && links.data.length) out.links = links.data.filter((l) => l.url)
    } else if (k in BasicsSchema.shape && typeof v === "string" && v.trim()) {
      ;(out as Record<string, string>)[k] = v.trim()
    }
  }
  if (out.links && !out.links.length) delete out.links
  return out
}

const validData = (section: Section, data: unknown) => ItemDataSchemas[section].parse(data) as Data

/** Overwrite with new content but keep the ids of bullets whose text is unchanged (part B references them). */
function keepBulletIds(oldData: Data, newData: Data): Data {
  if (!Array.isArray(newData.bullets) || !Array.isArray(oldData.bullets)) return newData
  const ids = new Map((oldData.bullets as Bullet[]).map((b) => [bulletKey(b.text), b.id]))
  return { ...newData, bullets: (newData.bullets as Bullet[]).map((b) => ({ ...b, id: ids.get(bulletKey(b.text)) ?? b.id })) }
}

/**
 * Turn reviewed rows into DB writes. Merges are computed from the current DB rows and
 * accumulate, so two rows merged into the same item both land.
 */
export function buildImportWrites(existing: Existing[], rows: ImportWriteRow[]) {
  const byId = new Map(existing.map((e) => [e.id, e]))
  const inserts: { id: string; section: Section; position: number; data: Data; tags: string[]; parent?: string }[] = []
  for (const s of SECTION_KEYS) {
    const adds = rows.filter((r) => r.section === s && r.action === "add")
    const taken = existing.filter((e) => e.section === s).map((e) => e.position)
    positionsForNew(s, taken, adds.length).forEach((position, i) =>
      inserts.push({ id: crypto.randomUUID(), section: s, position, data: validData(s, adds[i].data), tags: [], parent: adds[i].parent }),
    )
  }
  // sub-projects -> the experience at the same company (prefer one imported now, else an existing one)
  const experiences = [
    ...inserts.filter((i) => i.section === "experience").map((i) => ({ id: i.id, company: i.data.company })),
    ...existing.filter((e) => e.section === "experience").map((e) => ({ id: e.id, company: e.data.company })),
  ]
  for (const ins of inserts) {
    if (ins.section !== "project" || !ins.parent) continue
    const exp = experiences.find((e) => textKey(e.company) && textKey(e.company) === textKey(ins.parent))
    if (exp) ins.data = { ...ins.data, experience_id: exp.id }
  }
  for (const ins of inserts) delete ins.parent

  const next = new Map<string, Data>()
  for (const r of rows) {
    if (r.action !== "merge" && r.action !== "overwrite") continue
    const old = r.matchId ? byId.get(r.matchId) : undefined
    if (!old || old.section !== r.section) throw new Error("Mục trùng đã thay đổi hoặc bị xoá. Tải lại trang rồi nhập lại.")
    const base = next.get(old.id) ?? old.data
    next.set(old.id, r.action === "merge" ? mergeData(r.section, base, r.data) : keepBulletIds(base, r.data))
  }
  const updates = [...next].map(([id, data]) => ({ id, data: validData(byId.get(id)!.section, data) }))
  return { inserts, updates }
}
