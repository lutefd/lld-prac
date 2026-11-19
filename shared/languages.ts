import type { PracticeProblem, PracticeFile } from "./problems.ts";
type Command = {
  kind: "assign" | "eq" | "run";
  name?: string;
  expression: string;
  expected?: unknown;
};
// Portable starter/test generation. All exercises keep the same PascalCase API.
const api: Record<string, [string, string, string[]]> = {
  "ride-dispatch": [
    "Dispatcher",
    "",
    [
      "Register|id:s,position:n|b",
      "Count||n",
      "Nearest|position:n|pair",
      "Assign|position:n|pair",
      "Release|id:s|b",
    ],
  ],
  "fare-calculator": [
    "FareEngine",
    "base:n,perKM:n,perMinute:n",
    [
      "Quote|km:n,minutes:n|money",
      "SetSurge|basisPoints:n|b",
      "AddPromo|code:s,cents:n|b",
      "QuoteWithPromo|km:n,minutes:n,code:s|money",
    ],
  ],
  "trip-lifecycle": [
    "TripService",
    "",
    [
      "Request|id:s|b",
      "State|id:s|pair",
      "Assign|id:s|b",
      "Start|id:s|b",
      "Complete|id:s|b",
      "Cancel|id:s|b",
      "History|id:s|strings",
    ],
  ],
  "driver-availability": [
    "Fleet",
    "",
    [
      "Online|id:s,city:s|b",
      "City|id:s|pair",
      "SetBusy|id:s,busy:b|b",
      "Available|city:s|strings",
      "Move|id:s,city:s|b",
      "Offline|id:s|b",
    ],
  ],
  "wallet-ledger": [
    "Ledger",
    "",
    [
      "Create|id:s|b",
      "Deposit|id:s,cents:n|b",
      "Balance|id:s|money",
      "Withdraw|id:s,cents:n|b",
      "Apply|operationID:s,walletID:s,delta:n|b",
    ],
  ],
  "account-transfers": [
    "Bank",
    "",
    [
      "Open|id:s,cents:n|b",
      "Balance|id:s|money",
      "Transfer|id:s,from:s,to:s,cents:n|b",
      "Reverse|id:s|b",
    ],
  ],
  "card-limits": [
    "Card",
    "limit:n",
    [
      "Available||n",
      "Authorize|id:s,cents:n|b",
      "Capture|id:s|b",
      "Void|id:s|b",
      "Refund|id:s,cents:n|b",
    ],
  ],
  "transaction-history": [
    "Statement",
    "",
    [
      "Add|entry:entry|b",
      "Get|id:s|entrypair",
      "List|category:s|entries",
      "Page|afterID:s,limit:n|entries",
    ],
  ],
  "in-memory-filesystem": [
    "FileSystem",
    "",
    [
      "Write|path:s,content:s|b",
      "Read|path:s|pair",
      "List|prefix:s|strings",
      "Delete|path:s|b",
      "Move|source:s,target:s|b",
    ],
  ],
  "rate-limiter": [
    "Limiter",
    "limit:n,windowSeconds:n",
    [
      "Allow|key:s,now:n|b",
      "SetLimit|key:s,limit:n|b",
      "Remaining|key:s,now:n|n",
      "RetryAfter|key:s,now:n|n",
    ],
  ],
};
const assign = (name: string, expression: string): Command => ({
  kind: "assign",
  name,
  expression,
});
const eq = (expression: string, expected: unknown): Command => ({
  kind: "eq",
  expression,
  expected,
});
const yes = (expression: string): Command => eq(expression, true);
const no = (expression: string): Command => eq(expression, false);
const run = (expression: string): Command => ({ kind: "run", expression });
const setup = (name: string, ...args: (string | number)[]): Command =>
  assign("s", `New${name}(${args.join(",")})`);
const entry = (id: string, time: number, cents: number, category: string) =>
  `Entry(${JSON.stringify(id)},${time},${cents},${JSON.stringify(category)})`;
