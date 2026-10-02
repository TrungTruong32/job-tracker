import type { Metadata } from "next"
import { ImportFlow } from "@/components/profile/import-flow"
import { getProfile } from "@/lib/data/profile-queries"
import { getCvs, getPublicSettings } from "@/lib/data/queries"

export const metadata: Metadata = { title: "Nhập từ CV" }

export default async function ProfileImportPage() {
  const [{ basics, items }, cvs, settings] = await Promise.all([getProfile(), getCvs(), getPublicSettings()])
  return (
    <div className="p-4 sm:p-6">
      <ImportFlow basics={basics} items={items} cvs={cvs} settings={settings} />
    </div>
  )
}
