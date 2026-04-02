import { test, expect } from "@playwright/test";

test.describe("Session Complete (unauthenticated)", () => {
  test("protected routes redirect to login", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

// Full session completion tests require auth + a completed session.
// TODO: add auth fixture and full session lifecycle setup.
