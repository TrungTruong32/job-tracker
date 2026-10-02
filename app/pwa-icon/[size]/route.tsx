import { ImageResponse } from "next/og"

const SIZES = new Set([180, 192, 512])

// App icon for the PWA manifest and iOS home screen: a briefcase on a blue tile.
export async function GET(_req: Request, { params }: RouteContext<"/pwa-icon/[size]">) {
  const size = Number((await params).size)
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 })
  const s = size / 512
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#2a78d6" }}>
        <svg width={280 * s} height={280 * s} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          <rect width="20" height="14" x="2" y="6" rx="2" />
          <path d="M22 13a18.15 18.15 0 0 1-20 0" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  )
}
