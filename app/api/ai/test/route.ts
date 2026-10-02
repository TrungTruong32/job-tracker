import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { AiError, chatJson } from "@/lib/ai/client"
import { keyForConnection } from "@/lib/ai/connection-key"
import { AI_TASKS } from "@/lib/ai/tasks"
import { aiTimeoutMs } from "@/lib/ai/timeout"
import { getCurrentWorkspace, getSettingsRow } from "@/lib/data/queries"

export const maxDuration = 300

const Body = z.object({
  baseUrl: z.string().trim().regex(/^https?:\/\/\S+$/, "Base URL không hợp lệ"),
  model: z.string().trim().min(1, "Cần chọn model"),
  connectionId: z.string().optional(),
  apiKey: z.string().optional(),
  timeoutS: z.number().optional(), // value in the (maybe unsaved) form
})

/** Ping one model on a (possibly unsaved) connection. Owner only. */
export async function POST(request: NextRequest) {
  const body = Body.safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: body.error.issues[0].message, kind: "input" }, { status: 400 })
  if ((await getCurrentWorkspace()).role !== "owner") {
    return NextResponse.json({ error: "Chỉ chủ workspace được cấu hình AI", kind: "auth" }, { status: 403 })
  }
  const row = await getSettingsRow()
  const apiKey = keyForConnection(row, body.data)
  if (!apiKey) return NextResponse.json({ error: "Cần nhập API key cho kết nối này", kind: "auth" }, { status: 400 })
  const started = Date.now()
  try {
    const ping = AI_TASKS.ping
    await chatJson({ baseUrl: body.data.baseUrl, model: body.data.model, apiKey }, ping.messages(), ping.output, {
      timeoutMs: aiTimeoutMs({ ai_timeout_s: body.data.timeoutS ?? row?.ai_timeout_s }),
    })
    return NextResponse.json({ ms: Date.now() - started })
  } catch (e) {
    if (e instanceof AiError) return NextResponse.json({ error: e.message, kind: e.kind }, { status: 502 })
    return NextResponse.json({ error: "Lỗi không xác định", kind: "unknown" }, { status: 500 })
  }
}
