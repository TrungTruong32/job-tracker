import type { Metadata } from "next"
import { AccountCard } from "@/components/settings/account-card"
import { SettingsForm } from "@/components/settings/settings-form"
import { StagesEditor } from "@/components/settings/stages-editor"
import { WorkspaceCard } from "@/components/settings/workspace-card"
import { getApplications, getCurrentWorkspace, getMembers, getPublicSettings, getStages, getWorkspaces } from "@/lib/data/queries"
import { requireUser } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Cài đặt" }

export default async function SettingsPage() {
  const [{ user }, ws, workspaces, members, settings, stages, apps] = await Promise.all([
    requireUser(),
    getCurrentWorkspace(),
    getWorkspaces(),
    getMembers(),
    getPublicSettings(),
    getStages(),
    getApplications(),
  ])
  const usage: Record<string, number> = {}
  for (const a of apps) usage[a.stage_id] = (usage[a.stage_id] ?? 0) + 1
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <h1 className="text-xl font-semibold sm:text-2xl">Cài đặt</h1>
      <WorkspaceCard key={ws.id} current={ws} workspaces={workspaces} members={members} />
      {ws.role === "owner" ? (
        <SettingsForm key={ws.id} settings={settings} />
      ) : (
        <section className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          AI: {settings.ai_ready ? `chủ workspace đã cấu hình ${settings.chain.length} model (${settings.chain.map((c) => c.model).join(" → ")})` : "chủ workspace chưa cấu hình"}. Follow-up sau{" "}
          {settings.stale_days} ngày.
        </section>
      )}
      <StagesEditor stages={stages} usage={usage} />
      <AccountCard email={user.email ?? ""} />
    </div>
  )
}
