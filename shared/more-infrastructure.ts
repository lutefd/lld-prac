import type { PracticeProblem } from "./problems.ts";
import { caseFiles, type Command } from "./case-support.ts";

const level = (
  title: string,
  description: string,
  requirements: string[],
  input: string,
  output: string,
): PracticeProblem["levels"][number] => ({
  title,
  description,
  requirements,
  examples: [{ input, output }],
});
const setup = (expression: string): Command => ({
  kind: "assign",
  name: "s",
  expression,
});
const eq = (expression: string, expected: unknown): Command => ({
  kind: "eq",
  expression,
  expected,
});
const run = (expression: string): Command => ({ kind: "run", expression });

const base62 =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const moreInfrastructureProblems: PracticeProblem[] = [
  {
    id: "url-shortener",
    title: "URL shortener",
    category: "Infrastructure",
    difficulty: "Easy",
    duration: 35,
    packageName: "practice",
    summary:
      "Mint deterministic short codes, support custom aliases, resolve URLs, and count hits.",
    tags: ["Encoding", "Aliases", "Counters"],
    levels: [
      level(
        "Mint short codes",
        "Map long URLs to deterministic base62 codes from a counter.",
        [
          `NewShortener() *Shortener starts with counter 1. Shorten(url string) (string, bool) accepts a nonempty URL and returns the next unused code. Codes are the base62 encoding of the counter using digits ${base62}, then the counter increments. Empty URLs return ("", false).`,
          "The same URL shortened twice receives two different codes. Codes are case sensitive. There is no network I/O.",
        ],
        'Shorten("https://a.test"); Shorten("https://a.test")',
        '("1", true); ("2", true)',
      ),
      level(
        "Custom aliases and resolve",
        "Attach chosen codes and look URLs up.",
        [
          "Alias(code, url string) bool binds a nonempty unused code to a nonempty URL. Codes already returned by Shorten or Alias cannot be reused. Invalid calls return false.",
          'Resolve(code string) (string, bool) returns the URL for a known code or ("", false). Alias does not advance the Shorten counter.',
        ],
        'Alias("go","https://go.dev"); Resolve("go"); Shorten("https://x")',
        'true; ("https://go.dev", true); ("1", true)',
      ),
      level(
        "Count successful resolves",
        "Track how often each code is looked up.",
        [
          "Hits(code string) (int, bool) returns how many successful Resolve calls have occurred for a known code, starting at zero, or (0, false) when unknown.",
          "Only Resolve that finds a code increments its hit counter. Shorten, Alias, and failed Resolve leave counts unchanged.",
        ],
        'Shorten("https://a"); Resolve("1"); Resolve("1"); Hits("1")',
        '("1", true); ("https://a", true); ("https://a", true); (2, true)',
      ),
    ],
    files: caseFiles(
      `type Shortener struct {}
func NewShortener() *Shortener { return &Shortener{} }
func (s *Shortener) Shorten(url string) (string, bool) { return "", false }
func (s *Shortener) Alias(code, url string) bool { return false }
func (s *Shortener) Resolve(code string) (string, bool) { return "", false }
func (s *Shortener) Hits(code string) (int, bool) { return 0, false }`,
      [
        `s:=NewShortener(); if c,ok:=s.Shorten("https://a.test"); !ok || c!="1" {t.Fatal("first code wrong")}; if c,ok:=s.Shorten("https://a.test"); !ok || c!="2" {t.Fatal("second code wrong")}; if _,ok:=s.Shorten(""); ok {t.Fatal("empty url accepted")}`,
        `s:=NewShortener(); if !s.Alias("go","https://go.dev") || s.Alias("go","https://other") || s.Alias("","https://x") || s.Alias("x","") {t.Fatal("alias validation wrong")}; if u,ok:=s.Resolve("go"); !ok || u!="https://go.dev" {t.Fatal("resolve alias failed")}; if c,ok:=s.Shorten("https://x"); !ok || c!="1" {t.Fatal("alias advanced counter")}; if s.Alias("1","https://y") {t.Fatal("shortened code reused")}`,
        `s:=NewShortener(); s.Shorten("https://a"); if u,_:=s.Resolve("1"); u!="https://a" {t.Fatal("resolve short failed")}; s.Resolve("1"); if n,ok:=s.Hits("1"); !ok || n!=2 {t.Fatal("hits wrong")}; if _,ok:=s.Hits("missing"); ok {t.Fatal("missing hits")}; if _,ok:=s.Resolve("missing"); ok {t.Fatal("missing resolve")}; if n,_:=s.Hits("1"); n!=2 {t.Fatal("failed resolve counted")}`,
      ],
      [
        `s:=NewShortener(); for i:=0;i<10;i++ {s.Shorten("u")}; if c,ok:=s.Shorten("u"); !ok || c!="b" {t.Fatal("base62 rollover wrong")}`,
        `s:=NewShortener(); s.Shorten("a"); if s.Alias("1","b") || !s.Alias("custom","b") || s.Alias("custom","c") {t.Fatal("alias uniqueness wrong")}; if u,_:=s.Resolve("custom"); u!="b" {t.Fatal("custom resolve wrong")}`,
        `s:=NewShortener(); s.Alias("z","https://z"); if n,_:=s.Hits("z"); n!=0 {t.Fatal("alias should start at zero hits")}; s.Resolve("z"); s.Resolve("z"); s.Resolve("z"); if n,ok:=s.Hits("z"); !ok || n!=3 {t.Fatal("alias hits wrong")}; s.Shorten("https://q"); if n,_:=s.Hits("1"); n!=0 {t.Fatal("unused short hits")}`,
      ],
    ),
  },
  {
    id: "circuit-breaker",
    title: "Circuit breaker",
    category: "Infrastructure",
    difficulty: "Medium",
    duration: 50,
    packageName: "practice",
    summary:
      "Gate calls through closed, open, and half-open states using logical timestamps.",
    tags: ["Resilience", "Logical time", "State machine"],
    levels: [
      level(
        "Allow calls while closed",
        "Start closed and track consecutive failures.",
        [
          "NewBreaker(threshold, cooldown int) *Breaker requires positive threshold and cooldown; nonpositive values are treated as 1. State(now int) string returns \"closed\", \"open\", or \"half_open\" using a nonnegative logical time; negative now is treated as the current clock without advancing it.",
          "Allow(now int) bool returns true while closed. Record(success bool, now int) bool accepts an outcome only when a call was allowed since the last Record; otherwise false. In closed state, a failed Record increments a failure streak and a successful Record resets the streak to zero.",
        ],
        "NewBreaker(2, 5); Allow(0); Record(false, 0); State(0)",
        'true; true; "closed"',
      ),
      level(
        "Open after failures and cool down",
        "Reject traffic until the cooldown elapses.",
        [
          "When a closed failure streak reaches threshold, the breaker opens at that Record's now. While open, Allow returns false and Record returns false without changes.",
          'When now >= openedAt + cooldown, State becomes "half_open" and a single trial Allow may return true. Times need not be unique, but open decisions use the Record timestamp that tripped the breaker.',
        ],
        "Allow(0); Record(false,0); Allow(0); Record(false,0); Allow(1); State(5)",
        'true; true; true; true; false; "half_open"',
      ),
      level(
        "Trial requests in half-open",
        "One probe decides whether to close or reopen.",
        [
          "In half-open, the first Allow returns true and occupies the trial slot; further Allow calls return false until Record completes the trial. A successful trial Record returns to closed with a zero failure streak. A failed trial Record reopens with openedAt set to that now.",
          "State reflects the latest now for open versus half-open transitions. There is no wall clock, background timer, or concurrency.",
        ],
        "Record(true,5); State(5); Allow(6)",
        'true; "closed"; true',
      ),
    ],
    files: caseFiles(
      `type Breaker struct {}
func NewBreaker(threshold, cooldown int) *Breaker { return &Breaker{} }
func (b *Breaker) Allow(now int) bool { return false }
func (b *Breaker) Record(success bool, now int) bool { return false }
func (b *Breaker) State(now int) string { return "" }`,
      [
        `s:=NewBreaker(2,5); if s.State(0)!="closed" || !s.Allow(0) || !s.Record(false,0) || s.State(0)!="closed" {t.Fatal("closed basics wrong")}; if s.Record(true,0) {t.Fatal("record without allow")}; if !s.Allow(0) || !s.Record(true,0) || s.State(0)!="closed" {t.Fatal("success reset wrong")}`,
        `s:=NewBreaker(2,5); s.Allow(0); s.Record(false,0); s.Allow(0); s.Record(false,0); if s.Allow(1) || s.Record(false,1) || s.State(1)!="open" {t.Fatal("open reject wrong")}; if s.State(4)!="open" || s.State(5)!="half_open" {t.Fatal("cooldown boundary wrong")}`,
        `s:=NewBreaker(2,5); s.Allow(0); s.Record(false,0); s.Allow(0); s.Record(false,0); if !s.Allow(5) || s.Allow(5) {t.Fatal("single trial allow wrong")}; if !s.Record(true,5) || s.State(5)!="closed" || !s.Allow(6) {t.Fatal("trial success close wrong")}; s.Allow(6); s.Record(false,6); s.Allow(6); s.Record(false,6); if !s.Allow(11) || !s.Record(false,11) || s.State(11)!="open" {t.Fatal("trial failure reopen wrong")}`,
      ],
      [
        `s:=NewBreaker(0,0); if s.State(-1)!="closed" || !s.Allow(0) || !s.Record(false,0) || s.State(0)!="open" {t.Fatal("nonpositive args must become 1")}`,
        `s:=NewBreaker(3,2); s.Allow(0); s.Record(false,0); s.Allow(1); s.Record(true,1); s.Allow(2); s.Record(false,2); s.Allow(3); s.Record(false,3); if s.State(3)!="closed" {t.Fatal("streak must reset on success")}; s.Allow(4); s.Record(false,4); if s.State(4)!="open" {t.Fatal("threshold after reset wrong")}; if s.State(5)!="open" || s.State(6)!="half_open" {t.Fatal("cooldown 2 boundary wrong")}`,
        `s:=NewBreaker(1,3); s.Allow(0); s.Record(false,0); if !s.Allow(3) || !s.Record(false,3) || s.Allow(4) || s.State(5)!="open" || s.State(6)!="half_open" {t.Fatal("reopen cooldown from trial failure wrong")}`,
      ],
    ),
  },
  {
    id: "elevator-controller",
    title: "Elevator controller",
    category: "Infrastructure",
    difficulty: "Hard",
    duration: 65,
    packageName: "practice",
    summary:
      "Simulate LOOK elevator motion with Step ticks, then coordinate multiple cars.",
    tags: ["Scheduling", "Simulation", "LOOK"],
    levels: [
      level(
        "Move one car with Step",
        "Floors are integers from 0 to floors-1.",
        [
          "NewElevators(floors, cars int) *Elevators creates cars elevators on floor 0 when floors >= 2 and cars >= 1; invalid arguments become floors=2 and cars=1. Floor(car int) (int, bool) and Direction(car int) (string, bool) report a car; unknown cars return ok false. Directions are \"up\", \"down\", or \"idle\".",
          'Call(floor int, dir string) bool registers a hall request when floor is in range and dir is "up" or "down". Duplicate identical outstanding (floor, dir) pairs return false. At this level there is one car (index 0).',
          "Step() advances one tick. A car without a current target adopts its oldest pending Call floor as the target and sets direction up/down (idle if already there). If it is not already on that floor, it moves one floor toward the target in the same tick. When a Step lands exactly on the target, that same Step clears every pending Call at that floor (any dir), drops the target, and becomes idle when the queue is empty.",
        ],
        'Call(2,"up"); Step(); Floor(0); Direction(0)',
        'true; (1, true); ("up", true)',
      ),
      level(
        "Serve targets in Call order",
        "Finish the current target before adopting the next oldest Call.",
        [
          "Intermediate floors are not served early: only the current target floor is cleared on arrival. After a target is cleared, the next Step adopts the oldest remaining Call as the new target.",
          "If the car is already on the newly adopted target floor, the same Step that adopts it also clears that floor without moving. Step returns true when any car moved or cleared a stop during the tick, otherwise false.",
        ],
        'Call(3,"up"); Call(1,"down"); Step(); Step(); Step(); Floor(0)',
        "true; true; true; true; true; (3, true)",
      ),
      level(
        "Multiple elevators",
        "Assign each new Call to the closest car by absolute distance.",
        [
          "When Call succeeds, assign it to the car with the smallest absolute distance from its current floor to the request floor; ties prefer the lowest car index. The request joins that car's pending set immediately.",
          "Step updates every car once per tick independently with the same target rules. Floor and Direction remain per-car queries. There is no door timer beyond clearing on arrival, no capacity limit, and no real-time clock.",
        ],
        'NewElevators(5,2); Call(4,"up"); Call(1,"down"); Step(); Floor(0); Floor(1)',
        "true; true; true; (1, true); (0, true)",
      ),
    ],
    files: caseFiles(
      `type Elevators struct {}
func NewElevators(floors, cars int) *Elevators { return &Elevators{} }
func (e *Elevators) Call(floor int, dir string) bool { return false }
func (e *Elevators) Step() bool { return false }
func (e *Elevators) Floor(car int) (int, bool) { return 0, false }
func (e *Elevators) Direction(car int) (string, bool) { return "", false }`,
      [
        `s:=NewElevators(4,1); if f,ok:=s.Floor(0); !ok || f!=0 {t.Fatal("start floor")}; if d,ok:=s.Direction(0); !ok || d!="idle" {t.Fatal("start dir")}; if !s.Call(2,"up") || s.Call(2,"up") || s.Call(-1,"up") || s.Call(2,"side") {t.Fatal("call validation")}; if !s.Step() {t.Fatal("step1")}; if f,_:=s.Floor(0); f!=1 {t.Fatal("move up")}; if d,_:=s.Direction(0); d!="up" {t.Fatal("dir up")}; if !s.Step() {t.Fatal("arrive")}; if f,_:=s.Floor(0); f!=2 {t.Fatal("target")}; if d,_:=s.Direction(0); d!="idle" {t.Fatal("idle after serve")}; if s.Step() {t.Fatal("idle step must be false")}`,
        `s:=NewElevators(5,1); s.Call(3,"up"); s.Call(1,"down"); if !s.Step() || !s.Step() || !s.Step() {t.Fatal("travel")}; if f,_:=s.Floor(0); f!=3 {t.Fatal("serve higher first from idle")}; if !s.Step() || !s.Step() {t.Fatal("reverse")}; if f,_:=s.Floor(0); f!=1 {t.Fatal("then lower")}; if d,_:=s.Direction(0); d!="idle" {t.Fatal("done idle")}; if s.Step() {t.Fatal("idle step false")}`,
        `s:=NewElevators(5,2); if !s.Call(4,"up") || !s.Call(1,"down") {t.Fatal("multi call")}; if !s.Step() {t.Fatal("multi step")}; if f0,_:=s.Floor(0); f0!=1 {t.Fatal("car0 should move toward nearest of its requests")}; if f1,_:=s.Floor(1); f1!=0 {t.Fatal("car1 remains idle without assignments")}; if d1,ok:=s.Direction(1); !ok || d1!="idle" {t.Fatal("car1 idle")}; if _,ok:=s.Floor(2); ok {t.Fatal("unknown car")}`,
      ],
      [
        `s:=NewElevators(1,0); if f,ok:=s.Floor(0); !ok || f!=0 {t.Fatal("fallback shape")}; if !s.Call(1,"down") {t.Fatal("fallback floors")}; if !s.Step() {t.Fatal("fallback move")}`,
        `s:=NewElevators(6,1); s.Call(5,"up"); s.Call(2,"up"); for i:=0;i<5;i++ {s.Step()}; if f,_:=s.Floor(0); f!=5 {t.Fatal("look continue up")}; s.Call(0,"down"); for i:=0;i<5;i++ {s.Step()}; if f,_:=s.Floor(0); f!=0 {t.Fatal("look down")}`,
        `s:=NewElevators(10,3); s.Call(9,"up"); s.Call(8,"up"); s.Call(1,"down"); s.Step(); if f0,_:=s.Floor(0); f0!=1 {t.Fatal("car0 takes tied calls and moves to nearest")}; if f1,_:=s.Floor(1); f1!=0 {t.Fatal("other cars stay put")}; if _,ok:=s.Direction(-1); ok {t.Fatal("neg car")}`,
      ],
    ),
  },
];

