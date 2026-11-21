// Usage: node .agents/skills/verify-workbench/scripts/drive.mjs run-tests [exercise] [language]
// Drives the real UI in headless Chromium against http://127.0.0.1:5173 and writes proof to test-results/verify/.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../../../..");
const { chromium } = createRequire(path.join(root, "package.json"))("@playwright/test");
const [, , action = "run-tests", exercise = "ride-dispatch", language = "go"] = process.argv;
const out = path.join(root, "test-results/verify", `${action}-${exercise}-${language}`);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const log = [];
page.on("request", (r) => r.url().includes("/api/") && log.push(`${r.method()} ${new URL(r.url()).pathname}`));
try {
  if (action !== "run-tests") throw new Error(`unknown action ${action}`);
  await page.goto(`http://127.0.0.1:5173/practice/${exercise}`);
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
