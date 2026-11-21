import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { problems } from "./problems.ts";
import { getFiles } from "./languages.ts";

test("Java contracts preserve typed tuple access, arrays, entry fields, and defensive-copy mutations", () => {
  const files = (id: string) =>
    getFiles(
      problems.find((p) => p.id === id)!,
      "java",
    );
  const history = files("transaction-history");
  assert.match(
    history.find((f) => f.path === "Implementation.java")!.content,
    /Pair<Entry> Get/,
  );
  assert.match(
    history.find((f) => f.path === "Level1Test.java")!.content,
    /s.Get\("a"\).ok\(\)/,
  );
  assert.match(
    history.find((f) => f.path === "Level2Test.java")!.content,
    /s.List\(""\)\[0\].ID/,
  );
  assert.match(
    files("multi-level-garage").find((f) => f.path === "Level1Test.java")!
      .content,
    /new String\[\]\{"L","SM"\}/,
  );
  assert.match(
    files("fifo-queue").find((f) => f.path === "HiddenLevel3Test.java")!
      .content,
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
      for (const problem of problems) {
        const dir = path.join(root, problem.id);
        await mkdir(dir);
        const files = getFiles(problem, "java");
        await Promise.all(
          files.map((f) => writeFile(path.join(dir, f.path), f.content)),
        );
        const compiled = spawnSync(
          "javac",
          ["--release", "21", ...files.map((f) => f.path)],
          { cwd: dir, encoding: "utf8" },
        );
        assert.equal(
          compiled.status,
          0,
          `${problem.id}: ${compiled.stdout}${compiled.stderr}`,
        );
        for (let level = 1; level <= 3; level++) {
          const result = spawnSync("java", [`Level${level}Test`], {
            cwd: dir,
            encoding: "utf8",
          });
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
        const sandbox = spawnSync("java", ["SandboxTest"], {
          cwd: dir,
          encoding: "utf8",
        });
        assert.equal(sandbox.status, 0, `${problem.id}: ${sandbox.stderr}`);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
