import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { problems } from "./problems.ts";
import { getFiles, languageNotes } from "./languages.ts";

test("every problem provides editable code, sandbox, and three levels of visible and hidden tests", () => {
  for (const problem of problems) {
    assert.equal(getFiles(problem, "go"), problem.files);
    for (const language of ["python", "typescript"]) {
      const files = getFiles(problem, language);
      assert.equal(files.filter((f) => f.hidden).length, 3, problem.id);
      assert.equal(files.filter((f) => !f.readOnly).length, 2, problem.id);
      assert.equal(new Set(files.map((f) => f.path)).size, files.length);
      assert.match(languageNotes(problem, language), /PascalCase/);
    }
  }
  assert.throws(() => getFiles(problems[0], "ruby"), /Unsupported/);
});

test("all Python and TypeScript starters import; each sample level fails assertions, not runtime setup", async () => {
  const cleanEnv = { ...process.env };
  delete cleanEnv.NODE_TEST_CONTEXT;
  const root = await mkdtemp(path.join(tmpdir(), "lld-languages-"));
  try {
    for (const problem of problems) {
      for (const language of ["python", "typescript"]) {
        const dir = path.join(root, `${problem.id}-${language}`);
        await mkdir(dir);
        const files = getFiles(problem, language);
        await Promise.all(
          files.map((f) => writeFile(path.join(dir, f.path), f.content)),
        );
        if (language === "python") {
          const compile = spawnSync(
            "python3",
            ["-m", "compileall", "-q", "."],
            { cwd: dir, encoding: "utf8" },
          );
          assert.equal(
            compile.status,
            0,
            `${problem.id}: ${compile.stdout}${compile.stderr}`,
          );
          for (let n = 1; n <= 3; n++) {
            const sample = spawnSync(
              "python3",
              ["-m", "unittest", `test_level_${n}.py`],
              { cwd: dir, encoding: "utf8" },
            );
            assert.equal(
              sample.status,
              1,
              `${problem.id} level ${n} must fail`,
            );
            assert.match(sample.stderr, /AssertionError/, sample.stderr);
            assert.doesNotMatch(
              sample.stderr,
              /ERROR:|ImportError|SyntaxError|NameError|TypeError|AttributeError/,
              sample.stderr,
            );
          }
        } else {
          for (let n = 1; n <= 3; n++) {
            const sample = spawnSync(
              process.execPath,
              ["--experimental-strip-types", "--test", `level_${n}.test.ts`],
              { cwd: dir, encoding: "utf8", env: cleanEnv },
            );
            assert.equal(
              sample.status,
              1,
              `${problem.id} level ${n} must fail`,
            );
            assert.match(
              sample.stdout,
              /AssertionError/,
              `${sample.stdout}${sample.stderr}`,
            );
            assert.doesNotMatch(
              sample.stdout + sample.stderr,
              /SyntaxError|ReferenceError|TypeError|ERR_MODULE_NOT_FOUND/,
              `${sample.stdout}${sample.stderr}`,
            );
          }
        }
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
