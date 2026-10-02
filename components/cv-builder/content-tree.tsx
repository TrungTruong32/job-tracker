"use client"

import { useState, useTransition } from "react"
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Eye, EyeOff, Pencil, RotateCcw, Upload } from "lucide-react"
import { toast } from "sonner"
import { InlinePreview } from "@/components/profile/inline-preview"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import * as ops from "@/lib/cv/content-ops"
import { DEFAULT_ORDER, DEFAULT_TITLES, type CvContent, type CvSectionKey } from "@/lib/cv/resolve"
import { promoteToProfile } from "@/lib/data/cv-document-actions"
import { itemDates, itemSubtitle, itemTitle, type Basics, type Bullet, type ProfileItem } from "@/lib/profile/schema"
import { cn } from "@/lib/utils"

type Props = {
  content: CvContent
  onChange: (c: CvContent) => void
  items: ProfileItem[]
  basics: Basics
}

const bulletsOf = (it: ProfileItem) => (Array.isArray(it.data.bullets) ? (it.data.bullets as Bullet[]).filter((b) => typeof b?.text === "string") : [])

function BulletRow({
  b,
  chosen,
  override,
  canUp,
  canDown,
  onToggle,
  onMove,
  onEdit,
  onPromote,
}: {
  b: Bullet
  chosen: boolean
  override?: string
  canUp: boolean
  canDown: boolean
  onToggle: (on: boolean) => void
  onMove: (d: -1 | 1) => void
  onEdit: (text: string) => void
  onPromote: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(override ?? b.text)
  const text = override ?? b.text
  return (
    <li className={cn("flex items-start gap-2 py-1 text-sm", !chosen && "opacity-50")}>
      <input type="checkbox" className="mt-1" checked={chosen} onChange={(e) => onToggle(e.target.checked)} aria-label={`Dùng bullet: ${text.slice(0, 40)}`} />
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="space-y-1.5">
            <Textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Viết lại bullet cho bản CV này" />
            <div className="flex gap-1.5">
              <Button
                size="xs"
                onClick={() => {
                  onEdit(draft)
                  setEditing(false)
                }}
              >
                Xong
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setEditing(false)}>
                Huỷ
              </Button>
            </div>
          </div>
        ) : (
          <InlinePreview text={text} />
        )}
        {override !== undefined && !editing && (
          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-amber-500/15 px-1.5 text-amber-800 dark:text-amber-200">đã sửa riêng</span>
            <button type="button" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" onClick={() => onEdit(b.text)}>
              <RotateCcw className="size-3" /> Khôi phục
            </button>
            <button type="button" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" onClick={onPromote}>
              <Upload className="size-3" /> Cập nhật vào hồ sơ
            </button>
          </span>
        )}
      </div>
      {!editing && (
        <span className="flex shrink-0">
          <Button size="icon-xs" variant="ghost" aria-label="Sửa riêng cho bản này" onClick={() => (setDraft(text), setEditing(true))}>
            <Pencil />
          </Button>
          {chosen && (
            <>
              <Button size="icon-xs" variant="ghost" aria-label="Lên" disabled={!canUp} onClick={() => onMove(-1)}>
                <ArrowUp />
              </Button>
              <Button size="icon-xs" variant="ghost" aria-label="Xuống" disabled={!canDown} onClick={() => onMove(1)}>
                <ArrowDown />
              </Button>
            </>
          )}
        </span>
      )}
    </li>
  )
}

