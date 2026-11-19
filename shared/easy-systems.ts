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

export const easySystemProblems: PracticeProblem[] = [
  {
    id: "shopping-cart",
    title: "Shopping cart",
    category: "Fundamentals",
    difficulty: "Easy",
    duration: 30,
    packageName: "practice",
    summary:
      "Build a small cart one step at a time: distinct items, editable quantities, and totals in integer cents.",
    tags: ["Beginner", "Collections", "Integer money"],
    levels: [
      level(
        "Add distinct items",
        "Keep one cart line per item ID.",
        [
          "NewCart() *Cart creates an empty cart. AddItem(id string, unitPrice int) bool adds a nonempty, unique, case-sensitive ID with quantity 1 and a nonnegative unit price in cents.",
          "Count() int returns the number of distinct cart lines, not the sum of quantities. Empty IDs, negative prices, and duplicate IDs return false without changing existing lines or prices. Free items are valid.",
          "All prices, quantities, products, and sums fit in int (safe integers in TypeScript). There are no taxes, discounts, inventory checks, or external services.",
        ],
        'NewCart(); AddItem("book", 500); AddItem("book", 900); Count()',
        "true; false; 1",
      ),
      level(
        "Edit quantities and remove items",
        "Change a line without duplicating it.",
        [
          "Quantity(id string) (int, bool) returns a line's current positive quantity, or (0, false) if absent.",
          "SetQuantity(id string, quantity int) bool sets an existing line to a positive quantity. Unknown IDs and zero or negative quantities return false without changes. Setting the same quantity succeeds.",
          "Remove(id string) bool removes an existing line; unknown IDs return false. A removed ID may be added again at a new unit price and starts again at quantity 1. Quantity updates never change Count().",
        ],
        'AddItem("book", 500); SetQuantity("book", 3); Quantity("book"); Count(); Remove("book")',
        "true; true; (3, true); 1; true",
      ),
      level(
        "Calculate and inspect the cart",
        "Summarize stored lines without changing them.",
        [
          "Total() int returns the sum of unitPrice * quantity over all current lines, or zero when empty. Successful quantity changes and removals are reflected immediately.",
          "Items() []string returns all current item IDs in lexicographic order as a new snapshot. Mutating it must not change cart contents. Empty results may be nil or empty slices in Go.",
          "Total and Items never change quantities, prices, ordering, or membership. Failed calls from previous levels leave totals unchanged too.",
        ],
        'AddItem("book", 500); AddItem("pen", 100); SetQuantity("pen", 3); Total(); Items()',
        'true; true; true; 800; ["book", "pen"]',
      ),
    ],
    files: caseFiles(
      `type Cart struct {}
func NewCart() *Cart { return &Cart{} }
func (c *Cart) AddItem(id string, unitPrice int) bool { return false }
func (c *Cart) Count() int { return 0 }
func (c *Cart) Quantity(id string) (int, bool) { return 0, false }
func (c *Cart) SetQuantity(id string, quantity int) bool { return false }
func (c *Cart) Remove(id string) bool { return false }
func (c *Cart) Total() int { return 0 }
func (c *Cart) Items() []string { return nil }`,
      [
        `c:=NewCart(); if c.Count()!=0 || c.AddItem("",100) || c.AddItem("bad",-1) || !c.AddItem("book",500) || c.AddItem("book",900) || c.Count()!=1 {t.Fatal("item validation or count incorrect")}
if !c.AddItem("free",0) || c.Count()!=2 {t.Fatal("free items must be accepted")}`,
        `c:=NewCart(); c.AddItem("book",500)
if n,ok:=c.Quantity("book"); !ok || n!=1 {t.Fatal("new line must have quantity one")}
if !c.SetQuantity("book",3) || !c.SetQuantity("book",3) || c.SetQuantity("book",0) || c.SetQuantity("book",-1) || c.SetQuantity("missing",1) || c.Count()!=1 {t.Fatal("quantity validation incorrect")}
if n,ok:=c.Quantity("book"); !ok || n!=3 {t.Fatal("failed update changed quantity")}
if !c.Remove("book") || c.Remove("book") || c.Count()!=0 {t.Fatal("remove incorrect")}
if n,ok:=c.Quantity("book"); ok || n!=0 {t.Fatal("removed item still present")}
if !c.AddItem("book",700) {t.Fatal("removed ID must be reusable")}; if n,_:=c.Quantity("book"); n!=1 {t.Fatal("new line retained old quantity")}`,
        `c:=NewCart(); if c.Total()!=0 || len(c.Items())!=0 {t.Fatal("empty cart summary incorrect")}
c.AddItem("pen",100); c.AddItem("book",500); c.SetQuantity("pen",3)
if c.Total()!=800 {t.Fatal("total must multiply price and quantity")}
ids:=c.Items(); if len(ids)!=2 || ids[0]!="book" || ids[1]!="pen" {t.Fatal("IDs must be sorted")}; ids[0]="changed"
if c.Items()[0]!="book" || c.Count()!=2 || c.Total()!=800 {t.Fatal("snapshot changed cart")}
c.Remove("book"); if c.Total()!=300 {t.Fatal("remove not reflected in total")}`,
      ],
      [
        `c:=NewCart(); c.AddItem("a",1); if !c.AddItem("A",2) || c.Count()!=2 {t.Fatal("IDs must be case sensitive")}
if c.AddItem("retry",-1) || !c.AddItem("retry",0) || c.Count()!=3 {t.Fatal("failed add consumed ID")}`,
        `c:=NewCart(); if c.Remove("unknown") {t.Fatal("unknown item removed")}; if n,ok:=c.Quantity("unknown"); ok || n!=0 {t.Fatal("unknown quantity incorrect")}
c.AddItem("a",1); c.AddItem("b",2); c.SetQuantity("a",4); c.Remove("a")
if n,ok:=c.Quantity("b"); !ok || n!=1 || c.Count()!=1 {t.Fatal("removal affected another line")}`,
        `c:=NewCart(); c.AddItem("a",10); c.AddItem("free",0); c.SetQuantity("a",2); c.SetQuantity("free",100)
if c.AddItem("a",99) || c.SetQuantity("a",0) || c.Remove("unknown") || c.Total()!=20 {t.Fatal("invalid changes altered pricing")}
c.Remove("a"); c.AddItem("a",7); if c.Total()!=7 {t.Fatal("readded item must use new price and quantity one")}
c.SetQuantity("a",3); if c.Total()!=21 {t.Fatal("total query changed line")}
ids:=c.Items(); if len(ids)!=2 || ids[0]!="a" || ids[1]!="free" {t.Fatal("free item missing from snapshot")}`,
      ],
    ),
  },
  {
    id: "thermostat",
    title: "Thermostat",
    category: "Fundamentals",
    difficulty: "Easy",
    duration: 30,
    packageName: "practice",
    summary:
      "Practice small state updates, input validation, and clear heating or cooling thresholds using integer temperatures.",
    tags: ["Beginner", "Validation", "Conditions"],
    levels: [
      level(
        "Track target and current temperature",
        "Store integer Celsius temperatures without a real sensor or clock.",
        [
          "NewThermostat(initial int) *Thermostat receives an initial current temperature from -50 through 50 inclusive and starts with a target of 20. Current() int and Target() int return those stored values.",
          "Update(current int) bool accepts a current reading from -50 through 50 inclusive. SetTarget(target int) bool accepts a target from 5 through 35 inclusive. Valid calls store the value and return true, including unchanged values.",
          "Out-of-range calls return false and preserve both stored values. Updating the current reading never changes the target, and setting a target never changes the current reading.",
        ],
        "NewThermostat(18); Target(); SetTarget(22); Update(19); Current()",
        "20; true; true; 19",
      ),
      level(
        "Select an operating mode",
        "Compute whether heating or cooling is currently needed.",
        [
          'SetMode(mode string) bool accepts exactly "off", "heat", or "cool". The initial mode is "off". Invalid modes return false and preserve the previous mode; valid calls return true, including setting the same mode.',
          "Active() bool returns false in off mode. In heat mode it returns current < target; in cool mode it returns current > target. Equality is inactive in either mode.",
          "Active is a pure query: it never changes the mode or temperatures. Updates and target changes affect the next query immediately. There is no physical device, timer, or remembered on/off state.",
        ],
        'NewThermostat(18); Active(); SetMode("heat"); Active(); Update(20); Active()',
        "false; true; true; true; false",
      ),
      level(
        "Add a quiet temperature band",
        "Avoid running within a small distance of the target using simple comparisons.",
        [
          "SetTolerance(degrees int) bool accepts integers from 0 through 5 inclusive, initially zero. Tolerance() int returns the stored tolerance. Invalid calls return false and preserve the previous tolerance; valid unchanged values return true.",
          "With tolerance d, heat is active only when current < target - d, and cool is active only when current > target + d. Exact boundaries are inactive. Off mode is always inactive.",
          "The tolerance does not change Current or Target, and setting temperatures does not reset it. Recompute Active directly from the current values each time; no hysteresis or history is required. A tolerance of zero preserves all earlier behavior.",
        ],
        'NewThermostat(18); SetMode("heat"); SetTolerance(2); Active(); Update(17); Active()',
        "true; true; false; true; true",
      ),
    ],
    files: caseFiles(
      `type Thermostat struct {}
func NewThermostat(initial int) *Thermostat { return &Thermostat{} }
func (t *Thermostat) Current() int { return 0 }
func (t *Thermostat) Target() int { return 0 }
func (t *Thermostat) Update(current int) bool { return false }
func (t *Thermostat) SetTarget(target int) bool { return false }
func (t *Thermostat) SetMode(mode string) bool { return false }
func (t *Thermostat) Active() bool { return false }
func (t *Thermostat) SetTolerance(degrees int) bool { return false }
func (t *Thermostat) Tolerance() int { return 0 }`,
      [
        `s:=NewThermostat(18); if s.Current()!=18 || s.Target()!=20 {t.Fatal("initial temperatures incorrect")}
if !s.SetTarget(22) || !s.Update(19) || s.Current()!=19 || s.Target()!=22 {t.Fatal("valid update failed")}
if s.Update(-51) || s.Update(51) || s.SetTarget(4) || s.SetTarget(36) || s.Current()!=19 || s.Target()!=22 {t.Fatal("invalid update changed temperatures")}`,
        `s:=NewThermostat(18); if s.Active() || !s.SetMode("heat") || !s.Active() {t.Fatal("off or heating behavior incorrect")}
s.Update(20); if s.Active() {t.Fatal("heat must be inactive at target")}; s.Update(21)
if s.Active() || !s.SetMode("cool") || !s.Active() {t.Fatal("cooling comparison incorrect")}
if s.SetMode("COOL") || !s.Active() {t.Fatal("invalid mode changed state")}
if !s.SetMode("off") || s.Active() {t.Fatal("off mode must disable operation")}`,
        `s:=NewThermostat(18); s.SetMode("heat")
if s.Tolerance()!=0 || !s.SetTolerance(2) || s.Tolerance()!=2 || s.Active() {t.Fatal("heat boundary must be inactive")}
s.Update(17); if !s.Active() {t.Fatal("heat below lower boundary must activate")}
s.Update(22); s.SetMode("cool"); if s.Active() {t.Fatal("cool boundary must be inactive")}; s.Update(23)
if !s.Active() || s.SetTolerance(-1) || s.SetTolerance(6) || s.Tolerance()!=2 || !s.Active() {t.Fatal("tolerance validation changed behavior")}
if !s.SetTolerance(0) || s.Tolerance()!=0 || !s.Active() {t.Fatal("zero tolerance must restore strict target comparison")}`,
      ],
      [
        `s:=NewThermostat(-50); if !s.Update(50) || !s.Update(-50) || !s.SetTarget(5) || !s.SetTarget(35) || !s.SetTarget(35) {t.Fatal("inclusive boundaries rejected")}
if s.Current()!=-50 || s.Target()!=35 {t.Fatal("temperature updates must be independent")}`,
        `s:=NewThermostat(20); s.SetMode("cool"); if s.Active() {t.Fatal("cool equality must be inactive")}
s.SetTarget(19); if !s.Active() || !s.Active() {t.Fatal("target change or pure query incorrect")}
if s.SetMode("") || s.SetMode("auto") || !s.Active() {t.Fatal("invalid mode not preserved")}
s.Update(18); if s.Active() {t.Fatal("cooling below target must be inactive")}; s.SetMode("heat"); if !s.Active() {t.Fatal("mode switch not reflected")}`,
        `s:=NewThermostat(14); s.SetMode("heat"); if !s.SetTolerance(5) || !s.Active() {t.Fatal("maximum tolerance rejected")}
s.SetTarget(19); if s.Active() {t.Fatal("updated exact lower boundary active")}; if s.Tolerance()!=5 || s.Current()!=14 || s.Target()!=19 {t.Fatal("tolerance changed temperatures or reset")}
s.Update(25); s.SetMode("cool"); if !s.Active() {t.Fatal("upper comparison incorrect")}; s.SetMode("off"); if s.Active() {t.Fatal("tolerance bypassed off mode")}
if !s.SetTolerance(5) || s.Tolerance()!=5 {t.Fatal("unchanged tolerance must succeed")}`,
      ],
    ),
  },
];

