import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
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
  Play,
  RotateCcw,
  Search,
  SquareTerminal,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import Editor from "./Editor";
import PanelDivider from "./PanelDivider";
import type { CSSProperties } from "react";

type Language = "go" | "python" | "typescript";
type File = { path: string; content: string; readOnly: boolean };
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
const languageNames = { go: "Go", python: "Python", typescript: "TypeScript" };
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
  } catch {}
};
async function api<T = unknown>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    `/api${path}`,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}
export default function App() {
  const [problems, setProblems] = useState<Problem[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    api<{ problems: Problem[] }>("/problems")
      .then((data) => setProblems(data.problems))
      .catch((e) => setError(e.message));
  }, []);
  if (!problems.length)
    return (
      <div className="editor-loading" style={{ height: "100dvh" }}>
        <Code2 size={32} />
        <strong>
          {error
            ? "Couldn’t connect to the practice server"
            : "Opening your workbench…"}
        </strong>
        {error && (
          <>
            <p>{error}</p>
            <button className="secondary" onClick={() => location.reload()}>
              Reconnect
            </button>
          </>
        )}
      </div>
    );
  return <Workspace problems={problems} />;
}
function Workspace({ problems }: { problems: Problem[] }) {
  const [problemId, setProblemId] = useState(() =>
    read("workbench.problem", problems[0].id),
  );
  const problem = problems.find((p) => p.id === problemId) || problems[0];
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
  const generation = useRef(0),
    saveGeneration = useRef(0);
  const draftKey = `workbench.draft.${problem.id}.${language}`;
  const progressKey = `workbench.progress.${problem.id}.${language}`;
  useEffect(() => {
    write("workbench.problem", problem.id);
    write("workbench.language", language);
    const gen = ++generation.current;
    let openedId: string | undefined;
    setSession(null);
    setFiles([]);
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
        if (gen !== generation.current) {
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
        if (gen === generation.current) setError(e.message);
      });
    return () => {
      generation.current++;
      if (openedId)
        void fetch(`/api/workspace/${openedId}`, { method: "DELETE" });
    };
  }, [problem.id, language, revision]);
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
    if (!session || saved) return;
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
  }, [files, session, saved]);
  const runTests = useCallback(async () => {
    if (!session || running) return;
    const gen = generation.current;
    setRunning(true);
    setConsoleOpen(true);
    setRun(null);
    setError("");
    setConsoleTab("console");
    try {
      const result = await api<Run>(`/workspace/${session.sessionId}/run`, {
        level,
        files: files.filter((f) => !f.readOnly),
      });
      if (gen !== generation.current) return;
      setRun(result);
      setSaved(true);
      if (result.passed) {
        const next = Math.min(level + 1, problem.levels.length + 1);
        setUnlocked((u) => Math.max(u, next));
        write(progressKey, Math.max(unlocked, next));
      }
    } catch (e) {
      if (gen === generation.current) setError((e as Error).message);
    } finally {
      setRunning(false);
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
  const activeFile = files.find((f) => f.path === activePath);
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
      <header className="app-header">
        <button
          className="brand"
          onClick={() => setLibrary(true)}
          aria-label="Open exercise library"
        >
          <span className="brand-symbol">
            <Code2 size={22} />
          </span>
          <span>
            workbench<span className="brand-period">.</span>
          </span>
          <span className="local-badge">
            <span />
            LOCAL
          </span>
        </button>
        <div className="header-divider" />
        <button className="breadcrumb" onClick={() => setLibrary(true)}>
          Practice <ChevronRight size={13} /> <span>Low-level design</span>
        </button>
        <div className="header-spacer" />
        <span className="distraction-free">
          <span />
          No AI. Just you and the code.
        </span>
        <a
          className="github-link"
          href="https://github.com/lutefd/lld-prac"
          target="_blank"
          rel="noreferrer"
        >
          GitHub <ArrowUpRight size={14} />
        </a>
      </header>
      <div className="workspace-toolbar">
        <div className="problem-heading">
          <button
            className="icon-button back"
            onClick={() => setLibrary(true)}
            title="Exercise library"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="eyebrow">
              {problem.category} <span>/</span> LLD PRACTICE
            </div>
            <h1>{problem.title}</h1>
          </div>
          <span className={`difficulty ${problem.difficulty.toLowerCase()}`}>
            {problem.difficulty}
          </span>
        </div>
        <div className="workspace-actions">
          <button
            className={`timer ${timer ? "active" : ""}`}
            onClick={() => setTimer((t) => !t)}
            title="Start or pause practice timer"
          >
            <Clock3 size={15} />
            <span>{elapsed}</span>
            <span className="timer-label">
              {timer ? "Pause" : "Start timer"}
            </span>
          </button>
          <span className="vertical-rule" />
          <label className="language-select">
            <Code2 size={16} />
            <select
              aria-label="Programming language"
              value={language}
              disabled={running}
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
          <button
            className="icon-button reset"
            title="Reset this language's solution"
            onClick={() => setResetConfirm(true)}
            disabled={!session || running}
          >
            <RotateCcw size={17} />
          </button>
          <button
            className="primary run-button"
            onClick={() => void runTests()}
            disabled={!session || running}
          >
            {running ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Play size={14} fill="currentColor" />
            )}
            {running ? "Running…" : "Run tests"}
            <kbd>⌘ ↵</kbd>
          </button>
        </div>
      </div>
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
                Requirements
              </span>
              <button
                className="icon-button"
                title="Collapse requirements"
                onClick={() => setRequirements(false)}
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
            <div className="requirements-scroll">
              <div className="exercise-meta">
                <span className="topic-tag">{problem.tags[0]}</span>
                <span>
                  <Clock3 size={12} /> {problem.duration} min
                </span>
              </div>
              <h2>The challenge</h2>
              <p className="summary">{problem.summary}</p>
              <div className="progress-label">
                <span>YOUR PROGRESSION</span>
                <span>
                  {Math.min(unlocked - 1, problem.levels.length)} /{" "}
                  {problem.levels.length}
                </span>
              </div>
              <div className="level-navigation">
                {problem.levels.map((l, i) => (
                  <button
                    key={l.title}
                    aria-label={`Level ${i + 1}`}
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
                    <span>Level {i + 1}</span>
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
                  The contracts use a shared Go-style notation. Keep PascalCase
                  API names and follow your {languageNames[language]} starter
                  for types and return values.
                </div>
              )}
              <h3>What to build</h3>
              <ul className="requirements-list">
                {selectedLevel.requirements.map((r, i) => (
                  <li key={r}>
                    <span className="requirement-index">{i + 1}</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
              <h3>Examples</h3>
              {selectedLevel.examples.map((example, i) => (
                <div className="example" key={i}>
                  <div>
                    <span>INPUT</span>
                    <pre>{example.input}</pre>
                  </div>
                  <div>
                    <span>OUTPUT</span>
                    <pre>{example.output}</pre>
                  </div>
                </div>
              ))}
              <div className="practice-note">
                <Zap size={16} />
                <div>
                  <strong>Build it one level at a time.</strong>
                  <p>
                    Pass the current level to unlock the next. Your code carries
                    forward.
                  </p>
                </div>
              </div>
              <details className="exercise-details">
                <summary>
                  About this exercise <ChevronDown size={13} />
                </summary>
                <p>
                  Original practice scenario inspired by common ride-hailing and
                  fintech domains. These are not official company interview
                  questions. Monetary amounts use integer cents; time-based
                  exercises use explicit timestamps.
                </p>
              </details>
            </div>
            <div className="requirements-footer">
              <span className="dot" />
              Progress and drafts saved on this browser
            </div>
          </aside>
        )}
        {requirements && (
          <PanelDivider
            label="Resize requirements"
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
                  <span>EXPLORER</span>
                  <button
                    className="icon-button"
                    title="Collapse file explorer"
                    onClick={() => setExplorer(false)}
                  >
                    <PanelLeftClose size={14} />
                  </button>
                </div>
                <div className="folder-label">
                  <ChevronDown size={13} />
                  <FolderOpen size={14} />
                  <span>{problem.id}</span>
                </div>
                <div className="file-list">
                  {files.map((file) => (
                    <button
                      className={`file ${file.path === activePath ? "active" : ""}`}
                      key={file.path}
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
                  ))}
                </div>
                <div className="explorer-tip">
                  <FlaskConical size={17} />
                  <strong>Make it your sandbox.</strong>
                  <p>
                    Write your own tests in the sandbox file. Run them alongside
                    the level checks.
                  </p>
                  <span>Hidden checks run with your tests.</span>
                </div>
              </aside>
            )}
            {explorer && (
              <PanelDivider
                label="Resize file explorer"
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
                    title="Show requirements"
                    onClick={() => setRequirements(true)}
                  >
                    <BookOpen size={17} />
                  </button>
                )}
                {!explorer && (
                  <button
                    className="icon-button restore"
                    title="Show file explorer"
                    onClick={() => setExplorer(true)}
                  >
                    <Files size={16} />
                  </button>
                )}
                <select
                  className="mobile-file-picker"
                  aria-label="Open file"
                  value={activePath}
                  onChange={(e) => setActivePath(e.target.value)}
                >
                  {files.map((f) => (
                    <option key={f.path} value={f.path}>
                      {f.path}
                      {f.readOnly ? " (read only)" : ""}
                    </option>
                  ))}
                </select>
                <div className="active-tab">
                  <FileCode2 size={14} />
                  {activePath || "Loading workspace…"}
                  {activeFile?.readOnly && <LockKeyhole size={11} />}
                </div>
                <div className="tab-spacer" />
                <span className="save-status">
                  {saved ? (
                    <CheckCheck size={13} />
                  ) : (
                    <span className="unsaved-dot" />
                  )}
                  {saved ? "Saved" : "Saving…"}
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
                      <strong>Couldn’t open the workspace</strong>
                      <p>{error}</p>
                      <button
                        className="secondary"
                        onClick={() => setRevision((r) => r + 1)}
                      >
                        Try again
                      </button>
                    </>
                  ) : (
                    <>
                      <LoaderCircle size={28} className="spin" />
                      <span>Preparing your workspace…</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          {consoleOpen ? (
            <>
              <PanelDivider
                label="Resize console"
                orientation="horizontal"
                value={panelSizes.console}
                min={120}
                max={() =>
                  Math.max(120, (codingRef.current?.clientHeight ?? 600) - 180)
                }
                onChange={(value) => sizePanel("console", value)}
                onReset={() => sizePanel("console", 235)}
              />
              <section className="console-panel" aria-label="Test output">
                <div className="console-heading">
                  <div className="console-tabs">
                    <button
                      className={consoleTab === "console" ? "selected" : ""}
                      onClick={() => setConsoleTab("console")}
                    >
                      <SquareTerminal size={14} />
                      Console
                    </button>
                    <button
                      className={consoleTab === "results" ? "selected" : ""}
                      onClick={() => setConsoleTab("results")}
                    >
                      <FlaskConical size={14} />
                      Test results
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
                      title="Collapse console"
                      onClick={() => setConsoleOpen(false)}
                    >
                      <PanelBottomClose size={15} />
                    </button>
                    {run && <span>{(run.durationMs / 1000).toFixed(2)}s</span>}
                    <span className="console-command">
                      {language === "go"
                        ? "go test -v"
                        : language === "python"
                          ? "python -m unittest -v"
                          : "node --test"}
                    </span>
                    <button
                      className="icon-button"
                      title="Clear output"
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
                          Running level {level} checks and your tests…
                        </strong>
                        <span>
                          Compiling your solution and evaluating test cases.
                        </span>
                      </div>
                    </div>
                  ) : error ? (
                    <pre className="error-output">{error}</pre>
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
                                ? "All checks passed"
                                : "Some checks didn’t pass"}
                            </strong>
                            <span>
                              Level {level} · {languageNames[language]}
                            </span>
                            {run.passed && level < problem.levels.length && (
                              <button
                                onClick={() => {
                                  setLevel(level + 1);
                                  setRun(null);
                                }}
                              >
                                Continue to level {level + 1}
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
                          {run.output || "(Runner returned no output)"}
                        </pre>
                      )}
                    </>
                  ) : (
                    <div className="console-empty">
                      <div className="terminal-icon">
                        <Terminal size={21} />
                      </div>
                      <div>
                        <strong>Your next idea starts here.</strong>
                        <span>
                          Run the tests to see output, errors, and results.
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
              <button onClick={() => setConsoleOpen(true)} title="Show console">
                <SquareTerminal size={14} />
                Show console
                <ChevronDown size={13} />
              </button>
              {run && (
                <span className={run.passed ? "pass" : "fail"}>
                  {run.passed ? "All checks passed" : "Some checks didn’t pass"}
                </span>
              )}
            </div>
          )}
          <footer className="editor-status">
            <span>
              <span
                className={`dot ${session?.lspAvailable ? "" : "offline"}`}
              />
              {status}
            </span>
            <span className="status-right">
              <span>UTF-8</span>
              <span>{activeFile?.readOnly ? "Read only" : "Editable"}</span>
              <span>{languageNames[language]}</span>
              <span>
                <LockKeyhole size={11} /> Local workspace
              </span>
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
            aria-label="Exercise library"
          >
            <header className="library-header">
              <div>
                <span className="eyebrow">THE PRACTICE ROOM</span>
                <h2>A little practice. A better design.</h2>
                <p>
                  Real-world systems, small steps. Pick your next challenge.
                </p>
              </div>
              <button
                className="icon-button"
                onClick={() => setLibrary(false)}
                title="Close exercise library"
              >
                <X size={20} />
              </button>
            </header>
            <div className="library-tools">
              <div className="search-input">
                <Search size={17} />
                <input
                  aria-label="Search exercises"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search exercises, concepts, systems…"
                />
              </div>
              <span>{problems.length} exercises · 3 languages</span>
            </div>
            <div className="category-tabs">
              {["All exercises", "Ride-hailing", "Banking", "Fundamentals"].map(
                (c) => (
                  <button
                    className={category === c ? "selected" : ""}
                    key={c}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ),
              )}
            </div>
            <div className="exercise-grid">
              {filtered.map((p) => (
                <button
                  className={`exercise-card ${p.id === problem.id ? "current" : ""}`}
                  key={p.id}
                  disabled={running}
                  onClick={() => {
                    setProblemId(p.id);
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
                      {p.difficulty}
                    </span>
                  </div>
                  <span className="card-category">{p.category}</span>
                  <h3>{p.title}</h3>
                  <p>{p.summary}</p>
                  <div className="card-footer">
                    <span>
                      {p.levels.length} levels <span>·</span> {p.duration} min
                    </span>
                    <ArrowUpRight size={17} />
                  </div>
                </button>
              ))}
              {!filtered.length && (
                <p className="no-results">No exercises match your search.</p>
              )}
            </div>
            <footer className="library-footer">
              <span>
                <Code2 size={14} /> No AI autocomplete. Full language
                intelligence.
              </span>
              <span>Go · Python · TypeScript</span>
            </footer>
          </section>
        </div>
      )}
      {resetConfirm && (
        <div className="modal-backdrop">
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Reset solution"
          >
            <RotateCcw size={25} />
            <h2>Start with a clean slate?</h2>
            <p>
              This resets your {languageNames[language]} solution, personal
              tests, and progress for {problem.title}.
            </p>
            <div>
              <button
                className="secondary"
                onClick={() => setResetConfirm(false)}
              >
                Keep practicing
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
                Reset solution
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
