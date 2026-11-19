import { expect, test, type Page } from "@playwright/test";

async function createFile(page: Page, path: string) {
  await page.getByRole("button", { name: "New file", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create file", exact: true });
  await dialog.getByLabel("File path", { exact: true }).fill(path);
  await dialog
    .getByRole("button", { name: "Create file", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".active-tab")).toContainText(path);
}

async function replaceCode(page: Page, content: string) {
  await page.locator(".monaco-editor").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(content);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/practice/ride-dispatch");
  await expect(page.locator(".monaco-editor")).toBeVisible();
});

test("extra Go source and test files run, persist, and stay scoped to their language", async ({
  page,
}) => {
  await createFile(page, "helper.go");
  await replaceCode(
    page,
    "package practice\n\nfunc AdditionalAnswer() int { return 42 }\n",
  );
  await createFile(page, "helper_test.go");
  await replaceCode(
    page,
    `package practice
import "testing"
func TestAdditional(t *testing.T) {
 t.Log("ADDITIONAL_FILE_OUTPUT")
 if AdditionalAnswer() != 42 { t.Fatal("helper must be available to extra tests") }
}
`,
  );
  await page.getByRole("button", { name: "Run tests", exact: false }).click();
  await expect(page.locator(".raw-output")).toContainText(
    "ADDITIONAL_FILE_OUTPUT",
    { timeout: 30000 },
  );
  await expect(page.locator(".raw-output")).toContainText(
    /--- PASS: TestAdditional/,
  );
  await page.reload();
  await expect(page.locator(".file-list")).toContainText("helper.go");
  await expect(page.locator(".file-list")).toContainText("helper_test.go");
  await page.getByRole("button", { name: "helper.go", exact: true }).click();
  await expect(page.locator(".monaco-editor")).toContainText(
    "AdditionalAnswer",
  );
  await expect(page.locator(".monaco-editor")).toContainText("42");
  await page.getByLabel("Programming language").selectOption("python");
  await expect(page.locator(".file-list")).toContainText("implementation.py");
  await expect(page.locator(".file-list")).not.toContainText("helper.go");
  await expect(page.locator(".file-list")).not.toContainText("helper_test.go");
  await page.getByLabel("Programming language").selectOption("go");
  await expect(page.locator(".file-list")).toContainText("helper.go");
  await page.getByRole("button", { name: "helper.go", exact: true }).click();
  await expect(page.locator(".monaco-editor")).toContainText(
    "AdditionalAnswer",
  );
});

test("invalid file paths show an error without creating a file", async ({
  page,
}) => {
  await page.getByRole("button", { name: "New file", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create file", exact: true });
  await dialog.getByLabel("File path", { exact: true }).fill("../escape.go");
  await dialog
    .getByRole("button", { name: "Create file", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(page.locator(".file-list")).not.toContainText("escape.go");
});
