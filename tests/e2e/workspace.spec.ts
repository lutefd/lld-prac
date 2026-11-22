import { test, expect } from "@playwright/test";
import { createAccount } from "./auth";

test("workspace runs real Go checks, personal tests, and restores drafts", async ({
  page,
}) => {
  await createAccount(page);
  await page.goto("/practice/ride-dispatch");
  await expect(
    page.getByRole("heading", { name: "Ride dispatch", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Run tests", exact: false }),
  ).toBeEnabled();
  await expect(page.locator(".editor-status")).toBeInViewport();
  await page.getByRole("button", { name: "Collapse requirements" }).click();
  await expect(
    page.getByRole("button", { name: "Show requirements" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show requirements" }).click();
  await page.getByRole("button", { name: "Run tests", exact: false }).click();
  await expect(page.locator(".raw-output")).toContainText("FAIL", {
    timeout: 30000,
  });
  await expect(page.locator(".raw-output")).toContainText("TestUser_Smoke");
  await expect(page.locator(".file-list")).not.toContainText("hidden");
  const solution = `package practice
type Dispatcher struct { drivers map[string]int }
func NewDispatcher() *Dispatcher { return &Dispatcher{drivers:map[string]int{}} }
func (d *Dispatcher) Register(id string, position int) bool { if id == "" { return false }; if _, ok := d.drivers[id]; ok { return false }; d.drivers[id] = position; return true }
func (d *Dispatcher) Count() int { return len(d.drivers) }
func (d *Dispatcher) Nearest(position int) (string, bool) { return "",false }
func (d *Dispatcher) Assign(position int) (string, bool) { return "",false }
func (d *Dispatcher) Release(id string) bool { return false }
`;
  await page.locator(".monaco-editor").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(solution);
  await page
    .getByRole("button", { name: "sandbox_test.go", exact: true })
    .click();
  await page.locator(".monaco-editor").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(`package practice
import "testing"
func TestArbitraryName(t *testing.T) { t.Log("MY_EDGE_CASE_OUTPUT"); d:=NewDispatcher(); if d.Count()!=0 { t.Fatal("new registry must be empty") } }
`);
  await page.getByRole("button", { name: "Run tests", exact: false }).click();
  await expect(page.locator(".raw-output")).toContainText("PASS", {
    timeout: 30000,
  });
  await expect(page.locator(".raw-output")).toContainText(
    "MY_EDGE_CASE_OUTPUT",
  );
  await expect(page.locator(".raw-output")).toContainText("TestArbitraryName");
  await expect(
    page.getByText("Checks passed. Submit to complete this level."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Level 2", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Continue to level 2" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText("Submission passed")).toBeVisible({
    timeout: 30000,
  });
  await expect(page.locator(".raw-output")).toContainText(
    "MY_EDGE_CASE_OUTPUT",
  );
  await expect(
    page.getByRole("button", { name: "Continue to level 2" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Level 2", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(page.locator(".monaco-editor")).toContainText(
    "drivers map[string]int",
    { timeout: 20000 },
  );
  await page.getByRole("button", { name: "Open exercise library" }).click();
  await expect(
    page.getByRole("dialog", { name: "Exercise library" }),
  ).toBeVisible();
  await expect(page.locator(".library-tools")).toContainText("44 exercises");
  await page.getByLabel("Search exercises").fill("parking");
  await expect(page.locator(".exercise-card")).toHaveCount(2);
  await expect(page.locator(".exercise-grid")).toContainText(
    "Multi-level parking garage",
  );
  await page.getByLabel("Search exercises").fill("");
  await page.getByRole("button", { name: "Banking", exact: true }).click();
  await expect(page.locator(".exercise-card")).toHaveCount(5);
  await page.getByRole("button", { name: "Close exercise library" }).click();
  await page.screenshot({ path: "test-results/workbench.png", fullPage: true });
});

for (const [language, expected] of [
  ["python", "FAILED"],
  ["typescript", "fail"],
] as const) {
  test(`${language} runs level checks and editable sandbox tests`, async ({
    page,
  }) => {
    await createAccount(page);
    await page.goto("/practice/ride-dispatch");
    await expect(
      page.getByRole("button", { name: "Run tests", exact: false }),
    ).toBeEnabled();
    await page.getByLabel("Programming language").selectOption(language);
    await expect(page.locator(".file-list")).toContainText(
      language === "python" ? "implementation.py" : "implementation.ts",
    );
    await expect(
      page.getByRole("button", { name: "Run tests", exact: false }),
    ).toBeEnabled({ timeout: 30000 });
    await page.getByRole("button", { name: "Run tests", exact: false }).click();
    await expect(page.locator(".raw-output")).toContainText(expected, {
      timeout: 30000,
    });
    await expect(page.locator(".raw-output")).toContainText(
      /sandbox|personal|smoke|Smoke/i,
    );
    await expect(page.locator(".raw-output")).not.toContainText(
      "ModuleNotFoundError",
    );
  });
}
