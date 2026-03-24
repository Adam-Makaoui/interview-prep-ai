import { test, expect, type Page } from "@playwright/test";

const SAMPLE_JD = `
Solutions Engineer at Pigment.
Help finance teams implement planning and budgeting solutions.
Requirements: financial modeling, SaaS, Python, SQL, customer workshops.
`;

async function createAndStartRoleplay(page: Page) {
  await page.goto("/new");
  await page.locator("textarea").first().fill(SAMPLE_JD);
  await page.getByPlaceholder("e.g. Google").fill("Pigment");
  await page.getByPlaceholder("e.g. Senior Solutions Engineer").fill("Solutions Engineer");

  const modeSelect = page.locator("select").nth(1);
  await modeSelect.selectOption("roleplay");

  await page.getByRole("button", { name: /start prep session/i }).click();
  await expect(page).toHaveURL(/\/prep\//, { timeout: 90_000 });
}

test.describe("Session Complete", () => {
  test("answer one question, finish early, scorecard renders", async ({ page }) => {
    test.setTimeout(300_000);

    await createAndStartRoleplay(page);

    const answerInput = page.getByPlaceholder("Type your answer...");
    await expect(answerInput).toBeVisible({ timeout: 30_000 });

    await answerInput.fill(
      "I have extensive experience with financial planning tools and customer workshops. " +
      "At my previous role, I led implementation for 10+ enterprise accounts."
    );
    await answerInput.press("Enter");

    await expect(page.getByRole("heading", { name: "Strengths" })).toBeVisible({
      timeout: 60_000,
    });

    const finishBtn = page.getByRole("button", { name: /finish|end session|see scorecard/i });
    const nextBtn = page.getByRole("button", { name: /next question/i });

    if (await finishBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await finishBtn.click();
    } else if (await nextBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(2_000);

      const answerInput2 = page.getByPlaceholder("Type your answer...");
      if (await answerInput2.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await answerInput2.fill("I would map the customer's planning workflow and demonstrate ROI.");
        await answerInput2.press("Enter");
        await page.waitForTimeout(5_000);
      }

      const retryFinish = page.getByRole("button", { name: /finish|end session|see scorecard/i });
      if (await retryFinish.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await retryFinish.click();
      }
    }

    await page.getByRole("button", { name: "Scorecard" }).click();

    await expect(
      page.getByText(/this session/i).first()
    ).toBeVisible({ timeout: 30_000 });
  });
});
