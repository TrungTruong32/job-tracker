import { expect, test, type Page } from "@playwright/test"

const JD = `Công ty ABC AI tuyển AI Engineer (Senior).
Yêu cầu: Python, LangChain, RAG, vector database, kinh nghiệm triển khai LLM vào sản phẩm.
Lương: 2000-3000 USD. Địa điểm: Hà Nội.`

async function login(page: Page, project: string) {
  await page.goto("/")
  await expect(page).toHaveURL(/\/login/)
  const form = page.getByTestId("dev-login")
  await form.getByLabel("Email").fill(`e2e-${project}@local.test`)
  await form.getByLabel("Mật khẩu").fill("e2e-password")
  await form.getByRole("button", { name: "Đăng nhập dev" }).click()
  await expect(page.getByRole("heading", { name: "Đơn ứng tuyển" })).toBeVisible()
}

test("add an application with AI prefill, move it, see it in timeline and dashboard", async ({ page }, info) => {
  const isPhone = info.project.name === "phone"
  await login(page, info.project.name)

  // Configure AI with a dummy key; the AI endpoints are mocked below.
  await page.goto("/settings")
  await page.getByLabel("Model").fill("test/model:free")
  await page.getByLabel("API key").fill("sk-test-123456")
  await page.getByRole("button", { name: "Lưu cài đặt" }).click()
  await expect(page.getByText("Đã lưu cài đặt")).toBeVisible()
  await page.reload()
  await expect(page.getByLabel("API key")).toHaveAttribute("placeholder", /••••3456/)

  await page.route("**/api/ai/extract", (route) =>
    route.fulfill({
      json: {
        company: "ABC AI",
        position: "AI Engineer",
        salary: "2000-3000 USD",
        location: "Hà Nội",
        seniority: "Senior",
        required_skills: ["Python", "LangChain", "RAG"],
        nice_to_have: [],
        summary: "Xây dựng sản phẩm LLM.",
      },
    }),
  )

  // Add application
  await page.goto("/")
  await page.getByRole("button", { name: "Thêm đơn" }).filter({ visible: true }).first().click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Nội dung JD").fill(JD)
  await dialog.getByRole("button", { name: "AI điền giúp" }).click()
  await expect(dialog.getByLabel("Công ty *")).toHaveValue("ABC AI")
  await expect(dialog.getByLabel("Vị trí *")).toHaveValue("AI Engineer")
  await expect(dialog.getByLabel("Lương")).toHaveValue("2000-3000 USD")
  await dialog.getByLabel("Nguồn").fill("LinkedIn")
  await dialog.getByRole("button", { name: "Thêm đơn" }).click()
  await expect(page.getByText("Đã thêm đơn ứng tuyển")).toBeVisible()
  await expect(dialog).toBeHidden()

  // Move to Screening via the card menu (works on every device)
  await page.getByRole("button", { name: "Chuyển vòng cho ABC AI" }).first().click()
  await page.getByRole("menuitem", { name: "Screening" }).click()
  await expect(page.getByText("Đã chuyển sang Screening")).toBeVisible()

  if (!isPhone) {
    await expect(page.getByTestId("column-Screening").getByText("ABC AI")).toBeVisible()
  } else {
    await page.getByRole("tab", { name: /Screening/ }).click()
    await expect(page.getByText("ABC AI").filter({ visible: true })).toBeVisible()
  }

  // Detail page: timeline has both stage changes
  await page.getByRole("link", { name: /ABC AI/ }).first().click()
  await expect(page.getByRole("heading", { name: "ABC AI" })).toBeVisible()
  if (isPhone) await page.getByRole("tab", { name: /Timeline/ }).click()
  const timeline = page.getByTestId("timeline")
  await expect(timeline.getByText("→ Screening")).toBeVisible()
  await expect(timeline.getByText("→ Đã nộp")).toBeVisible()

  // Add an interview note
  await page.getByRole("button", { name: "Thêm sự kiện" }).click()
  const ev = page.getByRole("dialog")
  await ev.getByLabel("Người phỏng vấn").fill("Chị Lan (HR)")
  await ev.getByLabel("Câu hỏi đã gặp").fill("Giải thích RAG?")
  await ev.getByRole("button", { name: "Lưu" }).click()
  await expect(timeline.getByText("Giải thích RAG?")).toBeVisible()

  // Dashboard counts it as interviewed
  await page.goto("/dashboard")
  const tile = (label: string) => page.locator("div", { has: page.getByText(label, { exact: true }) }).locator("p.text-2xl").first()
  await expect(tile("Tổng số đơn")).toHaveText("1")
  await expect(tile("Được gọi phỏng vấn")).toHaveText("1")
})

test("table view search is accent-insensitive", async ({ page }, info) => {
  await login(page, info.project.name)
  await page.getByRole("button", { name: "Bảng", exact: true }).click()
  await page.getByLabel("Tìm kiếm").fill("ha noi")
  await expect(page.getByText("1 / 1 đơn")).toBeVisible()
  await page.getByLabel("Tìm kiếm").fill("khong-co")
  await expect(page.getByText("0 / 1 đơn")).toBeVisible()
})

test("unauthenticated API calls are rejected", async ({ request }) => {
  const res = await request.post("/api/ai/extract", { data: { jdText: JD } })
  expect(res.status()).toBe(401)
})

test("upload a .tex CV and see its text extracted", async ({ page }, info) => {
  await login(page, info.project.name)
  await page.goto("/cv")
  const tex = String.raw`\documentclass{article}\begin{document}
\section{Kinh nghiệm}
\begin{itemize}
\item Xây dựng hệ thống \textbf{RAG} cho khách hàng châu Âu
\item Fine-tune LLM, độ chính xác 94\%
\end{itemize}
\end{document}`
  await page.getByTestId("cv-file").setInputFiles({ name: "AI-Engineer-v3.tex", mimeType: "text/x-tex", buffer: Buffer.from(tex) })
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByLabel("Tên bản CV *")).toHaveValue("AI-Engineer-v3")
  await expect(dialog.getByLabel("Nội dung (text)")).toHaveValue(/## Kinh nghiệm\n- Xây dựng hệ thống RAG/)
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(page.getByText("Đã lưu bản CV")).toBeVisible()
  await expect(page.getByText("AI-Engineer-v3", { exact: true })).toBeVisible()
  await expect(page.getByText("Mặc định")).toBeVisible()
})

test("drag a card to another column (laptop)", async ({ page }, info) => {
  test.skip(info.project.name !== "laptop", "mouse drag only on laptop")
  await login(page, info.project.name)
  await page.getByRole("button", { name: "Kanban", exact: true }).click()
  const card = page.getByTestId("kanban-card").filter({ hasText: "ABC AI" })
  const target = page.getByTestId("column-PV1")
  const from = (await card.boundingBox())!
  const to = (await target.boundingBox())!
  await page.mouse.move(from.x + 20, from.y + 20)
  await page.mouse.down()
  await page.mouse.move(from.x + 40, from.y + 30, { steps: 5 })
  await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 15 })
  await page.mouse.up()
  await expect(page.getByText("Đã chuyển sang PV1")).toBeVisible()
  await expect(target.getByText("ABC AI")).toBeVisible()
})