export const moreInfrastructureApi: Record<
  string,
  [string, string, string[]]
> = {
  "url-shortener": [
    "Shortener",
    "",
    [
      "Shorten|url:s|pair",
      "Alias|code:s,url:s|b",
      "Resolve|code:s|pair",
      "Hits|code:s|money",
    ],
  ],
  "circuit-breaker": [
    "Breaker",
    "threshold:n,cooldown:n",
    ["Allow|now:n|b", "Record|success:b,now:n|b", "State|now:n|s"],
  ],
  "elevator-controller": [
    "Elevators",
    "floors:n,cars:n",
    [
      "Call|floor:n,dir:s|b",
      "Step||b",
      "Floor|car:n|money",
      "Direction|car:n|pair",
    ],
  ],
};
export const moreInfrastructureTests: Record<string, Command[][]> = {
  "url-shortener": [
    [
      setup("NewShortener()"),
      eq('s.Shorten("https://a.test")', ["1", true]),
      eq('s.Shorten("https://a.test")', ["2", true]),
      eq('s.Shorten("")', ["", false]),
    ],
    [
      setup("NewShortener()"),
      eq('s.Alias("go","https://go.dev")', true),
      eq('s.Alias("go","https://other")', false),
      eq('s.Alias("","https://x")', false),
      eq('s.Alias("x","")', false),
      eq('s.Resolve("go")', ["https://go.dev", true]),
      eq('s.Shorten("https://x")', ["1", true]),
      eq('s.Alias("1","https://y")', false),
    ],
    [
      setup("NewShortener()"),
      run('s.Shorten("https://a")'),
      eq('s.Resolve("1")', ["https://a", true]),
      run('s.Resolve("1")'),
      eq('s.Hits("1")', [2, true]),
      eq('s.Hits("missing")', [0, false]),
      eq('s.Resolve("missing")', ["", false]),
      eq('s.Hits("1")', [2, true]),
    ],
  ],
  "circuit-breaker": [
    [
      setup("NewBreaker(2,5)"),
      eq("s.State(0)", "closed"),
      eq("s.Allow(0)", true),
      eq("s.Record(false,0)", true),
      eq("s.State(0)", "closed"),
      eq("s.Record(true,0)", false),
      eq("s.Allow(0)", true),
      eq("s.Record(true,0)", true),
      eq("s.State(0)", "closed"),
    ],
    [
      setup("NewBreaker(2,5)"),
      run("s.Allow(0)"),
      run("s.Record(false,0)"),
      run("s.Allow(0)"),
      run("s.Record(false,0)"),
      eq("s.Allow(1)", false),
      eq("s.Record(false,1)", false),
      eq("s.State(1)", "open"),
      eq("s.State(4)", "open"),
      eq("s.State(5)", "half_open"),
    ],
    [
      setup("NewBreaker(2,5)"),
      run("s.Allow(0)"),
      run("s.Record(false,0)"),
      run("s.Allow(0)"),
      run("s.Record(false,0)"),
      eq("s.Allow(5)", true),
      eq("s.Allow(5)", false),
      eq("s.Record(true,5)", true),
      eq("s.State(5)", "closed"),
      eq("s.Allow(6)", true),
      run("s.Record(false,6)"),
      run("s.Allow(6)"),
      run("s.Record(false,6)"),
      eq("s.Allow(11)", true),
      eq("s.Record(false,11)", true),
      eq("s.State(11)", "open"),
    ],
  ],
  "elevator-controller": [
    [
      setup("NewElevators(4,1)"),
      eq("s.Floor(0)", [0, true]),
      eq("s.Direction(0)", ["idle", true]),
      eq('s.Call(2,"up")', true),
      eq('s.Call(2,"up")', false),
      eq('s.Call(-1,"up")', false),
      eq('s.Call(2,"side")', false),
      eq("s.Step()", true),
      eq("s.Floor(0)", [1, true]),
      eq("s.Direction(0)", ["up", true]),
      eq("s.Step()", true),
      eq("s.Floor(0)", [2, true]),
      eq("s.Direction(0)", ["idle", true]),
      eq("s.Step()", false),
    ],
    [
      setup("NewElevators(5,1)"),
      run('s.Call(3,"up")'),
      run('s.Call(1,"down")'),
      eq("s.Step()", true),
      eq("s.Step()", true),
      eq("s.Step()", true),
      eq("s.Floor(0)", [3, true]),
      eq("s.Step()", true),
      eq("s.Step()", true),
      eq("s.Floor(0)", [1, true]),
      eq("s.Direction(0)", ["idle", true]),
      eq("s.Step()", false),
    ],
    [
      setup("NewElevators(5,2)"),
      eq('s.Call(4,"up")', true),
      eq('s.Call(1,"down")', true),
      eq("s.Step()", true),
      eq("s.Floor(0)", [1, true]),
      eq("s.Floor(1)", [0, true]),
      eq("s.Direction(1)", ["idle", true]),
      eq("s.Floor(2)", [0, false]),
    ],
  ],
};
export const moreInfrastructureHidden: Record<string, Command[][]> = {
  "url-shortener": [
    [
      setup("NewShortener()"),
      run('s.Shorten("u")'),
      run('s.Shorten("u")'),
      run('s.Shorten("u")'),
      run('s.Shorten("u")'),
      run('s.Shorten("u")'),
      run('s.Shorten("u")'),
      run('s.Shorten("u")'),
      run('s.Shorten("u")'),
      run('s.Shorten("u")'),
      run('s.Shorten("u")'),
      eq('s.Shorten("u")', ["b", true]),
    ],
    [
      setup("NewShortener()"),
      run('s.Shorten("a")'),
      eq('s.Alias("1","b")', false),
      eq('s.Alias("custom","b")', true),
      eq('s.Alias("custom","c")', false),
      eq('s.Resolve("custom")', ["b", true]),
    ],
    [
      setup("NewShortener()"),
      run('s.Alias("z","https://z")'),
      eq('s.Hits("z")', [0, true]),
      run('s.Resolve("z")'),
      run('s.Resolve("z")'),
      run('s.Resolve("z")'),
      eq('s.Hits("z")', [3, true]),
      run('s.Shorten("https://q")'),
      eq('s.Hits("1")', [0, true]),
    ],
  ],
  "circuit-breaker": [
    [
      setup("NewBreaker(0,0)"),
      eq("s.State(-1)", "closed"),
      eq("s.Allow(0)", true),
      eq("s.Record(false,0)", true),
      eq("s.State(0)", "open"),
    ],
    [
      setup("NewBreaker(3,2)"),
      run("s.Allow(0)"),
      run("s.Record(false,0)"),
      run("s.Allow(1)"),
      run("s.Record(true,1)"),
      run("s.Allow(2)"),
      run("s.Record(false,2)"),
      run("s.Allow(3)"),
      run("s.Record(false,3)"),
      eq("s.State(3)", "closed"),
      run("s.Allow(4)"),
      run("s.Record(false,4)"),
      eq("s.State(4)", "open"),
      eq("s.State(5)", "open"),
      eq("s.State(6)", "half_open"),
    ],
    [
      setup("NewBreaker(1,3)"),
      run("s.Allow(0)"),
      run("s.Record(false,0)"),
      eq("s.Allow(3)", true),
      eq("s.Record(false,3)", true),
      eq("s.Allow(4)", false),
      eq("s.State(5)", "open"),
      eq("s.State(6)", "half_open"),
    ],
  ],
  "elevator-controller": [
    [
      setup("NewElevators(1,0)"),
      eq("s.Floor(0)", [0, true]),
      eq('s.Call(1,"down")', true),
      eq("s.Step()", true),
    ],
    [
      setup("NewElevators(6,1)"),
      run('s.Call(5,"up")'),
      run('s.Call(2,"up")'),
      run("s.Step()"),
      run("s.Step()"),
      run("s.Step()"),
      run("s.Step()"),
      run("s.Step()"),
      eq("s.Floor(0)", [5, true]),
      run('s.Call(0,"down")'),
      run("s.Step()"),
      run("s.Step()"),
      run("s.Step()"),
      run("s.Step()"),
      run("s.Step()"),
      eq("s.Floor(0)", [0, true]),
    ],
    [
      setup("NewElevators(10,3)"),
      run('s.Call(9,"up")'),
      run('s.Call(8,"up")'),
      run('s.Call(1,"down")'),
      run("s.Step()"),
      eq("s.Floor(0)", [1, true]),
      eq("s.Floor(1)", [0, true]),
      eq("s.Direction(-1)", ["", false]),
    ],
  ],
};
