import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { normalizeModels } from "@/lib/ai/models"
import { PROVIDER_PRESETS, type AiProvider } from "@/lib/ai/providers"
import { keyForConnection } from "@/lib/ai/connection-key"
import { getCurrentWorkspace, getSettingsRow } from "@/lib/data/queries"

const Body = z.object({
  provider: z.enum(Object.keys(PROVIDER_PRESETS) as [AiProvider, ...AiProvider[]]),
  baseUrl: z.string().trim().regex(/^https?:\/\/\S+$/, "Base URL không hợp lệ"),
  connectionId: z.string().optional(), // use this saved connection's key…
  apiKey: z.string().optional(), // …or a key typed but not saved yet
})

const norm = (u: string) => u.replace(/\/+$/, "")

/** List the models a provider offers (owner only — it may use the stored key). */
export async function POST(request: NextRequest) {
  const body = Body.safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 })
  if ((await getCurrentWorkspace()).role !== "owner") {
    return NextResponse.json({ error: "Chỉ chủ workspace được cấu hình AI" }, { status: 403 })
  }

  const key = keyForConnection(await getSettingsRow(), body.data)

  const ctrl = AbortSignal.timeout(15_000)
  try {
    const res = await fetch(`${norm(body.data.baseUrl)}/models`, {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      signal: ctrl,
    })
    if (res.status === 401 || res.status === 403) return NextResponse.json({ error: "API key không hợp lệ" }, { status: 400 })
    if (!res.ok) return NextResponse.json({ error: `Nhà cung cấp trả lỗi ${res.status}` }, { status: 502 })
    const models = normalizeModels(body.data.provider, await res.json())
    if (!models.length) return NextResponse.json({ error: "Không đọc được danh sách model, hãy gõ tên model thủ công" }, { status: 502 })
    return NextResponse.json({ models })
  } catch {
    return NextResponse.json({ error: "Không kết nối được tới nhà cung cấp (timeout 15s)" }, { status: 502 })
  }
}
