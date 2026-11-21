import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { availableParallelism, tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { problems } from "./problems.ts";
import { getFiles, languageNotes } from "./languages.ts";

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

test("every problem provides editable code, sandbox, and three levels of visible and hidden tests", () => {
  for (const problem of problems) {
    assert.equal(getFiles(problem, "go"), problem.files);
    for (const language of ["python", "typescript", "java"]) {
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
  const cleanEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PYTHONDONTWRITEBYTECODE: "1",
  };
  delete cleanEnv.NODE_TEST_CONTEXT;
  const root = await mkdtemp(path.join(tmpdir(), "lld-languages-"));
  const pythonCheckScript = `import compileall, io, sys, unittest
if not compileall.compile_dir(".", quiet=1):
    sys.exit(2)
for n in (1, 2, 3):
    suite = unittest.defaultTestLoader.loadTestsFromName(f"test_level_{n}")
    buf = io.StringIO()
    res = unittest.TextTestRunner(stream=buf, verbosity=1).run(suite)
    out = buf.getvalue()
    if res.errors or len(res.failures) == 0 or "AssertionError" not in out:
        sys.stderr.write(f"level {n} unexpected result:\\n{out}")
        sys.exit(1)
`;
  try {
    let cursor = 0;
    const concurrency = Math.max(
      1,
      Math.min(4, Math.ceil(availableParallelism() / 2)),
    );
    const workers = Array.from(
      { length: Math.min(problems.length, concurrency) },
      async () => {
        while (cursor < problems.length) {
          const problem = problems[cursor++];
          const pyDir = path.join(root, `${problem.id}-python`);
          const tsDir = path.join(root, `${problem.id}-typescript`);
          await Promise.all([mkdir(pyDir), mkdir(tsDir)]);
          await Promise.all([
            ...getFiles(problem, "python").map((f) =>
              writeFile(path.join(pyDir, f.path), f.content),
            ),
            ...getFiles(problem, "typescript").map((f) =>
              writeFile(path.join(tsDir, f.path), f.content),
            ),
          ]);
          const [pyRun, tsRun] = await Promise.all([
            runCommand("python3", ["-c", pythonCheckScript], pyDir, cleanEnv),
            runCommand(
              process.execPath,
              [
                "--experimental-strip-types",
                "--test",
                "--test-isolation=none",
                "level_1.test.ts",
                "level_2.test.ts",
                "level_3.test.ts",
              ],
              tsDir,
              cleanEnv,
            ),
          ]);
          assert.equal(
            pyRun.status,
            0,
            `${problem.id} python: ${pyRun.stdout}${pyRun.stderr}`,
          );
          assert.equal(
            tsRun.status,
            1,
            `${problem.id} typescript sample levels must fail`,
          );
          assert.match(
            tsRun.stdout,
            /AssertionError/,
            `${problem.id}: ${tsRun.stdout}${tsRun.stderr}`,
          );
          assert.doesNotMatch(
            tsRun.stdout + tsRun.stderr,
            /SyntaxError|ReferenceError|TypeError|ERR_MODULE_NOT_FOUND/,
            `${problem.id}: ${tsRun.stdout}${tsRun.stderr}`,
          );
          for (let n = 1; n <= 3; n++) {
            assert.match(
              tsRun.stdout,
              new RegExp(`level_${n}\\.test\\.ts`),
              `${problem.id} level ${n} must fail:\n${tsRun.stdout}${tsRun.stderr}`,
            );
          }
        }
      },
    );
    await Promise.all(workers);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
