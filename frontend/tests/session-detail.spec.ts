import { test, expect, type Page } from "@playwright/test";

const SAMPLE_JD = `
Senior Solutions Engineer at Cloudflare.
Design and deploy edge network solutions for enterprise customers.
Requirements: networking fundamentals, CDN, DNS, security, Python, customer presentations.
`;

async function createSession(page: Page) {
  await page.goto("/new");
  await page.locator("textarea").first().fill(SAMPLE_JD);
  await page.getByPlaceholder("e.g. Google").fill("Cloudflare");
  await page.getByPlaceholder("e.g. Senior Solutions Engineer").fill("Senior Solutions Engineer");
  await page.getByRole("button", { name: /start prep session/i }).click();
  await expect(page).toHaveURL(/\/prep\//, { timeout: 90_000 });
}

test.describe("Session Detail — Tabs", () => {
  test("all four tabs are visible and clickable", async ({ page }) => {
    await createSession(page);

    for (const tab of ["Analysis", "Q&A", "Role-Play", "Scorecard"]) {
      const btn = page.getByRole("button", { name: tab });
      await expect(btn).toBeVisible();
    }
  });

  test("Analysis tab shows key skills section", async ({ page }) => {
    await createSession(page);

    await page.getByRole("button", { name: "Analysis" }).click();
    await expect(
      page.getByText(/key skills/i).or(page.getByText(/culture signals/i)).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Q&A tab shows questions once generated", async ({ page }) => {
    await createSession(page);

    await page.getByRole("button", { name: "Q&A" }).click();

    await expect(
      page.locator("[class*='rounded']").filter({ hasText: /\?/ }).first()
    ).toBeVisible({ timeout: 30_000 });
  });

  test("Scorecard tab shows dimensions or placeholder", async ({ page }) => {
    await createSession(page);

    await page.getByRole("button", { name: "Scorecard" }).click();
    await expect(
      page.getByText(/this session/i).or(page.getByText(/start a role-play/i)).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
