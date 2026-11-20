import { test, expect } from "@playwright/test";

test("roadmap orders the full catalog, restores progress, and opens the selected language and exercise", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Small steps. Stronger designs." }),
  ).toBeVisible();
  await expect(page.locator(".roadmap-exercises li")).toHaveCount(35);
  await expect(page.locator(".roadmap-exercises li").first()).toContainText(
    "Bounded stack",
  );
  await page.evaluate(() => {
    localStorage.setItem("workbench.progress.bounded-stack.python", "4");
  });
  await page.getByLabel("Roadmap language").selectOption("python");
  await expect(page.locator(".roadmap-controls")).toContainText(
    "1 of 35 exercises completed",
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
  await page.getByRole("link", { name: "Continue the path" }).click();
  await expect(page).toHaveURL(/\/practice\/fifo-queue$/);
  await expect(
    page.getByRole("heading", { name: "FIFO queue", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Programming language")).toHaveValue("python");
  await expect(page.locator(".file-list")).toContainText("implementation.py");
  await page.getByRole("link", { name: "Practice roadmap" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await expect(page.getByLabel("Roadmap language")).toHaveValue("python");
  await page.getByRole("link", { name: /FIFO queue/ }).click();
  await expect(page).toHaveURL(/\/practice\/fifo-queue$/);
  await expect(
    page.getByRole("heading", { name: "FIFO queue", exact: true }),
  ).toBeVisible();
});

test("exercise URLs take precedence over remembered selections and support reload and browser history", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("workbench.problem", JSON.stringify("bounded-stack"));
  });
  await page.goto("/practice/ride-dispatch");
  await expect(
    page.getByRole("heading", { name: "Ride dispatch", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open exercise library" }).click();
  const fare = page.locator(".exercise-card").filter({
    has: page.getByRole("heading", { name: "Fare calculator", exact: true }),
  });
  await expect(fare).toHaveAttribute("href", "/practice/fare-calculator");
  await fare.click();
  await expect(page).toHaveURL(/\/practice\/fare-calculator$/);
  await expect(
    page.getByRole("heading", { name: "Fare calculator", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Fare calculator", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/practice\/ride-dispatch$/);
  await expect(
    page.getByRole("heading", { name: "Ride dispatch", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Fare calculator", exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Small steps. Stronger designs." }),
  ).toBeVisible();
});

test("unknown exercise links offer a route back to the roadmap", async ({
  page,
}) => {
  await page.goto("/practice/not-a-real-exercise");
  await expect(
    page.getByRole("heading", { name: "Exercise not found" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Practice roadmap" }).click();
  await expect(
    page.getByRole("heading", { name: "Small steps. Stronger designs." }),
  ).toBeVisible();
});

test("new themes expose all difficulty levels and remain usable on mobile", async ({
  page,
}) => {
  await page.goto("/practice/bounded-stack");
  await page.getByRole("button", { name: "Open exercise library" }).click();
  for (const category of ["Commerce", "Collaboration", "Infrastructure"]) {
    await page.getByRole("button", { name: category, exact: true }).click();
    await expect(page.locator(".exercise-card")).toHaveCount(3);
    for (const difficulty of ["Easy", "Medium", "Hard"]) {
      await expect(
        page
          .locator(".exercise-card .difficulty")
          .filter({ hasText: difficulty }),
      ).toHaveCount(1);
    }
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(
    page.getByRole("button", { name: "Infrastructure", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  const link = page.locator(".exercise-card").filter({
    has: page.getByRole("heading", {
      name: "Feature flag registry",
      exact: true,
    }),
  });
  await link.click();
  await expect(page).toHaveURL(/\/practice\/feature-flags$/);
  await expect(page.locator(".file-list")).toContainText("implementation.go");
});
