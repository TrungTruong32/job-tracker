"use client"

import { useState, useTransition } from "react"
import { ArrowDown, ArrowUp, CheckCircle2, Download, Info, Loader2, PlugZap, Plus, Trash2, X, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { loadModels, testModel } from "@/lib/ai/browser"
import type { ModelInfo } from "@/lib/ai/models"
import { PROVIDER_PRESETS, type AiProvider } from "@/lib/ai/providers"
import { MAX_CHAIN, MAX_CONNECTIONS } from "@/lib/ai/settings"
import { saveSettings } from "@/lib/data/actions"
import type { PublicSettings } from "@/lib/data/types"
import { ModelPicker } from "./model-picker"

type Conn = {
  id: string
  provider: AiProvider
  base_url: string
  key_mask: string | null
  saved_url: string | null // URL the stored key belongs to
  api_key: string // typed, not saved yet
  remove_key: boolean
}
type Entry = { key: string; connection_id: string; model: string }
type TestState = { status: "running" } | { status: "ok"; ms: number } | { status: "fail"; message: string }

const norm = (u: string | null) => (u ?? "").trim().replace(/\/+$/, "")
const providerLabel = (p: AiProvider) => PROVIDER_PRESETS[p].label.replace(/ \(.*\)$/, "")

export function SettingsForm({ settings }: { settings: PublicSettings }) {
  const [conns, setConns] = useState<Conn[]>(() =>
    settings.connections.map((c) => ({ ...c, saved_url: c.base_url, api_key: "", remove_key: false })),
  )
  const [chain, setChain] = useState<Entry[]>(() => settings.chain.map((e) => ({ key: crypto.randomUUID(), connection_id: e.connection_id, model: e.model })))
  const [models, setModels] = useState<Record<string, ModelInfo[] | "loading">>({})
  const [tests, setTests] = useState<Record<string, TestState>>({})
  const [staleDays, setStaleDays] = useState(String(settings.stale_days))
  const [pending, startTransition] = useTransition()

  const conn = (id: string) => conns.find((c) => c.id === id)
  const updateConn = (id: string, p: Partial<Conn>) => setConns((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)))
  const keyWillDrop = (c: Conn) => !!c.key_mask && !c.api_key && !c.remove_key && norm(c.base_url) !== norm(c.saved_url)
  // the key a test/model listing may use: typed > stored (only for its own URL, enforced server-side)
  const forRequest = (c: Conn) => ({ id: c.id, provider: c.provider, base_url: c.base_url.trim(), api_key: c.remove_key ? undefined : c.api_key })

  function addConnection() {
    const used = new Set(conns.map((c) => c.provider))
    const provider = (["openrouter", "gemini", "ollama", "custom"] as AiProvider[]).find((p) => !used.has(p)) ?? "custom"
    setConns((cs) => [
      ...cs,
      { id: crypto.randomUUID(), provider, base_url: PROVIDER_PRESETS[provider].baseUrl, key_mask: null, saved_url: null, api_key: "", remove_key: false },
    ])
  }

  function removeConnection(id: string) {
    setConns((cs) => cs.filter((c) => c.id !== id))
    setChain((ch) => ch.filter((e) => e.connection_id !== id))
  }

  async function fetchModels(c: Conn) {
    setModels((m) => ({ ...m, [c.id]: "loading" }))
    try {
      const list = await loadModels(forRequest(c))
      setModels((m) => ({ ...m, [c.id]: list }))
    } catch (e) {
      setModels((m) => Object.fromEntries(Object.entries(m).filter(([id]) => id !== c.id)))
      toast.error(`Không tải được model của ${providerLabel(c.provider)}`, { description: e instanceof Error ? e.message : String(e) })
    }
  }

  function addToChain(connectionId: string, model: string) {
    if (chain.length >= MAX_CHAIN) return void toast.error(`Tối đa ${MAX_CHAIN} model`)
    if (chain.some((e) => e.connection_id === connectionId && e.model === model)) return
    setChain((ch) => [...ch, { key: crypto.randomUUID(), connection_id: connectionId, model }])
  }

  const move = (i: number, d: -1 | 1) =>
    setChain((ch) => {
      const j = i + d
      if (j < 0 || j >= ch.length) return ch
      const c = [...ch]
      ;[c[i], c[j]] = [c[j], c[i]]
      return c
    })

  async function runTest(e: Entry) {
    const c = conn(e.connection_id)
    if (!c) return
    setTests((t) => ({ ...t, [e.key]: { status: "running" } }))
    try {
      const ms = await testModel(forRequest(c), e.model)
      setTests((t) => ({ ...t, [e.key]: { status: "ok", ms } }))
    } catch (err) {
      setTests((t) => ({ ...t, [e.key]: { status: "fail", message: err instanceof Error ? err.message : String(err) } }))
    }
  }

  async function testAll() {
    // one at a time: free tiers rate-limit bursts
    for (const e of chain) await runTest(e)
  }

  function save(ev: React.FormEvent) {
    ev.preventDefault()
    startTransition(async () => {
      const res = await saveSettings({
        ai: {
          connections: conns.map((c) => ({
            id: c.id,
            provider: c.provider,
            base_url: c.base_url,
            api_key: c.remove_key ? "" : c.api_key ? c.api_key : undefined,
          })),
          chain: chain.map((e) => ({ connection_id: e.connection_id, model: e.model })),
        },
        stale_days: staleDays,
      })
      if (!res.ok) return void toast.error(res.error)
      toast.success("Đã lưu cài đặt")
      setConns((cs) => cs.map((c) => ({ ...c, api_key: "", remove_key: false })))
    })
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <section className="space-y-4 rounded-xl border bg-card p-4" aria-labelledby="ai-conn-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="ai-conn-title" className="font-semibold">
              Kết nối AI
            </h2>
            <p className="text-xs text-muted-foreground">Mỗi nhà cung cấp một key. Key được mã hoá, chỉ gửi tới đúng Base URL của nó.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addConnection} disabled={conns.length >= MAX_CONNECTIONS}>
            <Plus /> Thêm kết nối
          </Button>
        </div>

        {!conns.length && <p className="text-sm text-muted-foreground">Chưa có kết nối nào. Thêm OpenRouter hoặc Gemini (đều có model miễn phí).</p>}

        {conns.map((c, idx) => {
          const preset = PROVIDER_PRESETS[c.provider]
          const list = models[c.id]
          return (
            <div key={c.id} className="space-y-3 rounded-lg border p-3" data-testid={`connection-${idx}`}>
              <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                <div className="space-y-1.5">
                  <Label htmlFor={`prov-${c.id}`}>Nhà cung cấp</Label>
                  <NativeSelect
                    id={`prov-${c.id}`}
                    value={c.provider}
                    onChange={(e) => {
                      const p = e.target.value as AiProvider
                      updateConn(c.id, { provider: p, ...(PROVIDER_PRESETS[p].baseUrl ? { base_url: PROVIDER_PRESETS[p].baseUrl } : {}) })
                    }}
                  >
                    {(Object.keys(PROVIDER_PRESETS) as AiProvider[]).map((p) => (
                      <option key={p} value={p}>
                        {PROVIDER_PRESETS[p].label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`url-${c.id}`}>Base URL</Label>
                  <Input id={`url-${c.id}`} type="url" inputMode="url" value={c.base_url} onChange={(e) => updateConn(c.id, { base_url: e.target.value })} />
                </div>
              </div>
              {c.provider !== "ollama" ? (
                <div className="space-y-1.5">
                  <Label htmlFor={`key-${c.id}`}>API key</Label>
                  <Input
                    id={`key-${c.id}`}
                    type="password"
                    autoComplete="off"
                    placeholder={c.key_mask ? `Đã lưu ${c.key_mask} — để trống để giữ nguyên` : "Dán API key"}
                    value={c.api_key}
                    disabled={c.remove_key}
                    onChange={(e) => updateConn(c.id, { api_key: e.target.value })}
                  />
                  {c.key_mask && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input type="checkbox" checked={c.remove_key} onChange={(e) => updateConn(c.id, { remove_key: e.target.checked })} /> Xoá key đã lưu
                    </label>
                  )}
                  {keyWillDrop(c) && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">Base URL đã đổi: key cũ sẽ bị xoá khi lưu, hãy nhập key mới.</p>
                  )}
                </div>
              ) : (
                preset.note && (
                  <p className="flex gap-2 rounded-lg bg-muted/60 p-2 text-xs">
                    <Info className="size-4 shrink-0" /> {preset.note}
                  </p>
                )
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => fetchModels(c)} disabled={list === "loading" || !c.base_url.trim()}>
                  {list === "loading" ? <Loader2 className="animate-spin" /> : <Download />} Tải danh sách model
                </Button>
                <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => removeConnection(c.id)}>
                  <Trash2 /> Xoá kết nối
                </Button>
              </div>
              {Array.isArray(list) && (
                <ModelPicker
                  models={list}
                  canAdd={chain.length < MAX_CHAIN}
                  isAdded={(id) => chain.some((e) => e.connection_id === c.id && e.model === id)}
                  onAdd={(id) => addToChain(c.id, id)}
                />
              )}
            </div>
          )
        })}
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4" aria-labelledby="ai-chain-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="ai-chain-title" className="font-semibold">
              Thứ tự model (fallback)
            </h2>
            <p className="text-xs text-muted-foreground">
              Dùng model #1; nếu lỗi (hết quota, quá tải, timeout, sai định dạng) tự chuyển sang model kế tiếp.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={testAll} disabled={!chain.length}>
            <PlugZap /> Test tất cả
          </Button>
        </div>
        {!chain.length ? (
          <p className="text-sm text-muted-foreground">Chưa chọn model. Bấm “Tải danh sách model” ở một kết nối rồi “Thêm”.</p>
        ) : (
          <ol className="space-y-2" data-testid="model-chain">
            {chain.map((e, i) => {
              const c = conn(e.connection_id)
              const t = tests[e.key]
              return (
                <li key={e.key} className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm">
                  <span className="w-6 text-center font-semibold tabular-nums">#{i + 1}</span>
                  <Badge variant="outline">{c ? providerLabel(c.provider) : "?"}</Badge>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs" title={e.model}>
                    {e.model}
                  </span>
                  {t?.status === "running" && <Loader2 className="size-4 animate-spin" aria-label="Đang test" />}
                  {t?.status === "ok" && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="size-4" /> {(t.ms / 1000).toFixed(1)}s
                    </span>
                  )}
                  {t?.status === "fail" && (
                    <span className="inline-flex max-w-full items-center gap-1 text-xs text-destructive" title={t.message}>
                      <XCircle className="size-4 shrink-0" /> <span className="truncate">{t.message}</span>
                    </span>
                  )}
                  <span className="flex gap-0.5">
                    <Button type="button" size="icon-xs" variant="ghost" aria-label="Lên" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp />
                    </Button>
                    <Button type="button" size="icon-xs" variant="ghost" aria-label="Xuống" disabled={i === chain.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown />
                    </Button>
                    <Button type="button" size="xs" variant="outline" onClick={() => runTest(e)} disabled={t?.status === "running"}>
                      Test
                    </Button>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Bỏ ${e.model}`}
                      onClick={() => setChain((ch) => ch.filter((x) => x.key !== e.key))}
                    >
                      <X />
                    </Button>
                  </span>
                </li>
              )
            })}
          </ol>
        )}
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
