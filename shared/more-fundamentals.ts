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

export const moreFundamentalProblems: PracticeProblem[] = [
  {
    id: "text-editor-undo",
    title: "Text editor with undo",
    category: "Fundamentals",
    difficulty: "Medium",
    duration: 50,
    packageName: "practice",
    summary:
      "Maintain a text buffer and cursor, then layer undo and redo with history-clearing edits.",
    tags: ["Buffer", "Cursor", "Undo/redo"],
    levels: [
      level(
        "Edit a buffer",
        "Insert and delete around an explicit cursor index.",
        [
          "NewEditor() *Editor starts with empty text and cursor 0. Insert(text string) bool inserts text at the cursor and advances the cursor by len(text). Empty text returns false without changes; any other string is valid.",
          "Delete(n int) bool removes up to n characters immediately before the cursor when n > 0, moving the cursor left by the number removed. n < 1 or a cursor at 0 returns false without changes. Deleting more characters than exist before the cursor deletes only what is available and still returns true.",
          "Move(pos int) bool sets the cursor to pos when 0 <= pos <= len(Text()); otherwise false. Text() string and Cursor() int report the current buffer and cursor. There is no selection or rich text.",
        ],
        'Insert("ab"); Move(1); Insert("X"); Text(); Cursor()',
        'true; true; true; "aXb"; 2',
      ),
      level(
        "Undo edits",
        "Reverse successful inserts and deletes.",
        [
          "Undo() bool restores the text and cursor from before the most recent successful Insert or Delete and returns true. Move does not create undo records. When history is empty, return false.",
          "Each successful Insert or Delete pushes one undo record. Undo pops one record. Failed Insert/Delete/Move calls leave history unchanged.",
        ],
        'Insert("hi"); Delete(1); Undo(); Text(); Cursor()',
        'true; true; true; "hi"; 2',
      ),
      level(
        "Redo and clear redo on edit",
        "Reapply undone changes until a new edit branches history.",
        [
          "Redo() bool reapplies the most recently undone Insert or Delete, restoring that text and cursor, and returns true. Empty redo history returns false.",
          "A successful Undo pushes onto the redo stack. A successful Redo pops redo and pushes undo. A successful Insert or Delete clears the entire redo stack. Move never clears redo or creates history entries.",
        ],
        'Insert("a"); Undo(); Redo(); Text(); Insert("b"); Redo()',
        'true; true; true; "a"; true; false',
      ),
    ],
    files: caseFiles(
      `type Editor struct {}
func NewEditor() *Editor { return &Editor{} }
func (e *Editor) Insert(text string) bool { return false }
func (e *Editor) Delete(n int) bool { return false }
func (e *Editor) Move(pos int) bool { return false }
func (e *Editor) Text() string { return "" }
func (e *Editor) Cursor() int { return 0 }
func (e *Editor) Undo() bool { return false }
func (e *Editor) Redo() bool { return false }`,
      [
        `s:=NewEditor(); if !s.Insert("ab") || s.Insert("") || !s.Move(1) || s.Move(-1) || s.Move(3) || !s.Insert("X") {t.Fatal("edit validation incorrect")}; if s.Text()!="aXb" || s.Cursor()!=2 {t.Fatal("insert/move wrong")}; if !s.Delete(2) || s.Text()!="b" || s.Cursor()!=0 {t.Fatal("delete wrong")}; if s.Delete(0) || s.Delete(-1) {t.Fatal("bad delete accepted")}; if s.Delete(1) {t.Fatal("delete at start accepted")}`,
        `s:=NewEditor(); s.Insert("hi"); s.Delete(1); if !s.Undo() || s.Text()!="hi" || s.Cursor()!=2 {t.Fatal("undo delete failed")}; if !s.Undo() || s.Text()!="" || s.Cursor()!=0 || s.Undo() {t.Fatal("undo insert failed")}; s.Insert("z"); s.Move(0); if s.Undo()==false {t.Fatal("move should not block undo")}; if s.Text()!="" {t.Fatal("undo ignored move-only history")}`,
        `s:=NewEditor(); s.Insert("a"); if !s.Undo() || !s.Redo() || s.Text()!="a" || s.Cursor()!=1 {t.Fatal("redo failed")}; if !s.Insert("b") || s.Redo() || s.Text()!="ab" {t.Fatal("edit must clear redo")}; if !s.Undo() || !s.Undo() || !s.Redo() || s.Text()!="a" {t.Fatal("redo after double undo wrong")}`,
      ],
      [
        `s:=NewEditor(); if s.Text()!="" || s.Cursor()!=0 || !s.Insert("xyz") || !s.Delete(10) || s.Text()!="" || s.Cursor()!=0 {t.Fatal("over-delete should clear prefix")}; if !s.Insert("go") || s.Cursor()!=2 {t.Fatal("cursor advance wrong")}`,
        `s:=NewEditor(); s.Insert("ab"); s.Insert("c"); s.Undo(); s.Move(1); s.Undo(); if s.Text()!="" || s.Cursor()!=0 {t.Fatal("undo stack corrupted by move")}; if s.Delete(1) || s.Undo() {t.Fatal("failed delete created history")}`,
        `s:=NewEditor(); s.Insert("1"); s.Insert("2"); s.Undo(); s.Undo(); s.Redo(); s.Insert("x"); if s.Redo() || s.Text()!="1x" {t.Fatal("branching edit redo wrong")}; if !s.Undo() || !s.Undo() || !s.Redo() || !s.Redo() || s.Text()!="1x" {t.Fatal("redo chain wrong")}`,
      ],
    ),
  },
  {
    id: "lfu-cache",
    title: "LFU cache",
    category: "Fundamentals",
    difficulty: "Hard",
    duration: 60,
    packageName: "practice",
    summary:
      "Evict by least-frequent use with least-recently-used tie-breaks on a logical access order.",
    tags: ["Cache", "Frequency", "Eviction"],
    levels: [
      level(
        "Store values under capacity",
        "Keep string values keyed by nonempty case-sensitive names.",
        [
          "NewLFUCache(capacity int) *LFUCache creates an empty cache. Negative capacity is treated as zero. Len() int counts stored keys.",
          "Put(key, value string) bool inserts or overwrites when the key is nonempty and capacity > 0. Empty keys and all writes at capacity zero return false. Empty values are valid.",
          'Get(key string) (string, bool) returns the value or ("", false). An empty stored value returns ("", true). At this level, new keys never exceed capacity.',
        ],
        'NewLFUCache(2); Put("a",""); Get("a"); Len()',
        'true; ("", true); 1',
      ),
      level(
        "Evict by frequency then recency",
        "Track uses with an explicit logical access clock.",
        [
          "Every successful Get and every successful Put (including overwrites) increments that key's frequency by one and marks it most recently used on a logical access counter.",
          "When inserting a new key into a full positive-capacity cache, evict one existing key first: choose the lowest frequency, and if tied, the least recently used key. Put still returns true after eviction.",
          "Missing Get and rejected Put leave frequencies and recency unchanged. Overwriting never increases Len().",
        ],
        'Put("a","A"); Put("b","B"); Get("a"); Put("c","C"); Get("b")',
        'true; true; ("A", true); true; ("", false)',
      ),
      level(
        "Inspect frequency order",
        "Expose frequencies and an ordered key snapshot.",
        [
          "Freq(key string) (int, bool) returns the use count for a present key, or (0, false) when missing. Counts start at 1 after the creating Put.",
          "Keys() []string returns a defensive snapshot ordered by ascending frequency, and within the same frequency by least-recently-used first. Keys does not count as a use. Empty snapshots may be nil or empty in Go.",
        ],
        'Put("a","A"); Put("b","B"); Get("a"); Keys(); Freq("a")',
        'true; true; ("A", true); ["b", "a"]; (2, true)',
      ),
    ],
    files: caseFiles(
      `type LFUCache struct {}
func NewLFUCache(capacity int) *LFUCache { return &LFUCache{} }
func (c *LFUCache) Put(key, value string) bool { return false }
func (c *LFUCache) Get(key string) (string, bool) { return "", false }
func (c *LFUCache) Len() int { return 0 }
func (c *LFUCache) Freq(key string) (int, bool) { return 0, false }
func (c *LFUCache) Keys() []string { return nil }`,
      [
        `c:=NewLFUCache(2); if c.Len()!=0 || c.Put("","x") || !c.Put("a","") {t.Fatal("init/validation wrong")}; if v,ok:=c.Get("a"); !ok || v!="" || c.Len()!=1 {t.Fatal("empty value wrong")}; if !c.Put("a","new") || c.Len()!=1 {t.Fatal("overwrite grew")}; if _,ok:=c.Get("missing"); ok {t.Fatal("missing ok")}`,
        `c:=NewLFUCache(2); c.Put("a","A"); c.Put("b","B"); c.Get("a"); if !c.Put("c","C") || c.Len()!=2 {t.Fatal("evict insert failed")}; if _,ok:=c.Get("b"); ok {t.Fatal("LFU victim wrong")}; if v,ok:=c.Get("a"); !ok || v!="A" {t.Fatal("frequent key lost")}; c.Put("a","A2"); c.Put("d","D"); if _,ok:=c.Get("c"); ok {t.Fatal("overwrite must refresh frequency")}`,
        `c:=NewLFUCache(3); c.Put("a","A"); c.Put("b","B"); c.Put("c","C"); c.Get("a"); k:=c.Keys(); if len(k)!=3 || k[0]!="b" || k[1]!="c" || k[2]!="a" {t.Fatal("keys order wrong")}; k[0]="x"; if c.Keys()[0]!="b" {t.Fatal("keys leaked")}; if n,ok:=c.Freq("a"); !ok || n!=2 {t.Fatal("freq wrong")}; if _,ok:=c.Freq("missing"); ok {t.Fatal("missing freq")}`,
      ],
      [
        `c:=NewLFUCache(-1); if c.Put("a","A") || c.Len()!=0 {t.Fatal("negative capacity must behave as zero")}; c=NewLFUCache(2); c.Put("a","1"); c.Put("A","2"); if v,ok:=c.Get("A"); !ok || v!="2" || c.Len()!=2 {t.Fatal("case sensitivity wrong")}`,
        `c:=NewLFUCache(2); c.Put("a","A"); c.Put("b","B"); c.Get("missing"); c.Put("","z"); c.Put("c","C"); if _,ok:=c.Get("a"); ok {t.Fatal("failed ops changed eviction")}; if v,_:=c.Get("b"); v!="B" {t.Fatal("wrong victim")}; c=NewLFUCache(1); c.Put("a","A"); c.Put("a","B"); c.Put("b","C"); if _,ok:=c.Get("a"); ok || c.Len()!=1 {t.Fatal("capacity one overwrite/evict wrong")}`,
        `c:=NewLFUCache(2); c.Put("x","1"); c.Put("y","1"); c.Get("x"); c.Get("x"); c.Get("y"); k:=c.Keys(); if len(k)!=2 || k[0]!="y" || k[1]!="x" {t.Fatal("freq then LRU order wrong")}; if n,_:=c.Freq("x"); n!=3 {t.Fatal("get frequency wrong")}; c.Put("z","1"); if _,ok:=c.Get("y"); ok {t.Fatal("tie break victim wrong")}`,
      ],
    ),
  },
];

