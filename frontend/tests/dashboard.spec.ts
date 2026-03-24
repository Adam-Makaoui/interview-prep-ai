import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("loads and shows the app header", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header")).toContainText("InterviewPrepAI");
  });

  test("empty state shows hero illustration and new-session link", async ({ page }) => {
    await page.goto("/");
    const newBtn = page.getByRole("link", { name: /new session/i });
    await expect(newBtn).toBeVisible();
  });

  test("new-session link navigates to /new", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /new session/i }).click();
    await expect(page).toHaveURL(/\/new/);
  });
});
