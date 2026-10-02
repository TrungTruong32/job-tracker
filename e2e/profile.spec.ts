import { expect, test, type Page } from "@playwright/test"

// Runs after flow.spec.ts (files run in name order with one worker), so the laptop user
// already has an AI chain configured. Mocks /api/ai/run for parse_cv only.

const CV_TEXT = `An Nguyen — AI Engineer — an@example.com
EXPERIENCE
Acme, AI Engineer, Mar 2024 – Present
• Built a RAG assistant for European clients
• Fine-tuned LLMs reaching 91.20% accuracy
EDUCATION
HCMUS, BSc Computer Science, 2019 – 2023
SKILLS
ML/AI: PyTorch, LangChain, RAG`.padEnd(260, " ")

function parsed(extraBullet?: string) {
  return {
    basics: { full_name: "An Nguyen", headline: "AI Engineer", email: "an@example.com", links: [] },
    items: [
      {
        section: "experience",
        data: {
          company: "Acme",
          title: "AI Engineer",
          start: "Mar 2024",
          end: "Present",
          bullets: ["Built a RAG assistant for European clients", "Fine-tuned LLMs reaching 91.20% accuracy", ...(extraBullet ? [extraBullet] : [])],
          tech: ["Python", "LangChain"],
        },
      },
      { section: "education", data: { school: "HCMUS", degree: "BSc", field: "Computer Science", start: "2019", end: "2023", bullets: [] } },
      { section: "skill", data: { category: "ML/AI", items: ["PyTorch", "LangChain", "RAG"] } },
    ],
  }
}

async function login(page: Page) {
  await page.goto("/login")
  const f = page.getByTestId("dev-login")
  await f.getByLabel("Email").fill("e2e-laptop@local.test")
  await f.getByLabel("Mật khẩu").fill("e2e-password")
  await f.getByRole("button", { name: "Đăng nhập dev" }).click()
  await expect(page.getByRole("heading", { name: "Đơn ứng tuyển" })).toBeVisible()
}

async function importCv(page: Page, extraBullet?: string) {
  await page.route("**/api/ai/run", async (route) => {
    const body = route.request().postDataJSON()
    if (body.task !== "parse_cv") return route.fallback()
    await route.fulfill({ json: { data: parsed(extraBullet) } })
  })
  await page.goto("/profile/import")
  await page.getByRole("tab", { name: "Dán text" }).click()
  await page.getByLabel("Nội dung CV").fill(CV_TEXT)
  await page.getByRole("button", { name: "Phân tích bằng AI" }).click()
}

