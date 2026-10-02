"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Target } from "lucide-react"
import { toast } from "sonner"
import { startNavigation } from "@/components/nav/top-progress"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/native-select"
import { createCvDocument } from "@/lib/data/cv-document-actions"

/** Copy a CV document, aim it at this application's JD, and open the editor on the score tab. */
export function OptimizeCv({ appId, company, docs }: { appId: string; company: string; docs: { id: string; name: string }[] }) {
  const [docId, setDocId] = useState(docs[0]?.id ?? "")
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  if (!docs.length)
    return (
      <p className="text-sm text-muted-foreground">
        Chưa có bản CV soạn từ hồ sơ. <Link href="/cv" className="text-primary underline">Tạo bản CV</Link> rồi quay lại để tối ưu theo JD này.
      </p>
    )
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect aria-label="Bản CV gốc" className="min-w-48 flex-1" value={docId} onChange={(e) => setDocId(e.target.value)}>
        {docs.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </NativeSelect>
      <Button
        disabled={pending || !docId}
        onClick={() =>
          startTransition(async () => {
            const src = docs.find((d) => d.id === docId)!
            const res = await createCvDocument({ name: `${src.name} — ${company}`.slice(0, 80), copyFrom: docId, target_application_id: appId })
            if (!res.ok) return void toast.error(res.error)
            startNavigation()
            router.push(`/cv/${res.data.id}?tab=score`)
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Target />} Tối ưu CV cho đơn này
      </Button>
    </div>
  )
}
