import { test, expect, type Locator, type Page } from "@playwright/test";
import { createAccount } from "./auth";

async function dimensions(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, "The panel must have a visible bounding box").not.toBeNull();
  if (!box) throw new Error("The panel must have a visible bounding box");
  return box;
}

async function drag(page: Page, separator: Locator, dx: number, dy: number) {
  const box = await dimensions(separator);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await createAccount(page);
  await page.goto("/practice/ride-dispatch");
  await expect(page.locator(".monaco-editor")).toBeVisible();
});

test("panel dividers resize all panes and restore their sizes after reload", async ({
  page,
}) => {
  const requirements = page.locator(".requirements-panel");
  const explorer = page.locator(".explorer");
  const consolePanel = page.locator(".console-panel");
  const originalRequirements = await dimensions(requirements);
  await drag(
    page,
    page.getByRole("separator", { name: "Resize requirements", exact: true }),
    70,
    0,
  );
  await expect
    .poll(async () => (await dimensions(requirements)).width)
    .toBeGreaterThan(originalRequirements.width + 40);

  const originalExplorer = await dimensions(explorer);
  await drag(
    page,
    page.getByRole("separator", { name: "Resize file explorer", exact: true }),
    45,
    0,
  );
  await expect
    .poll(async () => (await dimensions(explorer)).width)
    .toBeGreaterThan(originalExplorer.width + 25);

  const originalConsole = await dimensions(consolePanel);
  await drag(
    page,
    page.getByRole("separator", { name: "Resize console", exact: true }),
    0,
    -65,
  );
  await expect
    .poll(async () => (await dimensions(consolePanel)).height)
    .toBeGreaterThan(originalConsole.height + 40);

  const saved = {
    requirements: (await dimensions(requirements)).width,
    explorer: (await dimensions(explorer)).width,
    console: (await dimensions(consolePanel)).height,
  };
  await page.reload();
  await expect(page.locator(".monaco-editor")).toBeVisible();
  expect((await dimensions(requirements)).width).toBeCloseTo(
    saved.requirements,
    0,
  );
  expect((await dimensions(explorer)).width).toBeCloseTo(saved.explorer, 0);
  expect((await dimensions(consolePanel)).height).toBeCloseTo(saved.console, 0);
  await expect(page.locator(".editor-status")).toBeInViewport();
});

test("panel dividers support keyboard resizing", async ({ page }) => {
  for (const [name, panel, dimension, key] of [
    ["Resize requirements", ".requirements-panel", "width", "ArrowRight"],
    ["Resize file explorer", ".explorer", "width", "ArrowRight"],
    ["Resize console", ".console-panel", "height", "ArrowUp"],
  ] as const) {
    const before = (await dimensions(page.locator(panel)))[dimension];
    const separator = page.getByRole("separator", { name, exact: true });
    await separator.focus();
    await page.keyboard.press(key);
    await expect
      .poll(async () => (await dimensions(page.locator(panel)))[dimension])
      .toBeGreaterThan(before);
  }
});

test("all panes collapse, stay collapsed after reload, and can be restored", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Collapse requirements", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Collapse file explorer", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Collapse console", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".monaco-editor")).toBeVisible();
  await expect(page.locator(".requirements-panel")).not.toBeVisible();
  await expect(page.locator(".explorer")).not.toBeVisible();
  await expect(page.locator(".console-content")).not.toBeVisible();
  for (const name of [
    "Show requirements",
    "Show file explorer",
    "Show console",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  await expect(page.locator(".requirements-panel")).toBeVisible();
  await expect(page.locator(".explorer")).toBeVisible();
  await expect(page.locator(".console-content")).toBeVisible();
  await expect(page.locator(".editor-status")).toBeInViewport();
});

test("compact toolbar omits the branding bar and keeps timer + settings controls", async ({
  page,
}) => {
  await expect(page.locator(".app-header")).toHaveCount(0);
  await expect(page.locator(".workspace-toolbar")).toBeVisible();
  await expect(page.locator(".requirements-panel")).toBeVisible();
  await expect(page.locator(".monaco-editor")).toBeVisible();
  await expect(page.getByLabel("Programming language")).toBeVisible();
  const timer = page.getByTitle("Start or pause practice timer", { exact: true });
  await expect(timer).toBeVisible();
  await timer.click();
  await expect(timer).toContainText("00:01", { timeout: 3000 });
  await timer.click();
  await expect(timer).not.toHaveClass(/active/);
  await expect(
    page.getByRole("button", { name: "Run tests", exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("checkbox", { name: /Practice timer/ }).uncheck();
  await expect(timer).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close settings", exact: true }).click();
  await page.reload();
  await expect(
    page.getByTitle("Start or pause practice timer", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open exercise library", exact: true }),
  ).toBeVisible();
});
