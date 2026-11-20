import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { problems } from "./problems.ts";

test("catalog has unique original problems and three progressive levels", () => {
  assert.equal(problems.length, 35);
  assert.equal(new Set(problems.map((p) => p.id)).size, 35);
  for (const p of problems) {
    assert.equal(p.levels.length, 3, p.id);
    assert.ok(
      p.levels.every(
        (l) => l.requirements.length >= 2 && l.examples.length > 0,
      ),
      p.id,
    );
    assert.ok(
      p.files.some((f) => f.hidden && f.readOnly),
      p.id,
    );
    assert.ok(
      p.files.some((f) => f.path === "sandbox_test.go" && !f.readOnly),
      p.id,
    );
    assert.equal(new Set(p.files.map((f) => f.path)).size, p.files.length);
  }
});

test("new themes each cover easy, medium, and hard practice", () => {
  for (const category of ["Commerce", "Collaboration", "Infrastructure"]) {
    assert.deepEqual(
      problems
        .filter((p) => p.category === category)
        .map((p) => p.difficulty)
        .sort(),
      ["Easy", "Hard", "Medium"],
      category,
    );
  }
});

test("every Go starter and its visible/hidden tests compile; starter fails real assertions", async () => {
  const go = spawnSync("go", ["version"], { encoding: "utf8" });
  assert.equal(go.status, 0, "Go is required for catalog verification");
  const root = await mkdtemp(path.join(tmpdir(), "lld-catalog-"));
  try {
    for (const p of problems) {
      const dir = path.join(root, p.id);
      const { mkdir } = await import("node:fs/promises");
      await mkdir(dir);
      await Promise.all(
        p.files.map((f) => writeFile(path.join(dir, f.path), f.content)),
      );
      const compile = spawnSync("go", ["test", "-run", "^$", "."], {
        cwd: dir,
        encoding: "utf8",
        timeout: 30000,
      });
      assert.equal(
        compile.status,
        0,
        `${p.id} compile:\n${compile.stdout}${compile.stderr}`,
      );
      for (let level = 1; level <= 3; level++) {
        const run = spawnSync(
          "go",
          ["test", "-count=1", "-run", `^TestLevel${level}_`, "."],
          { cwd: dir, encoding: "utf8", timeout: 30000 },
        );
        assert.equal(
          run.status,
          1,
          `${p.id} starter must fail level ${level} assertions`,
        );
        assert.match(
          run.stdout,
          new RegExp(`--- FAIL: TestLevel${level}_`),
          `${p.id} must fail assertions, not compilation`,
        );
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
