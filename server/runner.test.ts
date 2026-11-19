import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runProcess, runTests } from "./runner.ts";

test("test runner excludes future levels, includes hidden and arbitrary user tests, and isolates workspace mutations", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lld-run-test-"));
  try {
    await Promise.all(
      Object.entries({
        "go.mod": "module example.com/runner\n\ngo 1.23\n",
        "implementation.go":
          "package practice\nfunc Add(a,b int) int { return a+b }\n",
        "level_1_test.go":
          'package practice\nimport "testing"\nfunc TestLevel1_Add(t *testing.T) { if Add(2,3)!=5 {t.Fatal("sum")} }\n',
        "level_2_test.go":
          'package practice\nimport "testing"\nfunc TestLevel2_Future(t *testing.T) {t.Fatal("future test executed")}\n',
        "hidden_level_1_test.go":
          'package practice\nimport "testing"\nfunc TestHiddenNegative(t *testing.T) {if Add(-2,-1)!=-3 {t.Fatal("hidden test")}}\n',
        "sandbox_test.go":
          'package practice\nimport("testing";"os")\nfunc TestMyOwnName(t *testing.T) {t.Log("arbitrary user test ran");os.WriteFile("marker",[]byte("snapshot"),0600)}\n',
      }).map(([name, content]) =>
        writeFile(path.join(directory, name), content),
      ),
    );
    const result = await runTests(directory, "go", 1, {
      mode: "native",
      timeoutMs: 30000,
    });
    assert.equal(result.passed, true, result.output);
    assert.match(result.output, /TestMyOwnName/);
    assert.match(result.output, /TestHiddenNegative/);
    assert.doesNotMatch(result.output, /TestLevel2_Future/);
    const { access } = await import("node:fs/promises");
    await assert.rejects(access(path.join(directory, "marker")));
    const future = await runTests(directory, "go", 2, {
      mode: "native",
      timeoutMs: 30000,
    });
    assert.equal(future.passed, false);
    assert.match(future.output, /future test executed/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("process timeout stops a runaway process and preserves console output", async () => {
  const result = await runProcess(
    process.execPath,
    ["-e", 'console.log("before loop");while(true){}'],
    os.tmpdir(),
    { timeoutMs: 300 },
  );
  assert.equal(result.passed, false);
  assert.equal(result.timedOut, true);
  assert.match(result.output, /before loop/);
  assert.match(result.output, /execution time limit/);
});

test("invalid levels fail before execution", async () => {
  await assert.rejects(runTests(os.tmpdir(), "go", 0), /Invalid test level/);
  await assert.rejects(runTests(os.tmpdir(), "go", 2.5), /Invalid test level/);
});

for (const language of ["python", "typescript"] as const) {
  test(`${language} runner executes visible, hidden and editable tests and excludes future levels`, async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "lld-portable-test-"),
    );
    const files =
      language === "python"
        ? {
            "test_level_1.py":
              "import unittest\nclass Level(unittest.TestCase):\n def test_visible(self): self.assertEqual(2+2,4)\n",
            "hidden_test_level_1.py":
              "import unittest\nclass Hidden(unittest.TestCase):\n def test_regression(self): self.assertTrue(True)\n",
            "test_level_2.py":
              'import unittest\nclass Future(unittest.TestCase):\n def test_future(self): self.fail("future")\n',
            "sandbox_test.py":
              'import unittest\nclass User(unittest.TestCase):\n def test_custom_name(self): print("user console output");self.assertTrue(True)\n',
          }
        : {
            "level_1.test.ts":
              'import {test} from "node:test";import assert from "node:assert/strict";test("visible",()=>assert.equal(2+2,4));',
            "hidden_level_1.test.ts":
              'import {test} from "node:test";test("hidden regression",()=>{});',
            "level_2.test.ts":
              'import {test} from "node:test";test("future",()=>{throw Error("future")});',
            "sandbox.test.ts":
              'import {test} from "node:test";test("custom user name",()=>{console.log("user console output")});',
          };
    try {
      await Promise.all(
        Object.entries(files).map(([name, content]) =>
          writeFile(path.join(directory, name), content!),
        ),
      );
      const result = await runTests(directory, language, 1, { mode: "native" });
      assert.equal(result.passed, true, result.output);
      assert.match(result.output, /regression/);
      assert.match(result.output, /user console output/);
      assert.doesNotMatch(result.output, /future/);
      const future = await runTests(directory, language, 2, { mode: "native" });
      assert.equal(future.passed, false);
      assert.match(future.output, /future/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