export const easySystemApi: Record<string, [string, string, string[]]> = {
  "shopping-cart": [
    "Cart",
    "",
    [
      "AddItem|id:s,unitPrice:n|b",
      "Count||n",
      "Quantity|id:s|money",
      "SetQuantity|id:s,quantity:n|b",
      "Remove|id:s|b",
      "Total||n",
      "Items||strings",
    ],
  ],
  thermostat: [
    "Thermostat",
    "initial:n",
    [
      "Current||n",
      "Target||n",
      "Update|current:n|b",
      "SetTarget|target:n|b",
      "SetMode|mode:s|b",
      "Active||b",
      "SetTolerance|degrees:n|b",
      "Tolerance||n",
    ],
  ],
};
export const easySystemTests: Record<string, Command[][]> = {
  "shopping-cart": [
    [
      setup("NewCart()"),
      eq("s.Count()", 0),
      eq('s.AddItem("",100)', false),
      eq('s.AddItem("bad",-1)', false),
      eq('s.AddItem("book",500)', true),
      eq('s.AddItem("book",900)', false),
      eq("s.Count()", 1),
      eq('s.AddItem("free",0)', true),
      eq("s.Count()", 2),
    ],
    [
      setup("NewCart()"),
      run('s.AddItem("book",500)'),
      eq('s.Quantity("book")', [1, true]),
      eq('s.SetQuantity("book",3)', true),
      eq('s.SetQuantity("book",3)', true),
      eq('s.SetQuantity("book",0)', false),
      eq('s.SetQuantity("book",-1)', false),
      eq('s.SetQuantity("missing",1)', false),
      eq("s.Count()", 1),
      eq('s.Quantity("book")', [3, true]),
      eq('s.Remove("book")', true),
      eq('s.Remove("book")', false),
      eq("s.Count()", 0),
      eq('s.Quantity("book")', [0, false]),
      eq('s.AddItem("book",700)', true),
      eq('s.Quantity("book")', [1, true]),
    ],
    [
      setup("NewCart()"),
      eq("s.Total()", 0),
      eq("s.Items()", []),
      run('s.AddItem("pen",100)'),
      run('s.AddItem("book",500)'),
      run('s.SetQuantity("pen",3)'),
      eq("s.Total()", 800),
      eq("s.Items()", ["book", "pen"]),
      { kind: "assign", name: "ids", expression: "s.Items()" },
      run('ids[0] = "changed"'),
      eq("s.Items()", ["book", "pen"]),
      eq("s.Count()", 2),
      eq("s.Total()", 800),
      run('s.Remove("book")'),
      eq("s.Total()", 300),
    ],
  ],
  thermostat: [
    [
      setup("NewThermostat(18)"),
      eq("s.Current()", 18),
      eq("s.Target()", 20),
      eq("s.SetTarget(22)", true),
      eq("s.Update(19)", true),
      eq("s.Current()", 19),
      eq("s.Target()", 22),
      eq("s.Update(-51)", false),
      eq("s.Update(51)", false),
      eq("s.SetTarget(4)", false),
      eq("s.SetTarget(36)", false),
      eq("s.Current()", 19),
      eq("s.Target()", 22),
    ],
    [
      setup("NewThermostat(18)"),
      eq("s.Active()", false),
      eq('s.SetMode("heat")', true),
      eq("s.Active()", true),
      run("s.Update(20)"),
      eq("s.Active()", false),
      run("s.Update(21)"),
      eq("s.Active()", false),
      eq('s.SetMode("cool")', true),
      eq("s.Active()", true),
      eq('s.SetMode("COOL")', false),
      eq("s.Active()", true),
      eq('s.SetMode("off")', true),
      eq("s.Active()", false),
    ],
    [
      setup("NewThermostat(18)"),
      run('s.SetMode("heat")'),
      eq("s.Tolerance()", 0),
      eq("s.SetTolerance(2)", true),
      eq("s.Tolerance()", 2),
      eq("s.Active()", false),
      run("s.Update(17)"),
      eq("s.Active()", true),
      run("s.Update(22)"),
      run('s.SetMode("cool")'),
      eq("s.Active()", false),
      run("s.Update(23)"),
      eq("s.Active()", true),
      eq("s.SetTolerance(-1)", false),
      eq("s.SetTolerance(6)", false),
      eq("s.Tolerance()", 2),
      eq("s.Active()", true),
      eq("s.SetTolerance(0)", true),
      eq("s.Tolerance()", 0),
      eq("s.Active()", true),
    ],
  ],
};
export const easySystemHidden: Record<string, Command[][]> = {
  "shopping-cart": [
    [
      setup("NewCart()"),
      run('s.AddItem("a",1)'),
      eq('s.AddItem("A",2)', true),
      eq("s.Count()", 2),
      eq('s.AddItem("retry",-1)', false),
      eq('s.AddItem("retry",0)', true),
      eq("s.Count()", 3),
    ],
    [
      setup("NewCart()"),
      eq('s.Remove("unknown")', false),
      eq('s.Quantity("unknown")', [0, false]),
      run('s.AddItem("a",1)'),
      run('s.AddItem("b",2)'),
      run('s.SetQuantity("a",4)'),
      run('s.Remove("a")'),
      eq('s.Quantity("b")', [1, true]),
      eq("s.Count()", 1),
    ],
    [
      setup("NewCart()"),
      run('s.AddItem("a",10)'),
      run('s.AddItem("free",0)'),
      run('s.SetQuantity("a",2)'),
      run('s.SetQuantity("free",100)'),
      eq('s.AddItem("a",99)', false),
      eq('s.SetQuantity("a",0)', false),
      eq('s.Remove("unknown")', false),
      eq("s.Total()", 20),
      run('s.Remove("a")'),
      run('s.AddItem("a",7)'),
      eq("s.Total()", 7),
      run('s.SetQuantity("a",3)'),
      eq("s.Total()", 21),
      eq("s.Items()", ["a", "free"]),
    ],
  ],
  thermostat: [
    [
      setup("NewThermostat(-50)"),
      eq("s.Update(50)", true),
      eq("s.Update(-50)", true),
      eq("s.SetTarget(5)", true),
      eq("s.SetTarget(35)", true),
      eq("s.SetTarget(35)", true),
      eq("s.Current()", -50),
      eq("s.Target()", 35),
    ],
    [
      setup("NewThermostat(20)"),
      run('s.SetMode("cool")'),
      eq("s.Active()", false),
      run("s.SetTarget(19)"),
      eq("s.Active()", true),
      eq("s.Active()", true),
      eq('s.SetMode("")', false),
      eq('s.SetMode("auto")', false),
      eq("s.Active()", true),
      run("s.Update(18)"),
      eq("s.Active()", false),
      run('s.SetMode("heat")'),
      eq("s.Active()", true),
    ],
    [
      setup("NewThermostat(14)"),
      run('s.SetMode("heat")'),
      eq("s.SetTolerance(5)", true),
      eq("s.Active()", true),
      run("s.SetTarget(19)"),
      eq("s.Active()", false),
      eq("s.Tolerance()", 5),
      eq("s.Current()", 14),
      eq("s.Target()", 19),
      run("s.Update(25)"),
      run('s.SetMode("cool")'),
      eq("s.Active()", true),
      run('s.SetMode("off")'),
      eq("s.Active()", false),
      eq("s.SetTolerance(5)", true),
      eq("s.Tolerance()", 5),
    ],
  ],
};
