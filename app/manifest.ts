import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Job Tracker",
    short_name: "Jobs",
    description: "Theo dõi đơn ứng tuyển, JD, vòng phỏng vấn và CV",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2a78d6",
    lang: "vi",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
