import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, Code2 } from "lucide-react";
import { roadmap } from "../shared/roadmap";
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
  const [language, setLanguage] = useState(() =>
    stored("workbench.language", "go"),
  );
  const progress = (problem: RoadmapProblem) =>
    Math.max(
      0,
      Math.min(
        problem.levels.length,
        stored(`workbench.progress.${problem.id}.${language}`, 1) - 1,
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
      <nav className="roadmap-nav" aria-label="Roadmap navigation">
        <a
          href={practiceUrl(lastProblem?.id || next?.[0] || problems[0].id)}
          onClick={followLink}
        >
          <ArrowLeft size={16} />{" "}
          {lastProblem ? "Resume practice" : "Start practicing"}
        </a>
        <span>
          <Code2 size={19} /> workbench.
        </span>
      </nav>
      <header className="roadmap-intro">
        <span className="eyebrow">YOUR PRACTICE PATH</span>
        <h1>Small steps. Stronger designs.</h1>
        <p>
          A suggested order from your first collection to systems with competing
          rules. Finish all three levels of each case, then move on. You can
          jump ahead whenever you feel ready.
        </p>
        <div className="roadmap-controls">
          <label>
            Progress in{" "}
            <select
              aria-label="Roadmap language"
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                try {
                  localStorage.setItem(
                    "workbench.language",
                    JSON.stringify(e.target.value),
                  );
                } catch {}
              }}
            >
              <option value="go">Go</option>
              <option value="python">Python</option>
              <option value="typescript">TypeScript</option>
            </select>
          </label>
          <span>
            {completed} of {problems.length} exercises completed
          </span>
          {next && (
            <a
              className="primary"
              href={practiceUrl(next[0])}
              onClick={followLink}
            >
              Continue the path <ArrowUpRight size={16} />
            </a>
          )}
        </div>
      </header>
      <aside className="roadmap-method" aria-label="How to practice">
        <strong>Make each case count</strong>
        <p>
          Read one level. List its invariants and try a simple design. Add your
          own boundary tests, then run the supplied checks. After passing,
          explain your tradeoffs and revisit the case later without your old
          solution. Leave the timer off while learning; use it on a second
          attempt.
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
              <h2 id={`stage-${index}`}>{stage.title}</h2>
              <p>{stage.description}</p>
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
                        <Check size={17} aria-label="Completed" />
                      ) : (
                        String(number).padStart(2, "0")
                      )}
                    </span>
                    <span className="roadmap-case">
                      <strong>{problem.title}</strong>
                      <span>{reason}</span>
                    </span>
                    <span
                      className={`difficulty ${problem.difficulty.toLowerCase()}`}
                    >
                      {problem.difficulty}
                    </span>
                    <span className="roadmap-progress">
                      {passed}/{problem.levels.length} levels
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
