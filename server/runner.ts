import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { mkdtemp, cp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type Language = "go" | "python" | "typescript";
type RunOptions = { timeoutMs?: number; mode?: string };
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
      args: ["test", "-v", "-count=1", "-timeout=12s", "."],
    };
  if (language === "python")
    return {
      command: "python3",
      args: [
        "-m",
        "unittest",
        "-v",
        ...files
          .filter((f) =>
            /^(?:(?:hidden_)?test_level_\d+|hidden_level_\d+|sandbox_test)\.py$/.test(
              f,
            ),
          )
          .map((f) => f.slice(0, -3)),
      ],
    };
  if (language === "typescript")
    return {
      command: "node",
      args: [
        "--experimental-strip-types",
        "--test",
        ...files.filter((f) => f.endsWith(".test.ts")),
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
  }: RunOptions = {},
): Promise<RunResult> {
  if (!Number.isInteger(level) || level < 1 || level > 9)
    throw new Error("Invalid test level");
  const snapshot = await mkdtemp(path.join(os.tmpdir(), "lld-run-"));
  let containerName: string | undefined;
  const dockerPrefix = process.env.PRACTICE_DOCKER_CONTEXT
    ? ["--context", process.env.PRACTICE_DOCKER_CONTEXT]
    : [];
  try {
    await cp(cwd, snapshot, {
      recursive: true,
      filter: (source) => {
        const match = /(?:level_)(\d+)/.exec(path.basename(source));
        return !match || Number(match[1]) <= level;
      },
    });
    const files = await readdir(snapshot);
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
