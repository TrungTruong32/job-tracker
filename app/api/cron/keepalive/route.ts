import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Daily Vercel Cron (vercel.json). Free-tier Supabase pauses a project after
 * 7 days without activity; one real database query a day keeps it awake.
 * Vercel sends `Authorization: Bearer $CRON_SECRET` on cron calls.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { error } = await createAdminClient().from("app_flags").select("key", { count: "exact", head: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, at: new Date().toISOString() })
}
