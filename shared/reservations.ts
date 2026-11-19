import type { PracticeProblem, PracticeLevel } from "./problems.ts";
import { caseFiles, type Command } from "./case-support.ts";

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
const setup = (name: string): Command => ({
  kind: "assign",
  name: "s",
  expression: `New${name}()`,
});
const eq = (expression: string, expected: unknown): Command => ({
  kind: "eq",
  expression,
  expected,
});
const yes = (expression: string) => eq(expression, true);
const no = (expression: string) => eq(expression, false);
const run = (expression: string): Command => ({ kind: "run", expression });

export const reservationProblems: PracticeProblem[] = [
  {
    id: "seat-booking",
    title: "Seat booking",
    category: "Ride-hailing",
    difficulty: "Hard",
    duration: 75,
    packageName: "practice",
    summary:
      "Book passenger groups on scheduled departures, move bookings atomically, and promote a strict FIFO waitlist.",
    tags: ["Group allocation", "Atomic updates", "FIFO waitlist"],
    levels: [
      level(
        "Book passenger groups",
        "Track independent seat inventories for scheduled departures.",
        [
          "NewSeatBooking() *SeatBooking creates an empty service. AddDeparture(id string, capacity int) bool accepts a nonempty unique ID and nonnegative capacity; rejected calls preserve existing data.",
          "SeatsLeft(departure string) (int, bool) returns remaining seats, or (0, false) for an unknown departure.",
          "Book(id, departure string, seats int) bool books an entire group only when the booking ID is nonempty and unused, the departure exists, seats is positive, and enough seats remain. Failed requests change nothing and do not consume an ID.",
          "IDs are case sensitive. Capacity, quantities, and their sums fit in int (safe integers in TypeScript). No seat numbers are assigned.",
        ],
        'AddDeparture("bus", 3); Book("group", "bus", 2); SeatsLeft("bus")',
        "true; true; (1, true)",
      ),
      level(
        "Cancel and move bookings",
        "Change a group reservation without splitting it or losing its original seats.",
        [
          "Cancel(id string) bool removes an active booking and returns its entire group to its departure. Unknown IDs return false. A cancelled booking ID may be reused.",
          "Move(id, departure string) bool moves an active booking, with its original group size, to an existing departure that has enough seats. Failures preserve both departures and the booking.",
          "Moving to the booking's current departure succeeds without changing seats, even when that departure is full. Moving never changes the booking ID or group size.",
        ],
        'AddDeparture("a", 2); AddDeparture("b", 1); Book("g", "a", 2); Move("g", "b"); Cancel("g"); SeatsLeft("a")',
        "true; true; true; false; true; (2, true)",
      ),
      level(
        "Promote a FIFO waitlist",
        "Queue whole groups and explicitly promote them when capacity permits.",
        [
          "Queue(id, departure string, seats int) bool appends a request with a nonempty unused booking ID, an existing departure, and positive seats no greater than that departure's total capacity. It succeeds even when seats are currently available. Queued requests consume no seats but reserve their IDs globally.",
          "Waiting(departure string) []string returns queued IDs in insertion order, or an empty list for an unknown departure. Return a defensive copy.",
          "Promote(departure string) []string repeatedly converts the head request into an active booking while the whole group fits. Stop at the first group that does not fit; never skip it. Return newly booked IDs in promotion order, or an empty list for an unknown departure.",
          "Cancel removes either an active booking or a queued request and releases its ID. Move accepts only active bookings. Book rejects queued IDs. Book, Cancel, and Move do not automatically promote requests; ordinary bookings may use free seats even with a queue.",
        ],
        'AddDeparture("bus", 3); Book("a", "bus", 2); Queue("b", "bus", 2); Queue("c", "bus", 1); Promote("bus"); Cancel("a"); Promote("bus")',
        'true; true; true; true; []; true; ["b", "c"]',
      ),
    ],
    files: caseFiles(
      `type SeatBooking struct {}\nfunc NewSeatBooking() *SeatBooking { return &SeatBooking{} }\nfunc (s *SeatBooking) AddDeparture(id string, capacity int) bool { return false }\nfunc (s *SeatBooking) SeatsLeft(departure string) (int, bool) { return 0, false }\nfunc (s *SeatBooking) Book(id, departure string, seats int) bool { return false }\nfunc (s *SeatBooking) Cancel(id string) bool { return false }\nfunc (s *SeatBooking) Move(id, departure string) bool { return false }\nfunc (s *SeatBooking) Queue(id, departure string, seats int) bool { return false }\nfunc (s *SeatBooking) Waiting(departure string) []string { return []string{} }\nfunc (s *SeatBooking) Promote(departure string) []string { return []string{} }`,
      [
        `s := NewSeatBooking()
if !s.AddDeparture("a", 3) || s.AddDeparture("a", 9) || s.AddDeparture("", 1) || s.AddDeparture("bad", -1) { t.Fatal("departure validation") }
if !s.Book("g", "a", 2) || s.Book("g", "a", 1) || s.Book("x", "a", 2) || s.Book("", "a", 1) || s.Book("zero", "a", 0) { t.Fatal("whole-group booking validation") }
if n, ok := s.SeatsLeft("a"); !ok || n != 1 { t.Fatal("remaining seats") }
if !s.Book("x", "a", 1) { t.Fatal("failed request consumed booking ID") }
if n, ok := s.SeatsLeft("missing"); ok || n != 0 { t.Fatal("unknown departure") }`,
        `s := NewSeatBooking(); s.AddDeparture("a", 2); s.AddDeparture("b", 1); s.AddDeparture("c", 2); s.Book("g", "a", 2)
if s.Move("g", "b") || s.Move("g", "missing") || s.Move("unknown", "c") || !s.Move("g", "a") { t.Fatal("move validation") }
if n, _ := s.SeatsLeft("a"); n != 0 { t.Fatal("failed move changed original") }
if !s.Move("g", "c") { t.Fatal("move rejected") }
if n, _ := s.SeatsLeft("a"); n != 2 { t.Fatal("move did not release seats") }
if !s.Cancel("g") || s.Cancel("g") || !s.Book("g", "b", 1) { t.Fatal("cancel and ID reuse") }
if n, _ := s.SeatsLeft("c"); n != 2 { t.Fatal("cancel affected wrong departure") }`,
        `s := NewSeatBooking(); s.AddDeparture("a", 3); s.Book("active", "a", 2)
if !s.Queue("first", "a", 2) || !s.Queue("second", "a", 1) || s.Queue("first", "a", 1) || s.Book("first", "a", 1) || s.Move("first", "a") { t.Fatal("queued ID semantics") }
if ids := s.Promote("a"); len(ids) != 0 { t.Fatal("must not skip blocked head") }
if !s.Cancel("active") { t.Fatal("active cancellation") }
if ids := s.Waiting("a"); len(ids) != 2 || ids[0] != "first" || ids[1] != "second" { t.Fatal("unexpected automatic promotion") }
if ids := s.Promote("a"); len(ids) != 2 || ids[0] != "first" || ids[1] != "second" { t.Fatal("promotion order") }
if len(s.Waiting("a")) != 0 || len(s.Promote("a")) != 0 || !s.Cancel("first") { t.Fatal("promoted booking state") }
if n, _ := s.SeatsLeft("a"); n != 2 { t.Fatal("promoted group lost its size") }`,
      ],
      [
        `s := NewSeatBooking(); s.AddDeparture("a", 1); s.AddDeparture("b", 0)
if s.Book("retry", "missing", 1) || s.Book("retry", "b", 1) || s.Book("retry", "a", -1) || !s.Book("retry", "a", 1) { t.Fatal("failed attempts must preserve ID") }
if n, ok := s.SeatsLeft("b"); !ok || n != 0 { t.Fatal("zero capacity is a real departure") }
if s.Book("retry", "b", 1) { t.Fatal("booking IDs are global") }`,
        `s := NewSeatBooking(); s.AddDeparture("a", 2); s.AddDeparture("b", 2); s.Book("g", "a", 2); s.Book("h", "b", 1)
if s.Move("g", "b") || !s.Cancel("h") || !s.Move("g", "b") { t.Fatal("failed move must be retryable") }
if n, _ := s.SeatsLeft("b"); n != 0 { t.Fatal("move must preserve group size") }
if s.Cancel("missing") || !s.Cancel("g") { t.Fatal("cancel validation") }
if n, _ := s.SeatsLeft("a"); n != 2 { t.Fatal("original departure restored twice") }`,
        `s := NewSeatBooking(); s.AddDeparture("a", 2); s.AddDeparture("b", 1)
if s.Queue("", "a", 1) || s.Queue("q", "missing", 1) || s.Queue("q", "a", 0) || s.Queue("q", "a", 3) || !s.Queue("q", "a", 2) || s.Queue("q", "b", 1) { t.Fatal("queue validation and global IDs") }
s.Queue("r", "a", 1); ids := s.Waiting("a"); if len(ids) != 2 { t.Fatal("queue length") }; ids[0] = "changed"
if s.Waiting("a")[0] != "q" { t.Fatal("waiting exposed internal storage") }
if !s.Cancel("q") || !s.Book("q", "b", 1) { t.Fatal("queued cancellation must release ID") }
if ids := s.Promote("a"); len(ids) != 1 || ids[0] != "r" { t.Fatal("cancelled head blocked promotion") }
if len(s.Waiting("missing")) != 0 || len(s.Promote("missing")) != 0 { t.Fatal("unknown departure queue") }`,
      ],
    ),
  },
  {
    id: "inventory-reservations",
    title: "Inventory reservations",
    category: "Fundamentals",
    difficulty: "Medium",
    duration: 60,
    packageName: "practice",
    summary:
      "Separate physical stock from held units, then complete orders with retry-safe commits and precise release rules.",
    tags: ["Inventory", "Reservations", "Idempotency"],
    levels: [
      level(
        "Manage physical stock",
        "Keep independent unit counts for product SKUs.",
        [
          "NewInventory() *Inventory creates an empty inventory. Add(sku string, units int) bool creates a nonempty unique SKU with nonnegative units. Invalid calls preserve state.",
          "Stock(sku string) (int, bool) returns physical units on hand, or (0, false) for an unknown SKU. Restock(sku string, units int) bool adds a positive quantity to an existing SKU; otherwise return false.",
          "SKUs and reservation IDs are case sensitive. All quantities and sums fit in int (safe integers in TypeScript). There are no implicit products or external clocks.",
        ],
        'Add("book", 2); Restock("book", 3); Stock("book")',
        "true; true; (5, true)",
      ),
      level(
        "Hold and release units",
        "Reserve stock without removing it from the warehouse.",
        [
          "Available(sku string) (int, bool) returns physical stock minus active holds, or (0, false) for an unknown SKU.",
          "Hold(id, sku string, units int) bool reserves a positive quantity when the ID is nonempty and unused, the SKU exists, and enough units are available. A rejected hold changes nothing and does not consume its ID. IDs are global across SKUs.",
          "Release(id string) bool cancels an active hold and restores availability without changing Stock. Repeated releases and unknown IDs return false. An ID from any successful Hold remains consumed permanently, even after release.",
        ],
        'Add("book", 5); Hold("order", "book", 3); Stock("book"); Available("book"); Release("order")',
        "true; true; (5, true); (2, true); true",
      ),
      level(
        "Commit orders safely",
        "Convert held units into shipped units while supporting retries.",
        [
          "Commit(id string) bool completes an active hold: reduce physical Stock by the held quantity and remove its active hold. Available stays unchanged by this conversion.",
          "Commit on an already committed ID returns true without further changes. Unknown or released IDs return false. Release rejects committed IDs. A completed or released ID can never be held again.",
          "Restock continues to add physical and available stock. A failed or repeated operation must never affect another reservation or SKU.",
        ],
        'Add("book", 5); Hold("order", "book", 3); Commit("order"); Commit("order"); Stock("book"); Available("book")',
        "true; true; true; true; (2, true); (2, true)",
      ),
    ],
    files: caseFiles(
      `type Inventory struct {}\nfunc NewInventory() *Inventory { return &Inventory{} }\nfunc (s *Inventory) Add(sku string, units int) bool { return false }\nfunc (s *Inventory) Stock(sku string) (int, bool) { return 0, false }\nfunc (s *Inventory) Restock(sku string, units int) bool { return false }\nfunc (s *Inventory) Available(sku string) (int, bool) { return 0, false }\nfunc (s *Inventory) Hold(id, sku string, units int) bool { return false }\nfunc (s *Inventory) Release(id string) bool { return false }\nfunc (s *Inventory) Commit(id string) bool { return false }`,
      [
        `s := NewInventory()
if !s.Add("book", 2) || s.Add("book", 99) || s.Add("", 1) || s.Add("bad", -1) || !s.Add("empty", 0) { t.Fatal("SKU validation") }
if !s.Restock("book", 3) || s.Restock("book", 0) || s.Restock("book", -1) || s.Restock("missing", 1) { t.Fatal("restock validation") }
if n, ok := s.Stock("book"); !ok || n != 5 { t.Fatal("stock total") }
if n, ok := s.Stock("missing"); ok || n != 0 { t.Fatal("missing SKU") }`,
        `s := NewInventory(); s.Add("book", 5)
if !s.Hold("a", "book", 3) || s.Hold("a", "book", 1) || s.Hold("b", "book", 3) || !s.Hold("b", "book", 2) { t.Fatal("hold validation and retry") }
if n, _ := s.Stock("book"); n != 5 { t.Fatal("hold removed physical stock") }
if n, _ := s.Available("book"); n != 0 { t.Fatal("available stock") }
if !s.Release("a") || s.Release("a") || s.Release("missing") || s.Hold("a", "book", 1) { t.Fatal("release and consumed IDs") }
if n, _ := s.Available("book"); n != 3 { t.Fatal("release restored wrong quantity") }`,
        `s := NewInventory(); s.Add("book", 5); s.Hold("a", "book", 3); s.Hold("b", "book", 2)
if !s.Commit("a") || !s.Commit("a") || s.Release("a") || s.Hold("a", "book", 1) || s.Commit("missing") { t.Fatal("commit retry semantics") }
if n, _ := s.Stock("book"); n != 2 { t.Fatal("commit must debit once") }
if n, _ := s.Available("book"); n != 0 { t.Fatal("commit changed availability") }
if !s.Release("b") || s.Commit("b") || !s.Restock("book", 4) { t.Fatal("released hold cannot commit") }
if n, _ := s.Available("book"); n != 6 { t.Fatal("release/restock accounting") }`,
      ],
      [
        `s := NewInventory(); s.Add("book", 0); s.Add("Book", 4); s.Restock("book", 1)
if n, ok := s.Stock("Book"); !ok || n != 4 { t.Fatal("SKUs must be independent and case sensitive") }
if s.Add("book", 10) { t.Fatal("duplicate accepted") }
if n, _ := s.Stock("book"); n != 1 { t.Fatal("duplicate overwrote stock") }`,
        `s := NewInventory(); s.Add("a", 2); s.Add("b", 2)
if s.Hold("", "a", 1) || s.Hold("q", "missing", 1) || s.Hold("q", "a", 0) || s.Hold("q", "a", -1) || !s.Hold("q", "a", 2) || s.Hold("q", "b", 1) { t.Fatal("invalid holds or global IDs") }
s.Restock("a", 1)
if n, _ := s.Available("a"); n != 1 { t.Fatal("restock while held") }
if n, _ := s.Available("b"); n != 2 { t.Fatal("hold affected another SKU") }
if n, ok := s.Available("missing"); ok || n != 0 { t.Fatal("unknown availability") }`,
        `s := NewInventory(); s.Add("a", 4); s.Add("b", 3); s.Hold("x", "a", 2); s.Hold("y", "b", 3); s.Commit("x"); s.Restock("a", 1)
if !s.Commit("x") || !s.Commit("y") || !s.Commit("y") { t.Fatal("commit retries") }
if n, _ := s.Stock("a"); n != 3 { t.Fatal("retry consumed replenished units") }
if n, _ := s.Stock("b"); n != 0 { t.Fatal("full-stock commit") }
if n, _ := s.Available("a"); n != 3 { t.Fatal("other SKU affected availability") }
if s.Release("y") || s.Hold("y", "a", 1) { t.Fatal("committed IDs must remain consumed") }`,
      ],
    ),
  },
];