const tests: Record<string, Command[][]> = {
  "ride-dispatch": [
    [
      setup("Dispatcher"),
      yes('s.Register("a",8)'),
      no('s.Register("a",2)'),
      no('s.Register("",0)'),
      eq("s.Count()", 1),
    ],
    [
      setup("Dispatcher"),
      eq("s.Nearest(0)", ["", false]),
      run('s.Register("b",4)'),
      run('s.Register("a",8)'),
      eq("s.Nearest(6)", ["a", true]),
      eq("s.Nearest(3)", ["b", true]),
    ],
    [
      setup("Dispatcher"),
      run('s.Register("a",0)'),
      eq("s.Assign(1)", ["a", true]),
      eq("s.Nearest(1)", ["", false]),
      no('s.Release("missing")'),
      yes('s.Release("a")'),
      no('s.Release("a")'),
      eq("s.Nearest(1)", ["a", true]),
      eq("s.Count()", 1),
    ],
  ],
  "fare-calculator": [
    [
      setup("FareEngine", 300, 120, 20),
      eq("s.Quote(5,10)", [1100, true]),
      eq("s.Quote(-1,0)", [0, false]),
      eq("s.Quote(0,0)", [300, true]),
    ],
    [
      setup("FareEngine", 101, 0, 0),
      yes("s.SetSurge(15000)"),
      eq("s.Quote(0,0)", [151, true]),
      no("s.SetSurge(9999)"),
      no("s.SetSurge(30001)"),
      eq("s.Quote(0,0)", [151, true]),
    ],
    [
      setup("FareEngine", 300, 100, 0),
      run("s.SetSurge(20000)"),
      yes('s.AddPromo("FIRST",500)'),
      no('s.AddPromo("FIRST",100)'),
      no('s.AddPromo("",1)'),
      no('s.AddPromo("BAD",0)'),
      eq('s.QuoteWithPromo(2,0,"FIRST")', [500, true]),
      run('s.AddPromo("FREE",9999)'),
      eq('s.QuoteWithPromo(0,0,"FREE")', [0, true]),
      eq('s.QuoteWithPromo(0,0,"unknown")', [0, false]),
    ],
  ],
  "trip-lifecycle": [
    [
      setup("TripService"),
      yes('s.Request("t1")'),
      no('s.Request("t1")'),
      no('s.Request("")'),
      yes('s.Assign("t1")'),
      no('s.Assign("t1")'),
      eq('s.State("t1")', ["assigned", true]),
      eq('s.State("missing")', ["", false]),
    ],
    [
      setup("TripService"),
      run('s.Request("t1")'),
      no('s.Start("t1")'),
      no('s.Complete("t1")'),
      run('s.Assign("t1")'),
      yes('s.Start("t1")'),
      no('s.Start("t1")'),
      yes('s.Complete("t1")'),
      no('s.Complete("t1")'),
      eq('s.State("t1")', ["completed", true]),
    ],
    [
      setup("TripService"),
      run('s.Request("t1")'),
      run('s.Assign("t1")'),
      yes('s.Cancel("t1")'),
      no('s.Cancel("t1")'),
      no('s.Start("t1")'),
      eq('s.History("t1")', ["requested", "assigned", "cancelled"]),
      assign("h", 's.History("t1")'),
      run('h[0] = "corrupt"'),
      eq('s.History("t1")', ["requested", "assigned", "cancelled"]),
      eq('s.History("missing")', []),
    ],
  ],
  "driver-availability": [
    [
      setup("Fleet"),
      yes('s.Online("d1","Recife")'),
      no('s.Online("d1","Rio")'),
      no('s.Online("","Rio")'),
      no('s.Online("d2","")'),
      eq('s.City("d1")', ["Recife", true]),
    ],
    [
      setup("Fleet"),
      run('s.Online("b","SP")'),
      run('s.Online("a","SP")'),
      run('s.Online("c","Rio")'),
      eq('s.Available("SP")', ["a", "b"]),
      yes('s.SetBusy("b",true)'),
      no('s.SetBusy("missing",true)'),
      eq('s.Available("SP")', ["a"]),
      eq('s.Available("missing")', []),
    ],
    [
      setup("Fleet"),
      run('s.Online("d","SP")'),
      run('s.SetBusy("d",true)'),
      yes('s.Move("d","Rio")'),
      no('s.Move("d","")'),
      no('s.Move("missing","Rio")'),
      eq('s.Available("Rio")', []),
      yes('s.Offline("d")'),
      no('s.Offline("d")'),
      eq('s.City("d")', ["", false]),
      run('s.Online("d","Rio")'),
      eq('s.Available("Rio")', ["d"]),
    ],
  ],
  "wallet-ledger": [
    [
      setup("Ledger"),
      yes('s.Create("ana")'),
      no('s.Create("ana")'),
      no('s.Create("")'),
      yes('s.Deposit("ana",500)'),
      no('s.Deposit("ana",0)'),
      no('s.Deposit("missing",10)'),
      eq('s.Balance("ana")', [500, true]),
    ],
    [
      setup("Ledger"),
      run('s.Create("ana")'),
      run('s.Deposit("ana",500)'),
      no('s.Withdraw("ana",600)'),
      no('s.Withdraw("ana",-1)'),
      no('s.Withdraw("missing",1)'),
      eq('s.Balance("ana")', [500, true]),
      yes('s.Withdraw("ana",500)'),
      eq('s.Balance("ana")', [0, true]),
    ],
    [
      setup("Ledger"),
      run('s.Create("ana")'),
      run('s.Create("bob")'),
      yes('s.Apply("op1","ana",100)'),
      yes('s.Apply("op1","ana",100)'),
      no('s.Apply("op1","bob",100)'),
      no('s.Apply("op1","ana",200)'),
      eq('s.Balance("ana")', [100, true]),
      no('s.Apply("retry","ana",-200)'),
      yes('s.Apply("retry","ana",50)'),
      no('s.Apply("","ana",1)'),
      no('s.Apply("zero","ana",0)'),
    ],
  ],
  "account-transfers": [
    [
      setup("Bank"),
      yes('s.Open("a",1000)'),
      no('s.Open("a",2)'),
      no('s.Open("",1)'),
      no('s.Open("b",-1)'),
      eq('s.Balance("a")', [1000, true]),
      eq('s.Balance("missing")', [0, false]),
    ],
    [
      setup("Bank"),
      run('s.Open("a",1000)'),
      run('s.Open("b",0)'),
      no('s.Transfer("x","a","b",1001)'),
      yes('s.Transfer("x","a","b",300)'),
      yes('s.Transfer("x","a","b",300)'),
      no('s.Transfer("x","a","b",200)'),
      no('s.Transfer("self","a","a",1)'),
      no('s.Transfer("","a","b",1)'),
      eq('s.Balance("a")', [700, true]),
      eq('s.Balance("b")', [300, true]),
    ],
    [
      setup("Bank"),
      run('s.Open("a",1000)'),
      run('s.Open("b",0)'),
      run('s.Open("c",0)'),
      run('s.Transfer("x","a","b",300)'),
      run('s.Transfer("y","b","c",200)'),
      no('s.Reverse("x")'),
      yes('s.Reverse("y")'),
      yes('s.Reverse("x")'),
      no('s.Reverse("x")'),
      no('s.Reverse("missing")'),
      yes('s.Transfer("x","a","b",300)'),
      eq('s.Balance("a")', [1000, true]),
    ],
  ],
  "card-limits": [
    [
      setup("Card", 1000),
      eq("s.Available()", 1000),
      yes('s.Authorize("p1",300)'),
      no('s.Authorize("p1",100)'),
      no('s.Authorize("p2",701)'),
      no('s.Authorize("",1)'),
      no('s.Authorize("zero",0)'),
      eq("s.Available()", 700),
    ],
    [
      setup("Card", 1000),
      run('s.Authorize("a",300)'),
      run('s.Authorize("b",200)'),
      yes('s.Capture("a")'),
      no('s.Capture("a")'),
      no('s.Void("a")'),
      yes('s.Void("b")'),
      no('s.Void("b")'),
      no('s.Capture("b")'),
      no('s.Authorize("b",1)'),
      eq("s.Available()", 700),
    ],
    [
      setup("Card", 1000),
      run('s.Authorize("a",300)'),
      no('s.Refund("a",1)'),
      run('s.Capture("a")'),
      yes('s.Refund("a",100)'),
      no('s.Refund("a",201)'),
      no('s.Refund("a",0)'),
      eq("s.Available()", 800),
      yes('s.Refund("a",200)'),
      no('s.Refund("a",1)'),
      eq("s.Available()", 1000),
    ],
  ],
  "transaction-history": [
    [
      setup("Statement"),
      assign("e", entry("a", 10, -500, "food")),
      yes("s.Add(e)"),
      no("s.Add(e)"),
      no(`s.Add(${entry("", 0, 1, "")})`),
      no(`s.Add(${entry("zero", 0, 0, "")})`),
      eq('s.Get("a")[1]', true),
      eq('s.Get("missing")[1]', false),
    ],
    [
      setup("Statement"),
      run(`s.Add(${entry("b", 2, 1, "food")})`),
      run(`s.Add(${entry("a", 2, 1, "food")})`),
      run(`s.Add(${entry("c", 3, 1, "travel")})`),
      eq('LEN(s.List(""))', 3),
      eq('s.List("")[0].ID', "c"),
      eq('s.List("")[1].ID', "a"),
      eq('s.List("")[2].ID', "b"),
      eq('LEN(s.List("food"))', 2),
      eq('s.List("missing")', []),
    ],
    [
      setup("Statement"),
      run(`s.Add(${entry("a", 3, 1, "")})`),
      run(`s.Add(${entry("b", 2, 1, "")})`),
      run(`s.Add(${entry("c", 1, 1, "")})`),
      eq('LEN(s.Page("",2))', 2),
      eq('s.Page("",2)[1].ID', "b"),
      eq('LEN(s.Page("b",2))', 1),
      eq('s.Page("b",2)[0].ID', "c"),
      eq('s.Page("c",2)', []),
      eq('s.Page("missing",2)', []),
      eq('s.Page("",0)', []),
    ],
  ],
  "in-memory-filesystem": [
    [
      setup("FileSystem"),
      yes('s.Write("/docs/a.txt","hello")'),
      no('s.Write("/","bad")'),
      no('s.Write("relative","bad")'),
      no('s.Write("/a/","bad")'),
      no('s.Write("/a//b","bad")'),
      no('s.Write("/a/../b","bad")'),
      no('s.Write("/./a","bad")'),
      eq('s.Read("/docs/a.txt")', ["hello", true]),
      run('s.Write("/docs/a.txt","")'),
      eq('s.Read("/docs/a.txt")', ["", true]),
    ],
    [
      setup("FileSystem"),
      run('s.Write("/a/z","1")'),
      run('s.Write("/a/x","2")'),
      run('s.Write("/ab/y","3")'),
      eq('s.List("/a")', ["/a/x", "/a/z"]),
      eq('LEN(s.List("/"))', 3),
      yes('s.Delete("/a/x")'),
      no('s.Delete("/a/x")'),
      no('s.Delete("/a")'),
    ],
    [
      setup("FileSystem"),
      run('s.Write("/a","one")'),
      run('s.Write("/b","two")'),
      no('s.Move("/a","/b")'),
      no('s.Move("/a","/a")'),
      no('s.Move("/a","bad")'),
      eq('s.Read("/a")', ["one", true]),
      yes('s.Move("/a","/new/c")'),
      eq('s.Read("/a")', ["", false]),
      eq('s.Read("/new/c")', ["one", true]),
    ],
  ],
  "rate-limiter": [
    [
      setup("Limiter", 2, 10),
      no('s.Allow("",0)'),
      no('s.Allow("a",-1)'),
      yes('s.Allow("a",0)'),
      yes('s.Allow("a",9)'),
      no('s.Allow("a",9)'),
      yes('s.Allow("b",9)'),
      yes('s.Allow("a",10)'),
    ],
    [
      setup("Limiter", 1, 10),
      yes('s.Allow("a",0)'),
      yes('s.SetLimit("a",2)'),
      yes('s.Allow("a",1)'),
      no('s.Allow("a",1)'),
      no('s.SetLimit("a",0)'),
      no('s.SetLimit("",2)'),
      no('s.Allow("a",2)'),
      yes('s.Allow("b",2)'),
      no('s.Allow("b",2)'),
      yes('s.Allow("a",10)'),
      yes('s.Allow("a",10)'),
    ],
    [
      setup("Limiter", 1, 10),
      eq('s.Remaining("a",0)', 1),
      eq('s.RetryAfter("a",0)', 0),
      yes('s.Allow("a",2)'),
      eq('s.Remaining("a",4)', 0),
      eq('s.RetryAfter("a",4)', 6),
      eq('s.Remaining("a",10)', 1),
      eq('s.RetryAfter("a",10)', 0),
      eq('s.Remaining("",10)', 0),
      eq('s.RetryAfter("",10)', 0),
    ],
  ],
};

