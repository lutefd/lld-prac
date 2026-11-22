import type { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { apiKey } from "@better-auth/api-key";

export type AuthOptions = {
  database: DatabaseSync;
  baseURL: string;
  secret: string;
  trustedOrigins: string[];
  disableSignUp: boolean;
};

/**
 * Accounts use email and password. API keys are not allowed to stand in for a
 * session (`enableSessionForAPIKeys` stays off), so a key can only read the
 * report and never opens workspaces or runs code.
 */
export function createAuth({
  database,
  baseURL,
  secret,
  trustedOrigins,
  disableSignUp,
}: AuthOptions) {
  const auth = betterAuth({
    database,
    baseURL,
    secret,
    trustedOrigins,
    emailAndPassword: { enabled: true, disableSignUp },
    plugins: [
      apiKey({
        rateLimit: {
          enabled: true,
          timeWindow: 60_000,
          maxRequests: 120,
        },
      }),
    ],
  });
  /** Safe to run on every boot; it only adds missing tables and columns. */
  const migrate = async () => {
    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();
  };
  return { auth, migrate };
}

export type Auth = ReturnType<typeof createAuth>["auth"];
