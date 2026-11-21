import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { availableParallelism, tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { problems } from "./problems.ts";

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
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 30000);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
}

test("catalog has unique original problems and three progressive levels", () => {
  assert.equal(problems.length, 44);
  assert.equal(new Set(problems.map((p) => p.id)).size, 44);
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
  for (const category of [
    "Commerce",
    "Collaboration",
    "Infrastructure",
    "Games",
  ]) {
    const difficulties = new Set(
      problems.filter((p) => p.category === category).map((p) => p.difficulty),
    );
    assert.ok(difficulties.has("Easy"), category);
    assert.ok(difficulties.has("Medium"), category);
    if (category !== "Games") assert.ok(difficulties.has("Hard"), category);
  }
});

test("every Go starter and its visible/hidden tests compile; starter fails real assertions", async () => {
  const go = spawnSync("go", ["version"], { encoding: "utf8" });
  assert.equal(go.status, 0, "Go is required for catalog verification");
  const root = await mkdtemp(path.join(tmpdir(), "lld-catalog-"));
  const goEnv: NodeJS.ProcessEnv = {
    ...process.env,
    CGO_ENABLED: "0",
    GOMAXPROCS: "1",
    GOWORK: "off",
    GOPROXY: "off",
    GOTOOLCHAIN: "local",
    GOFLAGS: "",
    GOENV: "off",
  };
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
          const p = problems[cursor++];
          const dir = path.join(root, p.id);
          await mkdir(dir);
          await Promise.all(
            p.files.map((f) => writeFile(path.join(dir, f.path), f.content)),
          );
          // Single go test invocation compiles every starter, visible, hidden,
          // and sandbox file in the package and runs all three sample levels.
          const run = await runCommand(
            "go",
            ["test", "-count=1", "-run", "^TestLevel[123]_", "."],
            dir,
            goEnv,
          );
          assert.equal(
            run.status,
            1,
            `${p.id} starter must compile and fail level assertions:\n${run.stdout}${run.stderr}`,
          );
          assert.doesNotMatch(
            run.stdout + run.stderr,
            /\[build failed\]/,
            `${p.id} compile:\n${run.stdout}${run.stderr}`,
          );
          for (let level = 1; level <= 3; level++) {
            assert.match(
              run.stdout,
              new RegExp(`--- FAIL: TestLevel${level}_`),
              `${p.id} must fail level ${level} assertions, not compilation:\n${run.stdout}${run.stderr}`,
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
