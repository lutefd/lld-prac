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
  constructor(rootUri: string, command = "gopls", args = ["serve"]) {
    this.rootUri = rootUri;
    this.sequence = 0;
    this.pending = new Map();
    this.diagnostics = new Map();
    this.buffer = Buffer.alloc(0);
    this.process = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    this.process.stdin.on("error", (error) => this.fail(error));
    this.process.stdout.on("data", (chunk) => this.receive(chunk));
    this.process.stderr.on("data", () => {});
    this.process.on("error", (error) => this.fail(error));
    this.process.on("exit", () =>
      this.fail(new Error("Language server exited")),
    );
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
        usePlaceholders: false,
        completeUnimported: true,
      },
    });
    this.notify("initialized", {});
  }

  dispose() {
    this.process.kill();
    this.fail(new Error("Session closed"));
  }
}
