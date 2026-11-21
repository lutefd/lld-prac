// Bounded exhaustive check of validateNewFile (server/index.ts): user-created file paths.
// Usage: node .agents/skills/verify-file-paths/check.ts [--module <path-to-index.ts>] [--segments N]
// Enumerates every path made of 1..N segments from a hostile alphabet (".." "." "" "hidden_x" casing variants, backslash, ...),
// for each language and several existing-file sets, and checks every ACCEPTED path against an independent safety oracle.
import path from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const opt = (n: string, d: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const modulePath = path.resolve(opt("--module", path.join(import.meta.dirname, "../../../server/index.ts")));
const MAXSEG = Number(opt("--segments", "3"));
const { validateNewFile } = await import(pathToFileURL(modulePath).href);

const EXT: Record<string, string> = { go: ".go", python: ".py", typescript: ".ts", java: ".java" };
const atoms = ["implementation.go", "implementation.py", "implementation.ts", "Implementation.java", "driver.go", "implementation", "Implementation", "driver", "Driver", "level_1_test", "a", "A", "models", "Models", "..", ".", "", "hidden_x", "HIDDEN_y", "a b", "é", "-a", "_a", "a..b", "a\\b", "~", "x"];
const suffixes = ["", ".go", ".py", ".ts", ".java", "/", "/..", "/../a.go", "/a.go"];
const root = "/ws/root";
const original = (paths: string[]) => paths.map((p) => ({ path: p, content: "", readOnly: true }));
const existing: Record<string, string[]> = {
  go: ["implementation.go", "models/driver.go", "level_1_test.go"],
  python: ["implementation.py", "models/driver.py"],
  typescript: ["implementation.ts", "models/driver.ts"],
  java: ["Implementation.java", "models/Driver.java"],
};

function safetyViolation(p: string, lang: string, originals: string[]): string | null {
  const segs = p.split("/");
  if (typeof p !== "string" || p.length === 0) return "accepted an empty path";
  if (p.length > 240) return "accepted a path longer than 240 characters";
  if (segs.length > 12) return "accepted more than 12 path segments";
  if (p.includes("\\")) return "accepted a backslash path";
  if (p.startsWith("/") || /^[A-Za-z]:/.test(p)) return "accepted an absolute path";
  if (segs.some((s) => s === "" || s === "." || s === "..")) return "accepted an empty, '.' or '..' segment (path traversal)";
  const resolved = path.resolve(root, p);
  if (!resolved.startsWith(root + path.sep)) return `path resolves outside the workspace (${resolved})`;
  if (segs.some((s) => /^hidden_/i.test(s))) return "accepted a hidden_ segment (would expose or shadow hidden tests)";
  if (!p.endsWith(EXT[lang])) return `accepted a file without the ${EXT[lang]} extension`;
  if (segs.some((s) => !/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(s))) return "accepted a segment with disallowed characters or a leading dot/dash";
  const f = p.toLowerCase();
  for (const o of originals) {
    const l = o.toLowerCase();
    if (l === f) return `accepted ${p}, which equals existing ${o} ignoring case`;
    if (f.startsWith(l + "/")) return `accepted ${p} inside existing file ${o}`;
    if (l.startsWith(f + "/")) return `accepted ${p}, which is a parent folder of existing ${o}`;
    const os = o.split("/");
    for (let i = 0; i < Math.min(segs.length, os.length) - 1; i++) {
      if (segs[i].toLowerCase() !== os[i].toLowerCase()) break;
      if (segs[i] !== os[i]) return `accepted ${p}: folder casing differs from existing ${o}`;
    }
  }
  return null;
}

const mustAccept: [string, string][] = [
  ["go", "helper.go"], ["go", "helpers/pricing.go"], ["go", "a/b/c.go"], ["python", "util.py"], ["typescript", "lib/x.ts"], ["java", "Helper.java"], ["go", "models/other.go"],
];

function* candidates(): Generator<unknown> {
  yield* [undefined, null, 42, {}, [], ["a.go"], "", "/", "/a.go", "C:/a.go", "a.go/", "a//b.go", "a".repeat(300) + ".go", Array(14).fill("a").join("/") + ".go"];
  const build = function* (n: number, prefix: string[]): Generator<string[]> {
    if (prefix.length === n) { yield prefix; return; }
    for (const a of atoms) yield* build(n, [...prefix, a]);
  };
  for (let n = 1; n <= MAXSEG; n++)
    for (const segs of build(n, [])) for (const suf of suffixes) yield segs.join("/") + suf;
}

let checked = 0, accepted = 0;
const failures: string[] = [];
for (const [lang, files] of Object.entries(existing)) {
  const originals = original(files);
  for (const cand of candidates()) {
    checked++;
    let out: unknown, threw = false;
    try { out = validateNewFile(cand, lang, originals); } catch { threw = true; }
    if (threw) continue;
    accepted++;
    const bad = typeof cand !== "string" ? "accepted a non-string path" : out !== cand ? "returned a different path than it was given" : safetyViolation(cand, lang, files);
    if (bad) { failures.push(`[${lang}] ${JSON.stringify(cand)}: ${bad}`); if (failures.length >= 5) break; }
  }
  for (const [l, p] of mustAccept) if (l === lang) {
    try { validateNewFile(p, l, originals); } catch (e) { failures.push(`[${l}] rejected the ordinary path ${p}: ${(e as Error).message}`); }
  }
  if (failures.length >= 5) break;
}
if (failures.length) {
  console.log("FAIL");
  failures.forEach((f) => console.log("  " + f));
  process.exit(1);
}
console.log(`PASS  ${checked} path/language pairs checked, ${accepted} accepted and every one met the safety oracle (segments<=${MAXSEG}) on ${path.relative(process.cwd(), modulePath)}`);
