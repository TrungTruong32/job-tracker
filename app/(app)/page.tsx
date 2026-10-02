import { Board } from "@/components/board/board"
import { getApplications, getCvs, getPublicSettings, getStages } from "@/lib/data/queries"

export default async function HomePage() {
  const [stages, apps, cvs, settings] = await Promise.all([getStages(), getApplications(), getCvs(), getPublicSettings()])
  return (
    <div className="p-4 sm:p-6">
      <Board initialApps={apps} stages={stages} cvs={cvs} settings={settings} />
    </div>
  )
}
