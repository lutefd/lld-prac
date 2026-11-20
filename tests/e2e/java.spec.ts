import { expect, test } from "@playwright/test";

test("Java opens from the roadmap, preserves drafts, and keeps progress scoped to Java", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("workbench.progress.bounded-stack.java", "4");
  });
  await page.getByLabel("Roadmap language").selectOption("java");
  await expect(page.locator(".roadmap-controls")).toContainText(
    "1 of 35 exercises completed",
  );
  await page.getByRole("link", { name: "Continue the path" }).click();
  await expect(page).toHaveURL(/\/practice\/fifo-queue$/);
  const selector = page.getByLabel("Programming language");
  await expect(selector).toHaveValue("java");
  await expect(page.locator(".active-tab")).toContainText(
    "Implementation.java",
  );
  await expect(page.locator(".file-list")).toContainText("SandboxTest.java");
  await expect(page.locator(".file-list")).not.toContainText("HiddenLevel");
  await expect(page.locator(".monaco-editor")).toContainText("class");
  await page.locator(".monaco-editor").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(
    "// JAVA_DRAFT_PRESERVED\nclass Implementation {}\n",
  );
  await selector.selectOption("python");
  await expect(page.locator(".active-tab")).toContainText("implementation.py");
  await selector.selectOption("java");
  await expect(page.locator(".monaco-editor")).toContainText(
    "JAVA_DRAFT_PRESERVED",
  );

  await page.getByRole("button", { name: "New file", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create file", exact: true });
  await expect(dialog.getByLabel("File path", { exact: true })).toHaveAttribute(
    "placeholder",
    "Helper.java",
  );
  await dialog.getByLabel("File path", { exact: true }).fill("Helper.java");
  await dialog
    .getByRole("button", { name: "Create file", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".active-tab")).toContainText("Helper.java");

  await page.route("**/api/workspace/*/run", async (route) => {
    await route.fulfill({
      json: { passed: true, output: "JAVA_TESTS_PASSED", durationMs: 12 },
    });
  });
  await page.getByRole("button", { name: "Run tests", exact: false }).click();
  await expect(page.locator(".raw-output")).toContainText("JAVA_TESTS_PASSED");
  await expect(page.locator(".console-command")).toHaveText("javac + java");
  await expect(
    page.getByRole("button", { name: "Level 2", exact: true }),
  ).toBeEnabled();
  await selector.selectOption("python");
  await expect(page.locator(".file-list")).toContainText("implementation.py");
  await expect(
    page.getByRole("button", { name: "Level 2", exact: true }),
  ).toBeDisabled();
  await selector.selectOption("java");
  await expect(page.locator(".file-list")).toContainText("Helper.java");
  await expect(
    page.getByRole("button", { name: "Level 2", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(selector).toHaveValue("java");
  await expect(page.locator(".monaco-editor")).toContainText(
    "JAVA_DRAFT_PRESERVED",
  );
});
