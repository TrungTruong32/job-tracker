import type { CvContent, CvItemRef, CvSectionKey } from "./resolve"

// Immutable edits of a CV document's content (used by the editor; each returns a new object).

const clone = (c: CvContent): CvContent => structuredClone(c)

function section(c: CvContent, key: CvSectionKey) {
  let s = c.sections.find((x) => x.key === key)
  if (!s) {
    s = { key, visible: true, items: [] }
    c.sections.push(s)
  }
  return s
}

function swap<T>(arr: T[], i: number, dir: -1 | 1) {
  const j = i + dir
  if (i < 0 || j < 0 || j >= arr.length) return
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}

function ref(c: CvContent, key: CvSectionKey, itemId: string): CvItemRef | undefined {
  return c.sections.find((s) => s.key === key)?.items.find((i) => i.item_id === itemId)
}

export function toggleEntry(content: CvContent, key: CvSectionKey, itemId: string, on: boolean): CvContent {
  const c = clone(content)
  const s = section(c, key)
  const has = s.items.some((i) => i.item_id === itemId)
  if (on && !has) s.items.push({ item_id: itemId, bullet_ids: null })
  if (!on) s.items = s.items.filter((i) => i.item_id !== itemId)
  return c
}

export function moveEntry(content: CvContent, key: CvSectionKey, itemId: string, dir: -1 | 1): CvContent {
  const c = clone(content)
  const s = section(c, key)
  swap(s.items, s.items.findIndex((i) => i.item_id === itemId), dir)
  return c
}

export function moveSection(content: CvContent, key: CvSectionKey, dir: -1 | 1): CvContent {
  const c = clone(content)
  swap(c.sections, c.sections.findIndex((s) => s.key === key), dir)
  return c
}

export function toggleSection(content: CvContent, key: CvSectionKey, visible: boolean): CvContent {
  const c = clone(content)
  section(c, key).visible = visible
  return c
}

export function renameSection(content: CvContent, key: CvSectionKey, title: string): CvContent {
  const c = clone(content)
  section(c, key).title = title.trim() || undefined
  return c
}

/** `all`: the item's bullet ids in profile order (to materialize a null "all bullets" selection). */
export function toggleBullet(content: CvContent, key: CvSectionKey, itemId: string, bulletId: string, on: boolean, all: string[]): CvContent {
  const c = clone(content)
  const r = ref(c, key, itemId)
  if (!r) return c
  const ids = r.bullet_ids ?? [...all]
  r.bullet_ids = on ? (ids.includes(bulletId) ? ids : [...ids, bulletId]) : ids.filter((x) => x !== bulletId)
  return c
}

export function moveBullet(content: CvContent, key: CvSectionKey, itemId: string, bulletId: string, dir: -1 | 1, all: string[]): CvContent {
  const c = clone(content)
  const r = ref(c, key, itemId)
  if (!r) return c
  const ids = r.bullet_ids ?? [...all]
  swap(ids, ids.indexOf(bulletId), dir)
  r.bullet_ids = ids
  return c
}

/** A rewrite equal to the profile text is stored as "no override". */
export function setBulletOverride(content: CvContent, key: CvSectionKey, itemId: string, bulletId: string, text: string, profileText: string): CvContent {
  const c = clone(content)
  const r = ref(c, key, itemId)
  if (!r) return c
  const o = { ...(r.bullet_overrides ?? {}) }
  if (text.trim() === profileText.trim()) delete o[bulletId]
  else o[bulletId] = text
  r.bullet_overrides = o
  return c
}

export function setFieldOverride(content: CvContent, key: CvSectionKey, itemId: string, field: string, value: string, profileValue: string): CvContent {
  const c = clone(content)
  const r = ref(c, key, itemId)
  if (!r) return c
  const o = { ...(r.overrides ?? {}) }
  if (value.trim() === profileValue.trim()) delete o[field]
  else o[field] = value
  r.overrides = o
  return c
}

export function applyDrops(
  content: CvContent,
  drops: { kind: "item" | "bullet"; item_id: string; bullet_id?: string }[],
  bulletsOf: (itemId: string) => string[],
): CvContent {
  let c = clone(content)
  for (const d of drops) {
    const s = c.sections.find((x) => x.items.some((i) => i.item_id === d.item_id))
    if (!s) continue
    c = d.kind === "item" ? toggleEntry(c, s.key, d.item_id, false) : toggleBullet(c, s.key, d.item_id, d.bullet_id!, false, bulletsOf(d.item_id))
  }
  return c
}
