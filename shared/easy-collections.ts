import type { PracticeProblem } from "./problems.ts";
import { caseFiles, type Command } from "./case-support.ts";

const level = (
  title: string,
  description: string,
  requirements: string[],
  input: string,
  output: string,
) => ({ title, description, requirements, examples: [{ input, output }] });
const eq = (expression: string, expected: unknown): Command => ({
  kind: "eq",
  expression,
  expected,
});
const run = (expression: string): Command => ({ kind: "run", expression });
const setup = (expression: string): Command => ({
  kind: "assign",
  name: "s",
  expression,
});

export const easyCollectionApi: Record<string, [string, string, string[]]> = {
  "score-tracker": [
    "ScoreTracker",
    "",
    [
      "Add|name:s|b",
      "Score|name:s|money",
      "Award|name:s,points:n|b",
      "Reset|name:s|b",
      "Leaders|limit:n|strings",
    ],
  ],
  "contact-directory": [
    "Directory",
    "",
    [
      "Add|name:s,phone:s|b",
      "Get|name:s|pair",
      "Update|name:s,phone:s|b",
      "Delete|name:s|b",
      "Search|prefix:s|strings",
    ],
  ],
};
export const easyCollectionTests: Record<string, Command[][]> = {
  "score-tracker": [
    [
      setup("NewScoreTracker()"),
      eq('s.Score("missing")', [0, false]),
      eq('s.Add("ana")', true),
      eq('s.Add("ana")', false),
      eq('s.Add("")', false),
      eq('s.Score("ana")', [0, true]),
    ],
    [
      setup("NewScoreTracker()"),
      run('s.Add("ana")'),
      eq('s.Award("ana",5)', true),
      eq('s.Award("ana",3)', true),
      eq('s.Score("ana")', [8, true]),
      eq('s.Award("ana",-1)', false),
      eq('s.Award("missing",2)', false),
      eq('s.Reset("ana")', true),
      eq('s.Score("ana")', [0, true]),
      eq('s.Reset("missing")', false),
    ],
    [
      setup("NewScoreTracker()"),
      run('s.Add("zoe")'),
      run('s.Add("ana")'),
      run('s.Add("bob")'),
      run('s.Award("zoe",10)'),
      run('s.Award("ana",10)'),
      run('s.Award("bob",2)'),
      eq("s.Leaders(2)", ["ana", "zoe"]),
      eq("s.Leaders(10)", ["ana", "zoe", "bob"]),
      eq("s.Leaders(0)", []),
      eq("s.Leaders(-1)", []),
      run('s.Reset("ana")'),
      eq("s.Leaders(3)", ["zoe", "bob", "ana"]),
    ],
  ],
  "contact-directory": [
    [
      setup("NewDirectory()"),
      eq('s.Get("missing")', ["", false]),
      eq('s.Add("Ana","123")', true),
      eq('s.Add("Ana","999")', false),
      eq('s.Add("","123")', false),
      eq('s.Add("Bob","")', false),
      eq('s.Get("Ana")', ["123", true]),
    ],
    [
      setup("NewDirectory()"),
      run('s.Add("Ana","123")'),
      eq('s.Update("Ana","456")', true),
      eq('s.Get("Ana")', ["456", true]),
      eq('s.Update("Ana","")', false),
      eq('s.Update("missing","1")', false),
      eq('s.Get("Ana")', ["456", true]),
      eq('s.Delete("Ana")', true),
      eq('s.Delete("Ana")', false),
      eq('s.Get("Ana")', ["", false]),
      eq('s.Add("Ana","789")', true),
    ],
    [
      setup("NewDirectory()"),
      run('s.Add("Anne","1")'),
      run('s.Add("Ana","2")'),
      run('s.Add("Bob","3")'),
      eq('s.Search("An")', ["Ana", "Anne"]),
      eq('s.Search("")', ["Ana", "Anne", "Bob"]),
      eq('s.Search("an")', []),
      run('s.Delete("Ana")'),
      eq('s.Search("An")', ["Anne"]),
    ],
  ],
};
export const easyCollectionHidden: Record<string, Command[][]> = {
  "score-tracker": [
    [
      setup("NewScoreTracker()"),
      eq('s.Add("A")', true),
      eq('s.Add("a")', true),
      eq('s.Score("A")', [0, true]),
      eq('s.Score("a")', [0, true]),
      eq('s.Score("")', [0, false]),
    ],
    [
      setup("NewScoreTracker()"),
      run('s.Add("a")'),
      run('s.Add("b")'),
      eq('s.Award("a",0)', true),
      run('s.Award("a",7)'),
      eq('s.Add("a")', false),
      eq('s.Score("a")', [7, true]),
      eq('s.Award("a",-2)', false),
      eq('s.Score("a")', [7, true]),
      eq('s.Score("b")', [0, true]),
      eq('s.Reset("b")', true),
    ],
    [
      setup("NewScoreTracker()"),
      eq("s.Leaders(5)", []),
      run('s.Add("b")'),
      run('s.Add("a")'),
      { kind: "assign", name: "leaders", expression: "s.Leaders(2)" },
      run('leaders[0] = "changed"'),
      eq("s.Leaders(2)", ["a", "b"]),
      run('s.Award("b",1)'),
      eq("s.Leaders(1)", ["b"]),
      eq('s.Score("b")', [1, true]),
    ],
  ],
  "contact-directory": [
    [
      setup("NewDirectory()"),
      run('s.Add("A","1")'),
      eq('s.Add("a","2")', true),
      eq('s.Get("A")', ["1", true]),
      eq('s.Get("a")', ["2", true]),
      eq('s.Get("")', ["", false]),
    ],
    [
      setup("NewDirectory()"),
      run('s.Add("a","1")'),
      run('s.Add("b","2")'),
      eq('s.Update("a","1")', true),
      eq('s.Delete("missing")', false),
      eq('s.Update("","3")', false),
      eq('s.Delete("a")', true),
      eq('s.Get("b")', ["2", true]),
      eq('s.Add("a","3")', true),
      eq('s.Get("a")', ["3", true]),
    ],
    [
      setup("NewDirectory()"),
      eq('s.Search("")', []),
      run('s.Add("ann","1")'),
      run('s.Add("anna","2")'),
      run('s.Add("bob","3")'),
      { kind: "assign", name: "matches", expression: 's.Search("ann")' },
      run('matches[0] = "changed"'),
      eq('s.Search("ann")', ["ann", "anna"]),
      run('s.Update("ann","9")'),
      eq('s.Search("ann")', ["ann", "anna"]),
      eq('s.Get("ann")', ["9", true]),
      eq('s.Search("aN")', []),
    ],
  ],
};

