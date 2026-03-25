import { test, expect, type Page } from "@playwright/test";

const SAMPLE_JD = `
Technical Solutions Engineer at Semgrep.
Help customers integrate static analysis into their CI/CD pipelines.
Requirements: security, DevOps, Python, customer-facing skills.
`;

async function createRoleplaySession(page: Page) {
  await page.goto("/new");
  await page.locator("textarea").first().fill(SAMPLE_JD);
  await page.getByPlaceholder("e.g. Google").fill("Semgrep");
  await page.getByPlaceholder("e.g. Senior Solutions Engineer").fill("Technical Solutions Engineer");

  const modeSelect = page.locator("select").nth(1);
  await modeSelect.selectOption("roleplay");

  await page.getByRole("button", { name: /start prep session/i }).click();
  await expect(page).toHaveURL(/\/prep\//, { timeout: 90_000 });
}

test.describe("Role-Play Flow", () => {
  test("roleplay session shows chat with answer input", async ({ page }) => {
    await createRoleplaySession(page);

    const answerInput = page.getByPlaceholder("Type your answer...");
    await expect(answerInput).toBeVisible({ timeout: 30_000 });
  });

  test("submit answer and receive feedback", async ({ page }) => {
    await createRoleplaySession(page);

    const answerInput = page.getByPlaceholder("Type your answer...");
    await expect(answerInput).toBeVisible({ timeout: 30_000 });

    await answerInput.fill(
      "I would approach this by first understanding the customer's CI/CD pipeline, " +
      "identifying where static analysis fits best, then creating a proof-of-concept " +
      "integration with their existing tools. I'd focus on showing immediate value " +
      "by catching real vulnerabilities in their codebase during the demo."
    );
    await answerInput.press("Enter");

    await expect(page.getByRole("heading", { name: "Strengths" })).toBeVisible({
      timeout: 60_000,
    });
  });

  test("after feedback, can advance to next question", async ({ page }) => {
    await createRoleplaySession(page);

    const answerInput = page.getByPlaceholder("Type your answer...");
    await expect(answerInput).toBeVisible({ timeout: 30_000 });

    await answerInput.fill("I would leverage my DevOps background to understand the customer's infrastructure.");
    await answerInput.press("Enter");

    await expect(page.getByRole("heading", { name: "Strengths" })).toBeVisible({
      timeout: 60_000,
    });

    const nextBtn = page.getByRole("button", { name: /next question/i });
    await expect(nextBtn).toBeVisible({ timeout: 10_000 });
    await nextBtn.click();

    // Next question requires another LLM turn (roleplay_ask); allow headroom.
    await expect(
      page.getByPlaceholder("Type your answer...")
    ).toBeVisible({ timeout: 90_000 });
  });
});
