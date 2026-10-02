import type { Metadata } from "next"
import { SettingsForm } from "@/components/settings/settings-form"
import { StagesEditor } from "@/components/settings/stages-editor"
import { AccountCard } from "@/components/settings/account-card"
import { getApplications, getPublicSettings, getStages } from "@/lib/data/queries"
import { requireUser } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Cài đặt" }

export default async function SettingsPage() {
  const [{ user }, settings, stages, apps] = await Promise.all([requireUser(), getPublicSettings(), getStages(), getApplications()])
  const usage: Record<string, number> = {}
  for (const a of apps) usage[a.stage_id] = (usage[a.stage_id] ?? 0) + 1
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <h1 className="text-xl font-semibold sm:text-2xl">Cài đặt</h1>
      <SettingsForm settings={settings} />
      <StagesEditor stages={stages} usage={usage} />
      <AccountCard email={user.email ?? ""} />
    </div>
  )
}
