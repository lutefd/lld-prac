import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Check,
  Code2,
  Copy,
  KeyRound,
  LogOut,
  Trash2,
  X,
} from "lucide-react";
import { authClient } from "../lib/auth";
import { useAccount } from "../lib/account";
import { followLink, previousPath } from "../navigation";
import { PreferencesControls, usePreferences } from "../preferences";
import "../roadmap.css";
import "./account.css";

type ApiKeySummary = {
  id: string;
  name: string | null;
  start: string | null;
  prefix: string | null;
  createdAt: string | Date;
};

type CreatedApiKey = {
  id: string;
  key: string;
  name: string;
};

function resolveBackLink(from: string | null): {
  href: string;
  label: string;
} {
  if (from && /^\/practice\/[^/?#]+$/.test(from)) {
    return { href: from, label: "Back to practice" };
  }
  return { href: "/", label: "Back to roadmap" };
}

export default function AccountPage() {
  const { user, signOut } = useAccount();
  const { t, locale } = usePreferences();
  const [signingOut, setSigningOut] = useState(false);
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [keyName, setKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [copiedField, setCopiedField] = useState<
    "key" | "curl" | "example" | null
  >(null);
  const [error, setError] = useState("");

  const back = resolveBackLink(previousPath());

  const loadKeys = useCallback(async () => {
    setLoadingKeys(true);
    setError("");
    try {
      const result = await authClient.apiKey.list();
      if (result.error) {
        setError(result.error.message || "Couldn't load API keys.");
        return;
      }
      setKeys(result.data?.apiKeys ?? []);
    } catch {
      setError("Couldn't load API keys.");
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const handleCreateKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creatingKey) return;
    const trimmed = keyName.trim();
    if (!trimmed) {
      setError("Enter a name for the API key.");
      return;
    }
    setCreatingKey(true);
    setError("");
    try {
      const result = await authClient.apiKey.create({ name: trimmed });
      if (result.error || !result.data) {
        setError(result.error?.message || "Couldn't create API key.");
        return;
      }
      setCreatedKey({
        id: result.data.id,
        key: result.data.key,
        name: result.data.name || trimmed,
      });
      setCopiedField(null);
      setKeyName("");
      await loadKeys();
    } catch {
      setError("Couldn't create API key.");
    } finally {
      setCreatingKey(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (deletingId) return;
    setDeletingId(keyId);
    setError("");
    try {
      const result = await authClient.apiKey.delete({ keyId });
      if (result.error) {
        setError(result.error.message || "Couldn't delete API key.");
        return;
      }
      setKeys((current) => current.filter((item) => item.id !== keyId));
      setCreatedKey((current) => (current?.id === keyId ? null : current));
    } catch {
      setError("Couldn't delete API key.");
    } finally {
      setDeletingId(null);
    }
  };

  const copyText = async (text: string, field: "key" | "curl" | "example") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
    } catch {
      // Ignore clipboard permission failures; the text remains selectable.
    }
  };

  const formatDate = (value: string | Date) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
      date,
    );
  };

  const reportUrl = `${window.location.origin}/api/v1/report`;
  const curlCommand = createdKey
    ? `curl -H "x-api-key: ${createdKey.key}" ${reportUrl}`
    : "";
  const exampleCurl = `curl -H "x-api-key: <your-api-key>" ${reportUrl}`;

  return (
    <main className="roadmap-page account-page">
      <nav className="roadmap-nav" aria-label={t("Account navigation")}>
        <a href={back.href} onClick={followLink}>
          <ArrowLeft size={16} /> {t(back.label)}
        </a>
        <span>
          <Code2 size={19} /> workbench.
        </span>
        <PreferencesControls />
      </nav>
      <header className="roadmap-intro account-intro">
        <span className="eyebrow">{t("ACCOUNT")}</span>
        <h1>{t("Account")}</h1>
        <p>{t("Progress and drafts are saved to your account.")}</p>
      </header>
      <div className="account-sections">
        <section
          className="account-section"
          aria-labelledby="account-profile-heading"
        >
          <div className="account-section-header">
            <h2 id="account-profile-heading">{t("Profile")}</h2>
          </div>
          <div className="account-summary">
            <div className="account-identity">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <button
              type="button"
              className="secondary account-signout"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
            >
              <LogOut size={14} aria-hidden="true" />
              {signingOut ? t("Signing out…") : t("Sign out")}
            </button>
          </div>
        </section>
        <section
          className="account-section"
          aria-labelledby="account-api-keys-heading"
        >
          <div className="account-section-header">
            <h2 id="account-api-keys-heading">{t("API keys")}</h2>
            <p>{t("Read your progress report from scripts or tools.")}</p>
          </div>
          <form
            className="api-key-form"
            onSubmit={(e) => void handleCreateKey(e)}
          >
            <input
              type="text"
              aria-label={t("Key name")}
              placeholder={t("e.g. CLI script")}
              value={keyName}
              onChange={(e) => {
                setKeyName(e.target.value);
                setError("");
              }}
              disabled={creatingKey}
            />
            <button type="submit" className="primary" disabled={creatingKey}>
              <KeyRound size={13} aria-hidden="true" />
              {creatingKey ? t("Creating key…") : t("Create key")}
            </button>
          </form>
          {createdKey && (
            <div className="api-key-created" role="status">
              <div className="api-key-created-header">
                <span>{t("Copy this key now. It won't be shown again.")}</span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t("Dismiss")}
                  onClick={() => setCreatedKey(null)}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="api-key-copy-row">
                <code className="api-key-secret">{createdKey.key}</code>
                <button
                  type="button"
                  className="secondary api-key-copy-btn"
                  onClick={() => void copyText(createdKey.key, "key")}
                >
                  {copiedField === "key" ? (
                    <Check size={13} aria-hidden="true" />
                  ) : (
                    <Copy size={13} aria-hidden="true" />
                  )}
                  {copiedField === "key" ? t("Copied") : t("Copy")}
                </button>
              </div>
              <div className="api-key-copy-row">
                <pre className="api-key-curl">{curlCommand}</pre>
                <button
                  type="button"
                  className="secondary api-key-copy-btn"
                  onClick={() => void copyText(curlCommand, "curl")}
                >
                  {copiedField === "curl" ? (
                    <Check size={13} aria-hidden="true" />
                  ) : (
                    <Copy size={13} aria-hidden="true" />
                  )}
                  {copiedField === "curl" ? t("Copied") : t("Copy curl")}
                </button>
              </div>
            </div>
          )}
          {error && (
            <p className="auth-error" role="alert">
              {t(error)}
            </p>
          )}
          {loadingKeys ? (
            <p className="api-keys-empty">{t("Loading API keys…")}</p>
          ) : keys.length === 0 ? (
            <p className="api-keys-empty">{t("No API keys yet.")}</p>
          ) : (
            <ul className="api-key-list">
              {keys.map((item) => {
                const displayName = item.name || t("Unnamed key");
                const preview = item.start
                  ? `${item.start}…`
                  : item.prefix || "—";
                const created = formatDate(item.createdAt);
                return (
                  <li className="api-key-item" key={item.id}>
                    <div className="api-key-meta">
                      <span className="api-key-name">{displayName}</span>
                      <span className="api-key-details">
                        <code>{preview}</code>
                        {created && (
                          <span>{t("Created {date}", { date: created })}</span>
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="api-key-delete"
                      aria-label={t("Delete API key {name}", {
                        name: displayName,
                      })}
                      disabled={deletingId === item.id}
                      onClick={() => void handleDeleteKey(item.id)}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      {t("Delete")}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section
          className="account-section"
          aria-labelledby="account-report-heading"
        >
          <div className="account-section-header">
            <h2 id="account-report-heading">{t("Progress report API")}</h2>
            <p>
              {t(
                "Query GET /api/v1/report with an x-api-key header to export your practice history as JSON.",
              )}
            </p>
          </div>
          <p className="report-description">
            {t(
              "The response includes your account info, an overall summary (attempts, passed attempts, levels passed, started and completed exercises), per-exercise progress by language, and recent attempts (default 100, up to 1000 with ?limit=).",
            )}
          </p>
          <div className="report-example">
            <div className="report-example-header">
              <span>{t("Example request")}</span>
              <button
                type="button"
                className="secondary api-key-copy-btn"
                onClick={() => void copyText(exampleCurl, "example")}
              >
                {copiedField === "example" ? (
                  <Check size={13} aria-hidden="true" />
                ) : (
                  <Copy size={13} aria-hidden="true" />
                )}
                {copiedField === "example" ? t("Copied") : t("Copy")}
              </button>
            </div>
            <pre className="report-example-code">{exampleCurl}</pre>
          </div>
          <p className="report-scope-note">
            {t(
              "API keys can only read this report and cannot open workspaces or run code.",
            )}
          </p>
        </section>
      </div>
    </main>
  );
}