api["parking-lot"] = [
  "ParkingLot",
  "capacity:n",
  [
    "Park|plate:s|b",
    "Leave|plate:s|b",
    "Available||n",
    "Ticket|plate:s|money",
    "Reserve|plate:s|b",
    "CancelReservation|plate:s|b",
  ],
];
api["multi-level-garage"] = [
  "Garage",
  "layout:strings",
  [
    "Park|plate:s,kind:s|pair",
    "Leave|plate:s|b",
    "Available||n",
    "Find|plate:s|pair",
    "Count|level:n|n",
    "Reserve|plate:s,kind:s|pair",
    "CheckIn|plate:s|b",
    "CancelReservation|plate:s|b",
  ],
];
tests["parking-lot"] = [
  [
    setup("ParkingLot", 2),
    eq("s.Available()", 2),
    no('s.Park("")'),
    yes('s.Park("A")'),
    no('s.Park("A")'),
    yes('s.Park("B")'),
    no('s.Park("C")'),
    eq("s.Available()", 0),
    yes('s.Leave("A")'),
    no('s.Leave("A")'),
    eq("s.Available()", 1),
  ],
  [
    setup("ParkingLot", 1),
    eq('s.Ticket("A")', [0, false]),
    run('s.Park("A")'),
    eq('s.Ticket("A")', [1, true]),
    no('s.Park("B")'),
    run('s.Leave("A")'),
    run('s.Park("B")'),
    eq('s.Ticket("B")', [2, true]),
    eq('s.Ticket("A")', [0, false]),
  ],
  [
    setup("ParkingLot", 1),
    yes('s.Reserve("A")'),
    eq("s.Available()", 0),
    eq('s.Ticket("A")', [0, false]),
    no('s.Park("B")'),
    yes('s.Park("A")'),
    eq('s.Ticket("A")', [1, true]),
    no('s.CancelReservation("A")'),
    yes('s.Leave("A")'),
    yes('s.Reserve("B")'),
    yes('s.CancelReservation("B")'),
    eq("s.Available()", 1),
  ],
];
tests["multi-level-garage"] = [
  [
    setup("Garage", '["L","SM"]'),
    eq("s.Available()", 3),
    eq('s.Park("A","motorcycle")', ["L2-S1", true]),
    eq('s.Park("B","car")', ["L2-S2", true]),
    eq('s.Park("C","truck")', ["L1-S1", true]),
    eq('s.Park("D","car")', ["", false]),
    yes('s.Leave("B")'),
    no('s.Leave("B")'),
    eq("s.Available()", 1),
  ],
  [
    setup("Garage", '["ML","S"]'),
    run('s.Park("A","car")'),
    eq('s.Find("A")', ["L1-S1", true]),
    eq('s.Find("missing")', ["", false]),
    eq("s.Count(1)", 1),
    eq("s.Count(2)", 0),
    eq("s.Count(0)", 0),
    eq("s.Count(3)", 0),
  ],
  [
    setup("Garage", '["SM"]'),
    eq('s.Reserve("A","car")', ["L1-S2", true]),
    eq('s.Find("A")', ["L1-S2", true]),
    eq("s.Available()", 1),
    no('s.Leave("A")'),
    yes('s.CheckIn("A")'),
    no('s.CheckIn("A")'),
    no('s.CancelReservation("A")'),
    yes('s.Leave("A")'),
    eq('s.Reserve("B","car")', ["L1-S2", true]),
    yes('s.CancelReservation("B")'),
    eq("s.Available()", 2),
  ],
];

