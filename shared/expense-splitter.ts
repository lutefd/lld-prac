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

export const expenseProblems: PracticeProblem[] = [
  {
    id: "expense-splitter",
    title: "Expense splitter",
    category: "Banking",
    difficulty: "Medium",
    duration: 55,
    packageName: "practice",
    summary:
      "Split shared costs in integer cents, track balances, and suggest a deterministic settle-up.",
    tags: ["Money", "Splits", "Settlement"],
    levels: [
      level(
        "Members and equal splits",
        "Keep balances in integer cents among registered members.",
        [
          "NewGroup() *Group starts empty. AddMember(id string) bool registers a nonempty unique case-sensitive member. Duplicates and empty IDs return false.",
          "AddEqual(id, payer string, cents int, members []string) bool records a new nonempty unique expense ID paid by a registered payer for positive cents. members must be a nonempty set of registered members without duplicates; the payer need not be listed.",
          "Each listed member owes floor(cents / n) cents, and the first (cents % n) members in lexicographic order of the listed IDs owe one extra cent. The payer's net balance increases by cents and each debtor's net decreases by their share. Balance(id string) (int, bool) returns net cents (positive means others owe them) or (0, false) if unknown.",
        ],
        'AddMember("ana"); AddMember("bob"); AddEqual("lunch","ana",100,["ana","bob"]); Balance("ana"); Balance("bob")',
        "true; true; true; (50, true); (-50, true)",
      ),
      level(
        "Exact line items",
        "Support expenses whose shares are spelled out explicitly.",
        [
          'AddExact(id, payer string, lines []string) bool accepts a new expense ID and registered payer. Each line is "member:cents" with a registered member, nonnegative cents, and no duplicate members. At least one line is required; the sum of cents must be positive.',
          "The payer gains the total; each listed member loses their cents amount (a payer listed as a member nets total minus their own share). Invalid lines, unknown people, empty IDs, duplicate expense IDs, or a nonpositive total return false without changes. Prior equal-split rules remain available.",
        ],
        'AddMember("ana"); AddMember("bob"); AddExact("taxi","ana",["ana:30","bob:70"]); Balance("bob")',
        "true; true; true; (-70, true)",
      ),
      level(
        "Settle-up suggestions",
        "Clear balances with a deterministic set of transfers.",
        [
          'Settle() []string returns the fewest transfers that zero every balance, encoded as "from->to:cents" with positive cents. Pair the lexicographically smallest debtor (negative balance) with the lexicographically smallest creditor (positive balance), transfer min(-debt, credit), then repeat on updated remainders.',
          "When all balances are already zero, return an empty result. Settle never mutates balances; return a defensive copy. Empty Go results may be nil or empty slices. There is no currency conversion, fees, or concurrency.",
        ],
        'AddMember("ana"); AddMember("bob"); AddEqual("lunch","ana",100,["ana","bob"]); Settle()',
        'true; true; true; ["bob->ana:50"]',
      ),
    ],
    files: caseFiles(
      `type Group struct {}
func NewGroup() *Group { return &Group{} }
func (g *Group) AddMember(id string) bool { return false }
func (g *Group) AddEqual(id, payer string, cents int, members []string) bool { return false }
func (g *Group) Balance(id string) (int, bool) { return 0, false }
func (g *Group) AddExact(id, payer string, lines []string) bool { return false }
func (g *Group) Settle() []string { return nil }`,
      [
        `s:=NewGroup(); if !s.AddMember("ana") || !s.AddMember("bob") || s.AddMember("ana") || s.AddMember("") {t.Fatal("members incorrect")}; if !s.AddEqual("lunch","ana",100,[]string{"ana","bob"}) {t.Fatal("equal split rejected")}; if a,ok:=s.Balance("ana"); !ok || a!=50 {t.Fatal("payer balance wrong")}; if b,ok:=s.Balance("bob"); !ok || b!=-50 {t.Fatal("debtor balance wrong")}; if s.AddEqual("lunch","ana",1,[]string{"ana"}) || s.AddEqual("x","ana",0,[]string{"ana"}) || s.AddEqual("y","ana",10,[]string{"ana","ana"}) || s.AddEqual("z","ana",10,[]string{"missing"}) {t.Fatal("invalid equal accepted")}`,
        `s:=NewGroup(); s.AddMember("ana"); s.AddMember("bob"); s.AddMember("cat"); if !s.AddExact("taxi","ana",[]string{"ana:30","bob:70"}) {t.Fatal("exact rejected")}; if b,_:=s.Balance("bob"); b!=-70 {t.Fatal("exact bob wrong")}; if a,_:=s.Balance("ana"); a!=70 {t.Fatal("exact ana wrong")}; if s.AddExact("bad","ana",[]string{"bob:-1"}) || s.AddExact("bad2","ana",[]string{"bob:0","cat:0"}) || s.AddExact("dup","ana",[]string{"bob:1","bob:2"}) || s.AddExact("taxi","ana",[]string{"bob:1"}) {t.Fatal("invalid exact accepted")}; if !s.AddEqual("tips","bob",5,[]string{"ana","bob","cat"}) {t.Fatal("remainder split failed")}; if a,_:=s.Balance("ana"); a!=70-2 {t.Fatal("remainder distribution wrong")}`,
        `s:=NewGroup(); s.AddMember("ana"); s.AddMember("bob"); s.AddEqual("lunch","ana",100,[]string{"ana","bob"}); got:=s.Settle(); if len(got)!=1 || got[0]!="bob->ana:50" {t.Fatal("simple settle wrong")}; got[0]="x"; if s.Settle()[0]!="bob->ana:50" {t.Fatal("settle leaked")}; if a,_:=s.Balance("ana"); a!=50 {t.Fatal("settle mutated")}; s2:=NewGroup(); s2.AddMember("a"); s2.AddMember("b"); s2.AddMember("c"); s2.AddExact("e","a",[]string{"b:30","c:20"}); out:=s2.Settle(); if len(out)!=2 || out[0]!="b->a:30" || out[1]!="c->a:20" {t.Fatal("multi settle order wrong")}`,
      ],
      [
        `s:=NewGroup(); if _,ok:=s.Balance("x"); ok || !s.AddMember("A") || !s.AddMember("a") {t.Fatal("case or missing balance wrong")}; if !s.AddEqual("e","A",3,[]string{"A","a"}) {t.Fatal("tiny split failed")}; if A,_:=s.Balance("A"); A!=1 {t.Fatal("payer with remainder share wrong")}; if a,_:=s.Balance("a"); a!=-1 {t.Fatal("debt share wrong")}`,
        `s:=NewGroup(); s.AddMember("ana"); s.AddMember("bob"); if s.AddExact("e","ana",[]string{":1"}) || s.AddExact("e2","ana",[]string{"ana:x"}) || s.AddExact("","ana",[]string{"bob:1"}) || s.AddExact("e3","",[]string{"bob:1"}) {t.Fatal("malformed exact accepted")}; if !s.AddExact("ok","ana",[]string{"bob:0","ana:5"}) {t.Fatal("zero share line should be allowed when total positive")}; if b,_:=s.Balance("bob"); b!=0 {t.Fatal("zero share changed bob")}; if a,_:=s.Balance("ana"); a!=0 {t.Fatal("self exact net wrong")}`,
        `s:=NewGroup(); s.AddMember("z"); s.AddMember("a"); s.AddMember("m"); s.AddExact("e","z",[]string{"a:40","m:10"}); out:=s.Settle(); if len(out)!=2 || out[0]!="a->z:40" || out[1]!="m->z:10" {t.Fatal("creditor/debtor pairing wrong")}; s.AddEqual("f","a",3,[]string{"a","m","z"}); out=s.Settle(); if len(out)<1 {t.Fatal("combined settle empty")}; zero:=NewGroup(); zero.AddMember("only"); if len(zero.Settle())!=0 {t.Fatal("zero balances must settle empty")}`,
      ],
    ),
  },
];

