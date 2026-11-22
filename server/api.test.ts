import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import type { ProgressReport } from "../shared/account.ts";
import { problems } from "../shared/problems.ts";
import { createApp, validateFiles, validateNewFile } from "./index.ts";

const defaultOrigin = "http://127.0.0.1:5173";

async function startServer(
  options: Parameters<typeof createApp>[0] = {},
): Promise<{
  app: ReturnType<typeof createApp>;
  base: string;
  close: () => Promise<void>;
}> {
  const app = createApp({
    databasePath: ":memory:",
    enableLsp: false,
    ...options,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No server address");
  const base = `http://127.0.0.1:${address.port}`;
  return {
    app,
    base,
    close: async () => {
      app.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

let userCounter = 0;

async function signUp(
  base: string,
  options: {
    email?: string;
    password?: string;
    name?: string;
    origin?: string;
    host?: string;
  } = {},
) {
  const id = ++userCounter;
  const email = options.email ?? `user${id}@example.com`;
  const password = options.password ?? "password-12345";
  const name = options.name ?? `User ${id}`;
  const origin = options.origin ?? defaultOrigin;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Origin: origin,
    ...(options.host ? { Host: options.host } : {}),
  };
  const response = await fetch(`${base}/api/auth/sign-up/email`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password, name }),
  });
  assert.equal(
    response.status,
    200,
    `sign-up failed: ${response.status} ${await response.clone().text()}`,
  );
  const cookie = response.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  assert.ok(cookie, "Expected session cookie from sign-up");
  const data = (await response.json()) as {
    user: { id: string; email: string; name: string };
  };
  const authHeaders: Record<string, string> = {
    Cookie: cookie,
    Origin: origin,
    ...(options.host ? { Host: options.host } : {}),
  };
  return {
    cookie,
    user: data.user,
    headers: authHeaders,
    get: (route: string) => fetch(`${base}${route}`, { headers: authHeaders }),
    post: (route: string, body?: unknown) =>
      fetch(`${base}${route}`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      }),
    del: (route: string) =>
      fetch(`${base}${route}`, {
        method: "DELETE",
        headers: authHeaders,
      }),
  };
}

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

