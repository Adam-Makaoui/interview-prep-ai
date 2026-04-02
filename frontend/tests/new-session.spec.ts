import { test, expect } from "@playwright/test";

test.describe("New Session (unauthenticated)", () => {
  test("redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/app/new");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

// Full form tests require authenticated session.
// TODO: add auth fixture that pre-seeds a test user session via Supabase.
