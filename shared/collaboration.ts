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

export const collaborationProblems: PracticeProblem[] = [
  {
    id: "task-checklist",
    title: "Task checklist",
    category: "Collaboration",
    difficulty: "Easy",
    duration: 30,
    packageName: "practice",
    summary:
      "Manage a small checklist with explicit completion, reopening, and sorted snapshots.",
    tags: ["Collections", "Validation", "Snapshots"],
    levels: [
      level(
        "Add tasks",
        "Keep distinct task IDs in a personal checklist.",
        [
          "NewChecklist() *Checklist starts empty. Add(id string) bool accepts a nonempty, unique, case-sensitive ID and creates an incomplete task. Invalid additions return false without changes.",
          "Count() int counts all tasks, including completed ones.",
        ],
        'Add("read"); Add("read"); Count()',
        "true; false; 1",
      ),
      level(
        "Complete and reopen",
        "Track a task's completion independently of membership.",
        [
          "SetDone(id string, done bool) bool updates a known task; setting the same value succeeds. Unknown IDs return false without changes.",
          "Done(id string) (bool, bool) returns (completed, true) for a known task and (false, false) otherwise. New tasks are incomplete.",
        ],
        'Add("read"); SetDone("read", true); Done("read")',
        "true; true; (true, true)",
      ),
      level(
        "Inspect and remove",
        "Return stable views of unfinished work.",
        [
          "Pending() []string returns incomplete task IDs in lexicographic order as a defensive snapshot. An empty result may be nil or empty in Go.",
          "Remove(id string) bool removes a known task regardless of completion. Unknown IDs return false. A removed ID may be added again and starts incomplete; failed calls never change membership or completion.",
        ],
        'Add("b"); Add("a"); SetDone("a",true); Pending(); Remove("a"); Count()',
        'true; true; true; ["b"]; true; 1',
      ),
    ],
    files: caseFiles(
      `type Checklist struct {}
func NewChecklist() *Checklist { return &Checklist{} }
func (c *Checklist) Add(id string) bool { return false }
func (c *Checklist) Count() int { return 0 }
func (c *Checklist) SetDone(id string, done bool) bool { return false }
func (c *Checklist) Done(id string) (bool, bool) { return false, false }
func (c *Checklist) Pending() []string { return nil }
func (c *Checklist) Remove(id string) bool { return false }`,
      [
        `c:=NewChecklist(); if c.Count()!=0 || c.Add("") || !c.Add("a") || c.Add("a") || c.Count()!=1 {t.Fatal("invalid membership")}`,
        `c:=NewChecklist(); c.Add("a"); if done,ok:=c.Done("a"); done || !ok {t.Fatal("new task incomplete")}; if !c.SetDone("a",true) || !c.SetDone("a",true) || c.SetDone("missing",false) {t.Fatal("update validation")}; if done,ok:=c.Done("a"); !done || !ok {t.Fatal("completion missing")}; if !c.SetDone("a",false) {t.Fatal("reopen failed")}`,
        `c:=NewChecklist(); c.Add("b"); c.Add("a"); ids:=c.Pending(); if len(ids)!=2 || ids[0]!="a" || ids[1]!="b" {t.Fatal("sorted pending")}; ids[0]="changed"; if c.Pending()[0]!="a" {t.Fatal("snapshot leaked")}; c.SetDone("a",true); if len(c.Pending())!=1 || !c.Remove("a") || c.Remove("a") || c.Count()!=1 {t.Fatal("remove or filter failed")}`,
      ],
      [
        `c:=NewChecklist(); if !c.Add("A") || !c.Add("a") || c.Count()!=2 {t.Fatal("case sensitive IDs")}`,
        `c:=NewChecklist(); if done,ok:=c.Done("unknown"); done || ok {t.Fatal("unknown task")}; c.Add("a"); c.SetDone("a",true); if c.Add("a") {t.Fatal("duplicate accepted")}; if done,_:=c.Done("a"); !done {t.Fatal("duplicate reset state")}`,
        `c:=NewChecklist(); if len(c.Pending())!=0 || c.Remove("unknown") {t.Fatal("empty checklist")}; c.Add("a"); c.SetDone("a",true); if len(c.Pending())!=0 || !c.Remove("a") || !c.Add("a") {t.Fatal("reuse failed")}; if done,ok:=c.Done("a"); done || !ok {t.Fatal("reuse retained completion")}`,
      ],
    ),
  },
  {
    id: "support-ticket-router",
    title: "Support ticket router",
    category: "Collaboration",
    difficulty: "Medium",
    duration: 50,
    packageName: "practice",
    summary:
      "Route support work to agents with available capacity, then close tickets without leaking assignments.",
    tags: ["Allocation", "Capacity", "State machine"],
    levels: [
      level(
        "Register agents",
        "Record each support agent's simultaneous ticket capacity.",
        [
          "NewTicketRouter() *TicketRouter starts empty. AddAgent(id string, capacity int) bool accepts a nonempty unique ID and positive capacity; invalid calls preserve state.",
          "Load(id string) (int, bool) returns the number of assigned open tickets for a known agent, initially zero; unknown IDs return (0, false). IDs are case sensitive.",
        ],
        'AddAgent("ana",2); Load("ana")',
        "true; (0, true)",
      ),
      level(
        "Assign tickets",
        "Select agents deterministically without exceeding capacity.",
        [
          'Assign(ticket string) (string, bool) accepts a nonempty globally unused ticket ID, selects an agent with load below capacity, and increments its load. Choose minimum current load, then lexicographically smallest agent ID. Return ("", false) on failure without consuming the ticket ID.',
          'Owner(ticket string) (string, bool) returns its assigned agent; unknown IDs return ("", false). Repeated assignment of the same ticket fails without changing any load.',
        ],
        'AddAgent("b",2); AddAgent("a",1); Assign("t1"); Assign("t2")',
        'true; true; ("a", true); ("b", true)',
      ),
      level(
        "Close and retain history",
        "Release capacity while retaining ticket identity.",
        [
          "Close(ticket string) bool closes an open assigned ticket and decrements exactly its owner's load. Unknown or already closed tickets return false without changes.",
          "Closed tickets retain their Owner and permanently consume their ID. Assign cannot reopen them. Other tickets and agents are unaffected by closing.",
        ],
        'AddAgent("a",1); Assign("t1"); Close("t1"); Owner("t1"); Assign("t2")',
        'true; ("a", true); true; ("a", true); ("a", true)',
      ),
    ],
    files: caseFiles(
      `type TicketRouter struct {}
func NewTicketRouter() *TicketRouter { return &TicketRouter{} }
func (r *TicketRouter) AddAgent(id string, capacity int) bool { return false }
func (r *TicketRouter) Load(id string) (int, bool) { return 0, false }
func (r *TicketRouter) Assign(ticket string) (string, bool) { return "", false }
func (r *TicketRouter) Owner(ticket string) (string, bool) { return "", false }
func (r *TicketRouter) Close(ticket string) bool { return false }`,
      [
        `r:=NewTicketRouter(); if r.AddAgent("",1) || r.AddAgent("bad",0) || !r.AddAgent("a",2) || r.AddAgent("a",9) {t.Fatal("registration validation")}; if n,ok:=r.Load("a"); !ok || n!=0 {t.Fatal("initial load")}`,
        `r:=NewTicketRouter(); r.AddAgent("b",2); r.AddAgent("a",1); if id,ok:=r.Assign("t1"); !ok || id!="a" {t.Fatal("tie ordering")}; if id,ok:=r.Assign("t2"); !ok || id!="b" {t.Fatal("capacity choice")}; if _,ok:=r.Assign("t1"); ok {t.Fatal("duplicate assigned")}; if id,ok:=r.Owner("t2"); !ok || id!="b" {t.Fatal("owner missing")}`,
        `r:=NewTicketRouter(); r.AddAgent("a",1); r.Assign("t1"); if !r.Close("t1") || r.Close("t1") || r.Close("missing") {t.Fatal("close validation")}; if n,_:=r.Load("a"); n!=0 {t.Fatal("capacity leaked")}; if id,ok:=r.Owner("t1"); !ok || id!="a" {t.Fatal("owner history lost")}; if _,ok:=r.Assign("t1"); ok {t.Fatal("closed ID reused")}; if _,ok:=r.Assign("t2"); !ok {t.Fatal("capacity not released")}`,
      ],
      [
        `r:=NewTicketRouter(); if n,ok:=r.Load("missing"); n!=0 || ok {t.Fatal("unknown load")}; if r.AddAgent("a",-1) || !r.AddAgent("a",1) || !r.AddAgent("A",1) {t.Fatal("validation or case sensitivity")}`,
        `r:=NewTicketRouter(); if _,ok:=r.Assign("t"); ok {t.Fatal("empty router")}; r.AddAgent("a",1); if _,ok:=r.Assign(""); ok {t.Fatal("empty ticket")}; if _,ok:=r.Assign("t"); !ok {t.Fatal("failed assignment consumed ID")}; if _,ok:=r.Assign("later"); ok {t.Fatal("capacity exceeded")}; r.AddAgent("b",1); if id,ok:=r.Assign("later"); !ok || id!="b" {t.Fatal("retry failed")}; if id,ok:=r.Owner("missing"); id!="" || ok {t.Fatal("unknown owner")}`,
        `r:=NewTicketRouter(); r.AddAgent("b",3); r.AddAgent("a",3); r.Assign("x"); r.Assign("y"); r.Close("x"); if id,ok:=r.Assign("z"); !ok || id!="a" {t.Fatal("least load after close")}; if n,_:=r.Load("b"); n!=1 {t.Fatal("close affected another agent")}`,
      ],
    ),
  },
  {
    id: "meeting-room-scheduler",
    title: "Meeting room scheduler",
    category: "Collaboration",
    difficulty: "Hard",
    duration: 70,
    packageName: "practice",
    summary:
      "Allocate rooms by capacity and interval availability, with cancellation and atomic rescheduling.",
    tags: ["Intervals", "Scheduling", "Atomicity"],
    levels: [
      level(
        "Register rooms",
        "Keep rooms and capacities in a deterministic directory.",
        [
          "NewRoomScheduler() *RoomScheduler starts empty. AddRoom(id string, capacity int) bool accepts a nonempty unique case-sensitive ID and positive capacity. Invalid calls preserve existing rooms.",
          "Capacity(id string) (int, bool) returns the registered capacity; unknown rooms return (0, false). All numeric inputs and comparisons fit in int and safe integers in TypeScript.",
        ],
        'AddRoom("blue",4); Capacity("blue")',
        "true; (4, true)",
      ),
      level(
        "Book non-overlapping meetings",
        "Allocate the smallest suitable room for a half-open interval.",
        [
          'Book(id string, people, start, end int) (string, bool) requires a nonempty unused active booking ID, people > 0, and 0 <= start < end. Pick an available room with capacity >= people, ordered by smallest capacity then lexicographically smallest ID. Return ("", false) on failure without changes or consuming the ID.',
          'Intervals are [start,end): meetings touching at endpoints do not overlap. Room(id string) (string, bool) returns the room for an active booking, or ("", false) if absent. No real clock or concurrency is involved.',
        ],
        'AddRoom("a",4); Book("m1",2,0,10); Book("m2",4,10,20)',
        'true; ("a", true); ("a", true)',
      ),
      level(
        "Cancel and reschedule atomically",
        "Change plans while preserving valid reservations on failure.",
        [
          'Cancel(id string) bool removes an active booking and frees its interval; unknown IDs return false. Cancelled IDs can be reused and Room returns ("", false) after cancellation.',
          "Reschedule(id string, people, start, end int) (string, bool) uses Book validation and room ordering but requires an active ID. Ignore the booking's old interval while finding a new room. Success atomically replaces room, interval, and people; failure preserves the entire old booking. Rescheduling to the same values succeeds.",
        ],
        'AddRoom("a",4); Book("m",2,0,10); Reschedule("m",2,5,15); Cancel("m")',
        'true; ("a", true); ("a", true); true',
      ),
    ],
    files: caseFiles(
      `type RoomScheduler struct {}
func NewRoomScheduler() *RoomScheduler { return &RoomScheduler{} }
func (s *RoomScheduler) AddRoom(id string, capacity int) bool { return false }
func (s *RoomScheduler) Capacity(id string) (int, bool) { return 0, false }
func (s *RoomScheduler) Book(id string, people, start, end int) (string, bool) { return "", false }
func (s *RoomScheduler) Room(id string) (string, bool) { return "", false }
func (s *RoomScheduler) Cancel(id string) bool { return false }
func (s *RoomScheduler) Reschedule(id string, people, start, end int) (string, bool) { return "", false }`,
      [
        `s:=NewRoomScheduler(); if s.AddRoom("",1) || s.AddRoom("bad",0) || !s.AddRoom("a",4) || s.AddRoom("a",9) {t.Fatal("room validation")}; if n,ok:=s.Capacity("a"); !ok || n!=4 {t.Fatal("capacity changed")}`,
        `s:=NewRoomScheduler(); s.AddRoom("b",4); s.AddRoom("a",4); s.AddRoom("large",8); if id,ok:=s.Book("m1",2,0,10); !ok || id!="a" {t.Fatal("room ordering")}; if id,ok:=s.Book("m2",4,10,20); !ok || id!="a" {t.Fatal("half-open boundary")}; if id,ok:=s.Book("m3",2,5,15); !ok || id!="b" {t.Fatal("overlap ignored")}; if _,ok:=s.Book("m1",1,30,40); ok {t.Fatal("duplicate booking")}; if id,ok:=s.Room("m3"); !ok || id!="b" {t.Fatal("room lookup")}`,
        `s:=NewRoomScheduler(); s.AddRoom("a",4); s.Book("m",2,0,10); if id,ok:=s.Reschedule("m",2,5,15); !ok || id!="a" {t.Fatal("self overlap")}; s.Book("other",2,15,20); if _,ok:=s.Reschedule("m",2,10,16); ok {t.Fatal("conflict accepted")}; if _,ok:=s.Book("probe",2,5,10); ok {t.Fatal("failed move lost old interval")}; if !s.Cancel("m") || s.Cancel("m") {t.Fatal("cancel validation")}; if _,ok:=s.Room("m"); ok {t.Fatal("cancelled booking retained")}; if _,ok:=s.Book("m",2,5,15); !ok {t.Fatal("ID or capacity not released")}`,
      ],
      [
        `s:=NewRoomScheduler(); if n,ok:=s.Capacity("missing"); n!=0 || ok {t.Fatal("unknown capacity")}; if s.AddRoom("a",-1) || !s.AddRoom("a",1) || !s.AddRoom("A",1) {t.Fatal("case sensitive validation")}`,
        `s:=NewRoomScheduler(); s.AddRoom("z",3); s.AddRoom("a",8); if id,ok:=s.Book("m",2,1,2); !ok || id!="z" {t.Fatal("capacity must precede ID")}; if _,ok:=s.Book("",1,0,1); ok {t.Fatal("empty ID")}; if _,ok:=s.Book("retry",0,0,1); ok {t.Fatal("zero attendees")}; if _,ok:=s.Book("retry",1,-1,1); ok {t.Fatal("negative start")}; if _,ok:=s.Book("retry",1,1,1); ok {t.Fatal("empty interval")}; if _,ok:=s.Book("retry",1,3,2); ok {t.Fatal("reversed interval")}; if _,ok:=s.Book("retry",9,0,1); ok {t.Fatal("insufficient capacity")}; if _,ok:=s.Book("retry",1,0,1); !ok {t.Fatal("failed booking consumed ID")}`,
        `s:=NewRoomScheduler(); s.AddRoom("a",2); s.AddRoom("b",8); s.Book("m",1,0,10); if _,ok:=s.Reschedule("missing",1,0,10); ok {t.Fatal("unknown move")}; if _,ok:=s.Reschedule("m",0,0,10); ok {t.Fatal("invalid move")}; if id,_:=s.Room("m"); id!="a" {t.Fatal("failed move changed owner")}; if id,ok:=s.Reschedule("m",5,0,10); !ok || id!="b" {t.Fatal("capacity move")}; if _,ok:=s.Book("free",2,0,10); !ok {t.Fatal("old room not freed")}; if id,ok:=s.Reschedule("m",5,0,10); !ok || id!="b" {t.Fatal("same values rejected")}; if s.Cancel("unknown") {t.Fatal("unknown cancellation")}`,
      ],
    ),
  },
];