export const reservationApi: Record<string, [string, string, string[]]> = {
  "seat-booking": [
    "SeatBooking",
    "",
    [
      "AddDeparture|id:s,capacity:n|b",
      "SeatsLeft|departure:s|money",
      "Book|id:s,departure:s,seats:n|b",
      "Cancel|id:s|b",
      "Move|id:s,departure:s|b",
      "Queue|id:s,departure:s,seats:n|b",
      "Waiting|departure:s|strings",
      "Promote|departure:s|strings",
    ],
  ],
  "inventory-reservations": [
    "Inventory",
    "",
    [
      "Add|sku:s,units:n|b",
      "Stock|sku:s|money",
      "Restock|sku:s,units:n|b",
      "Available|sku:s|money",
      "Hold|id:s,sku:s,units:n|b",
      "Release|id:s|b",
      "Commit|id:s|b",
    ],
  ],
};
export const reservationTests: Record<string, Command[][]> = {
  "seat-booking": [
    [
      setup("SeatBooking"),
      yes('s.AddDeparture("a",3)'),
      no('s.AddDeparture("a",9)'),
      no('s.AddDeparture("",1)'),
      no('s.AddDeparture("bad",-1)'),
      yes('s.Book("g","a",2)'),
      no('s.Book("g","a",1)'),
      no('s.Book("x","a",2)'),
      no('s.Book("","a",1)'),
      no('s.Book("zero","a",0)'),
      eq('s.SeatsLeft("a")', [1, true]),
      yes('s.Book("x","a",1)'),
      eq('s.SeatsLeft("missing")', [0, false]),
    ],
    [
      setup("SeatBooking"),
      run('s.AddDeparture("a",2)'),
      run('s.AddDeparture("b",1)'),
      run('s.AddDeparture("c",2)'),
      run('s.Book("g","a",2)'),
      no('s.Move("g","b")'),
      no('s.Move("g","missing")'),
      no('s.Move("unknown","c")'),
      yes('s.Move("g","a")'),
      eq('s.SeatsLeft("a")', [0, true]),
      yes('s.Move("g","c")'),
      eq('s.SeatsLeft("a")', [2, true]),
      yes('s.Cancel("g")'),
      no('s.Cancel("g")'),
      yes('s.Book("g","b",1)'),
      eq('s.SeatsLeft("c")', [2, true]),
    ],
    [
      setup("SeatBooking"),
      run('s.AddDeparture("a",3)'),
      run('s.Book("active","a",2)'),
      yes('s.Queue("first","a",2)'),
      yes('s.Queue("second","a",1)'),
      no('s.Queue("first","a",1)'),
      no('s.Book("first","a",1)'),
      no('s.Move("first","a")'),
      eq('s.Promote("a")', []),
      yes('s.Cancel("active")'),
      eq('s.Waiting("a")', ["first", "second"]),
      eq('s.Promote("a")', ["first", "second"]),
      eq('s.Waiting("a")', []),
      eq('s.Promote("a")', []),
      yes('s.Cancel("first")'),
      eq('s.SeatsLeft("a")', [2, true]),
    ],
  ],
  "inventory-reservations": [
    [
      setup("Inventory"),
      yes('s.Add("book",2)'),
      no('s.Add("book",99)'),
      no('s.Add("",1)'),
      no('s.Add("bad",-1)'),
      yes('s.Add("empty",0)'),
      yes('s.Restock("book",3)'),
      no('s.Restock("book",0)'),
      no('s.Restock("book",-1)'),
      no('s.Restock("missing",1)'),
      eq('s.Stock("book")', [5, true]),
      eq('s.Stock("missing")', [0, false]),
    ],
    [
      setup("Inventory"),
      run('s.Add("book",5)'),
      yes('s.Hold("a","book",3)'),
      no('s.Hold("a","book",1)'),
      no('s.Hold("b","book",3)'),
      yes('s.Hold("b","book",2)'),
      eq('s.Stock("book")', [5, true]),
      eq('s.Available("book")', [0, true]),
      yes('s.Release("a")'),
      no('s.Release("a")'),
      no('s.Release("missing")'),
      no('s.Hold("a","book",1)'),
      eq('s.Available("book")', [3, true]),
    ],
    [
      setup("Inventory"),
      run('s.Add("book",5)'),
      run('s.Hold("a","book",3)'),
      run('s.Hold("b","book",2)'),
      yes('s.Commit("a")'),
      yes('s.Commit("a")'),
      no('s.Release("a")'),
      no('s.Hold("a","book",1)'),
      no('s.Commit("missing")'),
      eq('s.Stock("book")', [2, true]),
      eq('s.Available("book")', [0, true]),
      yes('s.Release("b")'),
      no('s.Commit("b")'),
      yes('s.Restock("book",4)'),
      eq('s.Available("book")', [6, true]),
    ],
  ],
};
export const reservationHidden: Record<string, Command[][]> = {
  "seat-booking": [
    [
      setup("SeatBooking"),
      run('s.AddDeparture("a",1)'),
      run('s.AddDeparture("b",0)'),
      no('s.Book("retry","missing",1)'),
      no('s.Book("retry","b",1)'),
      no('s.Book("retry","a",-1)'),
      yes('s.Book("retry","a",1)'),
      eq('s.SeatsLeft("b")', [0, true]),
      no('s.Book("retry","b",1)'),
    ],
    [
      setup("SeatBooking"),
      run('s.AddDeparture("a",2)'),
      run('s.AddDeparture("b",2)'),
      run('s.Book("g","a",2)'),
      run('s.Book("h","b",1)'),
      no('s.Move("g","b")'),
      yes('s.Cancel("h")'),
      yes('s.Move("g","b")'),
      eq('s.SeatsLeft("b")', [0, true]),
      no('s.Cancel("missing")'),
      yes('s.Cancel("g")'),
      eq('s.SeatsLeft("a")', [2, true]),
    ],
    [
      setup("SeatBooking"),
      run('s.AddDeparture("a",2)'),
      run('s.AddDeparture("b",1)'),
      no('s.Queue("","a",1)'),
      no('s.Queue("q","missing",1)'),
      no('s.Queue("q","a",0)'),
      no('s.Queue("q","a",3)'),
      yes('s.Queue("q","a",2)'),
      no('s.Queue("q","b",1)'),
      run('s.Queue("r","a",1)'),
      { kind: "assign", name: "ids", expression: 's.Waiting("a")' },
      eq("LEN(ids)", 2),
      run('ids[0] = "changed"'),
      eq('s.Waiting("a")[0]', "q"),
      yes('s.Cancel("q")'),
      yes('s.Book("q","b",1)'),
      eq('s.Promote("a")', ["r"]),
      eq('s.Waiting("missing")', []),
      eq('s.Promote("missing")', []),
    ],
  ],
  "inventory-reservations": [
    [
      setup("Inventory"),
      run('s.Add("book",0)'),
      run('s.Add("Book",4)'),
      run('s.Restock("book",1)'),
      eq('s.Stock("Book")', [4, true]),
      no('s.Add("book",10)'),
      eq('s.Stock("book")', [1, true]),
    ],
    [
      setup("Inventory"),
      run('s.Add("a",2)'),
      run('s.Add("b",2)'),
      no('s.Hold("","a",1)'),
      no('s.Hold("q","missing",1)'),
      no('s.Hold("q","a",0)'),
      no('s.Hold("q","a",-1)'),
      yes('s.Hold("q","a",2)'),
      no('s.Hold("q","b",1)'),
      run('s.Restock("a",1)'),
      eq('s.Available("a")', [1, true]),
      eq('s.Available("b")', [2, true]),
      eq('s.Available("missing")', [0, false]),
    ],
    [
      setup("Inventory"),
      run('s.Add("a",4)'),
      run('s.Add("b",3)'),
      run('s.Hold("x","a",2)'),
      run('s.Hold("y","b",3)'),
      run('s.Commit("x")'),
      run('s.Restock("a",1)'),
      yes('s.Commit("x")'),
      yes('s.Commit("y")'),
      yes('s.Commit("y")'),
      eq('s.Stock("a")', [3, true]),
      eq('s.Stock("b")', [0, true]),
      eq('s.Available("a")', [3, true]),
      no('s.Release("y")'),
      no('s.Hold("y","a",1)'),
    ],
  ],
};

