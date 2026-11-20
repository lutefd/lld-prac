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

export const commerceProblems: PracticeProblem[] = [
  {
    id: "coupon-registry",
    title: "Coupon registry",
    category: "Commerce",
    difficulty: "Easy",
    duration: 30,
    packageName: "practice",
    summary:
      "Register fixed discounts, quote purchases, and disable coupons without losing their identities.",
    tags: ["Validation", "Integer money", "Registry"],
    levels: [
      level(
        "Register coupons",
        "Store fixed discounts in integer cents.",
        [
          "NewCoupons() *Coupons creates an empty registry. Add(code string, cents int) bool accepts a nonempty unique case-sensitive code and a positive discount.",
          "Count() int counts every registered code. Invalid adds return false without changing the original discount or consuming a new code. All arithmetic fits in int (safe integers in TypeScript).",
        ],
        'Add("SAVE", 200); Add("SAVE", 500); Count()',
        "true; false; 1",
      ),
      level(
        "Quote discounted purchases",
        "Apply reusable discounts without changing the registry.",
        [
          "Apply(code string, subtotal int) (int, bool) returns max(0, subtotal-discount) and true for a known enabled coupon and a nonnegative subtotal.",
          "Unknown codes or negative subtotals return (0, false). New coupons are enabled. Queries never consume a coupon, even when the subtotal is zero.",
        ],
        'Add("SAVE", 200); Apply("SAVE", 150); Apply("SAVE", 500)',
        "true; (0, true); (300, true)",
      ),
      level(
        "Control availability",
        "Temporarily disable a code while retaining its identity and discount.",
        [
          "SetEnabled(code string, enabled bool) bool updates a known coupon and returns true, even if unchanged. Unknown codes return false.",
          "Disabled coupons cause Apply to return (0, false). Re-enabling restores the original discount. Count includes disabled coupons; their codes cannot be added again.",
        ],
        'Add("SAVE", 200); SetEnabled("SAVE", false); Apply("SAVE", 500); Count()',
        "true; true; (0, false); 1",
      ),
    ],
    files: caseFiles(
      `type Coupons struct {}
func NewCoupons() *Coupons { return &Coupons{} }
func (s *Coupons) Add(code string, cents int) bool { return false }
func (s *Coupons) Count() int { return 0 }
func (s *Coupons) Apply(code string, subtotal int) (int, bool) { return 0, false }
func (s *Coupons) SetEnabled(code string, enabled bool) bool { return false }`,
      [
        `s:=NewCoupons(); if s.Count()!=0 || !s.Add("SAVE",200) || s.Add("SAVE",500) || s.Add("",1) || s.Add("bad",0) || s.Count()!=1 {t.Fatal("registration validation failed")}`,
        `s:=NewCoupons(); s.Add("SAVE",200); if n,ok:=s.Apply("SAVE",500); !ok || n!=300 {t.Fatal("discount incorrect")}; if n,ok:=s.Apply("SAVE",150); !ok || n!=0 {t.Fatal("discount must clamp")}; if _,ok:=s.Apply("SAVE",-1); ok {t.Fatal("negative subtotal accepted")}; if _,ok:=s.Apply("missing",1); ok {t.Fatal("unknown code accepted")}`,
        `s:=NewCoupons(); s.Add("SAVE",200); if !s.SetEnabled("SAVE",false) || !s.SetEnabled("SAVE",false) || s.SetEnabled("missing",true) {t.Fatal("toggle validation incorrect")}; if _,ok:=s.Apply("SAVE",500); ok {t.Fatal("disabled coupon accepted")}; if s.Add("SAVE",1) || s.Count()!=1 || !s.SetEnabled("SAVE",true) {t.Fatal("disabled coupon identity lost")}; if n,ok:=s.Apply("SAVE",500); !ok || n!=300 {t.Fatal("original discount not restored")}`,
      ],
      [
        `s:=NewCoupons(); if s.Add("x",-1) || !s.Add("x",1) || !s.Add("X",2) || s.Count()!=2 {t.Fatal("case sensitivity or failed add consumed code")}`,
        `s:=NewCoupons(); s.Add("x",1); s.Add("x",9); for i:=0;i<2;i++ {if n,ok:=s.Apply("x",2); !ok || n!=1 {t.Fatal("query consumed coupon or duplicate changed discount")}}; if n,ok:=s.Apply("x",0); !ok || n!=0 {t.Fatal("zero subtotal rejected")}`,
        `s:=NewCoupons(); s.Add("a",1); s.Add("b",2); s.SetEnabled("a",false); if n,ok:=s.Apply("b",4); !ok || n!=2 {t.Fatal("toggle affected other code")}; if !s.SetEnabled("a",true) {t.Fatal("reenable failed")}; if n,ok:=s.Apply("a",4); !ok || n!=3 {t.Fatal("reenable lost discount")}`,
      ],
    ),
  },
  {
    id: "restaurant-orders",
    title: "Restaurant orders",
    category: "Commerce",
    difficulty: "Medium",
    duration: 50,
    packageName: "practice",
    summary:
      "Build editable orders, freeze their totals on submission, and enforce a kitchen fulfillment lifecycle.",
    tags: ["State machine", "Integer money", "Invariants"],
    levels: [
      level(
        "Build an order",
        "Keep a separate draft and integer total for each order.",
        [
          'NewKitchen() *Kitchen starts empty. Create(id string) bool creates a unique nonempty order in "draft" state with total zero. Status(id string) (string, bool) returns the state or ("", false).',
          "Add(id string, cents int) bool adds a positive line price to a draft order. Total(id string) (int, bool) returns the sum for any known order, or (0, false). Invalid operations return false without mutations. Arithmetic fits in int (safe integers in TypeScript).",
        ],
        'Create("a"); Add("a", 500); Add("a", 200); Total("a")',
        "true; true; true; (700, true)",
      ),
      level(
        "Send orders to the kitchen",
        "Freeze the order and progress through preparation.",
        [
          'Submit(id string) bool transitions only a nonempty draft (total > 0) to "submitted". Advance(id string) bool transitions "submitted" to "preparing", then "preparing" to "ready".',
          "All other transitions return false, preserving status and total. Add is rejected after submission. Ready orders cannot advance further; repeated Submit does not reset an order.",
        ],
        'Create("a"); Add("a", 500); Submit("a"); Advance("a"); Status("a")',
        'true; true; true; true; ("preparing", true)',
      ),
      level(
        "Cancel or collect",
        "Enforce terminal states and safe cancellation rules.",
        [
          'Cancel(id string) bool transitions only "draft" or "submitted" to "cancelled". Collect(id string) bool transitions only "ready" to "collected".',
          "Cancelled and collected orders are terminal. Cancellation preserves the stored total and permanently reserves the ID. Preparing orders cannot be cancelled. Every invalid transition is atomic; other orders are unaffected.",
        ],
        'Create("a"); Cancel("a"); Create("a"); Status("a")',
        'true; true; false; ("cancelled", true)',
      ),
    ],
    files: caseFiles(
      `type Kitchen struct {}
func NewKitchen() *Kitchen { return &Kitchen{} }
func (s *Kitchen) Create(id string) bool { return false }
func (s *Kitchen) Status(id string) (string, bool) { return "", false }
func (s *Kitchen) Add(id string, cents int) bool { return false }
func (s *Kitchen) Total(id string) (int, bool) { return 0, false }
func (s *Kitchen) Submit(id string) bool { return false }
func (s *Kitchen) Advance(id string) bool { return false }
func (s *Kitchen) Cancel(id string) bool { return false }
func (s *Kitchen) Collect(id string) bool { return false }`,
      [
        `s:=NewKitchen(); if !s.Create("a") || s.Create("a") || s.Create("") || !s.Add("a",500) || !s.Add("a",200) || s.Add("a",0) || s.Add("missing",1) {t.Fatal("draft validation failed")}; if n,ok:=s.Total("a"); !ok || n!=700 {t.Fatal("draft total wrong")}; if st,ok:=s.Status("a"); !ok || st!="draft" {t.Fatal("draft state wrong")}`,
        `s:=NewKitchen(); s.Create("a"); if s.Submit("a") || s.Advance("a") {t.Fatal("empty draft submitted")}; s.Add("a",1); if !s.Submit("a") || s.Submit("a") || s.Add("a",2) || !s.Advance("a") {t.Fatal("submit or prepare incorrect")}; if st,_:=s.Status("a"); st!="preparing" {t.Fatal("preparing state wrong")}; if !s.Advance("a") || s.Advance("a") {t.Fatal("ready transition wrong")}; if st,_:=s.Status("a"); st!="ready" {t.Fatal("ready state wrong")}; if n,_:=s.Total("a"); n!=1 {t.Fatal("frozen total changed")}`,
        `s:=NewKitchen(); s.Create("a"); s.Add("a",5); if !s.Cancel("a") || s.Cancel("a") || s.Collect("a") || s.Create("a") || s.Add("a",1) {t.Fatal("cancel terminal behavior wrong")}; if n,_:=s.Total("a"); n!=5 {t.Fatal("cancel lost total")}; s.Create("b"); s.Add("b",1); s.Submit("b"); s.Advance("b"); if s.Cancel("b") || s.Collect("b") {t.Fatal("preparing terminal transition accepted")}; s.Advance("b"); if !s.Collect("b") || s.Collect("b") || s.Cancel("b") {t.Fatal("collection terminal behavior wrong")}; if st,_:=s.Status("b"); st!="collected" {t.Fatal("collected state wrong")}`,
      ],
      [
        `s:=NewKitchen(); if st,ok:=s.Status("missing"); ok || st!="" {t.Fatal("unknown status wrong")}; if n,ok:=s.Total("missing"); ok || n!=0 {t.Fatal("unknown total wrong")}; s.Create("a"); s.Add("a",4); if s.Add("a",-1) || s.Create("a") {t.Fatal("invalid change accepted")}; if n,_:=s.Total("a"); n!=4 {t.Fatal("failed operation changed total")}`,
        `s:=NewKitchen(); if s.Submit("missing") || s.Advance("missing") {t.Fatal("unknown transition accepted")}; s.Create("a"); s.Add("a",1); s.Submit("a"); s.Create("b"); if s.Advance("b") {t.Fatal("draft advanced")}; if st,_:=s.Status("a"); st!="submitted" {t.Fatal("other order affected")}`,
        `s:=NewKitchen(); if s.Cancel("missing") || s.Collect("missing") {t.Fatal("unknown terminal transition accepted")}; s.Create("a"); s.Add("a",3); s.Submit("a"); if !s.Cancel("a") || s.Submit("a") || s.Advance("a") {t.Fatal("submitted cancellation wrong")}; if st,_:=s.Status("a"); st!="cancelled" {t.Fatal("cancelled state wrong")}; if n,_:=s.Total("a"); n!=3 {t.Fatal("cancelled total changed")}`,
      ],
    ),
  },
  {
    id: "auction-house",
    title: "Auction house",
    category: "Commerce",
    difficulty: "Hard",
    duration: 65,
    packageName: "practice",
    summary:
      "Coordinate timed auctions, reserve prices, strictly increasing bids, and globally idempotent bid requests.",
    tags: ["Explicit time", "Idempotency", "Atomic updates"],
    levels: [
      level(
        "List auction lots",
        "Register independent lots with explicit deadlines.",
        [
          "NewAuctions() *Auctions starts empty. List(id string, reserve, deadline int) bool registers a nonempty unique lot ID with positive reserve cents and nonnegative deadline seconds. Invalid calls preserve all data.",
          "Highest(id string) (int, bool) returns the highest accepted bid, initially zero, or (0, false) for unknown lots. No real clock, payment service, concurrency, or persistence is required. Integers and arithmetic fit in int (safe integers in TypeScript).",
        ],
        'List("art", 100, 10); Highest("art")',
        "true; (0, true)",
      ),
      level(
        "Accept bids with safe retries",
        "Validate a complete request before updating the leader or reserving its request ID.",
        [
          "Bid(requestID, lotID, bidder string, cents, now int) bool requires nonempty request and bidder IDs, a known open lot, 0 <= now < deadline, and cents >= reserve and strictly greater than Highest. Equal bids are rejected. now is supplied per call; timestamps need not be globally monotonic.",
          "Successful request IDs are global across lots. An exact retry of every original parameter returns true without changing any auction, even after closing or a newer bid. Reusing that ID with any different parameter returns false. Failed bids never consume request IDs. All validation failures preserve every lot and accepted request.",
        ],
        'List("art", 100, 10); Bid("r1", "art", "ana", 100, 0); Bid("r2", "art", "bob", 100, 1); Highest("art")',
        "true; true; false; (100, true)",
      ),
      level(
        "Close auctions and declare winners",
        "Finalize outcomes only at or after each lot's deadline.",
        [
          "Close(id string, now int) bool succeeds only for a known open lot with now >= deadline. It permanently closes that lot, including lots with no bids. Repeat closes return false. Fresh bids on a closed lot fail regardless of their supplied timestamp.",
          'Winner(id string) (string, bool) returns the highest bidder only for a closed lot with an accepted bid; otherwise it returns ("", false). Highest remains available after closing. Closing one lot does not affect any other lot or erase request retry records.',
        ],
        'List("art", 100, 10); Bid("r1", "art", "ana", 100, 0); Close("art", 10); Winner("art")',
        'true; true; true; ("ana", true)',
      ),
    ],
    files: caseFiles(
      `type Auctions struct {}
func NewAuctions() *Auctions { return &Auctions{} }
func (s *Auctions) List(id string, reserve, deadline int) bool { return false }
func (s *Auctions) Highest(id string) (int, bool) { return 0, false }
func (s *Auctions) Bid(requestID, lotID, bidder string, cents, now int) bool { return false }
func (s *Auctions) Close(id string, now int) bool { return false }
func (s *Auctions) Winner(id string) (string, bool) { return "", false }`,
      [
        `s:=NewAuctions(); if !s.List("art",100,10) || s.List("art",1,99) || s.List("",1,1) || s.List("bad",0,1) || s.List("bad",1,-1) {t.Fatal("listing validation wrong")}; if n,ok:=s.Highest("art"); !ok || n!=0 {t.Fatal("new lot highest wrong")}`,
        `s:=NewAuctions(); s.List("art",100,10); if s.Bid("r","art","ana",99,0) || !s.Bid("r","art","ana",100,0) || s.Bid("tie","art","bob",100,1) || s.Bid("late","art","bob",200,10) || !s.Bid("new","art","bob",200,9) || !s.Bid("r","art","ana",100,0) || s.Bid("r","art","ana",101,0) {t.Fatal("bid ordering, boundary, or retry wrong")}; if n,_:=s.Highest("art"); n!=200 {t.Fatal("retry changed highest")}`,
        `s:=NewAuctions(); s.List("art",100,10); s.Bid("r","art","ana",100,0); if _,ok:=s.Winner("art"); ok {t.Fatal("open auction has winner")}; if s.Close("art",9) || !s.Close("art",10) || s.Close("art",10) || s.Bid("late","art","bob",200,1) {t.Fatal("close boundary or terminal state wrong")}; if who,ok:=s.Winner("art"); !ok || who!="ana" {t.Fatal("winner wrong")}; if !s.Bid("r","art","ana",100,0) {t.Fatal("closed retry rejected")}; s.List("empty",1,0); if !s.Close("empty",0) {t.Fatal("empty auction cannot close")}; if _,ok:=s.Winner("empty"); ok {t.Fatal("empty auction has winner")}`,
      ],
      [
        `s:=NewAuctions(); if n,ok:=s.Highest("missing"); ok || n!=0 {t.Fatal("unknown highest wrong")}; if s.List("retry",-1,1) || !s.List("retry",1,0) || !s.List("Retry",1,0) {t.Fatal("failed listing reserved ID or case sensitivity wrong")}`,
        `s:=NewAuctions(); s.List("a",1,10); s.List("b",1,10); if s.Bid("","a","ana",1,0) || s.Bid("x","a","",1,0) || s.Bid("x","a","ana",1,-1) || s.Bid("x","missing","ana",1,0) || !s.Bid("x","a","ana",2,1) || s.Bid("x","b","ana",2,1) || s.Bid("x","a","ana",2,2) || !s.Bid("y","b","bob",1,0) {t.Fatal("request identity or validation wrong")}; if n,_:=s.Highest("a"); n!=2 {t.Fatal("other lot changed highest")}`,
        `s:=NewAuctions(); if s.Close("missing",100) {t.Fatal("unknown close accepted")}; if who,ok:=s.Winner("missing"); ok || who!="" {t.Fatal("unknown winner wrong")}; s.List("a",1,2); s.List("b",1,5); s.Bid("a1","a","ana",1,0); s.Bid("a2","a","bob",2,1); s.Close("a",3); if who,ok:=s.Winner("a"); !ok || who!="bob" {t.Fatal("latest leader not selected")}; if n,ok:=s.Highest("a"); !ok || n!=2 {t.Fatal("closing lost highest")}; if !s.Bid("a1","a","ana",1,0) || !s.Bid("b1","b","cat",1,4) {t.Fatal("close erased retries or affected independent lot")}`,
      ],
    ),
  },
];

