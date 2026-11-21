import express, { type Express, type ErrorRequestHandler } from "express";
import type { PracticeProblem } from "../shared/problems.ts";
type Language = "go" | "python" | "typescript" | "java";
type File = {
  path: string;
  content: string;
  readOnly?: boolean;
  hidden?: boolean;
  userCreated?: boolean;
};
type Workspace = {
  sessionId: string;
  directory: string;
  rootUri: string;
  files: File[];
  problem: PracticeProblem;
  language: Language;
  running: boolean;
  saving: Promise<void>;
  lastUsed: number;
  closing?: boolean;
  lsp?: LanguageServer | null;
};
declare module "express-serve-static-core" {
  interface Request {
    workspace: Workspace;
  }
}
type AppOptions = {
  workspaceRoot?: string;
  catalog?: PracticeProblem[];
  enableLsp?: boolean;
  maxWorkspaces?: number;
  workspaceIdleMs?: number;
  lspIdleMs?: number;
  testTimeoutMs?: number;
  cleanupIntervalMs?: number;
  allowedOrigins?: string[];
  queueOptions?: ConstructorParameters<typeof TestQueue>[0];
  executeTests?: typeof runTests;
};
type PracticeApp = Express & { close: () => void };
import { mkdir, writeFile, readdir, rm, rmdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { LanguageServer } from "./lsp.ts";
import { runTests } from "./runner.ts";
import { TestQueue } from "./queue.ts";
import { problems } from "../shared/problems.ts";
import { getFiles } from "../shared/languages.ts";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const allowedMethods = new Set([
  "textDocument/didOpen",
  "textDocument/didChange",
  "textDocument/didClose",
  "textDocument/didSave",
  "textDocument/completion",
  "completionItem/resolve",
  "textDocument/hover",
  "textDocument/definition",
  "textDocument/references",
  "textDocument/signatureHelp",
  "textDocument/formatting",
  "textDocument/documentSymbol",
]);
const notifications = new Set([
  "textDocument/didOpen",
  "textDocument/didChange",
  "textDocument/didClose",
  "textDocument/didSave",
]);
export const commandAvailable = (
  command: string,
  args: string[] = ["--version"],
): Promise<boolean> =>
  new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "ignore" });
    const timeout = setTimeout(() => {
      child.kill();
      resolve(false);
    }, 3000);
    child.on("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      resolve(code === 0);
    });
  });

export function validateFiles(files: unknown, originals: File[]): File[] {
  if (!Array.isArray(files)) throw new Error("Files must be an array");
  const allowed = new Map(
    originals.filter((file) => !file.readOnly).map((file) => [file.path, file]),
  );
  for (const file of files) {
    if (!file || typeof file.path !== "string" || !allowed.has(file.path))
      throw new Error("File is unknown or read-only");
    if (
      typeof file.content !== "string" ||
      Buffer.byteLength(file.content) > 1000000
    )
      throw new Error("Invalid file contents");
  }
  return files;
}

export function validateNewFile(
  filePath: unknown,
  language: Language,
  originals: File[],
): string {
  if (
    typeof filePath !== "string" ||
    filePath.length > 240 ||
    filePath.includes("\\") ||
    path.isAbsolute(filePath)
  )
    throw new Error("Use a relative source file path");
  const segments = filePath.split("/");
  if (
    segments.length > 12 ||
    segments.some(
      (segment) =>
        !/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(segment) ||
        /^hidden_/i.test(segment),
    )
  )
    throw new Error("Invalid source file path");
  const extension = {
    go: ".go",
    python: ".py",
    typescript: ".ts",
    java: ".java",
  }[language];
  if (!filePath.endsWith(extension))
    throw new Error(`Use a ${extension} source file for this language`);
  const folded = filePath.toLowerCase();
  for (const original of originals) {
    const existing = original.path.toLowerCase();
    if (
      existing === folded ||
      existing.startsWith(`${folded}/`) ||
      folded.startsWith(`${existing}/`)
    )
      throw new Error("File already exists or conflicts with an existing path");
    const otherSegments = original.path.split("/");
    for (
      let index = 0;
      index < Math.min(segments.length, otherSegments.length) - 1;
      index++
    ) {
      if (segments[index].toLowerCase() !== otherSegments[index].toLowerCase())
        break;
      if (segments[index] !== otherSegments[index])
        throw new Error("Directory casing conflicts with an existing path");
    }
  }
  return filePath;
}

