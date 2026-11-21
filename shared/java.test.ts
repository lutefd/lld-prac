import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { availableParallelism, tmpdir } from "node:os";
import path from "node:path";
import { problems } from "./problems.ts";
import { getFiles } from "./languages.ts";

function runCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
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

test("Java contracts preserve typed tuple access, arrays, entry fields, and defensive-copy mutations", () => {
  const files = (id: string) => {
    const problem = problems.find((p) => p.id === id);
    assert(problem, `Expected problem ${id}`);
    return getFiles(problem, "java");
  };
  const fileContent = (
    list: ReturnType<typeof getFiles>,
    filePath: string,
  ) => {
    const found = list.find((f) => f.path === filePath);
    assert(found, `Expected file ${filePath}`);
    return found.content;
  };
  const history = files("transaction-history");
  assert.match(
    fileContent(history, "Implementation.java"),
    /Pair<Entry> Get/,
  );
  assert.match(
    fileContent(history, "Level1Test.java"),
    /s.Get\("a"\).ok\(\)/,
  );
  assert.match(
    fileContent(history, "Level2Test.java"),
    /s.List\(""\)\[0\].ID/,
  );
  assert.match(
    fileContent(files("multi-level-garage"), "Level1Test.java"),
    /new String\[\]\{"L","SM"\}/,
  );
  assert.match(
    fileContent(files("fifo-queue"), "HiddenLevel3Test.java"),
    /snapshot\[0\] = "changed"/,
  );
});

const javac = spawnSync("javac", ["-version"], { encoding: "utf8" });
test(
  "all Java starters and visible/hidden checks compile; sample tests fail assertions",
  {
    skip:
      javac.status !== 0
        ? "Install a JDK to run Java catalog compilation checks"
        : false,
  },
  async () => {
    const root = await mkdtemp(path.join(tmpdir(), "lld-java-catalog-"));
    try {
      let cursor = 0;
      const workers = Array.from(
        {
          length: Math.min(problems.length, Math.max(2, availableParallelism())),
        },
        async () => {
          while (cursor < problems.length) {
            const problem = problems[cursor++];
            const dir = path.join(root, problem.id);
            await mkdir(dir);
            const files = getFiles(problem, "java");
            await Promise.all(
              files.map((f) => writeFile(path.join(dir, f.path), f.content)),
            );
            const compiled = await runCommand(
              "javac",
              ["--release", "21", "-proc:none", ...files.map((f) => f.path)],
              dir,
            );
            assert.equal(
              compiled.status,
              0,
              `${problem.id}: ${compiled.stdout}${compiled.stderr}`,
            );
            for (let level = 1; level <= 3; level++) {
              const result = await runCommand(
                "java",
                ["-XX:TieredStopAtLevel=1", `Level${level}Test`],
                dir,
              );
              assert.equal(
                result.status,
                1,
                `${problem.id} level ${level} must fail`,
              );
              assert.match(
                result.stderr,
                /AssertionError/,
                `${problem.id}: ${result.stderr}`,
              );
              assert.doesNotMatch(
                result.stderr,
                /Exception in thread.*(?:NullPointer|ArrayIndexOutOfBounds|ClassNotFound)/,
              );
            }
            const sandbox = await runCommand(
              "java",
              ["-XX:TieredStopAtLevel=1", "SandboxTest"],
              dir,
            );
            assert.equal(sandbox.status, 0, `${problem.id}: ${sandbox.stderr}`);
          }
        },
      );
      await Promise.all(workers);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
