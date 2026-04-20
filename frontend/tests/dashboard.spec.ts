import { test, expect } from "@playwright/test";

// Test suite for the landing and navigation pages.
test.describe("Landing & Navigation", () => {
  test("landing page loads with header and CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toContainText("InterviewIntel");
    await expect(
      page.getByRole("link", { name: "Sign in" }),
    ).toBeVisible();
  });

  // Test to verify the login page renders the magic link form.
  test("login page renders magic link form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /magic link/i }),
    ).toBeVisible();
  });

  // Test to verify that unauthenticated visits to /app redirect to the login page.
  test("unauthenticated visit to /app redirects to login", async ({
    page,
  }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
