import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { AiError, chatJson, type ChatMessage } from "@/lib/ai/client"
import { resolveEntry } from "@/lib/ai/settings"
import { aiTimeoutMs } from "@/lib/ai/timeout"
import { AI_TASKS } from "@/lib/ai/tasks"
import { getSettingsRow } from "@/lib/data/queries"

// up to 2 calls x 120s per model (see lib/ai/timeout.ts)
export const maxDuration = 300

const Body = z.object({
  task: z.enum(Object.keys(AI_TASKS) as [keyof typeof AI_TASKS, ...(keyof typeof AI_TASKS)[]]),
  index: z.number().int().min(0).max(20),
  input: z.unknown(),
})

/**
 * Run one AI task on chain entry `index` of the current workspace. The browser walks
 * the chain (fallback); the server picks URL + key from the DB, never from the request.
 */
export async function POST(request: NextRequest) {
  const body = Body.safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: "Yêu cầu không hợp lệ", kind: "unknown" }, { status: 400 })
  const task = AI_TASKS[body.data.task]
  const input = task.input.safeParse(body.data.input ?? {})
  if (!input.success) return NextResponse.json({ error: input.error.issues[0].message, kind: "input" }, { status: 400 })

  const row = await getSettingsRow()
  const entry = resolveEntry(row, body.data.index, process.env.AI_KEY_SECRET)
  if (!entry) return NextResponse.json({ error: "Model này chưa có API key hoặc không còn trong chuỗi", kind: "auth" }, { status: 400 })
  if (entry.provider === "ollama") return NextResponse.json({ error: "Ollama phải gọi từ trình duyệt", kind: "unknown" }, { status: 400 })

  const started = Date.now()
  try {
    // the three tasks share one call shape; their union types don't line up for TS
    const messages = (task.messages as (i: unknown) => ChatMessage[])(input.data)
    const data = await chatJson(entry, messages, task.output as z.ZodType<unknown>, { timeoutMs: aiTimeoutMs(row) })
    return NextResponse.json({ data, ms: Date.now() - started })
  } catch (e) {
    if (e instanceof AiError) return NextResponse.json({ error: e.message, kind: e.kind }, { status: 502 })
    console.error(e)
    return NextResponse.json({ error: "Lỗi không xác định khi gọi AI", kind: "unknown" }, { status: 500 })
  }
}
