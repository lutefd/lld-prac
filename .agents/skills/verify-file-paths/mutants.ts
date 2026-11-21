// Proves check.ts can fail: breaks a COPY of server/index.ts (written next to it so relative imports resolve, deleted after).
// Usage: node .agents/skills/verify-file-paths/mutants.ts   (exit 0 only if every mutant is caught)
// If a mutant's `old` text is STALE, update it to the equivalent line; do not delete the mutant.
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
const here = import.meta.dirname;
const serverDir = path.join(here, "../../../server");
const source = readFileSync(path.join(serverDir, "index.ts"), "utf8");
type Edit = [string, string];
const RE = "/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/";
const mutants: [string, Edit[]][] = [
  ["backslash allowed (explicit check and character class both loosened)", [['    filePath.includes("\\\\") ||\n', ""], [RE, "/^[A-Za-z0-9_][A-Za-z0-9_.\\\\-]*$/"]]],
  ["absolute path allowed (explicit check and empty-segment rejection both loosened)", [["    path.isAbsolute(filePath)\n", "    false\n"], [RE, "/^[A-Za-z0-9_]*[A-Za-z0-9_.-]*$/"]]],
  ["hidden_ segments allowed", [["        /^hidden_/i.test(segment),", "        false,"]]],
  ["leading dot allowed (..)", [[RE, "/^[A-Za-z0-9_.][A-Za-z0-9_.-]*$/"]]],
  ["extension not enforced", [["if (!filePath.endsWith(extension))", "if (false)"]]],
  ["case-insensitive collision allowed", [["      existing === folded ||\n", ""]]],
  ["file inside existing file allowed", [["      folded.startsWith(`${existing}/`)", "      false"]]],
  ["folder casing conflict allowed", [['throw new Error("Directory casing conflicts with an existing path");', ""]]],
  ["segment limit removed", [["    segments.length > 12 ||\n", ""]]],
];
let missed = 0;
for (const [i, [name, edits]] of mutants.entries()) {
  let mutated = source;
  let stale = false;
  for (const [old, replacement] of edits) {
    if (mutated.split(old).length !== 2) stale = true;
    else mutated = mutated.replace(old, replacement);
  }
  if (stale) { console.log(`STALE   ${name}: text not found exactly once`); missed++; continue; }
  const file = path.join(serverDir, `.mutant-${i}.ts`);
  writeFileSync(file, mutated);
  try {
    const r = spawnSync(process.execPath, [path.join(here, "check.ts"), "--module", file], { encoding: "utf8" });
    const caught = r.status === 1;
    console.log(`${caught ? "caught" : "MISSED"}  ${name}`);
    if (!caught) missed++;
  } finally { rmSync(file, { force: true }); }
}
process.exit(missed ? 1 : 0);
