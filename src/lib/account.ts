import { createContext, useContext } from "react";
import type { DraftFile, Language, LegacyImport } from "../../shared/account";

export type AccountUser = {
  id: string;
  name: string;
  email: string;
};

export type AccountState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "ready"; user: AccountUser };

export type AccountContextValue = {
  user: AccountUser;
  signOut: () => Promise<void>;
  registerBeforeSignOut: (hook: () => Promise<void>) => () => void;
};

export const AccountContext = createContext<AccountContextValue | null>(null);

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error("AccountProvider is required");
  return value;
}

const LANGUAGES: readonly Language[] = ["go", "python", "typescript", "java"];
const PROGRESS_PREFIX = "workbench.progress.";
const DRAFT_PREFIX = "workbench.draft.";

function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}

function parsePair(
  key: string,
  prefix: string,
): { problemId: string; language: Language } | null {
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);
  const dot = rest.lastIndexOf(".");
  if (dot <= 0) return null;
  const problemId = rest.slice(0, dot);
  const language = rest.slice(dot + 1);
  if (!isLanguage(language)) return null;
  return { problemId, language };
}

function parseDraftFiles(raw: string): DraftFile[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const files: DraftFile[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (record.readOnly === true) continue;
    if (typeof record.path !== "string" || typeof record.content !== "string")
      continue;
    files.push(
      record.userCreated === true
        ? { path: record.path, content: record.content, userCreated: true }
        : { path: record.path, content: record.content },
    );
  }
  return files;
}

export function collectLegacyImport(): {
  payload: LegacyImport;
  keys: string[];
} {
  const payload: LegacyImport = { progress: {}, drafts: {} };
  const keys: string[] = [];
  let storageKeys: string[];
  try {
    storageKeys = Object.keys(localStorage);
  } catch {
    return { payload, keys };
  }
  for (const key of storageKeys) {
    const progressPair = parsePair(key, PROGRESS_PREFIX);
    if (progressPair) {
      keys.push(key);
      try {
        const value = JSON.parse(localStorage.getItem(key) || "null");
        if (typeof value === "number" && Number.isFinite(value) && value >= 1) {
          (payload.progress[progressPair.problemId] ??= {})[
            progressPair.language
          ] = Math.floor(value);
        }
      } catch {
        // Ignore malformed legacy progress entries; key will still be cleared.
      }
      continue;
    }
    const draftPair = parsePair(key, DRAFT_PREFIX);
    if (draftPair) {
      keys.push(key);
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const files = parseDraftFiles(raw);
        if (files.length > 0) {
          (payload.drafts[draftPair.problemId] ??= {})[draftPair.language] =
            files;
        }
      } catch {
        // Ignore malformed legacy draft entries; key will still be cleared.
      }
    }
  }
  return { payload, keys };
}

export function hasLegacyImport(payload: LegacyImport): boolean {
  return (
    Object.keys(payload.progress).length > 0 ||
    Object.keys(payload.drafts).length > 0
  );
}

export function clearLegacyStorage(keys: readonly string[]) {
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage quota or private-mode errors.
    }
  }
}

export async function importLegacyState(): Promise<void> {
  const { payload, keys } = collectLegacyImport();
  if (keys.length === 0) return;
  if (!hasLegacyImport(payload)) {
    clearLegacyStorage(keys);
    return;
  }
  try {
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok || response.status === 409) {
      clearLegacyStorage(keys);
    }
  } catch {
    // Do not block sign-in if the one-time import call fails transiently.
  }
}

export function authErrorMessage(
  error: { code?: string | null; message?: string | null } | null | undefined,
): string {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (
    code === "EMAIL_PASSWORD_SIGN_UP_DISABLED" ||
    /sign[- ]?up.*disabled|disabled.*sign[- ]?up/i.test(message)
  ) {
    return "New account registration is disabled on this server.";
  }
  if (code === "INVALID_EMAIL_OR_PASSWORD") {
    return "Invalid email or password.";
  }
  if (
    code === "USER_ALREADY_EXISTS" ||
    code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
  ) {
    return "An account with this email already exists.";
  }
  if (code === "PASSWORD_TOO_SHORT") {
    return "Password must be at least 8 characters.";
  }
  if (code === "INVALID_EMAIL") {
    return "Enter a valid email address.";
  }
  return message || "Authentication failed. Please try again.";
}
