"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowDown, ArrowUp, Download, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { filterApps, sortApps, type BoardFilters, type SortKey } from "@/lib/board/filter"
import { toCsv } from "@/lib/csv"
import type { Application, CvVersion, Stage } from "@/lib/data/types"
import { formatDate, relativeDays } from "@/lib/format"
import { cn } from "@/lib/utils"
import { MoveMenu, scoreClass } from "./app-card"

type Props = {
  apps: Application[]
  stages: Stage[]
  cvs: CvVersion[]
  onMove: (appId: string, stageId: string) => void
  today: Date
}

function SortBtn({
  k,
  sort,
  onToggle,
  children,
}: {
  k: SortKey
  sort: { key: SortKey; dir: "asc" | "desc" }
  onToggle: (k: SortKey) => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(k)}
      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
    >
      {children}
      {sort.key === k && (sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
    </button>
  )
}

export function TableView({ apps, stages, cvs, onMove, today }: Props) {
  const [f, setF] = useState<BoardFilters>({})
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "applied_at", dir: "desc" })
  const stageName = useMemo(() => new Map(stages.map((s) => [s.id, s.name])), [stages])
  const cvName = useMemo(() => new Map(cvs.map((c) => [c.id, c.name])), [cvs])
  const sources = useMemo(() => [...new Set(apps.map((a) => a.source).filter(Boolean))].sort() as string[], [apps])

  const rows = useMemo(() => sortApps(filterApps(apps, f), sort.key, sort.dir), [apps, f, sort])
  const set = (k: keyof BoardFilters, v: string) => setF((p) => ({ ...p, [k]: v || undefined }))
  const hasFilters = Object.values(f).some(Boolean)

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "company" ? "asc" : "desc" }))
  }

  function exportCsv() {
    const csv = toCsv(
      ["Ngày nộp", "Công ty", "Vị trí", "Vòng", "Nguồn", "Bản CV", "Lương", "Địa điểm", "Link JD", "Việc tiếp", "Hạn", "Điểm phù hợp"],
      rows.map((a) => [
        a.applied_at,
        a.company,
        a.position,
        stageName.get(a.stage_id),
        a.source,
        a.cv_version_id ? cvName.get(a.cv_version_id) : "",
        a.salary,
        a.location,
        a.jd_url,
        a.next_action,
        a.next_action_due,
        a.ai_fit?.score ?? "",
      ]),
    )
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const link = Object.assign(document.createElement("a"), { href: url, download: `don-ung-tuyen-${new Date().toISOString().slice(0, 10)}.csv` })
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] xl:grid-cols-[1fr_repeat(5,auto)_auto]">
        <div className="relative sm:col-span-3 xl:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Tìm kiếm"
            placeholder="Tìm công ty, vị trí, nội dung JD…"
            className="h-9 pl-8"
            value={f.q ?? ""}
            onChange={(e) => set("q", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:col-span-3 xl:col-span-3">
          <NativeSelect aria-label="Lọc theo vòng" value={f.stageId ?? ""} onChange={(e) => set("stageId", e.target.value)}>
            <option value="">Mọi vòng</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="Lọc theo nguồn" value={f.source ?? ""} onChange={(e) => set("source", e.target.value)}>
            <option value="">Mọi nguồn</option>
            {sources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="Lọc theo CV" value={f.cvId ?? ""} onChange={(e) => set("cvId", e.target.value)}>
            <option value="">Mọi CV</option>
            {cvs.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:col-span-2 xl:col-span-2">
          <Input type="date" aria-label="Nộp từ ngày" className="h-9" value={f.from ?? ""} onChange={(e) => set("from", e.target.value)} />
          <Input type="date" aria-label="Nộp đến ngày" className="h-9" value={f.to ?? ""} onChange={(e) => set("to", e.target.value)} />
        </div>
        <div className="flex gap-2">
          {hasFilters && (
            <Button variant="ghost" size="lg" onClick={() => setF({})}>
              <X /> Xoá lọc
            </Button>
          )}
          <Button variant="outline" size="lg" onClick={exportCsv} disabled={!rows.length}>
            <Download /> CSV
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{rows.length} / {apps.length} đơn</p>

      {/* Phone: cards */}
      <ul className="space-y-2 sm:hidden">
        {rows.map((a) => (
          <li key={a.id} className="relative rounded-xl border bg-card p-3 text-sm">
            <div className="flex items-start gap-2">
              <Link href={`/applications/${a.id}`} className="min-w-0 flex-1">
                <p className="truncate font-semibold">{a.company}</p>
                <p className="truncate text-muted-foreground">{a.position}</p>
              </Link>
              <MoveMenu app={a} stages={stages} onMove={onMove} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{stageName.get(a.stage_id)}</span>
              <span>Nộp {formatDate(a.applied_at)}</span>
              {a.source && <span>{a.source}</span>}
              {a.ai_fit && <span className={cn("rounded px-1", scoreClass(a.ai_fit.score))}>{a.ai_fit.score}%</span>}
            </div>
          </li>
        ))}
      </ul>

      {/* Tablet / laptop: table */}
      <div className="hidden overflow-x-auto rounded-xl border sm:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:whitespace-nowrap">
              <th><SortBtn k="applied_at" sort={sort} onToggle={toggleSort}>Ngày nộp</SortBtn></th>
              <th><SortBtn k="company" sort={sort} onToggle={toggleSort}>Công ty</SortBtn></th>
              <th>Vị trí</th>
              <th>Vòng</th>
              <th className="hidden xl:table-cell">Nguồn</th>
              <th className="hidden xl:table-cell">CV</th>
              <th className="hidden lg:table-cell">Phù hợp</th>
              <th><SortBtn k="last_activity_at" sort={sort} onToggle={toggleSort}>Cập nhật</SortBtn></th>
              <th className="w-10"><span className="sr-only">Thao tác</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((a) => (
              <tr key={a.id} className="hover:bg-muted/30 [&>td]:px-3 [&>td]:py-2">
                <td className="whitespace-nowrap tabular-nums">{formatDate(a.applied_at)}</td>
                <td className="max-w-48 truncate font-medium">
                  <Link href={`/applications/${a.id}`} className="hover:underline">{a.company}</Link>
                </td>
                <td className="max-w-56 truncate">{a.position}</td>
                <td className="whitespace-nowrap">{stageName.get(a.stage_id)}</td>
                <td className="hidden xl:table-cell">{a.source}</td>
                <td className="hidden max-w-40 truncate xl:table-cell">{a.cv_version_id ? cvName.get(a.cv_version_id) : ""}</td>
                <td className="hidden lg:table-cell">
                  {a.ai_fit && <span className={cn("rounded px-1.5 py-0.5 text-xs", scoreClass(a.ai_fit.score))}>{a.ai_fit.score}%</span>}
                </td>
                <td className="whitespace-nowrap text-muted-foreground">{relativeDays(a.last_activity_at, today)}</td>
                <td><MoveMenu app={a} stages={stages} onMove={onMove} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="py-10 text-center text-sm text-muted-foreground">Không có đơn nào khớp bộ lọc</p>}
      </div>
    </div>
  )
}
