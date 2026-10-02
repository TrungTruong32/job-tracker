import "server-only"
import { NextResponse } from "next/server"
import { AiError } from "./client"

export function aiErrorResponse(e: unknown) {
  if (e instanceof AiError) return NextResponse.json({ error: e.message }, { status: 502 })
  console.error(e)
  return NextResponse.json({ error: "Lỗi không xác định khi gọi AI" }, { status: 500 })
}

export function aiNotReady() {
  return NextResponse.json(
    { error: "Chưa cấu hình AI. Vào Cài đặt để chọn nhà cung cấp, model và API key." },
    { status: 400 },
  )
}
