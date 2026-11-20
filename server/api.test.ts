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

test("hosted origins are explicit and workspace capacity includes simultaneous opens", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lld-hosted-test-"));
  const app = createApp({
    workspaceRoot: directory,
    enableLsp: false,
    maxWorkspaces: 1,
    allowedOrigins: ["https://practice.example.com"],
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as import("node:net").AddressInfo;
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const headers = {
      Host: "practice.example.com",
      Origin: "https://practice.example.com",
      "Content-Type": "application/json",
    };
    assert.equal((await fetch(`${base}/api/health`, { headers })).status, 200);
    assert.equal(
      (
        await fetch(`${base}/api/health`, {
          headers: { ...headers, Origin: "https://other.example.com" },
        })
      ).status,
      403,
    );
    const responses = await Promise.all(
      [1, 2].map(() =>
        fetch(`${base}/api/workspace`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            problemId: "bounded-stack",
            language: "python",
            files: [],
          }),
        }),
      ),
    );
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 503]);
    const workspace = await responses.find((r) => r.status === 200)!.json();
    await fetch(`${base}/api/workspace/${workspace.sessionId}`, {
      method: "DELETE",
      headers,
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    await assert.rejects(
      readFile(path.join(directory, workspace.sessionId, "implementation.py")),
      { code: "ENOENT" },
    );
  } finally {
    app.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});

test("API queues globally, locks queued workspaces and preserves queue errors", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lld-queue-api-"));
  let release!: () => void;
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const app = createApp({
    workspaceRoot: directory,
    enableLsp: false,
    queueOptions: { concurrency: 1, maxWaiting: 1, waitTimeoutMs: 500 },
    testTimeoutMs: 60000,
    executeTests: async (_directory, _language, _level, options) => {
      assert.equal(options?.timeoutMs, 60000);
      calls++;
      started();
      await blocked;
      return { passed: true, output: "ok", durationMs: 1, timedOut: false };
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as import("node:net").AddressInfo;
  const base = `http://127.0.0.1:${address.port}`;
  const post = (route: string, body: unknown) =>
    fetch(`${base}/api${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    const ids = [];
    for (let i = 0; i < 3; i++) {
      const response = await post("/workspace", {
        problemId: "bounded-stack",
        language: "python",
        files: [],
      });
      assert.equal(response.status, 200);
      ids.push((await response.json()).sessionId);
    }
    const run = (id: string) =>
      post(`/workspace/${id}/run`, { level: 1, files: [] });
    const first = run(ids[0]);
    await entered;
    const second = run(ids[1]);
    // Wait for the queue lock to be observable rather than assuming fetch ordering.
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal((await run(ids[1])).status, 409);
    assert.equal((await run(ids[2])).status, 503);
    assert.equal((await second).status, 504);
    assert.equal(calls, 1);
    release();
    assert.equal((await first).status, 200);
    assert.equal((await run(ids[1])).status, 200);
  } finally {
    release();
    app.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});

test("diagnostics polling does not prevent idle workspace expiry", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lld-idle-api-"));
  const app = createApp({
    workspaceRoot: directory,
    enableLsp: false,
    workspaceIdleMs: 100,
    cleanupIntervalMs: 10,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as import("node:net").AddressInfo;
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const response = await fetch(`${base}/api/workspace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        problemId: "bounded-stack",
        language: "python",
        files: [],
      }),
    });
    assert.equal(response.status, 200);
    const { sessionId } = await response.json();
    let status = 200;
    for (let i = 0; i < 20 && status === 200; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      status = (await fetch(`${base}/api/workspace/${sessionId}/diagnostics`))
        .status;
    }
    assert.equal(status, 404);
  } finally {
    app.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});

test("Java extra files use the Java extension", () => {
  assert.equal(
    validateNewFile("models/Driver.java", "java", []),
    "models/Driver.java",
  );
  assert.throws(() => validateNewFile("Driver.ts", "java", []), /\.java/);
});