const hidden: Record<string, Command[][]> = {
  "ride-dispatch": [
    [
      setup("Dispatcher"),
      yes('s.Register("negative",-10)'),
      eq("s.Count()", 1),
    ],
    [
      setup("Dispatcher"),
      run('s.Register("z",-9)'),
      run('s.Register("a",-1)'),
      eq("s.Nearest(-8)", ["z", true]),
    ],
    [
      setup("Dispatcher"),
      run('s.Register("a",0)'),
      run('s.Register("b",1)'),
      run("s.Assign(0)"),
      run("s.Assign(0)"),
      eq("s.Assign(0)", ["", false]),
      eq("s.Count()", 2),
    ],
  ],
  "fare-calculator": [
    [setup("FareEngine", 0, 0, 0), eq("s.Quote(0,0)", [0, true])],
    [
      setup("FareEngine", 7, 0, 0),
      yes("s.SetSurge(30000)"),
      eq("s.Quote(0,0)", [21, true]),
      yes("s.SetSurge(10000)"),
    ],
    [
      setup("FareEngine", 100, 0, 0),
      run('s.AddPromo("A",25)'),
      eq('s.QuoteWithPromo(-1,0,"A")', [0, false]),
      eq('s.QuoteWithPromo(0,0,"a")', [0, false]),
      eq('s.QuoteWithPromo(0,0,"A")', [75, true]),
      eq('s.QuoteWithPromo(0,0,"A")', [75, true]),
    ],
  ],
  "trip-lifecycle": [
    [
      setup("TripService"),
      no('s.Assign("missing")'),
      eq('s.State("missing")', ["", false]),
    ],
    [
      setup("TripService"),
      no('s.Start("missing")'),
      no('s.Complete("missing")'),
    ],
    [
      setup("TripService"),
      run('s.Request("t")'),
      run('s.Assign("t")'),
      run('s.Start("t")'),
      run('s.Complete("t")'),
      no('s.Cancel("t")'),
      eq('s.History("t")', [
        "requested",
        "assigned",
        "in_progress",
        "completed",
      ]),
    ],
  ],
  "driver-availability": [
    [
      setup("Fleet"),
      run('s.Online("a","SP")'),
      eq('s.City("missing")', ["", false]),
    ],
    [
      setup("Fleet"),
      run('s.Online("d","SP")'),
      run('s.SetBusy("d",true)'),
      run('s.SetBusy("d",false)'),
      eq('s.Available("SP")', ["d"]),
    ],
    [
      setup("Fleet"),
      run('s.Online("d","SP")'),
      run('s.Move("d","Rio")'),
      eq('s.Available("SP")', []),
      eq('s.Available("Rio")', ["d"]),
    ],
  ],
  "wallet-ledger": [
    [
      setup("Ledger"),
      run('s.Create("a")'),
      run('s.Create("b")'),
      run('s.Deposit("a",10)'),
      eq('s.Balance("b")', [0, true]),
    ],
    [
      setup("Ledger"),
      run('s.Create("a")'),
      no('s.Withdraw("a",1)'),
      eq('s.Balance("a")', [0, true]),
    ],
    [
      setup("Ledger"),
      run('s.Create("a")'),
      run('s.Deposit("a",100)'),
      yes('s.Apply("debit","a",-100)'),
      yes('s.Apply("debit","a",-100)'),
      eq('s.Balance("a")', [0, true]),
    ],
  ],
  "account-transfers": [
    [
      setup("Bank"),
      yes('s.Open("zero",0)'),
      eq('s.Balance("zero")', [0, true]),
    ],
    [
      setup("Bank"),
      run('s.Open("a",100)'),
      no('s.Transfer("x","a","missing",50)'),
      eq('s.Balance("a")', [100, true]),
      run('s.Open("b",0)'),
      yes('s.Transfer("x","a","b",100)'),
    ],
    [
      setup("Bank"),
      run('s.Open("a",100)'),
      run('s.Open("b",20)'),
      run('s.Transfer("x","a","b",100)'),
      yes('s.Reverse("x")'),
      eq('s.Balance("b")', [20, true]),
    ],
  ],
  "card-limits": [
    [
      setup("Card", 100),
      no('s.Authorize("p",101)'),
      yes('s.Authorize("p",100)'),
      eq("s.Available()", 0),
    ],
    [
      setup("Card", 100),
      no('s.Void("missing")'),
      no('s.Capture("missing")'),
      eq("s.Available()", 100),
    ],
    [
      setup("Card", 1000),
      run('s.Authorize("a",100)'),
      run('s.Authorize("b",200)'),
      run('s.Capture("a")'),
      run('s.Capture("b")'),
      yes('s.Refund("a",100)'),
      no('s.Refund("a",1)'),
      eq("s.Available()", 800),
    ],
  ],
  "transaction-history": [
    [
      setup("Statement"),
      assign("e", entry("a", -1, 5, "")),
      yes("s.Add(e)"),
      eq('s.Get("a")[0].Timestamp', -1),
    ],
    [
      setup("Statement"),
      run(`s.Add(${entry("a", 0, 1, "Food")})`),
      eq('s.List("food")', []),
      eq('LEN(s.List("Food"))', 1),
    ],
    [
      setup("Statement"),
      run(`s.Add(${entry("a", 0, 1, "")})`),
      assign("p", 's.Page("",100)'),
      eq("LEN(p)", 1),
      run('p[0].ID = "changed"'),
      eq('s.Page("",1)[0].ID', "a"),
    ],
  ],
  "in-memory-filesystem": [
    [
      setup("FileSystem"),
      yes('s.Write("/a","")'),
      eq('s.Read("/missing")', ["", false]),
      eq('s.Read("/a")', ["", true]),
    ],
    [
      setup("FileSystem"),
      run('s.Write("/a","one")'),
      run('s.Write("/a/b","two")'),
      eq('s.List("/a")', ["/a", "/a/b"]),
      yes('s.Delete("/a")'),
      eq('s.Read("/a/b")', ["two", true]),
    ],
    [
      setup("FileSystem"),
      run('s.Write("/a","one")'),
      run('s.Write("/a/b","two")'),
      run('s.Move("/a","/c")'),
      eq('s.Read("/a/b")', ["two", true]),
    ],
  ],
  "rate-limiter": [
    [
      setup("Limiter", 1, 10),
      yes('s.Allow("a",100)'),
      no('s.Allow("a",109)'),
      yes('s.Allow("a",110)'),
    ],
    [
      setup("Limiter", 3, 10),
      run('s.Allow("a",0)'),
      run('s.Allow("a",0)'),
      run('s.SetLimit("a",1)'),
      no('s.Allow("a",1)'),
      yes('s.Allow("a",10)'),
      no('s.Allow("a",10)'),
    ],
    [
      setup("Limiter", 1, 10),
      run('s.Allow("a",10)'),
      eq('s.RetryAfter("a",10)', 10),
      run('s.SetLimit("a",2)'),
      eq('s.RetryAfter("a",10)', 0),
      eq('s.Remaining("a",10)', 1),
    ],
  ],
  "parking-lot": [
    [setup("ParkingLot", 0), no('s.Park("A")'), eq("s.Available()", 0)],
    [
      setup("ParkingLot", 1),
      run('s.Park("A")'),
      run('s.Leave("A")'),
      run('s.Park("A")'),
      eq('s.Ticket("A")', [2, true]),
    ],
    [
      setup("ParkingLot", 1),
      yes('s.Reserve("A")'),
      no('s.Reserve("A")'),
      no('s.Reserve("B")'),
      yes('s.CancelReservation("A")'),
      no('s.CancelReservation("A")'),
    ],
  ],
  "multi-level-garage": [
    [
      setup("Garage", '["M","M"]'),
      eq('s.Park("A","car")', ["L1-S1", true]),
      eq('s.Park("A","car")', ["", false]),
      eq('s.Park("B","plane")', ["", false]),
    ],
    [
      setup("Garage", '["S"]'),
      run('s.Park("A","motorcycle")'),
      run('s.Leave("A")'),
      eq('s.Find("A")', ["", false]),
      eq("s.Count(1)", 0),
    ],
    [
      setup("Garage", '["L"]'),
      run('s.Reserve("A","truck")'),
      eq("s.Count(1)", 1),
      eq('s.Park("B","car")', ["", false]),
      yes('s.CancelReservation("A")'),
      eq('s.Find("A")', ["", false]),
    ],
  ],
};

