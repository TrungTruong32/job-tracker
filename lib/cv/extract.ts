import "server-only"
import { MAX_CV_BYTES, type CvFileType } from "./file-type"
import { stripLatex } from "./strip-latex"

export { MAX_CV_BYTES, cvTypeOf, type CvFileType } from "./file-type"

const MIN_USEFUL_CHARS = 200

/** Plain text of a CV file, plus a flag when there's too little text to be useful. */
export async function extractCvText(bytes: Uint8Array, type: CvFileType): Promise<{ text: string; tooShort: boolean }> {
  if (bytes.byteLength > MAX_CV_BYTES) throw new Error("File quá lớn (tối đa 5MB)")

  let text: string
  if (type === "tex") {
    text = stripLatex(new TextDecoder("utf-8").decode(bytes))
  } else {
    const { extractText, getDocumentProxy } = await import("unpdf")
    try {
      const pdf = await getDocumentProxy(new Uint8Array(bytes))
      const r = await extractText(pdf, { mergePages: true })
      text = (Array.isArray(r.text) ? r.text.join("\n") : r.text)
        .split("\n")
        .map((l) => l.replace(/[ \t]+/g, " ").trim())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    } catch {
      throw new Error("Không đọc được file PDF (file hỏng hoặc có mật khẩu)")
    }
  }
  return { text, tooShort: text.replace(/\s/g, "").length < MIN_USEFUL_CHARS / 2 }
}
