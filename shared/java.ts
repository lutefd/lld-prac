import type { PracticeFile } from "./problems.ts";
import type { Command } from "./case-support.ts";

type Contract = [string, string, string[]];
const types: Record<string, string> = {
  s: "String",
  n: "int",
  b: "boolean",
  entry: "Entry",
  strings: "String[]",
};
const returns: Record<string, [string, string]> = {
  b: ["boolean", "false"],
  n: ["int", "0"],
  s: ["String", '""'],
  pair: ["Pair<String>", 'new Pair<>("", false)'],
  boolpair: ["Pair<Boolean>", "new Pair<>(false, false)"],
  money: ["Pair<Integer>", "new Pair<>(0, false)"],
  strings: ["String[]", "new String[0]"],
  entries: ["Entry[]", "new Entry[0]"],
  entrypair: ["Pair<Entry>", "new Pair<>(null, false)"],
};
const params = (spec: string) =>
  spec
    ? spec
        .split(",")
        .map((p) => {
          const [name, type] = p.split(":");
          return `${types[type]} ${name}`;
        })
        .join(", ")
    : "";

function starter([name, args, methods]: Contract, entry: boolean): string {
  const argNames = args
    .split(",")
    .filter(Boolean)
    .map((p) => p.split(":")[0])
    .join(", ");
  return `// Implement the contracts one level at a time. No solution is included.
public class Implementation {
  public static ${name} New${name}(${params(args)}) { return new ${name}(${argNames}); }
}

class ${name} {
  public ${name}(${params(args)}) {}
${methods
  .map((spec) => {
    const [method, args, result] = spec.split("|");
    const [type, zero] = returns[result];
    return `  public ${type} ${method}(${params(args)}) { return ${zero}; }`;
  })
  .join("\n")}
}
${
  entry
    ? `
class Entry {
  public String ID;
  public int Timestamp;
  public int Cents;
  public String Category;
  public Entry(String ID, int Timestamp, int Cents, String Category) {
    this.ID = ID; this.Timestamp = Timestamp; this.Cents = Cents; this.Category = Category;
  }
}
`
    : ""
}`;
}

// The portable scenarios use calls, array literals, tuple indexing, and array
// mutation. Rewrite only syntax outside quoted strings, preserving test values.
function expression(source: string, contract: Contract): string {
  if (source.startsWith("LEN("))
    return `(${expression(source.slice(4, -1), contract)}).length`;
  const pairMethods = new Set(
    contract[2]
      .filter((s) =>
        ["pair", "boolpair", "money", "entrypair"].includes(s.split("|")[2]),
      )
      .map((s) => s.split("|")[0]),
  );
  let result = source.replace(
    /"(?:\\.|[^"\\])*"|\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)\(((?:"(?:\\.|[^"\\])*"|[^)"])*)\)\[([01])\]/g,
    (whole, receiver, method, args, index) =>
      receiver && pairMethods.has(method)
        ? `${receiver}.${method}(${args}).${index === "0" ? "value" : "ok"}()`
        : whole,
  );
  // Keep strings as indivisible tokens so values such as "NewX(" are intact.
  const tokens =
    result.match(
      /"(?:\\.|[^"\\])*"|\bNew\w+(?=\()|\bEntry(?=\()|\[|\]|[^"\[\]]/g,
    ) || [];
  let arrayLiteral = false;
  result = tokens
    .map((token, index) => {
      if (/^New\w+$/.test(token)) return `Implementation.${token}`;
      if (token === "Entry") return "new Entry";
      if (
        token === "[" &&
        (index === 0 || /[(,]\s*$/.test(tokens.slice(0, index).join("")))
      ) {
        arrayLiteral = true;
        return "new String[]{";
      }
      if (token === "]" && arrayLiteral) {
        arrayLiteral = false;
        return "}";
      }
      return token;
    })
    .join("");
  return result;
}

function literal(value: unknown): string {
  if (Array.isArray(value))
    return `new Object[]{${value.map(literal).join(", ")}}`;
  return JSON.stringify(value);
}

function testSource(
  contract: Contract,
  commands: Command[],
  name: string,
): string {
  const variables = new Set<string>();
  const lines = commands.map((command) => {
    const expr = expression(command.expression, contract);
    if (command.kind === "assign") {
      const prefix = variables.has(command.name!) ? "" : "var ";
      variables.add(command.name!);
      return `    ${prefix}${command.name} = ${expr};`;
    }
    if (command.kind === "eq")
      return `    PracticeAssertions.equal(${expr}, ${literal(command.expected)}, ${JSON.stringify(command.expression)});`;
    return `    ${expr};`;
  });
  return `public class ${name} {
  public static void main(String[] args) {
${lines.join("\n")}
    System.out.println("PASS ${name}");
  }
}
`;
}

export function javaFiles(
  contract: Contract,
  visible: Command[][],
  hidden: Command[][],
  entry: boolean,
): PracticeFile[] {
  return [
    {
      path: "Implementation.java",
      content: starter(contract, entry),
      readOnly: false,
    },
    {
      path: "Pair.java",
      content:
        "// Go (value, bool) results use a typed value and success flag.\npublic record Pair<T>(T value, boolean ok) {}\n",
      readOnly: true,
    },
    {
      path: "PracticeAssertions.java",
      readOnly: true,
      content: `import java.lang.reflect.Array;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Objects;

public class PracticeAssertions {
  private static Object normalize(Object value) {
    if (value instanceof Pair<?> pair) return Arrays.asList(normalize(pair.value()), pair.ok());
    if (value != null && value.getClass().isArray()) {
      var items = new ArrayList<Object>();
      for (int i = 0; i < Array.getLength(value); i++) items.add(normalize(Array.get(value, i)));
      return items;
    }
    return value;
  }
  public static void equal(Object actual, Object expected, String label) {
    var got = normalize(actual);
    var want = normalize(expected);
    if (!Objects.equals(got, want)) throw new AssertionError(label + ": expected " + want + ", got " + got);
  }
}
`,
    },
    ...[visible, hidden].flatMap((levels, group) =>
      levels.map((commands, i) => {
        const name = `${group ? "Hidden" : ""}Level${i + 1}Test`;
        return {
          path: `${name}.java`,
          content: testSource(contract, commands, name),
          readOnly: true,
          ...(group ? { hidden: true } : {}),
        };
      }),
    ),
    {
      path: "SandboxTest.java",
      readOnly: false,
      content: `// Add your own edge-case assertions here. No test dependencies are needed.
public class SandboxTest {
  public static void main(String[] args) {
    PracticeAssertions.equal(true, true, "user smoke");
    System.out.println("PASS SandboxTest");
  }
}
`,
    },
  ];
}