const pyType: Record<string, string> = {
  s: "str",
  n: "int",
  b: "bool",
  entry: "Entry",
  strings: "list[str]",
};
const tsType: Record<string, string> = {
  s: "string",
  n: "number",
  b: "boolean",
  entry: "Entry",
  strings: "string[]",
};
const pyReturn: Record<string, [string, string]> = {
  b: ["bool", "False"],
  n: ["int", "0"],
  pair: ["tuple[str, bool]", '("", False)'],
  money: ["tuple[int, bool]", "(0, False)"],
  strings: ["list[str]", "[]"],
  entries: ["list[Entry]", "[]"],
  entrypair: ["tuple[Entry | None, bool]", "(None, False)"],
};
const tsReturn: Record<string, [string, string]> = {
  b: ["boolean", "false"],
  n: ["number", "0"],
  pair: ["[string, boolean]", '["", false]'],
  money: ["[number, boolean]", "[0, false]"],
  strings: ["string[]", "[]"],
  entries: ["Entry[]", "[]"],
  entrypair: ["[Entry | null, boolean]", "[null, false]"],
};
const params = (spec: string, python: boolean): string =>
  spec
    ? spec
        .split(",")
        .map((p) => {
          const [name, type] = p.split(":");
          return `${python && name === "from" ? "from_" : name}: ${(python ? pyType : tsType)[type]}`;
        })
        .join(", ")
    : "";
