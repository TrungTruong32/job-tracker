import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CvEditor } from "@/components/cv-builder/cv-editor"
import { getCvDocument } from "@/lib/data/cv-documents"
import { getProfile } from "@/lib/data/profile-queries"
import { getCurrentWorkspace, getPublicSettings } from "@/lib/data/queries"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const metadata: Metadata = { title: "Soạn CV" }

export default async function CvEditorPage({ params }: PageProps<"/cv/[id]">) {
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const [doc, profile, settings, ws] = await Promise.all([getCvDocument(id), getProfile(), getPublicSettings(), getCurrentWorkspace()])
  if (!doc) notFound()
  return (
    <div className="p-4 sm:p-6">
      <CvEditor doc={doc} basics={profile.basics} items={profile.items} settings={settings} workspaceId={ws.id} />
    </div>
  )
}