test("API rejects external origins, requires auth for practice routes, and persists drafts across workspace opens", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lld-api-test-"));
  const { base, close } = await startServer({ workspaceRoot: directory });
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
    // Unauthenticated practice endpoints return 401.
    const unauth = await fetch(`${base}/api/workspace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId: metadata.problems[0].id }),
    });
    assert.equal(unauth.status, 401);
    assert.deepEqual(await unauth.json(), { error: "Sign in required" });
    assert.equal((await fetch(`${base}/api/progress`)).status, 401);
    assert.equal(
      (
        await fetch(`${base}/api/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ progress: {}, drafts: {} }),
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(`${base}/api/practice/${metadata.problems[0].id}/go`, {
          method: "DELETE",
        })
      ).status,
      401,
    );

    const user = await signUp(base);
    const openResponse = await user.post("/api/workspace", {
      problemId: metadata.problems[0].id,
    });
    assert.equal(openResponse.status, 200);
    const workspace = await openResponse.json();
    assert.ok(workspace.sessionId);
    assert.equal(workspace.unlocked, 1);
    assert.ok(
      workspace.files.every(
        (file: { hidden?: boolean; path: string }) =>
          !file.hidden && !file.path.startsWith("hidden_"),
      ),
    );
    assert.equal(
      (
        await user.post(`/api/workspace/${workspace.sessionId}/files`, {
          files: [{ path: "go.mod", content: "changed" }],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await user.post(`/api/workspace/${workspace.sessionId}/files`, {
          files: [{ path: "../outside", content: "changed" }],
        })
      ).status,
      400,
    );

    const createdResponse = await user.post(
      `/api/workspace/${workspace.sessionId}/create-file`,
      { path: "models/driver.go", content: "package models\n// initial\n" },
    );
    assert.equal(createdResponse.status, 201);
    const { file } = await createdResponse.json();
    assert.equal(file.userCreated, true);
    assert.equal(file.readOnly, false);
    assert.equal(
      (
        await user.post(`/api/workspace/${workspace.sessionId}/create-file`, {
          path: "MODELS/driver.go",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await user.post(`/api/workspace/${workspace.sessionId}/create-file`, {
          path: "hidden_custom.go",
        })
      ).status,
      400,
    );
    const updated = { ...file, content: "package models\n// saved edit\n" };
    assert.equal(
      (
        await user.post(`/api/workspace/${workspace.sessionId}/files`, {
          files: [
            updated,
            {
              path: "implementation.go",
              content: "package practice\n// edit\n",
            },
          ],
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

    // Reopening the exercise restores saved edits and user-created files from the server draft.
    const restoredResponse = await user.post("/api/workspace", {
      problemId: metadata.problems[0].id,
      language: "go",
    });
    assert.equal(restoredResponse.status, 200);
    const restored = await restoredResponse.json();
    assert.deepEqual(
      restored.files.find((item: { path: string }) => item.path === file.path),
      updated,
    );
    assert.equal(
      restored.files.find(
        (item: { path: string }) => item.path === "implementation.go",
      )?.content,
      "package practice\n// edit\n",
    );
    assert.equal(
      await readFile(
        path.join(fileURLToPath(restored.rootUri), file.path),
        "utf8",
      ),
      updated.content,
    );

    // Deleting a user-created file removes it from disk and from the stored draft.
    assert.equal(
      (
        await user.post(`/api/workspace/${workspace.sessionId}/delete-file`, {
          path: "implementation.go",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await user.post(`/api/workspace/${workspace.sessionId}/delete-file`, {
          path: "go.mod",
        })
      ).status,
      400,
    );
    const deleteResponse = await user.post(
      `/api/workspace/${workspace.sessionId}/delete-file`,
      { path: file.path },
    );
    assert.equal(deleteResponse.status, 200);
    await assert.rejects(
      readFile(path.join(fileURLToPath(workspace.rootUri), file.path), "utf8"),
      { code: "ENOENT" },
    );
    const afterDelete = await (
      await user.post("/api/workspace", {
        problemId: metadata.problems[0].id,
        language: "go",
      })
    ).json();
    assert.equal(
      afterDelete.files.find(
        (item: { path: string }) => item.path === file.path,
      ),
      undefined,
    );
    assert.equal(
      (
        await user.post(`/api/workspace/${workspace.sessionId}/create-file`, {
          path: file.path,
          content: "package models\n// recreated\n",
        })
      ).status,
      201,
    );
  } finally {
    await close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("another user's workspace returns 404", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lld-owner-test-"));
  const { base, close } = await startServer({ workspaceRoot: directory });
  try {
    const alice = await signUp(base);
    const bob = await signUp(base);
    const { sessionId } = await (
      await alice.post("/api/workspace", {
        problemId: "bounded-stack",
        language: "python",
      })
    ).json();
    assert.equal(
      (
        await bob.post(`/api/workspace/${sessionId}/files`, {
          files: [{ path: "implementation.py", content: "# hijack" }],
        })
      ).status,
      404,
    );
    assert.equal(
      (await bob.get(`/api/workspace/${sessionId}/diagnostics`)).status,
      404,
    );
    assert.equal((await bob.del(`/api/workspace/${sessionId}`)).status, 404);
    // Alice still owns her workspace.
    assert.equal(
      (await alice.get(`/api/workspace/${sessionId}/diagnostics`)).status,
      200,
    );
  } finally {
    await close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("runs record attempts, unlock only on pass, survive reopen, and appear in progress", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lld-run-test-"));
  let nextResult = {
    passed: false,
    output: "fail",
    durationMs: 15,
    timedOut: false,
  };
  const { base, close } = await startServer({
    workspaceRoot: directory,
    executeTests: async () => nextResult,
  });
  try {
    const user = await signUp(base);
    const { sessionId } = await (
      await user.post("/api/workspace", {
        problemId: "bounded-stack",
        language: "python",
      })
    ).json();

    // Failing run does not unlock, and omits pair from /api/progress.
    const failRun = await (
      await user.post(`/api/workspace/${sessionId}/run`, {
        level: 1,
        files: [],
      })
    ).json();
    assert.equal(failRun.passed, false);
    assert.equal(failRun.unlocked, 1);
    assert.deepEqual(await (await user.get("/api/progress")).json(), {
      progress: {},
    });

    // Passing run raises unlocked, persists across reopen, and shows in /api/progress.
    nextResult = {
      passed: true,
      output: "ok",
      durationMs: 22,
      timedOut: false,
    };
    const passRun = await (
      await user.post(`/api/workspace/${sessionId}/run`, {
        level: 1,
        files: [],
      })
    ).json();
    assert.equal(passRun.passed, true);
    assert.equal(passRun.unlocked, 2);

    assert.deepEqual(await (await user.get("/api/progress")).json(), {
      progress: { "bounded-stack": { python: 2 } },
    });

    await user.del(`/api/workspace/${sessionId}`);
    const reopened = await (
      await user.post("/api/workspace", {
        problemId: "bounded-stack",
        language: "python",
      })
    ).json();
    assert.equal(reopened.unlocked, 2);

    // Report shows both the failed and passed attempts.
    const keyRes = await user.post("/api/auth/api-key/create", { name: "cli" });
    const { key } = (await keyRes.json()) as { key: string };
    const reportRes = await fetch(`${base}/api/v1/report`, {
      headers: { "x-api-key": key },
    });
    assert.equal(reportRes.status, 200);
    const data = (await reportRes.json()) as ProgressReport;
    assert.equal(data.summary.attempts, 2);
    assert.equal(data.summary.passedAttempts, 1);
    assert.equal(data.summary.levelsPassed, 1);
    assert.equal(data.attempts[0].passed, true);
    assert.equal(data.attempts[1].passed, false);
  } finally {
    await close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("stale draft paths are dropped silently instead of breaking workspace open", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lld-stale-test-"));
  const dbPath = path.join(directory, "workbench.db");
  const { base, close } = await startServer({
    workspaceRoot: directory,
    databasePath: dbPath,
  });
  try {
    const user = await signUp(base);
    // Inject a stored draft containing a stale removed path, a read-only path, and a valid edit.
    const db = new DatabaseSync(dbPath);
    try {
      db.prepare(
        `INSERT INTO practice_draft (user_id, problem_id, language, files, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(
        user.user.id,
        "bounded-stack",
        "go",
        JSON.stringify([
          { path: "removed_in_new_catalog.go", content: "// stale" },
          { path: "go.mod", content: "module hacked" },
          { path: "../escape.go", content: "// bad", userCreated: true },
          { path: "implementation.go", content: "package practice\n// kept\n" },
        ]),
        Date.now(),
      );
    } finally {
      db.close();
    }

    const res = await user.post("/api/workspace", {
      problemId: "bounded-stack",
      language: "go",
    });
    assert.equal(res.status, 200);
    const workspace = await res.json();
    assert.equal(
      workspace.files.find(
        (f: { path: string }) => f.path === "implementation.go",
      )?.content,
      "package practice\n// kept\n",
    );
    assert.equal(
      workspace.files.find(
        (f: { path: string }) => f.path === "removed_in_new_catalog.go",
      ),
      undefined,
    );
    assert.notEqual(
      workspace.files.find((f: { path: string }) => f.path === "go.mod")
        ?.content,
      "module hacked",
    );
  } finally {
    await close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("legacy import runs once, skips invalid entries, and reset clears attempts and draft", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lld-import-test-"));
  const { base, close } = await startServer({ workspaceRoot: directory });
  try {
    const user = await signUp(base);
    const problem = problems.find((p) => p.id === "bounded-stack");
    assert.ok(problem);

    const first = await user.post("/api/import", {
      progress: {
        "bounded-stack": { python: 99 },
        "nonexistent-problem": { go: 3 },
      },
      drafts: {
        "bounded-stack": {
          python: [
            { path: "implementation.py", content: "# imported draft\n" },
            { path: "helpers/util.py", content: "X = 1\n", userCreated: true },
            { path: "../escape.py", content: "bad", userCreated: true },
            { path: "unknown.py", content: "bad" },
          ],
        },
      },
    });
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { imported: true });

    // Clamped to problem.levels.length + 1.
    assert.deepEqual(await (await user.get("/api/progress")).json(), {
      progress: { "bounded-stack": { python: problem.levels.length + 1 } },
    });

    // Second import is refused.
    const second = await user.post("/api/import", {
      progress: { "fifo-queue": { go: 2 } },
      drafts: {},
    });
    assert.equal(second.status, 200);
    assert.deepEqual(await second.json(), { imported: false });

    // Valid draft files were restored, invalid entries were skipped.
    const workspace = await (
      await user.post("/api/workspace", {
        problemId: "bounded-stack",
        language: "python",
      })
    ).json();
    assert.equal(workspace.unlocked, problem.levels.length + 1);
    assert.equal(
      workspace.files.find(
        (f: { path: string }) => f.path === "implementation.py",
      )?.content,
      "# imported draft\n",
    );
    assert.equal(
      workspace.files.find(
        (f: { path: string }) => f.path === "helpers/util.py",
      )?.content,
      "X = 1\n",
    );

    // Reset clears both attempts and draft for that pair.
    const resetRes = await user.del("/api/practice/bounded-stack/python");
    assert.equal(resetRes.status, 200);
    assert.deepEqual(await resetRes.json(), { reset: true });
    assert.deepEqual(await (await user.get("/api/progress")).json(), {
      progress: {},
    });

    const fresh = await (
      await user.post("/api/workspace", {
        problemId: "bounded-stack",
        language: "python",
      })
    ).json();
    assert.equal(fresh.unlocked, 1);
    assert.notEqual(
      fresh.files.find((f: { path: string }) => f.path === "implementation.py")
        ?.content,
      "# imported draft\n",
    );
    assert.equal(
      fresh.files.find((f: { path: string }) => f.path === "helpers/util.py"),
      undefined,
    );
  } finally {
    await close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("report requires a valid API key, revokes on delete, and API keys cannot open workspaces", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lld-report-test-"));
  const { base, close } = await startServer({
    workspaceRoot: directory,
    executeTests: async () => ({
      passed: true,
      output: "ok",
      durationMs: 12,
      timedOut: false,
    }),
  });
  try {
    // Missing and invalid keys return 401.
    assert.equal((await fetch(`${base}/api/v1/report`)).status, 401);
    assert.equal(
      (
        await fetch(`${base}/api/v1/report`, {
          headers: { "x-api-key": "not-a-real-key" },
        })
      ).status,
      401,
    );

    const user = await signUp(base, {
      email: "reporter@example.com",
      name: "Reporter",
    });
    const { sessionId } = await (
      await user.post("/api/workspace", {
        problemId: "bounded-stack",
        language: "go",
      })
    ).json();
    await user.post(`/api/workspace/${sessionId}/run`, { level: 1, files: [] });
    await user.post(`/api/workspace/${sessionId}/run`, { level: 2, files: [] });

    const createdKeyRes = await user.post("/api/auth/api-key/create", {
      name: "report-reader",
    });
    assert.equal(createdKeyRes.status, 200);
    const createdKey = (await createdKeyRes.json()) as {
      id: string;
      key: string;
    };

    // An API key alone cannot open a workspace.
    const wsWithKey = await fetch(`${base}/api/workspace`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": createdKey.key,
      },
      body: JSON.stringify({ problemId: "bounded-stack", language: "go" }),
    });
    assert.equal(wsWithKey.status, 401);

    // Valid key reads report and respects limit.
    const reportRes = await fetch(`${base}/api/v1/report?limit=1`, {
      headers: { "x-api-key": createdKey.key },
    });
    assert.equal(reportRes.status, 200);
    const data = (await reportRes.json()) as ProgressReport;
    assert.equal(data.user.email, "reporter@example.com");
    assert.equal(data.user.name, "Reporter");
    assert.equal(data.summary.attempts, 2);
    assert.equal(data.summary.passedAttempts, 2);
    assert.equal(data.summary.levelsPassed, 2);
    assert.equal(data.summary.problemsStarted, 1);
    assert.equal(data.summary.problemsCompleted, 0);
    assert.equal(data.progress.length, 1);
    assert.equal(data.progress[0].problemId, "bounded-stack");
    assert.equal(data.attempts.length, 1);
    assert.equal(data.attempts[0].level, 2);

    const cutoff = data.attempts[0].createdAt;
    const filter = (since: string) =>
      fetch(`${base}/api/v1/report?${new URLSearchParams({ since, limit: "1" })}`, {
        headers: { "x-api-key": createdKey.key },
      });
    const offsetCutoff = new Date(Date.parse(cutoff) + 3_600_000)
      .toISOString()
      .replace("Z", "+01:00");
    for (const since of [cutoff, offsetCutoff]) {
      const filteredRes = await filter(since);
      assert.equal(filteredRes.status, 200);
      const filtered = (await filteredRes.json()) as ProgressReport;
      assert.deepEqual(filtered.attempts, []);
      assert.deepEqual(filtered.summary, data.summary);
      assert.deepEqual(filtered.progress, data.progress);
    }
    const dateRes = await filter("1900-01-01");
    assert.equal(dateRes.status, 200);
    assert.deepEqual(((await dateRes.json()) as ProgressReport).attempts, data.attempts);
    for (const since of ["", "yesterday", "2026-02-30", "2026-01-01T00:00:00"]) {
      assert.equal((await filter(since)).status, 400);
    }
    const repeated = await fetch(`${base}/api/v1/report?since=1900-01-01&since=2000-01-01`, {
      headers: { "x-api-key": createdKey.key },
    });
    assert.equal(repeated.status, 400);

    // Deleting the key revokes report access immediately.
    const delKeyRes = await user.post("/api/auth/api-key/delete", {
      keyId: createdKey.id,
    });
    assert.equal(delKeyRes.status, 200);
    assert.equal(
      (
        await fetch(`${base}/api/v1/report`, {
          headers: { "x-api-key": createdKey.key },
        })
      ).status,
      401,
    );
  } finally {
    await close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("hosted origins are explicit and workspace capacity includes simultaneous opens", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lld-hosted-test-"));
  const { base, close } = await startServer({
    workspaceRoot: directory,
    maxWorkspaces: 1,
    allowedOrigins: ["https://practice.example.com"],
  });
  try {
    const baseHeaders = {
      Host: "practice.example.com",
      Origin: "https://practice.example.com",
      "Content-Type": "application/json",
    };
    assert.equal(
      (await fetch(`${base}/api/health`, { headers: baseHeaders })).status,
      200,
    );
    assert.equal(
      (
        await fetch(`${base}/api/health`, {
          headers: { ...baseHeaders, Origin: "https://other.example.com" },
        })
      ).status,
      403,
    );
    const user = await signUp(base, {
      host: "practice.example.com",
      origin: "https://practice.example.com",
    });
    const responses = await Promise.all(
      [1, 2].map(() =>
        user.post("/api/workspace", {
          problemId: "bounded-stack",
          language: "python",
        }),
      ),
    );
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 503]);
    const okResponse = responses.find((r) => r.status === 200);
    assert(okResponse, "Expected one 200 response");
    const workspace = await okResponse.json();
    await user.del(`/api/workspace/${workspace.sessionId}`);
    await new Promise((resolve) => setTimeout(resolve, 30));
    await assert.rejects(
      readFile(path.join(directory, workspace.sessionId, "implementation.py")),
      { code: "ENOENT" },
    );
  } finally {
    await close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("API queues globally, locks queued workspaces, preserves queue errors, and skips recording failed queue runs", async () => {
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
  const { base, close } = await startServer({
    workspaceRoot: directory,
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
  try {
    const user = await signUp(base);
    const ids = [];
    for (let i = 0; i < 3; i++) {
      const response = await user.post("/api/workspace", {
        problemId: "bounded-stack",
        language: "python",
      });
      assert.equal(response.status, 200);
      ids.push((await response.json()).sessionId);
    }
    const run = (id: string) =>
      user.post(`/api/workspace/${id}/run`, { level: 1, files: [] });
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

    // Only the two runs that actually executed are recorded (not the 409/503/504 errors).
    const keyRes = await user.post("/api/auth/api-key/create", { name: "q" });
    const { key } = (await keyRes.json()) as { key: string };
    const reportData = (await (
      await fetch(`${base}/api/v1/report`, { headers: { "x-api-key": key } })
    ).json()) as ProgressReport;
    assert.equal(reportData.summary.attempts, 2);
  } finally {
    release();
    await close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("diagnostics polling does not prevent idle workspace expiry", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lld-idle-api-"));
  const { base, close } = await startServer({
    workspaceRoot: directory,
    workspaceIdleMs: 100,
    cleanupIntervalMs: 10,
  });
  try {
    const user = await signUp(base);
    const response = await user.post("/api/workspace", {
      problemId: "bounded-stack",
      language: "python",
    });
    assert.equal(response.status, 200);
    const { sessionId } = await response.json();
    let status = 200;
    for (let i = 0; i < 20 && status === 200; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      status = (await user.get(`/api/workspace/${sessionId}/diagnostics`))
        .status;
    }
    assert.equal(status, 404);
  } finally {
    await close();
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
