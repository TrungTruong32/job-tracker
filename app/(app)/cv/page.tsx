import type { Metadata } from "next"
import { CvManager } from "@/components/cv/cv-manager"
import { DocumentsList } from "@/components/cv-builder/documents-list"
import { getCvDocuments } from "@/lib/data/cv-documents"
import { getProfile } from "@/lib/data/profile-queries"
import { getApplications, getCurrentWorkspace, getCvs } from "@/lib/data/queries"

export const metadata: Metadata = { title: "CV" }

export default async function CvPage() {
  const [cvs, apps, ws, docs, profile] = await Promise.all([getCvs(), getApplications(), getCurrentWorkspace(), getCvDocuments(), getProfile()])
  const usage: Record<string, number> = {}
  for (const a of apps) if (a.cv_version_id) usage[a.cv_version_id] = (usage[a.cv_version_id] ?? 0) + 1
  const tags = [...new Set(profile.items.flatMap((i) => i.tags))].sort()
  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 sm:p-6">
      <h1 className="text-xl font-semibold sm:text-2xl">CV</h1>
      <DocumentsList docs={docs} tags={tags} hasProfile={profile.items.length > 0} />
      <CvManager cvs={cvs} usage={usage} workspaceId={ws.id} />
    </div>
  )
}
