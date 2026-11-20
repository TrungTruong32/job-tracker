import type { ProfileItem } from "@/lib/profile/schema"
import type { Basics } from "@/lib/profile/schema"

// Fictional person used by the template tests (the "mine" layout: nested projects, QR, publications).
export const SAMPLE_BASICS: Basics = {
  full_name: "Nguyen Minh An",
  headline: "AI Engineer",
  email: "an.nguyen@example.com",
  phone: "090 000 0000",
  location: "Ho Chi Minh City",
  links: [
    { label: "LinkedIn", url: "https://www.linkedin.com/in/an-nguyen-example" },
    { label: "GitHub", url: "https://github.com/an-nguyen-example" },
    { label: "Web Portfolio", url: "https://an-nguyen.example.com/my_portfolio/" },
  ],
  summary:
    "AI Engineer with a Computer Science background, building data and AI tools that replace manual work and run every day. At Acme: 5 projects, lead on 3, 2 in daily use – including a pipeline delivering **~120K validated rows** for 12 online stores. Previously co-authored an **ExampleConf 2025** paper (RAG, **91.20% Recall@10**).",
}

const b = (...t: string[]) => t.map((text, i) => ({ id: `b${i}-${text.slice(0, 8)}`, text }))

export const SAMPLE_ITEMS: ProfileItem[] = [
  { id: "edu", section: "education", position: 0, tags: [], data: { school: "Example University of Science", degree: "Bachelor of Science", field: "Computer Science", start: "2020-09", end: "2024-06", gpa: "8.40/10", bullets: b("**Honors:** Dean's List for two semesters") } },
  { id: "ac", section: "experience", position: 0, tags: ["ai"], data: { company: "Acme Commerce", title: "AI Engineer", start: "2025-07", end: "present", bullets: [], tech: [] } },
  { id: "p1", section: "project", position: 0, tags: ["ai", "data"], data: { name: "Order Sync Pipeline & Nightly Backfill", experience_id: "ac", tech: ["Python", "PostgreSQL", "Airflow"], bullets: b(
    "Built an ETL pipeline replacing a manual spreadsheet export: **~120K validated rows**, 5 datasets, **12 stores**.",
    "Pulled orders from a partner API through a rate-limited client *(~12 months of history)*.",
    "Designed layered tables with idempotent loads; totals reconciled with the source, **~400 automated tests**.",
    "Shipped a nightly job that backfills missed days – **in daily use**, 2,100 runs, 0 failures.") } },
  { id: "p2", section: "project", position: 1, tags: ["web"], data: { name: "Internal Tools Portal", experience_id: "ac", tech: ["Next.js", "TypeScript", "Supabase"], bullets: b(
    "Co-built one sign-in portal for **4 internal tools** *(60+ API routes, ~120 tests)*; delivered its onboarding module.",
    "Designed role-based access with row-level scope, enforced by Supabase RLS on ~50 protected routes.") } },
  { id: "bl", section: "experience", position: 1, tags: ["ai"], data: { company: "Bright Labs", title: "Software Engineer", start: "2024-07", end: "2025-06", tech: [], bullets: [] } },
  { id: "p3", section: "project", position: 2, tags: ["ai"], data: { name: "Email Marketing Automation", experience_id: "bl", tech: ["Django", "PostgreSQL", "Docker", "n8n"], bullets: b(
    "Built a small CRM for **online retail clients**, linking email threads to leads and deals.",
    "Used AI + n8n to draft and send follow-ups **(~500 emails/day)**, cutting manual work by **over 60%**.") } },
  { id: "pub", section: "publication", position: 0, tags: ["ai"], data: { title: "A Retail Q&A Dataset for RAG", venue: "ExampleConf 2025", date: "2025", url: "https://doi.org/10.0000/example.0001" } },
  { id: "sk1", section: "skill", position: 0, tags: [], data: { category: "Programming Languages", items: ["Python", "SQL", "JavaScript/TypeScript", "Go"] } },
  { id: "sk2", section: "skill", position: 1, tags: [], data: { category: "AI / ML", items: ["PyTorch", "LangGraph", "Hugging Face", "RAG", "n8n"] } },
  { id: "lang", section: "language", position: 0, tags: [], data: { name: "English", level: "C1 – IELTS" } },
]
