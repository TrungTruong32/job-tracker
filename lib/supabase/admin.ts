import "server-only"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "./types"

/**
 * Service-role client. Used for exactly one thing: creating the personal
 * workspace of an allowlisted user (users cannot create workspaces themselves).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error("Server chưa cấu hình SUPABASE_SERVICE_ROLE_KEY")
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
