import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { chatJson } from "@/lib/ai/client"
import { CvFitSchema } from "@/lib/ai/parse"
import { buildMatchMessages } from "@/lib/ai/prompts"
import { aiErrorResponse, aiNotReady } from "@/lib/ai/route-helpers"
import { getServerAiConfig } from "@/lib/data/queries"

const Body = z.object({
  jdText: z.string().trim().min(30, "Đơn này chưa có nội dung JD để so sánh"),
  cvText: z.string().trim().min(50, "Bản CV chưa có nội dung text để so sánh"),
})

// Scores only; the client saves the result with the saveAiFit server action.
export async function POST(request: NextRequest) {
  const body = Body.safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 })
  const cfg = await getServerAiConfig()
  if (!cfg) return aiNotReady()
  try {
    return NextResponse.json(await chatJson(cfg, buildMatchMessages(body.data.jdText, body.data.cvText), CvFitSchema))
  } catch (e) {
    return aiErrorResponse(e)
  }
}
