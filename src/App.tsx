import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  Clock3,
  Code2,
  FileCode2,
  Files,
  FlaskConical,
  FolderOpen,
  LoaderCircle,
  LockKeyhole,
  PanelLeftClose,
  PanelBottomClose,
  LibraryBig,
  Map as MapIcon,
  Pause,
  Plus,
  Play,
  RotateCcw,
  Search,
  SquareTerminal,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import Editor from "./Editor";
import PanelDivider from "./PanelDivider";
import Roadmap from "./Roadmap";
import { followLink, practiceUrl } from "./navigation";
import type { CSSProperties } from "react";
import { usePreferences, PreferencesControls } from "./preferences";
import { localizeProblem } from "./problemTranslations";

type Language = "go" | "python" | "typescript" | "java";
type File = {
  path: string;
  content: string;
  readOnly: boolean;
  userCreated?: boolean;
};
type Problem = {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  duration: number;
  summary: string;
  tags: string[];
  levels: {
    title: string;
    description: string;
    requirements: string[];
    examples: { input: string; output: string }[];
  }[];
};
type Session = {
  sessionId: string;
  rootUri: string;
  lspAvailable: boolean;
  language: Language;
};
type Run = {
  passed: boolean;
  output: string;
  durationMs: number;
  error?: string;
};
const languageNames = {
  go: "Go",
  python: "Python",
  typescript: "TypeScript",
  java: "Java",
};
const read = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or private-mode errors.
  }
};
async function api<T = unknown>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(
    `/api${path}`,
    body === undefined
      ? { signal }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal,
        },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}
