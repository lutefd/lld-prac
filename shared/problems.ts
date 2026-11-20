import { commerceProblems } from "./commerce.ts";
import { collaborationProblems } from "./collaboration.ts";
import { infrastructureProblems } from "./infrastructure.ts";
import { parkingProblems } from "./parking.ts";
import { reservationProblems } from "./reservations.ts";
import { fundamentalProblems } from "./fundamentals.ts";
import { basicProblems } from "./basics.ts";
import { easyCollectionProblems } from "./easy-collections.ts";
import { easySystemProblems } from "./easy-systems.ts";
export type PracticeFile = {
  path: string;
  content: string;
  readOnly: boolean;
  hidden?: boolean;
};
export type PracticeLevel = {
  title: string;
  description: string;
  requirements: string[];
  examples: { input: string; output: string }[];
};
export type PracticeProblem = {
  id: string;
  title: string;
  category:
    | "Ride-hailing"
    | "Banking"
    | "Fundamentals"
    | "Commerce"
    | "Collaboration"
    | "Infrastructure";
  difficulty: "Easy" | "Medium" | "Hard";
  duration: number;
  summary: string;
  tags: string[];
  packageName: string;
  levels: PracticeLevel[];
  files: PracticeFile[];
};
// Original practice prompts inspired by common LLD domains, not company questions.
const level = (
  title: string,
  description: string,
  requirements: string[],
  input: string,
  output: string,
): PracticeLevel => ({
  title,
  description,
  requirements,
  examples: [{ input, output }],
});

const exercise = (
  id: string,
  title: string,
  category: PracticeProblem["category"],
  difficulty: PracticeProblem["difficulty"],
  summary: string,
  tags: string[],
  levels: PracticeLevel[],
  starter: string,
  tests: string[],
): PracticeProblem => ({
  id,
  title,
  category,
  difficulty,
  duration: 60,
  summary,
  tags,
  packageName: "practice",
  levels,
  files: [
    {
      path: "implementation.go",
      content: `package practice\n\n${starter}\n`,
      readOnly: false,
    },
    { path: "go.mod", content: "module practice\n\ngo 1.22\n", readOnly: true },
    ...tests.map((test, i) => ({
      path: `level_${i + 1}_test.go`,
      readOnly: true,
      content: `package practice\n\nimport "testing"\n\nfunc TestLevel${i + 1}_${id.replaceAll("-", "_")}(t *testing.T) {\n${test}\n}\n`,
    })),
  ],
});

