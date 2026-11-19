import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runTests } from "../server/runner.ts";

const fixtures: Record<string, Record<string, string>> = {
  go: {
    "go.mod": "module practice\n\ngo 1.22\n",
    "sandbox_test.go":
      'package practice\nimport "testing"\nfunc TestAnythingYouWant(t *testing.T) { t.Log("PERSONAL_TEST_OUTPUT"); if 2+2 != 4 {t.Fatal("arithmetic")} }\n',
    "level_2_test.go":
      'package practice\nimport "testing"\nfunc TestFuture(t *testing.T) {t.Fatal("future test must not run")}\n',
  },
  python: {
    "sandbox_test.py":
      'import unittest\nclass PersonalTests(unittest.TestCase):\n    def test_anything(self):\n        print("PERSONAL_TEST_OUTPUT")\n        self.assertEqual(2+2, 4)\n',
    "test_level_2.py": 'raise RuntimeError("future test must not run")\n',
  },
  typescript: {
    "sandbox.test.ts":
      'import {test} from "node:test"; import assert from "node:assert/strict"; test("anything you want",()=>{console.log("PERSONAL_TEST_OUTPUT"); assert.equal(2+2,4)});\n',
    "level_2.test.ts": 'throw new Error("future test must not run");\n',
  },
};
for (const language of ["go", "python", "typescript"] as const) {
  const files = fixtures[language];
  const dir = await mkdtemp(path.join(tmpdir(), "lld-docker-check-"));
  try {
    await Promise.all(
      Object.entries(files).map(([name, content]) =>
        writeFile(path.join(dir, name), content),
      ),
    );
    const result = await runTests(dir, language, 1, {
      mode: "docker",
      timeoutMs: 45000,
    });
    console.log(
      `${language}: ${result.passed ? "PASS" : "FAIL"} (${result.durationMs}ms)`,
    );
    assert.equal(result.passed, true, result.output);
    assert.match(result.output, /PERSONAL_TEST_OUTPUT/);
    const sandbox = Object.keys(files).find((name) =>
      name.startsWith("sandbox"),
    );
    if (!sandbox) throw new Error("Missing sandbox fixture");
    const content = files[sandbox].replace("2+2", "2+3");
    await writeFile(path.join(dir, sandbox), content);
    const failure = await runTests(dir, language, 1, {
      mode: "docker",
      timeoutMs: 45000,
    });
    assert.equal(
      failure.passed,
      false,
      "A failed personal assertion must fail the run",
    );
    console.log(`${language}: failing personal assertion reported correctly`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
