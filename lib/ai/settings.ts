import { z } from "zod"
import { decryptSecret, maskKey } from "@/lib/crypto"
import { nextKeyAction } from "./key-policy"
import { PROVIDER_PRESETS, type AiProvider } from "./providers"

export const MAX_CONNECTIONS = 4
export const MAX_CHAIN = 8

const ProviderSchema = z.enum(Object.keys(PROVIDER_PRESETS) as [AiProvider, ...AiProvider[]])

const StoredConnection = z.object({
  id: z.string().min(1),
  provider: ProviderSchema,
  base_url: z.string(),
  key_enc: z.string().nullable(),
})
const StoredEntry = z.object({ connection_id: z.string().min(1), model: z.string().min(1) })

export type StoredConnection = z.infer<typeof StoredConnection>
export type StoredEntry = z.infer<typeof StoredEntry>
type Row = { ai_connections: unknown; ai_chain: unknown }

function list<T>(schema: z.ZodType<T>, v: unknown): T[] {
  return Array.isArray(v) ? v.flatMap((x) => (schema.safeParse(x).success ? [schema.parse(x)] : [])) : []
}

/** Stored connections + chain; entries pointing at a missing connection are dropped. */
export function readAi(row: Row | null) {
  const connections = list(StoredConnection, row?.ai_connections)
  const ids = new Set(connections.map((c) => c.id))
  const chain = list(StoredEntry, row?.ai_chain).filter((e) => ids.has(e.connection_id))
  return { connections, chain }
}

function decryptOrNull(enc: string | null, secret: string | undefined): string | null {
  if (!enc || !secret) return null
  try {
    return decryptSecret(enc, secret)
  } catch {
    return null
  }
}

export type ResolvedEntry = { provider: AiProvider; baseUrl: string; apiKey: string | null; model: string }

/** Everything needed to call chain entry `index` (server only: decrypts the key). */
export function resolveEntry(row: Row | null, index: number, secret: string | undefined): ResolvedEntry | null {
  const { connections, chain } = readAi(row)
  const entry = chain[index]
  const conn = entry && connections.find((c) => c.id === entry.connection_id)
  if (!entry || !conn || !conn.base_url) return null
  const apiKey = decryptOrNull(conn.key_enc, secret)
  if (!apiKey && conn.provider !== "ollama") return null
  return { provider: conn.provider, baseUrl: conn.base_url, apiKey, model: entry.model }
}

export type PublicConnection = { id: string; provider: AiProvider; base_url: string; key_mask: string | null }
export type PublicEntry = { connection_id: string; model: string; provider: AiProvider; usable: boolean }

/** What the browser may see: no keys, only masks and whether each entry can run. */
export function publicAi(row: Row | null, secret: string | undefined) {
  const { connections, chain } = readAi(row)
  const pubConns: PublicConnection[] = connections.map((c) => {
    const key = decryptOrNull(c.key_enc, secret)
    return { id: c.id, provider: c.provider, base_url: c.base_url, key_mask: key ? maskKey(key) : null }
  })
  const pubChain: PublicEntry[] = chain.map((e, i) => {
    const conn = connections.find((c) => c.id === e.connection_id)!
    return { connection_id: e.connection_id, model: e.model, provider: conn.provider, usable: !!resolveEntry(row, i, secret) }
  })
  return { connections: pubConns, chain: pubChain, ready: pubChain.some((e) => e.usable) }
}

export const AiUpdateSchema = z.object({
  connections: z
    .array(
      z.object({
        id: z.uuid(),
        provider: ProviderSchema,
        base_url: z.string().trim(),
        api_key: z.string().optional(), // undefined = keep, "" = remove, else replace
      }),
    )
    .max(MAX_CONNECTIONS, `Tối đa ${MAX_CONNECTIONS} kết nối`),
  chain: z
    .array(z.object({ connection_id: z.string(), model: z.string().trim().min(1, "Tên model không được trống") }))
    .max(MAX_CHAIN, `Tối đa ${MAX_CHAIN} model trong chuỗi`),
})
export type AiUpdate = z.input<typeof AiUpdateSchema>

/** New stored values: keys re-encrypted per connection, never reused for a different URL. */
export function applyAiUpdate(stored: Row | null, input: AiUpdate, encrypt: (plain: string) => string) {
  const v = AiUpdateSchema.parse(input)
  const old = new Map(readAi(stored).connections.map((c) => [c.id, c]))
  const ai_connections: StoredConnection[] = v.connections.map((c) => {
    if (!/^https?:\/\/\S+$/.test(c.base_url)) throw new Error("Base URL phải bắt đầu bằng http:// hoặc https://")
    const prev = old.get(c.id)
    const action = nextKeyAction(
      { ai_base_url: prev?.base_url ?? null, has_key: !!prev?.key_enc },
      { baseUrl: c.base_url, apiKey: c.api_key },
    )
    const key_enc = action === "replace" ? encrypt(c.api_key!.trim()) : action === "keep" ? (prev?.key_enc ?? null) : null
    return { id: c.id, provider: c.provider, base_url: c.base_url, key_enc }
  })
  const ids = new Set(ai_connections.map((c) => c.id))
  if (v.chain.some((e) => !ids.has(e.connection_id))) throw new Error("Model trong chuỗi trỏ tới kết nối không tồn tại")
  const ai_chain: StoredEntry[] = v.chain.map((e) => ({ connection_id: e.connection_id, model: e.model }))
  return { ai_connections, ai_chain }
}
