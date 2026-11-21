import assert from "node:assert/strict";
import test from "node:test";
import { ESLint } from "eslint";

const eslint = new ESLint();

async function expectRuleError(
  filePath: string,
  code: string,
  expectedRule: string,
  expectedMessageSubstring: string,
) {
  const [result] = await eslint.lintText(code, { filePath });
  const match = result?.messages.find(
    (message) => message.ruleId === expectedRule && message.severity === 2,
  );
  assert(
    match,
    `Expected ${expectedRule} error for ${filePath}, got: ${JSON.stringify(result?.messages ?? [])}`,
  );
  assert(
    match.message.includes(expectedMessageSubstring),
    `Expected message to include ${JSON.stringify(expectedMessageSubstring)}, got: ${match.message}`,
  );
}

test("React architecture boundaries fail on cross-layer imports with root-cause guidance", async () => {
  await expectRuleError(
    "src/Editor.tsx",
    'import { createApp } from "../server/index";\nexport default function BadEditor() { return createApp ? null : null; }\n',
    "boundaries/dependencies",
    "React client code (ui-component) cannot import Node/Express server code",
  );
  await expectRuleError(
    "src/Editor.tsx",
    'import App from "./App";\nexport default function BadEditor() { return App ? null : null; }\n',
    "boundaries/dependencies",
    "Reusable React components cannot depend on page containers (app-page)",
  );
  await expectRuleError(
    "shared/problems.ts",
    'import { practiceUrl } from "../src/navigation";\nexport const link = practiceUrl;\n',
    "boundaries/dependencies",
    "Shared domain modules must stay runtime-agnostic",
  );
});

test("inline lint and TypeScript suppressions are banned with root-cause guidance", async () => {
  await expectRuleError(
    "src/navigation.ts",
    "// eslint-disable-next-line @typescript-eslint/no-explicit-any\nexport const value = 1;\n",
    "architecture/no-inline-suppression",
    "Inline lint/type suppressions are banned",
  );
  await expectRuleError(
    "src/navigation.ts",
    "// @ts-ignore\nexport const value = 1;\n",
    "architecture/no-inline-suppression",
    "Inline lint/type suppressions are banned",
  );
  await expectRuleError(
    "src/navigation.ts",
    "// @ts-expect-error\nexport const value = 1;\n",
    "architecture/no-inline-suppression",
    "Inline lint/type suppressions are banned",
  );
});