function restoreCreatedFiles(
  incoming: unknown,
  language: Language,
  originals: File[],
): File[] {
  if (!Array.isArray(incoming)) throw new Error("Files must be an array");
  const restored: File[] = [];
  for (const file of incoming) {
    if (
      file &&
      !originals.some((original) => original.path === file.path) &&
      file.userCreated === true
    ) {
      const filePath = validateNewFile(file.path, language, [
        ...originals,
        ...restored,
      ]);
      if (
        typeof file.content !== "string" ||
        Buffer.byteLength(file.content) > 1000000
      )
        throw new Error("Invalid file contents");
      restored.push({
        path: filePath,
        content: file.content,
        readOnly: false,
        userCreated: true,
      });
    }
  }
  validateFiles(incoming, [...originals, ...restored]);
  return restored;
}

function setting(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new Error(`${name} must be a positive integer`);
  return parsed;
}

export function createApp({
  workspaceRoot = process.env.PRACTICE_WORKSPACE_ROOT ||
    path.join(projectRoot, ".practice", "workspaces"),
  catalog = problems,
  enableLsp = true,
  maxWorkspaces = setting("PRACTICE_MAX_WORKSPACES", 20),
  workspaceIdleMs = setting("PRACTICE_WORKSPACE_IDLE_MS", 3600000),
  lspIdleMs = setting("PRACTICE_LSP_IDLE_MS", 300000),
  testTimeoutMs = setting("PRACTICE_TEST_TIMEOUT_MS", 20000),
  cleanupIntervalMs = 60000,
  allowedOrigins = (process.env.PRACTICE_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  queueOptions = {
    concurrency: setting("PRACTICE_TEST_CONCURRENCY", 2),
    maxWaiting: setting("PRACTICE_TEST_QUEUE_LIMIT", 10),
    waitTimeoutMs: setting("PRACTICE_QUEUE_TIMEOUT_MS", 60000),
  },
  executeTests = runTests,
}: AppOptions = {}): PracticeApp {
  const app = express() as PracticeApp;
  const sessions = new Map<string, Workspace>();
  const queue = new TestQueue(queueOptions);
  let opening = 0;
  let closed = false;
  const origins = new Set(allowedOrigins.map((value) => new URL(value).origin));
  const hostnames = new Set([
    "localhost",
    "127.0.0.1",
    "[::1]",
    ...[...origins].map((value) => new URL(value).hostname),
  ]);
  // Session IDs are process-local; only remove our UUID directories on startup.
  const storageReady = (async () => {
    await mkdir(workspaceRoot, { recursive: true });
    for (const entry of await readdir(workspaceRoot, { withFileTypes: true })) {
      if (
        entry.isDirectory() &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          entry.name,
        )
      )
        await rm(path.join(workspaceRoot, entry.name), {
          recursive: true,
          force: true,
        });
    }
  })();
  void storageReady.catch(console.error);
  const removeWorkspace = (session: Workspace) => {
    session.closing = true;
    session.lsp?.dispose();
    if (session.language === "java")
      void rm(`${session.directory}.jdtls`, {
        recursive: true,
        force: true,
      }).catch(console.error);
    sessions.delete(session.sessionId);
    if (!session.running)
      void rm(session.directory, { recursive: true, force: true }).catch(
        console.error,
      );
  };
  const bin = (name: string) =>
    path.join(projectRoot, "node_modules", ".bin", name);
  const lspCommands: Record<Language, [string, string[]]> = {
    go: ["gopls", ["serve"]],
    python: [bin("pyright-langserver"), ["--stdio"]],
    typescript: [bin("typescript-language-server"), ["--stdio"]],
    java: [process.env.PRACTICE_JAVA_LSP || "jdtls", []],
  };
  const health = {
    go: false,
    gopls: false,
    languages: {
      go: { runtime: false, lsp: false },
      python: { runtime: false, lsp: false },
      typescript: { runtime: false, lsp: false },
      java: { runtime: false, lsp: false },
    },
    runner: process.env.PRACTICE_RUNNER || "native",
  };
  const healthReady = (async () => {
    const [go, gopls, python, pyright, node, tsserver, java, javac, jdtls] =
      await Promise.all([
        commandAvailable("go", ["version"]),
        commandAvailable("gopls", ["version"]),
        commandAvailable("python3"),
        commandAvailable(bin("pyright")),
        commandAvailable("node"),
        commandAvailable(bin("typescript-language-server")),
        commandAvailable("java", ["-version"]),
        commandAvailable("javac", ["-version"]),
        commandAvailable(lspCommands.java[0], ["--help"]),
      ]);
    health.go = go;
    health.gopls = gopls;
    health.languages = {
      go: { runtime: go, lsp: gopls },
      python: { runtime: python, lsp: pyright },
      typescript: { runtime: node, lsp: tsserver },
      java: { runtime: java && javac, lsp: jdtls },
    };
  })();
  app.use("/api", (req, res, next) => {
    if (!hostnames.has(req.hostname)) {
      res.status(403).json({ error: "Host is not allowed" });
      return;
    }
    if (req.headers.origin) {
      let origin;
      try {
        origin = new URL(req.headers.origin);
      } catch {
        res.status(403).json({ error: "Invalid origin" });
        return;
      }
      if (
        !origins.has(origin.origin) &&
        (!["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) ||
          !["3001", "5173", "4173"].includes(origin.port))
      ) {
        res.status(403).json({ error: "Origin is not allowed" });
        return;
      }
    }
    next();
  });
  app.use(express.json({ limit: "3mb" }));
  app.get("/api/health", async (_req, res) => {
    await Promise.all([healthReady, storageReady]);
    res.json(health);
  });

  app.get("/api/problems", (_req, res) =>
    res.json({
      problems: catalog.map(
        ({ files: _files, packageName: _packageName, ...metadata }) => metadata,
      ),
    }),
  );

  const saveFiles = (session: Workspace, incoming: unknown = []) => {
    const files = structuredClone(validateFiles(incoming, session.files));
    const save = session.saving.then(async () => {
      await Promise.all(
        files.map(async (file) => {
          await writeFile(
            path.join(session.directory, file.path),
            file.content,
          );
          const original = session.files.find(
            (item) => item.path === file.path,
          );
          if (original) original.content = file.content;
        }),
      );
    });
    session.saving = save.catch(() => {});
    return save;
  };

  app.post("/api/workspace", async (req, res, next) => {
    if (closed || sessions.size + opening >= maxWorkspaces) {
      res
        .status(503)
        .json({ error: "Workspace limit reached; try again later" });
      return;
    }
    opening++;
    let created: Workspace | undefined;
    let directory: string | undefined;
    try {
      await Promise.all([healthReady, storageReady]);
      if (closed) throw new Error("Server is shutting down");
      const problem = catalog.find((item) => item.id === req.body.problemId);
      if (!problem) {
        res.status(404).json({ error: "Unknown exercise" });
        return;
      }
      const language = (req.body.language || "go") as Language;
      if (!Object.hasOwn(lspCommands, language)) {
        res.status(400).json({ error: "Unsupported language" });
        return;
      }
      const files: File[] = structuredClone(getFiles(problem, language));
      // Validate before creating a directory or starting a language server.
      files.push(...restoreCreatedFiles(req.body.files ?? [], language, files));
      const sessionId = randomUUID();
      directory = path.join(workspaceRoot, sessionId);
      await mkdir(directory, { recursive: true });
      if (language === "java") {
        // JDT LS needs a Java project to provide semantic diagnostics and completions.
        await writeFile(
          path.join(directory, ".project"),
          `<projectDescription><name>practice-${sessionId}</name><buildSpec><buildCommand><name>org.eclipse.jdt.core.javabuilder</name></buildCommand></buildSpec><natures><nature>org.eclipse.jdt.core.javanature</nature></natures></projectDescription>`,
        );
        await writeFile(
          path.join(directory, ".classpath"),
          '<classpath><classpathentry kind="src" path="" excluding=".jdtls/**|bin/**"/><classpathentry kind="con" path="org.eclipse.jdt.launching.JRE_CONTAINER"/><classpathentry kind="output" path="bin"/></classpath>',
        );
      }
      for (const file of files) {
        if (
          !/^[a-zA-Z0-9_./-]+$/.test(file.path) ||
          file.path.split("/").includes("..") ||
          path.isAbsolute(file.path)
        )
          throw new Error("Invalid catalog path");
        await mkdir(path.dirname(path.join(directory, file.path)), {
          recursive: true,
        });
        await writeFile(path.join(directory, file.path), file.content);
      }
      const rootUri = pathToFileURL(directory).href;
      const session: Workspace = {
        sessionId,
        directory,
        rootUri,
        files,
        problem,
        language,
        running: false,
        saving: Promise.resolve(),
        lastUsed: Date.now(),
      };
      created = session;
      await saveFiles(session, req.body.files);
      if (health.languages[language].lsp && enableLsp) {
        try {
          const [command, args] = lspCommands[language];
          session.lsp = new LanguageServer(
            rootUri,
            command,
            language === "java" ? ["-data", `${directory}.jdtls`] : args,
          );
          await session.lsp.initialize();
        } catch {
          session.lsp?.dispose();
          session.lsp = null;
        }
      }
      if (closed) throw new Error("Server is shutting down");
      sessions.set(sessionId, session);
      res.json({
        sessionId,
        rootUri,
        files: files.filter(
          (file) => !file.hidden && !file.path.startsWith("hidden_"),
        ),
        language,
        lspAvailable: Boolean(session.lsp),
      });
    } catch (error) {
      created?.lsp?.dispose();
      if (directory)
        await Promise.all(
          [directory, `${directory}.jdtls`].map((target) =>
            rm(target, { recursive: true, force: true }),
          ),
        ).catch(console.error);
      next(error);
    } finally {
      opening--;
    }
  });

  app.use("/api/workspace/:id", (req, res, next) => {
    const session = sessions.get(String(req.params.id));
    if (!session) {
      res
        .status(404)
        .json({ error: "Workspace expired; reopen the exercise" });
      return;
    }
    if (req.method !== "GET") session.lastUsed = Date.now();
    req.workspace = session;
    next();
  });

  app.post("/api/workspace/:id/files", async (req, res, next) => {
    try {
      if (req.workspace.running) {
        res
          .status(409)
          .json({ error: "Tests are already queued or running" });
        return;
      }
      await saveFiles(req.workspace, req.body.files);
      res.json({ saved: true });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/workspace/:id/create-file", async (req, res, next) => {
    const session = req.workspace;
    if (session.running) {
      res
        .status(409)
        .json({ error: "Tests are already queued or running" });
      return;
    }
    try {
      const filePath = validateNewFile(
        req.body.path,
        session.language,
        session.files,
      );
      const content = req.body.content ?? "";
      if (typeof content !== "string" || Buffer.byteLength(content) > 1000000)
        throw new Error("Invalid file contents");
      const file: File = {
        path: filePath,
        content,
        readOnly: false,
        userCreated: true,
      };
      // Reserve the name before asynchronous writes, so concurrent requests cannot collide.
      session.files.push(file);
      try {
        await mkdir(path.dirname(path.join(session.directory, filePath)), {
          recursive: true,
        });
        await writeFile(path.join(session.directory, filePath), content, {
          flag: "wx",
        });
      } catch (error) {
        session.files.splice(session.files.indexOf(file), 1);
        throw error;
      }
      res.status(201).json({ file });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/workspace/:id/delete-file", async (req, res, next) => {
    const session = req.workspace;
    if (session.running) {
      res
        .status(409)
        .json({ error: "Tests are already queued or running" });
      return;
    }
    try {
      const filePath = req.body?.path;
      const index =
        typeof filePath === "string"
          ? session.files.findIndex(
              (file) => file.path === filePath && file.userCreated === true,
            )
          : -1;
      if (index === -1) {
        res
          .status(400)
          .json({ error: "Only added files can be removed" });
        return;
      }
      const [removed] = session.files.splice(index, 1);
      const fullPath = path.join(session.directory, removed.path);
      const remove = session.saving.then(async () => {
        await rm(fullPath, { force: true });
        let directory = path.dirname(fullPath);
        while (
          directory !== session.directory &&
          directory.startsWith(`${session.directory}${path.sep}`)
        ) {
          try {
            await rmdir(directory);
          } catch {
            break;
          }
          directory = path.dirname(directory);
        }
        session.lsp?.diagnostics.delete(pathToFileURL(fullPath).href);
      });
      session.saving = remove.catch(() => {});
      await remove;
      res.json({ deleted: removed.path });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/workspace/:id/run", async (req, res, next) => {
    const session = req.workspace;
    if (session.running) {
      res.status(409).json({ error: "Tests are already running" });
      return;
    }
    try {
      const level = req.body.level;
      if (
        !Number.isInteger(level) ||
        level < 1 ||
        level > session.problem.levels.length ||
        level > 9
      ) {
        res.status(400).json({ error: "Invalid level" });
        return;
      }
      session.running = true;
      validateFiles(req.body.files ?? [], session.files);
      res.json(
        await queue.run(async () => {
          if (session.closing) throw new Error("Workspace was closed");
          await saveFiles(session, req.body.files);
          return executeTests(session.directory, session.language, level, {
            timeoutMs: testTimeoutMs,
            suppliedFiles: session.files
              .filter((file) => !file.userCreated)
              .map((file) => file.path),
          });
        }),
      );
    } catch (error) {
      next(error);
    } finally {
      session.running = false;
      if (session.closing)
        await rm(session.directory, { recursive: true, force: true }).catch(
          console.error,
        );
    }
  });
  app.post("/api/workspace/:id/lsp", async (req, res, next) => {
    try {
      const session = req.workspace;
      if (!session.lsp) {
        res.status(503).json({
          error: "Language server unavailable; install it and restart the app",
        });
        return;
      }
      const { method, params } = req.body;
      if (!allowedMethods.has(method)) {
        res.status(400).json({ error: "Unsupported LSP method" });
        return;
      }
      const uri = params?.textDocument?.uri;
      if (
        method !== "completionItem/resolve" &&
        (!uri ||
          !session.files.some(
            (file) =>
              !file.hidden &&
              !file.path.startsWith("hidden_") &&
              pathToFileURL(path.join(session.directory, file.path)).href ===
                uri,
          ))
      ) {
        res
          .status(400)
          .json({ error: "Document is outside this workspace" });
        return;
      }
      await session.lsp.resume();
      if (notifications.has(method)) {
        session.lsp.notify(method, params);
        res.json({ result: null });
      } else res.json({ result: await session.lsp.request(method, params) });
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/workspace/:id/diagnostics", (req, res) => {
    const entries = req.workspace.lsp?.diagnostics ?? new Map();
    res.json({
      diagnostics: [...entries]
        .filter(([uri]) =>
          req.workspace.files.some(
            (file) =>
              !file.hidden &&
              !file.path.startsWith("hidden_") &&
              pathToFileURL(path.join(req.workspace.directory, file.path))
                .href === uri,
          ),
        )
        .map(([uri, diagnostics]) => ({ uri, diagnostics })),
    });
  });
  app.delete("/api/workspace/:id", (req, res) => {
    removeWorkspace(req.workspace);
    res.json({ closed: true });
  });
  const errors: ErrorRequestHandler = (error: Error, _req, res, _next) => {
    const status =
      "status" in error && typeof error.status === "number"
        ? error.status
        : 400;
    res.status(status).json({ error: error.message });
  };
  app.use(errors);
  const cleanup = setInterval(() => {
    for (const session of sessions.values()) {
      if (session.running) continue;
      const idle = Date.now() - session.lastUsed;
      if (idle > workspaceIdleMs) removeWorkspace(session);
      else if (idle > lspIdleMs) session.lsp?.suspend();
    }
  }, cleanupIntervalMs);
  cleanup.unref();
  app.close = () => {
    closed = true;
    clearInterval(cleanup);
    queue.close();
    for (const session of sessions.values()) removeWorkspace(session);
  };
  return app;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const app = createApp();
  const server = app.listen(
    3001,
    process.env.PRACTICE_HOST || "127.0.0.1",
    () => console.log("Practice API: http://127.0.0.1:3001"),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      app.close();
      server.close(() => process.exit(0));
    });
}
