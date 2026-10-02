export type CvFileType = "pdf" | "tex"

export const MAX_CV_BYTES = 4 * 1024 * 1024 // Vercel functions reject request bodies over 4.5MB

export function cvTypeOf(fileName: string): CvFileType | null {
  const m = /\.([a-z]+)$/i.exec(fileName)
  const ext = m?.[1].toLowerCase()
  return ext === "pdf" || ext === "tex" ? ext : null
}
