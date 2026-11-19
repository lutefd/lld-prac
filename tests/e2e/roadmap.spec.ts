import { test, expect } from "@playwright/test";

test("roadmap orders the full catalog, restores progress, and opens the selected language and exercise", async ({
  page,
}) => {
  await page.goto("/#roadmap");
  await expect(
    page.getByRole("heading", { name: "Small steps. Stronger designs." }),
  ).toBeVisible();
  await expect(page.locator(".roadmap-exercises li")).toHaveCount(26);
  await expect(page.locator(".roadmap-exercises li").first()).toContainText(
    "Bounded stack",
  );
  await page.evaluate(() => {
    localStorage.setItem("workbench.progress.bounded-stack.python", "4");
  });
  await page.getByLabel("Roadmap language").selectOption("python");
  await expect(page.locator(".roadmap-controls")).toContainText(
    "1 of 26 exercises completed",
  );
  await expect(page.locator(".roadmap-exercises li").first()).toContainText(
    "3/3 levels",
  );
  await page.screenshot({ path: "test-results/roadmap.png", fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await page.screenshot({
    path: "test-results/roadmap-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await expect(page.getByLabel("Roadmap language")).toHaveValue("python");
  await page.getByRole("button", { name: "Continue the path" }).click();
  await expect(
    page.getByRole("heading", { name: "FIFO queue", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Programming language")).toHaveValue("python");
  await expect(page.locator(".file-list")).toContainText("implementation.py");
  await page.getByRole("link", { name: "Practice roadmap" }).click();
  await expect(page).toHaveURL(/#roadmap$/);
  await page.reload();
  await expect(page.getByLabel("Roadmap language")).toHaveValue("python");
  await page.getByRole("link", { name: "Back to practice" }).click();
  await expect(
    page.getByRole("heading", { name: "FIFO queue", exact: true }),
  ).toBeVisible();
});
