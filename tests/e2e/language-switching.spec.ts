import { test, expect } from "@playwright/test";
import { createAccount } from "./auth";

for (const outcome of ["pass", "failure", "timeout", "server error"] as const) {
  test(`languages and drafts remain available during a pending run and after ${outcome}`, async ({
    page,
  }) => {
    const goDraft = "package practice\n// Preserve my Go draft.\n";
    const pythonDraft = "# Preserve my Python draft.\n";
    await createAccount(page);
    const imported = await page.request.post("/api/import", {
      data: {
        progress: {},
        drafts: {
          "ride-dispatch": {
            go: [{ path: "implementation.go", content: goDraft }],
            python: [{ path: "implementation.py", content: pythonDraft }],
          },
        },
      },
    });
    expect(imported.ok()).toBe(true);
    await page.addInitScript(() => {
      localStorage.setItem("workbench.language", JSON.stringify("go"));
    });
    let release!: () => void;
    let started!: () => void;
    const blocked = new Promise<void>((resolve) => (release = resolve));
    const entered = new Promise<void>((resolve) => (started = resolve));
    const output = `Original Go run: ${outcome}`;
    const sessions = new Set<string>();
    page.on("response", async (response) => {
      if (
        response.url().endsWith("/api/workspace") &&
        response.request().method() === "POST" &&
        response.ok()
      ) {
        sessions.add((await response.json()).sessionId);
      }
    });
    await page.route("**/api/workspace/*/run", async (route) => {
      started();
      await blocked;
      await route.fulfill({
        status: outcome === "server error" ? 503 : 200,
        json:
          outcome === "server error"
            ? { error: output }
            : {
                passed: outcome === "pass",
                timedOut: outcome === "timeout",
                output,
                durationMs: 100,
                unlocked: outcome === "pass" ? 2 : 1,
              },
      });
    });
    try {
      await page.goto("/practice/ride-dispatch");
      const selector = page.getByLabel("Programming language");
      const run = page.locator(".run-button");
      await expect(run).toBeEnabled();
      await run.click();
      await entered;
      await expect(run).toBeDisabled();
      await expect(selector).toBeEnabled();
      await selector.selectOption("python");
      await expect(page.locator(".monaco-editor")).toContainText(
        "Preserve my Python draft",
      );
      await expect(run).toBeEnabled();
      release();
      await expect(page.locator(".raw-output")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Level 2", exact: true }),
      ).toBeDisabled();
      await selector.selectOption("go");
      await expect(page.locator(".monaco-editor")).toContainText(
        "Preserve my Go draft",
      );
      await expect(run).toBeEnabled();
      await run.click();
      await expect(page.getByText(output, { exact: true })).toBeVisible();
      await expect(selector).toBeEnabled();
      await selector.selectOption("typescript");
      await expect(page.locator(".file-list")).toContainText(
        "implementation.ts",
      );
      await expect(run).toBeEnabled();
    } finally {
      release();
      await Promise.all(
        [...sessions].map((id) => page.request.delete(`/api/workspace/${id}`)),
      );
    }
  });
}