export const problems: PracticeProblem[] = [
  exercise(
    "ride-dispatch",
    "Ride dispatch",
    "Ride-hailing",
    "Medium",
    "Match riders with nearby available drivers, then extend dispatch with trip reservations.",
    ["Matching", "State", "Deterministic ordering"],
    [
      level(
        "Register the fleet",
        "Keep a registry of drivers on a one-dimensional city grid.",
        [
          "NewDispatcher() *Dispatcher creates an empty registry.",
          "Register(id string, position int) bool adds a nonempty unique driver ID. Return false for empty or duplicate IDs; duplicates must not overwrite the original position.",
          "Count() int returns the number of registered drivers. Positions may be negative.",
        ],
        'Register("ana", 8); Register("ana", 2); Count()',
        "true; false; 1",
      ),
      level(
        "Find the nearest driver",
        "Find a driver without changing availability.",
        [
          "Nearest(position int) (string, bool) selects the driver with minimum absolute distance.",
          'Break equal-distance ties by lexicographically smallest ID. Return ("", false) when there are no available drivers.',
        ],
        'Register("b", 4); Register("a", 8); Nearest(6)',
        '("a", true)',
      ),
      level(
        "Reserve and release",
        "A match reserves the selected driver until release.",
        [
          "Assign(position int) (string, bool) uses the Nearest ordering and makes that driver unavailable.",
          "Release(id string) bool makes an assigned driver available again. Unknown or already available IDs return false.",
          "Reservations do not remove drivers from Count(). Nearest must skip reserved drivers.",
        ],
        'Register("a", 0); Assign(1); Nearest(1); Release("a")',
        '("a", true); ("", false); true',
      ),
    ],
    `type Dispatcher struct {\n\t// Design the driver registry and availability state.\n}\n\nfunc NewDispatcher() *Dispatcher { return &Dispatcher{} }\nfunc (d *Dispatcher) Register(id string, position int) bool { return false }\nfunc (d *Dispatcher) Count() int { return 0 }\nfunc (d *Dispatcher) Nearest(position int) (string, bool) { return "", false }\nfunc (d *Dispatcher) Assign(position int) (string, bool) { return "", false }\nfunc (d *Dispatcher) Release(id string) bool { return false }`,
    [
      `d := NewDispatcher()\nif !d.Register("ana", 8) || d.Register("ana", 2) || d.Register("", 0) || d.Count() != 1 { t.Fatal("registration must reject duplicates and empty IDs") }`,
      `d := NewDispatcher()\nif _, ok := d.Nearest(0); ok { t.Fatal("empty fleet must have no match") }\nd.Register("b", 4); d.Register("a", 8)\nif id, ok := d.Nearest(6); !ok || id != "a" { t.Fatalf("tie must select a, got %q", id) }\nif id, _ := d.Nearest(3); id != "b" { t.Fatal("must choose nearest driver") }`,
      `d := NewDispatcher(); d.Register("a", 0)\nif id, ok := d.Assign(1); !ok || id != "a" { t.Fatal("assignment failed") }\nif _, ok := d.Nearest(1); ok { t.Fatal("reserved driver matched again") }\nif d.Release("missing") || !d.Release("a") || d.Release("a") { t.Fatal("invalid release behavior") }\nif id, _ := d.Nearest(1); id != "a" || d.Count() != 1 { t.Fatal("release must restore driver") }`,
    ],
  ),
  exercise(
    "fare-calculator",
    "Fare calculator",
    "Ride-hailing",
    "Easy",
    "Build a deterministic fare engine with surge pricing and bounded discount codes.",
    ["Integer money", "Pricing", "Validation"],
    [
      level(
        "Calculate a quote",
        "Represent all money in integer cents.",
        [
          "NewFareEngine(base, perKM, perMinute int) *FareEngine stores nonnegative rates.",
          "Quote(km, minutes int) (int, bool) returns base + perKM*km + perMinute*minutes.",
          "Negative distance or duration returns (0, false). Inputs and products fit in int.",
        ],
        "NewFareEngine(300, 120, 20).Quote(5, 10)",
        "(1100, true)",
      ),
      level(
        "Apply surge",
        "Support a configurable multiplier in basis points.",
        [
          "SetSurge(basisPoints int) bool accepts 10000 through 30000 inclusive. Invalid calls preserve the previous multiplier.",
          "The initial multiplier is 10000 (1×). Quote multiplies the base fare by surge and rounds down after dividing by 10000.",
        ],
        "SetSurge(15000); Quote(5, 10)",
        "true; (1650, true)",
      ),
      level(
        "Add promotions",
        "Apply one fixed discount after surge.",
        [
          "AddPromo(code string, cents int) bool accepts a nonempty unique code and positive cents.",
          "QuoteWithPromo(km, minutes int, code string) (int, bool) applies a known promo to the surged quote, clamped to zero.",
          "An unknown promo or invalid ride returns (0, false). Codes are reusable and case sensitive.",
        ],
        'AddPromo("FIRST", 500); QuoteWithPromo(0, 0, "FIRST")',
        "true; (0, true)",
      ),
    ],
    `type FareEngine struct {}\nfunc NewFareEngine(base, perKM, perMinute int) *FareEngine { return &FareEngine{} }\nfunc (f *FareEngine) Quote(km, minutes int) (int, bool) { return 0, false }\nfunc (f *FareEngine) SetSurge(basisPoints int) bool { return false }\nfunc (f *FareEngine) AddPromo(code string, cents int) bool { return false }\nfunc (f *FareEngine) QuoteWithPromo(km, minutes int, code string) (int, bool) { return 0, false }`,
    [
      `f := NewFareEngine(300, 120, 20)\nif n, ok := f.Quote(5, 10); !ok || n != 1100 { t.Fatalf("want 1100, got %d, %v", n, ok) }\nif _, ok := f.Quote(-1, 0); ok { t.Fatal("negative distance accepted") }\nif n, ok := f.Quote(0, 0); !ok || n != 300 { t.Fatal("base fare missing") }`,
      `f := NewFareEngine(101, 0, 0)\nif !f.SetSurge(15000) { t.Fatal("valid surge rejected") }\nif n, _ := f.Quote(0, 0); n != 151 { t.Fatal("surge must round down") }\nif f.SetSurge(9999) || f.SetSurge(30001) { t.Fatal("invalid surge accepted") }\nif n, _ := f.Quote(0, 0); n != 151 { t.Fatal("invalid update changed multiplier") }`,
      `f := NewFareEngine(300, 100, 0); f.SetSurge(20000)\nif !f.AddPromo("FIRST", 500) || f.AddPromo("FIRST", 100) || f.AddPromo("", 1) || f.AddPromo("BAD", 0) { t.Fatal("promo validation failed") }\nif n, ok := f.QuoteWithPromo(2, 0, "FIRST"); !ok || n != 500 { t.Fatal("discount must apply after surge") }\nf.AddPromo("FREE", 9999)\nif n, ok := f.QuoteWithPromo(0, 0, "FREE"); !ok || n != 0 { t.Fatal("fare must clamp to zero") }\nif _, ok := f.QuoteWithPromo(0, 0, "unknown"); ok { t.Fatal("unknown code accepted") }`,
    ],
  ),
  exercise(
    "trip-lifecycle",
    "Trip lifecycle",
    "Ride-hailing",
    "Medium",
    "Model a ride as a state machine with explicit transitions and an immutable event history.",
    ["State machine", "Encapsulation", "Audit history"],
    [
      level(
        "Request and assign",
        "Track trip IDs and their current states.",
        [
          'NewTripService() *TripService starts empty. Request(id string) bool creates a nonempty unique trip in "requested" state.',
          'State(id string) (string, bool) returns the state or ("", false) for unknown IDs.',
          "Assign(id string) bool transitions only requested → assigned. Failed calls leave state unchanged.",
        ],
        'Request("t1"); Assign("t1"); State("t1")',
        'true; true; ("assigned", true)',
      ),
      level(
        "Start and complete",
        "Enforce the order of a successful trip.",
        [
          "Start(id string) bool transitions only assigned → in_progress.",
          "Complete(id string) bool transitions only in_progress → completed.",
          "Repeated transitions and operations on missing trips return false. Completed trips are terminal.",
        ],
        'Start("t1"); Complete("t1"); Complete("t1")',
        "true; true; false",
      ),
      level(
        "Cancel with history",
        "Track every successful state change, including creation.",
        [
          "Cancel(id string) bool transitions requested or assigned → cancelled. In-progress, completed and cancelled trips cannot be cancelled.",
          "History(id string) []string returns states in order. Unknown IDs return an empty slice.",
          "Return a defensive copy: callers must not be able to mutate service history. Failed operations never append history.",
        ],
        'Request("t2"); Assign("t2"); Cancel("t2"); History("t2")',
        '["requested", "assigned", "cancelled"]',
      ),
    ],
    `type TripService struct {}\nfunc NewTripService() *TripService { return &TripService{} }\nfunc (s *TripService) Request(id string) bool { return false }\nfunc (s *TripService) State(id string) (string, bool) { return "", false }\nfunc (s *TripService) Assign(id string) bool { return false }\nfunc (s *TripService) Start(id string) bool { return false }\nfunc (s *TripService) Complete(id string) bool { return false }\nfunc (s *TripService) Cancel(id string) bool { return false }\nfunc (s *TripService) History(id string) []string { return nil }`,
    [
      `s := NewTripService()\nif !s.Request("t1") || s.Request("t1") || s.Request("") { t.Fatal("request validation failed") }\nif !s.Assign("t1") || s.Assign("t1") { t.Fatal("assignment transition failed") }\nif state, ok := s.State("t1"); !ok || state != "assigned" { t.Fatal("wrong trip state") }\nif _, ok := s.State("missing"); ok { t.Fatal("missing trip found") }`,
      `s := NewTripService(); s.Request("t1")\nif s.Start("t1") || s.Complete("t1") { t.Fatal("cannot skip assignment") }\ns.Assign("t1")\nif !s.Start("t1") || s.Start("t1") || !s.Complete("t1") || s.Complete("t1") { t.Fatal("trip lifecycle invalid") }\nif state, _ := s.State("t1"); state != "completed" { t.Fatal("completion not persisted") }`,
      `s := NewTripService(); s.Request("t1"); s.Assign("t1")\nif !s.Cancel("t1") || s.Cancel("t1") || s.Start("t1") { t.Fatal("cancelled trip must be terminal") }\nh := s.History("t1")\nif len(h) != 3 || h[0] != "requested" || h[1] != "assigned" || h[2] != "cancelled" { t.Fatal("wrong event history") }\nh[0] = "corrupt"\nif s.History("t1")[0] != "requested" { t.Fatal("history leaked mutable state") }\ns.Request("t2"); s.Assign("t2"); s.Start("t2")\nif s.Cancel("t2") || len(s.History("missing")) != 0 { t.Fatal("invalid cancellation/history") }`,
    ],
  ),
  exercise(
    "driver-availability",
    "Driver availability",
    "Ride-hailing",
    "Medium",
    "Maintain driver status and answer deterministic fleet queries by city.",
    ["Registry", "Filtering", "Sorting"],
    [
      level(
        "Bring drivers online",
        "Track each driver and their city.",
        [
          "NewFleet() *Fleet creates an empty fleet. Online(id, city string) bool adds a nonempty unique driver in a nonempty city.",
          'City(id string) (string, bool) returns the registered city, including busy drivers. Unknown IDs return ("", false).',
          "Online does not move an existing driver; duplicates return false.",
        ],
        'Online("d1", "Recife"); City("d1")',
        'true; ("Recife", true)',
      ),
      level(
        "Query availability",
        "Track whether drivers can receive a trip.",
        [
          "SetBusy(id string, busy bool) bool updates a known driver and returns true; unknown drivers return false.",
          "Available(city string) []string returns only nonbusy driver IDs in that city, sorted lexicographically.",
          "New drivers are available. Missing cities return an empty slice.",
        ],
        'Online("b", "SP"); Online("a", "SP"); SetBusy("b", true); Available("SP")',
        '["a"]',
      ),
      level(
        "Move and remove drivers",
        "Change fleet membership while preserving busy state.",
        [
          "Move(id, city string) bool moves a known driver to a nonempty city; preserve their busy status.",
          "Offline(id string) bool removes a known driver. Removed IDs may be registered again and start available.",
          "All invalid operations return false and leave the fleet unchanged.",
        ],
        'Move("a", "Rio"); Offline("a"); City("a")',
        'true; true; ("", false)',
      ),
    ],
    `type Fleet struct {}\nfunc NewFleet() *Fleet { return &Fleet{} }\nfunc (f *Fleet) Online(id, city string) bool { return false }\nfunc (f *Fleet) City(id string) (string, bool) { return "", false }\nfunc (f *Fleet) SetBusy(id string, busy bool) bool { return false }\nfunc (f *Fleet) Available(city string) []string { return nil }\nfunc (f *Fleet) Move(id, city string) bool { return false }\nfunc (f *Fleet) Offline(id string) bool { return false }`,
    [
      `f := NewFleet()\nif !f.Online("d1", "Recife") || f.Online("d1", "Rio") || f.Online("", "Rio") || f.Online("d2", "") { t.Fatal("invalid registration behavior") }\nif city, ok := f.City("d1"); !ok || city != "Recife" { t.Fatal("city overwritten") }`,
      `f := NewFleet(); f.Online("b", "SP"); f.Online("a", "SP"); f.Online("c", "Rio")\na := f.Available("SP")\nif len(a) != 2 || a[0] != "a" || a[1] != "b" { t.Fatal("availability must be filtered and sorted") }\nif !f.SetBusy("b", true) || f.SetBusy("missing", true) { t.Fatal("busy update failed") }\na = f.Available("SP")\nif len(a) != 1 || a[0] != "a" || len(f.Available("missing")) != 0 { t.Fatal("busy driver returned") }`,
      `f := NewFleet(); f.Online("d", "SP"); f.SetBusy("d", true)\nif !f.Move("d", "Rio") || f.Move("d", "") || f.Move("missing", "Rio") { t.Fatal("move validation failed") }\nif len(f.Available("Rio")) != 0 { t.Fatal("move reset busy status") }\nif !f.Offline("d") || f.Offline("d") { t.Fatal("offline behavior invalid") }\nif _, ok := f.City("d"); ok { t.Fatal("removed driver still present") }\nf.Online("d", "Rio")\nif len(f.Available("Rio")) != 1 { t.Fatal("rejoined driver should be available") }`,
    ],
  ),
  exercise(
    "wallet-ledger",
    "Wallet ledger",
    "Banking",
    "Medium",
    "Implement a wallet with atomic withdrawals and idempotent balance updates.",
    ["Ledger", "Idempotency", "Integer money"],
    [
      level(
        "Create and fund wallets",
        "All balances and amounts are integer cents; no overdraft is allowed.",
        [
          "NewLedger() *Ledger starts empty. Create(id string) bool accepts nonempty unique IDs with zero balance.",
          "Deposit(id string, cents int) bool requires an existing wallet and a positive amount.",
          "Balance(id string) (int, bool) returns the current balance or (0, false) for unknown IDs. Values fit in int.",
        ],
        'Create("ana"); Deposit("ana", 500); Balance("ana")',
        "true; true; (500, true)",
      ),
      level(
        "Withdraw atomically",
        "Reject debits that cannot be fully applied.",
        [
          "Withdraw(id string, cents int) bool requires an existing wallet, positive amount, and sufficient funds.",
          "Failed withdrawals must not change any balance. Withdrawing the exact balance is valid.",
        ],
        'Deposit("ana", 500); Withdraw("ana", 600); Balance("ana")',
        "true; false; (500, true)",
      ),
      level(
        "Idempotent operations",
        "Prevent duplicate effects when clients retry.",
        [
          "Apply(operationID, walletID string, delta int) bool accepts a nonempty new operation ID and a nonzero signed delta.",
          "A successful operation changes the balance if it remains nonnegative. Repeating the exact operation returns true without applying it twice.",
          "Reusing an operation ID with different wallet or delta returns false. Failed operations do not reserve their IDs.",
        ],
        'Apply("op1", "ana", 100); Apply("op1", "ana", 100)',
        "true; true (only 100 cents credited)",
      ),
    ],
    `type Ledger struct {}\nfunc NewLedger() *Ledger { return &Ledger{} }\nfunc (l *Ledger) Create(id string) bool { return false }\nfunc (l *Ledger) Deposit(id string, cents int) bool { return false }\nfunc (l *Ledger) Balance(id string) (int, bool) { return 0, false }\nfunc (l *Ledger) Withdraw(id string, cents int) bool { return false }\nfunc (l *Ledger) Apply(operationID, walletID string, delta int) bool { return false }`,
    [
      `l := NewLedger()\nif !l.Create("ana") || l.Create("ana") || l.Create("") { t.Fatal("wallet validation failed") }\nif !l.Deposit("ana", 500) || l.Deposit("ana", 0) || l.Deposit("missing", 10) { t.Fatal("deposit validation failed") }\nif n, ok := l.Balance("ana"); !ok || n != 500 { t.Fatal("wrong balance") }`,
      `l := NewLedger(); l.Create("ana"); l.Deposit("ana", 500)\nif l.Withdraw("ana", 600) || l.Withdraw("ana", -1) || l.Withdraw("missing", 1) { t.Fatal("invalid withdrawal accepted") }\nif n, _ := l.Balance("ana"); n != 500 { t.Fatal("failed debit changed balance") }\nif !l.Withdraw("ana", 500) { t.Fatal("exact balance withdrawal rejected") }\nif n, _ := l.Balance("ana"); n != 0 { t.Fatal("withdrawal not applied") }`,
      `l := NewLedger(); l.Create("ana"); l.Create("bob")\nif !l.Apply("op1", "ana", 100) || !l.Apply("op1", "ana", 100) { t.Fatal("retry rejected") }\nif l.Apply("op1", "bob", 100) || l.Apply("op1", "ana", 200) { t.Fatal("conflicting retry accepted") }\nif n, _ := l.Balance("ana"); n != 100 { t.Fatal("operation applied twice") }\nif l.Apply("retry", "ana", -200) { t.Fatal("overdraft accepted") }\nif !l.Apply("retry", "ana", 50) { t.Fatal("failed operation reserved its ID") }\nif l.Apply("", "ana", 1) || l.Apply("zero", "ana", 0) { t.Fatal("invalid operation accepted") }`,
    ],
  ),
  exercise(
    "account-transfers",
    "Account transfers",
    "Banking",
    "Hard",
    "Build a transfer service with atomic movements, retry protection, and reversible transfers.",
    ["Transactions", "Atomicity", "Reversals"],
    [
      level(
        "Open accounts",
        "Keep accounts with nonnegative starting balances in cents.",
        [
          "NewBank() *Bank creates an empty bank. Open(id string, cents int) bool requires a nonempty unique ID and cents >= 0.",
          "Balance(id string) (int, bool) returns the account balance, or (0, false) for missing accounts.",
        ],
        'Open("a", 1000); Balance("a")',
        "true; (1000, true)",
      ),
      level(
        "Transfer money",
        "Move money as a single operation.",
        [
          "Transfer(id, from, to string, cents int) bool requires a nonempty unique transfer ID, distinct existing accounts, positive cents, and sufficient funds.",
          "Debit and credit both succeed or neither changes. Repeating an identical successful transfer returns true without moving funds again.",
          "A conflicting reuse of a transfer ID returns false. Failed transfers do not reserve IDs. Arithmetic fits in int.",
        ],
        'Open("a", 1000); Open("b", 0); Transfer("x", "a", "b", 300)',
        "true; balances: a=700, b=300",
      ),
      level(
        "Reverse a transfer",
        "Undo a completed transfer exactly once.",
        [
          "Reverse(id string) bool moves the original amount from the recipient back to the sender if the recipient still has enough funds.",
          "Unknown IDs, repeated reversals, and insufficient recipient funds return false without changes.",
          "An identical Transfer retry after reversal returns true and must not move funds again.",
        ],
        'Reverse("x"); Reverse("x")',
        "true; false; balances: a=1000, b=0",
      ),
    ],
    `type Bank struct {}\nfunc NewBank() *Bank { return &Bank{} }\nfunc (b *Bank) Open(id string, cents int) bool { return false }\nfunc (b *Bank) Balance(id string) (int, bool) { return 0, false }\nfunc (b *Bank) Transfer(id, from, to string, cents int) bool { return false }\nfunc (b *Bank) Reverse(id string) bool { return false }`,
    [
      `b := NewBank()\nif !b.Open("a", 1000) || b.Open("a", 2) || b.Open("", 1) || b.Open("b", -1) { t.Fatal("account validation failed") }\nif n, ok := b.Balance("a"); !ok || n != 1000 { t.Fatal("wrong opening balance") }\nif _, ok := b.Balance("missing"); ok { t.Fatal("missing account found") }`,
      `b := NewBank(); b.Open("a", 1000); b.Open("b", 0)\nif b.Transfer("x", "a", "b", 1001) { t.Fatal("overdraft accepted") }\nif !b.Transfer("x", "a", "b", 300) || !b.Transfer("x", "a", "b", 300) { t.Fatal("transfer/retry failed") }\nif b.Transfer("x", "a", "b", 200) || b.Transfer("self", "a", "a", 1) || b.Transfer("", "a", "b", 1) { t.Fatal("invalid transfer accepted") }\nif n, _ := b.Balance("a"); n != 700 { t.Fatal("sender balance wrong") }\nif n, _ := b.Balance("b"); n != 300 { t.Fatal("recipient balance wrong") }`,
      `b := NewBank(); b.Open("a", 1000); b.Open("b", 0); b.Open("c", 0)\nb.Transfer("x", "a", "b", 300); b.Transfer("y", "b", "c", 200)\nif b.Reverse("x") { t.Fatal("cannot reverse without recipient funds") }\nif !b.Reverse("y") || !b.Reverse("x") || b.Reverse("x") || b.Reverse("missing") { t.Fatal("reverse behavior invalid") }\nif !b.Transfer("x", "a", "b", 300) { t.Fatal("identical retry should remain accepted") }\nif n, _ := b.Balance("a"); n != 1000 { t.Fatal("reversal/retry changed wrong balance") }`,
    ],
  ),
  exercise(
    "card-limits",
    "Card authorization",
    "Banking",
    "Medium",
    "Authorize card purchases against a credit limit, settle holds, and refund payments.",
    ["Credit limits", "Holds", "State machine"],
    [
      level(
        "Reserve credit",
        "One card account exposes available credit in cents.",
        [
          "NewCard(limit int) *Card receives a nonnegative limit. Available() int initially returns limit.",
          "Authorize(id string, cents int) bool reserves credit for a nonempty unique ID and positive cents no greater than available credit.",
          "Duplicate or rejected authorizations leave available credit unchanged.",
        ],
        'NewCard(1000); Authorize("p1", 300); Available()',
        "true; 700",
      ),
      level(
        "Capture or void",
        "Track pending and captured purchase states.",
        [
          "Capture(id string) bool changes only a pending authorization to captured. It does not change available credit.",
          "Void(id string) bool cancels only a pending authorization and restores its credit.",
          "Unknown, repeated, or illegal state transitions return false. IDs remain reserved after void.",
        ],
        'Authorize("p1", 300); Void("p1"); Available()',
        "true; true; 1000",
      ),
      level(
        "Refund captured purchases",
        "Support partial refunds without exceeding the captured amount.",
        [
          "Refund(id string, cents int) bool requires a captured purchase and positive cents no greater than its remaining unrefunded amount.",
          "Successful refunds immediately restore available credit. Multiple partial refunds are allowed.",
          "Pending, voided, missing, or fully refunded purchases cannot receive additional refunds.",
        ],
        'Authorize("p1", 300); Capture("p1"); Refund("p1", 100); Available()',
        "true; true; true; 800",
      ),
    ],
    `type Card struct {}\nfunc NewCard(limit int) *Card { return &Card{} }\nfunc (c *Card) Available() int { return 0 }\nfunc (c *Card) Authorize(id string, cents int) bool { return false }\nfunc (c *Card) Capture(id string) bool { return false }\nfunc (c *Card) Void(id string) bool { return false }\nfunc (c *Card) Refund(id string, cents int) bool { return false }`,
    [
      `c := NewCard(1000)\nif c.Available() != 1000 || !c.Authorize("p1", 300) { t.Fatal("credit setup failed") }\nif c.Authorize("p1", 100) || c.Authorize("p2", 701) || c.Authorize("", 1) || c.Authorize("zero", 0) { t.Fatal("invalid hold accepted") }\nif c.Available() != 700 { t.Fatal("wrong available credit") }`,
      `c := NewCard(1000); c.Authorize("a", 300); c.Authorize("b", 200)\nif !c.Capture("a") || c.Capture("a") || c.Void("a") { t.Fatal("capture transition invalid") }\nif !c.Void("b") || c.Void("b") || c.Capture("b") || c.Authorize("b", 1) { t.Fatal("void transition invalid") }\nif c.Available() != 700 { t.Fatal("void must restore only its hold") }`,
      `c := NewCard(1000); c.Authorize("a", 300)\nif c.Refund("a", 1) { t.Fatal("pending purchase refunded") }\nc.Capture("a")\nif !c.Refund("a", 100) || c.Refund("a", 201) || c.Refund("a", 0) { t.Fatal("partial refund invalid") }\nif c.Available() != 800 { t.Fatal("refund credit incorrect") }\nif !c.Refund("a", 200) || c.Refund("a", 1) || c.Available() != 1000 { t.Fatal("refund exceeds captured amount") }`,
    ],
  ),
  exercise(
    "transaction-history",
    "Transaction history",
    "Banking",
    "Medium",
    "Index an account statement with stable ordering, category filters, and cursor pagination.",
    ["Indexing", "Pagination", "Ordering"],
    [
      level(
        "Append statement entries",
        "Store immutable transactions using caller-supplied logical time.",
        [
          "Entry has fields ID string, Timestamp int64, Cents int, Category string.",
          "NewStatement() *Statement creates an empty store. Add(entry Entry) bool accepts a nonempty unique ID and nonzero Cents.",
          "Get(id string) (Entry, bool) retrieves an entry. Unknown IDs return (Entry{}, false). Timestamps and categories are unrestricted.",
        ],
        'Add(Entry{ID:"a", Timestamp:10, Cents:-500, Category:"food"}); Get("a")',
        "true; the stored entry",
      ),
      level(
        "Filter and order",
        "Return newest entries first with deterministic ties.",
        [
          "List(category string) []Entry filters by exact category; an empty category means all entries.",
          "Sort by Timestamp descending, then ID ascending. Return a defensive copy.",
        ],
        'List("food")',
        "matching entries ordered newest first",
      ),
      level(
        "Paginate by cursor",
        "Use stable transaction IDs as cursors into the all-entry ordering.",
        [
          'Page(afterID string, limit int) []Entry returns entries strictly after the cursor in List("") order.',
          "An empty cursor starts at the beginning. Unknown cursors or limit <= 0 return an empty slice.",
          "Return at most limit entries, without changing statement data. At the end, return an empty slice.",
        ],
        'Page("", 2); Page(lastReturnedID, 2)',
        "first two entries; next two entries",
      ),
    ],
    `type Entry struct {\n\tID string\n\tTimestamp int64\n\tCents int\n\tCategory string\n}\ntype Statement struct {}\nfunc NewStatement() *Statement { return &Statement{} }\nfunc (s *Statement) Add(entry Entry) bool { return false }\nfunc (s *Statement) Get(id string) (Entry, bool) { return Entry{}, false }\nfunc (s *Statement) List(category string) []Entry { return nil }\nfunc (s *Statement) Page(afterID string, limit int) []Entry { return nil }`,
    [
      `s := NewStatement(); e := Entry{ID:"a", Timestamp:10, Cents:-500, Category:"food"}\nif !s.Add(e) || s.Add(e) || s.Add(Entry{Cents:1}) || s.Add(Entry{ID:"zero"}) { t.Fatal("entry validation failed") }\nif got, ok := s.Get("a"); !ok || got != e { t.Fatal("stored entry changed") }\nif _, ok := s.Get("missing"); ok { t.Fatal("missing entry found") }`,
      `s := NewStatement(); s.Add(Entry{ID:"b",Timestamp:2,Cents:1,Category:"food"}); s.Add(Entry{ID:"a",Timestamp:2,Cents:1,Category:"food"}); s.Add(Entry{ID:"c",Timestamp:3,Cents:1,Category:"travel"})\na := s.List("")\nif len(a) != 3 || a[0].ID != "c" || a[1].ID != "a" || a[2].ID != "b" { t.Fatal("incorrect ordering") }\na[0].ID = "corrupt"\nif s.List("")[0].ID != "c" || len(s.List("food")) != 2 || len(s.List("missing")) != 0 { t.Fatal("filter/copy invalid") }`,
      `s := NewStatement(); for i, id := range []string{"a","b","c"} { s.Add(Entry{ID:id,Timestamp:int64(3-i),Cents:1}) }\np := s.Page("", 2)\nif len(p) != 2 || p[0].ID != "a" || p[1].ID != "b" { t.Fatal("first page invalid") }\np = s.Page("b", 2)\nif len(p) != 1 || p[0].ID != "c" { t.Fatal("cursor page invalid") }\nif len(s.Page("c", 2)) != 0 || len(s.Page("missing", 2)) != 0 || len(s.Page("", 0)) != 0 { t.Fatal("boundary page invalid") }`,
    ],
  ),
  exercise(
    "in-memory-filesystem",
    "In-memory filesystem",
    "Fundamentals",
    "Medium",
    "Build a small path-based file store with atomic moves and prefix queries.",
    ["Maps", "Paths", "Atomicity"],
    [
      level(
        "Write and read files",
        "Store file contents by canonical absolute path; directories are implicit.",
        [
          "NewFileSystem() *FileSystem creates an empty store. Write(path, content string) bool creates or overwrites a valid file.",
          "A valid path starts with /, is not /, has no trailing slash, empty segment, . segment, or .. segment.",
          'Read(path string) (string, bool) returns the exact content, including an empty string, or ("", false) if missing.',
        ],
        'Write("/docs/a.txt", "hello"); Read("/docs/a.txt")',
        'true; ("hello", true)',
      ),
      level(
        "List and delete",
        "Query files under a directory boundary.",
        [
          'List(prefix string) []string returns file paths equal to prefix or beginning with prefix + "/", sorted lexicographically.',
          'List("/") lists all files. Prefixes must be / or valid file paths; invalid prefixes return an empty slice.',
          "Delete(path string) bool removes exactly one existing file. It does not recursively delete children.",
        ],
        'Write("/a/x", "1"); Write("/ab/y", "2"); List("/a")',
        '["/a/x"]',
      ),
      level(
        "Move atomically",
        "Rename one file without overwriting another.",
        [
          "Move(source, target string) bool succeeds only when source exists, target is valid, and target does not exist.",
          "Source equal to target returns false. On failure, preserve both source and destination contents.",
          "Move does not move descendants or require parent directories to exist.",
        ],
        'Move("/a/x", "/archive/x"); Read("/a/x")',
        'true; ("", false)',
      ),
    ],
    `type FileSystem struct {}\nfunc NewFileSystem() *FileSystem { return &FileSystem{} }\nfunc (f *FileSystem) Write(path, content string) bool { return false }\nfunc (f *FileSystem) Read(path string) (string, bool) { return "", false }\nfunc (f *FileSystem) List(prefix string) []string { return nil }\nfunc (f *FileSystem) Delete(path string) bool { return false }\nfunc (f *FileSystem) Move(source, target string) bool { return false }`,
    [
      `f := NewFileSystem()\nif !f.Write("/docs/a.txt", "hello") { t.Fatal("valid write rejected") }\nfor _, p := range []string{"/", "relative", "/a/", "/a//b", "/a/../b", "/./a"} { if f.Write(p,"bad") { t.Fatalf("invalid path accepted: %s",p) } }\nif s, ok := f.Read("/docs/a.txt"); !ok || s != "hello" { t.Fatal("read failed") }\nf.Write("/docs/a.txt", "")\nif s, ok := f.Read("/docs/a.txt"); !ok || s != "" { t.Fatal("empty content lost") }`,
      `f := NewFileSystem(); f.Write("/a/z", "1"); f.Write("/a/x", "2"); f.Write("/ab/y", "3")\na := f.List("/a")\nif len(a) != 2 || a[0] != "/a/x" || a[1] != "/a/z" { t.Fatal("prefix boundary or ordering wrong") }\nif len(f.List("/")) != 3 || !f.Delete("/a/x") || f.Delete("/a/x") || f.Delete("/a") { t.Fatal("list/delete invalid") }`,
      `f := NewFileSystem(); f.Write("/a", "one"); f.Write("/b", "two")\nif f.Move("/a", "/b") || f.Move("/a", "/a") || f.Move("/a", "bad") { t.Fatal("invalid move accepted") }\nif s, _ := f.Read("/a"); s != "one" { t.Fatal("failed move changed source") }\nif !f.Move("/a", "/new/c") { t.Fatal("valid move rejected") }\nif _, ok := f.Read("/a"); ok { t.Fatal("source not removed") }\nif s, ok := f.Read("/new/c"); !ok || s != "one" { t.Fatal("destination incorrect") }`,
    ],
  ),
  exercise(
    "rate-limiter",
    "API rate limiter",
    "Fundamentals",
    "Hard",
    "Protect an API with deterministic per-client windows, overrides, and retry timing.",
    ["Time windows", "Isolation", "Boundary conditions"],
    [
      level(
        "Fixed windows",
        "Use explicit timestamps in seconds instead of the real clock.",
        [
          "NewLimiter(limit int, windowSeconds int64) *Limiter receives positive parameters.",
          "Allow(key string, now int64) bool permits at most limit requests per key in each fixed window [k*windowSeconds, (k+1)*windowSeconds).",
          "Keys must be nonempty and timestamps nonnegative. Invalid requests return false. Timestamps are nondecreasing globally.",
        ],
        'NewLimiter(2,10); Allow("a",0); Allow("a",9); Allow("a",9); Allow("a",10)',
        "true; true; false; true",
      ),
      level(
        "Per-client limits",
        "Override limits without resetting current-window usage.",
        [
          "SetLimit(key string, limit int) bool sets a positive limit for a nonempty key. Invalid calls return false and preserve the old limit.",
          "Overrides apply immediately, including to the current window. Other keys continue using the default limit.",
          "Denied requests do not consume additional quota.",
        ],
        'Allow("a",0); SetLimit("a",2); Allow("a",1)',
        "true; true; true (default limit was 1)",
      ),
      level(
        "Report remaining quota",
        "Expose quota without consuming it.",
        [
          "Remaining(key string, now int64) int returns max(0, effectiveLimit - used) in that timestamp’s window. Invalid key/time returns 0.",
          "RetryAfter(key string, now int64) int64 returns 0 when quota remains; otherwise seconds until the next window boundary.",
          "These query methods never consume quota. Use nondecreasing timestamps for queries too. Invalid key/time returns 0.",
        ],
        'NewLimiter(1,10); Allow("a",2); Remaining("a",4); RetryAfter("a",4)',
        "true; 0; 6",
      ),
    ],
    `type Limiter struct {}\nfunc NewLimiter(limit int, windowSeconds int64) *Limiter { return &Limiter{} }\nfunc (l *Limiter) Allow(key string, now int64) bool { return false }\nfunc (l *Limiter) SetLimit(key string, limit int) bool { return false }\nfunc (l *Limiter) Remaining(key string, now int64) int { return 0 }\nfunc (l *Limiter) RetryAfter(key string, now int64) int64 { return 0 }`,
    [
      `l := NewLimiter(2,10)\nif l.Allow("",0) || l.Allow("a",-1) { t.Fatal("invalid request accepted") }\nif !l.Allow("a",0) || !l.Allow("a",9) || l.Allow("a",9) || !l.Allow("b",9) || !l.Allow("a",10) { t.Fatal("window isolation/boundary incorrect") }`,
      `l := NewLimiter(1,10)\nif !l.Allow("a",0) || !l.SetLimit("a",2) || !l.Allow("a",1) || l.Allow("a",1) { t.Fatal("override reset usage or not applied") }\nif l.SetLimit("a",0) || l.SetLimit("",2) || l.Allow("a",2) { t.Fatal("invalid override changed limit") }\nif !l.Allow("b",2) || l.Allow("b",2) || !l.Allow("a",10) || !l.Allow("a",10) { t.Fatal("override leaked or failed to persist") }`,
      `l := NewLimiter(1,10)\nif l.Remaining("a",0) != 1 || l.RetryAfter("a",0) != 0 || !l.Allow("a",2) { t.Fatal("query consumed quota") }\nif l.Remaining("a",4) != 0 || l.RetryAfter("a",4) != 6 { t.Fatal("retry delay incorrect") }\nif l.Remaining("a",10) != 1 || l.RetryAfter("a",10) != 0 { t.Fatal("boundary query did not refresh window") }\nif l.Remaining("",10) != 0 || l.RetryAfter("",10) != 0 { t.Fatal("invalid key query incorrect") }`,
    ],
  ),
];

