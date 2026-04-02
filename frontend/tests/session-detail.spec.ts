import { test, expect } from "@playwright/test";

test.describe("Session Detail (unauthenticated)", () => {
  test("redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/app/prep/test-id");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

// Full session detail tests require authenticated session with a created prep.
// TODO: add auth fixture and session creation setup.
