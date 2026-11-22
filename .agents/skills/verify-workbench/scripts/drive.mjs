// Usage: node .agents/skills/verify-workbench/scripts/drive.mjs run-tests [exercise] [language]
// Drives the real UI in headless Chromium against the launched instance (ports from .practice/verify-run/env) and writes proof to test-results/verify/.
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../../../..");
const { chromium } = createRequire(path.join(root, "package.json"))("@playwright/test");
const [, , action = "run-tests", exercise = "ride-dispatch", language = "go"] = process.argv;
const envFile = path.join(root, ".practice/verify-run/env");
if (existsSync(envFile))
  for (const m of readFileSync(envFile, "utf8").matchAll(/(PRACTICE_\w+)=(\d+)/g)) process.env[m[1]] ??= m[2];
const web = `http://127.0.0.1:${process.env.PRACTICE_WEB_PORT || 5173}`;
const out = path.join(root, "test-results/verify", `${action}-${exercise}-${language}`);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const log = [];
page.on("request", (r) => r.url().includes("/api/") && log.push(`${r.method()} ${new URL(r.url()).pathname}`));
try {
  if (action !== "run-tests") throw new Error(`unknown action ${action}`);
  await page.goto(`${web}/practice/${exercise}`);
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await page.getByLabel("Name", { exact: true }).fill("Verify Driver");
  await page.getByLabel("Email", { exact: true }).fill(`verify-${suffix}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("password-1234");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.locator(".monaco-editor").waitFor();
  if (language !== "go") await page.getByLabel("Programming language").selectOption(language);
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  await page.screenshot({ path: path.join(out, "1-before.png") });
  await page.getByRole("button", { name: "Run tests", exact: false }).click();
  await page.locator(".raw-output").waitFor({ timeout: 30000 });
  await page.waitForFunction(() => /PASS|FAIL|ok|error/i.test(document.querySelector(".raw-output")?.textContent ?? ""), null, { timeout: 30000 });
  const text = await page.locator(".raw-output").innerText();
  writeFileSync(path.join(out, "console.txt"), text);
  writeFileSync(path.join(out, "api-calls.txt"), log.join("\n") + "\n");
  writeFileSync(path.join(out, "aria.txt"), await page.locator("body").ariaSnapshot());
  await page.screenshot({ path: path.join(out, "2-after-run.png") });
  console.log(`evidence: ${out}\n--- console (first 15 lines) ---\n${text.split("\n").slice(0, 15).join("\n")}`);
} finally {
  await browser.close();
}