function starter(problem: PracticeProblem, python: boolean): string {
  const [name, args, methods] = api[problem.id];
  const isEntry = problem.id === "transaction-history";
  let result = python
    ? "# Implement the contracts one level at a time. No solution is included.\n"
    : "// Implement the contracts one level at a time. No solution is included.\n";
  if (isEntry)
    result += python
      ? "from dataclasses import dataclass\n\n@dataclass\nclass Entry:\n    ID: str\n    Timestamp: int\n    Cents: int\n    Category: str\n\n"
      : "export interface Entry { ID: string; Timestamp: number; Cents: number; Category: string }\nexport function Entry(ID: string, Timestamp: number, Cents: number, Category: string): Entry { return { ID, Timestamp, Cents, Category }; }\n\n";
  result += python
    ? `class ${name}:\n    def __init__(self${args ? ", " + params(args, true) : ""}) -> None:\n        pass\n\n`
    : `export class ${name} {\n  constructor(${params(args, false)}) {}\n`;
  for (const method of methods) {
    const [methodName, argumentsSpec, returns] = method.split("|");
    const [type, zero] = (python ? pyReturn : tsReturn)[returns];
    result += python
      ? `    def ${methodName}(self${argumentsSpec ? ", " + params(argumentsSpec, true) : ""}) -> ${type}:\n        return ${zero}\n\n`
      : `  ${methodName}(${params(argumentsSpec, false)}): ${type} { return ${zero}; }\n`;
  }
  const argNames = args
    ? args
        .split(",")
        .map((p) => p.split(":")[0])
        .join(", ")
    : "";
  result += python
    ? `\ndef New${name}(${params(args, true)}) -> ${name}:\n    return ${name}(${argNames})\n`
    : `}\n\nexport function New${name}(${params(args, false)}): ${name} { return new ${name}(${argNames}); }\n`;
  return result;
}
function expression(source: string, python: boolean): string {
  if (source.startsWith("LEN(")) {
    const inner = source.slice(4, -1);
    return python ? `len(${inner})` : `(${inner}).length`;
  }
  return python
    ? source.replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False")
    : source;
}
function testSource(
  problem: PracticeProblem,
  commands: Command[],
  level: number,
  python: boolean,
  isHidden: boolean,
): string {
  const [name] = api[problem.id];
  const imports = `New${name}${problem.id === "transaction-history" ? ", Entry" : ""}`;
  const label = `${isHidden ? "hidden" : "sample"}_level_${level}`;
  let result = python
    ? `import unittest\nfrom implementation import ${imports}\n\ndef normalize(value):\n    if isinstance(value, (tuple, list)):\n        return [normalize(item) for item in value]\n    return value\n\nclass Level${level}Tests(unittest.TestCase):\n    def test_${label}(self):\n`
    : `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { ${imports} } from './implementation.ts';\n\ntest('${label}', () => {\n`;
  for (const command of commands) {
    const expr = expression(command.expression, python);
    if (command.kind === "assign")
      result += python
        ? `        ${command.name} = ${expr}\n`
        : `  const ${command.name} = ${expr};\n`;
    if (command.kind === "run")
      result += python ? `        ${expr}\n` : `  ${expr};\n`;
    if (command.kind === "eq") {
      const value = JSON.stringify(command.expected);
      const expected = python
        ? value
            .replace(/\btrue\b/g, "True")
            .replace(/\bfalse\b/g, "False")
            .replace(/\bnull\b/g, "None")
        : value;
      result += python
        ? `        self.assertEqual(normalize(${expr}), ${expected})\n`
        : `  assert.deepEqual(${expr}, ${expected});\n`;
    }
  }
  result += python
    ? '\nif __name__ == "__main__":\n    unittest.main()\n'
    : "});\n";
  return result;
}

