import type { PracticeProblem } from "./problems.ts";

type Level = PracticeProblem["levels"][number];
const level = (
  title: string,
  description: string,
  requirements: string[],
  input: string,
  output: string,
): Level => ({
  title,
  description,
  requirements,
  examples: [{ input, output }],
});
const files = (starter: string, tests: string[], hidden: string[]) => [
  {
    path: "implementation.go",
    content: `package practice\n\n${starter}\n`,
    readOnly: false,
  },
  { path: "go.mod", content: "module practice\n\ngo 1.22\n", readOnly: true },
  ...tests.map((content, i) => ({
    path: `level_${i + 1}_test.go`,
    content: `package practice\nimport "testing"\nfunc TestLevel${i + 1}_Parking(t *testing.T) {\n${content}\n}\n`,
    readOnly: true,
  })),
  ...hidden.map((content, i) => ({
    path: `hidden_level_${i + 1}_test.go`,
    content: `package practice\nimport "testing"\nfunc TestLevel${i + 1}_HiddenParking(t *testing.T) {\n${content}\n}\n`,
    readOnly: true,
    hidden: true,
  })),
  {
    path: "sandbox_test.go",
    content:
      'package practice\nimport "testing"\n\n// Add your own edge cases here.\nfunc TestUser_Smoke(t *testing.T) { t.Log("Your own tests run alongside the level checks.") }\n',
    readOnly: false,
  },
];
export const parkingProblems: PracticeProblem[] = [
  {
    id: "parking-lot",
    title: "Parking lot",
    category: "Ride-hailing",
    difficulty: "Easy",
    duration: 60,
    packageName: "practice",
    summary:
      "Design the classic parking lot: capacity, vehicle admission, parking tickets, and reserved spaces.",
    tags: ["Parking", "Capacity", "Tickets"],
    levels: [
      level(
        "Manage a single lot",
        "Start with a fixed-capacity lot where each vehicle takes one space.",
        [
          "NewParkingLot(capacity int) *ParkingLot creates a lot with nonnegative capacity, initially empty.",
          "Park(plate string) bool admits a nonempty, unique plate if space is available. Failed calls never change capacity.",
          "Leave(plate string) bool removes a parked vehicle. Empty or unknown plates return false.",
          "Available() int returns remaining spaces. A zero-capacity lot rejects all parking.",
        ],
        'NewParkingLot(1); Park("ABC-123"); Park("XYZ-456"); Leave("ABC-123")',
        "true; false; true",
      ),
      level(
        "Issue parking tickets",
        "Issue stable ticket numbers for successful parking sessions.",
        [
          "Ticket(plate string) (int, bool) returns the current ticket, or (0, false) when the plate is not parked.",
          "Ticket numbers start at 1 and increase by 1 on each successful Park. Rejected calls consume no ticket number.",
          "Leave invalidates the ticket. A plate can return later and receives a new ticket.",
        ],
        'Park("A"); Ticket("A"); Leave("A"); Park("A"); Ticket("A")',
        "true; (1, true); true; true; (2, true)",
      ),
      level(
        "Reserve a space",
        "Hold capacity without issuing a ticket until the driver arrives.",
        [
          "Reserve(plate string) bool holds one free space for a nonempty plate that is neither parked nor already reserved.",
          "Reservations reduce Available(). Park for that same plate converts its hold to a parked session, even when Available() is zero.",
          "CancelReservation(plate string) bool releases only a pending reservation. Leave rejects reserved-only plates.",
          "Ticket returns (0, false) for pending reservations. Only successful Park issues a ticket.",
        ],
        'NewParkingLot(1); Reserve("A"); Available(); Park("A"); Ticket("A")',
        "true; 0; true; (1, true)",
      ),
    ],
    files: files(
      `type ParkingLot struct {}\nfunc NewParkingLot(capacity int) *ParkingLot { return &ParkingLot{} }\nfunc (p *ParkingLot) Park(plate string) bool { return false }\nfunc (p *ParkingLot) Leave(plate string) bool { return false }\nfunc (p *ParkingLot) Available() int { return 0 }\nfunc (p *ParkingLot) Ticket(plate string) (int, bool) { return 0, false }\nfunc (p *ParkingLot) Reserve(plate string) bool { return false }\nfunc (p *ParkingLot) CancelReservation(plate string) bool { return false }`,
      [
        'p:=NewParkingLot(2)\nif p.Available()!=2 || p.Park("") || !p.Park("A") || p.Park("A") || !p.Park("B") || p.Park("C") || p.Available()!=0 { t.Fatal("capacity or admission incorrect") }\nif p.Leave("missing") || !p.Leave("A") || p.Leave("A") || p.Available()!=1 || !p.Park("C") { t.Fatal("departure must release exactly one space") }',
        'p:=NewParkingLot(1); p.Park("A"); p.Park("B")\nif n,ok:=p.Ticket("A"); !ok || n!=1 { t.Fatal("first ticket must be 1") }\np.Leave("A")\nif _,ok:=p.Ticket("A"); ok {t.Fatal("departed ticket still active")}; p.Park("B")\nif n,ok:=p.Ticket("B"); !ok || n!=2 {t.Fatal("failed park must not consume a ticket")}',
        'p:=NewParkingLot(1)\nif !p.Reserve("A") || p.Reserve("A") || p.Reserve("B") || p.Available()!=0 || p.Leave("A") {t.Fatal("reservation capacity incorrect")}\nif _,ok:=p.Ticket("A"); ok {t.Fatal("reservation issued a ticket")}\nif !p.Park("A") || p.CancelReservation("A") {t.Fatal("reservation conversion failed")}\nif n,ok:=p.Ticket("A"); !ok || n!=1 {t.Fatal("conversion ticket incorrect")}; p.Leave("A")\nif !p.Reserve("B") || !p.CancelReservation("B") || p.CancelReservation("B") || p.Available()!=1 {t.Fatal("cancellation failed")}',
      ],
      [
        'p:=NewParkingLot(0); if p.Park("A") || p.Available()!=0 || p.Leave("") {t.Fatal("zero capacity must remain empty")}',
        'p:=NewParkingLot(1); p.Park(""); p.Park("A"); p.Leave("A"); p.Park("A"); if n,ok:=p.Ticket("A"); !ok || n!=2 {t.Fatal("returning plate needs a fresh ticket")}',
        'p:=NewParkingLot(1); if p.Reserve("") || p.CancelReservation("unknown") || p.Available()!=1 {t.Fatal("invalid reservation mutated lot")}; p.Reserve("A"); p.CancelReservation("A"); p.Park("B"); if n,_:=p.Ticket("B"); n!=1 {t.Fatal("reservation consumed ticket sequence")}',
      ],
    ),
  },
  {
    id: "multi-level-garage",
    title: "Multi-level parking garage",
    category: "Ride-hailing",
    difficulty: "Hard",
    duration: 60,
    packageName: "practice",
    summary:
      "Allocate sized spaces across multiple levels, locate vehicles, and manage reserved spots deterministically.",
    tags: ["Parking", "Allocation", "Multiple levels"],
    levels: [
      level(
        "Allocate the right space",
        "Model a garage with different spot sizes on each floor.",
        [
          "NewGarage(layout []string) *Garage uses one string per level, with S, M, and L characters representing spots in index order. Empty levels and empty garages are allowed; the layout contains only these characters.",
          'Park(plate, kind string) (string, bool) supports motorcycle (S/M/L), car (M/L), and truck (L). Empty plates, duplicate plates, or unknown kinds fail with ("", false).',
          'Choose the smallest fitting size anywhere in the garage first, then the lowest level, then the lowest spot index. Return a 1-based ID such as "L2-S3".',
          "Leave(plate string) bool frees a parked vehicle’s spot. Available() int counts all unallocated spots.",
        ],
        'NewGarage([]string{"ML", "SL"}); Park("bike", "motorcycle"); Park("car", "car")',
        '("L2-S1", true); ("L1-S1", true)',
      ),
      level(
        "Locate and count",
        "Expose allocation queries without changing garage state.",
        [
          'Find(plate string) (string, bool) returns its allocated spot or ("", false) if unknown.',
          "Count(level int) int returns the number of allocated spots on the 1-based level. Invalid levels return zero.",
          "Leaving a vehicle clears its lookup and decrements that level’s count. Reusing a freed space follows the original allocation order.",
        ],
        'Park("A", "car"); Find("A"); Count(1); Leave("A"); Find("A")',
        '("L1-S1", true); ("L1-S1", true); 1; true; ("", false)',
      ),
      level(
        "Reserve and check in",
        "Support pending reservations that hold a concrete space.",
        [
          "Reserve(plate, kind string) (string, bool) allocates with the same validation and ordering as Park, but creates a pending reservation.",
          "CheckIn(plate string) bool converts a pending reservation to parked, preserving its spot. Repeated check-in or unknown plates return false.",
          "CancelReservation(plate string) bool releases only pending reservations. Leave rejects pending reservations. Park and Reserve reject any plate that already has an allocation.",
          "Find includes pending reservations. Count includes parked and reserved spots. Available excludes both.",
        ],
        'NewGarage([]string{"S"}); Reserve("A","motorcycle"); Find("A"); CheckIn("A"); Leave("A")',
        '("L1-S1", true); ("L1-S1", true); true; true',
      ),
    ],
    files: files(
      `type Garage struct {}\nfunc NewGarage(layout []string) *Garage { return &Garage{} }\nfunc (g *Garage) Park(plate, kind string) (string, bool) { return "", false }\nfunc (g *Garage) Leave(plate string) bool { return false }\nfunc (g *Garage) Available() int { return 0 }\nfunc (g *Garage) Find(plate string) (string, bool) { return "", false }\nfunc (g *Garage) Count(level int) int { return 0 }\nfunc (g *Garage) Reserve(plate, kind string) (string, bool) { return "", false }\nfunc (g *Garage) CheckIn(plate string) bool { return false }\nfunc (g *Garage) CancelReservation(plate string) bool { return false }`,
      [
        'g:=NewGarage([]string{"ML","SL"})\nif g.Available()!=4 {t.Fatal("initial capacity incorrect")}\nif s,ok:=g.Park("bike","motorcycle"); !ok || s!="L2-S1" {t.Fatal("must prefer smallest fitting size across levels")}\nif s,ok:=g.Park("car","car"); !ok || s!="L1-S1" {t.Fatal("car must prefer medium spot")}\nif s,ok:=g.Park("truck","truck"); !ok || s!="L1-S2" {t.Fatal("level tie-break incorrect")}\nif _,ok:=g.Park("car","car"); ok {t.Fatal("duplicate plate accepted")}\nif !g.Leave("bike") || g.Leave("bike") || g.Available()!=2 {t.Fatal("leave incorrect")}',
        'g:=NewGarage([]string{"MM","M"}); g.Park("a","car"); g.Park("b","car"); g.Park("c","car")\nif s,ok:=g.Find("b"); !ok || s!="L1-S2" {t.Fatal("lookup wrong")}\nif g.Count(1)!=2 || g.Count(2)!=1 || g.Count(0)!=0 || g.Count(3)!=0 {t.Fatal("count wrong")}; g.Leave("a")\nif _,ok:=g.Find("a"); ok {t.Fatal("departed vehicle found")}\nif s,ok:=g.Park("d","car"); !ok || s!="L1-S1" || g.Count(1)!=2 {t.Fatal("freed spot not reused deterministically")}',
        'g:=NewGarage([]string{"S"})\nif s,ok:=g.Reserve("a","motorcycle"); !ok || s!="L1-S1" {t.Fatal("reserve failed")}\nif g.Available()!=0 || g.Count(1)!=1 || g.Leave("a") {t.Fatal("reserved occupancy incorrect")}\nif s,ok:=g.Find("a"); !ok || s!="L1-S1" {t.Fatal("reservation not locatable")}\nif !g.CheckIn("a") || g.CheckIn("a") || g.CancelReservation("a") || !g.Leave("a") {t.Fatal("check-in transition incorrect")}\ng.Reserve("b","motorcycle"); if !g.CancelReservation("b") || g.CancelReservation("b") || g.Available()!=1 {t.Fatal("cancellation failed")}',
      ],
      [
        'g:=NewGarage([]string{"S"}); if _,ok:=g.Park("t","truck"); ok {t.Fatal("truck parked in small spot")}; if _,ok:=g.Park("a","hovercraft"); ok {t.Fatal("unknown kind accepted")}; if _,ok:=g.Park("","motorcycle"); ok {t.Fatal("empty plate accepted")}; if g.Available()!=1 {t.Fatal("failed admission consumed space")}',
        'g:=NewGarage([]string{"","M"}); if s,ok:=g.Park("a","car"); !ok || s!="L2-S1" || g.Count(1)!=0 || g.Count(2)!=1 {t.Fatal("empty level indexing incorrect")}',
        'g:=NewGarage([]string{"M"}); g.Reserve("a","car"); if _,ok:=g.Park("a","car"); ok {t.Fatal("reserved plate admitted twice")}; if _,ok:=g.Reserve("a","car"); ok {t.Fatal("duplicate reservation accepted")}; if g.CheckIn("missing") || !g.CancelReservation("a") {t.Fatal("invalid reservation transition")}; if _,ok:=g.Find("a"); ok {t.Fatal("cancelled reservation still indexed")}',
      ],
    ),
  },
];
