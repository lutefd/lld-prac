import { expect, type Page } from "@playwright/test";

export type TestUser = {
  name: string;
  email: string;
  password: string;
};

export function uniqueUser(prefix = "user"): TestUser {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    name: `Test ${prefix}`,
    email: `${prefix}-${token}@example.com`,
    password: "password-1234",
  };
}

export async function createAccount(
  page: Page,
  user: TestUser = uniqueUser(),
): Promise<TestUser> {
  const response = await page.request.post("/api/auth/sign-up/email", {
    data: {
      name: user.name,
      email: user.email,
      password: user.password,
    },
  });
  expect(
    response.ok(),
    `Expected sign-up to succeed, got ${response.status()}: ${await response.text()}`,
  ).toBe(true);
  return user;
}

export async function signUpInUi(page: Page, user: TestUser = uniqueUser()) {
  await expect(
    page.getByRole("heading", { name: "Sign in to workbench.", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Create your account", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill(user.name);
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Create your account", exact: true }),
  ).not.toBeVisible();
  return user;
}

export async function signInInUi(
  page: Page,
  credentials: Pick<TestUser, "email" | "password">,
) {
  await expect(
    page.getByRole("heading", { name: "Sign in to workbench.", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to workbench.", exact: true }),
  ).not.toBeVisible();
}

export async function replaceCode(page: Page, content: string) {
  await page.locator(".monaco-editor").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(content);
}
