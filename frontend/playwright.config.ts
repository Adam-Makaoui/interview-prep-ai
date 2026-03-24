import { defineConfig, devices } from "@playwright/test";

/** Vite default dev server (IPv6 localhost on some systems). */
const BASE_URL = "http://localhost:5173";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "html",
  timeout: 120_000,

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "./scripts/e2e-serve.sh",
    url: BASE_URL,
    /** Prefer true so local dev (ports already taken) and CI (fresh ports) both work. */
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
