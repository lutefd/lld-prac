import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const javaHarnessSource = fileURLToPath(
  new URL("./java/PracticeRunner.java", import.meta.url),
);
let javaHarnessPromise: Promise<string | null> | undefined;

async function ensureJavaHarness(): Promise<string | null> {
  if (!javaHarnessPromise) {
    javaHarnessPromise = (async () => {
      try {
        const source = await readFile(javaHarnessSource, "utf8");
        const hash = createHash("sha256")
          .update(source)
          .digest("hex")
          .slice(0, 12);
        const cacheDir = path.join(
          os.tmpdir(),
          `workbench-java-harness-${hash}`,
        );
        const classFile = path.join(cacheDir, "PracticeRunner.class");
        try {
          await access(classFile);
          return cacheDir;
        } catch {
          // Not compiled yet; build into a sibling temp dir and rename into place.
        }
        const staging = await mkdtemp(
          path.join(os.tmpdir(), "workbench-java-harness-build-"),
        );
        try {
          const compiled = await runProcess(
            "javac",
            [
              "--release",
              "21",
              "-proc:none",
              "-encoding",
              "UTF-8",
              "-d",
              staging,
              javaHarnessSource,
            ],
            staging,
            { timeoutMs: 15000 },
          );
          if (!compiled.passed) return null;
          try {
            await rename(staging, cacheDir);
            return cacheDir;
          } catch {
            // Another process may have populated cacheDir concurrently.
            await access(classFile);
            return cacheDir;
          }
        } finally {
          await rm(staging, { recursive: true, force: true });
        }
      } catch {
        return null;
      }
    })();
  }
  return javaHarnessPromise;
}

export type Language = "go" | "python" | "typescript" | "java";
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
        "--test-isolation=none",
        ...files.filter(
          (f) => f.endsWith(".test.ts") || f.endsWith("_test.ts"),
        ),
      ],
    };
  if (language === "java")
    return {
      command: "java",
      args: [
        "-Xmx128m",
        "-XX:+UseSerialGC",
        "-XX:TieredStopAtLevel=1",
        javaHarnessSource,
        ...files.filter((file) => file.endsWith(".java")),
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
        if (process.platform !== "win32" && child.pid)
          process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch {
        // Process termination is idempotent.
      }
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
  let needsContainerCleanup = false;
  const dockerPrefix = process.env.PRACTICE_DOCKER_CONTEXT
    ? ["--context", process.env.PRACTICE_DOCKER_CONTEXT]
    : [];
  try {
    await cp(cwd, snapshot, {
      recursive: true,
      filter: (source) => {
        const relative = path.relative(cwd, source).split(path.sep).join("/");
        if (relative === ".jdtls" || relative.startsWith(".jdtls/"))
          return false;
        if (suppliedFiles && !suppliedFiles.includes(relative)) return true;
        const match =
          /^(?:hidden_)?(?:test_)?level_(\d+)(?:_test\.go|\.test\.ts|\.py)$/.exec(
            relative,
          );
        const javaMatch = /^(?:Hidden)?Level(\d+)Test\.java$/.exec(relative);
        return (
          (!match || Number(match[1]) <= level) &&
          (!javaMatch || Number(javaMatch[1]) <= level)
        );
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
        go: process.env.PRACTICE_GO_IMAGE || "golang:1.26-alpine",
        python: "python:3.14-alpine",
        typescript: "node:24-alpine",
        java: process.env.PRACTICE_JAVA_IMAGE || "workbench-java-runner:21",
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
        ...(language === "java"
          ? [
              "-Xmx128m",
              "-XX:+UseSerialGC",
              "-XX:TieredStopAtLevel=1",
              "-XX:ActiveProcessorCount=1",
              "-XX:SharedArchiveFile=/opt/workbench/java/classes.jsa",
              "-cp",
              "/opt/workbench/java/runner.jar",
              "PracticeRunner",
              ...files.filter((file) => file.endsWith(".java")),
            ]
          : selected.args),
      ];
      needsContainerCleanup = true;
      const result = await runProcess("docker", args, snapshot, { timeoutMs });
      // `docker run --rm` removes containers automatically on normal exit;
      // only force-remove if we killed the client early (timeout or output cap).
      needsContainerCleanup =
        result.timedOut ||
        result.output.endsWith("\nOutput limit reached; run stopped.\n");
      return {
        ...result,
        runner: "docker",
      };
    }
    const nativeArgs =
      language === "java"
        ? await (async () => {
            const harnessDir = await ensureJavaHarness();
            if (!harnessDir) return selected.args;
            return [
              "-Xmx128m",
              "-XX:+UseSerialGC",
              "-XX:TieredStopAtLevel=1",
              "-cp",
              harnessDir,
              "PracticeRunner",
              ...files.filter((file) => file.endsWith(".java")),
            ];
          })()
        : selected.args;
    return {
      ...(await runProcess(selected.command, nativeArgs, snapshot, {
        timeoutMs,
        env: {
          GOWORK: "off",
          GOPROXY: "off",
          GOTOOLCHAIN: "local",
          GOFLAGS: "",
          GOENV: "off",
          CGO_ENABLED: "0",
          PYTHONDONTWRITEBYTECODE: "1",
        },
      })),
      runner: "native",
    };
  } finally {
    if (containerName && needsContainerCleanup)
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
