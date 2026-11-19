import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp, validateFiles } from "./index.ts";

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
  } finally {
    app.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
