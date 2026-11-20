// Captures the README screenshots and demo GIF from a local dev server seeded by scripts/demo/seed.ts.
// Usage: NEXT_PUBLIC_DEV_LOGIN=1 ALLOWED_EMAILS=demo@local.test npm run dev, then npx tsx scripts/demo/capture.ts
// The GIF needs ffmpeg on PATH.
import { execFileSync } from "node:child_process"
import { mkdirSync, readdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { chromium, type Browser, type Page } from "@playwright/test"

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000"
const OUT = "docs/screenshots"
const EMAIL = "demo@local.test"
const PASSWORD = "demo-password"

async function login(page: Page) {
  await page.goto(`${BASE}/login`)
  const form = page.getByTestId("dev-login")
  await form.getByLabel("Email").fill(EMAIL)
  await form.getByLabel("Mật khẩu").fill(PASSWORD)
  await form.getByRole("button", { name: "Đăng nhập dev" }).click()
  await page.getByRole("heading", { name: "Đơn ứng tuyển" }).waitFor()
}

async function settle(page: Page, ms = 1200) {
  await page.waitForLoadState("networkidle").catch(() => {})
  await page.waitForTimeout(ms)
  // hide the Next.js dev indicator
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => e.remove()))
}

async function newPage(browser: Browser, width: number, height: number, scheme: "light" | "dark", video?: string) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: video ? 1 : 2,
    colorScheme: scheme,
    ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}),
  })
  return { context, page: await context.newPage() }
}

async function shots(browser: Browser) {
  const { context, page } = await newPage(browser, 1680, 1000, "light")
  await login(page)

  await settle(page)
  await page.screenshot({ path: join(OUT, "board.png") })

  await page.getByText("Lumen Analytics").first().click()
  await page.waitForURL(/\/applications\//)
  await settle(page)
  await page.screenshot({ path: join(OUT, "application.png") })

  await page.goto(`${BASE}/dashboard`)
  await settle(page, 2000)
  await page.screenshot({ path: join(OUT, "dashboard.png") })

  await page.goto(`${BASE}/profile`)
  await settle(page)
  await page.screenshot({ path: join(OUT, "profile.png") })

  await page.goto(`${BASE}/cv`)
  await settle(page)
  await page.getByText("AI Engineer — general").first().click()
  await page.waitForURL(/\/cv\/[^/]+$/)
  await settle(page, 4000) // the PDF preview renders in the browser
  await page.screenshot({ path: join(OUT, "cv-builder.png") })
  await context.close()

  const dark = await newPage(browser, 1680, 1000, "dark")
  await login(dark.page)
  await settle(dark.page)
  await dark.page.screenshot({ path: join(OUT, "board-dark.png") })
  await dark.context.close()

  const phone = await newPage(browser, 390, 844, "light")
  await login(phone.page)
  await settle(phone.page)
  await phone.page.screenshot({ path: join(OUT, "board-phone.png") })
  await phone.context.close()
}

async function gif(browser: Browser) {
  const dir = join(OUT, ".video")
  rmSync(dir, { recursive: true, force: true })
  // log in outside the recording, then reuse the session
  const pre = await newPage(browser, 1600, 900, "light")
  await login(pre.page)
  const state = await pre.context.storageState()
  await pre.context.close()

  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, colorScheme: "light", storageState: state, recordVideo: { dir, size: { width: 1600, height: 900 } } })
  const page = await context.newPage()
  await page.goto(BASE)
  await settle(page, 1500)

  // drag "Juniper Edu" from Screening to a later stage
  const card = page.getByText("Juniper Edu").first()
  const target = page.getByText("Orbit Retail").first()
  const from = (await card.boundingBox())!
  const to = (await target.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 5, { steps: 5 })
  await page.mouse.move(to.x + to.width / 2, to.y + to.height + 30, { steps: 30 })
  await page.waitForTimeout(400)
  await page.mouse.up()
  await settle(page, 1500)

  await page.getByText("Lumen Analytics").first().click()
  await page.waitForURL(/\/applications\//)
  await settle(page, 2500)
  await page.mouse.wheel(0, 500)
  await page.waitForTimeout(1500)

  await page.goto(`${BASE}/dashboard`)
  await settle(page, 2500)
  const video = page.video()!
  await context.close()
  const webm = await video.path()

  const gifPath = join(OUT, "demo.gif")
  execFileSync("ffmpeg", ["-y", "-i", webm, "-vf", "fps=10,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4", gifPath], { stdio: "ignore" })
  rmSync(dir, { recursive: true, force: true })
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  try {
    await shots(browser)
    await gif(browser)
  } finally {
    await browser.close()
  }
  console.log(readdirSync(OUT).join("\n"))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
