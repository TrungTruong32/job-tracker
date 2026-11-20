import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ApplicationDetail } from "@/components/detail/application-detail"
import { getCvDocuments } from "@/lib/data/cv-documents"
import { getEmailProfile } from "@/lib/data/profile-queries"
import { getApplication, getCurrentWorkspace, getCvs, getEmailDraft, getEvents, getPublicSettings, getStages } from "@/lib/data/queries"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function generateMetadata({ params }: PageProps<"/applications/[id]">): Promise<Metadata> {
  const { id } = await params
  const app = UUID.test(id) ? await getApplication(id) : null
  return { title: app ? `${app.company} · ${app.position}` : "Không tìm thấy" }
}

export default async function ApplicationPage({ params }: PageProps<"/applications/[id]">) {
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const [app, events, stages, cvs, settings, docs, emailDraft, emailProfile, ws] = await Promise.all([
    getApplication(id),
    getEvents(id),
    getStages(),
    getCvs(),
    getPublicSettings(),
    getCvDocuments(),
    getEmailDraft(id),
    getEmailProfile(),
    getCurrentWorkspace(),
  ])
  if (!app) notFound()
  return (
    <div className="p-4 sm:p-6">
      <ApplicationDetail
        app={app}
        events={events}
        stages={stages}
        cvs={cvs}
        settings={settings}
        workspaceId={ws.id}
        docs={docs.map((d) => ({ id: d.id, name: d.name }))}
        emailDraft={emailDraft}
        sender={emailProfile.basics}
        emailTemplates={emailProfile.templates}
      />
    </div>
  )
}
