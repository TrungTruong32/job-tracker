"use client"

import type { PublicSettings } from "@/lib/data/types"
import { AiError, chatJson, type AiErrorKind } from "./client"
import { runChain, type ChainResult } from "./chain"
import type { ModelInfo } from "./models"
import { normalizeModels } from "./models"
import { isBrowserProvider, type AiProvider } from "./providers"
import { AI_TASKS, type AiTask, type AiTaskInput, type AiTaskOutput } from "./tasks"

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  } catch {
    throw new AiError("Mất kết nối tới server", "network")
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; kind?: AiErrorKind }
  if (!res.ok) throw new AiError(data.error ?? `Lỗi ${res.status}`, data.kind ?? "unknown")
  return data as T
}

function ollamaHint(e: unknown): never {
  if (e instanceof AiError && e.kind === "network") {
    throw new AiError("Không gọi được Ollama trên máy này. Kiểm tra Ollama đang chạy và OLLAMA_ORIGINS cho phép domain của app.", "network")
  }
  throw e
}

/**
 * Run an AI task along the workspace's model chain, falling back on failure.
 * Hosted models run on the server (keys stay there); Ollama runs from this browser.
 */
export async function runAiTask<T extends AiTask>(
  settings: PublicSettings,
  task: T,
  input: AiTaskInput<T>,
): Promise<ChainResult<AiTaskOutput<T>>> {
  const def = AI_TASKS[task]
  const valid = def.input.safeParse(input)
  if (!valid.success) throw new AiError(valid.error.issues[0].message, "input")

  const entries = settings.chain.map((e) => ({ connectionId: e.connection_id, model: e.model }))
  return runChain(entries, async (entry, index) => {
    const conn = settings.connections.find((c) => c.id === entry.connectionId)
    if (conn && isBrowserProvider(conn.provider)) {
      const messages = (def.messages as (i: unknown) => ReturnType<typeof def.messages>)(valid.data)
      return chatJson({ baseUrl: conn.base_url, apiKey: null, model: entry.model }, messages, def.output as never, {
        timeoutMs: settings.ai_timeout_s * 1000,
      }).catch(ollamaHint) as Promise<AiTaskOutput<T>>
    }
    const r = await postJson<{ data: AiTaskOutput<T> }>("/api/ai/run", { task, index, input: valid.data })
    return r.data
  })
}

/** Human summary of a chain result for toasts ("đã dùng dự phòng #2 …"). */
export function describeChainResult(r: ChainResult<unknown>): string | undefined {
  if (!r.failures.length) return undefined
  return `Model #${r.failures[0].index + 1} lỗi (${r.failures[0].message}) — đã dùng dự phòng #${r.index + 1}: ${r.model}`
}

/** List models of a (possibly unsaved) connection. */
export async function loadModels(conn: {
  id: string
  provider: AiProvider
  base_url: string
  api_key?: string
}): Promise<ModelInfo[]> {
  if (isBrowserProvider(conn.provider)) {
    let res: Response
    try {
      res = await fetch(`${conn.base_url.replace(/\/+$/, "")}/models`)
    } catch {
      return ollamaHint(new AiError("network", "network"))
    }
    if (!res.ok) throw new AiError(`Ollama trả lỗi ${res.status}`, "server")
    return normalizeModels(conn.provider, await res.json())
  }
  const r = await postJson<{ models: ModelInfo[] }>("/api/ai/models", {
    provider: conn.provider,
    baseUrl: conn.base_url,
    connectionId: conn.id,
    apiKey: conn.api_key || undefined,
  })
  return r.models
}

/** Ping one model on a (possibly unsaved) connection; resolves to latency in ms. */
export async function testModel(
  conn: { id: string; provider: AiProvider; base_url: string; api_key?: string },
  model: string,
  timeoutS: number,
): Promise<number> {
  if (isBrowserProvider(conn.provider)) {
    const started = performance.now()
    await chatJson({ baseUrl: conn.base_url, apiKey: null, model }, AI_TASKS.ping.messages(), AI_TASKS.ping.output, {
      timeoutMs: timeoutS * 1000,
    }).catch(ollamaHint)
    return Math.round(performance.now() - started)
  }
  const r = await postJson<{ ms: number }>("/api/ai/test", {
    baseUrl: conn.base_url,
    model,
    connectionId: conn.id,
    apiKey: conn.api_key || undefined,
    timeoutS,
  })
  return r.ms
}
