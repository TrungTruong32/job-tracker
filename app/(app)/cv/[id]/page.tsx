import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CvEditor } from "@/components/cv-builder/cv-editor"
import { getCvDocument } from "@/lib/data/cv-documents"
import { getProfile } from "@/lib/data/profile-queries"
import { getApplications, getCurrentWorkspace, getPublicSettings } from "@/lib/data/queries"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const metadata: Metadata = { title: "Soạn CV" }

export default async function CvEditorPage({ params, searchParams }: PageProps<"/cv/[id]">) {
  const { id } = await params
  const { tab } = await searchParams
  if (!UUID.test(id)) notFound()
  const [doc, profile, settings, ws, applications] = await Promise.all([getCvDocument(id), getProfile(), getPublicSettings(), getCurrentWorkspace(), getApplications()])
  if (!doc) notFound()
  const apps = applications.map((a) => ({
    id: a.id,
    label: `${a.company} — ${a.position}`,
    jd_text: a.jd_text,
    jd_summary: a.ai_summary?.summary ?? null,
  }))
  return (
    <div className="p-4 sm:p-6">
      <CvEditor
        doc={doc}
        basics={profile.basics}
        items={profile.items}
        settings={settings}
        workspaceId={ws.id}
        apps={apps}
        initialTab={tab === "score" ? "score" : undefined}
      />
    </div>
  )
}