export function getFiles(
  problem: PracticeProblem,
  language: string = "go",
): PracticeFile[] {
  if (language === "go") return problem.files;
  if (language !== "python" && language !== "typescript")
    throw new Error(`Unsupported language: ${language}`);
  const python = language === "python";
  const files: PracticeFile[] = [
    {
      path: python ? "implementation.py" : "implementation.ts",
      content: starter(problem, python),
      readOnly: false,
    },
  ];
  for (let i = 0; i < 3; i++) {
    files.push({
      path: python ? `test_level_${i + 1}.py` : `level_${i + 1}.test.ts`,
      content: testSource(problem, tests[problem.id][i], i + 1, python, false),
      readOnly: true,
    });
    files.push({
      path: python
        ? `hidden_test_level_${i + 1}.py`
        : `hidden_level_${i + 1}.test.ts`,
      content: testSource(problem, hidden[problem.id][i], i + 1, python, true),
      readOnly: true,
      hidden: true,
    });
  }
  files.push({
    path: python ? "sandbox_test.py" : "sandbox.test.ts",
    readOnly: false,
    content: python
      ? "import unittest\n\n# Add your own edge-case assertions here.\nclass UserTests(unittest.TestCase):\n    def test_smoke(self):\n        self.assertTrue(True)\n"
      : "import test from 'node:test';\nimport assert from 'node:assert/strict';\n\n// Add your own edge-case assertions here.\ntest('user smoke', () => { assert.ok(true); });\n",
  });
  return files;
}
export function languageNotes(
  _problem: PracticeProblem,
  language: string,
): string {
  if (language === "python")
    return "Keep the PascalCase API names shown in the requirements. NewX(...) creates an instance. Go (value, bool) results become Python (value, bool) tuples; slices become lists. Use integer cents and timestamps. Entry uses Entry(ID, Timestamp, Cents, Category) with named attributes. Go from parameters are named from_ in Python.";
  if (language === "typescript")
    return "Keep the PascalCase API names shown in the requirements. NewX(...) creates an instance. Go (value, bool) results become TypeScript [value, boolean] tuples; slices become arrays. Use integer numbers for cents and timestamps (within safe integer range). Entry uses Entry(ID, Timestamp, Cents, Category) or an object with those fields. Tests import implementation.ts and run in Node 24 with type stripping.";
  return "Go uses the method signatures shown in each level. Money is integer cents; tests use deterministic time and no external services.";
}
