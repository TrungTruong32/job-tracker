"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, Info, Loader2, PlugZap } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { aiTestConnection } from "@/lib/ai/browser"
import { PROVIDER_PRESETS, type AiProvider } from "@/lib/ai/providers"
import { saveSettings } from "@/lib/data/actions"
import type { PublicSettings } from "@/lib/data/types"

export function SettingsForm({ settings }: { settings: PublicSettings }) {
  const [provider, setProvider] = useState<AiProvider>(settings.ai_provider)
  const [baseUrl, setBaseUrl] = useState(settings.ai_base_url ?? PROVIDER_PRESETS[settings.ai_provider].baseUrl)
  const [model, setModel] = useState(settings.ai_model ?? "")
  const [apiKey, setApiKey] = useState("")
  const [removeKey, setRemoveKey] = useState(false)
  const [staleDays, setStaleDays] = useState(String(settings.stale_days))
  const [testing, setTesting] = useState(false)
  const [pending, startTransition] = useTransition()
  const preset = PROVIDER_PRESETS[provider]
  const needsKey = provider !== "ollama"

  function changeProvider(p: AiProvider) {
    setProvider(p)
    if (PROVIDER_PRESETS[p].baseUrl) setBaseUrl(PROVIDER_PRESETS[p].baseUrl)
  }

  async function test() {
    setTesting(true)
    try {
      const { ms } = await aiTestConnection({ provider, baseUrl, model, apiKey: apiKey || undefined })
      toast.success(`Kết nối OK (${(ms / 1000).toFixed(1)}s)`, { description: `Model ${model} trả lời được.` })
    } catch (e) {
      toast.error("Kết nối thất bại", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setTesting(false)
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await saveSettings({
        ai_provider: provider,
        ai_base_url: baseUrl,
        ai_model: model,
        ai_api_key: removeKey ? "" : apiKey ? apiKey : undefined,
        stale_days: staleDays,
      })
      if (!res.ok) return void toast.error(res.error)
      toast.success("Đã lưu cài đặt")
      setApiKey("")
      setRemoveKey(false)
    })
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <section className="space-y-4 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">AI</h2>
          {settings.ai_ready && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-4" /> Đã cấu hình
            </span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="provider">Nhà cung cấp</Label>
            <NativeSelect id="provider" value={provider} onChange={(e) => changeProvider(e.target.value as AiProvider)}>
              {(Object.keys(PROVIDER_PRESETS) as AiProvider[]).map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_PRESETS[p].label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="model">Model</Label>
            <Input id="model" placeholder={preset.modelHint} value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="base-url">Base URL</Label>
            <Input id="base-url" type="url" inputMode="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </div>
          {needsKey && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="api-key">API key</Label>
              <Input
                id="api-key"
                type="password"
                autoComplete="off"
                placeholder={settings.ai_key_mask ? `Đã lưu ${settings.ai_key_mask} — để trống để giữ nguyên` : "Dán API key"}
                value={apiKey}
                disabled={removeKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              {settings.ai_key_mask && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={removeKey} onChange={(e) => setRemoveKey(e.target.checked)} /> Xoá key đã lưu
                </label>
              )}
              {settings.ai_key_mask && !apiKey && baseUrl.replace(/\/+$/, "") !== (settings.ai_base_url ?? "").replace(/\/+$/, "") && (
                <p className="text-xs text-amber-700 dark:text-amber-300">Base URL đã đổi: key cũ sẽ bị xoá khi lưu, hãy nhập key cho nhà cung cấp mới.</p>
              )}
              <p className="text-xs text-muted-foreground">Key được mã hoá trên server, chỉ gửi tới đúng Base URL đã lưu cùng nó.</p>
            </div>
          )}
        </div>
        {preset.note && (
          <p className="flex gap-2 rounded-lg bg-muted/60 p-3 text-xs">
            <Info className="size-4 shrink-0" /> {preset.note}
          </p>
        )}
        <Button type="button" variant="outline" onClick={test} disabled={testing || !model || !baseUrl}>
          {testing ? <Loader2 className="animate-spin" /> : <PlugZap />} Test kết nối
        </Button>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Follow-up</h2>
        <div className="flex items-center gap-3">
          <Label htmlFor="stale-days" className="flex-1 font-normal">
            Đơn không có cập nhật quá bao nhiêu ngày thì nhắc?
          </Label>
          <Input id="stale-days" type="number" min={1} max={90} className="w-20" value={staleDays} onChange={(e) => setStaleDays(e.target.value)} />
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending && <Loader2 className="animate-spin" />} Lưu cài đặt
        </Button>
      </div>
    </form>
  )
}
