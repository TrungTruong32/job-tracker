"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { ArrowDown, ArrowUp, FileUp, Mail, MapPin, Pencil, Phone, Plus, Search, UserRound } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { normalize } from "@/lib/board/filter"
import { moveItem } from "@/lib/data/profile-actions"
import { itemDates, itemSubtitle, itemTitle, safeItem, SECTIONS, type Basics, type ProfileItem, type Section } from "@/lib/profile/schema"
import { cn } from "@/lib/utils"
import { BasicsDialog } from "./basics-dialog"
import { ItemDialog } from "./item-dialog"

function searchText(it: ProfileItem): string {
  return normalize(JSON.stringify(it.data) + " " + it.tags.join(" "))
}

export function ProfileView({ basics, items }: { basics: Basics; items: ProfileItem[] }) {
  const [q, setQ] = useState("")
  const [tag, setTag] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ section: Section; item?: ProfileItem } | null>(null)
  const [basicsOpen, setBasicsOpen] = useState(false)
  const [, startTransition] = useTransition()

  const allTags = useMemo(() => [...new Set(items.flatMap((i) => i.tags))].sort(), [items])
  const shown = useMemo(() => {
    const terms = normalize(q).split(/\s+/).filter(Boolean)
    return items.filter((i) => (!tag || i.tags.includes(tag)) && terms.every((t) => searchText(i).includes(t)))
  }, [items, q, tag])
  const filtering = !!q.trim() || !!tag

  const move = (it: ProfileItem, dir: -1 | 1) =>
    startTransition(async () => {
      const res = await moveItem(it.id, it.section, dir)
      if (!res.ok) toast.error(res.error)
    })

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl">Hồ sơ</h1>
        <Button render={<Link href="/profile/import" />} nativeButton={false}>
          <FileUp /> Nhập từ CV
        </Button>
      </div>

      {/* basics */}
      <button
        type="button"
        onClick={() => setBasicsOpen(true)}
        className="group w-full rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40"
        aria-label="Sửa thông tin cá nhân"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <UserRound className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{basics.full_name || "Chưa có tên"}</p>
            {basics.headline && <p className="text-sm text-muted-foreground">{basics.headline}</p>}
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {basics.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="size-3" /> {basics.email}
                </span>
              )}
              {basics.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3" /> {basics.phone}
                </span>
              )}
              {basics.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" /> {basics.location}
                </span>
              )}
              {basics.links.map((l) => (
                <span key={l.url}>{l.label || l.url}</span>
              ))}
            </p>
            {basics.summary && <p className="mt-2 line-clamp-3 text-sm">{basics.summary}</p>}
          </div>
          <Pencil className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </button>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="font-medium">Hồ sơ đang trống</p>
          <p className="mt-1 text-sm text-muted-foreground">Nhập từ CV có sẵn (PDF / .tex / text) để AI tách thành từng mục, hoặc thêm thủ công.</p>
          <Button className="mt-4" render={<Link href="/profile/import" />} nativeButton={false}>
            <FileUp /> Nhập từ CV
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Tìm trong hồ sơ" placeholder="Tìm kỹ năng, công ty, bullet…" className="h-9 pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc theo tag">
              {allTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tag === t}
                  onClick={() => setTag(tag === t ? null : t)}
                  className={cn("rounded-full border px-2.5 py-0.5 text-xs", tag === t ? "border-primary bg-primary text-primary-foreground" : "bg-background")}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {SECTIONS.map(({ key, label }) => {
        const list = shown.filter((i) => i.section === key)
        if (filtering && !list.length) return null
        if (!items.length && key !== "experience") return null
        return (
          <section key={key} className="rounded-xl border bg-card p-3 sm:p-4" aria-labelledby={`sec-${key}`} data-testid={`section-${key}`}>
            <div className="mb-2 flex items-center justify-between">
              <h2 id={`sec-${key}`} className="font-semibold">
                {label} <span className="text-sm font-normal text-muted-foreground">({list.length})</span>
              </h2>
              <Button size="sm" variant="ghost" onClick={() => setEditing({ section: key })} aria-label={`Thêm ${label}`}>
                <Plus /> Thêm
              </Button>
            </div>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có.</p>
            ) : (
              <ul className="divide-y">
                {list.map((it, idx) => {
                  const valid = safeItem(it.section, it.data)
                  const bullets = (Array.isArray(it.data.bullets) ? it.data.bullets : []).filter(
                    (b): b is { text: string } => typeof (b as { text?: unknown })?.text === "string",
                  )
                  return (
                    <li key={it.id} className="flex items-start gap-2 py-2">
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing({ section: key, item: it })}>
                        <p className="font-medium">
                          {itemTitle(it.section, it.data) || "(không tiêu đề)"}
                          {!valid && <Badge variant="destructive" className="ml-2">dữ liệu lỗi</Badge>}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {[itemSubtitle(it.section, it.data), itemDates(it.data)].filter(Boolean).join(" · ")}
                        </p>
                        {bullets.length > 0 && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {bullets.length} bullet · {bullets[0].text}
                          </p>
                        )}
                        {it.tags.length > 0 && (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {it.tags.map((t) => (
                              <Badge key={t} variant="secondary" className="h-5 px-1.5 text-[11px]">
                                #{t}
                              </Badge>
                            ))}
                          </span>
                        )}
                      </button>
                      {!filtering && (
                        <span className="flex shrink-0 flex-col">
                          <Button size="icon-xs" variant="ghost" aria-label="Lên" disabled={idx === 0} onClick={() => move(it, -1)}>
                            <ArrowUp />
                          </Button>
                          <Button size="icon-xs" variant="ghost" aria-label="Xuống" disabled={idx === list.length - 1} onClick={() => move(it, 1)}>
                            <ArrowDown />
                          </Button>
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}

      <ItemDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        section={editing?.section ?? "experience"}
        item={editing?.item}
        tagSuggestions={allTags}
      />
      <BasicsDialog open={basicsOpen} onOpenChange={setBasicsOpen} basics={basics} />
    </div>
  )
}