export const expenseApi: Record<string, [string, string, string[]]> = {
  "expense-splitter": [
    "Group",
    "",
    [
      "AddMember|id:s|b",
      "AddEqual|id:s,payer:s,cents:n,members:strings|b",
      "Balance|id:s|money",
      "AddExact|id:s,payer:s,lines:strings|b",
      "Settle||strings",
    ],
  ],
};
export const expenseTests: Record<string, Command[][]> = {
  "expense-splitter": [
    [
      setup("NewGroup()"),
      eq('s.AddMember("ana")', true),
      eq('s.AddMember("bob")', true),
      eq('s.AddMember("ana")', false),
      eq('s.AddMember("")', false),
      eq('s.AddEqual("lunch","ana",100,["ana","bob"])', true),
      eq('s.Balance("ana")', [50, true]),
      eq('s.Balance("bob")', [-50, true]),
      eq('s.AddEqual("lunch","ana",1,["ana"])', false),
      eq('s.AddEqual("x","ana",0,["ana"])', false),
      eq('s.AddEqual("y","ana",10,["ana","ana"])', false),
      eq('s.AddEqual("z","ana",10,["missing"])', false),
    ],
    [
      setup("NewGroup()"),
      run('s.AddMember("ana")'),
      run('s.AddMember("bob")'),
      run('s.AddMember("cat")'),
      eq('s.AddExact("taxi","ana",["ana:30","bob:70"])', true),
      eq('s.Balance("bob")', [-70, true]),
      eq('s.Balance("ana")', [70, true]),
      eq('s.AddExact("bad","ana",["bob:-1"])', false),
      eq('s.AddExact("bad2","ana",["bob:0","cat:0"])', false),
      eq('s.AddExact("dup","ana",["bob:1","bob:2"])', false),
      eq('s.AddExact("taxi","ana",["bob:1"])', false),
      eq('s.AddEqual("tips","bob",5,["ana","bob","cat"])', true),
      eq('s.Balance("ana")', [68, true]),
    ],
    [
      setup("NewGroup()"),
      run('s.AddMember("ana")'),
      run('s.AddMember("bob")'),
      run('s.AddEqual("lunch","ana",100,["ana","bob"])'),
      eq("s.Settle()", ["bob->ana:50"]),
      { kind: "assign", name: "got", expression: "s.Settle()" },
      run('got[0] = "x"'),
      eq("s.Settle()", ["bob->ana:50"]),
      eq('s.Balance("ana")', [50, true]),
      run('s.AddMember("c")'),
      run('s.AddExact("e","ana",["bob:30","c:20"])'),
      eq("s.Settle()", ["bob->ana:80", "c->ana:20"]),
    ],
  ],
};
export const expenseHidden: Record<string, Command[][]> = {
  "expense-splitter": [
    [
      setup("NewGroup()"),
      eq('s.Balance("x")', [0, false]),
      eq('s.AddMember("A")', true),
      eq('s.AddMember("a")', true),
      eq('s.AddEqual("e","A",3,["A","a"])', true),
      eq('s.Balance("A")', [1, true]),
      eq('s.Balance("a")', [-1, true]),
    ],
    [
      setup("NewGroup()"),
      run('s.AddMember("ana")'),
      run('s.AddMember("bob")'),
      eq('s.AddExact("e","ana",[":1"])', false),
      eq('s.AddExact("e2","ana",["ana:x"])', false),
      eq('s.AddExact("","ana",["bob:1"])', false),
      eq('s.AddExact("e3","",["bob:1"])', false),
      eq('s.AddExact("ok","ana",["bob:0","ana:5"])', true),
      eq('s.Balance("bob")', [0, true]),
      eq('s.Balance("ana")', [0, true]),
    ],
    [
      setup("NewGroup()"),
      run('s.AddMember("z")'),
      run('s.AddMember("a")'),
      run('s.AddMember("m")'),
      run('s.AddExact("e","z",["a:40","m:10"])'),
      eq("s.Settle()", ["a->z:40", "m->z:10"]),
      run('s.AddEqual("f","a",3,["a","m","z"])'),
      eq("s.Settle()", ["a->z:38", "m->z:11"]),
    ],
  ],
};
