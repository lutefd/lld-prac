import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { LanguageServer } from "./lsp.ts";

// A real child process exercises framing, process replacement, and replay without
// requiring a language toolchain or relying on its analysis timing.
const fakeServer = `
let buffer = Buffer.alloc(0);
const documents = new Map();
process.stdin.on('data', chunk => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const split = buffer.indexOf('\\r\\n\\r\\n');
    if (split < 0) return;
    const length = Number(/Content-Length:\\s*(\\d+)/i.exec(buffer.subarray(0, split).toString())[1]);
    if (buffer.length < split + 4 + length) return;
    const message = JSON.parse(buffer.subarray(split + 4, split + 4 + length).toString());
    buffer = buffer.subarray(split + 4 + length);
    if (message.method === 'textDocument/didOpen') documents.set(message.params.textDocument.uri, message.params.textDocument);
    if (message.method === 'textDocument/didClose') documents.delete(message.params.textDocument.uri);
    if (message.id !== undefined) {
      const result = message.method === 'probe' ? { pid: process.pid, documents: [...documents.values()] } : {};
      const body = JSON.stringify({ jsonrpc: '2.0', id: message.id, result });
      process.stdout.write('Content-Length: ' + Buffer.byteLength(body) + '\\r\\n\\r\\n' + body);
    }
  }
});
`;

test("idle language servers restart once and replay latest unsaved open documents", async () => {
  const lsp = new LanguageServer("file:///workspace", process.execPath, [
    "-e",
    fakeServer,
  ]);
  try {
    await lsp.initialize();
    const before = (await lsp.request("probe", {})) as { pid: number };
    lsp.notify("textDocument/didOpen", {
      textDocument: {
        uri: "file:///workspace/main.ts",
        languageId: "typescript",
        version: 1,
        text: "old",
      },
    });
    lsp.notify("textDocument/didChange", {
      textDocument: { uri: "file:///workspace/main.ts", version: 2 },
      contentChanges: [{ text: "unsaved" }],
    });
    lsp.notify("textDocument/didOpen", {
      textDocument: {
        uri: "file:///workspace/closed.ts",
        languageId: "typescript",
        version: 1,
        text: "closed",
      },
    });
    lsp.notify("textDocument/didClose", {
      textDocument: { uri: "file:///workspace/closed.ts" },
    });
    lsp.suspend();
    assert.equal(lsp.suspended, true);
    assert.equal(lsp.closed, true);
    await Promise.all([lsp.resume(), lsp.resume()]);
    const after = (await lsp.request("probe", {})) as {
      pid: number;
      documents: unknown[];
    };
    assert.notEqual(after.pid, before.pid);
    assert.equal(lsp.closed, false);
    assert.deepEqual(after.documents, [
      {
        uri: "file:///workspace/main.ts",
        languageId: "typescript",
        version: 2,
        text: "unsaved",
      },
    ]);
  } finally {
    lsp.dispose();
  }
  await assert.rejects(lsp.resume(), /Session closed/);
});

for (const action of ["suspend", "dispose"] as const) {
  test(
    `${action} terminates language-server descendants`,
    {
      skip: process.platform === "win32",
      timeout: 5000,
    },
    async () => {
      // The descendant inherits the protocol stdout pipe. The wrapper's close
      // event cannot arrive while that descendant remains alive holding it open.
      const withDescendant =
        `
      require('node:child_process').spawn(process.execPath,
        ['-e', 'setInterval(() => {}, 1000)'],
        { stdio: ['ignore', 'inherit', 'inherit'] });
    ` + fakeServer;
      const lsp = new LanguageServer("file:///workspace", process.execPath, [
        "-e",
        withDescendant,
      ]);
      try {
        await lsp.initialize();
        const closed = once(lsp.process, "close", {
          signal: AbortSignal.timeout(2000),
        });
        lsp[action]();
        await closed;
      } finally {
        // Ensure a broken cleanup implementation cannot leave the fixture alive.
        try {
          process.kill(-lsp.process.pid!, "SIGKILL");
        } catch {}
        lsp.dispose();
      }
    },
  );
}
