import test from "node:test";
import assert from "node:assert/strict";
import { problems } from "./problems.ts";
import { roadmap } from "./roadmap.ts";

test("roadmap covers every exercise exactly once and places bridges before advanced cases", () => {
  const ids: string[] = roadmap.flatMap((stage) =>
    stage.exercises.map(([id]) => id),
  );
  assert.equal(
    new Set(ids).size,
    ids.length,
    "an exercise should have one recommended position",
  );
  assert.deepEqual([...ids].sort(), problems.map((p) => p.id).sort());
  assert.deepEqual(ids.slice(0, 2), ["bounded-stack", "fifo-queue"]);
  const easyIds = problems
    .filter((p) => p.difficulty === "Easy")
    .map((p) => p.id);
  assert.equal(easyIds.length, 13, "provide a substantial beginner ramp");
  assert.deepEqual(ids.slice(0, easyIds.length).sort(), easyIds.sort());
  assert.ok(ids.indexOf("vending-machine") < ids.indexOf("account-transfers"));
  assert.ok(
    ids.indexOf("dependency-planner") < ids.indexOf("delayed-job-queue"),
  );
  assert.ok(
    ids.indexOf("dependency-planner") < ids.indexOf("multi-level-garage"),
  );
  const firstHard = ids.find(
    (id) => problems.find((p) => p.id === id)?.difficulty === "Hard",
  );
  assert.equal(firstHard, "dependency-planner");
  assert.ok(
    roadmap.every((stage) =>
      stage.exercises.every(([, reason]) => reason.length > 30),
    ),
  );
});