export const commerceApi: Record<string, [string, string, string[]]> = {
  "coupon-registry": [
    "Coupons",
    "",
    [
      "Add|code:s,cents:n|b",
      "Count||n",
      "Apply|code:s,subtotal:n|money",
      "SetEnabled|code:s,enabled:b|b",
    ],
  ],
  "restaurant-orders": [
    "Kitchen",
    "",
    [
      "Create|id:s|b",
      "Status|id:s|pair",
      "Add|id:s,cents:n|b",
      "Total|id:s|money",
      "Submit|id:s|b",
      "Advance|id:s|b",
      "Cancel|id:s|b",
      "Collect|id:s|b",
    ],
  ],
  "auction-house": [
    "Auctions",
    "",
    [
      "List|id:s,reserve:n,deadline:n|b",
      "Highest|id:s|money",
      "Bid|requestID:s,lotID:s,bidder:s,cents:n,now:n|b",
      "Close|id:s,now:n|b",
      "Winner|id:s|pair",
    ],
  ],
};
export const commerceTests: Record<string, Command[][]> = {
  "coupon-registry": [
    [
      setup("NewCoupons()"),
      eq("s.Count()", 0),
      eq('s.Add("SAVE",200)', true),
      eq('s.Add("SAVE",500)', false),
      eq('s.Add("",1)', false),
      eq('s.Add("bad",0)', false),
      eq("s.Count()", 1),
    ],
    [
      setup("NewCoupons()"),
      run('s.Add("SAVE",200)'),
      eq('s.Apply("SAVE",500)', [300, true]),
      eq('s.Apply("SAVE",150)', [0, true]),
      eq('s.Apply("SAVE",-1)', [0, false]),
      eq('s.Apply("missing",1)', [0, false]),
    ],
    [
      setup("NewCoupons()"),
      run('s.Add("SAVE",200)'),
      eq('s.SetEnabled("SAVE",false)', true),
      eq('s.SetEnabled("SAVE",false)', true),
      eq('s.SetEnabled("missing",true)', false),
      eq('s.Apply("SAVE",500)', [0, false]),
      eq('s.Add("SAVE",1)', false),
      eq("s.Count()", 1),
      eq('s.SetEnabled("SAVE",true)', true),
      eq('s.Apply("SAVE",500)', [300, true]),
    ],
  ],
  "restaurant-orders": [
    [
      setup("NewKitchen()"),
      eq('s.Create("a")', true),
      eq('s.Create("a")', false),
      eq('s.Create("")', false),
      eq('s.Add("a",500)', true),
      eq('s.Add("a",200)', true),
      eq('s.Add("a",0)', false),
      eq('s.Add("missing",1)', false),
      eq('s.Total("a")', [700, true]),
      eq('s.Status("a")', ["draft", true]),
    ],
    [
      setup("NewKitchen()"),
      run('s.Create("a")'),
      eq('s.Submit("a")', false),
      eq('s.Advance("a")', false),
      run('s.Add("a",1)'),
      eq('s.Submit("a")', true),
      eq('s.Submit("a")', false),
      eq('s.Add("a",2)', false),
      eq('s.Advance("a")', true),
      eq('s.Status("a")', ["preparing", true]),
      eq('s.Advance("a")', true),
      eq('s.Advance("a")', false),
      eq('s.Status("a")', ["ready", true]),
      eq('s.Total("a")', [1, true]),
    ],
    [
      setup("NewKitchen()"),
      run('s.Create("a")'),
      run('s.Add("a",5)'),
      eq('s.Cancel("a")', true),
      eq('s.Cancel("a")', false),
      eq('s.Collect("a")', false),
      eq('s.Create("a")', false),
      eq('s.Add("a",1)', false),
      eq('s.Total("a")', [5, true]),
      run('s.Create("b")'),
      run('s.Add("b",1)'),
      run('s.Submit("b")'),
      run('s.Advance("b")'),
      eq('s.Cancel("b")', false),
      eq('s.Collect("b")', false),
      run('s.Advance("b")'),
      eq('s.Collect("b")', true),
      eq('s.Collect("b")', false),
      eq('s.Cancel("b")', false),
      eq('s.Status("b")', ["collected", true]),
    ],
  ],
  "auction-house": [
    [
      setup("NewAuctions()"),
      eq('s.List("art",100,10)', true),
      eq('s.List("art",1,99)', false),
      eq('s.List("",1,1)', false),
      eq('s.List("bad",0,1)', false),
      eq('s.List("bad",1,-1)', false),
      eq('s.Highest("art")', [0, true]),
    ],
    [
      setup("NewAuctions()"),
      run('s.List("art",100,10)'),
      eq('s.Bid("r","art","ana",99,0)', false),
      eq('s.Bid("r","art","ana",100,0)', true),
      eq('s.Bid("tie","art","bob",100,1)', false),
      eq('s.Bid("late","art","bob",200,10)', false),
      eq('s.Bid("new","art","bob",200,9)', true),
      eq('s.Bid("r","art","ana",100,0)', true),
      eq('s.Bid("r","art","ana",101,0)', false),
      eq('s.Highest("art")', [200, true]),
    ],
    [
      setup("NewAuctions()"),
      run('s.List("art",100,10)'),
      run('s.Bid("r","art","ana",100,0)'),
      eq('s.Winner("art")', ["", false]),
      eq('s.Close("art",9)', false),
      eq('s.Close("art",10)', true),
      eq('s.Close("art",10)', false),
      eq('s.Bid("late","art","bob",200,1)', false),
      eq('s.Winner("art")', ["ana", true]),
      eq('s.Bid("r","art","ana",100,0)', true),
      run('s.List("empty",1,0)'),
      eq('s.Close("empty",0)', true),
      eq('s.Winner("empty")', ["", false]),
    ],
  ],
};
export const commerceHidden: Record<string, Command[][]> = {
  "coupon-registry": [
    [
      setup("NewCoupons()"),
      eq('s.Add("x",-1)', false),
      eq('s.Add("x",1)', true),
      eq('s.Add("X",2)', true),
      eq("s.Count()", 2),
    ],
    [
      setup("NewCoupons()"),
      run('s.Add("x",1)'),
      run('s.Add("x",9)'),
      eq('s.Apply("x",2)', [1, true]),
      eq('s.Apply("x",2)', [1, true]),
      eq('s.Apply("x",0)', [0, true]),
    ],
    [
      setup("NewCoupons()"),
      run('s.Add("a",1)'),
      run('s.Add("b",2)'),
      run('s.SetEnabled("a",false)'),
      eq('s.Apply("b",4)', [2, true]),
      eq('s.SetEnabled("a",true)', true),
      eq('s.Apply("a",4)', [3, true]),
    ],
  ],
  "restaurant-orders": [
    [
      setup("NewKitchen()"),
      eq('s.Status("missing")', ["", false]),
      eq('s.Total("missing")', [0, false]),
      run('s.Create("a")'),
      run('s.Add("a",4)'),
      eq('s.Add("a",-1)', false),
      eq('s.Create("a")', false),
      eq('s.Total("a")', [4, true]),
    ],
    [
      setup("NewKitchen()"),
      eq('s.Submit("missing")', false),
      eq('s.Advance("missing")', false),
      run('s.Create("a")'),
      run('s.Add("a",1)'),
      run('s.Submit("a")'),
      run('s.Create("b")'),
      eq('s.Advance("b")', false),
      eq('s.Status("a")', ["submitted", true]),
    ],
    [
      setup("NewKitchen()"),
      eq('s.Cancel("missing")', false),
      eq('s.Collect("missing")', false),
      run('s.Create("a")'),
      run('s.Add("a",3)'),
      run('s.Submit("a")'),
      eq('s.Cancel("a")', true),
      eq('s.Submit("a")', false),
      eq('s.Advance("a")', false),
      eq('s.Status("a")', ["cancelled", true]),
      eq('s.Total("a")', [3, true]),
    ],
  ],
  "auction-house": [
    [
      setup("NewAuctions()"),
      eq('s.Highest("missing")', [0, false]),
      eq('s.List("retry",-1,1)', false),
      eq('s.List("retry",1,0)', true),
      eq('s.List("Retry",1,0)', true),
    ],
    [
      setup("NewAuctions()"),
      run('s.List("a",1,10)'),
      run('s.List("b",1,10)'),
      eq('s.Bid("","a","ana",1,0)', false),
      eq('s.Bid("x","a","",1,0)', false),
      eq('s.Bid("x","a","ana",1,-1)', false),
      eq('s.Bid("x","missing","ana",1,0)', false),
      eq('s.Bid("x","a","ana",2,1)', true),
      eq('s.Bid("x","b","ana",2,1)', false),
      eq('s.Bid("x","a","ana",2,2)', false),
      eq('s.Bid("y","b","bob",1,0)', true),
      eq('s.Highest("a")', [2, true]),
    ],
    [
      setup("NewAuctions()"),
      eq('s.Close("missing",100)', false),
      eq('s.Winner("missing")', ["", false]),
      run('s.List("a",1,2)'),
      run('s.List("b",1,5)'),
      run('s.Bid("a1","a","ana",1,0)'),
      run('s.Bid("a2","a","bob",2,1)'),
      run('s.Close("a",3)'),
      eq('s.Winner("a")', ["bob", true]),
      eq('s.Highest("a")', [2, true]),
      eq('s.Bid("a1","a","ana",1,0)', true),
      eq('s.Bid("b1","b","cat",1,4)', true),
    ],
  ],
};
