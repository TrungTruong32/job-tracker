import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { chatJson } from "@/lib/ai/client"
import { buildPingMessages } from "@/lib/ai/prompts"
import { aiErrorResponse } from "@/lib/ai/route-helpers"
import { getServerAiConfig } from "@/lib/data/queries"

const Body = z.object({
  baseUrl: z.string().trim().url("Base URL không hợp lệ"),
  model: z.string().trim().min(1, "Cần nhập tên model"),
  apiKey: z.string().optional(), // omitted = use the stored key
})

export async function POST(request: NextRequest) {
  const body = Body.safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 })
  // The stored key is only ever sent to the stored base URL, never to a URL typed in the form.
  const stored = await getServerAiConfig()
  const storedKey = stored && stored.baseUrl === body.data.baseUrl ? stored.apiKey : null
  const apiKey = body.data.apiKey?.trim() || storedKey
  if (!apiKey) return NextResponse.json({ error: "Cần nhập API key (key đã lưu chỉ dùng được với Base URL đã lưu)" }, { status: 400 })
  const started = Date.now()
  try {
    await chatJson({ baseUrl: body.data.baseUrl, model: body.data.model, apiKey }, buildPingMessages(), z.object({ ok: z.unknown() }), {
      timeoutMs: 20_000,
    })
    return NextResponse.json({ ok: true, ms: Date.now() - started })
  } catch (e) {
    return aiErrorResponse(e)
  }
}