// These tests are materialized by the runner but omitted from the editor/API.
const hiddenTests: Record<string, string> = {
  "ride-dispatch": `func TestLevel2_HiddenNegativePositions(t *testing.T) {
 d := NewDispatcher(); d.Register("z", -9); d.Register("a", -1)
 if id, ok := d.Nearest(-8); !ok || id != "z" { t.Fatal("negative grid positions must work") }
}
func TestLevel3_HiddenExhaustFleet(t *testing.T) {
 d := NewDispatcher(); d.Register("a", 0); d.Register("b", 1)
 d.Assign(0); d.Assign(0)
 if _, ok := d.Assign(0); ok { t.Fatal("exhausted fleet assigned a driver") }
 if d.Count() != 2 { t.Fatal("assignment removed registered drivers") }
}`,
  "fare-calculator": `func TestLevel2_HiddenSurgeBoundaries(t *testing.T) {
 f := NewFareEngine(7, 0, 0)
 if !f.SetSurge(30000) { t.Fatal("upper boundary rejected") }
 if n, _ := f.Quote(0, 0); n != 21 { t.Fatal("upper surge computed incorrectly") }
 if !f.SetSurge(10000) { t.Fatal("lower boundary rejected") }
}
func TestLevel3_HiddenPromoValidation(t *testing.T) {
 f := NewFareEngine(100, 0, 0); f.AddPromo("A", 25)
 if _, ok := f.QuoteWithPromo(-1, 0, "A"); ok { t.Fatal("invalid ride with promo accepted") }
 if _, ok := f.QuoteWithPromo(0, 0, "a"); ok { t.Fatal("promo codes must be case sensitive") }
 if n, _ := f.QuoteWithPromo(0, 0, "A"); n != 75 { t.Fatal("first promo quote incorrect") }
 if n, _ := f.QuoteWithPromo(0, 0, "A"); n != 75 { t.Fatal("promo must be reusable") }
}`,
  "trip-lifecycle": `func TestLevel1_HiddenUnknownTrip(t *testing.T) {
 s := NewTripService()
 if s.Assign("missing") { t.Fatal("unknown trip assigned") }
 if _, ok := s.State("missing"); ok { t.Fatal("failed operation created trip") }
}
func TestLevel3_HiddenCompletionHistory(t *testing.T) {
 s := NewTripService(); s.Request("t"); s.Assign("t"); s.Start("t"); s.Complete("t")
 if s.Cancel("t") { t.Fatal("completed trip cancelled") }
 h := s.History("t")
 if len(h) != 4 || h[3] != "completed" { t.Fatal("successful path history incorrect") }
}`,
  "driver-availability": `func TestLevel2_HiddenRestoreAvailable(t *testing.T) {
 f := NewFleet(); f.Online("d", "SP"); f.SetBusy("d", true); f.SetBusy("d", false)
 if a := f.Available("SP"); len(a) != 1 || a[0] != "d" { t.Fatal("driver did not return to availability") }
}
func TestLevel3_HiddenMoveBoundary(t *testing.T) {
 f := NewFleet(); f.Online("d", "SP"); f.Move("d", "Rio")
 if len(f.Available("SP")) != 0 || len(f.Available("Rio")) != 1 { t.Fatal("driver appears in wrong city") }
}`,
  "wallet-ledger": `func TestLevel1_HiddenWalletIsolation(t *testing.T) {
 l := NewLedger(); l.Create("a"); l.Create("b"); l.Deposit("a", 10)
 if n, ok := l.Balance("b"); !ok || n != 0 { t.Fatal("wallet balances must be isolated") }
}
func TestLevel3_HiddenDebitRetry(t *testing.T) {
 l := NewLedger(); l.Create("a"); l.Deposit("a", 100)
 if !l.Apply("debit", "a", -100) || !l.Apply("debit", "a", -100) { t.Fatal("identical debit retry rejected") }
 if n, _ := l.Balance("a"); n != 0 { t.Fatal("debit retry applied twice") }
}`,
  "account-transfers": `func TestLevel2_HiddenMissingRecipient(t *testing.T) {
 b := NewBank(); b.Open("a", 100)
 if b.Transfer("x", "a", "missing", 50) { t.Fatal("missing recipient accepted") }
 if n, _ := b.Balance("a"); n != 100 { t.Fatal("failed transfer debited sender") }
 b.Open("b", 0)
 if !b.Transfer("x", "a", "b", 100) { t.Fatal("failed transfer reserved ID") }
}
func TestLevel3_HiddenReversalConservesMoney(t *testing.T) {
 b := NewBank(); b.Open("a", 100); b.Open("b", 20); b.Transfer("x", "a", "b", 100)
 if !b.Reverse("x") { t.Fatal("funded transfer reversal failed") }
 if n, _ := b.Balance("b"); n != 20 { t.Fatal("recipient original balance changed") }
}`,
  "card-limits": `func TestLevel1_HiddenRetryRejected(t *testing.T) {
 c := NewCard(100)
 if c.Authorize("p", 101) || !c.Authorize("p", 100) || c.Available() != 0 { t.Fatal("rejected hold reserved ID or incorrect boundary") }
}
func TestLevel3_HiddenRefundIsolation(t *testing.T) {
 c := NewCard(1000); c.Authorize("a", 100); c.Authorize("b", 200); c.Capture("a"); c.Capture("b")
 if !c.Refund("a", 100) || c.Refund("a", 1) || c.Available() != 800 { t.Fatal("refund affected another purchase") }
}`,
  "transaction-history": `func TestLevel2_HiddenCaseSensitiveCategory(t *testing.T) {
 s := NewStatement(); s.Add(Entry{ID:"a",Cents:1,Category:"Food"})
 if len(s.List("food")) != 0 || len(s.List("Food")) != 1 { t.Fatal("category filter must be exact") }
}
func TestLevel3_HiddenPageCopy(t *testing.T) {
 s := NewStatement(); s.Add(Entry{ID:"a",Cents:1})
 p := s.Page("", 100)
 if len(p) != 1 { t.Fatal("page length incorrect") }
 p[0].ID = "changed"
 if s.Page("", 1)[0].ID != "a" { t.Fatal("page exposed mutable statement storage") }
}`,
  "in-memory-filesystem": `func TestLevel2_HiddenExactPrefix(t *testing.T) {
 f := NewFileSystem(); f.Write("/a", "one"); f.Write("/a/b", "two")
 if len(f.List("/a")) != 2 { t.Fatal("prefix query must include exact file and descendants") }
 if !f.Delete("/a") { t.Fatal("file deletion failed") }
 if v, ok := f.Read("/a/b"); !ok || v != "two" { t.Fatal("delete recursively removed descendants") }
}
func TestLevel3_HiddenMoveDoesNotMoveChildren(t *testing.T) {
 f := NewFileSystem(); f.Write("/a", "one"); f.Write("/a/b", "two"); f.Move("/a", "/c")
 if _, ok := f.Read("/a/b"); !ok { t.Fatal("move incorrectly moved descendants") }
}`,
  "rate-limiter": `func TestLevel2_HiddenLowerLimit(t *testing.T) {
 l := NewLimiter(3, 10); l.Allow("a", 0); l.Allow("a", 0); l.SetLimit("a", 1)
 if l.Allow("a", 1) { t.Fatal("lowering limit reset consumption") }
 if !l.Allow("a", 10) || l.Allow("a", 10) { t.Fatal("lowered limit not preserved across windows") }
}
func TestLevel3_HiddenExactBoundaryRetry(t *testing.T) {
 l := NewLimiter(1, 10); l.Allow("a", 10)
 if l.RetryAfter("a", 10) != 10 { t.Fatal("new-window exhaustion retry must be full window") }
 l.SetLimit("a", 2)
 if l.RetryAfter("a", 10) != 0 || l.Remaining("a", 10) != 1 { t.Fatal("query ignored updated limit") }
}`,
};

for (const problem of problems) {
  problem.files.push({
    path: "sandbox_test.go",
    readOnly: false,
    content: `package practice\n\nimport "testing"\n\n// Add your own tests here. They run alongside the selected level tests.\nfunc TestUser_Smoke(t *testing.T) {\n\tt.Log("Add assertions for your own edge cases here.")\n}\n`,
  });
  const source = hiddenTests[problem.id];
  for (let n = 1; n <= 3; n++) {
    const functions = [...source.matchAll(/func TestLevel(\d)_[\s\S]*?\n}/g)]
      .filter((match) => Number(match[1]) === n)
      .map((match) => match[0]);
    if (functions.length)
      problem.files.push({
        path: `hidden_level_${n}_test.go`,
        readOnly: true,
        hidden: true,
        content: `package practice\n\nimport "testing"\n\n${functions.join("\n")}\n`,
      });
  }
}
problems.push(...parkingProblems);
problems.push(
  ...basicProblems,
  ...easyCollectionProblems,
  ...easySystemProblems,
  ...reservationProblems,
  ...fundamentalProblems,
  ...commerceProblems,
  ...collaborationProblems,
  ...infrastructureProblems,
);
