"use client"

import { useState, useTransition } from "react"
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { saveStages } from "@/lib/data/actions"
import type { Stage } from "@/lib/data/types"
import type { StageKind } from "@/lib/domain"

type Row = { key: string; id: string | null; name: string; kind: StageKind }

const KIND_LABEL: Record<StageKind, string> = { active: "Đang chạy", offer: "Offer", closed: "Kết thúc" }

const toRows = (stages: Stage[]): Row[] => stages.map((s) => ({ key: s.id, id: s.id, name: s.name, kind: s.kind }))

export function StagesEditor({ stages, usage }: { stages: Stage[]; usage: Record<string, number> }) {
  const [rows, setRows] = useState<Row[]>(() => toRows(stages))
  const [pending, startTransition] = useTransition()
  const [prevStages, setPrevStages] = useState(stages)
  if (prevStages !== stages) {
    setPrevStages(stages)
    setRows(toRows(stages))
  }

  const update = (i: number, p: Partial<Row>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...p } : row)))
  const swap = (i: number, j: number) =>
    setRows((r) => {
      if (j < 0 || j >= r.length) return r
      const c = [...r]
      ;[c[i], c[j]] = [c[j], c[i]]
      return c
    })

  function save() {
    startTransition(async () => {
      const res = await saveStages(rows.map(({ id, name, kind }) => ({ id, name, kind })))
      if (res.ok) toast.success("Đã lưu các vòng")
      else toast.error(res.error)
    })
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h2 className="font-semibold">Các vòng</h2>
        <p className="text-xs text-muted-foreground">
          Thứ tự ở đây là thứ tự cột Kanban. Vòng đầu tiên là vòng mặc định khi thêm đơn. “Kết thúc” không bị nhắc follow-up.
        </p>
      </div>
      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.key} className="flex items-center gap-1.5">
            <div className="flex flex-col">
              <Button type="button" size="icon-xs" variant="ghost" aria-label="Lên" disabled={i === 0} onClick={() => swap(i, i - 1)}>
                <ArrowUp />
              </Button>
              <Button type="button" size="icon-xs" variant="ghost" aria-label="Xuống" disabled={i === rows.length - 1} onClick={() => swap(i, i + 1)}>
                <ArrowDown />
              </Button>
            </div>
            <Input aria-label="Tên vòng" className="flex-1" value={r.name} onChange={(e) => update(i, { name: e.target.value })} />
            <NativeSelect aria-label="Loại vòng" className="w-32" value={r.kind} onChange={(e) => update(i, { kind: e.target.value as StageKind })}>
              {(Object.keys(KIND_LABEL) as StageKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </NativeSelect>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Xoá vòng ${r.name}`}
              disabled={!!(r.id && usage[r.id])}
              title={r.id && usage[r.id] ? `Đang có ${usage[r.id]} đơn ở vòng này` : undefined}
              onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setRows((r) => [...r, { key: crypto.randomUUID(), id: null, name: "", kind: "active" }])}
        >
          <Plus /> Thêm vòng
        </Button>
        <Button type="button" onClick={save} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Lưu các vòng
        </Button>
      </div>
    </section>
  )
}
