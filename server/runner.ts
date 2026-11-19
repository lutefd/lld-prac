import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { mkdtemp, mkdir, cp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type Language = "go" | "python" | "typescript";
type RunOptions = {
  timeoutMs?: number;
  mode?: string;
  suppliedFiles?: string[];
};
export type RunResult = {
  passed: boolean;
  output: string;
  durationMs: number;
  timedOut: boolean;
  runner?: string;
};
export function commandFor(language: Language, files: string[]) {
  if (language === "go")
    return {
      command: "go",
      args: ["test", "-v", "-count=1", "-timeout=12s", "./..."],
    };
  if (language === "python")
    return {
      command: "python3",
      args: [
        "-c",
        `import importlib.util, os, sys, unittest
sys.path.insert(0, os.getcwd())
suite = unittest.TestSuite()
for index, filename in enumerate(sys.argv[1:]):
    sys.path.insert(0, os.path.dirname(os.path.abspath(filename)))
    name = "_practice_test_" + str(index)
    spec = importlib.util.spec_from_file_location(name, filename)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    suite.addTests(unittest.defaultTestLoader.loadTestsFromModule(module))
result = unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(0 if result.wasSuccessful() else 1)
`,
        ...files.filter((f) =>
          /^(?:test_.*|.*_test|hidden_test_level_\d+|hidden_level_\d+)\.py$/.test(
            path.basename(f),
          ),
        ),
      ],
    };
  if (language === "typescript")
    return {
      command: "node",
      args: [
        "--experimental-strip-types",
        "--test",
        ...files.filter(
          (f) => f.endsWith(".test.ts") || f.endsWith("_test.ts"),
        ),
      ],
    };
  throw new Error("Unsupported language");
}

export function runProcess(
  command: string,
  args: string[],
  cwd: string,
  {
    timeoutMs = 20000,
    env = {},
  }: { timeoutMs?: number; env?: NodeJS.ProcessEnv } = {},
): Promise<RunResult> {
  return new Promise((resolve) => {
    const started = performance.now();
    let output = "";
    let timedOut = false;
    let finished = false;
    const childEnv = { ...process.env, ...env };
    // A runner launched by node:test must start a fresh test process, rather
    // than inherit the parent harness's worker marker and silently skip tests.
    delete childEnv.NODE_TEST_CONTEXT;
    const child = spawn(command, args, {
      cwd,
      detached: process.platform !== "win32",
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stop = () => {
      try {
        if (process.platform !== "win32") process.kill(-child.pid!, "SIGKILL");
        else child.kill("SIGKILL");
      } catch {}
    };
    const finish = (passed: boolean) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({
        passed,
        output,
        durationMs: Math.round(performance.now() - started),
        timedOut,
      });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      output += "\nRun stopped after the execution time limit.\n";
      stop();
      finish(false);
    }, timeoutMs);
    const append = (chunk: Buffer) => {
      if (output.length >= 250000) return;
      output += chunk.toString().slice(0, 250000 - output.length);
      if (output.length >= 250000) {
        output += "\nOutput limit reached; run stopped.\n";
        stop();
        finish(false);
      }
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", (error) => {
      output += `${error.message}\n`;
      finish(false);
    });
    child.on("close", (code) => finish(code === 0 && !timedOut));
  });
}

export async function runTests(
  cwd: string,
  language: Language,
  level: number,
  {
    timeoutMs = 20000,
    mode = process.env.PRACTICE_RUNNER || "native",
    suppliedFiles,
  }: RunOptions = {},
): Promise<RunResult> {
  if (!Number.isInteger(level) || level < 1 || level > 9)
    throw new Error("Invalid test level");
  const runRoot = process.env.PRACTICE_RUN_ROOT || os.tmpdir();
  await mkdir(runRoot, { recursive: true });
  const snapshot = await mkdtemp(path.join(runRoot, "lld-run-"));
  let containerName: string | undefined;
  const dockerPrefix = process.env.PRACTICE_DOCKER_CONTEXT
    ? ["--context", process.env.PRACTICE_DOCKER_CONTEXT]
    : [];
  try {
    await cp(cwd, snapshot, {
      recursive: true,
      filter: (source) => {
        const relative = path.relative(cwd, source).split(path.sep).join("/");
        if (suppliedFiles && !suppliedFiles.includes(relative)) return true;
        const match =
          /^(?:hidden_)?(?:test_)?level_(\d+)(?:_test\.go|\.test\.ts|\.py)$/.exec(
            relative,
          );
        return !match || Number(match[1]) <= level;
      },
    });
    const collectFiles = async (directory: string): Promise<string[]> => {
      const entries = await readdir(directory, { withFileTypes: true });
      const groups = await Promise.all(
        entries.map(async (entry) => {
          const absolute = path.join(directory, entry.name);
          return entry.isDirectory()
            ? collectFiles(absolute)
            : [path.relative(snapshot, absolute).split(path.sep).join("/")];
        }),
      );
      return groups.flat();
    };
    const files = (await collectFiles(snapshot)).sort();
    const selected = commandFor(language, files);
    if (mode === "docker") {
      const images = {
        go: "golang:1.26-alpine",
        python: "python:3.14-alpine",
        typescript: "node:24-alpine",
      };
      containerName = `lld-practice-${path.basename(snapshot).toLowerCase()}`;
      const args = [
        ...dockerPrefix,
        "run",
        "--rm",
        "--name",
        containerName,
        "--network",
        "none",
        "--memory",
        "256m",
        "--cpus",
        "1",
        "--pids-limit",
        "64",
        "--read-only",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--tmpfs",
        "/tmp:rw,exec,size=256m",
        "--mount",
        `type=bind,src=${snapshot},dst=/workspace,readonly`,
        "--workdir",
        "/workspace",
        "--env",
        "GOCACHE=/tmp/go-cache",
        "--env",
        "GOTMPDIR=/tmp",
        "--env",
        "GOPROXY=off",
        "--env",
        "GOTOOLCHAIN=local",
        "--env",
        "PYTHONDONTWRITEBYTECODE=1",
        images[language],
        selected.command,
        ...selected.args,
      ];
      return {
        ...(await runProcess("docker", args, snapshot, { timeoutMs })),
        runner: "docker",
      };
    }
    return {
      ...(await runProcess(selected.command, selected.args, snapshot, {
        timeoutMs,
        env: {
          GOWORK: "off",
          GOPROXY: "off",
          GOTOOLCHAIN: "local",
          GOFLAGS: "",
          GOENV: "off",
          PYTHONDONTWRITEBYTECODE: "1",
        },
      })),
      runner: "native",
    };
  } finally {
    if (containerName)
      await runProcess(
        "docker",
        [...dockerPrefix, "rm", "-f", containerName],
        snapshot,
        { timeoutMs: 3000 },
      );
    await rm(snapshot, { recursive: true, force: true });
  }
}

export const runGoTests = (cwd: string, level: number, options?: RunOptions) =>
  runTests(cwd, "go", level, options);