export default function App() {
  const { t, locale } = usePreferences();
  const [route, setRoute] = useState(() => location.pathname);
  useEffect(() => {
    const navigate = () => setRoute(location.pathname);
    window.addEventListener("popstate", navigate);
    return () => window.removeEventListener("popstate", navigate);
  }, []);
  const [rawProblems, setProblems] = useState<Problem[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    api<{ problems: Problem[] }>("/problems")
      .then((data) => setProblems(data.problems))
      .catch((e) => setError(e.message));
  }, []);
  const problems = rawProblems.map((problem) =>
    localizeProblem(problem, locale),
  );
  if (!problems.length)
    return (
      <div className="editor-loading" style={{ height: "100dvh" }}>
        <PreferencesControls />
        <Code2 size={32} />
        <strong>
          {error
            ? t("Couldn’t connect to the practice server")
            : t("Opening your workbench…")}
        </strong>
        {error && (
          <>
            <p>{t(error)}</p>
            <button className="secondary" onClick={() => location.reload()}>
              {t("Reconnect")}
            </button>
          </>
        )}
      </div>
    );
  const pathname = route.replace(/\/+$/, "") || "/";
  if (pathname === "/" || pathname === "/roadmap")
    return <Roadmap problems={problems} />;
  let problemId = "";
  try {
    const match = pathname.match(/^\/practice\/([^/]+)$/);
    if (match) problemId = decodeURIComponent(match[1]);
  } catch {
    // Malformed percent-encoding falls through to the not-found view.
  }
  const problem = problems.find((p) => p.id === problemId);
  if (!problem)
    return (
      <main className="roadmap-page">
        <PreferencesControls />
        <header className="roadmap-intro">
          <h1>{t("Exercise not found")}</h1>
          <p>
            {t(
              "This URL does not match an exercise. Choose your next case from the roadmap.",
            )}
          </p>
          <a className="roadmap-link" href="/" onClick={followLink}>
            {t("Practice roadmap")} <ArrowUpRight size={14} />
          </a>
        </header>
      </main>
    );
  return <Workspace key={problem.id} problems={problems} problem={problem} />;
}
function Workspace({
  problems,
  problem,
}: {
  problems: Problem[];
  problem: Problem;
}) {
  const { t } = usePreferences();
  const [language, setLanguage] = useState<Language>(() =>
    read("workbench.language", "go"),
  );
  const [session, setSession] = useState<Session | null>(null),
    [files, setFiles] = useState<File[]>([]),
    [activePath, setActivePath] = useState("");
  const [level, setLevel] = useState(1),
    [unlocked, setUnlocked] = useState(1),
    [run, setRun] = useState<Run | null>(null),
    [running, setRunning] = useState(false);
  const [error, setError] = useState(""),
    [status, setStatus] = useState("Connecting"),
    [saved, setSaved] = useState(true),
    [requirements, setRequirements] = useState(() =>
      read("workbench.panels.requirements", true),
    ),
    [explorer, setExplorer] = useState(() =>
      read("workbench.panels.explorer", true),
    );
  const [consoleOpen, setConsoleOpen] = useState(() =>
    read("workbench.panels.console", true),
  );
  const [panelSizes, setPanelSizes] = useState(() =>
    read("workbench.panels.sizes", {
      requirements: 355,
      explorer: 195,
      console: 235,
    }),
  );
  const [showTimer, setShowTimer] = useState(() =>
    read("workbench.timer.visible", true),
  );
  useEffect(() => write("workbench.timer.visible", showTimer), [showTimer]);
  const workspaceRef = useRef<HTMLElement>(null);
  const codingRef = useRef<HTMLElement>(null);
  const codingBodyRef = useRef<HTMLDivElement>(null);
  const sizePanel = (panel: keyof typeof panelSizes, size: number) =>
    setPanelSizes((current) => ({ ...current, [panel]: size }));
  useEffect(() => {
    write("workbench.panels.requirements", requirements);
    write("workbench.panels.explorer", explorer);
    write("workbench.panels.console", consoleOpen);
    write("workbench.panels.sizes", panelSizes);
  }, [requirements, explorer, consoleOpen, panelSizes]);
  const [library, setLibrary] = useState(false),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All exercises"),
    [consoleTab, setConsoleTab] = useState<"results" | "console">("console");
  const [timer, setTimer] = useState(false),
    [seconds, setSeconds] = useState(0),
    [resetConfirm, setResetConfirm] = useState(false),
    [revision, setRevision] = useState(0);
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFilePath, setNewFilePath] = useState("");
  const [newFileError, setNewFileError] = useState("");
  const [creatingFile, setCreatingFile] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState(false);
  const [deleteFileError, setDeleteFileError] = useState("");
  const openNewFile = () => {
    setNewFilePath("");
    setNewFileError("");
    setNewFileOpen(true);
  };
  const openDeleteFile = (path: string) => {
    setDeleteFileError("");
    setDeleteTarget(path);
  };
  const generation = useRef(0),
    saveGeneration = useRef(0);
  const runningRequest = useRef<AbortController | null>(null);
  const draftKey = `workbench.draft.${problem.id}.${language}`;
  const progressKey = `workbench.progress.${problem.id}.${language}`;
  useEffect(() => {
    write("workbench.problem", problem.id);
    write("workbench.language", language);
    const gen = ++generation.current;
    let cancelled = false;
    let openedId: string | undefined;
    setRunning(false);
    setSession(null);
    setFiles([]);
    setDeleteTarget(null);
    setDeleteFileError("");
    setError("");
    setRun(null);
    setSeconds(0);
    setTimer(false);
    setStatus("Connecting");
    const progress = read(progressKey, 1);
    setUnlocked(progress);
    setLevel(Math.min(progress, problem.levels.length));
    api<Session & { files: File[] }>("/workspace", {
      problemId: problem.id,
      language,
      files: read(draftKey, []),
    })
      .then((data) => {
        openedId = data.sessionId;
        if (cancelled || gen !== generation.current) {
          void fetch(`/api/workspace/${openedId}`, { method: "DELETE" });
          return;
        }
        setSession({ ...data, language });
        setFiles(data.files);
        setActivePath(
          data.files.find((f: File) => !f.readOnly)?.path ||
            data.files[0]?.path ||
            "",
        );
        setSaved(true);
        setStatus(
          data.lspAvailable
            ? "Language server ready"
            : "Language server unavailable",
        );
      })
      .catch((e) => {
        if (!cancelled && gen === generation.current) setError(e.message);
      });
    return () => {
      cancelled = true;
      runningRequest.current?.abort();
      runningRequest.current = null;
      if (openedId)
        void fetch(`/api/workspace/${openedId}`, { method: "DELETE" });
    };
  }, [
    problem.id,
    problem.levels.length,
    language,
    revision,
    draftKey,
    progressKey,
  ]);
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [timer]);
  const change = useCallback(
    (path: string, content: string) => {
      setFiles((current) => {
        const next = current.map((f) =>
          f.path === path ? { ...f, content } : f,
        );
        write(
          draftKey,
          next.filter((f) => !f.readOnly),
        );
        return next;
      });
      setSaved(false);
    },
    [draftKey],
  );
  useEffect(() => {
    if (!session || saved || running) return;
    const save = ++saveGeneration.current;
    const id = setTimeout(() => {
      api(`/workspace/${session.sessionId}/files`, {
        files: files.filter((f) => !f.readOnly),
      })
        .then(() => {
          if (save === saveGeneration.current) setSaved(true);
        })
        .catch((e) => setError(e.message));
    }, 650);
    return () => clearTimeout(id);
  }, [files, session, saved, running]);
  const runTests = useCallback(async () => {
    if (!session || running) return;
    const gen = generation.current;
    const controller = new AbortController();
    runningRequest.current = controller;
    setRunning(true);
    setConsoleOpen(true);
    setRun(null);
    setError("");
    setConsoleTab("console");
    try {
      const result = await api<Run>(
        `/workspace/${session.sessionId}/run`,
        { level, files: files.filter((f) => !f.readOnly) },
        controller.signal,
      );
      if (gen !== generation.current) return;
      setRun(result);
      if (result.passed) {
        const next = Math.min(level + 1, problem.levels.length + 1);
        setUnlocked((u) => Math.max(u, next));
        write(progressKey, Math.max(unlocked, next));
      }
    } catch (e) {
      if (gen === generation.current) setError((e as Error).message);
    } finally {
      if (gen === generation.current) {
        runningRequest.current = null;
        setRunning(false);
      }
    }
  }, [
    session,
    running,
    level,
    files,
    problem.levels.length,
    progressKey,
    unlocked,
  ]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void runTests();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [runTests]);
  const createFile = async () => {
    if (!session || creatingFile) return;
    const path = newFilePath.trim();
    if (!path) {
      setNewFileError("Enter a file path.");
      return;
    }
    const gen = generation.current;
    setCreatingFile(true);
    setNewFileError("");
    try {
      const content =
        language === "go"
          ? "package practice\n\n"
          : language === "python"
            ? "# Add your code here.\n"
            : "// Add your code here.\n";
      const { file } = await api<{ file: File }>(
        `/workspace/${session.sessionId}/create-file`,
        { path, content },
      );
      if (gen !== generation.current) return;
      setFiles((current) => {
        const next = [...current, file];
        write(
          draftKey,
          next.filter((f) => !f.readOnly),
        );
        return next;
      });
      setActivePath(file.path);
      setNewFileOpen(false);
    } catch (error) {
      setNewFileError((error as Error).message);
    } finally {
      setCreatingFile(false);
    }
  };
  const deleteFile = async () => {
    if (!session || !deleteTarget || deletingFile) return;
    const target = deleteTarget;
    const gen = generation.current;
    setDeletingFile(true);
    setDeleteFileError("");
    try {
      await api(`/workspace/${session.sessionId}/delete-file`, {
        path: target,
      });
      if (gen !== generation.current) return;
      let fallbackPath = "";
      setFiles((current) => {
        const next = current.filter((f) => f.path !== target);
        write(
          draftKey,
          next.filter((f) => !f.readOnly),
        );
        fallbackPath =
          next.find((f) => !f.readOnly)?.path || next[0]?.path || "";
        return next;
      });
      setActivePath((current) => (current === target ? fallbackPath : current));
      setDeleteTarget(null);
    } catch (error) {
      setDeleteFileError((error as Error).message);
    } finally {
      setDeletingFile(false);
    }
  };
  const activeFile = files.find((f) => f.path === activePath);
  const runnerCommand =
    language === "go"
      ? "go test -v"
      : language === "python"
        ? "python -m unittest -v"
        : language === "java"
          ? "javac + java"
          : "node --test";
  const selectedLevel = problem.levels[level - 1];
  const elapsed = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const testLines =
    run?.output
      .split("\n")
      .filter((line) =>
        /^--- (PASS|FAIL):|^# (Subtest:|pass |fail )|^test_|^Ran \d|^OK$|^FAILED/.test(
          line,
        ),
      ) || [];
  const filtered = problems.filter(
    (p) =>
      (category === "All exercises" || p.category === category) &&
      `${p.title} ${p.summary} ${p.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="app-shell">
      <header className="workspace-toolbar">
        <div className="problem-heading">
          <button
            className="brand-button"
            onClick={() => setLibrary(true)}
            aria-label={t("Open exercise library")}
            title={t("Exercise library")}
          >
            <Code2 size={17} />
          </button>
          <a
            className="icon-button roadmap-shortcut"
            href="/"
            onClick={followLink}
            aria-label={t("Practice roadmap")}
            title={t("Practice roadmap")}
          >
            <MapIcon size={16} />
          </a>
          <span className="toolbar-divider" />
          <h1 title={problem.title}>{problem.title}</h1>
          <span className={`difficulty ${problem.difficulty.toLowerCase()}`}>
            {t(problem.difficulty)}
          </span>
        </div>
        <div className="workspace-actions">
          {showTimer && (
            <button
              className={`timer ${timer ? "active" : ""}`}
              onClick={() => setTimer((t) => !t)}
              title={t("Start or pause practice timer")}
              aria-label={t("Start or pause practice timer")}
            >
              {timer ? <Pause size={13} /> : <Clock3 size={14} />}
              <span>{elapsed}</span>
            </button>
          )}
          <label className="language-select">
            <select
              aria-label={t("Programming language")}
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
            >
              {Object.entries(languageNames).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown size={13} />
          </label>
          <PreferencesControls
            extra={(close) => (
              <>
                <label className="settings-toggle">
                  <span>
                    {t("Practice timer")}
                    <small>{t("Show a pausable timer in the toolbar.")}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={showTimer}
                    onChange={(e) => {
                      setShowTimer(e.target.checked);
                      if (!e.target.checked) setTimer(false);
                    }}
                  />
                </label>
                <div className="settings-actions">
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      setLibrary(true);
                    }}
                  >
                    <LibraryBig size={14} />
                    {t("Exercise library")}
                  </button>
                  <a
                    href="/"
                    onClick={(event) => {
                      close();
                      followLink(event);
                    }}
                  >
                    <MapIcon size={14} />
                    {t("Practice roadmap")}
                  </a>
                  <button
                    type="button"
                    className="danger"
                    disabled={!session || running}
                    onClick={() => {
                      close();
                      setResetConfirm(true);
                    }}
                  >
                    <RotateCcw size={14} />
                    {t("Reset this language's solution")}
                  </button>
                </div>
              </>
            )}
          />
          <button
            className="primary run-button"
            onClick={() => void runTests()}
            disabled={!session || running}
            title={t("Run tests") + " (⌘ ↵)"}
          >
            {running ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <Play size={13} fill="currentColor" />
            )}
            <span className="run-label">
              {running ? t("Queued or running…") : t("Run tests")}
            </span>
            <kbd>⌘ ↵</kbd>
          </button>
        </div>
      </header>
      <main
        ref={workspaceRef}
        style={
          {
            "--requirements-width": `${panelSizes.requirements}px`,
            "--explorer-width": `${panelSizes.explorer}px`,
            "--console-height": `${panelSizes.console}px`,
          } as CSSProperties
        }
        className={`workspace ${requirements ? "" : "requirements-hidden"} ${explorer ? "" : "explorer-hidden"}`}
      >
        {requirements && (
          <aside className="requirements-panel">
            <div className="panel-heading">
              <span>
                <BookOpen size={16} />
                {t("Requirements")}
              </span>
              <button
                className="icon-button"
                title={t("Collapse requirements")}
                onClick={() => setRequirements(false)}
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
            <div className="requirements-scroll">
              <div className="exercise-meta">
                <span className="topic-tag">{t(problem.category)}</span>
                {problem.tags.slice(0, 2).map((tag) => (
                  <span className="topic-tag subtle" key={tag}>
                    {tag}
                  </span>
                ))}
                <span className="exercise-duration">
                  <Clock3 size={12} /> {problem.duration} min
                </span>
              </div>
              <p className="summary">{problem.summary}</p>
              <div className="progress-label">
                <span>{t("YOUR PROGRESSION")}</span>
                <span>
                  {Math.min(unlocked - 1, problem.levels.length)} /{" "}
                  {problem.levels.length}
                </span>
              </div>
              <div className="level-navigation">
                {problem.levels.map((l, i) => (
                  <button
                    key={l.title}
                    aria-label={t("Level {level}", { level: i + 1 })}
                    disabled={i + 1 > unlocked || running}
                    className={
                      level === i + 1
                        ? "selected"
                        : i + 1 < unlocked
                          ? "completed"
                          : ""
                    }
                    onClick={() => {
                      setLevel(i + 1);
                      setRun(null);
                    }}
                  >
                    <span className="level-circle">
                      {i + 1 < unlocked ? (
                        <Check size={12} />
                      ) : i + 1 > unlocked ? (
                        <LockKeyhole size={11} />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span>
                      {t("Level")} {i + 1}
                    </span>
                  </button>
                ))}
              </div>
              <div className="level-title">
                <span className="section-number">0{level}</span>
                <h2>{selectedLevel.title}</h2>
              </div>
              <p>{selectedLevel.description}</p>
              {language !== "go" && (
                <div className="language-note">
                  {t(
                    "The contracts use a shared Go-style notation. Keep PascalCase API names and follow your {language} starter for types and return values.",
                    { language: languageNames[language] },
                  )}
                </div>
              )}
              <h3>{t("What to build")}</h3>
              <ul className="requirements-list">
                {selectedLevel.requirements.map((r, i) => (
                  <li key={r}>
                    <span className="requirement-index">{i + 1}</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
              <h3>{t("Examples")}</h3>
              {selectedLevel.examples.map((example, i) => (
                <div className="example" key={i}>
                  <div>
                    <span>{t("INPUT")}</span>
                    <pre>{example.input}</pre>
                  </div>
                  <div>
                    <span>{t("OUTPUT")}</span>
                    <pre>{example.output}</pre>
                  </div>
                </div>
              ))}
              <details className="exercise-details">
                <summary>
                  {t("About this exercise")} <ChevronDown size={13} />
                </summary>
                <p>
                  {t(
                    "Original practice scenario inspired by common ride-hailing and fintech domains. These are not official company interview questions. Monetary amounts use integer cents; time-based exercises use explicit timestamps.",
                  )}
                </p>
              </details>
            </div>
          </aside>
        )}
        {requirements && (
          <PanelDivider
            label={t("Resize requirements")}
            orientation="vertical"
            value={panelSizes.requirements}
            min={220}
            max={() =>
              Math.max(
                220,
                Math.min(
                  (workspaceRef.current?.clientWidth ?? window.innerWidth) *
                    0.45,
                  (workspaceRef.current?.clientWidth ?? window.innerWidth) -
                    (explorer ? panelSizes.explorer : 0) -
                    330,
                ),
              )
            }
            onChange={(value) => sizePanel("requirements", value)}
            onReset={() => sizePanel("requirements", 355)}
          />
        )}
        <section className="coding-area" ref={codingRef}>
          <div className="coding-body" ref={codingBodyRef}>
            {explorer && (
              <aside className="explorer">
                <div className="panel-heading">
                  <span>{t("EXPLORER")}</span>
                  <div className="explorer-actions">
                    <button
                      className="icon-button"
                      title={t("New file")}
                      onClick={openNewFile}
                      disabled={!session || running}
                    >
                      <Plus size={15} />
                    </button>
                    <button
                      className="icon-button"
                      title={t("Collapse file explorer")}
                      onClick={() => setExplorer(false)}
                    >
                      <PanelLeftClose size={14} />
                    </button>
                  </div>
                </div>
                <div className="folder-label">
                  <ChevronDown size={13} />
                  <FolderOpen size={14} />
                  <span>{problem.id}</span>
                </div>
                <div className="file-list">
                  {files.map((file) => (
                    <div
                      className={`file ${file.path === activePath ? "active" : ""}`}
                      key={file.path}
                    >
                      <button
                        type="button"
                        className="file-select"
                        onClick={() => setActivePath(file.path)}
                      >
                        <FileCode2
                          size={14}
                          className={
                            file.path.includes("test")
                              ? "test-file"
                              : "source-file"
                          }
                        />
                        <span>{file.path}</span>
                        {file.readOnly && <LockKeyhole size={10} />}
                      </button>
                      {file.userCreated && (
                        <button
                          type="button"
                          className="icon-button file-delete"
                          title={t("Delete {path}", { path: file.path })}
                          aria-label={t("Delete {path}", { path: file.path })}
                          disabled={!session || running}
                          onClick={() => openDeleteFile(file.path)}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </aside>
            )}
            {explorer && (
              <PanelDivider
                label={t("Resize file explorer")}
                orientation="vertical"
                value={panelSizes.explorer}
                min={130}
                max={() =>
                  Math.max(
                    130,
                    Math.min(
                      (codingBodyRef.current?.clientWidth ?? 800) * 0.4,
                      (codingBodyRef.current?.clientWidth ?? 800) - 325,
                    ),
                  )
                }
                onChange={(value) => sizePanel("explorer", value)}
                onReset={() => sizePanel("explorer", 195)}
              />
            )}
            <div className="editor-area">
              <div className="editor-tabs">
                {!requirements && (
                  <button
                    className="icon-button restore"
                    title={t("Show requirements")}
                    onClick={() => setRequirements(true)}
                  >
                    <BookOpen size={17} />
                  </button>
                )}
                {!explorer && (
                  <button
                    className="icon-button restore"
                    title={t("Show file explorer")}
                    onClick={() => setExplorer(true)}
                  >
                    <Files size={16} />
                  </button>
                )}
                <select
                  className="mobile-file-picker"
                  aria-label={t("Open file")}
                  value={activePath}
                  onChange={(e) => setActivePath(e.target.value)}
                >
                  {files.map((f) => (
                    <option key={f.path} value={f.path}>
                      {f.path}
                      {f.readOnly ? t(" (read only)") : ""}
                    </option>
                  ))}
                </select>
                <div className="active-tab">
                  <FileCode2 size={14} />
                  {activePath || t("Loading workspace…")}
                  {activeFile?.readOnly && <LockKeyhole size={11} />}
                </div>
                <div className="tab-spacer" />
                {activeFile?.userCreated && (
                  <button
                    type="button"
                    className="icon-button delete-file-shortcut"
                    title={t("Delete {path}", { path: activeFile.path })}
                    aria-label={t("Delete {path}", { path: activeFile.path })}
                    onClick={() => openDeleteFile(activeFile.path)}
                    disabled={!session || running}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button
                  className="icon-button new-file-shortcut"
                  title={t("New file")}
                  onClick={openNewFile}
                  disabled={!session || running}
                >
                  <Plus size={15} />
                </button>
                <span className="save-status">
                  {saved ? (
                    <CheckCheck size={13} />
                  ) : (
                    <span className="unsaved-dot" />
                  )}
                  {saved ? t("Saved") : t("Saving…")}
                </span>
              </div>
              {session ? (
                <Editor
                  session={session}
                  files={files}
                  activePath={activePath}
                  locked={running}
                  onChange={change}
                  onStatus={setStatus}
                />
              ) : (
                <div className="editor-loading">
                  {error ? (
                    <>
                      <Terminal size={32} />
                      <strong>{t("Couldn’t open the workspace")}</strong>
                      <p>{t(error)}</p>
                      <button
                        className="secondary"
                        onClick={() => setRevision((r) => r + 1)}
                      >
                        {t("Try again")}
                      </button>
                    </>
                  ) : (
                    <>
                      <LoaderCircle size={28} className="spin" />
                      <span>{t("Preparing your workspace…")}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          {consoleOpen ? (
            <>
              <PanelDivider
                label={t("Resize console")}
                orientation="horizontal"
                value={panelSizes.console}
                min={120}
                max={() =>
                  Math.max(120, (codingRef.current?.clientHeight ?? 600) - 180)
                }
                onChange={(value) => sizePanel("console", value)}
                onReset={() => sizePanel("console", 235)}
              />
              <section className="console-panel" aria-label={t("Test output")}>
                <div className="console-heading">
                  <div className="console-tabs">
                    <button
                      className={consoleTab === "console" ? "selected" : ""}
                      onClick={() => setConsoleTab("console")}
                    >
                      <SquareTerminal size={14} />
                      {t("Console")}
                    </button>
                    <button
                      className={consoleTab === "results" ? "selected" : ""}
                      onClick={() => setConsoleTab("results")}
                    >
                      <FlaskConical size={14} />
                      {t("Test results")}
                      {run && (
                        <span
                          className={`result-dot ${run.passed ? "pass" : "fail"}`}
                        />
                      )}
                    </button>
                  </div>
                  <div className="console-controls">
                    <button
                      className="icon-button"
                      title={t("Collapse console")}
                      onClick={() => setConsoleOpen(false)}
                    >
                      <PanelBottomClose size={15} />
                    </button>
                    {run && <span>{(run.durationMs / 1000).toFixed(2)}s</span>}
                    <button
                      className="icon-button"
                      title={t("Clear output")}
                      onClick={() => {
                        setRun(null);
                        setError("");
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <div className="console-content" aria-live="polite">
                  {running ? (
                    <div className="console-empty">
                      <LoaderCircle size={19} className="spin" />
                      <div>
                        <strong>
                          {t(
                            "Queued or running level {level} checks and your tests…",
                            {
                              level,
                            },
                          )}
                        </strong>
                        <span>
                          {t(
                            "Compiling your solution and evaluating test cases.",
                          )}
                        </span>
                      </div>
                    </div>
                  ) : error ? (
                    <pre className="error-output">{t(error)}</pre>
                  ) : run ? (
                    <>
                      {consoleTab === "results" ? (
                        <div className="test-results">
                          <div
                            className={`result-banner ${run.passed ? "pass" : "fail"}`}
                          >
                            {run.passed ? <Check size={16} /> : <X size={16} />}
                            <strong>
                              {run.passed
                                ? t("All checks passed")
                                : t("Some checks didn’t pass")}
                            </strong>
                            <span>
                              {t("Level")} {level} · {languageNames[language]}
                            </span>
                            {run.passed && level < problem.levels.length && (
                              <button
                                onClick={() => {
                                  setLevel(level + 1);
                                  setRun(null);
                                }}
                              >
                                {t("Continue to level {level}", {
                                  level: level + 1,
                                })}
                                <ArrowUpRight size={13} />
                              </button>
                            )}
                          </div>
                          {testLines.length ? (
                            <pre>{testLines.join("\n")}</pre>
                          ) : (
                            <pre>{run.output}</pre>
                          )}
                        </div>
                      ) : (
                        <pre className="raw-output">
                          {run.output || t("(Runner returned no output)")}
                        </pre>
                      )}
                    </>
                  ) : (
                    <div className="console-empty">
                      <div className="terminal-icon">
                        <Terminal size={21} />
                      </div>
                      <div>
                        <strong>{t("Your next idea starts here.")}</strong>
                        <span>
                          {t(
                            "Runs {command} with the level checks, hidden checks, and your own test files.",
                            { command: runnerCommand },
                          )}
                        </span>
                      </div>
                      <kbd>⌘ Enter</kbd>
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : (
            <div className="console-collapsed">
              <button
                onClick={() => setConsoleOpen(true)}
                title={t("Show console")}
              >
                <SquareTerminal size={14} />
                {t("Show console")}
                <ChevronDown size={13} />
              </button>
              {run && (
                <span className={run.passed ? "pass" : "fail"}>
                  {run.passed
                    ? t("All checks passed")
                    : t("Some checks didn’t pass")}
                </span>
              )}
            </div>
          )}
          <footer className="editor-status">
            <span>
              <span
                className={`dot ${session?.lspAvailable ? "" : "offline"}`}
              />
              {t(status)}
            </span>
            <span className="status-right">
              <span>
                {activeFile?.readOnly && <LockKeyhole size={11} />}
                {activeFile?.readOnly ? t("Read only") : t("Editable")}
              </span>
              <span>{languageNames[language]}</span>
            </span>
          </footer>
        </section>
      </main>
      {library && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setLibrary(false);
          }}
        >
          <section
            className="library-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("Exercise library")}
          >
            <header className="library-header">
              <div>
                <span className="eyebrow">{t("THE PRACTICE ROOM")}</span>
                <h2>{t("A little practice. A better design.")}</h2>
                <p>
                  {t(
                    "Real-world systems, small steps. Pick your next challenge.",
                  )}
                </p>
                <a
                  className="roadmap-link library-roadmap-link"
                  href="/"
                  onClick={followLink}
                >
                  {t("Follow the practice roadmap")} <ArrowUpRight size={14} />
                </a>
              </div>
              <button
                className="icon-button"
                onClick={() => setLibrary(false)}
                title={t("Close exercise library")}
              >
                <X size={20} />
              </button>
            </header>
            <div className="library-tools">
              <div className="search-input">
                <Search size={17} />
                <input
                  aria-label={t("Search exercises")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("Search exercises, concepts, systems…")}
                />
              </div>
              <span>
                {t("{count} exercises · 4 languages", {
                  count: problems.length,
                })}
              </span>
            </div>
            <div className="category-tabs">
              {[
                "All exercises",
                ...new Set(problems.map((problem) => problem.category)),
              ].map((c) => (
                <button
                  className={category === c ? "selected" : ""}
                  key={c}
                  onClick={() => setCategory(c)}
                >
                  {t(c)}
                </button>
              ))}
            </div>
            <div className="exercise-grid">
              {filtered.map((p) => (
                <a
                  className={`exercise-card ${p.id === problem.id ? "current" : ""}`}
                  key={p.id}
                  href={practiceUrl(p.id)}
                  aria-disabled={running || undefined}
                  onClick={(event) => {
                    if (running) {
                      event.preventDefault();
                      return;
                    }
                    followLink(event);
                    setLibrary(false);
                  }}
                >
                  <div className="card-top">
                    <span className="card-number">
                      {String(problems.indexOf(p) + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`difficulty ${p.difficulty.toLowerCase()}`}
                    >
                      {t(p.difficulty)}
                    </span>
                  </div>
                  <span className="card-category">{t(p.category)}</span>
                  <h3>{p.title}</h3>
                  <p>{p.summary}</p>
                  <div className="card-footer">
                    <span>
                      {p.levels.length} {t("levels")} <span>·</span>{" "}
                      {p.duration} min
                    </span>
                    <ArrowUpRight size={17} />
                  </div>
                </a>
              ))}
              {!filtered.length && (
                <p className="no-results">
                  {t("No exercises match your search.")}
                </p>
              )}
            </div>
            <footer className="library-footer">
              <span>
                <Code2 size={14} />{" "}
                {t("No AI autocomplete. Full language intelligence.")}
              </span>
              <span>Go · Python · TypeScript · Java</span>
            </footer>
          </section>
        </div>
      )}
      {newFileOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creatingFile)
              setNewFileOpen(false);
          }}
        >
          <form
            className="confirm-modal create-file-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("Create file")}
            onSubmit={(event) => {
              event.preventDefault();
              void createFile();
            }}
          >
            <FileCode2 size={25} />
            <h2>{t("Create file")}</h2>
            <label htmlFor="new-file-path">{t("File path")}</label>
            <input
              id="new-file-path"
              autoFocus
              value={newFilePath}
              onChange={(event) => {
                setNewFilePath(event.target.value);
                setNewFileError("");
              }}
              placeholder={
                language === "go"
                  ? "helper.go"
                  : language === "python"
                    ? "helper.py"
                    : language === "java"
                      ? "Helper.java"
                      : "helper.ts"
              }
              autoComplete="off"
              disabled={creatingFile}
            />
            <p>
              {t(
                "Use a relative path ending in {extension}. Folders are created automatically. Extra test files run with Run tests.",
                {
                  extension:
                    language === "go"
                      ? ".go"
                      : language === "python"
                        ? ".py"
                        : language === "java"
                          ? ".java"
                          : ".ts",
                },
              )}
            </p>
            {newFileError && (
              <p className="file-error" role="alert">
                {t(newFileError)}
              </p>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary"
                disabled={creatingFile}
                onClick={() => setNewFileOpen(false)}
              >
                {t("Cancel")}
              </button>
              <button className="primary" type="submit" disabled={creatingFile}>
                {creatingFile ? t("Creating…") : t("Create file")}
              </button>
            </div>
          </form>
        </div>
      )}
      {deleteTarget && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingFile)
              setDeleteTarget(null);
          }}
        >
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("Remove file")}
          >
            <Trash2 size={25} />
            <h2>{t("Remove file?")}</h2>
            <p>
              {t("This permanently deletes {path} from your workspace.", {
                path: deleteTarget,
              })}
            </p>
            {deleteFileError && (
              <p className="file-error" role="alert">
                {t(deleteFileError)}
              </p>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary"
                disabled={deletingFile}
                onClick={() => setDeleteTarget(null)}
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                className="primary"
                disabled={deletingFile}
                onClick={() => void deleteFile()}
              >
                {deletingFile ? t("Removing…") : t("Remove file")}
              </button>
            </div>
          </section>
        </div>
      )}
      {resetConfirm && (
        <div className="modal-backdrop">
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("Reset solution")}
          >
            <RotateCcw size={25} />
            <h2>{t("Start with a clean slate?")}</h2>
            <p>
              {t(
                "This resets your {language} solution, personal tests, and progress for {problem}.",
                { language: languageNames[language], problem: problem.title },
              )}
            </p>
            <div>
              <button
                className="secondary"
                onClick={() => setResetConfirm(false)}
              >
                {t("Keep practicing")}
              </button>
              <button
                className="primary"
                onClick={() => {
                  localStorage.removeItem(draftKey);
                  localStorage.removeItem(progressKey);
                  setResetConfirm(false);
                  setRevision((r) => r + 1);
                }}
              >
                {t("Reset solution")}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
