import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { createApp } from "../server/index.ts";

type Position = { line: number; character: number };
type Diagnostic = { message: string; severity?: number };
type Report = { uri: string; diagnostics: Diagnostic[] };
type WorkspaceFile = { path: string; content: string; readOnly: boolean };
type Workspace = {
  sessionId: string;
  rootUri: string;
  lspAvailable: boolean;
  files: WorkspaceFile[];
};
const fixtures = [
  {
    language: "go",
    suffix: ".go",
    extra:
      '\nconst practiceValue = "sample"\nfunc integrationProbe() {\n\t_ = practiceVal\n}\n',
  },
  {
    language: "python",
    suffix: ".py",
    extra: '\npracticeValue = "sample"\nintegration_result = practiceVal\n',
  },
  {
    language: "typescript",
    suffix: ".ts",
    extra:
      '\nconst practiceValue = "sample";\nconst integrationResult = practiceVal;\n',
  },
];

function locate(text: string, needle: string, after = false): Position {
  const offset = text.lastIndexOf(needle);
  assert.notEqual(offset, -1, `Fixture must contain ${needle}`);
  const lines = text.slice(0, offset + (after ? needle.length : 0)).split("\n");
  return { line: lines.length - 1, character: lines.at(-1)!.length };
}

async function eventually<T>(
  read: () => Promise<T>,
  accepted: (value: T) => boolean,
  description: string,
): Promise<T> {
  const deadline = Date.now() + 15000;
  let last: T | undefined;
  do {
    last = await read();
    if (accepted(last)) return last;
    await delay(200);
  } while (Date.now() < deadline);
  assert.fail(
    `${description} did not arrive within 15 seconds; last response: ${JSON.stringify(last)}`,
  );
}

for (const fixture of fixtures) {
  test(
    `${fixture.language}: real LSP completion, hover, and diagnostics over HTTP`,
    { timeout: 60000 },
    async () => {
      const workspaceRoot = await mkdtemp(path.join(tmpdir(), "lld-lsp-"));
      const app = createApp({ workspaceRoot, enableLsp: true });
      const server = app.listen(0, "127.0.0.1");
      await once(server, "listening");
      const address = server.address();
      assert(address && typeof address === "object");
      const base = `http://127.0.0.1:${address.port}`;
      async function json(route: string, body?: unknown): Promise<any> {
        const response = await fetch(
          `${base}${route}`,
          body === undefined
            ? undefined
            : {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              },
        );
        const data = await response.json();
        assert.equal(response.ok, true, `${route}: ${JSON.stringify(data)}`);
        return data;
      }
      try {
        const health = await json("/api/health");
        assert.equal(
          health.languages[fixture.language].lsp,
          true,
          `${fixture.language} language server must be installed for this integration suite`,
        );
        const session: Workspace = await json("/api/workspace", {
          problemId: "ride-dispatch",
          language: fixture.language,
        });
        assert.equal(
          session.lspAvailable,
          true,
          `${fixture.language} language server failed to initialize`,
        );
        const source = session.files.find(
          (file) =>
            !file.readOnly &&
            file.path.endsWith(fixture.suffix) &&
            !file.path.includes("sandbox"),
        );
        assert(
          source,
          `${fixture.language} implementation file must be present`,
        );
        const text = source.content + fixture.extra;
        const uri = `${session.rootUri}/${source.path}`;
        const route = `/api/workspace/${session.sessionId}`;
        const lsp = async (method: string, params: unknown) =>
          (await json(`${route}/lsp`, { method, params })).result;
        await lsp("textDocument/didOpen", {
          textDocument: { uri, languageId: fixture.language, version: 1, text },
        });
        const hover = await eventually(
          () =>
            lsp("textDocument/hover", {
              textDocument: { uri },
              position: locate(text, "practiceValue"),
            }),
          (value) => Boolean(value?.contents),
          `${fixture.language} hover`,
        );
        assert.match(
          JSON.stringify(hover.contents),
          /practiceValue|string|str|sample/i,
        );
        const completion = await eventually(
          () =>
            lsp("textDocument/completion", {
              textDocument: { uri },
              position: locate(text, "practiceVal", true),
              context: { triggerKind: 1 },
            }),
          (value) =>
            (Array.isArray(value) ? value : value?.items || []).some(
              (item: { label: string }) => item.label.includes("practiceValue"),
            ),
          `${fixture.language} symbol completion`,
        );
        assert(
          (Array.isArray(completion) ? completion : completion.items).length >
            0,
        );
        const diagnosticReports = await eventually<{ diagnostics: Report[] }>(
          () => json(`${route}/diagnostics`),
          (value) =>
            value.diagnostics.some(
              (report) =>
                report.uri === uri &&
                report.diagnostics.some((item) =>
                  /practiceVal/.test(item.message),
                ),
            ),
          `${fixture.language} undefined-symbol diagnostic`,
        );
        assert(
          diagnosticReports.diagnostics.some(
            (report) =>
              report.uri === uri &&
              report.diagnostics.some((item) => item.severity === 1),
          ),
        );

        // Verify the same open document can be corrected, clearing diagnostics.
        const fixedText = text
          .replaceAll("= practiceVal;", "= practiceValue;")
          .replaceAll("= practiceVal\n", "= practiceValue\n");
        await lsp("textDocument/didChange", {
          textDocument: { uri, version: 2 },
          contentChanges: [{ text: fixedText }],
        });
        await eventually<{ diagnostics: Report[] }>(
          () => json(`${route}/diagnostics`),
          (value) =>
            value.diagnostics.some(
              (report) =>
                report.uri === uri &&
                !report.diagnostics.some((item) =>
                  /practiceVal/.test(item.message),
                ),
            ),
          `${fixture.language} diagnostic clearing after didChange`,
        );
        await lsp("textDocument/didClose", { textDocument: { uri } });
      } finally {
        app.close();
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
        await rm(workspaceRoot, { recursive: true, force: true });
      }
    },
  );
}
