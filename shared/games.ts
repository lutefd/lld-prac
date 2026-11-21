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

export const gamesProblems: PracticeProblem[] = [
  {
    id: "tic-tac-toe",
    title: "Tic-tac-toe",
    category: "Games",
    difficulty: "Easy",
    duration: 35,
    packageName: "practice",
    summary:
      "Validate turns on a square board, detect winners and draws, then support custom sizes and undo.",
    tags: ["Board game", "Validation", "State"],
    levels: [
      level(
        "Place marks on a 3×3 board",
        "Start with a classic board where X moves first.",
        [
          "NewTicTacToe(size, winLength int) *TicTacToe creates an empty size×size board when size >= 1 and 1 <= winLength <= size; otherwise treat the call as NewTicTacToe(3, 3). Cells are zero-indexed.",
          'Move(row, col int) bool places the current player\'s mark ("X" or "O") in an empty in-bounds cell and switches turns. Out-of-bounds, occupied, or finished-game calls return false without changes.',
          'Cell(row, col int) (string, bool) returns the mark or ("", false) when out of bounds. Empty cells return ("", true).',
        ],
        "NewTicTacToe(3, 3); Move(0, 0); Cell(0, 0); Move(0, 0)",
        'true; ("X", true); false',
      ),
      level(
        "Detect winners and draws",
        "Finish the game when a line wins or the board fills.",
        [
          'Winner() (string, bool) returns ("X", true) or ("O", true) after a completed winLength-in-a-row line (row, column, or either diagonal direction of consecutive cells). Otherwise return ("", false).',
          'Turn() string returns "X" or "O" for the next mover while the game is open; after a win or draw it returns the empty string.',
          "A draw occurs when every cell is filled and there is no winner. After a win or draw, further Move calls fail and Winner stays stable.",
        ],
        "Move(0,0); Move(1,0); Move(0,1); Move(1,1); Move(0,2); Winner()",
        'true; true; true; true; true; ("X", true)',
      ),
      level(
        "Custom boards and undo",
        "Support N×N with K-in-a-row and reverse the latest successful move.",
        [
          "Size and winLength from construction apply for the whole game. Winning lines may be any contiguous winLength cells in a row, column, or diagonal.",
          "Undo() bool removes the most recent successful Move, restoring the prior mark and turn, and returns true. With no moves to undo, or after you have undone everything available, return false. Undo may reopen a finished game.",
          "There is no redo. Cell snapshots from queries are independent of later moves. There is no wall clock or concurrency.",
        ],
        "NewTicTacToe(3, 3); Move(1,1); Undo(); Cell(1,1); Turn()",
        'true; true; ("", true); "X"',
      ),
    ],
    files: caseFiles(
      `type TicTacToe struct {}
func NewTicTacToe(size, winLength int) *TicTacToe { return &TicTacToe{} }
func (g *TicTacToe) Move(row, col int) bool { return false }
func (g *TicTacToe) Cell(row, col int) (string, bool) { return "", false }
func (g *TicTacToe) Winner() (string, bool) { return "", false }
func (g *TicTacToe) Turn() string { return "" }
func (g *TicTacToe) Undo() bool { return false }`,
      [
        `s:=NewTicTacToe(3,3); if !s.Move(0,0) || s.Move(0,0) || s.Move(-1,0) || s.Move(0,3) {t.Fatal("move validation incorrect")}; if v,ok:=s.Cell(0,0); !ok || v!="X" {t.Fatal("first mark must be X")}; if v,ok:=s.Cell(0,1); !ok || v!="" {t.Fatal("empty cell wrong")}; if _,ok:=s.Cell(3,0); ok {t.Fatal("out of bounds treated as present")}`,
        `s:=NewTicTacToe(3,3); s.Move(0,0); s.Move(1,0); s.Move(0,1); s.Move(1,1); if !s.Move(0,2) {t.Fatal("winning move rejected")}; if w,ok:=s.Winner(); !ok || w!="X" || s.Turn()!="" || s.Move(2,2) {t.Fatal("winner or lock incorrect")}; d:=NewTicTacToe(3,3); d.Move(0,0); d.Move(1,1); d.Move(0,1); d.Move(0,2); d.Move(2,0); d.Move(1,0); d.Move(1,2); d.Move(2,1); d.Move(2,2); if w,ok:=d.Winner(); ok || w!="" || d.Turn()!="" {t.Fatal("draw not detected")}`,
        `s:=NewTicTacToe(4,3); if !s.Move(0,0) || !s.Move(1,0) || !s.Move(0,1) || !s.Move(1,1) || !s.Move(0,2) {t.Fatal("custom board moves failed")}; if w,ok:=s.Winner(); !ok || w!="X" {t.Fatal("k-in-a-row failed")}; u:=NewTicTacToe(3,3); u.Move(1,1); if !u.Undo() || u.Undo() {t.Fatal("undo stack incorrect")}; if v,ok:=u.Cell(1,1); !ok || v!="" || u.Turn()!="X" {t.Fatal("undo did not restore state")}`,
      ],
      [
        `s:=NewTicTacToe(0,0); if !s.Move(0,0) || !s.Move(1,1) {t.Fatal("invalid size must fall back to 3x3")}; if v,_:=s.Cell(0,0); v!="X" {t.Fatal("fallback board wrong")}; if _,ok:=s.Cell(-1,-1); ok {t.Fatal("negative bounds accepted")}`,
        `s:=NewTicTacToe(3,3); s.Move(0,0); s.Move(0,1); s.Move(1,0); s.Move(0,2); s.Move(2,0); if w,ok:=s.Winner(); !ok || w!="X" || s.Move(1,1) {t.Fatal("column win incorrect")}; s2:=NewTicTacToe(3,3); s2.Move(0,0); s2.Move(0,1); s2.Move(1,1); s2.Move(0,2); s2.Move(2,2); if w,ok:=s2.Winner(); !ok || w!="X" {t.Fatal("diagonal win incorrect")}`,
        `s:=NewTicTacToe(3,3); s.Move(0,0); s.Move(1,0); s.Move(0,1); s.Move(1,1); s.Move(0,2); if !s.Undo() || s.Turn()!="X" {t.Fatal("undo after win failed")}; if w,ok:=s.Winner(); ok || w!="" {t.Fatal("undo must clear winner")}; if !s.Move(2,2) {t.Fatal("reopened game blocked")}; if w,ok:=s.Winner(); ok || w!="" {t.Fatal("partial board should have no winner")}`,
      ],
    ),
  },
  {
    id: "snakes-and-ladders",
    title: "Snakes and ladders",
    category: "Games",
    difficulty: "Medium",
    duration: 50,
    packageName: "practice",
    summary:
      "Advance players with supplied dice rolls, apply snakes and ladders, and enforce exact-finish turn order.",
    tags: ["Board game", "Turn order", "Deterministic input"],
    levels: [
      level(
        "Register players on a numbered board",
        "Squares run from 1 to size; players begin off the board at 0.",
        [
          "NewBoard(size int) *Board creates a board with size >= 1 squares. Nonpositive size is treated as 1.",
          "AddPlayer(id string) bool registers a nonempty unique case-sensitive player at position 0 in join order. Duplicates and empty IDs return false.",
          "Position(id string) (int, bool) returns the square or (0, false) for unknown players. Players() []string returns join-order IDs as a defensive copy.",
        ],
        'NewBoard(10); AddPlayer("ana"); Position("ana"); Players()',
        'true; (0, true); ["ana"]',
      ),
      level(
        "Roll, slide, and finish exactly",
        "Moves use caller-supplied dice values; snakes and ladders teleport instantly.",
        [
          "AddSnake(from, to int) bool requires 1 <= to < from <= size and that from is unused by another snake or ladder head. AddLadder(from, to int) bool requires 1 <= from < to <= size with the same uniqueness. Invalid calls return false.",
          "Move(id string, dice int) bool advances a known player by a positive dice value when position+dice <= size. Landing on a snake or ladder head teleports to its destination once. Nonpositive dice or overshooting size leaves position unchanged and returns false.",
          'A player whose position equals size has finished. Winner() (string, bool) returns the first finisher in join order, or ("", false) if none. Finished players reject further Move calls.',
        ],
        'AddPlayer("ana"); AddLadder(2,5); Move("ana",2); Position("ana")',
        "true; true; true; (5, true)",
      ),
      level(
        "Enforce turn order",
        "Only the current player may move; turns advance after each attempt.",
        [
          "Current() (string, bool) returns the next player to move among unfinished players in join order, wrapping as needed. When every player has finished or none exist, return (\"\", false).",
          "Play(dice int) bool applies Move to Current() with the same dice rules. After a successful Move or an overshoot rejection by the current player, the turn passes to the next unfinished player in join order. Nonpositive dice returns false without advancing the turn. Move by a non-current player returns false without changes or turn advancement.",
          "Winner still reports the earliest finisher. There is no real randomness, wall clock, or concurrency.",
        ],
        'AddPlayer("ana"); AddPlayer("bob"); Play(1); Current()',
        'true; true; true; ("bob", true)',
      ),
    ],
    files: caseFiles(
      `type Board struct {}
func NewBoard(size int) *Board { return &Board{} }
func (b *Board) AddPlayer(id string) bool { return false }
func (b *Board) Players() []string { return nil }
func (b *Board) Position(id string) (int, bool) { return 0, false }
func (b *Board) AddSnake(from, to int) bool { return false }
func (b *Board) AddLadder(from, to int) bool { return false }
func (b *Board) Move(id string, dice int) bool { return false }
func (b *Board) Winner() (string, bool) { return "", false }
func (b *Board) Current() (string, bool) { return "", false }
func (b *Board) Play(dice int) bool { return false }`,
      [
        `s:=NewBoard(10); if !s.AddPlayer("ana") || s.AddPlayer("ana") || s.AddPlayer("") {t.Fatal("player registration incorrect")}; if p,ok:=s.Position("ana"); !ok || p!=0 {t.Fatal("start position wrong")}; ids:=s.Players(); if len(ids)!=1 || ids[0]!="ana" {t.Fatal("players snapshot wrong")}; ids[0]="x"; if s.Players()[0]!="ana" {t.Fatal("players leaked")}`,
        `s:=NewBoard(10); s.AddPlayer("ana"); if !s.AddLadder(2,8) || s.AddLadder(2,9) || s.AddSnake(2,1) || !s.AddSnake(9,3) || s.AddSnake(9,1) {t.Fatal("snake/ladder validation incorrect")}; if !s.Move("ana",2) {t.Fatal("ladder move failed")}; if p,_:=s.Position("ana"); p!=8 {t.Fatal("ladder not applied")}; if s.Move("ana",3) || s.Move("ana",0) || s.Move("ana",7) {t.Fatal("overshoot or bad dice accepted")}; if !s.Move("ana",1) {t.Fatal("snake move failed")}; if p,_:=s.Position("ana"); p!=3 {t.Fatal("snake not applied")}; if !s.Move("ana",7) {t.Fatal("exact finish failed")}; if w,ok:=s.Winner(); !ok || w!="ana" || s.Move("ana",1) {t.Fatal("winner lock incorrect")}`,
        `s:=NewBoard(5); s.AddPlayer("ana"); s.AddPlayer("bob"); if cur,ok:=s.Current(); !ok || cur!="ana" {t.Fatal("first turn wrong")}; if s.Move("bob",1) || !s.Play(1) {t.Fatal("turn enforcement wrong")}; if cur,ok:=s.Current(); !ok || cur!="bob" {t.Fatal("turn did not advance")}; if s.Play(6) {t.Fatal("overshoot must fail")}; if cur,ok:=s.Current(); !ok || cur!="ana" {t.Fatal("turn after reject wrong")}; if !s.Play(4) {t.Fatal("finish move failed")}; if w,ok:=s.Winner(); !ok || w!="ana" {t.Fatal("winner wrong")}; if cur,ok:=s.Current(); !ok || cur!="bob" {t.Fatal("finished player must leave rotation")}`,
      ],
      [
        `s:=NewBoard(0); if !s.AddPlayer("a") || !s.AddPlayer("A") {t.Fatal("size fallback or case sensitivity wrong")}; if p,_:=s.Position("a"); p!=0 {t.Fatal("tiny board start wrong")}; if _,ok:=s.Position("missing"); ok {t.Fatal("unknown position ok")}`,
        `s:=NewBoard(6); s.AddPlayer("a"); if s.AddLadder(1,1) || s.AddLadder(0,2) || s.AddLadder(5,7) || s.AddSnake(3,3) || s.AddSnake(1,0) {t.Fatal("invalid portals accepted")}; if !s.AddLadder(1,3) || !s.Move("a",1) {t.Fatal("portal move failed")}; if p,_:=s.Position("a"); p!=3 {t.Fatal("single hop expected")}; if !s.Move("a",3) {t.Fatal("exact size finish failed")}; if w,ok:=s.Winner(); !ok || w!="a" {t.Fatal("finish winner wrong")}`,
        `s:=NewBoard(4); s.AddPlayer("b"); s.AddPlayer("a"); if !s.Play(1) || !s.Play(1) || !s.Play(1) || !s.Play(1) {t.Fatal("alternating turns failed")}; if p,_:=s.Position("b"); p!=2 {t.Fatal("b progress wrong")}; if p,_:=s.Position("a"); p!=2 {t.Fatal("a progress wrong")}; if s.Play(0) {t.Fatal("zero dice accepted")}; if cur,ok:=s.Current(); !ok || cur!="b" {t.Fatal("invalid play must still rotate")}; if !s.Play(2) || !s.Play(2) {t.Fatal("finish sequence failed")}; if w,ok:=s.Winner(); !ok || w!="b" {t.Fatal("first finisher must win")}; if _,ok:=s.Current(); ok {t.Fatal("no unfinished players remain")}`,
      ],
    ),
  },
  {
    id: "leaderboard",
    title: "Competitive leaderboard",
    category: "Games",
    difficulty: "Medium",
    duration: 45,
    packageName: "practice",
    summary:
      "Accumulate scores, answer top-K and rank queries with deterministic ties, and remove or clear players.",
    tags: ["Ranking", "Ties", "Keyed state"],
    levels: [
      level(
        "Accumulate scores",
        "Players appear when they first receive points.",
        [
          "NewLeaderboard() *Leaderboard starts empty. AddScore(player string, points int) bool adds positive points to a nonempty case-sensitive player, creating the player at that score when new. Nonpositive points or empty names return false without changes.",
          "Score(player string) (int, bool) returns the total or (0, false) when unknown. Totals fit in int and the TypeScript safe integer range.",
        ],
        'AddScore("ana", 5); AddScore("ana", 3); Score("ana")',
        "true; true; (8, true)",
      ),
      level(
        "Top-K and ranks",
        "Order by score descending, then name ascending.",
        [
          "Top(k int) []string returns up to k player names in ranking order. Nonpositive k yields an empty result. Return a defensive copy.",
          "Rank(player string) (int, bool) returns a 1-based competition rank: one plus the number of players with a strictly higher score. Tied scores share a rank. Unknown players return (0, false).",
        ],
        'AddScore("zoe",10); AddScore("ana",10); AddScore("bob",2); Top(2); Rank("bob")',
        'true; true; true; ["ana", "zoe"]; (3, true)',
      ),
      level(
        "Remove players and clear",
        "Delete individuals or wipe the board.",
        [
          "Remove(player string) bool deletes an existing player and returns true; unknown names return false.",
          "Clear() bool removes every player and returns true even when already empty. After Remove or Clear, ranks and Top reflect only remaining players. Removed names may receive AddScore again as new players.",
        ],
        'AddScore("ana",5); Remove("ana"); Score("ana"); Clear()',
        "true; true; (0, false); true",
      ),
    ],
    files: caseFiles(
      `type Leaderboard struct {}
func NewLeaderboard() *Leaderboard { return &Leaderboard{} }
func (l *Leaderboard) AddScore(player string, points int) bool { return false }
func (l *Leaderboard) Score(player string) (int, bool) { return 0, false }
func (l *Leaderboard) Top(k int) []string { return nil }
func (l *Leaderboard) Rank(player string) (int, bool) { return 0, false }
func (l *Leaderboard) Remove(player string) bool { return false }
func (l *Leaderboard) Clear() bool { return false }`,
      [
        `s:=NewLeaderboard(); if !s.AddScore("ana",5) || !s.AddScore("ana",3) || s.AddScore("ana",0) || s.AddScore("",1) || s.AddScore("bob",-1) {t.Fatal("score validation incorrect")}; if n,ok:=s.Score("ana"); !ok || n!=8 {t.Fatal("accumulation failed")}; if _,ok:=s.Score("missing"); ok {t.Fatal("unknown score ok")}`,
        `s:=NewLeaderboard(); s.AddScore("zoe",10); s.AddScore("ana",10); s.AddScore("bob",2); top:=s.Top(2); if len(top)!=2 || top[0]!="ana" || top[1]!="zoe" {t.Fatal("top order incorrect")}; top[0]="x"; if s.Top(2)[0]!="ana" {t.Fatal("top leaked")}; if r,ok:=s.Rank("ana"); !ok || r!=1 {t.Fatal("tied rank must share 1")}; if r,ok:=s.Rank("zoe"); !ok || r!=1 {t.Fatal("tie partner rank wrong")}; if r,ok:=s.Rank("bob"); !ok || r!=3 {t.Fatal("competition rank wrong")}; if len(s.Top(0))!=0 || len(s.Top(-1))!=0 {t.Fatal("nonpositive top")}`,
        `s:=NewLeaderboard(); s.AddScore("ana",5); s.AddScore("bob",7); if !s.Remove("ana") || s.Remove("ana") {t.Fatal("remove incorrect")}; if _,ok:=s.Score("ana"); ok {t.Fatal("removed still present")}; if r,_:=s.Rank("bob"); r!=1 {t.Fatal("rank after remove wrong")}; if !s.Clear() || len(s.Top(5))!=0 || s.Remove("bob") {t.Fatal("clear incomplete")}; if !s.AddScore("ana",1) {t.Fatal("re-add after remove failed")}`,
      ],
      [
        `s:=NewLeaderboard(); if !s.AddScore("A",1) || !s.AddScore("a",2) {t.Fatal("case sensitivity wrong")}; if n,_:=s.Score("A"); n!=1 {t.Fatal("scores mixed")}; if s.AddScore("A",0) {t.Fatal("zero accepted")}`,
        `s:=NewLeaderboard(); s.AddScore("b",5); s.AddScore("a",5); s.AddScore("c",5); if r,_:=s.Rank("c"); r!=1 {t.Fatal("three-way tie rank")}; top:=s.Top(10); if len(top)!=3 || top[0]!="a" || top[1]!="b" || top[2]!="c" {t.Fatal("tie break by name")}; if _,ok:=s.Rank("missing"); ok {t.Fatal("missing rank ok")}`,
        `s:=NewLeaderboard(); s.AddScore("x",9); s.Remove("x"); s.AddScore("x",4); if n,ok:=s.Score("x"); !ok || n!=4 {t.Fatal("recreated score wrong")}; s.AddScore("y",4); if !s.Clear() || !s.Clear() || len(s.Top(1))!=0 {t.Fatal("double clear wrong")}; if _,ok:=s.Rank("y"); ok {t.Fatal("cleared rank remains")}`,
      ],
    ),
  },
];

