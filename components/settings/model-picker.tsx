"use client"

import { useMemo, useState } from "react"
import { Plus, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { normalize } from "@/lib/board/filter"
import type { ModelInfo } from "@/lib/ai/models"

const MAX_ROWS = 60

/** Searchable list of a connection's models with a "free only" filter (when prices are known). */
export function ModelPicker({
  models,
  isAdded,
  canAdd,
  onAdd,
}: {
  models: ModelInfo[]
  isAdded: (id: string) => boolean
  canAdd: boolean
  onAdd: (id: string) => void
}) {
  const hasPrices = models.some((m) => m.free !== null)
  const [q, setQ] = useState("")
  const [freeOnly, setFreeOnly] = useState(hasPrices)
  const [manual, setManual] = useState("")
  const addManual = () => {
    if (!manual.trim()) return
    onAdd(manual.trim())
    setManual("")
  }

  const shown = useMemo(() => {
    const terms = normalize(q).split(/\s+/).filter(Boolean)
    return models.filter(
      (m) => (!freeOnly || m.free === true) && terms.every((t) => normalize(`${m.id} ${m.name}`).includes(t)),
    )
  }, [models, q, freeOnly])

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-2" data-testid="model-picker">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Tìm model" placeholder="Tìm model…" className="h-8 pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {hasPrices && (
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={freeOnly} onCheckedChange={setFreeOnly} aria-label="Chỉ model miễn phí" /> Chỉ miễn phí
          </label>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {shown.length} / {models.length} model{shown.length > MAX_ROWS ? ` — hiện ${MAX_ROWS} đầu, gõ để lọc thêm` : ""}
      </p>
      <ul className="max-h-64 divide-y overflow-y-auto rounded-md border bg-background">
        {shown.slice(0, MAX_ROWS).map((m) => (
          <li key={m.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-xs" title={m.id}>
                {m.id}
              </span>
              {m.name !== m.id && <span className="block truncate text-xs text-muted-foreground">{m.name}</span>}
            </span>
            {m.free === true && <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-200">Free</Badge>}
            {m.context && <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">{Math.round(m.context / 1000)}k</span>}
            <Button
              type="button"
              size="xs"
              variant={isAdded(m.id) ? "ghost" : "outline"}
              disabled={isAdded(m.id) || !canAdd}
              onClick={() => onAdd(m.id)}
              aria-label={`Thêm ${m.id} vào chuỗi`}
            >
              {isAdded(m.id) ? "Đã thêm" : <><Plus /> Thêm</>}
            </Button>
          </li>
        ))}
        {!shown.length && <li className="px-2 py-4 text-center text-xs text-muted-foreground">Không có model khớp</li>}
      </ul>
      {/* not a <form>: this lives inside the settings form */}
      <div className="flex gap-2">
        <Input
          aria-label="Tên model thủ công"
          placeholder="Hoặc gõ tên model"
          className="h-8"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addManual()
            }
          }}
        />
        <Button type="button" size="sm" variant="outline" disabled={!canAdd || !manual.trim()} onClick={addManual}>
          Thêm
        </Button>
      </div>
    </div>
  )
}
