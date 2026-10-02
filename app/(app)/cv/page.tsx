import type { Metadata } from "next"
import { CvManager } from "@/components/cv/cv-manager"
import { getApplications, getCvs } from "@/lib/data/queries"

export const metadata: Metadata = { title: "CV" }

export default async function CvPage() {
  const [cvs, apps] = await Promise.all([getCvs(), getApplications()])
  const usage: Record<string, number> = {}
  for (const a of apps) if (a.cv_version_id) usage[a.cv_version_id] = (usage[a.cv_version_id] ?? 0) + 1
  return (
    <div className="p-4 sm:p-6">
      <CvManager cvs={cvs} usage={usage} />
    </div>
  )
}
