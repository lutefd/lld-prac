export type Language = "go" | "python" | "typescript" | "java";

/** Highest unlocked level per problem and language; level N is unlocked once N-1 passed. */
export type ProgressMap = Record<string, Partial<Record<Language, number>>>;

export type AttemptRecord = {
  problemId: string;
  language: Language;
  level: number;
  passed: boolean;
  durationMs: number;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** True for levels carried over from browser storage, not run on the server. */
  imported: boolean;
};

export type ProblemProgress = {
  problemId: string;
  title: string;
  language: Language;
  levelsPassed: number;
  totalLevels: number;
  completed: boolean;
  attempts: number;
  lastAttemptAt: string | null;
};

/** Response of GET /api/v1/report, authenticated with an `x-api-key` header. */
export type ProgressReport = {
  user: { id: string; name: string; email: string };
  summary: {
    attempts: number;
    passedAttempts: number;
    levelsPassed: number;
    problemsStarted: number;
    problemsCompleted: number;
  };
  progress: ProblemProgress[];
  /** Newest first, capped by the `limit` query parameter (default 100, max 1000). */
  attempts: AttemptRecord[];
};
