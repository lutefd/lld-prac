import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Code2, LoaderCircle } from "lucide-react";
import { authClient } from "../lib/auth";
import {
  AccountContext,
  authErrorMessage,
  importLegacyState,
  type AccountState,
  type AccountUser,
} from "../lib/account";
import { PreferencesControls, usePreferences } from "../preferences";
import "./account.css";

function toAccountUser(raw: {
  id: string;
  name?: string | null;
  email: string;
}): AccountUser {
  return {
    id: raw.id,
    name: raw.name || raw.email,
    email: raw.email,
  };
}

function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (user: AccountUser) => Promise<void>;
}) {
  const { t } = usePreferences();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const switchMode = (next: "sign-in" | "sign-up") => {
    setMode(next);
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    if (mode === "sign-up" && !trimmedName) {
      setError("Enter your name.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result =
        mode === "sign-up"
          ? await authClient.signUp.email({
              name: trimmedName,
              email: trimmedEmail,
              password,
            })
          : await authClient.signIn.email({
              email: trimmedEmail,
              password,
            });
      if (result.error) {
        setError(authErrorMessage(result.error));
        return;
      }
      if (result.data?.user) {
        await onAuthenticated(toAccountUser(result.data.user));
        return;
      }
      const session = await authClient.getSession();
      if (session.data?.user) {
        await onAuthenticated(toAccountUser(session.data.user));
        return;
      }
      setError("Authentication failed. Please try again.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? authErrorMessage({ message: caught.message })
          : "Authentication failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <header className="auth-topbar">
        <span className="auth-brand">
          <Code2 size={19} aria-hidden="true" />
          workbench.
        </span>
        <PreferencesControls />
      </header>
      <main className="auth-main">
        <section
          className="auth-card"
          aria-label={mode === "sign-up" ? t("Create account") : t("Sign in")}
        >
          <header>
            <h1>
              {mode === "sign-up"
                ? t("Create your account")
                : t("Sign in to workbench.")}
            </h1>
            <p className="auth-subtitle">
              {t("Progress and drafts are saved to your account.")}
            </p>
          </header>
          <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
            {mode === "sign-up" && (
              <label className="auth-field">
                <span>{t("Name")}</span>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                />
              </label>
            )}
            <label className="auth-field">
              <span>{t("Email")}</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </label>
            <label className="auth-field">
              <span>{t("Password")}</span>
              <input
                type="password"
                name="password"
                autoComplete={
                  mode === "sign-up" ? "new-password" : "current-password"
                }
                minLength={mode === "sign-up" ? 8 : undefined}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </label>
            {error && (
              <p className="auth-error" role="alert">
                {t(error)}
              </p>
            )}
            <button
              type="submit"
              className="primary auth-submit"
              disabled={submitting}
            >
              {submitting
                ? mode === "sign-up"
                  ? t("Creating account…")
                  : t("Signing in…")
                : mode === "sign-up"
                  ? t("Create account")
                  : t("Sign in")}
            </button>
          </form>
          <div className="auth-switch">
            {mode === "sign-in" ? (
              <>
                <span>{t("Need an account?")}</span>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => switchMode("sign-up")}
                >
                  {t("Create an account")}
                </button>
              </>
            ) : (
              <>
                <span>{t("Already have an account?")}</span>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => switchMode("sign-in")}
                >
                  {t("Sign in")}
                </button>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function AccountProvider({ children }: { children: ReactNode }) {
  const { t } = usePreferences();
  const [state, setState] = useState<AccountState>({ status: "loading" });
  const beforeSignOutHooks = useRef(new Set<() => Promise<void>>());

  const finishSignIn = useCallback(async (user: AccountUser) => {
    await importLegacyState();
    setState({ status: "ready", user });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await authClient.getSession();
        if (cancelled) return;
        const user = result.data?.user;
        if (!user) {
          setState({ status: "signed-out" });
          return;
        }
        await importLegacyState();
        if (!cancelled) {
          setState({ status: "ready", user: toAccountUser(user) });
        }
      } catch {
        if (!cancelled) setState({ status: "signed-out" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const registerBeforeSignOut = useCallback((hook: () => Promise<void>) => {
    beforeSignOutHooks.current.add(hook);
    return () => {
      beforeSignOutHooks.current.delete(hook);
    };
  }, []);

  const signOut = useCallback(async () => {
    await Promise.allSettled(
      [...beforeSignOutHooks.current].map((hook) => hook()),
    );
    await authClient.signOut();
    setState({ status: "signed-out" });
  }, []);

  if (state.status === "loading") {
    return (
      <div className="editor-loading" style={{ height: "100dvh" }}>
        <LoaderCircle size={28} className="spin" />
        <span>{t("Checking your session…")}</span>
      </div>
    );
  }

  if (state.status === "signed-out") {
    return <AuthScreen onAuthenticated={finishSignIn} />;
  }

  return (
    <AccountContext.Provider
      value={{ user: state.user, signOut, registerBeforeSignOut }}
    >
      {children}
    </AccountContext.Provider>
  );
}
