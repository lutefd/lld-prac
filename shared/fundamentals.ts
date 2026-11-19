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

export const fundamentalProblems: PracticeProblem[] = [
  {
    id: "lru-cache",
    title: "LRU cache",
    category: "Fundamentals",
    difficulty: "Medium",
    duration: 60,
    packageName: "practice",
    summary:
      "Build a bounded key-value cache with access-based eviction, resizing, and isolated snapshots.",
    tags: ["Cache", "Recency", "Eviction"],
    levels: [
      level(
        "Store and retrieve",
        "Keep string values under nonempty, case-sensitive keys.",
        [
          "NewLRUCache(capacity int) *LRUCache creates an empty cache with nonnegative capacity. Len() int returns the number of stored keys.",
          "Put(key, value string) bool inserts or overwrites a key. Empty keys and all writes at capacity zero return false without changing state; empty values are valid.",
          'Get(key string) (string, bool) returns the stored value or ("", false) if missing. An empty stored value returns ("", true).',
          "At this level, writes to new keys stay within capacity. The next level defines eviction when capacity is reached.",
        ],
        'NewLRUCache(2); Put("a", ""); Get("a"); Len()',
        'true; ("", true); 1',
      ),
      level(
        "Evict by access order",
        "Track least-recently-used entries as reads and writes occur.",
        [
          "Every successful Put and successful Get makes that key the most recently used. A missing Get and a rejected Put leave recency unchanged.",
          "When inserting a new key into a full positive-capacity cache, evict exactly the least recently used key before inserting. Put still returns true.",
          "Overwriting an existing key never evicts another entry and does not increase Len(). All earlier contracts continue to apply.",
        ],
        'NewLRUCache(2); Put("a", "A"); Put("b", "B"); Get("a"); Put("c", "C"); Get("b")',
        'true; true; ("A", true); true; ("", false)',
      ),
      level(
        "Resize and inspect",
        "Change the memory budget and inspect recency without exposing internal storage.",
        [
          "Resize(capacity int) bool rejects negative capacities without changing state. Otherwise it returns true, updates capacity, and immediately evicts least-recently-used keys until Len() fits.",
          "Resize(0) clears the cache and rejects subsequent Put calls until a positive resize. Growing capacity preserves all entries and their recency; resizing to the same capacity succeeds.",
          "Keys() []string returns a new snapshot ordered from least to most recently used. Keys and Resize do not refresh recency; mutating the returned slice must not affect the cache. Empty snapshots may be nil or empty in Go.",
        ],
        'NewLRUCache(2); Put("a", "A"); Put("b", "B"); Get("a"); Resize(1); Keys()',
        'true; true; ("A", true); true; ["a"]',
      ),
    ],
    files: caseFiles(
      `type LRUCache struct {}
func NewLRUCache(capacity int) *LRUCache { return &LRUCache{} }
func (c *LRUCache) Put(key, value string) bool { return false }
func (c *LRUCache) Get(key string) (string, bool) { return "", false }
func (c *LRUCache) Len() int { return 0 }
func (c *LRUCache) Resize(capacity int) bool { return false }
func (c *LRUCache) Keys() []string { return nil }`,
      [
        `c:=NewLRUCache(2)
if c.Len()!=0 || c.Put("", "bad") || !c.Put("a", "") {t.Fatal("initial state or key validation incorrect")}
if v,ok:=c.Get("a"); !ok || v!="" {t.Fatal("empty stored value must be present")}
if !c.Put("a", "new") || c.Len()!=1 {t.Fatal("overwrite changed entry count")}
if v,ok:=c.Get("a"); !ok || v!="new" {t.Fatal("overwrite lost value")}
if v,ok:=c.Get("missing"); ok || v!="" {t.Fatal("missing value must return empty,false")}`,
        `c:=NewLRUCache(2); c.Put("a","A"); c.Put("b","B"); c.Get("a")
if !c.Put("c","C") || c.Len()!=2 {t.Fatal("full cache must accept insertion with one eviction")}
if _,ok:=c.Get("b"); ok {t.Fatal("least recently used entry survived")}
if v,ok:=c.Get("a"); !ok || v!="A" {t.Fatal("recently read entry was evicted")}
c.Put("a","updated"); c.Put("d","D")
if _,ok:=c.Get("c"); ok {t.Fatal("overwrite must refresh recency")}
if v,ok:=c.Get("a"); !ok || v!="updated" {t.Fatal("overwrite must preserve updated entry")}`,
        `c:=NewLRUCache(3); c.Put("a","A"); c.Put("b","B"); c.Put("c","C"); c.Get("a")
k:=c.Keys(); if len(k)!=3 || k[0]!="b" || k[1]!="c" || k[2]!="a" {t.Fatal("snapshot order incorrect")}
k[0]="changed"; if c.Keys()[0]!="b" {t.Fatal("snapshot aliases internal state")}
if c.Resize(-1) || !c.Resize(1) || c.Len()!=1 || c.Keys()[0]!="a" {t.Fatal("resize must retain most recent entry")}
if !c.Resize(0) || c.Len()!=0 || c.Put("x","X") || len(c.Keys())!=0 {t.Fatal("zero resize must clear and disable writes")}
if !c.Resize(2) || !c.Put("x","X") {t.Fatal("growing must reenable writes")}`,
      ],
      [
        `c:=NewLRUCache(0); if c.Put("a", "A") || c.Len()!=0 {t.Fatal("zero capacity accepted entry")}
c=NewLRUCache(2); c.Put("a","one"); c.Put("A","two")
if v,ok:=c.Get("A"); !ok || v!="two" || c.Len()!=2 {t.Fatal("keys must be case sensitive")}`,
        `c:=NewLRUCache(2); c.Put("a","A"); c.Put("b","B"); c.Get("missing"); c.Put("","bad"); c.Put("c","C")
if _,ok:=c.Get("a"); ok {t.Fatal("failed access changed eviction order")}
if v,ok:=c.Get("b"); !ok || v!="B" {t.Fatal("wrong entry evicted")}
c=NewLRUCache(1); c.Put("a","A"); c.Put("a","new"); if c.Len()!=1 {t.Fatal("overwrite increased size")}; c.Put("b","B")
if _,ok:=c.Get("a"); ok {t.Fatal("capacity one must evict old key")}`,
        `c:=NewLRUCache(2); c.Put("a","A"); c.Put("b","B")
if c.Resize(-1) || !c.Resize(2) || !c.Resize(3) {t.Fatal("resize validation incorrect")}
k:=c.Keys(); if len(k)!=2 || k[0]!="a" || k[1]!="b" {t.Fatal("growing changed entries or recency")}
c.Put("c","C"); c.Keys(); c.Put("d","D")
if _,ok:=c.Get("a"); ok {t.Fatal("snapshot refreshed recency or growth ignored")}
if !c.Resize(0) || !c.Resize(1) || !c.Put("a","fresh") || c.Len()!=1 {t.Fatal("evicted keys must be insertable again")}`,
      ],
    ),
  },
  {
    id: "delayed-job-queue",
    title: "Delayed job queue",
    category: "Fundamentals",
    difficulty: "Hard",
    duration: 60,
    packageName: "practice",
    summary:
      "Schedule jobs with deterministic due-time ordering, explicit in-flight work, cancellation, and retry.",
    tags: ["Scheduling", "State machine", "Retries"],
    levels: [
      level(
        "Schedule jobs",
        "Register uniquely identified jobs on a synthetic clock.",
        [
          "NewJobQueue() *JobQueue creates an empty queue. Enqueue(id string, due int) bool accepts a nonempty, never-before-accepted ID and nonnegative due time.",
          "IDs are case sensitive and remain reserved forever after successful Enqueue, including after cancellation or completion. Failed calls reserve no IDs and change no state.",
          "Pending() int counts waiting jobs only, including jobs due in the future. All times are integer seconds; there is no wall clock, background worker, or persistence.",
        ],
        'NewJobQueue(); Enqueue("email", 10); Enqueue("email", 5); Pending()',
        "true; false; 1",
      ),
      level(
        "Claim due work",
        "Claim one due job at a time in a deterministic order.",
        [
          "Take(now int) (string, bool) selects a waiting job with due <= now, ordered by smallest due then lexicographically smallest ID. It moves that job to in-flight state and removes it from Pending().",
          'If now is negative or no waiting job is due, return ("", false) without changing state. A job cannot be taken again while in flight.',
          "Each Take uses the supplied now independently; times do not need to increase. Taking work never releases its reserved ID.",
        ],
        'Enqueue("b", 10); Enqueue("a", 10); Take(9); Take(10); Pending()',
        '("", false); ("a", true); 1',
      ),
      level(
        "Finish, retry, and cancel",
        "Manage worker outcomes without duplicating a job.",
        [
          "Finish(id string) bool succeeds only for an in-flight job, moving it to terminal completed state. Repeated or unknown finishes return false.",
          "Retry(id string, due int) bool succeeds only for an in-flight job and nonnegative due time, moving the same ID back to waiting with the new due time. Retry may be repeated across multiple claims; invalid retries preserve in-flight state.",
          "Cancel(id string) bool succeeds only for a waiting job, moving it to terminal cancelled state. In-flight, completed, cancelled, and unknown jobs return false. Cancel and Finish do not make IDs reusable.",
          "Pending counts only waiting jobs throughout all transitions. All failed lifecycle calls leave job state, due times, and ordering unchanged.",
        ],
        'Enqueue("a", 0); Take(0); Retry("a", 5); Take(4); Take(5); Finish("a")',
        'true; ("a", true); true; ("", false); ("a", true); true',
      ),
    ],
    files: caseFiles(
      `type JobQueue struct {}
func NewJobQueue() *JobQueue { return &JobQueue{} }
func (q *JobQueue) Enqueue(id string, due int) bool { return false }
func (q *JobQueue) Pending() int { return 0 }
func (q *JobQueue) Take(now int) (string, bool) { return "", false }
func (q *JobQueue) Finish(id string) bool { return false }
func (q *JobQueue) Retry(id string, due int) bool { return false }
func (q *JobQueue) Cancel(id string) bool { return false }`,
      [
        `q:=NewJobQueue()
if q.Pending()!=0 || q.Enqueue("",0) || q.Enqueue("a",-1) || !q.Enqueue("a",10) || q.Enqueue("a",0) || q.Pending()!=1 {t.Fatal("enqueue validation or duplicate handling incorrect")}
if !q.Enqueue("b",0) || q.Pending()!=2 {t.Fatal("future jobs must count as pending")}`,
        `q:=NewJobQueue(); q.Enqueue("b",10); q.Enqueue("a",10); q.Enqueue("early",5)
if id,ok:=q.Take(4); ok || id!="" {t.Fatal("future job claimed")}
if id,ok:=q.Take(10); !ok || id!="early" {t.Fatal("earliest due time must win")}
if id,ok:=q.Take(10); !ok || id!="a" {t.Fatal("ties must use lexical ID")}
if q.Pending()!=1 || q.Enqueue("a",0) {t.Fatal("claim must remove waiting job and reserve ID")}
if id,ok:=q.Take(10); !ok || id!="b" {t.Fatal("remaining due job missing")}
if id,ok:=q.Take(100); ok || id!="" || q.Pending()!=0 {t.Fatal("in-flight job claimed again")}`,
        `q:=NewJobQueue(); q.Enqueue("a",0); q.Enqueue("b",1)
if q.Finish("a") || q.Retry("a",0) || !q.Cancel("b") || q.Cancel("b") {t.Fatal("waiting lifecycle validation incorrect")}
q.Take(0); if q.Cancel("a") || q.Retry("a",-1) || !q.Retry("a",5) || q.Pending()!=1 {t.Fatal("retry must preserve invalid attempt and requeue valid attempt")}
if _,ok:=q.Take(4); ok {t.Fatal("retry ignored new due time")}
if id,ok:=q.Take(5); !ok || id!="a" {t.Fatal("retried work missing")}
if !q.Finish("a") || q.Finish("a") || q.Retry("a",0) || q.Cancel("a") || q.Enqueue("a",0) || q.Enqueue("b",0) || q.Pending()!=0 {t.Fatal("terminal jobs must remain terminal with reserved IDs")}`,
      ],
      [
        `q:=NewJobQueue(); q.Enqueue("x",20)
if q.Enqueue("x",0) || !q.Enqueue("X",0) || q.Pending()!=2 {t.Fatal("duplicate mutation or case sensitivity incorrect")}
if q.Enqueue("retry",-1) || !q.Enqueue("retry",0) || q.Pending()!=3 {t.Fatal("failed enqueue consumed ID")}`,
        `q:=NewJobQueue(); q.Enqueue("z",0); q.Enqueue("a",1); q.Enqueue("a",0)
if id,ok:=q.Take(-1); ok || id!="" || q.Pending()!=2 {t.Fatal("negative now changed queue")}
if id,ok:=q.Take(0); !ok || id!="z" {t.Fatal("duplicate enqueue changed original due time")}
if id,ok:=q.Take(0); ok || id!="" {t.Fatal("job claimed before due")}
if id,ok:=q.Take(1); !ok || id!="a" {t.Fatal("due boundary must be inclusive")}
q.Enqueue("back",0); if id,ok:=q.Take(0); !ok || id!="back" {t.Fatal("synthetic now need not be monotonic")}`,
        `q:=NewJobQueue(); q.Enqueue("b",0); q.Enqueue("a",0); q.Take(0)
if q.Retry("b",1) || q.Finish("b") || !q.Retry("a",0) {t.Fatal("only in-flight jobs can retry or finish")}
if id,ok:=q.Take(0); !ok || id!="a" {t.Fatal("retry must rejoin due-time and lexical ordering")}
if !q.Retry("a",2) {t.Fatal("multiple retries must be supported")}
if !q.Cancel("a") || q.Retry("a",0) || q.Finish("a") || q.Enqueue("a",0) {t.Fatal("cancelled retry must stay terminal")}
if q.Finish("missing") || q.Retry("missing",0) || q.Cancel("missing") || q.Pending()!=1 {t.Fatal("invalid lifecycle changed unrelated work")}
if id,ok:=q.Take(0); !ok || id!="b" {t.Fatal("unrelated waiting work lost")}`,
      ],
    ),
  },
];

