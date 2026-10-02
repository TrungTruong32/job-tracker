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

  // Configure AI: one connection, load its models, build a 2-model chain, test, save.
  // Provider endpoints are mocked; only our own API routes are intercepted.
  await page.route("**/api/ai/models", (route) =>
    route.fulfill({
      json: {
        models: [
          { id: "a/model:free", name: "Model A", free: true, context: 8000 },
          { id: "c/model:free", name: "Model C", free: true, context: 8000 },
          { id: "b/paid", name: "Paid B", free: false, context: 128000 },
        ],
      },
    }),
  )
  await page.route("**/api/ai/test", async (route) => {
    const { model } = route.request().postDataJSON()
    return model === "a/model:free"
      ? route.fulfill({ json: { ms: 800 } })
      : route.fulfill({ status: 502, json: { error: "Hết quota", kind: "quota" } })
  })
  await page.goto("/settings")
  await page.getByRole("button", { name: "Thêm kết nối" }).click()
  const conn = page.getByTestId("connection-0")
  await conn.getByLabel("API key").fill("sk-test-123456")
  await conn.getByRole("button", { name: "Tải danh sách model" }).click()
  const picker = conn.getByTestId("model-picker")
  await expect(picker.getByText("a/model:free")).toBeVisible()
  await expect(picker.getByText("b/paid")).toHaveCount(0) // free-only filter on by default
  await picker.getByRole("button", { name: "Thêm a/model:free vào chuỗi" }).click()
  await picker.getByRole("button", { name: "Thêm c/model:free vào chuỗi" }).click()
  const chainList = page.getByTestId("model-chain")
  await expect(chainList.getByRole("listitem")).toHaveCount(2)
  await page.getByRole("button", { name: "Test tất cả" }).click()
  await expect(chainList.getByRole("listitem").nth(0).getByText("0.8s")).toBeVisible()
  await expect(chainList.getByRole("listitem").nth(1).getByText("Hết quota")).toBeVisible()
  await page.getByRole("button", { name: "Lưu cài đặt" }).click()
  await expect(page.getByText("Đã lưu cài đặt")).toBeVisible()
  await page.reload()
  await expect(page.getByTestId("connection-0").getByLabel("API key")).toHaveAttribute("placeholder", /••••3456/)
  await expect(page.getByTestId("model-chain").getByRole("listitem")).toHaveCount(2)

  // Model #1 is out of quota -> the app falls back to #2
  await page.route("**/api/ai/run", async (route) => {
    const { task, index } = route.request().postDataJSON()
    if (task !== "extract") return route.fallback()
    if (index === 0) return route.fulfill({ status: 502, json: { error: "Hết quota", kind: "quota" } })
    return route.fulfill({
      json: {
        data: {
          company: "ABC AI",
          position: "AI Engineer",
          salary: "2000-3000 USD",
          location: "Hà Nội",
          seniority: "Senior",
          required_skills: ["Python", "LangChain", "RAG"],
          nice_to_have: [],
          summary: "Xây dựng sản phẩm LLM.",
        },
      },
    })
  })

  // Add application
  await page.goto("/")
  await page.getByRole("button", { name: "Thêm đơn" }).filter({ visible: true }).first().click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Nội dung JD").fill(JD)
  await dialog.getByRole("button", { name: "AI điền giúp" }).click()
  await expect(dialog.getByLabel("Công ty *")).toHaveValue("ABC AI")
  await expect(dialog.getByLabel("Vị trí *")).toHaveValue("AI Engineer")
  await expect(dialog.getByLabel("Lương")).toHaveValue("2000-3000 USD")
  await expect(page.getByText(/đã dùng dự phòng #2: c\/model:free/)).toBeVisible()
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
  const res = await request.post("/api/ai/run", { data: { task: "extract", index: 0, input: { jdText: JD } } })
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

test("score the application against the CV", async ({ page }, info) => {
  await login(page, info.project.name)
  let sent: { jdText: string; cvText: string } | null = null
  await page.route("**/api/ai/run", async (route) => {
    const body = route.request().postDataJSON()
    if (body.task !== "match") return route.fallback()
    sent = body.input
    await route.fulfill({
      json: { data: { score: 82, matched_skills: ["Python", "RAG"], missing_skills: ["Kubernetes"], suggestions: ["Nhấn mạnh dự án RAG"] } },
    })
  })
  const href = await page.locator('a[href^="/applications/"]').first().getAttribute("href")
  await page.goto(href!)
  const fit = page.getByTestId("cv-fit")
  await fit.getByRole("button", { name: "Chấm điểm" }).click()
  await expect(fit.getByText("82%")).toBeVisible()
  await expect(fit.getByText("Kubernetes")).toBeVisible()
  await expect(fit.getByText(/Chấm với “AI-Engineer-v3”/)).toBeVisible()
  expect(sent!.cvText).toContain("Xây dựng hệ thống RAG")
  // persisted: survives a reload
  await page.reload()
  await expect(page.getByTestId("cv-fit").getByText("82%")).toBeVisible()
})

test("owner invites a member who sees the shared data until removed", async ({ page, browser }, info) => {
  test.skip(info.project.name !== "laptop", "one device is enough for the sharing flow")
  await login(page, info.project.name)
  await page.goto("/settings")
  await page.getByLabel("Mời thành viên").fill("E2E-Member@local.test")
  await page.getByRole("button", { name: "Mời", exact: true }).click()
  const members = page.getByTestId("members")
  await expect(members.getByText("e2e-member@local.test")).toBeVisible()
  await expect(members.getByText("Đang chờ")).toBeVisible()

  // Member signs in on another device and sees the owner's applications
  const memberCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const member = await memberCtx.newPage()
  await member.goto("/login")
  const form = member.getByTestId("dev-login")
  await form.getByLabel("Email").fill("e2e-member@local.test")
  await form.getByLabel("Mật khẩu").fill("e2e-password")
  await form.getByRole("button", { name: "Đăng nhập dev" }).click()
  await expect(member.getByRole("heading", { name: "Đơn ứng tuyển" })).toBeVisible()
  await expect(member.getByText("ABC AI").filter({ visible: true }).first()).toBeVisible()
  await member.goto("/settings")
  await expect(member.getByText(/Bạn là thành viên/)).toBeVisible()
  await expect(member.getByLabel("Mời thành viên")).toHaveCount(0)
  await expect(member.getByLabel("API key")).toHaveCount(0)

  // Owner sees the member as joined, then removes them
  await page.reload()
  await expect(members.getByText("Đang chờ")).toHaveCount(0)
  page.once("dialog", (d) => d.accept())
  await page.getByRole("button", { name: "Xoá e2e-member@local.test" }).click()
  await expect(page.getByText("Đã xoá thành viên")).toBeVisible()

  // Member is locked out on the next request
  await member.goto("/")
  await expect(member).toHaveURL(/\/login\?error=forbidden/)
  await memberCtx.close()
})

test("a stranger who was never invited is turned away", async ({ browser }, info) => {
  test.skip(info.project.name !== "laptop", "once is enough")
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto("/login")
  const form = page.getByTestId("dev-login")
  await form.getByLabel("Email").fill("e2e-stranger@local.test")
  await form.getByLabel("Mật khẩu").fill("e2e-password")
  await form.getByRole("button", { name: "Đăng nhập dev" }).click()
  await expect(page).toHaveURL(/\/login\?error=forbidden/)
  await expect(page.getByText("Email này không có quyền truy cập")).toBeVisible()
  await ctx.close()
})

test("a stale tab cannot write into a workspace switched in another tab", async ({ page, browser }, info) => {
  test.skip(info.project.name !== "laptop", "once is enough")
  // laptop owner shares their workspace with the phone user (who also owns one)
  await login(page, info.project.name)
  await page.goto("/settings")
  await page.getByLabel("Mời thành viên").fill("e2e-phone@local.test")
  await page.getByRole("button", { name: "Mời", exact: true }).click()
  await expect(page.getByTestId("members").getByText("e2e-phone@local.test")).toBeVisible()

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const tab1 = await ctx.newPage()
  await login(tab1, "phone")
  await tab1.goto("/settings")
  await expect(tab1.getByRole("heading", { name: "Các vòng" })).toBeVisible()

  const tab2 = await ctx.newPage()
  await tab2.goto("/settings")
  await tab2.getByLabel("Chọn workspace").first().selectOption({ label: "Workspace của e2e-laptop (được mời)" })
  await expect(tab2.getByRole("link", { name: /Workspace của e2e-laptop/ })).toBeVisible()

  // tab1 still shows the phone user's own stages; saving must be refused
  await tab1.getByRole("button", { name: "Lưu các vòng" }).click()
  await expect(tab1.getByText(/không thuộc workspace đang chọn/)).toBeVisible()
  await ctx.close()
})

test("a progress bar shows while the next page loads", async ({ page }, info) => {
  test.skip(info.project.name !== "laptop", "once is enough")
  await login(page, info.project.name)
  // slow down the RSC payload of the dashboard so the loading state is observable
  await page.route(/\/dashboard(\?|$)/, async (route) => {
    await new Promise((r) => setTimeout(r, 1500))
    await route.continue()
  })
  await page.getByRole("link", { name: "Dashboard" }).first().click()
  await expect(page.getByRole("progressbar", { name: "Đang tải trang" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
  await expect(page.getByRole("progressbar", { name: "Đang tải trang" })).toHaveCount(0)
})
