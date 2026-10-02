export type CvFileType = "pdf" | "tex"

export const MAX_CV_BYTES = 5 * 1024 * 1024

export function cvTypeOf(fileName: string): CvFileType | null {
  const m = /\.([a-z]+)$/i.exec(fileName)
  const ext = m?.[1].toLowerCase()
  return ext === "pdf" || ext === "tex" ? ext : null
}
