"use client"

import { useState, useTransition } from "react"
import { Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { ResponsiveDialog } from "@/components/responsive-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { saveBasics } from "@/lib/data/profile-actions"
import type { Basics } from "@/lib/profile/schema"

const FIELDS: { key: Exclude<keyof Basics, "links" | "summary">; label: string; type?: string }[] = [
  { key: "full_name", label: "Họ tên" },
  { key: "headline", label: "Tiêu đề nghề nghiệp" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Điện thoại", type: "tel" },
  { key: "location", label: "Địa chỉ" },
]

export function BasicsDialog({ open, onOpenChange, basics }: { open: boolean; onOpenChange: (o: boolean) => void; basics: Basics }) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Thông tin cá nhân">
      {open && <BasicsForm basics={basics} onDone={() => onOpenChange(false)} />}
    </ResponsiveDialog>
  )
}

function BasicsForm({ basics, onDone }: { basics: Basics; onDone: () => void }) {
  const [v, setV] = useState<Basics>(() => ({ ...basics, links: basics.links ?? [] }))
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await saveBasics({ ...v, links: v.links.filter((l) => l.url.trim()) })
      if (!res.ok) return void toast.error(res.error)
      toast.success("Đã lưu thông tin cá nhân")
      onDone()
    })
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`b-${f.key}`}>{f.label}</Label>
              <Input id={`b-${f.key}`} type={f.type ?? "text"} value={v[f.key] ?? ""} onChange={(e) => setV((p) => ({ ...p, [f.key]: e.target.value }))} />
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label>Link</Label>
          {v.links.map((l, i) => (
            <div key={i} className="flex flex-wrap gap-2 sm:flex-nowrap">
              <Input
                aria-label="Tên link"
                placeholder="LinkedIn"
                className="w-32"
                value={l.label}
                onChange={(e) => setV((p) => ({ ...p, links: p.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) }))}
              />
              <Input
                aria-label="URL"
                type="url"
                placeholder="https://"
                className="min-w-0 flex-1 basis-40"
                value={l.url}
                onChange={(e) => setV((p) => ({ ...p, links: p.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) }))}
              />
              <Input
                aria-label="Chữ hiện trên CV"
                placeholder="Chữ hiện trên CV"
                className="w-36"
                value={l.text ?? ""}
                onChange={(e) => setV((p) => ({ ...p, links: p.links.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) }))}
              />
              <Button type="button" size="icon" variant="ghost" aria-label="Xoá link" onClick={() => setV((p) => ({ ...p, links: p.links.filter((_, j) => j !== i) }))}>
                <X />
              </Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={() => setV((p) => ({ ...p, links: [...p.links, { label: "", url: "" }] }))}>
            <Plus /> Thêm link
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b-summary">Giới thiệu (summary)</Label>
          <Textarea id="b-summary" rows={5} value={v.summary ?? ""} onChange={(e) => setV((p) => ({ ...p, summary: e.target.value }))} />
        </div>
      </div>
      <div className="flex gap-2 border-t bg-muted/40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end">
        <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={onDone}>
          Huỷ
        </Button>
        <Button type="submit" className="flex-1 sm:flex-none" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Lưu
        </Button>
      </div>
    </form>
  )
}
