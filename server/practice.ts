import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { getFiles } from "../shared/languages.ts";
import type { PracticeFile, PracticeProblem } from "../shared/problems.ts";
import type {
  AttemptRecord,
  DraftFile,
  Language,
  ProblemProgress,
  ProgressMap,
  ProgressReport,
} from "../shared/account.ts";

const languages: readonly Language[] = ["go", "python", "typescript", "java"];

export type NewAttempt = {
  problemId: string;
  language: Language;
  level: number;
  passed: boolean;
  durationMs: number;
};

export type DraftSanitizer = (
  files: unknown,
  language: Language,
  originals: PracticeFile[],
) => DraftFile[];

export function ensureSchema(db: DatabaseSync) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS practice_attempt (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      problem_id TEXT NOT NULL,
      language TEXT NOT NULL,
      level INTEGER NOT NULL,
      passed INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      imported INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS practice_attempt_user_created
      ON practice_attempt (user_id, created_at);
    CREATE TABLE IF NOT EXISTS practice_draft (
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      problem_id TEXT NOT NULL,
      language TEXT NOT NULL,
      files TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, problem_id, language)
    );
  `);
}

export function recordAttempt(
  db: DatabaseSync,
  userId: string,
  attempt: NewAttempt,
) {
  db.prepare(
    `INSERT INTO practice_attempt
       (id, user_id, problem_id, language, level, passed, duration_ms, imported, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
  ).run(
    randomUUID(),
    userId,
    attempt.problemId,
    attempt.language,
    attempt.level,
    attempt.passed ? 1 : 0,
    Math.max(0, Math.round(attempt.durationMs)),
    Date.now(),
  );
}

export function unlockedLevel(
  db: DatabaseSync,
  userId: string,
  problemId: string,
  language: Language,
  totalLevels?: number,
): number {
  const row = db
    .prepare(
      `SELECT MAX(level) AS top
       FROM practice_attempt
       WHERE user_id = ? AND problem_id = ? AND language = ? AND passed = 1`,
    )
    .get(userId, problemId, language) as { top: number | null } | undefined;
  if (row?.top == null) return 1;
  const unlocked = row.top + 1;
  return totalLevels !== undefined
    ? Math.min(unlocked, totalLevels + 1)
    : unlocked;
}

type PassedRow = { problem_id: string; language: Language; top: number };

export function progressMap(
  db: DatabaseSync,
  userId: string,
  catalog?: PracticeProblem[],
): ProgressMap {
  const limits = catalog
    ? new Map(catalog.map((problem) => [problem.id, problem.levels.length]))
    : null;
  const rows = db
    .prepare(
      `SELECT problem_id, language, MAX(level) AS top
       FROM practice_attempt
       WHERE user_id = ? AND passed = 1
       GROUP BY problem_id, language`,
    )
    .all(userId) as PassedRow[];
  const map: ProgressMap = {};
  for (const row of rows) {
    const limit = limits?.get(row.problem_id);
    const unlocked =
      limit !== undefined ? Math.min(row.top + 1, limit + 1) : row.top + 1;
    (map[row.problem_id] ??= {})[row.language] = unlocked;
  }
  return map;
}

export function loadDraft(
  db: DatabaseSync,
  userId: string,
  problemId: string,
  language: Language,
): DraftFile[] {
  const row = db
    .prepare(
      `SELECT files
       FROM practice_draft
       WHERE user_id = ? AND problem_id = ? AND language = ?`,
    )
    .get(userId, problemId, language) as { files: string } | undefined;
  if (!row) return [];
  try {
    const parsed: unknown = JSON.parse(row.files);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is DraftFile =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).path === "string" &&
        typeof (item as Record<string, unknown>).content === "string",
    );
  } catch {
    return [];
  }
}

export function saveDraft(
  db: DatabaseSync,
  userId: string,
  problemId: string,
  language: Language,
  files: DraftFile[],
) {
  db.prepare(
    `INSERT INTO practice_draft (user_id, problem_id, language, files, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (user_id, problem_id, language)
     DO UPDATE SET files = excluded.files, updated_at = excluded.updated_at`,
  ).run(userId, problemId, language, JSON.stringify(files), Date.now());
}

