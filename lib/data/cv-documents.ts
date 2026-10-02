import "server-only"
import type { CvContent } from "@/lib/cv/resolve"
import type { CvStyle, TemplateKey } from "@/lib/cv/templates/types"
import { workspaceContext } from "./queries"

export type CvDocument = {
  id: string
  name: string
  template: TemplateKey
  target_role: string | null
  target_tags: string[]
  style: Partial<CvStyle>
  content: CvContent
  updated_at: string
}

const COLUMNS = "id, name, template, target_role, target_tags, style, content, updated_at"

const cast = (r: Record<string, unknown>): CvDocument => ({
  ...(r as unknown as CvDocument),
  content: (r.content && Array.isArray((r.content as CvContent).sections) ? r.content : { sections: [] }) as CvContent,
  style: (r.style ?? {}) as Partial<CvStyle>,
})

export async function getCvDocuments(): Promise<CvDocument[]> {
  const { supabase, ws } = await workspaceContext()
  const { data, error } = await supabase.from("cv_documents").select(COLUMNS).eq("workspace_id", ws.id).order("updated_at", { ascending: false })
  if (error) throw error
  return data.map(cast)
}

export async function getCvDocument(id: string): Promise<CvDocument | null> {
  const { supabase, ws } = await workspaceContext()
  const { data, error } = await supabase.from("cv_documents").select(COLUMNS).eq("workspace_id", ws.id).eq("id", id).maybeSingle()
  if (error) throw error
  return data ? cast(data) : null
}
