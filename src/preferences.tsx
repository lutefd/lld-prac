import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Minus, Moon, Plus, SlidersHorizontal, Sun, X } from "lucide-react";
import { uiTranslations } from "./uiTranslations";
import { roadmapTranslations } from "./roadmapTranslations";
import {
  editorFontOptions,
  editorThemeOptions,
  type EditorFontId,
  type EditorThemeId,
} from "./editorThemes";
import "./preferences.css";

type Locale = "en" | "pt-BR";
type LocalePreference = "system" | Locale;
type ThemePreference = "system" | "light" | "dark";
type TextSizePreference = "default" | "large" | "xlarge";
type Translate = (
  source: string,
  values?: Record<string, string | number>,
) => string;

const EDITOR_THEME_IDS: readonly EditorThemeId[] = [
  "auto",
  ...editorThemeOptions.map((option) => option.id),
];
const EDITOR_FONT_IDS: readonly EditorFontId[] = editorFontOptions.map(
  (option) => option.id,
);
const TEXT_SIZE_IDS: readonly TextSizePreference[] = [
  "default",
  "large",
  "xlarge",
];
const MIN_EDITOR_FONT_SIZE = 11;
const MAX_EDITOR_FONT_SIZE = 22;
const DEFAULT_EDITOR_FONT_SIZE = 14;

const labels: Record<string, string> = {
  Language: "Idioma",
  "Browser default": "Padrão do navegador",
  "Switch to light theme": "Ativar tema claro",
  "Switch to dark theme": "Ativar tema escuro",
  Preferences: "Preferências",
  "Display & editor settings": "Aparência e editor",
  "Close settings": "Fechar configurações",
  "Editor theme": "Tema do editor",
  "Match app theme": "Seguir tema do app",
  "Editor font": "Fonte do editor",
  "Editor font size": "Tamanho da fonte do editor",
  "Decrease editor font size": "Diminuir fonte do editor",
  "Increase editor font size": "Aumentar fonte do editor",
  "Interface text": "Tamanho do texto da interface",
  Default: "Padrão",
  Large: "Grande",
  "Extra large": "Extra grande",
  "Reset defaults": "Restaurar padrões",
};

function storedChoice<T extends string>(
  key: string,
  choices: readonly T[],
  fallback: T,
): T {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return choices.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function storedNumber(
  key: string,
  min: number,
  max: number,
  fallback: number,
): number {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return typeof value === "number" &&
      Number.isInteger(value) &&
      value >= min &&
      value <= max
      ? value
      : fallback;
  } catch {
    return fallback;
  }
}

export function browserLocale(languages: readonly string[]): Locale {
  return languages[0]?.toLowerCase().split("-")[0] === "pt" ? "pt-BR" : "en";
}