export const collaborationApi: Record<string, [string, string, string[]]> = {
  "task-checklist": [
    "Checklist",
    "",
    [
      "Add|id:s|b",
      "Count||n",
      "SetDone|id:s,done:b|b",
      "Done|id:s|boolpair",
      "Pending||strings",
      "Remove|id:s|b",
    ],
  ],
  "support-ticket-router": [
    "TicketRouter",
    "",
    [
      "AddAgent|id:s,capacity:n|b",
      "Load|id:s|money",
      "Assign|ticket:s|pair",
      "Owner|ticket:s|pair",
      "Close|ticket:s|b",
    ],
  ],
  "meeting-room-scheduler": [
    "RoomScheduler",
    "",
    [
      "AddRoom|id:s,capacity:n|b",
      "Capacity|id:s|money",
      "Book|id:s,people:n,start:n,end:n|pair",
      "Room|id:s|pair",
      "Cancel|id:s|b",
      "Reschedule|id:s,people:n,start:n,end:n|pair",
    ],
  ],
};
export const collaborationTests: Record<string, Command[][]> = {
  "task-checklist": [
    [
      setup("NewChecklist()"),
      eq("s.Count()", 0),
      eq('s.Add("")', false),
      eq('s.Add("a")', true),
      eq('s.Add("a")', false),
      eq("s.Count()", 1),
    ],
    [
      setup("NewChecklist()"),
      run('s.Add("a")'),
      eq('s.Done("a")', [false, true]),
      eq('s.SetDone("a",true)', true),
      eq('s.SetDone("a",true)', true),
      eq('s.SetDone("missing",false)', false),
      eq('s.Done("a")', [true, true]),
      eq('s.SetDone("a",false)', true),
    ],
    [
      setup("NewChecklist()"),
      run('s.Add("b")'),
      run('s.Add("a")'),
      eq("s.Pending()", ["a", "b"]),
      { kind: "assign", name: "ids", expression: "s.Pending()" },
      run('ids[0] = "changed"'),
      eq("s.Pending()", ["a", "b"]),
      run('s.SetDone("a",true)'),
      eq("s.Pending()", ["b"]),
      eq('s.Remove("a")', true),
      eq('s.Remove("a")', false),
      eq("s.Count()", 1),
    ],
  ],
  "support-ticket-router": [
    [
      setup("NewTicketRouter()"),
      eq('s.AddAgent("",1)', false),
      eq('s.AddAgent("bad",0)', false),
      eq('s.AddAgent("a",2)', true),
      eq('s.AddAgent("a",9)', false),
      eq('s.Load("a")', [0, true]),
    ],
    [
      setup("NewTicketRouter()"),
      run('s.AddAgent("b",2)'),
      run('s.AddAgent("a",1)'),
      eq('s.Assign("t1")', ["a", true]),
      eq('s.Assign("t2")', ["b", true]),
      eq('s.Assign("t1")', ["", false]),
      eq('s.Owner("t2")', ["b", true]),
    ],
    [
      setup("NewTicketRouter()"),
      run('s.AddAgent("a",1)'),
      run('s.Assign("t1")'),
      eq('s.Close("t1")', true),
      eq('s.Close("t1")', false),
      eq('s.Close("missing")', false),
      eq('s.Load("a")', [0, true]),
      eq('s.Owner("t1")', ["a", true]),
      eq('s.Assign("t1")', ["", false]),
      eq('s.Assign("t2")', ["a", true]),
    ],
  ],
  "meeting-room-scheduler": [
    [
      setup("NewRoomScheduler()"),
      eq('s.AddRoom("",1)', false),
      eq('s.AddRoom("bad",0)', false),
      eq('s.AddRoom("a",4)', true),
      eq('s.AddRoom("a",9)', false),
      eq('s.Capacity("a")', [4, true]),
    ],
    [
      setup("NewRoomScheduler()"),
      run('s.AddRoom("b",4)'),
      run('s.AddRoom("a",4)'),
      run('s.AddRoom("large",8)'),
      eq('s.Book("m1",2,0,10)', ["a", true]),
      eq('s.Book("m2",4,10,20)', ["a", true]),
      eq('s.Book("m3",2,5,15)', ["b", true]),
      eq('s.Book("m1",1,30,40)', ["", false]),
      eq('s.Room("m3")', ["b", true]),
    ],
    [
      setup("NewRoomScheduler()"),
      run('s.AddRoom("a",4)'),
      run('s.Book("m",2,0,10)'),
      eq('s.Reschedule("m",2,5,15)', ["a", true]),
      run('s.Book("other",2,15,20)'),
      eq('s.Reschedule("m",2,10,16)', ["", false]),
      eq('s.Book("probe",2,5,10)', ["", false]),
      eq('s.Cancel("m")', true),
      eq('s.Cancel("m")', false),
      eq('s.Room("m")', ["", false]),
      eq('s.Book("m",2,5,15)', ["a", true]),
    ],
  ],
};
export const collaborationHidden: Record<string, Command[][]> = {
  "task-checklist": [
    [
      setup("NewChecklist()"),
      eq('s.Add("A")', true),
      eq('s.Add("a")', true),
      eq("s.Count()", 2),
    ],
    [
      setup("NewChecklist()"),
      eq('s.Done("unknown")', [false, false]),
      run('s.Add("a")'),
      run('s.SetDone("a",true)'),
      eq('s.Add("a")', false),
      eq('s.Done("a")', [true, true]),
    ],
    [
      setup("NewChecklist()"),
      eq("s.Pending()", []),
      eq('s.Remove("unknown")', false),
      run('s.Add("a")'),
      run('s.SetDone("a",true)'),
      eq("s.Pending()", []),
      eq('s.Remove("a")', true),
      eq('s.Add("a")', true),
      eq('s.Done("a")', [false, true]),
    ],
  ],
  "support-ticket-router": [
    [
      setup("NewTicketRouter()"),
      eq('s.Load("missing")', [0, false]),
      eq('s.AddAgent("a",-1)', false),
      eq('s.AddAgent("a",1)', true),
      eq('s.AddAgent("A",1)', true),
    ],
    [
      setup("NewTicketRouter()"),
      eq('s.Assign("t")', ["", false]),
      run('s.AddAgent("a",1)'),
      eq('s.Assign("")', ["", false]),
      eq('s.Assign("t")', ["a", true]),
      eq('s.Assign("later")', ["", false]),
      run('s.AddAgent("b",1)'),
      eq('s.Assign("later")', ["b", true]),
      eq('s.Owner("missing")', ["", false]),
    ],
    [
      setup("NewTicketRouter()"),
      run('s.AddAgent("b",3)'),
      run('s.AddAgent("a",3)'),
      run('s.Assign("x")'),
      run('s.Assign("y")'),
      run('s.Close("x")'),
      eq('s.Assign("z")', ["a", true]),
      eq('s.Load("b")', [1, true]),
    ],
  ],
  "meeting-room-scheduler": [
    [
      setup("NewRoomScheduler()"),
      eq('s.Capacity("missing")', [0, false]),
      eq('s.AddRoom("a",-1)', false),
      eq('s.AddRoom("a",1)', true),
      eq('s.AddRoom("A",1)', true),
    ],
    [
      setup("NewRoomScheduler()"),
      run('s.AddRoom("z",3)'),
      run('s.AddRoom("a",8)'),
      eq('s.Book("m",2,1,2)', ["z", true]),
      eq('s.Book("",1,0,1)', ["", false]),
      eq('s.Book("retry",0,0,1)', ["", false]),
      eq('s.Book("retry",1,-1,1)', ["", false]),
      eq('s.Book("retry",1,1,1)', ["", false]),
      eq('s.Book("retry",1,3,2)', ["", false]),
      eq('s.Book("retry",9,0,1)', ["", false]),
      eq('s.Book("retry",1,0,1)', ["z", true]),
    ],
    [
      setup("NewRoomScheduler()"),
      run('s.AddRoom("a",2)'),
      run('s.AddRoom("b",8)'),
      run('s.Book("m",1,0,10)'),
      eq('s.Reschedule("missing",1,0,10)', ["", false]),
      eq('s.Reschedule("m",0,0,10)', ["", false]),
      eq('s.Room("m")', ["a", true]),
      eq('s.Reschedule("m",5,0,10)', ["b", true]),
      eq('s.Book("free",2,0,10)', ["a", true]),
      eq('s.Reschedule("m",5,0,10)', ["b", true]),
      eq('s.Cancel("unknown")', false),
    ],
  ],
};