export const fundamentalApi: Record<string, [string, string, string[]]> = {
  "lru-cache": [
    "LRUCache",
    "capacity:n",
    [
      "Put|key:s,value:s|b",
      "Get|key:s|pair",
      "Len||n",
      "Resize|capacity:n|b",
      "Keys||strings",
    ],
  ],
  "delayed-job-queue": [
    "JobQueue",
    "",
    [
      "Enqueue|id:s,due:n|b",
      "Pending||n",
      "Take|now:n|pair",
      "Finish|id:s|b",
      "Retry|id:s,due:n|b",
      "Cancel|id:s|b",
    ],
  ],
};

export const fundamentalTests: Record<string, Command[][]> = {
  "lru-cache": [
    [
      setup("NewLRUCache(2)"),
      eq("s.Len()", 0),
      eq('s.Put("","bad")', false),
      eq('s.Put("a", "")', true),
      eq('s.Get("a")', ["", true]),
      eq('s.Put("a","new")', true),
      eq("s.Len()", 1),
      eq('s.Get("a")', ["new", true]),
      eq('s.Get("missing")', ["", false]),
    ],
    [
      setup("NewLRUCache(2)"),
      run('s.Put("a","A")'),
      run('s.Put("b","B")'),
      run('s.Get("a")'),
      eq('s.Put("c","C")', true),
      eq("s.Len()", 2),
      eq('s.Get("b")', ["", false]),
      eq('s.Get("a")', ["A", true]),
      run('s.Put("a","updated")'),
      run('s.Put("d","D")'),
      eq('s.Get("c")', ["", false]),
      eq('s.Get("a")', ["updated", true]),
    ],
    [
      setup("NewLRUCache(3)"),
      run('s.Put("a","A")'),
      run('s.Put("b","B")'),
      run('s.Put("c","C")'),
      run('s.Get("a")'),
      eq("s.Keys()", ["b", "c", "a"]),
      { kind: "assign", name: "snapshot", expression: "s.Keys()" },
      run('snapshot[0] = "changed"'),
      eq("s.Keys()", ["b", "c", "a"]),
      eq("s.Resize(-1)", false),
      eq("s.Resize(1)", true),
      eq("s.Len()", 1),
      eq("s.Keys()", ["a"]),
      eq("s.Resize(0)", true),
      eq("s.Len()", 0),
      eq('s.Put("x","X")', false),
      eq("s.Keys()", []),
      eq("s.Resize(2)", true),
      eq('s.Put("x","X")', true),
    ],
  ],
  "delayed-job-queue": [
    [
      setup("NewJobQueue()"),
      eq("s.Pending()", 0),
      eq('s.Enqueue("",0)', false),
      eq('s.Enqueue("a",-1)', false),
      eq('s.Enqueue("a",10)', true),
      eq('s.Enqueue("a",0)', false),
      eq("s.Pending()", 1),
      eq('s.Enqueue("b",0)', true),
      eq("s.Pending()", 2),
    ],
    [
      setup("NewJobQueue()"),
      run('s.Enqueue("b",10)'),
      run('s.Enqueue("a",10)'),
      run('s.Enqueue("early",5)'),
      eq("s.Take(4)", ["", false]),
      eq("s.Take(10)", ["early", true]),
      eq("s.Take(10)", ["a", true]),
      eq("s.Pending()", 1),
      eq('s.Enqueue("a",0)', false),
      eq("s.Take(10)", ["b", true]),
      eq("s.Take(100)", ["", false]),
      eq("s.Pending()", 0),
    ],
    [
      setup("NewJobQueue()"),
      run('s.Enqueue("a",0)'),
      run('s.Enqueue("b",1)'),
      eq('s.Finish("a")', false),
      eq('s.Retry("a",0)', false),
      eq('s.Cancel("b")', true),
      eq('s.Cancel("b")', false),
      run("s.Take(0)"),
      eq('s.Cancel("a")', false),
      eq('s.Retry("a",-1)', false),
      eq('s.Retry("a",5)', true),
      eq("s.Pending()", 1),
      eq("s.Take(4)", ["", false]),
      eq("s.Take(5)", ["a", true]),
      eq('s.Finish("a")', true),
      eq('s.Finish("a")', false),
      eq('s.Retry("a",0)', false),
      eq('s.Cancel("a")', false),
      eq('s.Enqueue("a",0)', false),
      eq('s.Enqueue("b",0)', false),
      eq("s.Pending()", 0),
    ],
  ],
};

