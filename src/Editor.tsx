import { usePreferences } from "./preferences";
import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import { GoLanguageService, type PracticeFile, type Session } from "./lsp";
import { fontFamilyFor, registerEditorThemes } from "./editorThemes";

// Bundle Monaco's worker with the application; no network-loaded editor or AI services.
(globalThis as any).MonacoEnvironment = { getWorker: () => new EditorWorker() };
// Assistance comes from the connected language server, avoiding duplicate TS suggestions.
monaco.typescript.typescriptDefaults.setModeConfiguration({
  completionItems: false,
  hovers: false,
  documentSymbols: false,
  definitions: false,
  references: false,
  documentHighlights: false,
  rename: false,
  documentRangeFormattingEdits: false,
  diagnostics: false,
  onTypeFormattingEdits: false,
  codeActions: false,
  signatureHelp: false,
});
registerEditorThemes(monaco);

type Props = {
  session: Session;
  files: PracticeFile[];
  activePath: string;
  onChange: (path: string, value: string) => void;
  onStatus?: (status: string) => void;
  locked?: boolean;
};

export default function Editor({
  session,
  files,
  activePath,
  onChange,
  onStatus,
  locked = false,
}: Props) {
  const { t, resolvedEditorTheme, editorFontSize, editorFontFamily } =
    usePreferences();
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const languageService = useRef<GoLanguageService | null>(null);
  const models = useRef(new Map<string, monaco.editor.ITextModel>());
  const listeners = useRef(new Map<string, monaco.IDisposable>());
  const savedViews = useRef(
    new Map<string, monaco.editor.ICodeEditorViewState | null>(),
  );
  const active = useRef(activePath);
  const callbacks = useRef({ onChange, onStatus });
  callbacks.current = { onChange, onStatus };
  const latestFiles = useRef(files);
  latestFiles.current = files;
  const latestAppearance = useRef({
    resolvedEditorTheme,
    editorFontSize,
    editorFontFamily,
  });
  latestAppearance.current = {
    resolvedEditorTheme,
    editorFontSize,
    editorFontFamily,
  };

  useEffect(() => {
    if (!container.current) return;
    const service = new GoLanguageService(session, (status) =>
      callbacks.current.onStatus?.(status),
    );
    languageService.current = service;
    const {
      resolvedEditorTheme: initialTheme,
      editorFontSize: initialFontSize,
      editorFontFamily: initialFontFamily,
    } = latestAppearance.current;
    const instance = monaco.editor.create(container.current, {
      theme: initialTheme,
      language: session.language || "go",
      automaticLayout: true,
      fontFamily: fontFamilyFor(initialFontFamily),
      fontSize: initialFontSize,
      fontLigatures: true,
      lineHeight: Math.round(initialFontSize * 1.7),
      padding: { top: 22, bottom: 22 },
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      renderLineHighlight: "line",
      lineNumbersMinChars: 4,
      folding: true,
      bracketPairColorization: { enabled: true },
      tabSize: 4,
      insertSpaces: false,
      inlineSuggest: { enabled: false },
      wordBasedSuggestions: "off",
      quickSuggestions: { other: true, comments: false, strings: false },
      suggest: { showWords: false, preview: false },
      contextmenu: true,
    });
    editor.current = instance;
    service.register();
    return () => {
      service.dispose();
      listeners.current.forEach((listener) => listener.dispose());
      listeners.current.clear();
      instance.dispose();
      models.current.forEach((model) => model.dispose());
      models.current.clear();
      savedViews.current.clear();
      editor.current = null;
      languageService.current = null;
    };
  }, [session.sessionId]);

  useEffect(() => {
    monaco.editor.setTheme(resolvedEditorTheme);
  }, [resolvedEditorTheme]);

  useEffect(() => {
    editor.current?.updateOptions({
      fontSize: editorFontSize,
      lineHeight: Math.round(editorFontSize * 1.7),
      fontFamily: fontFamilyFor(editorFontFamily),
    });
  }, [editorFontSize, editorFontFamily]);

  // Reconcile models before selecting the active file, so newly created files
  // open immediately without resetting the editor or the language-server session.
  useEffect(() => {
    const service = languageService.current;
    if (!service) return;
    for (const file of files) {
      const existing = models.current.get(file.path);
      if (existing) {
        if (existing.getValue() !== file.content)
          existing.setValue(file.content);
        continue;
      }
      const uri = monaco.Uri.parse(service.uri(file.path));
      const language = file.path.endsWith(".go")
        ? "go"
        : file.path.endsWith(".py")
          ? "python"
          : file.path.endsWith(".ts")
            ? "typescript"
            : file.path.endsWith(".json")
              ? "plaintext"
              : "plaintext";
      const model = monaco.editor.createModel(file.content, language, uri);
      models.current.set(file.path, model);
      service.open(model);
      listeners.current.set(
        file.path,
        model.onDidChangeContent(() => {
          if (
            latestFiles.current.find((value) => value.path === file.path)
              ?.readOnly ??
            true
          )
            return;
          service.change(model);
          callbacks.current.onChange(file.path, model.getValue());
        }),
      );
    }
  }, [files, session.sessionId]);

  useEffect(() => {
    const instance = editor.current;
    if (!instance) return;
    if (active.current !== activePath)
      savedViews.current.set(active.current, instance.saveViewState());
    active.current = activePath;
    const model = models.current.get(activePath);
    if (!model) return;
    const switchingFile = instance.getModel() !== model;
    if (switchingFile) instance.setModel(model);
    instance.updateOptions({
      readOnly:
        locked ||
        (files.find((file) => file.path === activePath)?.readOnly ?? false),
    });
    const view = savedViews.current.get(activePath);
    if (switchingFile && view) instance.restoreViewState(view);
  }, [activePath, session.sessionId, files, locked]);

  return (
    <div
      ref={container}
      className="monaco-container"
      style={{ height: "100%", width: "100%", minHeight: 0 }}
      aria-label={t("Code editor")}
    />
  );
}
