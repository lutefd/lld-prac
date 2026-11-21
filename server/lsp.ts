import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

/** A small, transport-only JSON-RPC bridge. No completion generation occurs here. */
type RpcParams = Record<string, any>;
type RpcMessage = {
  jsonrpc?: string;
  id?: number | string;
  method?: string;
  params?: RpcParams;
  result?: unknown;
  error?: { message: string };
};
type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
export class LanguageServer {
  rootUri: string;
  sequence: number;
  pending: Map<number | string, Pending>;
  diagnostics: Map<string, unknown[]>;
  buffer: Buffer;
  process: ChildProcessWithoutNullStreams;
  closed = false;
  suspended = false;
  private disposed = false;
  private command: string;
  private args: string[];
  private resuming?: Promise<void>;
  private documents = new Map<string, RpcParams>();
  constructor(rootUri: string, command = "gopls", args = ["serve"]) {
    this.rootUri = rootUri;
    this.command = command;
    this.args = args;
    this.sequence = 0;
    this.pending = new Map();
    this.diagnostics = new Map();
    this.buffer = Buffer.alloc(0);
    this.process = this.start();
  }

  private start() {
    const child = spawn(this.command, this.args, {
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    this.closed = false;
    this.buffer = Buffer.alloc(0);
    const current = () =>
      this.process === child && !this.suspended && !this.disposed;
    child.stdin.on("error", (error) => {
      if (current()) this.fail(error);
    });
    child.stdout.on("data", (chunk) => {
      if (current()) this.receive(chunk);
    });
    child.stderr.on("data", () => {});
    child.on("error", (error) => {
      if (current()) this.fail(error);
    });
    child.on("exit", () => {
      // A crashed language-server wrapper can leave its analysis subprocesses
      // behind too (for example TypeScript's tsserver).
      this.stopProcess(child);
      if (current()) this.fail(new Error("Language server exited"));
    });
    return child;
  }

  private stopProcess(child = this.process) {
    if (process.platform !== "win32" && child.pid) {
      try {
        process.kill(-child.pid, "SIGKILL");
        return;
      } catch {
        // The process may already have exited, or group signaling may be
        // unavailable. Still attempt to stop the direct child.
      }
    }
    try {
      child.kill("SIGKILL");
    } catch {
      // Process termination is idempotent.
    }
  }

  suspend() {
    if (this.disposed || this.suspended || this.resuming) return;
    this.suspended = true;
    this.stopProcess();
    this.fail(new Error("Language server suspended"));
    this.diagnostics.clear();
  }

  async resume() {
    if (this.disposed) throw new Error("Session closed");
    if (this.resuming) return this.resuming;
    if (!this.suspended) {
      if (this.closed) throw new Error("Language server is unavailable");
      return;
    }
    this.suspended = false;
    this.process = this.start();
    this.resuming = (async () => {
      try {
        await this.initialize();
        if (this.disposed) throw new Error("Session closed");
        for (const document of this.documents.values()) {
          this.send({
            method: "textDocument/didOpen",
            params: { textDocument: document },
          });
        }
      } catch (error) {
        this.stopProcess();
        this.suspended = !this.disposed;
        this.fail(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    })();
    try {
      await this.resuming;
    } finally {
      this.resuming = undefined;
    }
  }

  fail(error: Error) {
    this.closed = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  send(message: RpcMessage) {
    if (this.closed) throw new Error("Language server is unavailable");
    const body = JSON.stringify({ jsonrpc: "2.0", ...message });
    this.process.stdin.write(
      `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`,
    );
  }

  receive(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const split = this.buffer.indexOf("\r\n\r\n");
      if (split < 0) return;
      const length = Number(
        /Content-Length:\s*(\d+)/i.exec(
          this.buffer.subarray(0, split).toString(),
        )?.[1],
      );
      if (!Number.isFinite(length))
        return this.fail(new Error("Invalid language server frame"));
      if (this.buffer.length < split + 4 + length) return;
      const message = JSON.parse(
        this.buffer.subarray(split + 4, split + 4 + length).toString(),
      );
      this.buffer = this.buffer.subarray(split + 4 + length);
      if (message.method === "textDocument/publishDiagnostics") {
        this.diagnostics.set(message.params.uri, message.params.diagnostics);
      } else if (message.method && message.id !== undefined) {
        let result: unknown = null;
        if (message.method === "workspace/configuration")
          result = message.params.items.map(() => ({}));
        if (message.method === "workspace/workspaceFolders")
          result = [{ uri: this.rootUri, name: "practice" }];
        this.send({ id: message.id, result });
      } else if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (pending) {
          this.pending.delete(message.id);
          clearTimeout(pending.timer);
          if (message.error) pending.reject(new Error(message.error.message));
          else pending.resolve(message.result);
        }
      }
    }
  }

  request(method: string, params: RpcParams): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Language server timed out: ${method}`));
      }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.send({ id, method, params });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  notify(method: string, params: RpcParams) {
    this.send({ method, params });
    const document = params.textDocument;
    if (method === "textDocument/didOpen" && document) {
      this.documents.set(document.uri, structuredClone(document));
    } else if (method === "textDocument/didChange" && document) {
      const current = this.documents.get(document.uri);
      if (current) {
        // The browser bridge sends full-document changes, retaining unsaved text
        // for replay when an idle language server starts again.
        for (const change of params.contentChanges ?? []) {
          if (!change.range) current.text = change.text;
        }
        current.version = document.version;
      }
    } else if (method === "textDocument/didClose" && document) {
      this.documents.delete(document.uri);
      this.diagnostics.delete(document.uri);
    }
  }

  async initialize() {
    await this.request("initialize", {
      processId: process.pid,
      rootUri: this.rootUri,
      workspaceFolders: [{ uri: this.rootUri, name: "practice" }],
      capabilities: {
        workspace: { configuration: true, workspaceFolders: true },
        textDocument: {
          synchronization: { didSave: true },
          completion: {
            completionItem: {
              snippetSupport: false,
              documentationFormat: ["plaintext"],
            },
          },
          hover: { contentFormat: ["plaintext"] },
          publishDiagnostics: { relatedInformation: true },
        },
      },
      initializationOptions: {
        workspaceFolders: [this.rootUri],
        usePlaceholders: false,
        completeUnimported: true,
      },
    });
    this.notify("initialized", {});
  }

  dispose() {
    this.disposed = true;
    this.documents.clear();
    this.stopProcess();
    this.fail(new Error("Session closed"));
  }
}
