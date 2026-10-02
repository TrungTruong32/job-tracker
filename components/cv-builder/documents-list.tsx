"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Copy, FilePlus2, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { startNavigation } from "@/components/nav/top-progress"
import { ResponsiveDialog } from "@/components/responsive-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { TEMPLATE_KEYS, TEMPLATES } from "@/lib/cv/templates/registry"
import type { TemplateKey } from "@/lib/cv/templates/types"
import { createCvDocument, deleteCvDocument } from "@/lib/data/cv-document-actions"
import type { CvDocument } from "@/lib/data/cv-documents"
import { formatDate } from "@/lib/format"

export function DocumentsList({ docs, tags, hasProfile }: { docs: CvDocument[]; tags: string[]; hasProfile: boolean }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [template, setTemplate] = useState<TemplateKey>("mine")
  const [role, setRole] = useState("")
  const [picked, setPicked] = useState<string[]>([])
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const create = (input: Parameters<typeof createCvDocument>[0]) =>
    startTransition(async () => {
      const res = await createCvDocument(input)
      if (!res.ok) return void toast.error(res.error)
      startNavigation()
      router.push(`/cv/${res.data.id}`)
    })

  return (
    <section className="space-y-3" aria-labelledby="docs-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="docs-title" className="text-lg font-semibold">
            Bản CV soạn từ hồ sơ
          </h2>
          <p className="text-sm text-muted-foreground">Chọn mục từ Hồ sơ, chọn mẫu, xuất PDF đúng 1 trang A4.</p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={!hasProfile} title={hasProfile ? undefined : "Hồ sơ đang trống"}>
          <FilePlus2 /> Tạo bản CV
        </Button>
      </div>
      {!hasProfile && (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Hồ sơ đang trống. <Link href="/profile/import" className="text-primary underline">Nhập từ CV</Link> trước để soạn bản CV.
        </p>
      )}
      {docs.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4" data-testid="cv-doc">
              <Link href={`/cv/${d.id}`} className="font-medium hover:underline">
                {d.name}
              </Link>
              <p className="text-xs text-muted-foreground">
                <Badge variant="secondary" className="mr-1">{TEMPLATES[d.template]?.label ?? d.template}</Badge>
                {d.target_role && `${d.target_role} · `}sửa {formatDate(d.updated_at)}
              </p>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => create({ name: `${d.name} (bản sao)`, copyFrom: d.id })}>
                  <Copy /> Nhân bản
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={pending}
                  onClick={() =>
                    confirm(`Xoá bản CV “${d.name}”? Các bản PDF đã lưu để nộp vẫn được giữ.`) &&
                    startTransition(async () => {
                      const res = await deleteCvDocument(d.id)
                      if (!res.ok) toast.error(res.error)
                    })
                  }
                >
                  <Trash2 /> Xoá
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ResponsiveDialog open={open} onOpenChange={setOpen} title="Tạo bản CV">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault()
            create({ name, template, target_role: role || undefined, tags: picked })
          }}
        >
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            <div className="space-y-1.5">
              <Label htmlFor="doc-name">Tên bản CV *</Label>
              <Input id="doc-name" required placeholder="vd: AI Engineer — Acme" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-tpl">Mẫu</Label>
              <NativeSelect id="doc-tpl" value={template} onChange={(e) => setTemplate(e.target.value as TemplateKey)}>
                {TEMPLATE_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {TEMPLATES[k].label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-role">Vị trí mục tiêu</Label>
              <Input id="doc-role" placeholder="AI Engineer" value={role} onChange={(e) => setRole(e.target.value)} />
            </div>
            {tags.length > 0 && (
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">Chọn mục theo tag (bỏ trống = lấy tất cả)</legend>
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <label key={t} className="flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm">
                      <input type="checkbox" checked={picked.includes(t)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, t] : p.filter((x) => x !== t)))} />#{t}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Kỹ năng và ngoại ngữ luôn được lấy; bạn chỉnh lại từng mục trong trình soạn.</p>
              </fieldset>
            )}
          </div>
          <div className="flex gap-2 border-t bg-muted/40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end">
            <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" className="flex-1 sm:flex-none" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Tạo
            </Button>
          </div>
        </form>
      </ResponsiveDialog>
    </section>
  )
}
