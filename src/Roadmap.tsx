import { PreferencesControls, usePreferences } from "./preferences";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, Code2, UserRound } from "lucide-react";
import { roadmap } from "../shared/roadmap";
import type { Language, ProgressMap } from "../shared/account";
import "./roadmap.css";
import { followLink, practiceUrl } from "./navigation";

type RoadmapProblem = {
  id: string;
  title: string;
  difficulty: string;
  levels: unknown[];
};
function stored<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
export default function Roadmap({ problems }: { problems: RoadmapProblem[] }) {
  const { t } = usePreferences();
  const [language, setLanguage] = useState<Language>(() =>
    stored<Language>("workbench.language", "go"),
  );
  const [progressMap, setProgressMap] = useState<ProgressMap>({});

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/progress", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { progress?: ProgressMap };
        if (data.progress) setProgressMap(data.progress);
      })
      .catch(() => {
        // Absent progress defaults to level 1; ignore aborts or transient errors.
      });
    return () => controller.abort();
  }, []);

  const progress = (problem: RoadmapProblem) =>
    Math.max(
      0,
      Math.min(
        problem.levels.length,
        (progressMap[problem.id]?.[language] ?? 1) - 1,
      ),
    );
  const completed = problems.filter(
    (p) => progress(p) === p.levels.length,
  ).length;
  const next = roadmap
    .flatMap((stage) => [...stage.exercises])
    .find(([id]) => {
      const problem = problems.find((p) => p.id === id);
      return problem && progress(problem) < problem.levels.length;
    });
  const lastProblem = problems.find(
    (p) => p.id === stored("workbench.problem", ""),
  );
  let position = 0;
  return (
    <main className="roadmap-page">
      <nav className="roadmap-nav" aria-label={t("Roadmap navigation")}>
        <a
          href={practiceUrl(lastProblem?.id || next?.[0] || problems[0].id)}
          onClick={followLink}
        >
          <ArrowLeft size={16} />{" "}
          {t(lastProblem ? "Resume practice" : "Start practicing")}
        </a>
        <span>
          <Code2 size={19} /> workbench.
        </span>
        <div className="roadmap-nav-actions">
          <a
            className="account-trigger"
            href="/account"
            onClick={followLink}
            aria-label={t("Account")}
            title={t("Account")}
          >
            <UserRound size={16} aria-hidden="true" />
          </a>
          <PreferencesControls />
        </div>
      </nav>
      <header className="roadmap-intro">
        <span className="eyebrow">{t("YOUR PRACTICE PATH")}</span>
        <h1>{t("Small steps. Stronger designs.")}</h1>
        <p>
          {t(
            "A suggested order from your first collection to systems with competing rules. Finish all three levels of each case, then move on. You can jump ahead whenever you feel ready.",
          )}
        </p>
        <div className="roadmap-controls">
          <label>
            {t("Progress in")}{" "}
            <select
              aria-label={t("Roadmap language")}
              value={language}
              onChange={(e) => {
                const nextLanguage = e.target.value as Language;
                setLanguage(nextLanguage);
                try {
                  localStorage.setItem(
                    "workbench.language",
                    JSON.stringify(nextLanguage),
                  );
                } catch {
                  // Ignore storage quota or private-mode errors.
                }
              }}
            >
              <option value="go">Go</option>
              <option value="python">Python</option>
              <option value="typescript">TypeScript</option>
              <option value="java">Java</option>
            </select>
          </label>
          <span>
            {t("{completed} of {total} exercises completed", {
              completed,
              total: problems.length,
            })}
          </span>
          {next && (
            <a
              className="primary"
              href={practiceUrl(next[0])}
              onClick={followLink}
            >
              {t("Continue the path")} <ArrowUpRight size={16} />
            </a>
          )}
        </div>
      </header>
      <aside className="roadmap-method" aria-label={t("How to practice")}>
        <strong>{t("Make each case count")}</strong>
        <p>
          {t(
            "Read one level. List its invariants and try a simple design. Add your own boundary tests and click Run tests. When the checks pass, click Submit to complete the level. Explain your tradeoffs and revisit the case later without your old solution. Leave the timer off while learning and use it when you revisit the case.",
          )}
        </p>
      </aside>
      {roadmap.map((stage, index) => (
        <section
          className="roadmap-stage"
          key={stage.title}
          aria-labelledby={`stage-${index}`}
        >
          <header>
            <span className="roadmap-stage-number">0{index + 1}</span>
            <div>
              <h2 id={`stage-${index}`}>{t(stage.title)}</h2>
              <p>{t(stage.description)}</p>
            </div>
          </header>
          <ol className="roadmap-exercises" start={position + 1}>
            {stage.exercises.map(([id, reason]) => {
              const problem = problems.find((p) => p.id === id);
              if (!problem) return null;
              const number = ++position;
              const passed = progress(problem);
              return (
                <li key={id}>
                  <a href={practiceUrl(id)} onClick={followLink}>
                    <span
                      className={`roadmap-step ${passed === problem.levels.length ? "complete" : ""}`}
                    >
                      {passed === problem.levels.length ? (
                        <Check size={17} aria-label={t("Completed")} />
                      ) : (
                        String(number).padStart(2, "0")
                      )}
                    </span>
                    <span className="roadmap-case">
                      <strong>{problem.title}</strong>
                      <span>{t(reason)}</span>
                    </span>
                    <span
                      className={`difficulty ${problem.difficulty.toLowerCase()}`}
                    >
                      {t(problem.difficulty)}
                    </span>
                    <span className="roadmap-progress">
                      {passed}/{problem.levels.length} {t("levels")}
                    </span>
                    <ArrowUpRight size={16} />
                  </a>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </main>
  );
}