function ItemBlock({ sectionKey, it, props, index, count }: { sectionKey: CvSectionKey; it: ProfileItem; props: Props; index: number; count: number }) {
  const { content, onChange } = props
  const ref = content.sections.find((s) => s.key === sectionKey)?.items.find((r) => r.item_id === it.id)
  const chosen = !!ref
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()
  const all = bulletsOf(it)
  const allIds = all.map((b) => b.id)
  const chosenIds = ref ? (ref.bullet_ids ?? allIds) : []
  const ordered = [...chosenIds.flatMap((id) => all.filter((b) => b.id === id)), ...all.filter((b) => !chosenIds.includes(b.id))]
  const title = ref?.overrides?.title ?? ref?.overrides?.name ?? itemTitle(it.section, it.data)

  const promote = (bulletId: string, text: string) =>
    startTransition(async () => {
      const res = await promoteToProfile(it.id, { kind: "bullet", bulletId, text })
      if (!res.ok) return void toast.error(res.error)
      onChange(ops.setBulletOverride(content, sectionKey, it.id, bulletId, text, text))
      toast.success("Đã cập nhật bullet trong hồ sơ")
    })

  return (
    <li className={cn("rounded-lg border bg-background", !chosen && "border-dashed")} data-testid={`cv-item-${it.id}`}>
      <div className="flex items-start gap-2 p-2">
        <input
          type="checkbox"
          className="mt-1"
          checked={chosen}
          onChange={(e) => onChange(ops.toggleEntry(content, sectionKey, it.id, e.target.checked))}
          aria-label={`Dùng mục ${title}`}
        />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className={cn("block truncate text-sm font-medium", !chosen && "text-muted-foreground")}>
            {all.length > 0 && (open ? <ChevronDown className="mr-1 inline size-3.5" /> : <ChevronRight className="mr-1 inline size-3.5" />)}
            {title || "(không tiêu đề)"}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {[itemSubtitle(it.section, it.data), itemDates(it.data), all.length ? `${chosenIds.length}/${all.length} bullet` : ""].filter(Boolean).join(" · ")}
          </span>
        </button>
        {chosen && (
          <span className="flex shrink-0">
            <Button size="icon-xs" variant="ghost" aria-label="Lên" disabled={index === 0} onClick={() => onChange(ops.moveEntry(content, sectionKey, it.id, -1))}>
              <ArrowUp />
            </Button>
            <Button size="icon-xs" variant="ghost" aria-label="Xuống" disabled={index === count - 1} onClick={() => onChange(ops.moveEntry(content, sectionKey, it.id, 1))}>
              <ArrowDown />
            </Button>
          </span>
        )}
      </div>
      {open && chosen && all.length > 0 && (
        <ul className="border-t px-2 pb-1">
          {ordered.map((b) => {
            const isChosen = chosenIds.includes(b.id)
            const pos = chosenIds.indexOf(b.id)
            return (
              <BulletRow
                key={b.id + (ref?.bullet_overrides?.[b.id] ?? "")}
                b={b}
                chosen={isChosen}
                override={ref?.bullet_overrides?.[b.id]}
                canUp={pos > 0}
                canDown={pos >= 0 && pos < chosenIds.length - 1}
                onToggle={(on) => onChange(ops.toggleBullet(content, sectionKey, it.id, b.id, on, allIds))}
                onMove={(d) => onChange(ops.moveBullet(content, sectionKey, it.id, b.id, d, allIds))}
                onEdit={(t) => onChange(ops.setBulletOverride(content, sectionKey, it.id, b.id, t, b.text))}
                onPromote={() => promote(b.id, ref?.bullet_overrides?.[b.id] ?? b.text)}
              />
            )
          })}
        </ul>
      )}
    </li>
  )
}

export function ContentTree(props: Props) {
  const { content, onChange, items, basics } = props
  // every section that has profile items (or summary) shows up, in document order then default order
  // sections with nothing in the profile are hidden (summary always shows)
  const relevant = (k: CvSectionKey) => k === "summary" || items.some((i) => i.section === k)
  const keys = [
    ...content.sections.map((s) => s.key).filter(relevant),
    ...DEFAULT_ORDER.filter((k) => !content.sections.some((s) => s.key === k) && relevant(k)),
  ]
  return (
    <div className="space-y-3">
      {keys.map((key, si) => {
        const sec = content.sections.find((s) => s.key === key)
        const visible = sec?.visible ?? false
        const chosenOrder = sec?.items.map((r) => r.item_id) ?? []
        const sectionItems = items.filter((i) => i.section === key)
        const chosen = chosenOrder.flatMap((id) => sectionItems.filter((i) => i.id === id))
        const rest = sectionItems.filter((i) => !chosenOrder.includes(i.id)).sort((a, b) => a.position - b.position)
        return (
          <section key={key} className={cn("rounded-xl border bg-card p-2.5", !visible && "opacity-60")} data-testid={`cv-section-${key}`}>
            <div className="mb-2 flex items-center gap-1.5">
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={visible ? "Ẩn mục" : "Hiện mục"}
                onClick={() => onChange(ops.toggleSection(content, key, !visible))}
              >
                {visible ? <Eye /> : <EyeOff />}
              </Button>
              <Input
                aria-label="Tiêu đề mục"
                className="h-7 flex-1 border-transparent bg-transparent px-1 font-semibold shadow-none hover:border-input"
                value={sec?.title ?? DEFAULT_TITLES[key]}
                onChange={(e) => onChange(ops.renameSection(content, key, e.target.value))}
              />
              <Button size="icon-xs" variant="ghost" aria-label="Đưa mục lên" disabled={si === 0 || !sec} onClick={() => onChange(ops.moveSection(content, key, -1))}>
                <ArrowUp />
              </Button>
              <Button size="icon-xs" variant="ghost" aria-label="Đưa mục xuống" disabled={!sec || si >= content.sections.length - 1} onClick={() => onChange(ops.moveSection(content, key, 1))}>
                <ArrowDown />
              </Button>
            </div>
            {key === "summary" ? (
              <div className="space-y-1">
                <Textarea
                  rows={4}
                  aria-label="Summary cho bản CV này"
                  value={content.summary_override ?? basics.summary ?? ""}
                  onChange={(e) => {
                    const v = e.target.value
                    onChange({ ...ops.toggleSection(content, "summary", true), summary_override: v === (basics.summary ?? "") ? undefined : v })
                  }}
                />
                {content.summary_override !== undefined && (
                  <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => onChange({ ...content, summary_override: undefined })}>
                    <RotateCcw className="size-3" /> Dùng summary của hồ sơ
                  </button>
                )}
              </div>
            ) : (
              <ul className="space-y-1.5">
                {[...chosen, ...rest].map((it, i) => (
                  <ItemBlock key={it.id} sectionKey={key} it={it} props={props} index={i} count={chosen.length} />
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
