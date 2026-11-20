// Seeds a fictional demo account into the LOCAL Supabase for README screenshots.
// Usage: npx supabase start && npx tsx scripts/demo/seed.ts
// Everything here is made up: the person, the companies and the CV.
import { createClient } from "@supabase/supabase-js"
import { SAMPLE_CV_BASICS, SAMPLE_CV_ITEMS } from "../../lib/cv/templates/sample-cv"
import { TEMPLATES } from "../../lib/cv/templates/registry"

export const DEMO_EMAIL = "demo@local.test"
export const DEMO_PASSWORD = "demo-password"

const URL = process.env.DEMO_SUPABASE_URL ?? "http://127.0.0.1:55321"
// Local Supabase demo service key (not a secret: identical on every `supabase start`).
const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
if (!/127\.0\.0\.1|localhost/.test(URL)) throw new Error("demo seed only runs against a local Supabase")

const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })
// unwrap a Supabase result: throw its error, otherwise return its data (non-null once there is no error)
const must = <T>(r: { data: T; error: unknown }): NonNullable<T> => {
  if (r.error) throw r.error
  return r.data as NonNullable<T>
}

const day = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

type Seed = {
  company: string
  position: string
  stage: string
  source: string
  applied: number
  location: string
  salary?: string
  next?: [string, number]
  skills: string[]
  fit?: number
  events?: { type: "stage_change" | "note" | "interview"; stage?: string; at: number; notes?: string; interviewer?: string; questions?: string }[]
}

const APPS: Seed[] = [
  { company: "Lumen Analytics", position: "AI Engineer", stage: "PV2", source: "LinkedIn", applied: -26, location: "Ho Chi Minh City", salary: "2,000–2,800 USD", next: ["Send thank-you email after the final round", 1], skills: ["Python", "RAG", "LangGraph", "PostgreSQL"], fit: 86,
    events: [
      { type: "stage_change", stage: "Screening", at: -21 },
      { type: "interview", stage: "PV1", at: -14, interviewer: "Engineering manager", notes: "System design: a support-ticket classifier, latency budget 300 ms.", questions: "How do you evaluate an LLM change before shipping it?" },
      { type: "stage_change", stage: "PV2", at: -5 },
    ] },
  { company: "Nimbus Pay", position: "LLM Engineer", stage: "PV1", source: "ITviec", applied: -18, location: "Ho Chi Minh City", salary: "Negotiable", next: ["Prepare the take-home review", 2], skills: ["Python", "OpenAI API", "Evaluation", "Docker"], fit: 78,
    events: [{ type: "stage_change", stage: "Screening", at: -12 }, { type: "stage_change", stage: "PV1", at: -3 }] },
  { company: "Orbit Retail", position: "Data Engineer", stage: "Test", source: "TopCV", applied: -15, location: "Remote", salary: "1,500–2,000 USD", next: ["Submit the SQL test", 0], skills: ["SQL", "Airflow", "dbt", "PostgreSQL"], fit: 72,
    events: [{ type: "stage_change", stage: "Test", at: -6 }] },
  { company: "Kite Logistics", position: "ML Engineer", stage: "Screening", source: "Referral", applied: -9, location: "Ha Noi", skills: ["PyTorch", "Forecasting", "MLOps"], fit: 64, next: ["Follow up with the recruiter", -1] },
  { company: "Fernwood Health", position: "AI Product Engineer", stage: "Đã nộp", source: "Website công ty", applied: -4, location: "Ho Chi Minh City", skills: ["Next.js", "TypeScript", "LLM", "Supabase"], fit: 81 },
  { company: "Quanta Games", position: "Applied AI Engineer", stage: "Đã nộp", source: "LinkedIn", applied: -2, location: "Da Nang", skills: ["Python", "Computer Vision", "ONNX"] },
  { company: "Harbor Bank Digital", position: "GenAI Engineer", stage: "Offer", source: "VietnamWorks", applied: -40, location: "Ho Chi Minh City", salary: "2,500 USD", next: ["Reply to the offer", 3], skills: ["RAG", "Guardrails", "Python", "Azure"], fit: 83,
    events: [
      { type: "stage_change", stage: "Screening", at: -35 },
      { type: "interview", stage: "PV1", at: -28, interviewer: "Tech lead", notes: "Live coding: chunking and retrieval for long PDFs." },
      { type: "interview", stage: "PV2", at: -17, interviewer: "Head of data" },
      { type: "stage_change", stage: "Offer", at: -6 },
    ] },
  { company: "Pixel Forge", position: "Backend Engineer (AI)", stage: "Rejected", source: "ITviec", applied: -33, location: "Remote", skills: ["Go", "Kubernetes", "gRPC"], fit: 48,
    events: [{ type: "stage_change", stage: "PV1", at: -24 }, { type: "stage_change", stage: "Rejected", at: -19, notes: "Wanted more Go in production." }] },
  { company: "Atlas Mobility", position: "Data Scientist", stage: "Ghosted", source: "TopCV", applied: -45, location: "Ha Noi", skills: ["Python", "Statistics", "A/B testing"] },
  { company: "Juniper Edu", position: "AI Engineer", stage: "Screening", source: "LinkedIn", applied: -7, location: "Ho Chi Minh City", skills: ["Python", "Chatbots", "n8n"], fit: 75 },
]

