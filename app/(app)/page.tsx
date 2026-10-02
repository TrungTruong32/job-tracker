import { Board } from "@/components/board/board"
import { getApplications, getCurrentWorkspace, getCvs, getPublicSettings, getStages, getWorkspaces } from "@/lib/data/queries"

export default async function HomePage() {
  const [stages, apps, cvs, settings, ws, workspaces] = await Promise.all([
    getStages(),
    getApplications(),
    getCvs(),
    getPublicSettings(),
    getCurrentWorkspace(),
    getWorkspaces(),
  ])
  return (
    <div className="p-4 sm:p-6">
      <Board initialApps={apps} stages={stages} cvs={cvs} settings={settings} workspaceName={workspaces.length > 1 ? ws.name : undefined} />
    </div>
  )
}
