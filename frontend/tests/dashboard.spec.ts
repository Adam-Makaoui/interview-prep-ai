import { test, expect } from "@playwright/test";

test.describe("Landing & Navigation", () => {
  test("landing page loads with header and CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toContainText("InterviewPrep");
    await expect(
      page.getByRole("link", { name: "Sign in" }),
    ).toBeVisible();
  });

  test("login page renders magic link form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /magic link/i }),
    ).toBeVisible();
  });

  test("unauthenticated visit to /app redirects to login", async ({
    page,
  }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