export const gamesApi: Record<string, [string, string, string[]]> = {
  "tic-tac-toe": [
    "TicTacToe",
    "size:n,winLength:n",
    [
      "Move|row:n,col:n|b",
      "Cell|row:n,col:n|pair",
      "Winner||pair",
      "Turn||s",
      "Undo||b",
    ],
  ],
  "snakes-and-ladders": [
    "Board",
    "size:n",
    [
      "AddPlayer|id:s|b",
      "Players||strings",
      "Position|id:s|money",
      "AddSnake|from:n,to:n|b",
      "AddLadder|from:n,to:n|b",
      "Move|id:s,dice:n|b",
      "Winner||pair",
      "Current||pair",
      "Play|dice:n|b",
    ],
  ],
  "leaderboard": [
    "Leaderboard",
    "",
    [
      "AddScore|player:s,points:n|b",
      "Score|player:s|money",
      "Top|k:n|strings",
      "Rank|player:s|money",
      "Remove|player:s|b",
      "Clear||b",
    ],
  ],
};
export const gamesTests: Record<string, Command[][]> = {
  "tic-tac-toe": [
    [
      setup("NewTicTacToe(3,3)"),
      eq("s.Move(0,0)", true),
      eq("s.Move(0,0)", false),
      eq("s.Move(-1,0)", false),
      eq("s.Move(0,3)", false),
      eq("s.Cell(0,0)", ["X", true]),
      eq("s.Cell(0,1)", ["", true]),
      eq("s.Cell(3,0)", ["", false]),
    ],
    [
      setup("NewTicTacToe(3,3)"),
      run("s.Move(0,0)"),
      run("s.Move(1,0)"),
      run("s.Move(0,1)"),
      run("s.Move(1,1)"),
      eq("s.Move(0,2)", true),
      eq("s.Winner()", ["X", true]),
      eq("s.Turn()", ""),
      eq("s.Move(2,2)", false),
    ],
    [
      setup("NewTicTacToe(4,3)"),
      eq("s.Move(0,0)", true),
      eq("s.Move(1,0)", true),
      eq("s.Move(0,1)", true),
      eq("s.Move(1,1)", true),
      eq("s.Move(0,2)", true),
      eq("s.Winner()", ["X", true]),
      run("s.Undo()"),
      run("s.Undo()"),
      run("s.Undo()"),
      run("s.Undo()"),
      run("s.Undo()"),
      eq("s.Undo()", false),
      eq("s.Turn()", "X"),
      eq("s.Move(1,1)", true),
      eq("s.Undo()", true),
      eq("s.Cell(1,1)", ["", true]),
      eq("s.Turn()", "X"),
    ],
  ],
  "snakes-and-ladders": [
    [
      setup("NewBoard(10)"),
      eq('s.AddPlayer("ana")', true),
      eq('s.AddPlayer("ana")', false),
      eq('s.AddPlayer("")', false),
      eq('s.Position("ana")', [0, true]),
      eq("s.Players()", ["ana"]),
      { kind: "assign", name: "ids", expression: "s.Players()" },
      run('ids[0] = "x"'),
      eq("s.Players()", ["ana"]),
    ],
    [
      setup("NewBoard(10)"),
      run('s.AddPlayer("ana")'),
      eq("s.AddLadder(2,8)", true),
      eq("s.AddLadder(2,9)", false),
      eq("s.AddSnake(2,1)", false),
      eq("s.AddSnake(9,3)", true),
      eq("s.AddSnake(9,1)", false),
      eq('s.Move("ana",2)', true),
      eq('s.Position("ana")', [8, true]),
      eq('s.Move("ana",3)', false),
      eq('s.Move("ana",0)', false),
      eq('s.Move("ana",7)', false),
      eq('s.Move("ana",1)', true),
      eq('s.Position("ana")', [3, true]),
      eq('s.Move("ana",7)', true),
      eq("s.Winner()", ["ana", true]),
      eq('s.Move("ana",1)', false),
    ],
    [
      setup("NewBoard(5)"),
      run('s.AddPlayer("ana")'),
      run('s.AddPlayer("bob")'),
      eq("s.Current()", ["ana", true]),
      eq('s.Move("bob",1)', false),
      eq("s.Play(1)", true),
      eq("s.Current()", ["bob", true]),
      eq("s.Play(6)", false),
      eq("s.Current()", ["ana", true]),
      eq("s.Play(4)", true),
      eq("s.Winner()", ["ana", true]),
      eq("s.Current()", ["bob", true]),
    ],
  ],
  "leaderboard": [
    [
      setup("NewLeaderboard()"),
      eq('s.AddScore("ana",5)', true),
      eq('s.AddScore("ana",3)', true),
      eq('s.AddScore("ana",0)', false),
      eq('s.AddScore("",1)', false),
      eq('s.AddScore("bob",-1)', false),
      eq('s.Score("ana")', [8, true]),
      eq('s.Score("missing")', [0, false]),
    ],
    [
      setup("NewLeaderboard()"),
      run('s.AddScore("zoe",10)'),
      run('s.AddScore("ana",10)'),
      run('s.AddScore("bob",2)'),
      eq("s.Top(2)", ["ana", "zoe"]),
      { kind: "assign", name: "top", expression: "s.Top(2)" },
      run('top[0] = "x"'),
      eq("s.Top(2)", ["ana", "zoe"]),
      eq('s.Rank("ana")', [1, true]),
      eq('s.Rank("zoe")', [1, true]),
      eq('s.Rank("bob")', [3, true]),
      eq("s.Top(0)", []),
      eq("s.Top(-1)", []),
    ],
    [
      setup("NewLeaderboard()"),
      run('s.AddScore("ana",5)'),
      run('s.AddScore("bob",7)'),
      eq('s.Remove("ana")', true),
      eq('s.Remove("ana")', false),
      eq('s.Score("ana")', [0, false]),
      eq('s.Rank("bob")', [1, true]),
      eq("s.Clear()", true),
      eq("s.Top(5)", []),
      eq('s.Remove("bob")', false),
      eq('s.AddScore("ana",1)', true),
    ],
  ],
};
export const gamesHidden: Record<string, Command[][]> = {
  "tic-tac-toe": [
    [
      setup("NewTicTacToe(0,0)"),
      eq("s.Move(0,0)", true),
      eq("s.Move(1,1)", true),
      eq("s.Cell(0,0)", ["X", true]),
      eq("s.Cell(-1,-1)", ["", false]),
    ],
    [
      setup("NewTicTacToe(3,3)"),
      run("s.Move(0,0)"),
      run("s.Move(0,1)"),
      run("s.Move(1,0)"),
      run("s.Move(0,2)"),
      run("s.Move(2,0)"),
      eq("s.Winner()", ["X", true]),
      eq("s.Move(1,1)", false),
    ],
    [
      setup("NewTicTacToe(3,3)"),
      run("s.Move(0,0)"),
      run("s.Move(1,0)"),
      run("s.Move(0,1)"),
      run("s.Move(1,1)"),
      run("s.Move(0,2)"),
      eq("s.Undo()", true),
      eq("s.Turn()", "X"),
      eq("s.Winner()", ["", false]),
      eq("s.Move(2,2)", true),
      eq("s.Winner()", ["", false]),
    ],
  ],
  "snakes-and-ladders": [
    [
      setup("NewBoard(0)"),
      eq('s.AddPlayer("a")', true),
      eq('s.AddPlayer("A")', true),
      eq('s.Position("a")', [0, true]),
      eq('s.Position("missing")', [0, false]),
    ],
    [
      setup("NewBoard(6)"),
      run('s.AddPlayer("a")'),
      eq("s.AddLadder(1,1)", false),
      eq("s.AddLadder(0,2)", false),
      eq("s.AddLadder(5,7)", false),
      eq("s.AddSnake(3,3)", false),
      eq("s.AddSnake(1,0)", false),
      eq("s.AddLadder(1,3)", true),
      eq('s.Move("a",1)', true),
      eq('s.Position("a")', [3, true]),
      eq('s.Move("a",3)', true),
      eq("s.Winner()", ["a", true]),
    ],
    [
      setup("NewBoard(4)"),
      run('s.AddPlayer("b")'),
      run('s.AddPlayer("a")'),
      eq("s.Play(1)", true),
      eq("s.Play(1)", true),
      eq("s.Play(1)", true),
      eq("s.Play(1)", true),
      eq('s.Position("b")', [2, true]),
      eq('s.Position("a")', [2, true]),
      eq("s.Play(0)", false),
      eq("s.Current()", ["b", true]),
      eq("s.Play(2)", true),
      eq("s.Play(2)", true),
      eq("s.Winner()", ["b", true]),
      eq("s.Current()", ["", false]),
    ],
  ],
  "leaderboard": [
    [
      setup("NewLeaderboard()"),
      eq('s.AddScore("A",1)', true),
      eq('s.AddScore("a",2)', true),
      eq('s.Score("A")', [1, true]),
      eq('s.AddScore("A",0)', false),
    ],
    [
      setup("NewLeaderboard()"),
      run('s.AddScore("b",5)'),
      run('s.AddScore("a",5)'),
      run('s.AddScore("c",5)'),
      eq('s.Rank("c")', [1, true]),
      eq("s.Top(10)", ["a", "b", "c"]),
      eq('s.Rank("missing")', [0, false]),
    ],
    [
      setup("NewLeaderboard()"),
      run('s.AddScore("x",9)'),
      run('s.Remove("x")'),
      run('s.AddScore("x",4)'),
      eq('s.Score("x")', [4, true]),
      run('s.AddScore("y",4)'),
      eq("s.Clear()", true),
      eq("s.Clear()", true),
      eq("s.Top(1)", []),
      eq('s.Rank("y")', [0, false]),
    ],
  ],
};
