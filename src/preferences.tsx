import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Moon, Sun } from "lucide-react";
import { uiTranslations } from "./uiTranslations";
import { roadmapTranslations } from "./roadmapTranslations";
import "./preferences.css";

type Locale = "en" | "pt-BR";
type LocalePreference = "system" | Locale;
type ThemePreference = "system" | "light" | "dark";
type Translate = (
  source: string,
  values?: Record<string, string | number>,
) => string;
const labels: Record<string, string> = {
  Language: "Idioma",
  "Browser default": "Padrão do navegador",
  "Switch to light theme": "Ativar tema claro",
  "Switch to dark theme": "Ativar tema escuro",
  Preferences: "Preferências",
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
export function browserLocale(languages: readonly string[]): Locale {
  return languages[0]?.toLowerCase().split("-")[0] === "pt" ? "pt-BR" : "en";
}
const PreferencesContext = createContext<{
  locale: Locale;
  localePreference: LocalePreference;
  theme: "light" | "dark";
  setLocalePreference: (value: LocalePreference) => void;
  setThemePreference: (value: ThemePreference) => void;
  t: Translate;
} | null>(null);
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [localePreference, setLocalePreference] = useState<LocalePreference>(
    () => storedChoice("workbench.locale", ["system", "en", "pt-BR"], "system"),
  );
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    storedChoice("workbench.theme", ["system", "light", "dark"], "system"),
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
        setLocalePreference,
        setThemePreference,
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
    setLocalePreference,
    setThemePreference,
  } = usePreferences();
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
    </div>
  );
}
