import { createClient } from "@supabase/supabase-js"

// Local Supabase demo service key (not a secret: identical on every `supabase start`).
const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

/** Delete the e2e users (their data cascades) so every run starts empty. */
export default async function globalSetup() {
  const admin = createClient(process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:55321", SERVICE_KEY, {
    auth: { persistSession: false },
  })
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  for (const u of data.users) {
    if (u.email?.startsWith("e2e-")) {
      const { error: delErr } = await admin.auth.admin.deleteUser(u.id)
      if (delErr) throw delErr
    }
  }
}
