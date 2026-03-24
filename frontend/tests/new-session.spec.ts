import { test, expect } from "@playwright/test";

const SAMPLE_JD = `
We are looking for a Solutions Engineer to join our Cloud team.
You will work with customers to design and implement solutions using our platform.
Requirements: 5+ years experience, Python, AWS, customer-facing communication skills.
Company: Google  Role: Solutions Engineer
`;

test.describe("New Session", () => {
  test("form renders with all required fields", async ({ page }) => {
    await page.goto("/new");

    await expect(page.getByPlaceholder("e.g. Google")).toBeVisible();
    await expect(page.getByPlaceholder("e.g. Senior Solutions Engineer")).toBeVisible();
    await expect(page.getByRole("button", { name: /start prep session/i })).toBeVisible();
  });

  test("fill form and submit creates a session", async ({ page }) => {
    await page.goto("/new");

    const jdArea = page.locator("textarea").first();
    await jdArea.fill(SAMPLE_JD);

    await page.getByPlaceholder("e.g. Google").fill("Google");
    await page.getByPlaceholder("e.g. Senior Solutions Engineer").fill("Solutions Engineer");

    await page.getByRole("button", { name: /start prep session/i }).click();

    await expect(page).toHaveURL(/\/prep\//, { timeout: 90_000 });
  });

  test("session detail page loads after creation with analysis tab", async ({ page }) => {
    await page.goto("/new");

    const jdArea = page.locator("textarea").first();
    await jdArea.fill(SAMPLE_JD);
    await page.getByPlaceholder("e.g. Google").fill("Google");
    await page.getByPlaceholder("e.g. Senior Solutions Engineer").fill("Solutions Engineer");

    await page.getByRole("button", { name: /start prep session/i }).click();
    await expect(page).toHaveURL(/\/prep\//, { timeout: 90_000 });

    await expect(page.getByText("Analysis")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Q&A")).toBeVisible();
    await expect(page.getByText("Role-Play")).toBeVisible();
    await expect(page.getByText("Scorecard")).toBeVisible();
  });
});