export function resetPractice(
  db: DatabaseSync,
  userId: string,
  problemId: string,
  language: string,
) {
  db.exec("BEGIN");
  try {
    db.prepare(
      `DELETE FROM practice_attempt
       WHERE user_id = ? AND problem_id = ? AND language = ?`,
    ).run(userId, problemId, language);
    db.prepare(
      `DELETE FROM practice_draft
       WHERE user_id = ? AND problem_id = ? AND language = ?`,
    ).run(userId, problemId, language);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function importLegacy(
  db: DatabaseSync,
  userId: string,
  incoming: unknown,
  catalog: PracticeProblem[],
  sanitizeDraft: DraftSanitizer,
): { imported: boolean } {
  if (!incoming || typeof incoming !== "object") return { imported: false };
  const payload = incoming as Record<string, unknown>;
  const incomingProgress =
    payload.progress && typeof payload.progress === "object"
      ? (payload.progress as Record<string, unknown>)
      : null;
  const incomingDrafts =
    payload.drafts && typeof payload.drafts === "object"
      ? (payload.drafts as Record<string, unknown>)
      : null;
  if (!incomingProgress && !incomingDrafts) return { imported: false };

  const now = Date.now();
  let imported = false;
  db.exec("BEGIN IMMEDIATE");
  try {
    const hasAttempt = db
      .prepare("SELECT 1 FROM practice_attempt WHERE user_id = ? LIMIT 1")
      .get(userId);
    const hasDraft = db
      .prepare("SELECT 1 FROM practice_draft WHERE user_id = ? LIMIT 1")
      .get(userId);
    if (hasAttempt || hasDraft) {
      db.exec("COMMIT");
      return { imported: false };
    }

    const insertAttempt = db.prepare(
      `INSERT INTO practice_attempt
         (id, user_id, problem_id, language, level, passed, duration_ms, imported, created_at)
       VALUES (?, ?, ?, ?, ?, 1, 0, 1, ?)`,
    );
    const insertDraft = db.prepare(
      `INSERT INTO practice_draft (user_id, problem_id, language, files, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    );

    if (incomingProgress) {
      for (const problem of catalog) {
        const entry = incomingProgress[problem.id];
        if (!entry || typeof entry !== "object") continue;
        for (const language of languages) {
          const unlocked = (entry as Record<string, unknown>)[language];
          if (typeof unlocked !== "number" || !Number.isFinite(unlocked))
            continue;
          const cappedUnlocked = Math.min(
            Math.floor(unlocked),
            problem.levels.length + 1,
          );
          for (let level = 1; level < cappedUnlocked; level++) {
            insertAttempt.run(
              randomUUID(),
              userId,
              problem.id,
              language,
              level,
              now,
            );
            imported = true;
          }
        }
      }
    }

    if (incomingDrafts) {
      for (const problem of catalog) {
        const entry = incomingDrafts[problem.id];
        if (!entry || typeof entry !== "object") continue;
        for (const language of languages) {
          const rawFiles = (entry as Record<string, unknown>)[language];
          if (!Array.isArray(rawFiles) || rawFiles.length === 0) continue;
          const validFiles = sanitizeDraft(
            rawFiles,
            language,
            getFiles(problem, language),
          );
          if (validFiles.length === 0) continue;
          insertDraft.run(
            userId,
            problem.id,
            language,
            JSON.stringify(validFiles),
            now,
          );
          imported = true;
        }
      }
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { imported };
}

type AttemptRow = {
  problem_id: string;
  language: Language;
  level: number;
  passed: number;
  duration_ms: number;
  imported: number;
  created_at: number;
};

type StatRow = {
  problem_id: string;
  language: Language;
  attempts: number;
  top: number | null;
  last: number;
};

export function report(
  db: DatabaseSync,
  userId: string,
  user: ProgressReport["user"],
  catalog: PracticeProblem[],
  { limit, since = Number.MIN_SAFE_INTEGER }: { limit: number; since?: number },
): ProgressReport {
  const problemsById = new Map(catalog.map((problem) => [problem.id, problem]));
  const stats = db
    .prepare(
      `SELECT problem_id, language, COUNT(*) AS attempts,
              MAX(CASE WHEN passed = 1 THEN level END) AS top,
              MAX(created_at) AS last
       FROM practice_attempt
       WHERE user_id = ?
       GROUP BY problem_id, language
       ORDER BY last DESC`,
    )
    .all(userId) as StatRow[];
  const progress: ProblemProgress[] = [];
  for (const row of stats) {
    const problem = problemsById.get(row.problem_id);
    if (!problem) continue;
    const totalLevels = problem.levels.length;
    const levelsPassed = Math.min(row.top ?? 0, totalLevels);
    progress.push({
      problemId: row.problem_id,
      title: problem.title,
      language: row.language,
      levelsPassed,
      totalLevels,
      completed: levelsPassed >= totalLevels,
      attempts: row.attempts,
      lastAttemptAt: new Date(row.last).toISOString(),
    });
  }
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS attempts, COALESCE(SUM(passed), 0) AS passed
       FROM practice_attempt
       WHERE user_id = ?`,
    )
    .get(userId) as { attempts: number; passed: number };
  const attempts = (
    db
      .prepare(
        `SELECT problem_id, language, level, passed, duration_ms, imported, created_at
         FROM practice_attempt
         WHERE user_id = ? AND created_at > ?
         ORDER BY created_at DESC, rowid DESC
         LIMIT ?`,
      )
      .all(userId, since, limit) as AttemptRow[]
  ).map((row): AttemptRecord => ({
    problemId: row.problem_id,
    language: row.language,
    level: row.level,
    passed: row.passed === 1,
    durationMs: row.duration_ms,
    createdAt: new Date(row.created_at).toISOString(),
    imported: row.imported === 1,
  }));
  return {
    user,
    summary: {
      attempts: totals.attempts,
      passedAttempts: totals.passed,
      levelsPassed: progress.reduce((sum, item) => sum + item.levelsPassed, 0),
      problemsStarted: progress.length,
      problemsCompleted: progress.filter((item) => item.completed).length,
    },
    progress,
    attempts,
  };
}
