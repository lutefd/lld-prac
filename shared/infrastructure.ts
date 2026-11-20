import type { PracticeProblem } from "./problems.ts";
import { caseFiles, type Command } from "./case-support.ts";

const level = (
  title: string,
  description: string,
  requirements: string[],
  input: string,
  output: string,
) => ({ title, description, requirements, examples: [{ input, output }] });
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

export const infrastructureProblems: PracticeProblem[] = [
  {
    id: "feature-flags",
    title: "Feature flag registry",
    category: "Infrastructure",
    difficulty: "Easy",
    duration: 30,
    packageName: "practice",
    summary:
      "Manage feature defaults and per-user overrides without leaking settings across flags or users.",
    tags: ["Configuration", "Keyed state", "Overrides"],
    levels: [
      level(
        "Define feature defaults",
        "Store a boolean default for each feature.",
        [
          "NewFlags() *Flags creates an empty registry. Define(flag string, enabled bool) bool adds a nonempty, unique, case-sensitive flag. Empty or duplicate names return false without changes.",
          "Enabled(flag, user string) bool initially returns the flag default. Unknown flags return false; an empty user is allowed for this query and uses the default.",
        ],
        'Define("search", true); Enabled("search", "ana")',
        "true; true",
      ),
      level(
        "Override one user",
        "Customize a flag for a specific user.",
        [
          "Override(flag, user string, enabled bool) bool creates or replaces an override for a known flag and nonempty, case-sensitive user ID. Invalid calls return false without changes; repeated valid calls return true.",
          "Enabled returns an explicit override when present, including false; otherwise return the default. Overrides are independent for each (flag, user) pair.",
        ],
        'Define("search", true); Override("search", "ana", false); Enabled("search", "ana"); Enabled("search", "bob")',
        "true; true; false; true",
      ),
      level(
        "Update defaults and clear overrides",
        "Change global settings while preserving deliberate user choices.",
        [
          "SetDefault(flag string, enabled bool) bool updates a known flag; unknown flags return false. Existing overrides remain in effect, including overrides equal to the old default.",
          "ClearOverride(flag, user string) bool removes an existing override and returns true, otherwise false. The next Enabled query falls back to the current default. No operation removes a flag.",
        ],
        'Define("search", false); Override("search", "ana", false); SetDefault("search", true); Enabled("search", "ana"); ClearOverride("search", "ana"); Enabled("search", "ana")',
        "true; true; true; false; true; true",
      ),
    ],
    files: caseFiles(
      `type Flags struct {}
func NewFlags() *Flags { return &Flags{} }
func (f *Flags) Define(flag string, enabled bool) bool { return false }
func (f *Flags) Enabled(flag, user string) bool { return false }
func (f *Flags) Override(flag, user string, enabled bool) bool { return false }
func (f *Flags) SetDefault(flag string, enabled bool) bool { return false }
func (f *Flags) ClearOverride(flag, user string) bool { return false }`,
      [
        `s:=NewFlags(); if !s.Define("search",true) || s.Define("search",false) || s.Define("",true) || !s.Enabled("search","ana") || s.Enabled("missing","ana") {t.Fatal("flag registration or defaults incorrect")}`,
        `s:=NewFlags(); s.Define("search",true); if !s.Override("search","ana",false) || s.Enabled("search","ana") || !s.Enabled("search","bob") || s.Override("search","",false) || s.Override("missing","ana",true) {t.Fatal("override validation or isolation incorrect")}`,
        `s:=NewFlags(); s.Define("search",false); s.Override("search","ana",false); if !s.SetDefault("search",true) || s.Enabled("search","ana") || !s.Enabled("search","bob") || !s.ClearOverride("search","ana") || !s.Enabled("search","ana") || s.ClearOverride("search","ana") || s.SetDefault("missing",true) {t.Fatal("default updates or clearing incorrect")}`,
      ],
      [
        `s:=NewFlags(); if !s.Define("a",false) || !s.Define("A",true) || s.Enabled("a","") || !s.Enabled("A","") {t.Fatal("false defaults or case sensitivity incorrect")}`,
        `s:=NewFlags(); s.Define("a",false); s.Define("b",false); if !s.Override("a","u",true) || !s.Override("a","u",true) || !s.Enabled("a","u") || s.Enabled("a","U") || s.Enabled("b","u") {t.Fatal("overrides leaked")}; if !s.Override("a","u",false) || s.Enabled("a","u") {t.Fatal("override replacement failed")}`,
        `s:=NewFlags(); s.Define("a",true); s.Override("a","u",false); s.SetDefault("a",false); if !s.SetDefault("a",true) || s.Enabled("a","u") || s.ClearOverride("missing","u") || s.ClearOverride("a","") {t.Fatal("updates discarded explicit false")}; if !s.ClearOverride("a","u") || !s.Enabled("a","u") {t.Fatal("clear did not restore latest default")}`,
      ],
    ),
  },
  {
    id: "pubsub-broker",
    title: "Publish/subscribe broker",
    category: "Infrastructure",
    difficulty: "Medium",
    duration: 50,
    packageName: "practice",
    summary:
      "Route topic messages to subscriber inboxes, preserve delivery order, and inspect or drain isolated queues.",
    tags: ["Messaging", "Fan-out", "Queue ownership"],
    levels: [
      level(
        "Register subscriptions",
        "Keep exact topic memberships for each subscriber.",
        [
          "NewBroker() *Broker creates an empty broker. Subscribe(topic, subscriber string) bool accepts two nonempty, case-sensitive IDs and creates their membership. Duplicate or invalid memberships return false without changes.",
          "Subscribers(topic string) []string returns subscriber IDs sorted lexicographically as an isolated snapshot. Unknown topics return an empty result. The same subscriber may join several topics.",
        ],
        'Subscribe("news", "b"); Subscribe("news", "a"); Subscribers("news")',
        'true; true; ["a", "b"]',
      ),
      level(
        "Publish to inboxes",
        "Fan out messages synchronously into per-subscriber queues.",
        [
          "Publish(topic, message string) int appends the message once to each current subscriber inbox and returns the number of recipients. Unknown or empty topics return zero; messages may be empty and repeat.",
          "Drain(subscriber string) []string returns that subscriber's messages in publication-call order and empties only that inbox. All subscribed topics feed the same inbox; unknown subscribers return an empty result. There is no background delivery or threading.",
        ],
        'Subscribe("news", "a"); Publish("news", "hello"); Publish("news", "again"); Drain("a"); Drain("a")',
        'true; 1; 1; ["hello", "again"]; []',
      ),
      level(
        "Unsubscribe and inspect",
        "Change future delivery without erasing pending messages.",
        [
          "Unsubscribe(topic, subscriber string) bool removes an existing membership and returns true, otherwise false. Queued messages remain available. Resubscribing is allowed and never replays earlier publications.",
          "Peek(subscriber string) []string returns an isolated snapshot without consuming messages. Changing results from Peek, Drain, or Subscribers must not change broker state or another subscriber's inbox. Empty Go results may be nil or empty slices.",
        ],
        'Subscribe("news", "a"); Publish("news", "old"); Unsubscribe("news", "a"); Publish("news", "new"); Peek("a"); Drain("a")',
        'true; 1; true; 0; ["old"]; ["old"]',
      ),
    ],
    files: caseFiles(
      `type Broker struct {}
func NewBroker() *Broker { return &Broker{} }
func (b *Broker) Subscribe(topic, subscriber string) bool { return false }
func (b *Broker) Subscribers(topic string) []string { return nil }
func (b *Broker) Publish(topic, message string) int { return 0 }
func (b *Broker) Drain(subscriber string) []string { return nil }
func (b *Broker) Unsubscribe(topic, subscriber string) bool { return false }
func (b *Broker) Peek(subscriber string) []string { return nil }`,
      [
        `s:=NewBroker(); if !s.Subscribe("news","b") || !s.Subscribe("news","a") || s.Subscribe("news","a") || s.Subscribe("","a") || s.Subscribe("news","") {t.Fatal("invalid membership")}; ids:=s.Subscribers("news"); if len(ids)!=2 || ids[0]!="a" || ids[1]!="b" {t.Fatal("subscribers must be sorted")}`,
        `s:=NewBroker(); s.Subscribe("news","a"); s.Subscribe("news","b"); if s.Publish("news","one")!=2 || s.Publish("missing","ignored")!=0 || s.Publish("news","two")!=2 {t.Fatal("recipient count incorrect")}; q:=s.Drain("a"); if len(q)!=2 || q[0]!="one" || q[1]!="two" || len(s.Drain("a"))!=0 || len(s.Drain("b"))!=2 {t.Fatal("queue order or isolation incorrect")}`,
        `s:=NewBroker(); s.Subscribe("news","a"); s.Publish("news","old"); if !s.Unsubscribe("news","a") || s.Unsubscribe("news","a") || s.Publish("news","new")!=0 {t.Fatal("unsubscribe incorrect")}; q:=s.Peek("a"); if len(q)!=1 || q[0]!="old" {t.Fatal("pending message lost")}; q[0]="changed"; if s.Peek("a")[0]!="old" || len(s.Drain("a"))!=1 || len(s.Peek("a"))!=0 {t.Fatal("peek leaked state or consumed messages")}`,
      ],
      [
        `s:=NewBroker(); if !s.Subscribe("x","a") || !s.Subscribe("X","a") || len(s.Subscribers("missing"))!=0 {t.Fatal("topic identity incorrect")}; ids:=s.Subscribers("x"); ids[0]="changed"; if s.Subscribers("x")[0]!="a" {t.Fatal("membership snapshot leaked")}`,
        `s:=NewBroker(); s.Subscribe("x","a"); s.Subscribe("y","a"); s.Subscribe("x","b"); if s.Publish("x","")!=2 || s.Publish("y","same")!=1 || s.Publish("x","same")!=2 {t.Fatal("publish count incorrect")}; q:=s.Drain("a"); if len(q)!=3 || q[0]!="" || q[1]!="same" || q[2]!="same" || len(s.Drain("unknown"))!=0 {t.Fatal("cross-topic order or duplicate payload handling incorrect")}; q[0]="changed"; other:=s.Drain("b"); if len(other)!=2 || other[0]!="" {t.Fatal("drain affected another subscriber")}`,
        `s:=NewBroker(); s.Subscribe("x","a"); s.Subscribe("y","a"); s.Publish("x","old"); s.Unsubscribe("x","a"); if s.Publish("y","other")!=1 || !s.Subscribe("x","a") || s.Publish("x","new")!=1 {t.Fatal("resubscribe or independent topic incorrect")}; q:=s.Peek("a"); if len(q)!=3 || q[0]!="old" || q[1]!="other" || q[2]!="new" || len(s.Peek("a"))!=3 {t.Fatal("replay or destructive peek")}`,
      ],
    ),
  },
  {
    id: "ttl-key-value-store",
    title: "TTL key-value store",
    category: "Infrastructure",
    difficulty: "Hard",
    duration: 60,
    packageName: "practice",
    summary:
      "Keep expiring values on an explicit logical clock, then add atomic compare-and-set with expiry renewal.",
    tags: ["Expiration", "Logical time", "Compare-and-set"],
    levels: [
      level(
        "Store values with lifetimes",
        "Start with a logical clock fixed at zero.",
        [
          "NewTTLStore() *TTLStore starts empty at time zero. Put(key, value string, ttl int) bool accepts a nonempty, case-sensitive key and positive lifetime, overwriting any old value. Values may be empty. Invalid calls return false without changes.",
          'Get(key string) (string, bool) returns a live value or ("", false). Delete(key string) bool removes a live key, otherwise false. Lifetimes and all timestamp sums fit in int (safe integers in TypeScript). There is no real clock, persistence, or concurrency.',
        ],
        'Put("token", "v1", 5); Get("token"); Delete("token"); Get("token")',
        'true; ("v1", true); true; ("", false)',
      ),
      level(
        "Advance time and expire",
        "Use a deterministic, nondecreasing clock.",
        [
          "Advance(now int) bool sets the clock to a nonnegative timestamp at least the current time; equal timestamps succeed. Negative or backward timestamps return false without changing time or data.",
          "A successful Put expires at currentTime + ttl. A key is live only while currentTime < expiresAt, so it is absent exactly at its expiration. Count() int counts only live keys. Queries do not renew lifetimes. Expired keys may be reused, and no operation can revive an old value.",
        ],
        'Put("token", "v1", 5); Advance(4); Count(); Advance(5); Get("token"); Count()',
        'true; true; 1; true; ("", false); 0',
      ),
      level(
        "Compare and replace atomically",
        "Renew an entry only when its current value matches.",
        [
          "CompareAndSet(key, expected, replacement string, ttl int) bool succeeds only for a live key whose value equals expected, with positive ttl. It atomically replaces the value and sets expiry to currentTime + ttl. Empty expected and replacement strings are valid.",
          "Unknown or expired keys, unequal values, empty keys, and nonpositive ttl return false without changing the entry or its existing expiry. A matching replacement equal to the current value succeeds and still renews its lifetime. Reads and rejected writes never renew expiry.",
        ],
        'Put("token", "v1", 5); Advance(4); CompareAndSet("token", "v1", "v2", 3); Advance(5); Get("token"); Advance(7); Count()',
        'true; true; true; true; ("v2", true); true; 0',
      ),
    ],
    files: caseFiles(
      `type TTLStore struct {}
func NewTTLStore() *TTLStore { return &TTLStore{} }
func (s *TTLStore) Put(key, value string, ttl int) bool { return false }
func (s *TTLStore) Get(key string) (string, bool) { return "", false }
func (s *TTLStore) Delete(key string) bool { return false }
func (s *TTLStore) Advance(now int) bool { return false }
func (s *TTLStore) Count() int { return 0 }
func (s *TTLStore) CompareAndSet(key, expected, replacement string, ttl int) bool { return false }`,
      [
        `s:=NewTTLStore(); if !s.Put("k","one",5) || s.Put("","bad",5) || s.Put("k","bad",0) {t.Fatal("put validation incorrect")}; if v,ok:=s.Get("k"); !ok || v!="one" {t.Fatal("rejected write changed value")}; if !s.Put("k","",2) {t.Fatal("empty value rejected")}; if v,ok:=s.Get("k"); !ok || v!="" {t.Fatal("empty value confused with absent key")}; if !s.Delete("k") || s.Delete("k") {t.Fatal("delete incorrect")}`,
        `s:=NewTTLStore(); s.Put("a","one",5); s.Put("b","two",10); if !s.Advance(4) || s.Count()!=2 || s.Advance(3) || s.Advance(-1) || !s.Advance(5) || s.Count()!=1 {t.Fatal("clock or expiration incorrect")}; if _,ok:=s.Get("a"); ok || s.Delete("a") {t.Fatal("expired key still live")}; if v,ok:=s.Get("b"); !ok || v!="two" {t.Fatal("expiry affected other key")}`,
        `s:=NewTTLStore(); s.Put("k","one",5); s.Advance(4); if s.CompareAndSet("k","wrong","bad",20) || s.CompareAndSet("k","one","bad",0) || !s.CompareAndSet("k","one","two",3) {t.Fatal("compare-and-set validation incorrect")}; s.Advance(5); if v,ok:=s.Get("k"); !ok || v!="two" {t.Fatal("renewal failed")}; s.Advance(7); if s.CompareAndSet("k","two","revived",2) || s.Count()!=0 {t.Fatal("expired key revived")}`,
      ],
      [
        `s:=NewTTLStore(); if !s.Put("k","v",1) || !s.Put("K","other",1) || s.Put("k","bad",-1) {t.Fatal("case sensitivity or negative TTL incorrect")}; if v,ok:=s.Get("k"); !ok || v!="v" {t.Fatal("invalid put changed value")}; if _,ok:=s.Get("missing"); ok || s.Delete("missing") {t.Fatal("unknown key treated as live")}`,
        `s:=NewTTLStore(); if !s.Advance(10) || !s.Advance(10) || !s.Put("k","v",2) || s.Count()!=1 {t.Fatal("clock initialization incorrect")}; s.Advance(11); s.Get("k"); if s.Advance(0) || !s.Advance(12) || s.Count()!=0 {t.Fatal("read or invalid clock extended TTL")}; if !s.Put("k","new",1) {t.Fatal("expired key not reusable")}; s.Advance(13); if s.Count()!=0 {t.Fatal("replacement used wrong clock")}`,
        `s:=NewTTLStore(); s.Put("a","",3); s.Put("b","keep",10); s.Advance(2); if !s.CompareAndSet("a","","",4) || s.CompareAndSet("missing","","new",4) {t.Fatal("empty value renewal or absent compare incorrect")}; s.Advance(5); if _,ok:=s.Get("a"); !ok {t.Fatal("same-value replacement did not renew")}; if s.CompareAndSet("a","wrong","bad",100) || s.CompareAndSet("a","","bad",-1) {t.Fatal("invalid compare accepted")}; s.Advance(6); if s.Count()!=1 {t.Fatal("failed compare renewed lifetime")}; if v,ok:=s.Get("b"); !ok || v!="keep" {t.Fatal("compare affected another key")}`,
      ],
    ),
  },
];

