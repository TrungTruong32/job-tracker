"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { TEMPLATE_KEYS, TEMPLATES } from "@/lib/cv/templates/registry"
import type { CvStyle, TemplateKey } from "@/lib/cv/templates/types"
import type { DateFormat } from "@/lib/cv/resolve"

const DATE_FORMATS: { v: DateFormat; label: string }[] = [
  { v: "MMMM YYYY", label: "June 2026" },
  { v: "MMM YYYY", label: "Jun 2026" },
  { v: "MM/YYYY", label: "06/2026" },
  { v: "YYYY", label: "2026" },
]

function Range({ id, label, value, min, max, step, unit, onChange }: { id: string; label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {value.toFixed(step < 0.1 ? 2 : 1)}
          {unit}
        </span>
      </Label>
      <input id={id} type="range" className="w-full accent-[var(--series-1)]" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

export function StylePanel({
  template,
  style,
  onTemplate,
  onStyle,
}: {
  template: TemplateKey
  style: CvStyle
  onTemplate: (t: TemplateKey) => void
  onStyle: (s: CvStyle) => void
}) {
  const b = TEMPLATES[template].bounds
  const set = <K extends keyof CvStyle>(k: K, v: CvStyle[K]) => onStyle({ ...style, [k]: v })
  return (
    <div className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-2" data-testid="style-panel">
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="tpl">Mẫu</Label>
        <NativeSelect id="tpl" value={template} onChange={(e) => onTemplate(e.target.value as TemplateKey)}>
          {TEMPLATE_KEYS.map((k) => (
            <option key={k} value={k}>
              {TEMPLATES[k].label} — {TEMPLATES[k].description}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Range id="fs" label="Cỡ chữ" unit="pt" value={style.font_size} min={b.font_size[0]} max={b.font_size[1]} step={0.25} onChange={(v) => set("font_size", v)} />
      <Range id="lh" label="Giãn dòng" unit="" value={style.line_height} min={b.line_height[0]} max={b.line_height[1]} step={0.01} onChange={(v) => set("line_height", v)} />
      <Range id="mg" label="Lề" unit="mm" value={style.margin_mm} min={b.margin_mm[0]} max={b.margin_mm[1]} step={0.25} onChange={(v) => set("margin_mm", v)} />
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="accent" className="text-xs">
            Màu nhấn
          </Label>
          <input id="accent" type="color" className="h-8 w-12 rounded border" value={style.accent} onChange={(e) => set("accent", e.target.value)} />
        </div>
        <div className="flex-1 space-y-1">
          <Label htmlFor="datefmt" className="text-xs">
            Kiểu ngày
          </Label>
          <NativeSelect id="datefmt" value={style.date_format} onChange={(e) => set("date_format", e.target.value as DateFormat)}>
            {DATE_FORMATS.map((d) => (
              <option key={d.v} value={d.v}>
                {d.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {(template === "mine" || template === "compact") && (
        <div className="space-y-1 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={style.show_qr} onChange={(e) => set("show_qr", e.target.checked)} /> Mã QR ở góc phải
          </label>
          {style.show_qr && (
            <Input aria-label="Link cho mã QR" placeholder="Mặc định: link Portfolio trong hồ sơ" value={style.qr_url ?? ""} onChange={(e) => set("qr_url", e.target.value || undefined)} />
          )}
        </div>
      )}
    </div>
  )
}
