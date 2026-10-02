"use client"

import { useState, useTransition } from "react"
import { Copy, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ResponsiveDialog } from "@/components/responsive-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createItem, deleteItem, duplicateItem, updateItem } from "@/lib/data/profile-actions"
import { normalizeEnd, normalizeMonth } from "@/lib/profile/normalize"
import { sectionLabel, type Bullet, type ProfileItem, type Section } from "@/lib/profile/schema"
import { cn } from "@/lib/utils"
import { BulletEditor } from "./bullet-editor"
import { FIELDS, HAS_BULLETS, type Field } from "./fields"

type Draft = Record<string, string> & { _bullets?: never }

function toDraft(section: Section, data: Record<string, unknown>): Draft {
  const d: Draft = {} as Draft
  for (const f of FIELDS[section]) {
    const v = data[f.key]
    if (f.type === "list") d[f.key] = Array.isArray(v) ? (v as string[]).join(", ") : ""
    else if (typeof v !== "string") d[f.key] = ""
    // show stored "YYYY-MM" the way people type it ("MM/YYYY"); saving normalizes it back
    else if ((f.type === "month" || f.type === "end") && /^\d{4}-\d{2}$/.test(v)) d[f.key] = `${v.slice(5)}/${v.slice(0, 4)}`
    else d[f.key] = v
  }
  return d
}

function fromDraft(section: Section, d: Draft, bullets: Bullet[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of FIELDS[section]) {
    const v = (d[f.key] ?? "").trim()
    if (f.type === "list") out[f.key] = v.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)
    else if (!v) continue
    else if (f.type === "month") out[f.key] = normalizeMonth(v)
    else if (f.type === "end") out[f.key] = normalizeEnd(v)
    else out[f.key] = v
  }
  if (HAS_BULLETS.includes(section)) out.bullets = bullets.map((b) => ({ ...b, text: b.text.trim() })).filter((b) => b.text)
  return out
}

export function ItemDialog({
  open,
  onOpenChange,
  section,
  item,
  tagSuggestions,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  section: Section
  item?: ProfileItem
  tagSuggestions: string[]
}) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={`${item ? "Sửa" : "Thêm"} · ${sectionLabel(section)}`}>
      {open && <ItemForm section={section} item={item} tagSuggestions={tagSuggestions} onDone={() => onOpenChange(false)} />}
    </ResponsiveDialog>
  )
}

function FieldInput({ f, value, onChange }: { f: Field; value: string; onChange: (v: string) => void }) {
  const id = `f-${f.key}`
  if (f.type === "textarea") return <Textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
  if (f.type === "end") {
    const present = value === "present"
    return (
      <div className="flex items-center gap-2">
        <Input id={id} placeholder="MM/YYYY" value={present ? "" : value} disabled={present} onChange={(e) => onChange(e.target.value)} />
        <label className="flex shrink-0 items-center gap-1.5 text-xs">
          <input type="checkbox" checked={present} onChange={(e) => onChange(e.target.checked ? "present" : "")} /> Hiện tại
        </label>
      </div>
    )
  }
  return (
    <Input
      id={id}
      type={f.type === "url" ? "url" : "text"}
      inputMode={f.type === "url" ? "url" : undefined}
      placeholder={f.placeholder ?? (f.type === "month" ? "MM/YYYY hoặc YYYY" : undefined)}
      required={f.required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function ItemForm({ section, item, tagSuggestions, onDone }: { section: Section; item?: ProfileItem; tagSuggestions: string[]; onDone: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(section, item?.data ?? {}))
  const [bullets, setBullets] = useState<Bullet[]>(() =>
    Array.isArray(item?.data.bullets) ? (item!.data.bullets as Bullet[]) : [{ id: crypto.randomUUID(), text: "" }],
  )
  const [tags, setTags] = useState((item?.tags ?? []).join(", "))
  const [pending, startTransition] = useTransition()

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) return void toast.error(res.error)
      toast.success(msg)
      onDone()
    })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const data = fromDraft(section, draft, bullets)
    const tagList = tags.split(/[,;]/).map((t) => t.trim().toLowerCase()).filter(Boolean)
    run(() => (item ? updateItem(item.id, section, data, tagList) : createItem(section, data, tagList)), item ? "Đã lưu" : "Đã thêm")
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS[section].map((f) => (
            <div key={f.key} className={cn("space-y-1.5", f.wide && "sm:col-span-2")}>
              <Label htmlFor={`f-${f.key}`}>
                {f.label}
                {f.required && " *"}
              </Label>
              <FieldInput f={f} value={draft[f.key] ?? ""} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }) as Draft)} />
            </div>
          ))}
        </div>
        {HAS_BULLETS.includes(section) && (
          <div className="space-y-1.5">
            <Label>Bullet</Label>
            <BulletEditor value={bullets} onChange={setBullets} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="f-tags">Tag</Label>
          <Input id="f-tags" list="tag-suggestions" placeholder="ai, data, backend" value={tags} onChange={(e) => setTags(e.target.value)} />
          <datalist id="tag-suggestions">
            {tagSuggestions.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <p className="text-xs text-muted-foreground">Dùng để chọn nhanh mục khi soạn CV theo vị trí.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t bg-muted/40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {item && (
          <>
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              disabled={pending}
              onClick={() => confirm("Xoá mục này?") && run(() => deleteItem(item.id), "Đã xoá")}
            >
              <Trash2 /> Xoá
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => run(() => duplicateItem(item.id), "Đã nhân bản")}>
              <Copy /> Nhân bản
            </Button>
          </>
        )}
        <span className="flex-1" />
        <Button type="button" variant="outline" onClick={onDone}>
          Huỷ
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Lưu
        </Button>
      </div>
    </form>
  )
}
