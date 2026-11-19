export const roadmap = [
  {
    title: "Build confidence",
    description:
      "Start with small collections and explicit validation. Aim for readable code before clever abstractions.",
    exercises: [
      [
        "bounded-stack",
        "Practice one collection, capacity checks, and last-in-first-out behavior.",
      ],
      [
        "fifo-queue",
        "Reuse those collection skills with first-in-first-out ordering.",
      ],
      [
        "score-tracker",
        "Practice keyed state, small updates, and deterministic leaderboards.",
      ],
      [
        "contact-directory",
        "Build confidence with identity, updates, and simple prefix searches.",
      ],
    ],
  },
  {
    title: "Apply the basics",
    description:
      "Stay with easy cases while applying your collection and validation skills to everyday systems.",
    exercises: [
      [
        "fare-calculator",
        "Move from collections to pure calculations, integer money, and validation.",
      ],
      [
        "shopping-cart",
        "Combine quantities and integer prices in a small shopping flow.",
      ],
      [
        "thermostat",
        "Practice simple control rules and explicit changes of state.",
      ],
      [
        "parking-lot",
        "Combine capacity and identity in a small real-world system.",
      ],
    ],
  },
  {
    title: "Cross into medium",
    description:
      "Vending machine is the medium bridge: familiar operations, with several pieces of state that must agree.",
    exercises: [
      [
        "vending-machine",
        "Connect stock and credit; make failed purchases leave both unchanged.",
      ],
      [
        "driver-availability",
        "Track independent entities and query their changing state.",
      ],
      [
        "wallet-ledger",
        "Keep balances valid and make repeated operations safe.",
      ],
      ["library-lending", "Coordinate members, copies, and borrowing rules."],
    ],
  },
  {
    title: "Design queries and transitions",
    description:
      "Add deterministic selection and multi-step lifecycles. Write down valid states before implementing them.",
    exercises: [
      [
        "in-memory-filesystem",
        "Practice exact identity, prefix queries, and safe moves.",
      ],
      [
        "transaction-history",
        "Build stable ordering, filtering, and pagination.",
      ],
      ["ride-dispatch", "Choose deterministically among eligible candidates."],
      [
        "trip-lifecycle",
        "Enforce transitions and retain an isolated event history.",
      ],
      [
        "parcel-locker",
        "Apply allocation and lifecycle rules to package pickup.",
      ],
    ],
  },
  {
    title: "Protect invariants",
    description:
      "Combine the earlier skills. Decide what must remain true after every successful or rejected operation.",
    exercises: [
      [
        "inventory-reservations",
        "Separate available stock from held and committed quantities.",
      ],
      [
        "card-limits",
        "Follow money through authorization, capture, and refunds.",
      ],
      ["lru-cache", "Maintain recency alongside values and capacity."],
    ],
  },
  {
    title: "Cross into hard",
    description:
      "Dependency planner is the hard bridge: a small API introduces graph invariants before the larger scheduling and allocation cases.",
    exercises: [
      [
        "dependency-planner",
        "Reject cycles, identify eligible work, and preserve dependency rules.",
      ],
      [
        "rate-limiter",
        "Introduce explicit time and test exact window boundaries.",
      ],
      [
        "account-transfers",
        "Move value atomically and reason about safe reversal.",
      ],
      [
        "seat-booking",
        "Keep group reservations atomic while allocating scarce seats.",
      ],
      [
        "delayed-job-queue",
        "Combine time ordering, in-flight work, retries, and terminal states.",
      ],
      [
        "multi-level-garage",
        "Bring allocation, vehicle compatibility, and reservations together.",
      ],
    ],
  },
] as const;
