import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Job Tracker",
    short_name: "Jobs",
    description: "Theo dõi đơn ứng tuyển, JD, vòng phỏng vấn và CV",
    start_url: "/",
    display: "standalone",
    background_color: "#140B19",
    theme_color: "#140B19",
    lang: "vi",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }
}
