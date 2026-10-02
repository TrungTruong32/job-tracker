import { NextResponse, type NextRequest } from "next/server"
import { MAX_CV_BYTES, cvTypeOf, extractCvText } from "@/lib/cv/extract"

// Reads an uploaded CV and returns its plain text; storing the file is done by the client.
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "Không có file" }, { status: 400 })
  const type = cvTypeOf(file.name)
  if (!type) return NextResponse.json({ error: "Chỉ hỗ trợ file .pdf hoặc .tex" }, { status: 400 })
  if (file.size > MAX_CV_BYTES) return NextResponse.json({ error: "File quá lớn (tối đa 4MB)" }, { status: 400 })
  try {
    const { text, tooShort } = await extractCvText(new Uint8Array(await file.arrayBuffer()), type)
    return NextResponse.json({ text, tooShort, type })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Không đọc được file" }, { status: 422 })
  }
}
