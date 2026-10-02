import type { Metadata } from "next"
import { ProfileView } from "@/components/profile/profile-view"
import { getProfile } from "@/lib/data/profile-queries"

export const metadata: Metadata = { title: "Hồ sơ" }

export default async function ProfilePage() {
  const { basics, items } = await getProfile()
  return (
    <div className="p-4 sm:p-6">
      <ProfileView basics={basics} items={items} />
    </div>
  )
}
