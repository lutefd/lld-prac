import { defineConfig } from "@playwright/test";
const base = `http://127.0.0.1:${process.env.PRACTICE_WEB_PORT || 5173}`;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: base,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    // Browser cases open independent workspaces that outlive their pages.
    env: { PRACTICE_MAX_WORKSPACES: "100" },
    url: base,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
