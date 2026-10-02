import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { chatJson } from "@/lib/ai/client"
import { JdSummarySchema } from "@/lib/ai/parse"
import { buildExtractMessages } from "@/lib/ai/prompts"
import { aiErrorResponse, aiNotReady } from "@/lib/ai/route-helpers"
import { getServerAiConfig } from "@/lib/data/queries"

const Body = z.object({ jdText: z.string().trim().min(30, "JD quá ngắn để AI phân tích (cần ít nhất 30 ký tự)") })

export async function POST(request: NextRequest) {
  const body = Body.safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 })
  const cfg = await getServerAiConfig()
  if (!cfg) return aiNotReady()
  try {
    return NextResponse.json(await chatJson(cfg, buildExtractMessages(body.data.jdText), JdSummarySchema))
  } catch (e) {
    return aiErrorResponse(e)
  }
}
