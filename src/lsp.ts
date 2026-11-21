import * as monaco from "monaco-editor";

export type Session = {
  sessionId: string;
  rootUri: string;
  lspAvailable: boolean;
  language?: "go" | "python" | "typescript";
};
export type PracticeFile = { path: string; content: string; readOnly: boolean };
type LspRange = {
  start: { line: number; character: number };
  end: { line: number; character: number };
};

export const fromRange = (range: LspRange): monaco.IRange => ({
  startLineNumber: range.start.line + 1,
  startColumn: range.start.character + 1,
  endLineNumber: range.end.line + 1,
  endColumn: range.end.character + 1,
});
const position = (value: monaco.Position) => ({
  line: value.lineNumber - 1,
  character: value.column - 1,
});
const markdown = (value: any): monaco.IMarkdownString[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(markdown);
  if (typeof value === "string") return [{ value }];
  return [
    {
      value: value.language
        ? `\`\`\`${value.language}\n${value.value}\n\`\`\``
        : value.value || "",
    },
  ];
};
const completionKinds: Record<number, monaco.languages.CompletionItemKind> = {
  1: monaco.languages.CompletionItemKind.Text,
  2: monaco.languages.CompletionItemKind.Method,
  3: monaco.languages.CompletionItemKind.Function,
  4: monaco.languages.CompletionItemKind.Constructor,
  5: monaco.languages.CompletionItemKind.Field,
  6: monaco.languages.CompletionItemKind.Variable,
  7: monaco.languages.CompletionItemKind.Class,
  8: monaco.languages.CompletionItemKind.Interface,
  9: monaco.languages.CompletionItemKind.Module,
  10: monaco.languages.CompletionItemKind.Property,
  12: monaco.languages.CompletionItemKind.Value,
  13: monaco.languages.CompletionItemKind.Enum,
  14: monaco.languages.CompletionItemKind.Keyword,
  15: monaco.languages.CompletionItemKind.Snippet,
  21: monaco.languages.CompletionItemKind.Constant,
  22: monaco.languages.CompletionItemKind.Struct,
  25: monaco.languages.CompletionItemKind.TypeParameter,
};

export class GoLanguageService {
  private queue: Promise<unknown> = Promise.resolve();
  private versions = new Map<string, number>();
  private disposed = false;
  private registrations: monaco.IDisposable[] = [];
  private timer?: ReturnType<typeof setInterval>;
  constructor(
    private session: Session,
    private onStatus: (value: string) => void,
  ) {}

  uri(path: string) {
    return `${this.session.rootUri.replace(/\/$/, "")}/${path}`;
  }

