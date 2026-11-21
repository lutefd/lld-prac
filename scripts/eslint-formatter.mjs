import path from "node:path";

const ROOT_CAUSE_FIXES = {
  "@typescript-eslint/no-explicit-any":
    "Replace `any` with a concrete type, generic parameter, or `unknown` narrowed by a type guard.",
  "@typescript-eslint/no-unused-vars":
    "Remove the unused binding, or wire it into the intended logic (prefix intentionally ignored parameters with `_`).",
  "@typescript-eslint/no-non-null-assertion":
    "Check for null/undefined explicitly (e.g., throw a descriptive error or guard before use) instead of asserting with `!`.",
  "@typescript-eslint/ban-ts-comment":
    "Remove the `@ts-*` directive and fix the underlying type mismatch by updating the types or narrowing the value.",
  "@typescript-eslint/no-dynamic-delete":
    "Use a `Map` or rebuild the object immutably instead of deleting dynamic keys.",
  "@typescript-eslint/no-extraneous-class":
    "Replace the static-only class with standalone exported functions or a plain module.",
  "@typescript-eslint/consistent-type-imports":
    "Use `import type` for type-only imports so runtime module graphs stay minimal.",
  "react-hooks/rules-of-hooks":
    "Call hooks unconditionally at the top level of a React component or custom hook, never inside branches or loops.",
  "react-hooks/exhaustive-deps":
    "Include all reactive values referenced inside the hook in its dependency array, or stabilize callbacks/values with `useCallback`/`useMemo` or a ref.",
  "react-refresh/only-export-components":
    "Move non-component helpers or constants into a dedicated module (e.g. client-lib) so Fast Refresh can safely reload this component.",
  "no-empty":
    "Handle the error/branch explicitly (log, fallback, or rethrow) rather than leaving an empty block.",
  "no-useless-escape":
    "Remove the redundant backslash escape from the string or regex literal.",
  "prefer-const":
    "Declare bindings that are never reassigned with `const` to make immutability explicit.",
  "boundaries/no-unknown-files":
    "Place this file inside a recognized architectural layer in eslint.config.mjs (src/, shared/, server/, scripts/, or tests/) or register its layer explicitly.",
};

export default function format(results) {
  const lines = [];
  let errorCount = 0;
  let warningCount = 0;

  for (const result of results) {
    if (result.messages.length === 0) continue;
    const relPath = path.relative(process.cwd(), result.filePath);
    lines.push(relPath);

    for (const msg of result.messages) {
      const severity = msg.severity === 2 ? "error" : "warning";
      if (msg.severity === 2) errorCount += 1;
      else warningCount += 1;

      const loc = `${msg.line ?? 0}:${msg.column ?? 0}`;
      const ruleId = msg.ruleId ?? "eslint";
      lines.push(`  ${loc}  ${severity}  ${msg.message}  (${ruleId})`);

      const fix = ROOT_CAUSE_FIXES[ruleId];
      if (fix) {
        lines.push(`           Root-cause fix: ${fix}`);
      } else if (
        ruleId !== "boundaries/dependencies" &&
        ruleId !== "architecture/no-inline-suppression"
      ) {
        lines.push(
          `           Root-cause fix: Resolve the underlying issue reported by ${ruleId} directly in code rather than suppressing the rule.`,
        );
      }
    }
    lines.push("");
  }

  if (errorCount > 0 || warningCount > 0) {
    lines.push(
      `✖ ${errorCount + warningCount} problem(s) (${errorCount} error(s), ${warningCount} warning(s))`,
    );
  }

  return lines.join("\n");
}
