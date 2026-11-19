import express, { type Express, type ErrorRequestHandler } from "express";
import type { PracticeProblem } from "../shared/problems.ts";
type Language = "go" | "python" | "typescript";
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
  lastUsed: number;
  lsp?: LanguageServer | null;
};
declare global {
  namespace Express {
    interface Request {
      workspace: Workspace;
    }
  }
}
type AppOptions = {
  workspaceRoot?: string;
  catalog?: PracticeProblem[];
  enableLsp?: boolean;
};
type PracticeApp = Express & { close: () => void };
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { LanguageServer } from "./lsp.ts";
import { runTests } from "./runner.ts";
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
  const extension = { go: ".go", python: ".py", typescript: ".ts" }[language];
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

export function createApp({
  workspaceRoot = path.join(projectRoot, ".practice", "workspaces"),
  catalog = problems,
  enableLsp = true,
}: AppOptions = {}): PracticeApp {
  const app = express() as PracticeApp;
  const sessions = new Map<string, Workspace>();
  const bin = (name: string) =>
    path.join(projectRoot, "node_modules", ".bin", name);
  const lspCommands: Record<Language, [string, string[]]> = {
    go: ["gopls", ["serve"]],
    python: [bin("pyright-langserver"), ["--stdio"]],
    typescript: [bin("typescript-language-server"), ["--stdio"]],
  };
  const health = {
    go: false,
    gopls: false,
    languages: {
      go: { runtime: false, lsp: false },
      python: { runtime: false, lsp: false },
      typescript: { runtime: false, lsp: false },
    },
    runner: process.env.PRACTICE_RUNNER || "native",
  };
  const healthReady = (async () => {
    const [go, gopls, python, pyright, node, tsserver] = await Promise.all([
      commandAvailable("go", ["version"]),
      commandAvailable("gopls", ["version"]),
      commandAvailable("python3"),
      commandAvailable(bin("pyright")),
      commandAvailable("node"),
      commandAvailable(bin("typescript-language-server")),
    ]);
    health.go = go;
    health.gopls = gopls;
    health.languages = {
      go: { runtime: go, lsp: gopls },
      python: { runtime: python, lsp: pyright },
      typescript: { runtime: node, lsp: tsserver },
    };
  })();
  app.use("/api", (req, res, next) => {
    if (!["localhost", "127.0.0.1", "[::1]"].includes(req.hostname))
      return res.status(403).json({ error: "Localhost access only" });
    if (req.headers.origin) {
      let origin;
      try {
        origin = new URL(req.headers.origin);
      } catch {
        return res.status(403).json({ error: "Invalid origin" });
      }
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) ||
        !["3001", "5173", "4173"].includes(origin.port)
      ) {
        return res.status(403).json({ error: "Origin is not allowed" });
      }
    }
    next();
  });
  app.use(express.json({ limit: "3mb" }));
  app.get("/api/health", async (_req, res) => {
    await healthReady;
    res.json(health);
  });

  app.get("/api/problems", (_req, res) =>
    res.json({
      problems: catalog.map(
        ({ files: _files, packageName: _packageName, ...metadata }) => metadata,
      ),
    }),
  );

  const saveFiles = async (session: Workspace, incoming: unknown = []) => {
    const files = validateFiles(incoming, session.files);
    await Promise.all(
      files.map(async (file) => {
        await writeFile(path.join(session.directory, file.path), file.content);
        session.files.find((original) => original.path === file.path)!.content =
          file.content;
      }),
    );
  };

  app.post("/api/workspace", async (req, res, next) => {
    try {
      await healthReady;
      const problem = catalog.find((item) => item.id === req.body.problemId);
      if (!problem) return res.status(404).json({ error: "Unknown exercise" });
      const language = (req.body.language || "go") as Language;
      if (!Object.hasOwn(lspCommands, language))
        return res.status(400).json({ error: "Unsupported language" });
      const files: File[] = structuredClone(getFiles(problem, language));
      // Validate before creating a directory or starting a language server.
      files.push(...restoreCreatedFiles(req.body.files ?? [], language, files));
      const sessionId = randomUUID();
      const directory = path.join(workspaceRoot, sessionId);
      await mkdir(directory, { recursive: true });
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
        lastUsed: Date.now(),
      };
      await saveFiles(session, req.body.files);
      if (health.languages[language].lsp && enableLsp) {
        try {
          session.lsp = new LanguageServer(rootUri, ...lspCommands[language]);
          await session.lsp.initialize();
        } catch {
          session.lsp?.dispose();
          session.lsp = null;
        }
      }
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
      next(error);
    }
  });

  app.use("/api/workspace/:id", (req, res, next) => {
    const session = sessions.get(String(req.params.id));
    if (!session)
      return res
        .status(404)
        .json({ error: "Workspace expired; reopen the exercise" });
    session.lastUsed = Date.now();
    req.workspace = session;
    next();
  });

  app.post("/api/workspace/:id/files", async (req, res, next) => {
    try {
      await saveFiles(req.workspace, req.body.files);
      res.json({ saved: true });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/workspace/:id/create-file", async (req, res, next) => {
    const session = req.workspace;
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
  app.post("/api/workspace/:id/run", async (req, res, next) => {
    const session = req.workspace;
    if (session.running)
      return res.status(409).json({ error: "Tests are already running" });
    try {
      const level = req.body.level;
      if (
        !Number.isInteger(level) ||
        level < 1 ||
        level > session.problem.levels.length ||
        level > 9
      )
        return res.status(400).json({ error: "Invalid level" });
      session.running = true;
      await saveFiles(session, req.body.files);
      res.json(
        await runTests(session.directory, session.language, level, {
          suppliedFiles: session.files
            .filter((file) => !file.userCreated)
            .map((file) => file.path),
        }),
      );
    } catch (error) {
      next(error);
    } finally {
      session.running = false;
    }
  });
  app.post("/api/workspace/:id/lsp", async (req, res, next) => {
    try {
      const session = req.workspace;
      if (!session.lsp || session.lsp.closed)
        return res.status(503).json({
          error: "Language server unavailable; install it and restart the app",
        });
      const { method, params } = req.body;
      if (!allowedMethods.has(method))
        return res.status(400).json({ error: "Unsupported LSP method" });
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
        return res
          .status(400)
          .json({ error: "Document is outside this workspace" });
      }
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
    req.workspace.lsp?.dispose();
    sessions.delete(req.workspace.sessionId);
    res.json({ closed: true });
  });
  const errors: ErrorRequestHandler = (error: Error, _req, res, _next) => {
    res.status(400).json({ error: error.message });
  };
  app.use(errors);
  const cleanup = setInterval(() => {
    for (const [id, session] of sessions)
      if (!session.running && Date.now() - session.lastUsed > 60 * 60 * 1000) {
        session.lsp?.dispose();
        sessions.delete(id);
      }
  }, 60000);
  cleanup.unref();
  app.close = () => {
    clearInterval(cleanup);
    for (const session of sessions.values()) session.lsp?.dispose();
    sessions.clear();
  };
  return app;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const app = createApp();
  const server = app.listen(3001, "127.0.0.1", () =>
    console.log("Practice API: http://127.0.0.1:3001"),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      app.close();
      server.close(() => process.exit(0));
    });
}
