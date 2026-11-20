import type { Basics, ProfileItem } from "@/lib/profile/schema"
import type { CvContent } from "../resolve"

// A fictional person's CV (test/fixtures/sample-cv.tex) as profile data: the "harvard" (overview)
// template must reproduce that CV from it (see latex.test.ts / templates.test.tsx).
export const SAMPLE_CV_BASICS: Basics = {
  full_name: "Nguyen Minh An",
  headline: "Product Engineer – Applied AI",
  email: "an.nguyen@example.com",
  phone: "090 000 0000",
  location: "Ho Chi Minh City",
  links: [
    { label: "LinkedIn", url: "https://www.linkedin.com/in/an-nguyen-example" },
    { label: "GitHub", url: "https://github.com/an-nguyen-example" },
    { label: "Web Portfolio", url: "https://an-nguyen.example.com/my_portfolio/", text: "portfolio_an" },
  ],
  summary:
    "Computer Science graduate who turns business workflows into clear specs and **measures LLM output** against them. Built evaluation suites with support teams *(GPT, Gemini, Llama via OpenRouter)*, curated the data behind a **9,000+ pair** QA benchmark *(ExampleConf 2025, 91.20% Recall@10)*, and shipped automation that cut manual work by **over 60%**. Detail-first: reconciled totals, ~400 tests.",
}

const b = (id: string, ...t: string[]) => t.map((text, i) => ({ id: `${id}-${i}`, text }))
const exp = (id: string, position: number, title: string, company: string, start: string, end: string): ProfileItem => ({
  id,
  section: "experience",
  position,
  tags: [],
  data: { title, company, start, end, bullets: [], tech: [] },
})
const prj = (id: string, position: number, experience_id: string, name: string, extra: Record<string, unknown>, bullets: string[]): ProfileItem => ({
  id,
  section: "project",
  position,
  tags: [],
  data: { name, experience_id, tech: [], ...extra, bullets: b(id, ...bullets) },
})

export const SAMPLE_CV_ITEMS: ProfileItem[] = [
  {
    id: "edu",
    section: "education",
    position: 0,
    tags: [],
    data: {
      school: "Example University of Science",
      degree: "Bachelor of Science",
      field: "Computer Science",
      specialization: "Data Science",
      gpa: "8.40/10 *(3.55/4)*",
      start: "2020-09",
      end: "2024-06",
      bullets: [],
    },
  },
  exp("ac", 0, "AI Engineer", "Acme Commerce", "2025-07", "present"),
  exp("bl", 1, "Software Engineer", "Bright Labs", "2024-07", "2025-06"),
  exp("nw", 2, "Research Intern", "Northwind Research Lab", "2023-06", "2023-12"),
  prj("p1", 0, "ac", "LLM Evaluation & Support Automation", { tech: ["Python", "OpenRouter", "LangGraph", "MCP"] }, [
    "Defined an intent taxonomy with the support team, then **benchmarked ticket-classification accuracy across LLMs**.",
    "Prototyped **automated reply drafting** with an LLM via MCP, tuning prompts against a labelled set.",
    "Profiled a slow document-search service: found **2 bottlenecks** and confirmed the fix with load tests.",
    "Ran every project as a written loop *(plan → build → review)*.",
  ]),
  prj("p2", 1, "ac", "Data Workflow Automation – Order Sync Pipeline", { tech: ["Python", "PostgreSQL"] }, [
    "**Replaced a spreadsheet export** with a scheduled pipeline: **~120K rows** for 12 stores, totals reconciled with the source.",
    "Shipped a retry-safe job that **runs nightly without manual steps** and fills gaps from missed days.",
    "Wrote per-load data checks and **~400 automated tests**; now in **daily use** *(2,100 runs, 0 failures)*.",
  ]),
  prj("p3", 2, "ac", "Marketplace Price Tracker", { tech: ["Browser Extension", "PostgreSQL"] }, [
    "**Automated competitor price collection**: 3 prototypes + an MVP handling 500 requests at 20 concurrent.",
  ]),
  prj("p4", 3, "ac", "Internal Tools – Onboarding Checklist", { tech: ["Next.js", "TypeScript", "Supabase"] }, [
    "Delivered a checklist module with **automatic reminders** and a **manager sign-off step**.",
  ]),
  prj("p5", 4, "bl", "Email Marketing Automation", { tech: ["n8n", "Gemini", "Django", "PostgreSQL"] }, [
    "Moved newsletter and follow-up workflows into AI + n8n automation *(~500 emails/day)*: **over 60%** less manual work.",
    "Added **human review** of AI drafts before sending; refined requirements in bi-weekly sprint reviews.",
  ]),
  prj("p6", 5, "nw", "Retail Q&A Dataset Project", { url: "https://doi.org/10.0000/example.0001", link_label: "Paper link" }, [
    "Designed **labelling, cleaning & scoring workflows** for a **9,000+ pair** product QA benchmark.",
    "Benchmark backed a **RAG** baseline at **91.20% Recall@10**; **co-authored** the *ExampleConf 2025* paper.",
  ]),
  prj("p7", 6, "nw", "Campus FAQ Chatbot Project", { url: "https://example.com/report", link_label: "Report link" }, [
    "Collected questions and use cases from students; analysed retrieval misses in the RAG pipeline.",
  ]),
  { id: "sk1", section: "skill", position: 0, tags: [], data: { category: "Product & Evaluation", items: ["Specs & acceptance criteria", "LLM evaluation", "test sets & metrics", "Scrum"] } },
  { id: "sk2", section: "skill", position: 1, tags: [], data: { category: "LLM Tooling", items: ["OpenRouter *(GPT, Gemini, Llama)*", "LangGraph", "Hugging Face", "RAG", "MCP"] } },
  { id: "sk3", section: "skill", position: 2, tags: [], data: { category: "Programming & Data", items: ["Python", "SQL", "Pandas", "PostgreSQL", "Supabase", "Redis", "n8n"] } },
  { id: "c1", section: "certification", position: 0, tags: [], data: { name: "IELTS 7.0 *(English Proficiency)*" } },
  { id: "c2", section: "certification", position: 1, tags: [], data: { name: "Workflow Automation", issuer: "Coursera" } },
  { id: "c3", section: "certification", position: 2, tags: [], data: { name: "Docker Fundamentals", issuer: "Coursera" } },
  { id: "l1", section: "language", position: 0, tags: [], data: { name: "English", level: "C1 – IELTS" } },
  { id: "l2", section: "language", position: 1, tags: [], data: { name: "Vietnamese", level: "Native" } },
  // not part of the sample CV: the overview layout must leave it out
  { id: "pub", section: "publication", position: 0, tags: [], data: { title: "A Retail Q&A Dataset for RAG", venue: "ExampleConf 2025", date: "2025" } },
]

export const sampleCvContent = (): CvContent => ({
  sections: (["summary", "experience", "project", "education", "publication", "skill", "certification", "language"] as const).map((key) => ({
    key,
    visible: true,
    items: key === "summary" ? [] : SAMPLE_CV_ITEMS.filter((i) => i.section === key).map((i) => ({ item_id: i.id, bullet_ids: null })),
  })),
})
