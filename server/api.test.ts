import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { createApp, validateFiles, validateNewFile } from "./index.ts";

test("new source paths reject traversal, reserved names, collisions and wrong language", () => {
  const originals = [
    { path: "implementation.go", content: "", readOnly: false },
    { path: "Helpers/item.go", content: "", readOnly: false },
  ];
  for (const filename of [
    "../outside.go",
    "/outside.go",
    "a/./b.go",
    "a/../b.go",
    "a//b.go",
    "a\\b.go",
    ".hidden/file.go",
    "a/hidden_fixture.go",
    "IMPLEMENTATION.go",
    "helpers/other.go",
    "wrong.py",
    "implementation.go/child.go",
  ]) {
    assert.throws(() => validateNewFile(filename, "go", originals), filename);
  }
  assert.equal(
    validateNewFile("models/driver.go", "go", originals),
    "models/driver.go",
  );
  assert.equal(
    validateNewFile("models/driver.py", "python", []),
    "models/driver.py",
  );
  assert.equal(
    validateNewFile("models/driver.ts", "typescript", []),
    "models/driver.ts",
  );
});

test("writes reject traversal, locked fixtures and oversized content", () => {
  const files = [
    { path: "implementation.go", content: "", readOnly: false },
    { path: "hidden_level_1_test.go", content: "", readOnly: true },
  ];
  assert.throws(
    () => validateFiles([{ path: "../outside", content: "" }], files),
    /unknown or read-only/,
  );
  assert.throws(
    () =>
      validateFiles([{ path: "hidden_level_1_test.go", content: "" }], files),
    /unknown or read-only/,
  );
  assert.throws(
    () =>
      validateFiles(
        [{ path: "implementation.go", content: "x".repeat(1000001) }],
        files,
      ),
    /Invalid file contents/,
  );
});

test("API rejects external origins and hides test sources from problem metadata and editor files", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lld-api-test-"));
  const app = createApp({ workspaceRoot: directory, enableLsp: false });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No server address");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal(
      (
        await fetch(`${base}/api/health`, {
          headers: { Origin: "https://example.com" },
        })
      ).status,
      403,
    );
    const metadata = await (await fetch(`${base}/api/problems`)).json();
    assert.ok(metadata.problems.length >= 10);
    assert.ok(
      metadata.problems.every(
        (problem: Record<string, unknown>) => !("files" in problem),
      ),
    );
    const workspace = await (
      await fetch(`${base}/api/workspace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: metadata.problems[0].id }),
      })
    ).json();
    assert.ok(workspace.sessionId);
    assert.ok(
      workspace.files.every(
        (file: { hidden?: boolean; path: string }) =>
          !file.hidden && !file.path.startsWith("hidden_"),
      ),
    );
    const locked = await fetch(
      `${base}/api/workspace/${workspace.sessionId}/files`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [{ path: "go.mod", content: "changed" }],
        }),
      },
    );
    assert.equal(locked.status, 400);
    const outside = await fetch(
      `${base}/api/workspace/${workspace.sessionId}/files`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [{ path: "../outside", content: "changed" }],
        }),
      },
    );
    assert.equal(outside.status, 400);
    const post = async (route: string, body: unknown) =>
      fetch(`${base}${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    const createdResponse = await post(
      `/api/workspace/${workspace.sessionId}/create-file`,
      { path: "models/driver.go", content: "package models\n// initial\n" },
    );
    assert.equal(createdResponse.status, 201);
    const { file } = await createdResponse.json();
    assert.equal(file.userCreated, true);
    assert.equal(file.readOnly, false);
    assert.equal(
      (
        await post(`/api/workspace/${workspace.sessionId}/create-file`, {
          path: "MODELS/driver.go",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await post(`/api/workspace/${workspace.sessionId}/create-file`, {
          path: "hidden_custom.go",
        })
      ).status,
      400,
    );
    const updated = { ...file, content: "package models\n// saved edit\n" };
    assert.equal(
      (
        await post(`/api/workspace/${workspace.sessionId}/files`, {
          files: [updated],
        })
      ).status,
      200,
    );
    assert.match(
      await readFile(
        path.join(fileURLToPath(workspace.rootUri), file.path),
        "utf8",
      ),
      /saved edit/,
    );
    const restoredResponse = await post("/api/workspace", {
      problemId: metadata.problems[0].id,
      files: [updated],
    });
    assert.equal(restoredResponse.status, 200);
    const restored = await restoredResponse.json();
    assert.deepEqual(
      restored.files.find((item: { path: string }) => item.path === file.path),
      updated,
    );
    assert.equal(
      await readFile(
        path.join(fileURLToPath(restored.rootUri), file.path),
        "utf8",
      ),
      updated.content,
    );
    assert.equal(
      (
        await post("/api/workspace", {
          problemId: metadata.problems[0].id,
          files: [{ path: "new.go", content: "package practice" }],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await post("/api/workspace", {
          problemId: metadata.problems[0].id,
          files: [{ path: "../escape.go", content: "", userCreated: true }],
        })
      ).status,
      400,
    );
  } finally {
    app.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
