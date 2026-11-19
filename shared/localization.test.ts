import assert from "node:assert/strict";
import test from "node:test";
import { problems } from "./problems.ts";
import { roadmap } from "./roadmap.ts";
import { localizeProblem } from "../src/problemTranslations.ts";
import { roadmapTranslations } from "../src/roadmapTranslations.ts";

test("Portuguese covers the complete catalog and preserves code, contracts, and examples", () => {
  for (const problem of problems) {
    assert.equal(localizeProblem(problem, "en"), problem);
    const translated = localizeProblem(problem, "pt-BR");
    assert.notEqual(translated.title, problem.title, problem.id);
    assert.notEqual(translated.summary, problem.summary, problem.id);
    assert.equal(translated.id, problem.id);
    assert.equal(
      translated.files,
      problem.files,
      "Code files must remain untouched",
    );
    assert.equal(translated.category, problem.category);
    assert.equal(translated.difficulty, problem.difficulty);
    assert.equal(translated.levels.length, problem.levels.length);
    translated.levels.forEach((level, i) => {
      const original = problem.levels[i];
      assert.notEqual(
        level.title,
        original.title,
        `${problem.id} level ${i + 1}`,
      );
      assert.notEqual(
        level.description,
        original.description,
        `${problem.id} level ${i + 1}`,
      );
      assert.deepEqual(
        level.examples,
        original.examples,
        "Code examples must remain untouched",
      );
      assert.equal(level.requirements.length, original.requirements.length);
      level.requirements.forEach((requirement, j) => {
        assert.notEqual(
          requirement,
          original.requirements[j],
          `${problem.id} requirement ${j + 1}`,
        );
      });
    });
  }
});

test("every roadmap stage and exercise rationale has a Portuguese translation", () => {
  for (const stage of roadmap) {
    for (const source of [
      stage.title,
      stage.description,
      ...stage.exercises.map(([, reason]) => reason),
    ]) {
      assert.ok(roadmapTranslations[source], source);
      assert.notEqual(roadmapTranslations[source], source);
    }
  }
});
