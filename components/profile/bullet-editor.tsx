"use client"

import { useRef } from "react"
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toBullets } from "@/lib/profile/normalize"
import type { Bullet } from "@/lib/profile/schema"

/** Edit a bullet list: Enter adds a bullet below, pasting several lines splits them, ↑↓ reorder. */
export function BulletEditor({ value, onChange }: { value: Bullet[]; onChange: (v: Bullet[]) => void }) {
  const refs = useRef<Map<string, HTMLTextAreaElement>>(new Map())
  const focusLater = (id: string) => setTimeout(() => refs.current.get(id)?.focus(), 0)

  const set = (i: number, text: string) => onChange(value.map((b, j) => (j === i ? { ...b, text } : b)))
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i))
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= value.length) return
    const c = [...value]
    ;[c[i], c[j]] = [c[j], c[i]]
    onChange(c)
  }

  return (
    <div className="space-y-2">
      <ol className="space-y-1.5">
        {value.map((b, i) => (
          <li key={b.id} className="flex items-start gap-1.5">
            <span className="mt-2 text-muted-foreground">•</span>
            <textarea
              ref={(el) => {
                if (el) refs.current.set(b.id, el)
                else refs.current.delete(b.id)
              }}
              aria-label={`Bullet ${i + 1}`}
              rows={Math.min(4, Math.max(1, Math.ceil(b.text.length / 70)))}
              className="min-h-8 flex-1 resize-y rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              value={b.text}
              onChange={(e) => set(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  const fresh = { id: crypto.randomUUID(), text: "" }
                  onChange([...value.slice(0, i + 1), fresh, ...value.slice(i + 1)])
                  focusLater(fresh.id)
                } else if (e.key === "Backspace" && !b.text && value.length > 1) {
                  e.preventDefault()
                  remove(i)
                  const prev = value[i - 1] ?? value[i + 1]
                  if (prev) focusLater(prev.id)
                }
              }}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text")
                if (!text.includes("\n")) return
                e.preventDefault()
                const parts = toBullets(text)
                if (!parts.length) return
                const [first, ...rest] = parts
                const merged = value.map((x, j) => (j === i ? { ...x, text: (x.text + " " + first.text).trim() } : x))
                onChange([...merged.slice(0, i + 1), ...rest, ...merged.slice(i + 1)])
              }}
            />
            <span className="flex shrink-0">
              <Button type="button" size="icon-xs" variant="ghost" aria-label="Lên" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp />
              </Button>
              <Button type="button" size="icon-xs" variant="ghost" aria-label="Xuống" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown />
              </Button>
              <Button type="button" size="icon-xs" variant="ghost" aria-label={`Xoá bullet ${i + 1}`} onClick={() => remove(i)}>
                <X />
              </Button>
            </span>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          const fresh = { id: crypto.randomUUID(), text: "" }
          onChange([...value, fresh])
          focusLater(fresh.id)
        }}
      >
        <Plus /> Thêm bullet
      </Button>
      <p className="text-xs text-muted-foreground">Enter: bullet mới · Shift+Enter: xuống dòng · dán nhiều dòng: tự tách bullet</p>
    </div>
  )
}
