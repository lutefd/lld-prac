import { expect, test } from "@playwright/test";
import {
  createAccount,
  replaceCode,
  signInInUi,
  signUpInUi,
  uniqueUser,
} from "./auth";

const BOUNDED_STACK_LEVEL_1 = `package practice

// SERVER_PERSISTED_STACK
type Stack struct {
	capacity int
	items    []string
}

func NewStack(capacity int) *Stack {
	if capacity < 0 {
		capacity = 0
	}
	return &Stack{capacity: capacity}
}

func (s *Stack) Push(value string) bool {
	if len(s.items) >= s.capacity {
		return false
	}
	s.items = append(s.items, value)
	return true
}

func (s *Stack) Pop() (string, bool) {
	if len(s.items) == 0 {
		return "", false
	}
	top := s.items[len(s.items)-1]
	s.items = s.items[:len(s.items)-1]
	return top, true
}

func (s *Stack) Peek() (string, bool)          { return "", false }
func (s *Stack) Size() int                     { return 0 }
func (s *Stack) SetCapacity(capacity int) bool { return false }
`;

test("account persists unlocked levels and drafts across reloads, syncs across browser contexts, isolates users, and signs out", async ({
  browser,
}) => {
  const userA = uniqueUser("alice");
  const contextA1 = await browser.newContext();
  const pageA1 = await contextA1.newPage();

  try {
    await pageA1.goto("/practice/bounded-stack");
    await signUpInUi(pageA1, userA);
    await expect(
      pageA1.getByRole("heading", { name: "Bounded stack", exact: true }),
    ).toBeVisible();
    await expect(pageA1.locator(".monaco-editor")).toBeVisible();
    await expect(
      pageA1.getByRole("button", { name: "Level 2", exact: true }),
    ).toBeDisabled();

    await replaceCode(pageA1, BOUNDED_STACK_LEVEL_1);
    await pageA1.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(pageA1.locator(".raw-output")).toContainText("PASS", {
      timeout: 30000,
    });
    await expect(
      pageA1.getByRole("button", { name: "Level 2", exact: true }),
    ).toBeEnabled();

    await pageA1.reload();
    await expect(pageA1.locator(".monaco-editor")).toContainText(
      "SERVER_PERSISTED_STACK",
      { timeout: 20000 },
    );
    await expect(
      pageA1.getByRole("button", { name: "Level 2", exact: true }),
    ).toBeEnabled();

    const contextA2 = await browser.newContext();
    const pageA2 = await contextA2.newPage();
    try {
      await pageA2.goto("/practice/bounded-stack");
      await signInInUi(pageA2, userA);
      await expect(pageA2.locator(".monaco-editor")).toContainText(
        "SERVER_PERSISTED_STACK",
        { timeout: 20000 },
      );
      await expect(
        pageA2.getByRole("button", { name: "Level 2", exact: true }),
      ).toBeEnabled();
    } finally {
      await contextA2.close();
    }

    const userB = uniqueUser("bob");
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    try {
      await pageB.goto("/practice/bounded-stack");
      await signUpInUi(pageB, userB);
      await expect(pageB.locator(".monaco-editor")).toBeVisible();
      await expect(pageB.locator(".monaco-editor")).not.toContainText(
        "SERVER_PERSISTED_STACK",
      );
      await expect(
        pageB.getByRole("button", { name: "Level 2", exact: true }),
      ).toBeDisabled();
    } finally {
      await contextB.close();
    }

    await pageA1.getByRole("button", { name: "Settings", exact: true }).click();
    const dialog = pageA1.getByRole("dialog", { name: "Settings", exact: true });
    await expect(dialog).not.toContainText("Sign out");
    await expect(dialog).not.toContainText("API keys");
    await expect(dialog).not.toContainText(userA.email);
    await dialog
      .getByRole("button", { name: "Close settings", exact: true })
      .click();

    await pageA1.getByRole("link", { name: "Account", exact: true }).click();
    await expect(pageA1).toHaveURL(/\/account$/);
    await expect(
      pageA1.getByRole("heading", { name: "Account", exact: true }),
    ).toBeVisible();
    await expect(
      pageA1.getByRole("link", { name: "Back to practice", exact: true }),
    ).toHaveAttribute("href", "/practice/bounded-stack");
    await expect(pageA1.locator(".account-summary")).toContainText(userA.name);
    await expect(pageA1.locator(".account-summary")).toContainText(userA.email);
    await pageA1.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      pageA1.getByRole("heading", {
        name: "Sign in to workbench.",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await contextA1.close();
  }
});

test("API keys read the progress report and stop working once deleted", async ({
  page,
}) => {
  await createAccount(page, uniqueUser("apikey"));
  await page.goto("/practice/bounded-stack");
  await expect(page.locator(".monaco-editor")).toBeVisible();
  await replaceCode(page, BOUNDED_STACK_LEVEL_1);
  await page.getByRole("button", { name: "Run tests", exact: false }).click();
  await expect(page.locator(".raw-output")).toContainText("PASS", {
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText("Submission passed")).toBeVisible({
    timeout: 30000,
  });

  await page.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(
    page.getByRole("heading", { name: "Progress report API", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".report-example-code")).toContainText(
    "/api/v1/report",
  );

  await page.getByLabel("Key name", { exact: true }).fill("CI reporter");
  await page.getByRole("button", { name: "Create key", exact: true }).click();

  const keyCode = page.locator(".api-key-secret");
  await expect(keyCode).toBeVisible();
  const key = (await keyCode.innerText()).trim();
  expect(key.length).toBeGreaterThan(10);
  await expect(page.locator(".api-key-curl")).toContainText(
    `curl -H "x-api-key: ${key}"`,
  );
  await expect(page.locator(".api-key-curl")).toContainText("/api/v1/report");

  const reportResponse = await page.request.get("/api/v1/report", {
    headers: { "x-api-key": key },
  });
  expect(reportResponse.status()).toBe(200);
  const report = await reportResponse.json();
  expect(report.summary.attempts).toBe(1);
  expect(report.summary.passedAttempts).toBe(1);
  expect(report.attempts).toEqual([
    expect.objectContaining({
      problemId: "bounded-stack",
      language: "go",
      level: 1,
      passed: true,
    }),
  ]);
  const filteredResponse = await page.request.get("/api/v1/report", {
    headers: { "x-api-key": key },
    params: { since: report.attempts[0].createdAt },
  });
  expect(filteredResponse.status()).toBe(200);
  const filtered = await filteredResponse.json();
  expect(filtered.attempts).toEqual([]);
  expect(filtered.summary).toEqual(report.summary);

  await expect(page.locator(".api-key-list")).toContainText("CI reporter");
  await page
    .getByRole("button", { name: "Delete API key CI reporter", exact: true })
    .click();
  await expect(page.locator(".api-key-list")).toHaveCount(0);

  const revokedResponse = await page.request.get("/api/v1/report", {
    headers: { "x-api-key": key },
  });
  expect(revokedResponse.status()).toBe(401);
});

test("account page supports direct deep link, reload, roadmap entry, and flushes workspace drafts before leaving", async ({
  page,
}) => {
  const user = uniqueUser("direct");
  await createAccount(page, user);

  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Account", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".account-summary")).toContainText(user.name);
  await expect(page.locator(".account-summary")).toContainText(user.email);
  await expect(
    page.getByRole("link", { name: "Back to roadmap", exact: true }),
  ).toHaveAttribute("href", "/");

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Account", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".account-summary")).toContainText(user.email);

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(dialog).not.toContainText("Sign out");
  await expect(dialog).not.toContainText("API keys");
  await dialog
    .getByRole("button", { name: "Close settings", exact: true })
    .click();

  await page.getByRole("link", { name: "Back to roadmap", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Small steps. Stronger designs." }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(
    page.getByRole("link", { name: "Back to roadmap", exact: true }),
  ).toBeVisible();

  await page.goto("/practice/bounded-stack");
  await expect(page.locator(".monaco-editor")).toBeVisible();
  await replaceCode(
    page,
    "package practice\n// FLUSHED_BEFORE_ACCOUNT_NAV\n",
  );
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page
    .getByRole("link", { name: "Back to practice", exact: true })
    .click();
  await expect(page).toHaveURL(/\/practice\/bounded-stack$/);
  await expect(page.locator(".monaco-editor")).toContainText(
    "FLUSHED_BEFORE_ACCOUNT_NAV",
    { timeout: 20000 },
  );
});

test("legacy browser progress and drafts import once on first sign-in and clear localStorage", async ({
  page,
}) => {
  const user = uniqueUser("legacy");
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sign in to workbench.", exact: true }),
  ).toBeVisible();

  await page.evaluate(() => {
    localStorage.setItem("workbench.progress.bounded-stack.go", "3");
    localStorage.setItem(
      "workbench.draft.bounded-stack.go",
      JSON.stringify([
        {
          path: "implementation.go",
          content: "package practice\n// LEGACY_IMPORTED_DRAFT\n",
          readOnly: false,
        },
      ]),
    );
  });

  await signUpInUi(page, user);
  await expect(
    page.getByRole("heading", { name: "Small steps. Stronger designs." }),
  ).toBeVisible();
  await expect(page.locator(".roadmap-exercises li").first()).toContainText(
    "2/3 levels",
  );

  const remainingLegacyKeys = await page.evaluate(() => ({
    progress: localStorage.getItem("workbench.progress.bounded-stack.go"),
    draft: localStorage.getItem("workbench.draft.bounded-stack.go"),
  }));
  expect(remainingLegacyKeys).toEqual({ progress: null, draft: null });

  await page.goto("/practice/bounded-stack");
  await expect(page.locator(".monaco-editor")).toContainText(
    "LEGACY_IMPORTED_DRAFT",
    { timeout: 20000 },
  );
  await expect(
    page.getByRole("button", { name: "Level 3", exact: true }),
  ).toBeEnabled();
});