  request(method: string, params: unknown): Promise<any> {
    const task = this.queue.then(async () => {
      if (this.disposed) return null;
      const response = await fetch(
        `/api/workspace/${this.session.sessionId}/lsp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method, params }),
        },
      );
      const data = await response.json();
      if (!response.ok || data.error)
        throw new Error(
          data.error?.message || data.error || "Language server unavailable",
        );
      return Object.prototype.hasOwnProperty.call(data, "result")
        ? data.result
        : data;
    });
    this.queue = task.catch(() => undefined);
    return task;
  }

  open(model: monaco.editor.ITextModel) {
    if (
      !this.session.lspAvailable ||
      !["go", "python", "typescript"].includes(model.getLanguageId())
    )
      return;
    const uri = model.uri.toString();
    this.versions.set(uri, 1);
    this.request("textDocument/didOpen", {
      textDocument: {
        uri,
        languageId: model.getLanguageId(),
        version: 1,
        text: model.getValue(),
      },
    }).catch(() => this.onStatus("Language server disconnected"));
  }

  change(model: monaco.editor.ITextModel) {
    if (
      !this.session.lspAvailable ||
      !["go", "python", "typescript"].includes(model.getLanguageId())
    )
      return;
    const uri = model.uri.toString();
    const version = (this.versions.get(uri) || 1) + 1;
    this.versions.set(uri, version);
    this.request("textDocument/didChange", {
      textDocument: { uri, version },
      contentChanges: [{ text: model.getValue() }],
    }).catch(() => this.onStatus("Language server disconnected"));
  }

  close(model: monaco.editor.ITextModel) {
    const uri = model.uri.toString();
    monaco.editor.setModelMarkers(model, "practice-lsp", []);
    if (!this.versions.delete(uri) || !this.session.lspAvailable) return;
    this.request("textDocument/didClose", {
      textDocument: { uri },
    }).catch(() => undefined);
  }

  register() {
    const serverName =
      this.session.language === "python"
        ? "Pyright"
        : this.session.language === "typescript"
          ? "TypeScript LSP"
          : "gopls";
    if (!this.session.lspAvailable) {
      this.onStatus(`${serverName} unavailable`);
      return;
    }
    this.onStatus(`${serverName} connected`);
    const language = this.session.language || "go";
    const owns = (model: monaco.editor.ITextModel) =>
      this.versions.has(model.uri.toString());
    const params = (
      model: monaco.editor.ITextModel,
      value: monaco.Position,
    ) => ({
      textDocument: { uri: model.uri.toString() },
      position: position(value),
    });
    this.registrations.push(
      monaco.languages.registerCompletionItemProvider(language, {
        triggerCharacters: ["."],
        provideCompletionItems: async (model, value, context, token) => {
          if (!owns(model)) return { suggestions: [] };
          try {
            const result = await this.request("textDocument/completion", {
              ...params(model, value),
              context: {
                triggerKind: context.triggerKind + 1,
                triggerCharacter: context.triggerCharacter,
              },
            });
            if (token.isCancellationRequested || !result)
              return { suggestions: [] };
            const word = model.getWordUntilPosition(value);
            const fallback = {
              startLineNumber: value.lineNumber,
              endLineNumber: value.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn,
            };
            return {
              incomplete: result.isIncomplete,
              suggestions: (Array.isArray(result)
                ? result
                : result.items || []
              ).map((item: any) => ({
                label: item.label,
                kind:
                  completionKinds[item.kind] ??
                  monaco.languages.CompletionItemKind.Text,
                detail: item.detail,
                documentation: markdown(item.documentation)[0],
                sortText: item.sortText,
                filterText: item.filterText,
                insertText:
                  item.textEdit?.newText ?? item.insertText ?? item.label,
                range: item.textEdit?.range
                  ? fromRange(item.textEdit.range)
                  : item.textEdit?.replace
                    ? fromRange(item.textEdit.replace)
                    : fallback,
                insertTextRules:
                  item.insertTextFormat === 2
                    ? monaco.languages.CompletionItemInsertTextRule
                        .InsertAsSnippet
                    : undefined,
                additionalTextEdits: item.additionalTextEdits?.map(
                  (edit: any) => ({
                    range: fromRange(edit.range),
                    text: edit.newText,
                  }),
                ),
                lspItem: item,
              })),
            };
          } catch {
            return { suggestions: [] };
          }
        },
        resolveCompletionItem: async (suggestion, token) => {
          const raw = (suggestion as any).lspItem;
          if (!raw?.data || token.isCancellationRequested) return suggestion;
          try {
            const item = await this.request("completionItem/resolve", raw);
            if (!item || token.isCancellationRequested) return suggestion;
            return {
              ...suggestion,
              detail: item.detail ?? suggestion.detail,
              documentation:
                markdown(item.documentation)[0] ?? suggestion.documentation,
              additionalTextEdits:
                item.additionalTextEdits?.map((edit: any) => ({
                  range: fromRange(edit.range),
                  text: edit.newText,
                })) ?? suggestion.additionalTextEdits,
            };
          } catch {
            return suggestion;
          }
        },
      }),
    );
    this.registrations.push(
      monaco.languages.registerHoverProvider(language, {
        provideHover: async (model, value, token) => {
          if (!owns(model)) return null;
          try {
            const result = await this.request(
              "textDocument/hover",
              params(model, value),
            );
            if (!result || token.isCancellationRequested) return null;
            return {
              contents: markdown(result.contents),
              range: result.range ? fromRange(result.range) : undefined,
            };
          } catch {
            return null;
          }
        },
      }),
    );
    this.registrations.push(
      monaco.languages.registerSignatureHelpProvider(language, {
        signatureHelpTriggerCharacters: ["(", ","],
        signatureHelpRetriggerCharacters: [","],
        provideSignatureHelp: async (model, value, token) => {
          if (!owns(model)) return null;
          try {
            const result = await this.request(
              "textDocument/signatureHelp",
              params(model, value),
            );
            if (!result || token.isCancellationRequested) return null;
            return {
              value: {
                activeSignature: result.activeSignature ?? 0,
                activeParameter: result.activeParameter ?? 0,
                signatures: (result.signatures || []).map((item: any) => ({
                  label: item.label,
                  documentation: markdown(item.documentation)[0],
                  parameters: (item.parameters || []).map((parameter: any) => ({
                    label: parameter.label,
                    documentation: markdown(parameter.documentation)[0],
                  })),
                })),
              },
              dispose() {},
            };
          } catch {
            return null;
          }
        },
      }),
    );
    this.registrations.push(
      monaco.languages.registerDefinitionProvider(language, {
        provideDefinition: async (model, value, token) => {
          if (!owns(model)) return null;
          try {
            const result = await this.request(
              "textDocument/definition",
              params(model, value),
            );
            if (!result || token.isCancellationRequested) return null;
            return (Array.isArray(result) ? result : [result]).map(
              (location: any) => ({
                uri: monaco.Uri.parse(location.uri || location.targetUri),
                range: fromRange(
                  location.range || location.targetSelectionRange,
                ),
              }),
            );
          } catch {
            return null;
          }
        },
      }),
    );
    this.registrations.push(
      monaco.languages.registerDocumentFormattingEditProvider(language, {
        provideDocumentFormattingEdits: async (model, options, token) => {
          if (!owns(model)) return [];
          try {
            const result = await this.request("textDocument/formatting", {
              textDocument: { uri: model.uri.toString() },
              options,
            });
            if (!result || token.isCancellationRequested) return [];
            return result.map((edit: any) => ({
              range: fromRange(edit.range),
              text: edit.newText,
            }));
          } catch {
            return [];
          }
        },
      }),
    );
    const refresh = async () => {
      if (document.hidden || this.disposed) return;
      try {
        const response = await fetch(
          `/api/workspace/${this.session.sessionId}/diagnostics`,
        );
        if (!response.ok || this.disposed) return;
        const data = await response.json();
        if (this.disposed) return;
        for (const report of data.diagnostics || []) {
          const model = monaco.editor.getModel(monaco.Uri.parse(report.uri));
          if (!model || !owns(model)) continue;
          monaco.editor.setModelMarkers(
            model,
            "practice-lsp",
            report.diagnostics.map((item: any) => ({
              ...fromRange(item.range),
              message: item.message,
              source: item.source || serverName,
              code: item.code?.toString(),
              severity:
                item.severity === 1
                  ? monaco.MarkerSeverity.Error
                  : item.severity === 2
                    ? monaco.MarkerSeverity.Warning
                    : item.severity === 4
                      ? monaco.MarkerSeverity.Hint
                      : monaco.MarkerSeverity.Info,
            })),
          );
        }
      } catch {
        /* Keep editing available if the local server restarts. */
      }
    };
    this.timer = setInterval(refresh, 1500);
    void refresh();
  }

  dispose() {
    if (this.timer) clearInterval(this.timer);
    this.registrations.forEach((value) => value.dispose());
    // Queue closes before disabling transport, preserving outstanding document updates.
    for (const uri of this.versions.keys())
      void this.request("textDocument/didClose", {
        textDocument: { uri },
      }).catch(() => undefined);
    void this.queue.finally(() => {
      this.disposed = true;
    });
  }
}