async function main() {
  // fresh demo user every run
  const listed = await db.auth.admin.listUsers({ perPage: 1000 })
  if (listed.error) throw listed.error
  for (const u of listed.data.users) {
    if (u.email !== DEMO_EMAIL) continue
    const { error } = await db.auth.admin.deleteUser(u.id)
    if (error) throw error
  }
  const created = await db.auth.admin.createUser({ email: DEMO_EMAIL, password: DEMO_PASSWORD, email_confirm: true })
  if (created.error) throw created.error
  const user = created.data.user
  const ws = must(await db.rpc("create_personal_workspace", { p_user: user.id, p_email: DEMO_EMAIL })) as string
  must(await db.from("workspaces").update({ name: "Job search 2026" }).eq("id", ws))
  const stages = must(await db.from("stages").select("id, name").eq("workspace_id", ws)) as { id: string; name: string }[]
  const stageId = (name: string) => stages.find((s) => s.name === name)!.id

  // profile: the fictional CV, with real uuids so projects can point at their experience
  const ids = new Map<string, string>(SAMPLE_CV_ITEMS.map((i) => [i.id, crypto.randomUUID()]))
  must(await db.from("profiles").upsert({ workspace_id: ws, basics: SAMPLE_CV_BASICS }))
  must(
    await db.from("profile_items").insert(
      SAMPLE_CV_ITEMS.map((i) => {
        const data = { ...i.data } as Record<string, unknown>
        if (typeof data.experience_id === "string") data.experience_id = ids.get(data.experience_id)
        return { id: ids.get(i.id), workspace_id: ws, section: i.section, position: i.position, data, tags: i.tags }
      }),
    ),
  )

  const sections = ["summary", "experience", "project", "education", "skill", "certification", "language"] as const
  const doc = must(
    await db
      .from("cv_documents")
      .insert({
        workspace_id: ws,
        name: "AI Engineer — general",
        template: "harvard",
        target_role: "AI Engineer",
        style: TEMPLATES.harvard.defaults,
        content: {
          sections: sections.map((key) => ({
            key,
            visible: true,
            items: key === "summary" ? [] : SAMPLE_CV_ITEMS.filter((i) => i.section === key).map((i) => ({ item_id: ids.get(i.id), bullet_ids: null })),
          })),
        },
      })
      .select("id")
      .single(),
  ) as { id: string }

  const cv = must(
    await db
      .from("cv_versions")
      .insert({ workspace_id: ws, name: "AI Engineer — general", is_default: true, document_id: doc.id, extracted_text: `${SAMPLE_CV_BASICS.full_name}\n${SAMPLE_CV_BASICS.summary}` })
      .select("id")
      .single(),
  ) as { id: string }

  for (const a of APPS) {
    const app = must(
      await db
        .from("applications")
        .insert({
          workspace_id: ws,
          company: a.company,
          position: a.position,
          source: a.source,
          location: a.location,
          salary: a.salary ?? null,
          applied_at: day(a.applied),
          stage_id: stageId(a.stage),
          cv_version_id: cv.id,
          jd_text: `${a.company} is hiring a ${a.position}.\nRequirements: ${a.skills.join(", ")}.\nLocation: ${a.location}.`,
          next_action: a.next?.[0] ?? null,
          next_action_due: a.next ? day(a.next[1]) : null,
          last_activity_at: new Date(Date.now() + (a.events?.at(-1)?.at ?? a.applied) * 86_400_000).toISOString(),
          ai_summary: {
            company: a.company,
            position: a.position,
            salary: a.salary ?? null,
            location: a.location,
            seniority: "Mid",
            required_skills: a.skills,
            nice_to_have: ["Docker", "CI/CD"],
            summary: `${a.position} building ${a.skills.slice(0, 2).join(" and ")} features for ${a.company}'s product team.`,
          },
          ai_fit:
            a.fit === undefined
              ? null
              : {
                  score: a.fit,
                  matched_skills: a.skills.slice(0, Math.max(1, a.skills.length - 1)),
                  missing_skills: a.skills.slice(-1),
                  suggestions: [`Move the ${a.skills[0]} project to the top of the CV`, `Add one measurable result for ${a.skills.at(-1)}`],
                  cv_version_id: cv.id,
                  evaluated_at: new Date().toISOString(),
                },
        })
        .select("id")
        .single(),
    ) as { id: string }
    const events = [{ type: "stage_change" as const, stage: "Đã nộp", at: a.applied }, ...(a.events ?? [])]
    must(
      await db.from("stage_events").insert(
        events.map((e) => ({
          workspace_id: ws,
          application_id: app.id,
          type: e.type,
          stage_id: e.stage ? stageId(e.stage) : null,
          event_date: day(e.at),
          interviewer: e.interviewer ?? null,
          notes: e.notes ?? null,
          questions: e.questions ?? null,
        })),
      ),
    )
  }
  console.log(`seeded ${APPS.length} applications for ${DEMO_EMAIL}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