reservationProblems.push(
  {
    id: "vending-machine",
    title: "Vending machine",
    category: "Fundamentals",
    difficulty: "Medium",
    duration: 60,
    packageName: "practice",
    summary:
      "Build a small cashless vending machine with product stock, session credit, atomic purchases, and refunds.",
    tags: ["Composition", "Integer money", "Atomic updates"],
    levels: [
      level(
        "Load the product catalog",
        "Keep prices and stock counts for product codes.",
        [
          "NewVendingMachine() *VendingMachine creates an empty machine. AddProduct(code string, price, units int) bool adds a nonempty unique code with positive price in cents and nonnegative stock. Rejected additions preserve state.",
          "Stock(code string) (int, bool) and Price(code string) (int, bool) return the stored value, or (0, false) for an unknown product. Product codes are case sensitive.",
          "Money and stock quantities are integers; all values and sums fit in int (safe integers in TypeScript). The machine serves one customer credit balance at a time and requires no external payment service.",
        ],
        'AddProduct("A1", 150, 2); Stock("A1"); Price("A1")',
        "true; (2, true); (150, true)",
      ),
      level(
        "Accept credit and vend",
        "Complete each purchase as one atomic state change.",
        [
          "Insert(cents int) bool adds positive cents to the session balance; nonpositive amounts return false without changing credit. Credit() int initially returns zero.",
          "Purchase(code string) bool succeeds only for a known product with at least one unit and enough credit. Deduct its current price and exactly one unit together; failed purchases change neither stock nor credit.",
          "Unused credit remains available for later purchases. Credit equal to the exact price is sufficient; products with zero stock cannot be purchased.",
        ],
        'AddProduct("A1", 150, 1); Insert(200); Purchase("A1"); Credit(); Stock("A1")',
        "true; true; true; 50; (0, true)",
      ),
      level(
        "Refund and maintain the machine",
        "Return unused credit and update products without disturbing a customer session.",
        [
          "Refund() int returns all currently unused credit and resets it to zero. Repeated refunds return zero; purchased units and money already spent are unaffected.",
          "Restock(code string, units int) bool adds a positive quantity to an existing product. SetPrice(code string, cents int) bool changes an existing product to a positive price. Unknown products and invalid quantities return false and preserve all state.",
          "Price changes apply to subsequent purchases, including a session that already has credit. Restocking and price changes never change session credit.",
        ],
        'AddProduct("A1", 150, 0); Insert(200); Restock("A1", 1); SetPrice("A1", 175); Purchase("A1"); Refund(); Refund()',
        "true; true; true; true; true; 25; 0",
      ),
    ],
    files: caseFiles(
      `type VendingMachine struct {}\nfunc NewVendingMachine() *VendingMachine { return &VendingMachine{} }\nfunc (s *VendingMachine) AddProduct(code string, price, units int) bool { return false }\nfunc (s *VendingMachine) Stock(code string) (int, bool) { return 0, false }\nfunc (s *VendingMachine) Price(code string) (int, bool) { return 0, false }\nfunc (s *VendingMachine) Insert(cents int) bool { return false }\nfunc (s *VendingMachine) Credit() int { return 0 }\nfunc (s *VendingMachine) Purchase(code string) bool { return false }\nfunc (s *VendingMachine) Refund() int { return 0 }\nfunc (s *VendingMachine) Restock(code string, units int) bool { return false }\nfunc (s *VendingMachine) SetPrice(code string, cents int) bool { return false }`,
      [
        `s := NewVendingMachine()
if !s.AddProduct("A1", 150, 2) || s.AddProduct("A1", 1, 9) || s.AddProduct("", 1, 1) || s.AddProduct("bad", 0, 1) || s.AddProduct("bad", 1, -1) { t.Fatal("product validation") }
if n, ok := s.Stock("A1"); !ok || n != 2 { t.Fatal("stock must preserve original value") }
if n, ok := s.Price("A1"); !ok || n != 150 { t.Fatal("price must preserve original value") }
if n, ok := s.Price("missing"); ok || n != 0 { t.Fatal("unknown price") }`,
        `s := NewVendingMachine(); s.AddProduct("A1", 150, 1)
if s.Credit() != 0 || s.Insert(0) || s.Insert(-1) || !s.Insert(100) || s.Purchase("A1") { t.Fatal("credit and insufficient funds") }
if s.Credit() != 100 { t.Fatal("failed purchase consumed credit") }
if !s.Insert(100) || !s.Purchase("A1") || s.Credit() != 50 || s.Purchase("A1") || s.Purchase("missing") { t.Fatal("purchase and depleted stock") }
if n, _ := s.Stock("A1"); n != 0 { t.Fatal("purchase must consume one unit") }
if s.Credit() != 50 { t.Fatal("failed purchase changed credit") }`,
        `s := NewVendingMachine(); s.AddProduct("A1", 150, 0); s.Insert(200)
if !s.Restock("A1", 1) || !s.SetPrice("A1", 175) || !s.Purchase("A1") { t.Fatal("restock and price change") }
if s.Refund() != 25 || s.Credit() != 0 || s.Refund() != 0 { t.Fatal("refund must return only unused credit once") }
if s.Restock("A1", 0) || s.Restock("A1", -1) || s.Restock("missing", 1) || s.SetPrice("A1", 0) || s.SetPrice("missing", 1) { t.Fatal("maintenance validation") }
if n, _ := s.Price("A1"); n != 175 { t.Fatal("invalid update changed price") }
if n, _ := s.Stock("A1"); n != 0 { t.Fatal("refund or maintenance restored purchased unit") }`,
      ],
      [
        `s := NewVendingMachine(); s.AddProduct("a", 1, 0); s.AddProduct("A", 2, 3)
if n, ok := s.Stock("a"); !ok || n != 0 { t.Fatal("zero stock is valid") }
if n, ok := s.Stock("A"); !ok || n != 3 { t.Fatal("product codes must be independent") }
if n, ok := s.Stock("missing"); ok || n != 0 { t.Fatal("unknown stock") }
if s.AddProduct("retry", -1, 1) || !s.AddProduct("retry", 1, 1) { t.Fatal("failed addition consumed product code") }`,
        `s := NewVendingMachine(); s.AddProduct("a", 100, 2); s.AddProduct("b", 1, 0); s.Insert(200)
if s.Purchase("b") || s.Credit() != 200 || !s.Purchase("a") || !s.Purchase("a") || s.Credit() != 0 { t.Fatal("exact payment or stock accounting") }
if n, _ := s.Stock("a"); n != 0 { t.Fatal("multiple purchases must each consume stock") }`,
        `s := NewVendingMachine(); s.AddProduct("a", 100, 1); s.AddProduct("b", 10, 1); s.Insert(100); s.SetPrice("a", 110)
if s.Purchase("a") || s.Credit() != 100 || s.SetPrice("a", -1) { t.Fatal("new price and invalid update") }
if !s.SetPrice("a", 90) || !s.Purchase("a") || !s.Purchase("b") || s.Refund() != 0 { t.Fatal("price update must affect next purchase only") }
s.Restock("a", 2)
if n, _ := s.Stock("a"); n != 2 { t.Fatal("restock after sellout") }
if n, _ := s.Stock("b"); n != 0 { t.Fatal("maintenance affected another product") }`,
      ],
    ),
  },
  {
    id: "library-lending",
    title: "Library lending",
    category: "Fundamentals",
    difficulty: "Medium",
    duration: 60,
    packageName: "practice",
    summary:
      "Manage book copies and member loans, enforce borrowing limits, and preserve loans when policies change.",
    tags: ["Object relationships", "Ownership", "Policy changes"],
    levels: [
      level(
        "Register books and members",
        "Keep a catalog with multiple copies and an independent member registry.",
        [
          "NewLibrary() *Library creates an empty library. AddBook(id string, copies int) bool creates a nonempty unique book ID with nonnegative copies. AddMember(id string) bool creates a nonempty unique member ID. Invalid additions change nothing.",
          "Available(book string) (int, bool) returns unborrowed copies, or (0, false) for an unknown book. Initially every registered copy is available.",
          "Book and member IDs are case sensitive and use independent namespaces, so a member and a book may share an ID. Counts and sums fit in int (safe integers in TypeScript).",
        ],
        'AddBook("atlas", 2); AddMember("reader"); Available("atlas")',
        "true; true; (2, true)",
      ),
      level(
        "Borrow and return copies",
        "Track ownership of each loan and return deterministic member summaries.",
        [
          "Borrow(member, book string) bool lends one available copy to a registered member. A member may borrow at most one copy of each book and initially may hold at most two books total. Unknown IDs, no stock, duplicate loans, and limit violations return false without changing state.",
          "Return(member, book string) bool ends that member's active loan and restores exactly one available copy. Unknown or unowned loans return false and change nothing.",
          "Loans(member string) []string returns that member's borrowed book IDs sorted lexicographically; unknown members return an empty list. Return a defensive copy. Returned books can be borrowed again.",
        ],
        'AddBook("atlas", 1); AddMember("reader"); Borrow("reader", "atlas"); Loans("reader"); Return("reader", "atlas")',
        'true; true; true; ["atlas"]; true',
      ),
      level(
        "Change member borrowing policies",
        "Adjust limits without cancelling a reader's existing loans.",
        [
          "SetLimit(member string, limit int) bool replaces a registered member's limit with a nonnegative number. Unknown members or negative limits return false and preserve the old limit. Limits apply independently to each member.",
          "Lowering a limit below the current number of loans preserves every active loan. Borrow rejects new loans until the member has fewer loans than the new limit. A zero limit blocks all new loans but still permits returns.",
          "Remaining(member string) (int, bool) returns max(0, limit minus current loan count), or (0, false) for an unknown member. Failed borrowing and policy updates never consume quota.",
        ],
        'AddMember("reader"); Remaining("reader"); SetLimit("reader", 0); Remaining("reader")',
        "true; (2, true); true; (0, true)",
      ),
    ],
    files: caseFiles(
      `type Library struct {}\nfunc NewLibrary() *Library { return &Library{} }\nfunc (s *Library) AddBook(id string, copies int) bool { return false }\nfunc (s *Library) AddMember(id string) bool { return false }\nfunc (s *Library) Available(book string) (int, bool) { return 0, false }\nfunc (s *Library) Borrow(member, book string) bool { return false }\nfunc (s *Library) Return(member, book string) bool { return false }\nfunc (s *Library) Loans(member string) []string { return []string{} }\nfunc (s *Library) SetLimit(member string, limit int) bool { return false }\nfunc (s *Library) Remaining(member string) (int, bool) { return 0, false }`,
      [
        `s := NewLibrary()
if !s.AddBook("atlas", 2) || s.AddBook("atlas", 9) || s.AddBook("", 1) || s.AddBook("bad", -1) || !s.AddBook("empty", 0) { t.Fatal("book validation") }
if !s.AddMember("reader") || s.AddMember("reader") || s.AddMember("") { t.Fatal("member validation") }
if n, ok := s.Available("atlas"); !ok || n != 2 { t.Fatal("duplicate changed copies") }
if n, ok := s.Available("missing"); ok || n != 0 { t.Fatal("unknown book") }`,
        `s := NewLibrary(); s.AddBook("z", 1); s.AddBook("a", 2); s.AddBook("c", 1); s.AddMember("r"); s.AddMember("other")
if !s.Borrow("r", "z") || !s.Borrow("r", "a") || s.Borrow("r", "a") || s.Borrow("r", "c") || s.Borrow("other", "z") { t.Fatal("loan validation and default limit") }
if ids := s.Loans("r"); len(ids) != 2 || ids[0] != "a" || ids[1] != "z" { t.Fatal("loans must be sorted") }
if s.Return("other", "z") || !s.Return("r", "z") || s.Return("r", "z") || !s.Borrow("other", "z") { t.Fatal("return ownership") }
if !s.Borrow("r", "c") { t.Fatal("return must restore quota") }
if n, _ := s.Available("a"); n != 1 { t.Fatal("book copies must be independent") }`,
        `s := NewLibrary(); s.AddBook("a", 1); s.AddBook("b", 1); s.AddBook("c", 1); s.AddMember("r"); s.Borrow("r", "a"); s.Borrow("r", "b")
if !s.SetLimit("r", 1) || s.Borrow("r", "c") { t.Fatal("lowered limit must block borrowing") }
if ids := s.Loans("r"); len(ids) != 2 { t.Fatal("policy change cancelled existing loans") }
if n, ok := s.Remaining("r"); !ok || n != 0 { t.Fatal("remaining quota must clamp at zero") }
s.Return("r", "a"); if s.Borrow("r", "c") { t.Fatal("at limit must remain blocked") }
if !s.SetLimit("r", 3) || !s.Borrow("r", "c") || s.SetLimit("r", -1) || s.SetLimit("missing", 1) { t.Fatal("policy validation") }
if n, _ := s.Remaining("r"); n != 1 { t.Fatal("invalid policy changed quota") }`,
      ],
      [
        `s := NewLibrary(); s.AddBook("same", 0)
if !s.AddMember("same") || !s.AddBook("Same", 1) || !s.AddMember("Same") { t.Fatal("case sensitivity and independent namespaces") }
if n, ok := s.Available("same"); !ok || n != 0 { t.Fatal("zero-copy book is valid") }
if s.AddBook("retry", -1) || !s.AddBook("retry", 1) { t.Fatal("invalid addition consumed ID") }`,
        `s := NewLibrary(); s.AddBook("a", 2); s.AddMember("r"); s.AddMember("q")
if s.Borrow("missing", "a") || s.Borrow("r", "missing") || !s.Borrow("r", "a") || !s.Borrow("q", "a") { t.Fatal("unknown IDs or independent copies") }
ids := s.Loans("r"); if len(ids) != 1 { t.Fatal("missing loan") }; ids[0] = "changed"
if s.Loans("r")[0] != "a" || len(s.Loans("missing")) != 0 { t.Fatal("loans exposed storage or unknown member") }
if !s.Return("r", "a") || !s.Borrow("r", "a") { t.Fatal("returned book must be borrowable again") }
if n, _ := s.Available("a"); n != 0 { t.Fatal("two members share copies incorrectly") }`,
        `s := NewLibrary(); s.AddBook("a", 2); s.AddMember("r"); s.AddMember("q")
if n, ok := s.Remaining("r"); !ok || n != 2 { t.Fatal("default limit") }
if !s.SetLimit("r", 0) || s.Borrow("r", "a") || !s.Borrow("q", "a") { t.Fatal("zero limit must affect one member only") }
if n, _ := s.Remaining("q"); n != 1 { t.Fatal("member quotas must be isolated") }
if n, ok := s.Remaining("missing"); ok || n != 0 { t.Fatal("unknown remaining quota") }
if !s.SetLimit("r", 1) || !s.Borrow("r", "a") || !s.SetLimit("r", 0) || !s.Return("r", "a") { t.Fatal("zero limit must permit returns") }
if n, _ := s.Available("a"); n != 1 { t.Fatal("failed borrow consumed copies") }`,
      ],
    ),
  },
);
Object.assign(reservationApi, {
  "vending-machine": [
    "VendingMachine",
    "",
    [
      "AddProduct|code:s,price:n,units:n|b",
      "Stock|code:s|money",
      "Price|code:s|money",
      "Insert|cents:n|b",
      "Credit||n",
      "Purchase|code:s|b",
      "Refund||n",
      "Restock|code:s,units:n|b",
      "SetPrice|code:s,cents:n|b",
    ],
  ],
  "library-lending": [
    "Library",
    "",
    [
      "AddBook|id:s,copies:n|b",
      "AddMember|id:s|b",
      "Available|book:s|money",
      "Borrow|member:s,book:s|b",
      "Return|member:s,book:s|b",
      "Loans|member:s|strings",
      "SetLimit|member:s,limit:n|b",
      "Remaining|member:s|money",
    ],
  ],
});
Object.assign(reservationTests, {
  "vending-machine": [
    [
      setup("VendingMachine"),
      yes('s.AddProduct("A1",150,2)'),
      no('s.AddProduct("A1",1,9)'),
      no('s.AddProduct("",1,1)'),
      no('s.AddProduct("bad",0,1)'),
      no('s.AddProduct("bad",1,-1)'),
      eq('s.Stock("A1")', [2, true]),
      eq('s.Price("A1")', [150, true]),
      eq('s.Price("missing")', [0, false]),
    ],
    [
      setup("VendingMachine"),
      run('s.AddProduct("A1",150,1)'),
      eq("s.Credit()", 0),
      no("s.Insert(0)"),
      no("s.Insert(-1)"),
      yes("s.Insert(100)"),
      no('s.Purchase("A1")'),
      eq("s.Credit()", 100),
      yes("s.Insert(100)"),
      yes('s.Purchase("A1")'),
      eq("s.Credit()", 50),
      no('s.Purchase("A1")'),
      no('s.Purchase("missing")'),
      eq('s.Stock("A1")', [0, true]),
      eq("s.Credit()", 50),
    ],
    [
      setup("VendingMachine"),
      run('s.AddProduct("A1",150,0)'),
      run("s.Insert(200)"),
      yes('s.Restock("A1",1)'),
      yes('s.SetPrice("A1",175)'),
      yes('s.Purchase("A1")'),
      eq("s.Refund()", 25),
      eq("s.Credit()", 0),
      eq("s.Refund()", 0),
      no('s.Restock("A1",0)'),
      no('s.Restock("A1",-1)'),
      no('s.Restock("missing",1)'),
      no('s.SetPrice("A1",0)'),
      no('s.SetPrice("missing",1)'),
      eq('s.Price("A1")', [175, true]),
      eq('s.Stock("A1")', [0, true]),
    ],
  ],
  "library-lending": [
    [
      setup("Library"),
      yes('s.AddBook("atlas",2)'),
      no('s.AddBook("atlas",9)'),
      no('s.AddBook("",1)'),
      no('s.AddBook("bad",-1)'),
      yes('s.AddBook("empty",0)'),
      yes('s.AddMember("reader")'),
      no('s.AddMember("reader")'),
      no('s.AddMember("")'),
      eq('s.Available("atlas")', [2, true]),
      eq('s.Available("missing")', [0, false]),
    ],
    [
      setup("Library"),
      run('s.AddBook("z",1)'),
      run('s.AddBook("a",2)'),
      run('s.AddBook("c",1)'),
      run('s.AddMember("r")'),
      run('s.AddMember("other")'),
      yes('s.Borrow("r","z")'),
      yes('s.Borrow("r","a")'),
      no('s.Borrow("r","a")'),
      no('s.Borrow("r","c")'),
      no('s.Borrow("other","z")'),
      eq('s.Loans("r")', ["a", "z"]),
      no('s.Return("other","z")'),
      yes('s.Return("r","z")'),
      no('s.Return("r","z")'),
      yes('s.Borrow("other","z")'),
      yes('s.Borrow("r","c")'),
      eq('s.Available("a")', [1, true]),
    ],
    [
      setup("Library"),
      run('s.AddBook("a",1)'),
      run('s.AddBook("b",1)'),
      run('s.AddBook("c",1)'),
      run('s.AddMember("r")'),
      run('s.Borrow("r","a")'),
      run('s.Borrow("r","b")'),
      yes('s.SetLimit("r",1)'),
      no('s.Borrow("r","c")'),
      eq('LEN(s.Loans("r"))', 2),
      eq('s.Remaining("r")', [0, true]),
      run('s.Return("r","a")'),
      no('s.Borrow("r","c")'),
      yes('s.SetLimit("r",3)'),
      yes('s.Borrow("r","c")'),
      no('s.SetLimit("r",-1)'),
      no('s.SetLimit("missing",1)'),
      eq('s.Remaining("r")', [1, true]),
    ],
  ],
} satisfies Record<string, Command[][]>);
Object.assign(reservationHidden, {
  "vending-machine": [
    [
      setup("VendingMachine"),
      run('s.AddProduct("a",1,0)'),
      run('s.AddProduct("A",2,3)'),
      eq('s.Stock("a")', [0, true]),
      eq('s.Stock("A")', [3, true]),
      eq('s.Stock("missing")', [0, false]),
      no('s.AddProduct("retry",-1,1)'),
      yes('s.AddProduct("retry",1,1)'),
    ],
    [
      setup("VendingMachine"),
      run('s.AddProduct("a",100,2)'),
      run('s.AddProduct("b",1,0)'),
      run("s.Insert(200)"),
      no('s.Purchase("b")'),
      eq("s.Credit()", 200),
      yes('s.Purchase("a")'),
      yes('s.Purchase("a")'),
      eq("s.Credit()", 0),
      eq('s.Stock("a")', [0, true]),
    ],
    [
      setup("VendingMachine"),
      run('s.AddProduct("a",100,1)'),
      run('s.AddProduct("b",10,1)'),
      run("s.Insert(100)"),
      run('s.SetPrice("a",110)'),
      no('s.Purchase("a")'),
      eq("s.Credit()", 100),
      no('s.SetPrice("a",-1)'),
      yes('s.SetPrice("a",90)'),
      yes('s.Purchase("a")'),
      yes('s.Purchase("b")'),
      eq("s.Refund()", 0),
      run('s.Restock("a",2)'),
      eq('s.Stock("a")', [2, true]),
      eq('s.Stock("b")', [0, true]),
    ],
  ],
  "library-lending": [
    [
      setup("Library"),
      run('s.AddBook("same",0)'),
      yes('s.AddMember("same")'),
      yes('s.AddBook("Same",1)'),
      yes('s.AddMember("Same")'),
      eq('s.Available("same")', [0, true]),
      no('s.AddBook("retry",-1)'),
      yes('s.AddBook("retry",1)'),
    ],
    [
      setup("Library"),
      run('s.AddBook("a",2)'),
      run('s.AddMember("r")'),
      run('s.AddMember("q")'),
      no('s.Borrow("missing","a")'),
      no('s.Borrow("r","missing")'),
      yes('s.Borrow("r","a")'),
      yes('s.Borrow("q","a")'),
      { kind: "assign", name: "ids", expression: 's.Loans("r")' },
      eq("LEN(ids)", 1),
      run('ids[0] = "changed"'),
      eq('s.Loans("r")[0]', "a"),
      eq('s.Loans("missing")', []),
      yes('s.Return("r","a")'),
      yes('s.Borrow("r","a")'),
      eq('s.Available("a")', [0, true]),
    ],
    [
      setup("Library"),
      run('s.AddBook("a",2)'),
      run('s.AddMember("r")'),
      run('s.AddMember("q")'),
      eq('s.Remaining("r")', [2, true]),
      yes('s.SetLimit("r",0)'),
      no('s.Borrow("r","a")'),
      yes('s.Borrow("q","a")'),
      eq('s.Remaining("q")', [1, true]),
      eq('s.Remaining("missing")', [0, false]),
      yes('s.SetLimit("r",1)'),
      yes('s.Borrow("r","a")'),
      yes('s.SetLimit("r",0)'),
      yes('s.Return("r","a")'),
      eq('s.Available("a")', [1, true]),
    ],
  ],
} satisfies Record<string, Command[][]>);
