import { test, expect } from "@playwright/test";

async function openSettings(page: import("@playwright/test").Page, label = "Settings") {
  await page.getByRole("button", { name: label, exact: true }).click();
  return page.getByRole("dialog", { name: label, exact: true });
}

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
  await expect(page.locator(".roadmap-exercises li")).toHaveCount(44);
  await expect(page.locator(".roadmap-exercises li").first()).not.toContainText(
    "Bounded stack",
  );
  await page.screenshot({
    path: "test-results/roadmap-pt-light.png",
    fullPage: true,
    animations: "disabled",
  });
  let dialog = await openSettings(page, "Configurações");
  await dialog.getByRole("button", { name: "Escuro", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await dialog.getByLabel("Idioma", { exact: true }).selectOption("en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Small steps. Stronger designs.",
  );
  await dialog.getByRole("button", { name: "Close settings", exact: true }).click();
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
  dialog = await openSettings(page);
  await dialog.getByLabel("Language", { exact: true }).selectOption("pt-BR");
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
  await dialog.getByRole("button", { name: "Claro", exact: true }).click();
  await expect(page.locator(".monaco-editor")).toHaveClass(/vs(\s|$)/);
  await dialog
    .getByRole("button", { name: "Fechar configurações", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/workspace-pt-light.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("button", { name: "Configurações", exact: true })).toBeInViewport();
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
  let dialog = await openSettings(page);
  await dialog.getByRole("button", { name: "Dark", exact: true }).click();
  await dialog.getByRole("button", { name: "Close settings", exact: true }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  dialog = await openSettings(page);
  await dialog.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await dialog.getByRole("button", { name: "Close settings", exact: true }).click();
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

test("editor theme, font, font size, and interface text size can be configured and persist", async ({
  page,
}) => {
  await page.goto("/practice/bounded-stack");
  await expect(page.locator(".monaco-editor")).toBeVisible();
  const dialog = await openSettings(page);
  await dialog.getByLabel("Editor theme", { exact: true }).selectOption("monokai");
  await dialog
    .getByLabel("Editor font", { exact: true })
    .selectOption("ibm-plex-mono");
  await dialog
    .getByRole("button", { name: "Increase editor font size", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Increase editor font size", exact: true })
    .click();
  await expect(dialog.locator(".font-size-stepper output")).toHaveText("16px");
  await dialog.getByRole("button", { name: "Large", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");
  await dialog
    .getByRole("button", { name: "Close settings", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");
  const again = await openSettings(page);
  await expect(again.getByLabel("Editor theme", { exact: true })).toHaveValue(
    "monokai",
  );
  await expect(again.getByLabel("Editor font", { exact: true })).toHaveValue(
    "ibm-plex-mono",
  );
  await expect(again.locator(".font-size-stepper output")).toHaveText("16px");
});