export const infrastructureApi: Record<string, [string, string, string[]]> = {
  "feature-flags": [
    "Flags",
    "",
    [
      "Define|flag:s,enabled:b|b",
      "Enabled|flag:s,user:s|b",
      "Override|flag:s,user:s,enabled:b|b",
      "SetDefault|flag:s,enabled:b|b",
      "ClearOverride|flag:s,user:s|b",
    ],
  ],
  "pubsub-broker": [
    "Broker",
    "",
    [
      "Subscribe|topic:s,subscriber:s|b",
      "Subscribers|topic:s|strings",
      "Publish|topic:s,message:s|n",
      "Drain|subscriber:s|strings",
      "Unsubscribe|topic:s,subscriber:s|b",
      "Peek|subscriber:s|strings",
    ],
  ],
  "ttl-key-value-store": [
    "TTLStore",
    "",
    [
      "Put|key:s,value:s,ttl:n|b",
      "Get|key:s|pair",
      "Delete|key:s|b",
      "Advance|now:n|b",
      "Count||n",
      "CompareAndSet|key:s,expected:s,replacement:s,ttl:n|b",
    ],
  ],
};
export const infrastructureTests: Record<string, Command[][]> = {
  "feature-flags": [
    [
      setup("NewFlags()"),
      eq('s.Define("search",true)', true),
      eq('s.Define("search",false)', false),
      eq('s.Define("",true)', false),
      eq('s.Enabled("search","ana")', true),
      eq('s.Enabled("missing","ana")', false),
    ],
    [
      setup("NewFlags()"),
      run('s.Define("search",true)'),
      eq('s.Override("search","ana",false)', true),
      eq('s.Enabled("search","ana")', false),
      eq('s.Enabled("search","bob")', true),
      eq('s.Override("search","",false)', false),
      eq('s.Override("missing","ana",true)', false),
    ],
    [
      setup("NewFlags()"),
      run('s.Define("search",false)'),
      run('s.Override("search","ana",false)'),
      eq('s.SetDefault("search",true)', true),
      eq('s.Enabled("search","ana")', false),
      eq('s.Enabled("search","bob")', true),
      eq('s.ClearOverride("search","ana")', true),
      eq('s.Enabled("search","ana")', true),
      eq('s.ClearOverride("search","ana")', false),
      eq('s.SetDefault("missing",true)', false),
    ],
  ],
  "pubsub-broker": [
    [
      setup("NewBroker()"),
      eq('s.Subscribe("news","b")', true),
      eq('s.Subscribe("news","a")', true),
      eq('s.Subscribe("news","a")', false),
      eq('s.Subscribe("","a")', false),
      eq('s.Subscribe("news","")', false),
      eq('s.Subscribers("news")', ["a", "b"]),
    ],
    [
      setup("NewBroker()"),
      run('s.Subscribe("news","a")'),
      run('s.Subscribe("news","b")'),
      eq('s.Publish("news","one")', 2),
      eq('s.Publish("missing","ignored")', 0),
      eq('s.Publish("news","two")', 2),
      eq('s.Drain("a")', ["one", "two"]),
      eq('s.Drain("a")', []),
      eq('s.Drain("b")', ["one", "two"]),
    ],
    [
      setup("NewBroker()"),
      run('s.Subscribe("news","a")'),
      run('s.Publish("news","old")'),
      eq('s.Unsubscribe("news","a")', true),
      eq('s.Unsubscribe("news","a")', false),
      eq('s.Publish("news","new")', 0),
      eq('s.Peek("a")', ["old"]),
      { kind: "assign", name: "q", expression: 's.Peek("a")' },
      run('q[0] = "changed"'),
      eq('s.Peek("a")', ["old"]),
      eq('s.Drain("a")', ["old"]),
      eq('s.Peek("a")', []),
    ],
  ],
  "ttl-key-value-store": [
    [
      setup("NewTTLStore()"),
      eq('s.Put("k","one",5)', true),
      eq('s.Put("","bad",5)', false),
      eq('s.Put("k","bad",0)', false),
      eq('s.Get("k")', ["one", true]),
      eq('s.Put("k","",2)', true),
      eq('s.Get("k")', ["", true]),
      eq('s.Delete("k")', true),
      eq('s.Delete("k")', false),
    ],
    [
      setup("NewTTLStore()"),
      run('s.Put("a","one",5)'),
      run('s.Put("b","two",10)'),
      eq("s.Advance(4)", true),
      eq("s.Count()", 2),
      eq("s.Advance(3)", false),
      eq("s.Advance(-1)", false),
      eq("s.Advance(5)", true),
      eq("s.Count()", 1),
      eq('s.Get("a")', ["", false]),
      eq('s.Delete("a")', false),
      eq('s.Get("b")', ["two", true]),
    ],
    [
      setup("NewTTLStore()"),
      run('s.Put("k","one",5)'),
      run("s.Advance(4)"),
      eq('s.CompareAndSet("k","wrong","bad",20)', false),
      eq('s.CompareAndSet("k","one","bad",0)', false),
      eq('s.CompareAndSet("k","one","two",3)', true),
      run("s.Advance(5)"),
      eq('s.Get("k")', ["two", true]),
      run("s.Advance(7)"),
      eq('s.CompareAndSet("k","two","revived",2)', false),
      eq("s.Count()", 0),
    ],
  ],
};
export const infrastructureHidden: Record<string, Command[][]> = {
  "feature-flags": [
    [
      setup("NewFlags()"),
      eq('s.Define("a",false)', true),
      eq('s.Define("A",true)', true),
      eq('s.Enabled("a","")', false),
      eq('s.Enabled("A","")', true),
    ],
    [
      setup("NewFlags()"),
      run('s.Define("a",false)'),
      run('s.Define("b",false)'),
      eq('s.Override("a","u",true)', true),
      eq('s.Override("a","u",true)', true),
      eq('s.Enabled("a","u")', true),
      eq('s.Enabled("a","U")', false),
      eq('s.Enabled("b","u")', false),
      eq('s.Override("a","u",false)', true),
      eq('s.Enabled("a","u")', false),
    ],
    [
      setup("NewFlags()"),
      run('s.Define("a",true)'),
      run('s.Override("a","u",false)'),
      run('s.SetDefault("a",false)'),
      eq('s.SetDefault("a",true)', true),
      eq('s.Enabled("a","u")', false),
      eq('s.ClearOverride("missing","u")', false),
      eq('s.ClearOverride("a","")', false),
      eq('s.ClearOverride("a","u")', true),
      eq('s.Enabled("a","u")', true),
    ],
  ],
  "pubsub-broker": [
    [
      setup("NewBroker()"),
      eq('s.Subscribe("x","a")', true),
      eq('s.Subscribe("X","a")', true),
      eq('s.Subscribers("missing")', []),
      { kind: "assign", name: "ids", expression: 's.Subscribers("x")' },
      run('ids[0] = "changed"'),
      eq('s.Subscribers("x")', ["a"]),
    ],
    [
      setup("NewBroker()"),
      run('s.Subscribe("x","a")'),
      run('s.Subscribe("y","a")'),
      run('s.Subscribe("x","b")'),
      eq('s.Publish("x","")', 2),
      eq('s.Publish("y","same")', 1),
      eq('s.Publish("x","same")', 2),
      eq('s.Drain("a")', ["", "same", "same"]),
      eq('s.Drain("unknown")', []),
      eq('s.Drain("b")', ["", "same"]),
    ],
    [
      setup("NewBroker()"),
      run('s.Subscribe("x","a")'),
      run('s.Subscribe("y","a")'),
      run('s.Publish("x","old")'),
      run('s.Unsubscribe("x","a")'),
      eq('s.Publish("y","other")', 1),
      eq('s.Subscribe("x","a")', true),
      eq('s.Publish("x","new")', 1),
      eq('s.Peek("a")', ["old", "other", "new"]),
      eq('s.Peek("a")', ["old", "other", "new"]),
    ],
  ],
  "ttl-key-value-store": [
    [
      setup("NewTTLStore()"),
      eq('s.Put("k","v",1)', true),
      eq('s.Put("K","other",1)', true),
      eq('s.Put("k","bad",-1)', false),
      eq('s.Get("k")', ["v", true]),
      eq('s.Get("missing")', ["", false]),
      eq('s.Delete("missing")', false),
    ],
    [
      setup("NewTTLStore()"),
      eq("s.Advance(10)", true),
      eq("s.Advance(10)", true),
      eq('s.Put("k","v",2)', true),
      eq("s.Count()", 1),
      run("s.Advance(11)"),
      run('s.Get("k")'),
      eq("s.Advance(0)", false),
      eq("s.Advance(12)", true),
      eq("s.Count()", 0),
      eq('s.Put("k","new",1)', true),
      run("s.Advance(13)"),
      eq("s.Count()", 0),
    ],
    [
      setup("NewTTLStore()"),
      run('s.Put("a","",3)'),
      run('s.Put("b","keep",10)'),
      run("s.Advance(2)"),
      eq('s.CompareAndSet("a","","",4)', true),
      eq('s.CompareAndSet("missing","","new",4)', false),
      run("s.Advance(5)"),
      eq('s.Get("a")', ["", true]),
      eq('s.CompareAndSet("a","wrong","bad",100)', false),
      eq('s.CompareAndSet("a","","bad",-1)', false),
      run("s.Advance(6)"),
      eq("s.Count()", 1),
      eq('s.Get("b")', ["keep", true]),
    ],
  ],
};