const PreferencesContext = createContext<{
  locale: Locale;
  localePreference: LocalePreference;
  theme: "light" | "dark";
  editorThemePreference: EditorThemeId;
  resolvedEditorTheme: Exclude<EditorThemeId, "auto">;
  editorFontFamily: EditorFontId;
  editorFontSize: number;
  textSize: TextSizePreference;
  setLocalePreference: (value: LocalePreference) => void;
  setThemePreference: (value: ThemePreference) => void;
  setEditorThemePreference: (value: EditorThemeId) => void;
  setEditorFontFamily: (value: EditorFontId) => void;
  setEditorFontSize: (value: number) => void;
  setTextSize: (value: TextSizePreference) => void;
  resetDisplayPreferences: () => void;
  t: Translate;
} | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [localePreference, setLocalePreference] = useState<LocalePreference>(
    () => storedChoice("workbench.locale", ["system", "en", "pt-BR"], "system"),
  );
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    storedChoice("workbench.theme", ["system", "light", "dark"], "system"),
  );
  const [editorThemePreference, setEditorThemePreference] =
    useState<EditorThemeId>(() =>
      storedChoice("workbench.editorTheme", EDITOR_THEME_IDS, "auto"),
    );
  const [editorFontFamily, setEditorFontFamily] = useState<EditorFontId>(() =>
    storedChoice("workbench.editorFontFamily", EDITOR_FONT_IDS, "system-mono"),
  );
  const [editorFontSize, setEditorFontSizeState] = useState<number>(() =>
    storedNumber(
      "workbench.editorFontSize",
      MIN_EDITOR_FONT_SIZE,
      MAX_EDITOR_FONT_SIZE,
      DEFAULT_EDITOR_FONT_SIZE,
    ),
  );
  const [textSize, setTextSize] = useState<TextSizePreference>(() =>
    storedChoice("workbench.textSize", TEXT_SIZE_IDS, "default"),
  );
  const [detectedLocale, setDetectedLocale] = useState(() =>
    browserLocale(
      navigator.languages?.length ? navigator.languages : [navigator.language],
    ),
  );
  const [dark, setDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const themeChanged = () => setDark(media.matches);
    const languageChanged = () =>
      setDetectedLocale(
        browserLocale(
          navigator.languages?.length
            ? navigator.languages
            : [navigator.language],
        ),
      );
    media.addEventListener("change", themeChanged);
    window.addEventListener("languagechange", languageChanged);
    return () => {
      media.removeEventListener("change", themeChanged);
      window.removeEventListener("languagechange", languageChanged);
    };
  }, []);
  const locale =
    localePreference === "system" ? detectedLocale : localePreference;
  const theme =
    themePreference === "system" ? (dark ? "dark" : "light") : themePreference;
  const resolvedEditorTheme: Exclude<EditorThemeId, "auto"> =
    editorThemePreference === "auto"
      ? theme === "light"
        ? "practice-light"
        : "practice-dark"
      : editorThemePreference;
  const setEditorFontSize = (value: number) =>
    setEditorFontSizeState(
      Math.max(
        MIN_EDITOR_FONT_SIZE,
        Math.min(MAX_EDITOR_FONT_SIZE, Math.round(value)),
      ),
    );
  const resetDisplayPreferences = () => {
    setEditorThemePreference("auto");
    setEditorFontFamily("system-mono");
    setEditorFontSizeState(DEFAULT_EDITOR_FONT_SIZE);
    setTextSize("default");
  };
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title =
      locale === "pt-BR"
        ? "workbench. — Prática de design de baixo nível"
        : "workbench. — Low-level design practice";
  }, [locale]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "light" ? "#f3f5f7" : "#14171b");
    window.dispatchEvent(new Event("workbench-theme-change"));
  }, [theme]);
  useEffect(() => {
    if (textSize === "default")
      delete document.documentElement.dataset.textSize;
    else document.documentElement.dataset.textSize = textSize;
  }, [textSize]);
  useEffect(() => {
    try {
      localStorage.setItem(
        "workbench.locale",
        JSON.stringify(localePreference),
      );
    } catch {}
  }, [localePreference]);
  useEffect(() => {
    try {
      localStorage.setItem("workbench.theme", JSON.stringify(themePreference));
    } catch {}
  }, [themePreference]);
  useEffect(() => {
    try {
      localStorage.setItem(
        "workbench.editorTheme",
        JSON.stringify(editorThemePreference),
      );
    } catch {}
  }, [editorThemePreference]);
  useEffect(() => {
    try {
      localStorage.setItem(
        "workbench.editorFontFamily",
        JSON.stringify(editorFontFamily),
      );
    } catch {}
  }, [editorFontFamily]);
  useEffect(() => {
    try {
      localStorage.setItem(
        "workbench.editorFontSize",
        JSON.stringify(editorFontSize),
      );
    } catch {}
  }, [editorFontSize]);
  useEffect(() => {
    try {
      localStorage.setItem("workbench.textSize", JSON.stringify(textSize));
    } catch {}
  }, [textSize]);
  const t: Translate = (source, values) => {
    const translated =
      locale === "pt-BR"
        ? (uiTranslations[source] ??
          roadmapTranslations[source] ??
          labels[source] ??
          source)
        : source;
    return translated.replace(/\{(\w+)\}/g, (match, key: string) =>
      String(values?.[key] ?? match),
    );
  };
  return (
    <PreferencesContext.Provider
      value={{
        locale,
        localePreference,
        theme,
        editorThemePreference,
        resolvedEditorTheme,
        editorFontFamily,
        editorFontSize,
        textSize,
        setLocalePreference,
        setThemePreference,
        setEditorThemePreference,
        setEditorFontFamily,
        setEditorFontSize,
        setTextSize,
        resetDisplayPreferences,
        t,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("PreferencesProvider is required");
  return value;
}

export function PreferencesControls() {
  const {
    t,
    localePreference,
    theme,
    editorThemePreference,
    editorFontFamily,
    editorFontSize,
    textSize,
    setLocalePreference,
    setThemePreference,
    setEditorThemePreference,
    setEditorFontFamily,
    setEditorFontSize,
    setTextSize,
    resetDisplayPreferences,
  } = usePreferences();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!settingsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen]);

  return (
    <div
      className="preferences-controls"
      role="group"
      aria-label={t("Preferences")}
    >
      <label>
        {t("Language")}
        <select
          aria-label={t("Language")}
          value={localePreference}
          onChange={(event) =>
            setLocalePreference(event.target.value as LocalePreference)
          }
        >
          <option value="system">{t("Browser default")}</option>
          <option value="en">English</option>
          <option value="pt-BR">Português (Brasil)</option>
        </select>
      </label>
      <button
        type="button"
        className="theme-toggle"
        aria-label={t("Display & editor settings")}
        title={t("Display & editor settings")}
        aria-expanded={settingsOpen}
        onClick={() => setSettingsOpen(true)}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="theme-toggle"
        aria-label={t(
          theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        )}
        title={t(
          theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        )}
        aria-pressed={theme === "dark"}
        onClick={() => setThemePreference(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? (
          <Sun size={17} aria-hidden="true" />
        ) : (
          <Moon size={17} aria-hidden="true" />
        )}
      </button>
      {settingsOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSettingsOpen(false);
          }}
        >
          <section
            className="confirm-modal settings-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("Display & editor settings")}
          >
            <header className="settings-header">
              <h2>{t("Display & editor settings")}</h2>
              <button
                type="button"
                className="icon-button"
                aria-label={t("Close settings")}
                title={t("Close settings")}
                onClick={() => setSettingsOpen(false)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="settings-fields">
              <label className="settings-field">
                <span>{t("Editor theme")}</span>
                <select
                  aria-label={t("Editor theme")}
                  value={editorThemePreference}
                  onChange={(event) =>
                    setEditorThemePreference(
                      event.target.value as EditorThemeId,
                    )
                  }
                >
                  <option value="auto">{t("Match app theme")}</option>
                  {editorThemeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-field">
                <span>{t("Editor font")}</span>
                <select
                  aria-label={t("Editor font")}
                  value={editorFontFamily}
                  onChange={(event) =>
                    setEditorFontFamily(event.target.value as EditorFontId)
                  }
                >
                  {editorFontOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="settings-field">
                <span>{t("Editor font size")}</span>
                <div className="font-size-stepper">
                  <button
                    type="button"
                    className="secondary"
                    aria-label={t("Decrease editor font size")}
                    disabled={editorFontSize <= MIN_EDITOR_FONT_SIZE}
                    onClick={() => setEditorFontSize(editorFontSize - 1)}
                  >
                    <Minus size={14} />
                  </button>
                  <output aria-live="polite">{editorFontSize}px</output>
                  <button
                    type="button"
                    className="secondary"
                    aria-label={t("Increase editor font size")}
                    disabled={editorFontSize >= MAX_EDITOR_FONT_SIZE}
                    onClick={() => setEditorFontSize(editorFontSize + 1)}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div className="settings-field">
                <span>{t("Interface text")}</span>
                <div
                  className="segmented-control"
                  role="group"
                  aria-label={t("Interface text")}
                >
                  {(
                    [
                      ["default", "Default"],
                      ["large", "Large"],
                      ["xlarge", "Extra large"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      type="button"
                      key={id}
                      className={textSize === id ? "selected" : ""}
                      aria-pressed={textSize === id}
                      onClick={() => setTextSize(id)}
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="settings-footer">
              <button
                type="button"
                className="secondary"
                onClick={resetDisplayPreferences}
              >
                {t("Reset defaults")}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
