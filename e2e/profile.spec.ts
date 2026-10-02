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
})