export const moreFundamentalApi: Record<string, [string, string, string[]]> = {
  "text-editor-undo": [
    "Editor",
    "",
    [
      "Insert|text:s|b",
      "Delete|n:n|b",
      "Move|pos:n|b",
      "Text||s",
      "Cursor||n",
      "Undo||b",
      "Redo||b",
    ],
  ],
  "lfu-cache": [
    "LFUCache",
    "capacity:n",
    [
      "Put|key:s,value:s|b",
      "Get|key:s|pair",
      "Len||n",
      "Freq|key:s|money",
      "Keys||strings",
    ],
  ],
};
export const moreFundamentalTests: Record<string, Command[][]> = {
  "text-editor-undo": [
    [
      setup("NewEditor()"),
      eq('s.Insert("ab")', true),
      eq('s.Insert("")', false),
      eq("s.Move(1)", true),
      eq("s.Move(-1)", false),
      eq("s.Move(3)", false),
      eq('s.Insert("X")', true),
      eq("s.Text()", "aXb"),
      eq("s.Cursor()", 2),
      eq("s.Delete(2)", true),
      eq("s.Text()", "b"),
      eq("s.Cursor()", 0),
      eq("s.Delete(0)", false),
      eq("s.Delete(-1)", false),
      eq("s.Delete(1)", false),
    ],
    [
      setup("NewEditor()"),
      run('s.Insert("hi")'),
      run("s.Delete(1)"),
      eq("s.Undo()", true),
      eq("s.Text()", "hi"),
      eq("s.Cursor()", 2),
      eq("s.Undo()", true),
      eq("s.Text()", ""),
      eq("s.Cursor()", 0),
      eq("s.Undo()", false),
      run('s.Insert("z")'),
      run("s.Move(0)"),
      eq("s.Undo()", true),
      eq("s.Text()", ""),
    ],
    [
      setup("NewEditor()"),
      run('s.Insert("a")'),
      eq("s.Undo()", true),
      eq("s.Redo()", true),
      eq("s.Text()", "a"),
      eq("s.Cursor()", 1),
      eq('s.Insert("b")', true),
      eq("s.Redo()", false),
      eq("s.Text()", "ab"),
      eq("s.Undo()", true),
      eq("s.Undo()", true),
      eq("s.Redo()", true),
      eq("s.Text()", "a"),
    ],
  ],
  "lfu-cache": [
    [
      setup("NewLFUCache(2)"),
      eq("s.Len()", 0),
      eq('s.Put("","x")', false),
      eq('s.Put("a","")', true),
      eq('s.Get("a")', ["", true]),
      eq("s.Len()", 1),
      eq('s.Put("a","new")', true),
      eq("s.Len()", 1),
      eq('s.Get("missing")', ["", false]),
    ],
    [
      setup("NewLFUCache(2)"),
      run('s.Put("a","A")'),
      run('s.Put("b","B")'),
      run('s.Get("a")'),
      eq('s.Put("c","C")', true),
      eq("s.Len()", 2),
      eq('s.Get("b")', ["", false]),
      eq('s.Get("a")', ["A", true]),
      run('s.Put("a","A2")'),
      run('s.Put("d","D")'),
      eq('s.Get("c")', ["", false]),
    ],
    [
      setup("NewLFUCache(3)"),
      run('s.Put("a","A")'),
      run('s.Put("b","B")'),
      run('s.Put("c","C")'),
      run('s.Get("a")'),
      eq("s.Keys()", ["b", "c", "a"]),
      { kind: "assign", name: "k", expression: "s.Keys()" },
      run('k[0] = "x"'),
      eq("s.Keys()", ["b", "c", "a"]),
      eq('s.Freq("a")', [2, true]),
      eq('s.Freq("missing")', [0, false]),
    ],
  ],
};
export const moreFundamentalHidden: Record<string, Command[][]> = {
  "text-editor-undo": [
    [
      setup("NewEditor()"),
      eq("s.Text()", ""),
      eq("s.Cursor()", 0),
      eq('s.Insert("xyz")', true),
      eq("s.Delete(10)", true),
      eq("s.Text()", ""),
      eq("s.Cursor()", 0),
    ],
    [
      setup("NewEditor()"),
      run('s.Insert("ab")'),
      run('s.Insert("c")'),
      run("s.Undo()"),
      run("s.Move(1)"),
      run("s.Undo()"),
      eq("s.Text()", ""),
      eq("s.Cursor()", 0),
      eq("s.Delete(1)", false),
      eq("s.Undo()", false),
    ],
    [
      setup("NewEditor()"),
      run('s.Insert("1")'),
      run('s.Insert("2")'),
      run("s.Undo()"),
      run("s.Undo()"),
      run("s.Redo()"),
      run('s.Insert("x")'),
      eq("s.Redo()", false),
      eq("s.Text()", "1x"),
      eq("s.Undo()", true),
      eq("s.Undo()", true),
      eq("s.Redo()", true),
      eq("s.Redo()", true),
      eq("s.Text()", "1x"),
    ],
  ],
  "lfu-cache": [
    [
      setup("NewLFUCache(-1)"),
      eq('s.Put("a","A")', false),
      eq("s.Len()", 0),
    ],
    [
      setup("NewLFUCache(2)"),
      run('s.Put("a","A")'),
      run('s.Put("b","B")'),
      run('s.Get("missing")'),
      run('s.Put("","z")'),
      run('s.Put("c","C")'),
      eq('s.Get("a")', ["", false]),
      eq('s.Get("b")', ["B", true]),
    ],
    [
      setup("NewLFUCache(2)"),
      run('s.Put("x","1")'),
      run('s.Put("y","1")'),
      run('s.Get("x")'),
      run('s.Get("x")'),
      run('s.Get("y")'),
      eq("s.Keys()", ["y", "x"]),
      eq('s.Freq("x")', [3, true]),
      run('s.Put("z","1")'),
      eq('s.Get("y")', ["", false]),
    ],
  ],
};