export const fundamentalHidden: Record<string, Command[][]> = {
  "lru-cache": [
    [
      setup("NewLRUCache(0)"),
      eq('s.Put("a","A")', false),
      eq("s.Len()", 0),
      { kind: "assign", name: "c", expression: "NewLRUCache(2)" },
      run('c.Put("a","one")'),
      run('c.Put("A","two")'),
      eq('c.Get("A")', ["two", true]),
      eq("c.Len()", 2),
    ],
    [
      setup("NewLRUCache(2)"),
      run('s.Put("a","A")'),
      run('s.Put("b","B")'),
      run('s.Get("missing")'),
      run('s.Put("","bad")'),
      run('s.Put("c","C")'),
      eq('s.Get("a")', ["", false]),
      eq('s.Get("b")', ["B", true]),
      { kind: "assign", name: "c", expression: "NewLRUCache(1)" },
      run('c.Put("a","A")'),
      run('c.Put("a","new")'),
      eq("c.Len()", 1),
      run('c.Put("b","B")'),
      eq('c.Get("a")', ["", false]),
    ],
    [
      setup("NewLRUCache(2)"),
      run('s.Put("a","A")'),
      run('s.Put("b","B")'),
      eq("s.Resize(-1)", false),
      eq("s.Resize(2)", true),
      eq("s.Resize(3)", true),
      eq("s.Keys()", ["a", "b"]),
      run('s.Put("c","C")'),
      run("s.Keys()"),
      run('s.Put("d","D")'),
      eq('s.Get("a")', ["", false]),
      eq("s.Resize(0)", true),
      eq("s.Resize(1)", true),
      eq('s.Put("a","fresh")', true),
      eq("s.Len()", 1),
    ],
  ],
  "delayed-job-queue": [
    [
      setup("NewJobQueue()"),
      run('s.Enqueue("x",20)'),
      eq('s.Enqueue("x",0)', false),
      eq('s.Enqueue("X",0)', true),
      eq("s.Pending()", 2),
      eq('s.Enqueue("retry",-1)', false),
      eq('s.Enqueue("retry",0)', true),
      eq("s.Pending()", 3),
    ],
    [
      setup("NewJobQueue()"),
      run('s.Enqueue("z",0)'),
      run('s.Enqueue("a",1)'),
      run('s.Enqueue("a",0)'),
      eq("s.Take(-1)", ["", false]),
      eq("s.Pending()", 2),
      eq("s.Take(0)", ["z", true]),
      eq("s.Take(0)", ["", false]),
      eq("s.Take(1)", ["a", true]),
      run('s.Enqueue("back",0)'),
      eq("s.Take(0)", ["back", true]),
    ],
    [
      setup("NewJobQueue()"),
      run('s.Enqueue("b",0)'),
      run('s.Enqueue("a",0)'),
      run("s.Take(0)"),
      eq('s.Retry("b",1)', false),
      eq('s.Finish("b")', false),
      eq('s.Retry("a",0)', true),
      eq("s.Take(0)", ["a", true]),
      eq('s.Retry("a",2)', true),
      eq('s.Cancel("a")', true),
      eq('s.Retry("a",0)', false),
      eq('s.Finish("a")', false),
      eq('s.Enqueue("a",0)', false),
      eq('s.Finish("missing")', false),
      eq('s.Retry("missing",0)', false),
      eq('s.Cancel("missing")', false),
      eq("s.Pending()", 1),
      eq("s.Take(0)", ["b", true]),
    ],
  ],
};

