import { test, expect } from "@playwright/test";

test.describe("Role-Play (unauthenticated)", () => {
  test("protected routes redirect to login", async ({ page }) => {
    await page.goto("/app/prep/test-id");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

// Full roleplay tests require auth + a created roleplay session.
// TODO: add auth fixture and roleplay session setup.