export const easyCollectionProblems: PracticeProblem[] = [
  {
    id: "score-tracker",
    title: "Score tracker",
    category: "Fundamentals",
    difficulty: "Easy",
    duration: 30,
    packageName: "practice",
    summary:
      "Register players, update their scores, and build a small deterministic leaderboard.",
    tags: ["Beginner", "Maps", "Sorting"],
    levels: [
      level(
        "Register players",
        "Keep one score per player name.",
        [
          "NewScoreTracker() *ScoreTracker starts empty. Add(name string) bool registers a nonempty unique name with score zero. Empty or duplicate names return false without changing stored scores.",
          "Score(name string) (int, bool) returns the registered score or (0, false) if unknown. Names are case sensitive; no whitespace trimming or other validation is required.",
        ],
        'Add("ana"); Add("ana"); Score("ana")',
        "true; false; (0, true)",
      ),
      level(
        "Award and reset points",
        "Change existing scores while keeping players registered.",
        [
          "Award(name string, points int) bool adds nonnegative points to a registered player. Zero points is valid; negative points or unknown names return false without changes. Score totals fit in int and the TypeScript safe integer range.",
          "Reset(name string) bool sets a registered player's score to zero, returning true even if already zero. Unknown players return false. Updating one player never changes another player's score.",
        ],
        'Add("ana"); Award("ana",5); Award("ana",3); Score("ana"); Reset("ana")',
        "true; true; true; (8, true); true",
      ),
      level(
        "List the leaders",
        "Order player names by their current scores.",
        [
          "Leaders(limit int) []string returns up to limit registered player names, ordered by descending score and then lexicographically ascending name to break ties. Include players with score zero.",
          "Zero or negative limits return an empty slice. A limit larger than the player count returns every player. This query never changes scores; return a defensive copy so changing returned names cannot alter the tracker.",
        ],
        'Add("zoe"); Add("ana"); Award("zoe",10); Award("ana",10); Leaders(2)',
        'true; true; true; true; ["ana", "zoe"]',
      ),
    ],
    files: caseFiles(
      `type ScoreTracker struct {}\nfunc NewScoreTracker() *ScoreTracker { return &ScoreTracker{} }\nfunc (s *ScoreTracker) Add(name string) bool { return false }\nfunc (s *ScoreTracker) Score(name string) (int, bool) { return 0, false }\nfunc (s *ScoreTracker) Award(name string, points int) bool { return false }\nfunc (s *ScoreTracker) Reset(name string) bool { return false }\nfunc (s *ScoreTracker) Leaders(limit int) []string { return nil }`,
      [
        's:=NewScoreTracker(); if _,ok:=s.Score("missing"); ok {t.Fatal("unknown player found")}; if !s.Add("ana") || s.Add("ana") || s.Add("") {t.Fatal("registration validation incorrect")}; if n,ok:=s.Score("ana"); !ok || n!=0 {t.Fatal("initial score must be zero")}',
        's:=NewScoreTracker(); s.Add("ana"); if !s.Award("ana",5) || !s.Award("ana",3) {t.Fatal("award rejected")}; if n,ok:=s.Score("ana"); !ok || n!=8 {t.Fatal("awards must accumulate")}; if s.Award("ana",-1) || s.Award("missing",2) {t.Fatal("invalid award accepted")}; if !s.Reset("ana") || s.Reset("missing") {t.Fatal("reset behavior incorrect")}; if n,ok:=s.Score("ana"); !ok || n!=0 {t.Fatal("reset must retain registered player")}',
        's:=NewScoreTracker(); s.Add("zoe"); s.Add("ana"); s.Add("bob"); s.Award("zoe",10); s.Award("ana",10); s.Award("bob",2); a:=s.Leaders(2); if len(a)!=2 || a[0]!="ana" || a[1]!="zoe" {t.Fatal("leader order or limit incorrect")}; a=s.Leaders(10); if len(a)!=3 || a[2]!="bob" {t.Fatal("oversized limit incorrect")}; if len(s.Leaders(0))!=0 || len(s.Leaders(-1))!=0 {t.Fatal("nonpositive limit must be empty")}; s.Reset("ana"); a=s.Leaders(3); if len(a)!=3 || a[0]!="zoe" || a[1]!="bob" || a[2]!="ana" {t.Fatal("ranking did not update")}',
      ],
      [
        's:=NewScoreTracker(); if !s.Add("A") || !s.Add("a") {t.Fatal("names must be case sensitive")}; for _,name:=range []string{"A","a"} {if n,ok:=s.Score(name); !ok || n!=0 {t.Fatal("players not isolated")}}; if _,ok:=s.Score(""); ok {t.Fatal("empty name found")}',
        's:=NewScoreTracker(); s.Add("a"); s.Add("b"); if !s.Award("a",0) {t.Fatal("zero award rejected")}; s.Award("a",7); if s.Add("a") || s.Award("a",-2) {t.Fatal("invalid operation accepted")}; if n,_:=s.Score("a"); n!=7 {t.Fatal("rejected operation changed score")}; if n,_:=s.Score("b"); n!=0 {t.Fatal("award leaked to other player")}; if !s.Reset("b") {t.Fatal("already zero reset rejected")}',
        's:=NewScoreTracker(); if len(s.Leaders(5))!=0 {t.Fatal("empty tracker has leaders")}; s.Add("b"); s.Add("a"); a:=s.Leaders(2); if len(a)!=2 {t.Fatal("zero score players missing")}; a[0]="changed"; a=s.Leaders(2); if len(a)!=2 || a[0]!="a" || a[1]!="b" {t.Fatal("leaders leaked storage or tie order incorrect")}; s.Award("b",1); a=s.Leaders(1); if len(a)!=1 || a[0]!="b" {t.Fatal("score update not ranked")}; if n,_:=s.Score("b"); n!=1 {t.Fatal("query changed score")}',
      ],
    ),
  },
  {
    id: "contact-directory",
    title: "Contact directory",
    category: "Fundamentals",
    difficulty: "Easy",
    duration: 30,
    packageName: "practice",
    summary:
      "Store contacts by name, edit their phone numbers, and search names by a simple prefix.",
    tags: ["Beginner", "Maps", "Prefix search"],
    levels: [
      level(
        "Add and look up contacts",
        "Store one phone string for each contact name.",
        [
          "NewDirectory() *Directory starts empty. Add(name, phone string) bool stores a contact only when both strings are nonempty and the name is not already present. Failed calls leave stored contacts unchanged.",
          'Get(name string) (string, bool) returns the stored phone or ("", false) if unknown. Names are case sensitive. Phone strings need no format validation, and no input is trimmed.',
        ],
        'Add("Ana","123"); Add("Ana","999"); Get("Ana")',
        'true; false; ("123", true)',
      ),
      level(
        "Edit and remove contacts",
        "Change a phone number without creating another contact.",
        [
          "Update(name, phone string) bool changes an existing contact's phone to a nonempty string. Return true even if the phone is unchanged. Unknown names or empty phones return false without changes.",
          "Delete(name string) bool removes an existing contact and returns true; unknown names return false. A deleted name may be added again. Updates and deletions never change other contacts.",
        ],
        'Add("Ana","123"); Update("Ana","456"); Get("Ana"); Delete("Ana"); Get("Ana")',
        'true; true; ("456", true); true; ("", false)',
      ),
      level(
        "Find names by prefix",
        "Build a small, predictable contact search.",
        [
          "Search(prefix string) []string returns contact names starting with the exact, case-sensitive prefix, sorted lexicographically. The empty prefix matches all names; no matches returns an empty slice.",
          "Return names only, without phone numbers. Search never changes contacts, reflects current additions and deletions, and returns a defensive copy: mutating its result cannot rename or remove a stored contact.",
        ],
        'Add("Anne","1"); Add("Ana","2"); Add("Bob","3"); Search("An")',
        'true; true; true; ["Ana", "Anne"]',
      ),
    ],
    files: caseFiles(
      `type Directory struct {}\nfunc NewDirectory() *Directory { return &Directory{} }\nfunc (d *Directory) Add(name, phone string) bool { return false }\nfunc (d *Directory) Get(name string) (string, bool) { return "", false }\nfunc (d *Directory) Update(name, phone string) bool { return false }\nfunc (d *Directory) Delete(name string) bool { return false }\nfunc (d *Directory) Search(prefix string) []string { return nil }`,
      [
        'd:=NewDirectory(); if _,ok:=d.Get("missing"); ok {t.Fatal("unknown contact found")}; if !d.Add("Ana","123") || d.Add("Ana","999") || d.Add("","123") || d.Add("Bob","") {t.Fatal("add validation incorrect")}; if p,ok:=d.Get("Ana"); !ok || p!="123" {t.Fatal("duplicate overwrote phone")}',
        'd:=NewDirectory(); d.Add("Ana","123"); if !d.Update("Ana","456") {t.Fatal("update rejected")}; if p,ok:=d.Get("Ana"); !ok || p!="456" {t.Fatal("phone not updated")}; if d.Update("Ana","") || d.Update("missing","1") {t.Fatal("invalid update accepted")}; if p,_:=d.Get("Ana"); p!="456" {t.Fatal("failed update changed phone")}; if !d.Delete("Ana") || d.Delete("Ana") {t.Fatal("delete behavior incorrect")}; if _,ok:=d.Get("Ana"); ok {t.Fatal("deleted contact found")}; if !d.Add("Ana","789") {t.Fatal("deleted name cannot be reused")}',
        'd:=NewDirectory(); d.Add("Anne","1"); d.Add("Ana","2"); d.Add("Bob","3"); a:=d.Search("An"); if len(a)!=2 || a[0]!="Ana" || a[1]!="Anne" {t.Fatal("prefix search order incorrect")}; a=d.Search(""); if len(a)!=3 || a[2]!="Bob" {t.Fatal("empty prefix must match all")}; if len(d.Search("an"))!=0 {t.Fatal("search must be case sensitive")}; d.Delete("Ana"); a=d.Search("An"); if len(a)!=1 || a[0]!="Anne" {t.Fatal("search retained deleted name")}',
      ],
      [
        'd:=NewDirectory(); d.Add("A","1"); if !d.Add("a","2") {t.Fatal("case-sensitive name rejected")}; if p,ok:=d.Get("A"); !ok || p!="1" {t.Fatal("uppercase lookup incorrect")}; if p,ok:=d.Get("a"); !ok || p!="2" {t.Fatal("lowercase lookup incorrect")}; if _,ok:=d.Get(""); ok {t.Fatal("empty name found")}',
        'd:=NewDirectory(); d.Add("a","1"); d.Add("b","2"); if !d.Update("a","1") || d.Delete("missing") || d.Update("","3") {t.Fatal("update/delete boundary incorrect")}; if !d.Delete("a") {t.Fatal("delete rejected")}; if p,ok:=d.Get("b"); !ok || p!="2" {t.Fatal("delete changed other contact")}; if !d.Add("a","3") {t.Fatal("name reuse rejected")}; if p,ok:=d.Get("a"); !ok || p!="3" {t.Fatal("readded phone incorrect")}',
        'd:=NewDirectory(); if len(d.Search(""))!=0 {t.Fatal("empty directory has results")}; d.Add("ann","1"); d.Add("anna","2"); d.Add("bob","3"); a:=d.Search("ann"); if len(a)!=2 {t.Fatal("exact prefix and extension must match")}; a[0]="changed"; a=d.Search("ann"); if len(a)!=2 || a[0]!="ann" || a[1]!="anna" {t.Fatal("search result leaked storage")}; d.Update("ann","9"); a=d.Search("ann"); if len(a)!=2 || a[0]!="ann" {t.Fatal("phone update renamed contact")}; if p,_:=d.Get("ann"); p!="9" {t.Fatal("search changed phone")}; if len(d.Search("aN"))!=0 {t.Fatal("prefix matching must be exact")}',
      ],
    ),
  },
];
