export type Command = {
  kind: "assign" | "eq" | "run";
  name?: string;
  expression: string;
  expected?: unknown;
};

// Keep each new case's contracts and test scenarios together.
export function caseFiles(
  starter: string,
  visible: string[],
  hidden: string[],
) {
  return [
    {
      path: "implementation.go",
      content: `package practice\n\n${starter}\n`,
      readOnly: false,
    },
    { path: "go.mod", content: "module practice\n\ngo 1.22\n", readOnly: true },
    ...[visible, hidden].flatMap((levels, group) =>
      levels.map((body, i) => ({
        path: `${group ? "hidden_" : ""}level_${i + 1}_test.go`,
        content: `package practice\n\nimport "testing"\n\nfunc TestLevel${i + 1}_${group ? "Hidden" : "Sample"}(t *testing.T) {\n${body}\n}\n`,
        readOnly: true,
        ...(group ? { hidden: true } : {}),
      })),
    ),
    {
      path: "sandbox_test.go",
      content:
        'package practice\n\nimport "testing"\n\n// Add your own edge-case assertions here.\nfunc TestUser_Smoke(t *testing.T) { t.Log("Add your own tests here.") }\n',
      readOnly: false,
    },
  ];
}
