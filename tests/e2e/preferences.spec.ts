import { test, expect } from "@playwright/test";

test("browser locale and system theme are defaults; overrides persist without replacing the workspace", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "pt-BR",
    colorScheme: "light",
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Pequenos passos. Projetos melhores.",
  );
  await expect(page.locator(".roadmap-exercises li")).toHaveCount(35);
  await expect(page.locator(".roadmap-exercises li").first()).not.toContainText(
    "Bounded stack",
  );
  await page.screenshot({
    path: "test-results/roadmap-pt-light.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Ativar tema escuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Idioma", { exact: true }).selectOption("en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Small steps. Stronger designs.",
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.locator(".roadmap-exercises a").first().click();
  await expect(page.locator(".monaco-editor")).toBeVisible();
  await expect(page.locator(".monaco-editor")).toContainText(
    "package practice",
  );
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/workspace") && request.method() === "POST")
      requests.push(request.url());
  });
  const draft =
    "package practice\n// Keep this English draft across preference changes.\n";
  await page.locator(".monaco-editor").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(draft);
  await page.getByLabel("Language", { exact: true }).selectOption("pt-BR");
  await expect(page.locator(".requirements-list")).toContainText(
    "NewStack(capacity int) *Stack começa vazia",
  );
  await expect(page.locator(".monaco-editor")).toContainText(
    "Keep this English draft",
  );
  await page.screenshot({
    path: "test-results/workspace-pt-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  await expect(page.locator(".monaco-editor")).toHaveClass(/vs(\s|$)/);
  await page.screenshot({
    path: "test-results/workspace-pt-light.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByLabel("Idioma", { exact: true })).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Ativar tema escuro" }),
  ).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await page.screenshot({
    path: "test-results/workspace-pt-light-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(requests).toHaveLength(0);
  await page.reload();
  await expect(page.locator(".monaco-editor")).toContainText(
    "Keep this English draft",
  );
  await context.close();
});

test("system theme follows changes and unsupported browser languages fall back to English", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "fr-FR",
    colorScheme: "dark",
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await context.close();
});