// A bounded introduction to graph invariants before larger scheduling exercises.
fundamentalProblems.push({
  id: "dependency-planner",
  title: "Dependency planner",
  category: "Fundamentals",
  difficulty: "Hard",
  duration: 60,
  packageName: "practice",
  summary:
    "Bridge into hard problems by keeping a small task graph acyclic and completing work only when its prerequisites are done.",
  tags: ["Hard bridge", "Directed graphs", "Invariants"],
  levels: [
    level(
      "Register tasks",
      "Start with an in-memory set of task IDs; no clock, concurrency, or worker assignment is involved.",
      [
        "NewDependencyPlanner() *DependencyPlanner creates an empty planner. Add(id string) bool adds a nonempty, unique, case-sensitive ID, initially incomplete and with no prerequisites.",
        "Count() int counts all accepted tasks, including completed ones. Empty or duplicate IDs return false without changing existing tasks.",
      ],
      'NewDependencyPlanner(); Add("build"); Add("build"); Count()',
      "true; false; 1",
    ),
    level(
      "Protect the dependency graph",
      "Introduce one invariant: a task must never depend on itself, even indirectly.",
      [
        "Depend(task, prerequisite string) bool adds a direct prerequisite to a task. Both IDs must exist and differ; duplicate edges, completed task targets, and edges that would create any directed cycle return false without changing the graph.",
        'The prerequisite may already be completed. A dependency is directional: Depend("ship", "build") means build must finish before ship; it does not make build depend on ship.',
        "Dependencies(id string) []string returns a new lexicographically sorted snapshot of direct prerequisite IDs only. Unknown IDs return an empty snapshot; Go may return nil. Mutating a snapshot must not alter the graph.",
        "Cycle detection must consider paths of any length. Rejecting an edge never creates tasks or removes existing edges. Small graphs are sufficient; no complexity target is imposed.",
      ],
      'Add("a"); Add("b"); Add("c"); Depend("b", "a"); Depend("c", "b"); Depend("a", "c"); Dependencies("c")',
      'true; true; true; true; true; false; ["b"]',
    ),
    level(
      "Complete eligible work",
      "Use the protected graph to expose the next steps and enforce execution order.",
      [
        "Ready() []string returns a new lexicographically sorted snapshot of all incomplete tasks whose direct prerequisites are completed. Tasks with no prerequisites are immediately ready. Reading Ready changes no state.",
        "Complete(id string) bool succeeds only when the task exists, is incomplete, and is currently ready. Success marks it permanently completed; unknown, blocked, or already completed tasks return false without changing state.",
        "Completing a task retains it, its dependency edges, and its reserved ID. Dependencies and Count continue to include completed tasks; Ready excludes them. A completed task cannot receive new dependencies, but can serve as a prerequisite for another task.",
        "Returned Ready snapshots are independent of planner storage. All earlier validation and cycle rules remain in force.",
      ],
      'Add("build"); Add("ship"); Depend("ship", "build"); Ready(); Complete("ship"); Complete("build"); Ready()',
      'true; true; true; ["build"]; false; true; ["ship"]',
    ),
  ],
  files: caseFiles(
    `type DependencyPlanner struct {}
func NewDependencyPlanner() *DependencyPlanner { return &DependencyPlanner{} }
func (p *DependencyPlanner) Add(id string) bool { return false }
func (p *DependencyPlanner) Count() int { return 0 }
func (p *DependencyPlanner) Depend(task, prerequisite string) bool { return false }
func (p *DependencyPlanner) Dependencies(id string) []string { return nil }
func (p *DependencyPlanner) Ready() []string { return nil }
func (p *DependencyPlanner) Complete(id string) bool { return false }`,
    [
      `p:=NewDependencyPlanner()
if p.Count()!=0 || p.Add("") || !p.Add("build") || p.Add("build") || p.Count()!=1 {t.Fatal("registration or duplicate validation incorrect")}
if !p.Add("Build") || p.Count()!=2 {t.Fatal("task IDs must be case sensitive")}`,
      `p:=NewDependencyPlanner(); p.Add("a"); p.Add("b"); p.Add("c")
if !p.Depend("b","a") || !p.Depend("c","b") || p.Depend("a","c") || p.Depend("a","a") || p.Depend("b","a") || p.Depend("missing","a") {t.Fatal("edge or cycle validation incorrect")}
if len(p.Dependencies("a"))!=0 || p.Count()!=3 {t.Fatal("rejected edge mutated graph")}
d:=p.Dependencies("c"); if len(d)!=1 || d[0]!="b" {t.Fatal("must return only direct prerequisites")}
d[0]="changed"; if p.Dependencies("c")[0]!="b" {t.Fatal("dependency snapshot aliases state")}`,
      `p:=NewDependencyPlanner(); p.Add("build"); p.Add("ship"); p.Depend("ship","build")
r:=p.Ready(); if len(r)!=1 || r[0]!="build" || p.Complete("ship") || p.Complete("missing") {t.Fatal("blocked or unknown task completed")}
r[0]="changed"; if p.Ready()[0]!="build" {t.Fatal("ready snapshot aliases state")}
if !p.Complete("build") || p.Complete("build") || p.Depend("build","ship") {t.Fatal("completed task must be terminal")}
if r=p.Ready(); len(r)!=1 || r[0]!="ship" {t.Fatal("prerequisite completion did not unlock task")}
if !p.Complete("ship") || len(p.Ready())!=0 || p.Count()!=2 || p.Add("build") || len(p.Dependencies("ship"))!=1 {t.Fatal("completion must retain tasks and graph")}`,
    ],
    [
      `p:=NewDependencyPlanner(); p.Add("x"); p.Add("x"); p.Add("")
if p.Count()!=1 || !p.Add("y") || p.Count()!=2 {t.Fatal("invalid registration changed task set")}`,
      `p:=NewDependencyPlanner(); p.Add("a"); p.Add("b"); p.Add("c"); p.Add("d")
p.Depend("d","c"); p.Depend("d","a"); p.Depend("c","b"); p.Depend("b","a")
if p.Depend("a","d") || p.Depend("a","missing") || len(p.Dependencies("a"))!=0 {t.Fatal("long cycle or missing prerequisite accepted")}
d:=p.Dependencies("d"); if len(d)!=2 || d[0]!="a" || d[1]!="c" || len(p.Dependencies("missing"))!=0 {t.Fatal("snapshot sorting or unknown behavior incorrect")}`,
      `p:=NewDependencyPlanner(); p.Add("z"); p.Add("a"); p.Add("join"); p.Depend("join","z"); p.Depend("join","a")
r:=p.Ready(); if len(r)!=2 || r[0]!="a" || r[1]!="z" {t.Fatal("ready tasks must be sorted")}
p.Complete("a"); if p.Complete("join") {t.Fatal("all prerequisites must complete")}; p.Complete("z")
if !p.Add("later") || !p.Depend("later","a") || !p.Complete("later") {t.Fatal("completed prerequisite must be usable")}
if !p.Complete("join") || p.Depend("join","later") || p.Count()!=4 || len(p.Ready())!=0 {t.Fatal("completion invariants violated")}`,
    ],
  ),
});
fundamentalApi["dependency-planner"] = [
  "DependencyPlanner",
  "",
  [
    "Add|id:s|b",
    "Count||n",
    "Depend|task:s,prerequisite:s|b",
    "Dependencies|id:s|strings",
    "Ready||strings",
    "Complete|id:s|b",
  ],
];
fundamentalTests["dependency-planner"] = [
  [
    setup("NewDependencyPlanner()"),
    eq("s.Count()", 0),
    eq('s.Add("")', false),
    eq('s.Add("build")', true),
    eq('s.Add("build")', false),
    eq("s.Count()", 1),
    eq('s.Add("Build")', true),
    eq("s.Count()", 2),
  ],
  [
    setup("NewDependencyPlanner()"),
    run('s.Add("a")'),
    run('s.Add("b")'),
    run('s.Add("c")'),
    eq('s.Depend("b","a")', true),
    eq('s.Depend("c","b")', true),
    eq('s.Depend("a","c")', false),
    eq('s.Depend("a","a")', false),
    eq('s.Depend("b","a")', false),
    eq('s.Depend("missing","a")', false),
    eq('s.Dependencies("a")', []),
    eq("s.Count()", 3),
    eq('s.Dependencies("c")', ["b"]),
    { kind: "assign", name: "snapshot", expression: 's.Dependencies("c")' },
    run('snapshot[0] = "changed"'),
    eq('s.Dependencies("c")', ["b"]),
  ],
  [
    setup("NewDependencyPlanner()"),
    run('s.Add("build")'),
    run('s.Add("ship")'),
    run('s.Depend("ship","build")'),
    eq("s.Ready()", ["build"]),
    eq('s.Complete("ship")', false),
    eq('s.Complete("missing")', false),
    { kind: "assign", name: "snapshot", expression: "s.Ready()" },
    run('snapshot[0] = "changed"'),
    eq("s.Ready()", ["build"]),
    eq('s.Complete("build")', true),
    eq('s.Complete("build")', false),
    eq('s.Depend("build","ship")', false),
    eq("s.Ready()", ["ship"]),
    eq('s.Complete("ship")', true),
    eq("s.Ready()", []),
    eq("s.Count()", 2),
    eq('s.Add("build")', false),
    eq('s.Dependencies("ship")', ["build"]),
  ],
];
fundamentalHidden["dependency-planner"] = [
  [
    setup("NewDependencyPlanner()"),
    run('s.Add("x")'),
    run('s.Add("x")'),
    run('s.Add("")'),
    eq("s.Count()", 1),
    eq('s.Add("y")', true),
    eq("s.Count()", 2),
  ],
  [
    setup("NewDependencyPlanner()"),
    run('s.Add("a")'),
    run('s.Add("b")'),
    run('s.Add("c")'),
    run('s.Add("d")'),
    run('s.Depend("d","c")'),
    run('s.Depend("d","a")'),
    run('s.Depend("c","b")'),
    run('s.Depend("b","a")'),
    eq('s.Depend("a","d")', false),
    eq('s.Depend("a","missing")', false),
    eq('s.Dependencies("a")', []),
    eq('s.Dependencies("d")', ["a", "c"]),
    eq('s.Dependencies("missing")', []),
  ],
  [
    setup("NewDependencyPlanner()"),
    run('s.Add("z")'),
    run('s.Add("a")'),
    run('s.Add("join")'),
    run('s.Depend("join","z")'),
    run('s.Depend("join","a")'),
    eq("s.Ready()", ["a", "z"]),
    run('s.Complete("a")'),
    eq('s.Complete("join")', false),
    run('s.Complete("z")'),
    eq('s.Add("later")', true),
    eq('s.Depend("later","a")', true),
    eq('s.Complete("later")', true),
    eq('s.Complete("join")', true),
    eq('s.Depend("join","later")', false),
    eq("s.Count()", 4),
    eq("s.Ready()", []),
  ],
];