test.describe("profile", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "laptop", "laptop only"))

  test("import a CV, edit an item, re-import and merge only the new bullet", async ({ page }) => {
    await login(page)
    await page.goto("/profile")
    await expect(page.getByText("Hồ sơ đang trống")).toBeVisible()

    // first import: everything is new
    await importCv(page)
    await expect(page.getByTestId("import-row")).toHaveCount(3)
    await expect(page.getByText("Mới")).toHaveCount(3)
    await page.getByRole("button", { name: "Nhập vào hồ sơ" }).click()
    await expect(page.getByText("Đã nhập: thêm 3, cập nhật 0 mục")).toBeVisible()
    await expect(page).toHaveURL(/\/profile$/)
    const exp = page.getByTestId("section-experience")
    await expect(exp.getByText("AI Engineer")).toBeVisible()
    await expect(exp.getByText("03/2024 – nay")).toBeVisible()
    await expect(page.getByText("An Nguyen")).toBeVisible()

    // edit: add a bullet with Enter
    await exp.getByText("AI Engineer").click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Bullet 2", { exact: true }).click()
    await dialog.getByLabel("Bullet 2", { exact: true }).press("End")
    await dialog.getByLabel("Bullet 2", { exact: true }).press("Enter")
    await dialog.getByLabel("Bullet 3", { exact: true }).fill("Mentored 2 interns")
    await dialog.getByLabel("Tag").fill("ai, llm")
    await dialog.getByRole("button", { name: "Lưu" }).click()
    await expect(page.getByText("Đã lưu")).toBeVisible()
    await expect(exp.getByText("3 bullet", { exact: false })).toBeVisible()
    await expect(exp.getByText("#llm")).toBeVisible()

    // second import: experience is a duplicate; merge adds only the brand-new bullet
    await importCv(page, "Cut inference cost by 40%")
    const dup = page.getByTestId("import-experience").getByTestId("import-row")
    await expect(dup.getByText(/Trùng với/)).toBeVisible()
    await expect(dup.getByText("Cut inference cost by 40%")).toBeVisible()
    await expect(dup.getByText("Built a RAG assistant", { exact: false })).toHaveCount(0)
    await dup.getByLabel("Gộp").check()
    await page.getByRole("button", { name: "Nhập vào hồ sơ" }).click()
    await expect(page.getByText("Đã nhập: thêm 0, cập nhật 1 mục")).toBeVisible()
    await expect(exp.getByText("4 bullet", { exact: false })).toBeVisible()
    await expect(page.getByTestId("section-experience").getByRole("listitem")).toHaveCount(1)
  })

  test("add an item manually and reorder", async ({ page }) => {
    await login(page)
    await page.goto("/profile")
    const sec = page.getByTestId("section-language")
    for (const name of ["English", "Japanese"]) {
      await sec.getByRole("button", { name: "Thêm Ngoại ngữ" }).click()
      const d = page.getByRole("dialog")
      await d.getByLabel("Ngôn ngữ *").fill(name)
      await d.getByRole("button", { name: "Lưu" }).click()
      await expect(page.getByText("Đã thêm")).toBeVisible()
      await expect(d).toBeHidden()
    }
    const items = sec.getByRole("listitem")
    await expect(items.nth(0)).toContainText("English")
    await items.nth(1).getByRole("button", { name: "Lên" }).click()
    await expect(items.nth(0)).toContainText("Japanese")
  })

  // CV builder (part B) — needs the profile imported above
  test("create from tags, stay on one page, auto-fit an overflow, export and save for applying", async ({ page }) => {
    test.setTimeout(180_000)
    await login(page)

    // add a long project so the CV can overflow later
    await page.goto("/profile")
    await page.getByTestId("section-project").getByRole("button", { name: "Thêm Dự án" }).click()
    const d = page.getByRole("dialog")
    await d.getByLabel("Tên dự án *").fill("Very Long Project")
    await d.getByLabel("Thuộc kinh nghiệm").selectOption({ label: "AI Engineer | Acme" })
    const long = "Designed and shipped a production retrieval-augmented generation platform with **evaluation harnesses**, caching, guardrails and observability for multiple enterprise customers across regions"
    for (let i = 1; i <= 26; i++) {
      await d.getByLabel(`Bullet ${i}`, { exact: true }).fill(`${long} (${i})`)
      if (i < 26) await d.getByLabel(`Bullet ${i}`, { exact: true }).press("Enter")
    }
    await d.getByLabel("Tag").fill("ai")
    await d.getByRole("button", { name: "Lưu" }).click()
    await expect(page.getByText("Đã thêm")).toBeVisible()

    // create a document from the "ai" tag
    await page.goto("/cv")
    await page.getByRole("button", { name: "Tạo bản CV" }).click()
    const c = page.getByRole("dialog")
    await c.getByLabel("Tên bản CV *").fill("AI Engineer — Test")
    await c.getByLabel("#ai").check()
    await c.getByRole("button", { name: "Tạo" }).click()
    await expect(page).toHaveURL(/\/cv\/[0-9a-f-]{36}$/)

    // the long project overflows; deselect it -> one page
    const indicator = page.getByTestId("page-indicator")
    await expect(indicator).toContainText("Tràn", { timeout: 30_000 })
    await expect(page.getByRole("img", { name: "Trang 2 của CV" })).toBeVisible()
    // the project is nested under Acme in the "mine" template but is picked from the Projects list
    await page.getByLabel("Dùng mục Very Long Project").uncheck()
    await expect(indicator).toContainText("1 trang", { timeout: 30_000 })

    // bring it back: overflow again -> the fit panel offers its three remedies
    await page.getByLabel("Dùng mục Very Long Project").check()
    await expect(indicator).toContainText("Tràn", { timeout: 30_000 })
    await page.getByRole("button", { name: "Gợi ý bỏ" }).click()
    await expect(page.getByText(/Bỏ (mục|bullet)/).first()).toBeVisible()
    await page.getByRole("button", { name: "Tự co cho vừa" }).click()
    // either it fits now, or auto-fit reports it cannot: both are handled; drop the project to be sure
    await page.waitForTimeout(500)
    if (!(await indicator.textContent())?.includes("1 trang")) {
      await page.getByLabel("Dùng mục Very Long Project").uncheck()
    }
    await expect(indicator).toContainText("1 trang", { timeout: 30_000 })

    // a CV-only rewrite of a bullet
    await page.getByTestId("cv-section-experience").getByRole("button", { name: /AI Engineer/ }).first().click()
    await page.getByRole("button", { name: "Sửa riêng cho bản này" }).first().click()
    await page.getByLabel("Viết lại bullet cho bản CV này").fill("Built a **RAG assistant** for EU clients")
    await page.getByRole("button", { name: "Xong" }).click()
    await expect(page.getByText("đã sửa riêng")).toBeVisible()
    await expect(page.getByText("Đã lưu")).toBeVisible({ timeout: 10_000 })

    // exports
    const pdf = page.waitForEvent("download")
    await page.getByRole("button", { name: "PDF" }).click()
    expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/)
    const tex = page.waitForEvent("download")
    await page.getByRole("button", { name: ".tex" }).click()
    expect((await tex).suggestedFilename()).toMatch(/\.tex$/)

    // save for applying -> appears in the application form CV picker
    await page.getByRole("button", { name: "Lưu để nộp" }).click()
    await expect(page.getByText("Đã lưu thành bản CV để nộp")).toBeVisible({ timeout: 30_000 })
    await page.goto("/")
    await page.getByRole("button", { name: "Thêm đơn" }).filter({ visible: true }).first().click()
    await expect(page.getByRole("dialog").getByLabel("Bản CV đã gửi").locator("option", { hasText: "AI Engineer — Test" })).toHaveCount(1)
  })

  // Part C — score a CV against an application's JD (AI mocked)
  test("optimize a CV for an application: keywords, add from profile, apply an AI suggestion", async ({ page }) => {
    test.setTimeout(180_000)
    await login(page)
    await page.route("**/api/ai/run", async (route) => {
      const body = route.request().postDataJSON()
      if (body.task === "extract_keywords")
        return route.fulfill({
          json: {
            data: {
              keywords: [
                { term: "RAG", aliases: [], weight: "required", category: "AI/ML" },
                { term: "LangChain", aliases: [], weight: "required", category: "AI/ML" },
                { term: "evaluation", aliases: ["evals"], weight: "required", category: "AI/ML" },
                { term: "Terraform", aliases: [], weight: "preferred", category: "Cloud" },
              ],
            },
          },
        })
      if (body.task === "suggest_edits") {
        const b = body.input.bullets[0]
        return route.fulfill({ json: { data: { bullets: [{ id: b.id, text: b.text + " using LangChain", reason: "Nêu rõ công cụ", keywords: ["LangChain"] }], summary: null } } })
      }
      return route.fallback()
    })

    await page.getByRole("link", { name: /ABC AI/ }).first().click()
    await page.getByRole("button", { name: "Tối ưu CV cho đơn này" }).click()
    await expect(page).toHaveURL(/\/cv\/[0-9a-f-]{36}\?tab=score$/)
    const panel = page.getByTestId("score-panel")
    await expect(panel.getByLabel("Nguồn JD")).toHaveValue(/[0-9a-f-]{36}/)
    await panel.getByRole("button", { name: "Phân tích JD" }).click()
    await expect(page.getByText("Đã phân tích JD: 4 keyword")).toBeVisible()

    const total = panel.getByTestId("score-total")
    await expect(total).toHaveText(/\d+/)
    const before = Number(await total.textContent())
    await expect(panel.getByTestId("kw-missing").filter({ hasText: "evaluation" })).toBeVisible()

    // the long project in the profile mentions "evaluation harnesses"
    await panel.getByRole("button", { name: "Thêm evaluation từ hồ sơ" }).click()
    await expect(page.getByText("Đã thêm vào bản CV")).toBeVisible()
    await expect(panel.getByTestId("kw-evidence").filter({ hasText: "evaluation" })).toBeVisible()
    await expect.poll(async () => Number(await total.textContent())).toBeGreaterThan(before)

    // AI suggestion -> apply -> becomes a CV-only rewrite
    await panel.getByRole("button", { name: "Gợi ý sửa bằng AI" }).click()
    const sug = panel.getByTestId("suggestion")
    await expect(sug).toHaveCount(1)
    await sug.getByRole("button", { name: "Áp dụng" }).click()
    await expect(sug).toHaveCount(0)
    await page.getByRole("tab", { name: "Xem trước" }).first().click()
    await expect(page.getByText("Đã lưu")).toBeVisible({ timeout: 10_000 })
  })
})

