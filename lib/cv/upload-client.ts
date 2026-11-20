"use client"

import { createClient } from "@/lib/supabase/client"
import { MAX_CV_BYTES, cvTypeOf, type CvFileType } from "./file-type"

export type ReadCv = { type: CvFileType; text: string; tooShort: boolean }

/** Validates a CV file and asks the server to pull its plain text out. Throws a user-facing message. */
export async function readCvFile(file: File): Promise<ReadCv> {
  const type = cvTypeOf(file.name)
  if (!type) throw new Error("Chỉ hỗ trợ file .pdf hoặc .tex")
  if (file.size > MAX_CV_BYTES) throw new Error("File quá lớn (tối đa 4MB)")
  const body = new FormData()
  body.append("file", file)
  const res = await fetch("/api/cv/extract", { method: "POST", body })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? "Không đọc được file")
  return { type, text: data.text, tooShort: data.tooShort }
}

/** Uploads the file to the workspace's folder in the `cvs` bucket and returns its storage path. */
export async function storeCvFile(file: File, type: CvFileType, workspaceId: string): Promise<string> {
  const path = `${workspaceId}/${crypto.randomUUID()}.${type}`
  const { error } = await createClient()
    .storage.from("cvs")
    .upload(path, file, { contentType: type === "pdf" ? "application/pdf" : "text/plain" })
  if (error) throw new Error(`Upload file thất bại: ${error.message}`)
  return path
}

export async function removeCvFile(path: string) {
  await createClient().storage.from("cvs").remove([path])
}

export const cvBaseName = (fileName: string) => fileName.replace(/\.(pdf|tex)$/i, "")
