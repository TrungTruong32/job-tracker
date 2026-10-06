import "server-only"
import { BasicsSchema, SECTION_KEYS, type Basics, type ProfileItem, type Section } from "@/lib/profile/schema"
import { parseTemplates, type EmailTemplates } from "@/lib/email/draft"
import { workspaceContext } from "./queries"

export async function getProfile(): Promise<{ basics: Basics; items: ProfileItem[] }> {
  const { supabase, ws } = await workspaceContext()
  const [{ data: prof, error: pErr }, { data: items, error: iErr }] = await Promise.all([
    supabase.from("profiles").select("basics").eq("workspace_id", ws.id).maybeSingle(),
    supabase
      .from("profile_items")
      .select("id, section, position, data, tags")
      .eq("workspace_id", ws.id)
      .order("position")
      .order("created_at"),
  ])
  if (pErr) throw pErr
  if (iErr) throw iErr
  const b = BasicsSchema.safeParse(prof?.basics ?? {})
  return {
    basics: b.success ? b.data : { links: [] },
    items: (items ?? [])
      .filter((i) => SECTION_KEYS.includes(i.section as Section))
      .map((i) => ({ ...i, section: i.section as Section, data: (i.data ?? {}) as Record<string, unknown> })),
  }
}

/** What the email writer needs: contact basics for the signature and the user's sample emails. */
export async function getEmailProfile(): Promise<{ basics: Basics; templates: EmailTemplates }> {
  const { supabase, ws } = await workspaceContext()
  const { data, error } = await supabase.from("profiles").select("basics, email_templates").eq("workspace_id", ws.id).maybeSingle()
  if (error) throw error
  const b = BasicsSchema.safeParse(data?.basics ?? {})
  return { basics: b.success ? b.data : { links: [] }, templates: parseTemplates(data?.email_templates) }
}
