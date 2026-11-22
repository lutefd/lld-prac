# Workbench

A local low-level design practice app inspired by the test-taking layout of CodeSignal. Monaco, real language servers, collapsible requirements, progressive exercises, and test output. No AI autocomplete or AI service integrations.

![Workbench local LLD practice workspace](docs/workbench.png)

## Run locally

Requirements: **Node.js 24+**, **Go 1.22+**, **Python 3.10+**, and **JDK 21+** for Java. Go is the default language; Python, TypeScript, and Java are available for every exercise.

```sh
npm install
go install golang.org/x/tools/gopls@latest
npm run dev
```

Open [127.0.0.1:5173](http://127.0.0.1:5173). Ensure `$(go env GOPATH)/bin` is on your `PATH` before starting the app. Pyright and the TypeScript language server are installed by npm. Java editing uses Eclipse JDT LS: install a `jdtls` launcher compatible with your JDK on `PATH`, or set `PRACTICE_JAVA_LSP` to its executable path. Compose includes JDT LS. Running Java tests requires only the JDK; editing remains available when its language server is missing. The editor, workers, and fonts are bundled locally; practice needs no network after installation.

For a production build:

```sh
npm run build
npm start
```

Open [127.0.0.1:4173](http://127.0.0.1:4173). Both modes also start the API on port 3001 and bind to the loopback interface.

## Practice

Open **Settings** (gear) on the roadmap or practice toolbar to change theme, language, editor theme/font/size, and interface text size. Language follows your browser preference (Portuguese uses pt-BR; other languages fall back to English), with explicit English and Português (Brasil) options. Theme follows the system appearance by default, until you choose light or dark. Choices are saved in this browser. Exercise descriptions, requirements, roadmap, and interface are localized; source code, API names, examples, and test output stay in English.

- The app opens on the **Practice roadmap**, with a recommended order, language-specific progress, and a shortcut to the next unfinished exercise. Start with the stack and queue, use vending machine as the medium bridge, then dependency planner as the hard bridge. Return to the roadmap at `/` from any exercise (or the map shortcut in the practice toolbar).
- Each exercise has a bookmarkable URL, such as `/practice/ride-dispatch`. Roadmap and library links can be copied or opened in new tabs. Reloading or using browser back/forward preserves the exercise selected by the URL; drafts and progress stay saved on your account.
- Open the exercise library from the brand button in the practice toolbar or from Settings. Filter by ride-hailing, banking, fundamentals, commerce, collaboration, infrastructure, or games.
- Implement the current level in `implementation.go`, `implementation.py`, `implementation.ts`, or `Implementation.java`.
- Use normal language completions, hover information, signatures, definitions, and diagnostics from gopls, Pyright, the TypeScript language server, or Eclipse JDT LS (`jdtls`, installed separately for Java). Inline AI suggestions are disabled.
- Use **+ New file** in Explorer to create additional `.go`, `.py`, `.ts`, or `.java` source files, including paths such as `helpers/pricing.go`. Switch files in Explorer; extra files are saved with the selected exercise and language.
- Add personal tests to the sandbox or create your own test files: `*_test.go`, `test_*.py` / `*_test.py`, or `*.test.ts` / `*_test.ts`. Java tests use `*Test.java` with a `public static void main(String[] args)` method and assertions that throw on failure. Nested test files run too. Supplied tests are read only; Go test names do not need a special prefix.
- You can switch programming languages while a run is queued or executing. Your draft is preserved for each language; the previous browser request is abandoned and cannot update the new workspace. An already executing server-side test finishes within its time limit.
- Click **Run tests** or press **⌘ Enter / Ctrl Enter**. The console shows the actual runner output, including your test logs, errors, assertion failures, and hidden check results.
- Passing the cumulative checks unlocks the next level. Later-level test files are excluded from the execution snapshot until their level is selected.
- Drag the dividers to resize requirements, the file explorer, and the console. Each pane can be collapsed and restored; sizes and visibility are remembered in this browser. Focus a divider and use arrow keys to resize (Shift for larger steps), or double-click it to reset the size. Run tests automatically reopens a collapsed console. The practice timer can be hidden or paused from Settings.

Drafts, attempts, and unlocked levels are saved per account in SQLite (`.practice/workbench.db` locally), separately for each exercise and language. Runtime workspace files live under ignored `.practice/workspaces/`. Reset clears attempts and drafts only for the selected exercise and language. Existing browser drafts and progress are imported once when you first sign in.

The prompts use Go-style contracts as a common specification. Python, TypeScript, and Java starters retain PascalCase method and constructor factory names; follow their supplied type signatures and tests for return representations.

## Exercises

All 44 exercises have three progressive levels and starters/tests for all four languages, including visible examples, hidden edge checks, and an editable sandbox. Thirteen easy exercises provide a gradual ramp before the medium and hard bridges on the roadmap.

| Domain         | Exercises                                                                                                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ride-hailing   | Ride dispatch, Fare calculator, Trip lifecycle, Driver availability, Parking lot, Multi-level parking garage, Seat booking, Parcel locker                                                                                                                                |
| Banking        | Wallet ledger, Account transfers, Card limits, Transaction history, Expense splitter                                                                                                                                                                                     |
| Fundamentals   | Bounded stack, FIFO queue, Score tracker, Contact directory, Shopping cart, Thermostat, Vending machine, Library lending, In-memory filesystem, Inventory reservations, LRU cache, Rate limiter, Dependency planner, Delayed job queue, Text editor with undo, LFU cache |
| Commerce       | Coupon registry, Restaurant orders, Auction house                                                                                                                                                                                                                        |
| Collaboration  | Task checklist, Support ticket router, Meeting room scheduler                                                                                                                                                                                                            |
| Infrastructure | Feature flag registry, Pub/sub broker, TTL key-value store, URL shortener, Circuit breaker, Elevator controller                                                                                                                                                          |
| Games          | Tic-tac-toe, Snakes and ladders, Competitive leaderboard                                                                                                                                                                                                                 |

These are original practice scenarios spanning ride-hailing, banking, commerce, collaboration, infrastructure, games, and core data structures. They cover common interview design patterns and are not official questions from any company.

## Test execution

Native execution is the default. Each run uses a temporary snapshot, captures stdout/stderr, enforces a time/output limit, and cleans up afterward. It executes code with your local account's permissions; this is a personal practice tool for code you trust, not a hosted judge for untrusted submissions.

| Language   | Runner                                                             |
| ---------- | ------------------------------------------------------------------ |
| Go         | `go test -v -count=1 -timeout=12s ./...`                           |
| Python     | Python unittest with selected level checks and all user test files |
| TypeScript | Node 24 native type stripping with `node --test`                   |
| Java       | JDK 21+ compilation and dependency-free test mains in one JVM      |

The TypeScript runner executes TypeScript without an intermediate compile step. Its language server provides type diagnostics; test execution itself does not type-check. Use type-strippable syntax in solutions (avoid enums and constructor parameter properties).

Hidden test source is omitted from the editor and exercise metadata API. This public repository includes the test definitions, so “hidden” means concealed during practice, not an anti-cheating security boundary.

### Docker option

With a running Docker-compatible daemon, pre-pull the language images:

```sh
docker pull golang:1.26-alpine
docker pull python:3.14-alpine
docker pull node:24-alpine
docker build -f deploy/java-runner.Dockerfile -t workbench-java-runner:21 .
PRACTICE_DOCKER_CONTEXT=orbstack PRACTICE_RUNNER=docker npm run dev
```

Set `PRACTICE_DOCKER_CONTEXT` to your Docker context name, or omit it to use your normal Docker connection. An explicit context is useful when `DOCKER_HOST` still points to another engine.

To use the faster Go image outside Compose, build it with `docker build -f deploy/go-runner.Dockerfile -t workbench-go-runner:1.26 .` and set `PRACTICE_GO_IMAGE=workbench-go-runner:1.26` when starting the API. Without this setting, standalone Docker mode uses the stock Go image.

Java Docker runs default to `workbench-java-runner:21` (override with `PRACTICE_JAVA_IMAGE`). Build this image once before standalone Docker mode; Compose builds it automatically. Its immutable layers contain the JDK, precompiled test runner, and a prewarmed JVM class archive for the compiler and harness. Tests need no Maven, Gradle, JUnit, network access, or dependency downloads. Each submission compiles only its workspace sources into a private temporary directory and runs all selected test mains in one JVM.

Docker runs use a read-only workspace and root filesystem, a writable temporary filesystem, no network, CPU/memory/process limits, dropped capabilities, and a timeout. Language servers still run locally. Container images must be available before starting a run. A missing daemon or image is reported in the console; Docker mode does not silently fall back to native execution.

## Deploy on a laptop with Cloudflared

The Compose setup serves the built frontend with nginx and forwards `/api/` to a private backend. Only the frontend joins your existing Cloudflared Docker network; neither service publishes a host port. The backend and frontend also share a private app network. The laptop needs Linux, Docker Engine, and Docker Compose; Node, Go, Python, and the Java JDK are included in the images. Browser requests use relative `/api/...` URLs in both modes: local development uses Vite’s proxy to `127.0.0.1:3001`, while Docker uses nginx’s proxy to `backend:3001`. `npm run dev` and `npm start` continue to work without Docker.

```sh
cp .env.example .env
# Edit .env: set CLOUDFLARED_NETWORK, PRACTICE_ALLOWED_ORIGINS,
# and BETTER_AUTH_SECRET (openssl rand -base64 32).
sudo mkdir -p /var/lib/workbench/runs
docker pull golang:1.26-alpine
docker pull python:3.14-alpine
docker pull node:24-alpine
docker compose up -d --build
```

In your existing Cloudflared tunnel, point the public hostname at **`http://workbench:80`**. Keep the original HTTP Host header (do not override it to `workbench`). Cloudflared must already be attached to the network named by `CLOUDFLARED_NETWORK`; Compose deliberately reuses that external network. Set `PRACTICE_ALLOWED_ORIGINS` to the browser origin, such as `https://practice.example.com`, without a trailing slash. It accepts comma-separated origins. TLS terminates at Cloudflare.

The backend defaults to 20 workspaces, two concurrent test runs, and ten waiting runs. A workspace can have only one queued or running submission. Queue waits expire after 60 seconds; execution has its own 60-second timeout after a slot opens (`PRACTICE_TEST_TIMEOUT_MS`). This includes container startup and compilation. Compose builds the cached `workbench-java-runner:21` image described above and a `workbench-go-runner:1.26` image with precompiled standard-library dependencies. Each Go run references that immutable cache from its own disposable cache directory, avoiding repeated standard-library compilation without sharing writable state between submissions. Native execution keeps its 20-second default unless this setting is provided. Limits can be changed in `.env`, then applied with `docker compose up -d`. Waiting runs live in memory and are lost on restart. Language servers suspend after five minutes without editor activity; workspaces expire after an hour of inactivity, and their server files are deleted. Accounts, drafts, and progress persist in the `data` volume.

`PRACTICE_RUN_ROOT` must be an absolute Linux host directory mounted at the **same absolute path** inside the backend: test containers are siblings launched by the host daemon and bind-mount snapshots from that path. If changing it, create the new directory before starting Compose. Workspace files and the SQLite database use separate named volumes. Do not run multiple backend replicas against these directories.

### Accounts and database

Accounts, attempt history, code drafts, and API keys live in a single SQLite file.

- **Secret.** Generate `BETTER_AUTH_SECRET` with `openssl rand -base64 32` and add it to `.env`. Compose refuses to start without it. Set `BETTER_AUTH_URL` only if it differs from the first `PRACTICE_ALLOWED_ORIGINS` entry.
- **Database location.** In Compose, the database lives at `/app/.practice/data/workbench.db`, stored in the `data` named volume so rebuilds and restarts keep all accounts and history. In local development (`npm run dev` and `npm start`), it lives at `.practice/workbench.db` (override with `PRACTICE_DATABASE_PATH`).
- **Migrations.** The backend creates and migrates auth and practice tables automatically and idempotently on every start.
- **Backup and restore.** The backend image ships Node 24 without the `sqlite3` CLI, so use `node:sqlite` with `VACUUM INTO` for a consistent online snapshot:

```sh
# Backup to ./workbench-backup.db on the host
docker compose exec backend node -e "import { DatabaseSync } from 'node:sqlite'; const db = new DatabaseSync('/app/.practice/data/workbench.db'); db.exec(\"VACUUM INTO '/tmp/workbench-backup.db'\"); db.close();"
docker compose cp backend:/tmp/workbench-backup.db ./workbench-backup.db
docker compose exec backend rm -f /tmp/workbench-backup.db

# Restore (stop the backend first so no writes race with the copy)
docker compose stop backend
docker compose run --rm -T --no-deps -v "$PWD/workbench-backup.db:/tmp/restore.db:ro" backend node -e "import { copyFileSync, rmSync } from 'node:fs'; for (const suffix of ['', '-wal', '-shm']) rmSync('/app/.practice/data/workbench.db' + suffix, { force: true }); copyFileSync('/tmp/restore.db', '/app/.practice/data/workbench.db');"
docker compose start backend
```

- **Disable sign-up.** Once your group has created accounts, set `PRACTICE_DISABLE_SIGNUP=true` in `.env` and run `docker compose up -d`. Existing users can still sign in.
- **Progress report API.** Create an API key on the **Account** page (`/account`), then query `/api/v1/report` (optional `?limit=100`, max `1000`). API keys can only read the report and cannot open workspaces or run code.

```sh
curl -H "x-api-key: <your-api-key>" https://practice.example.com/api/v1/report
```

```json
{
  "user": { "id": "usr_...", "name": "Alex", "email": "alex@example.com" },
  "summary": {
    "attempts": 5,
    "passedAttempts": 3,
    "levelsPassed": 3,
    "problemsStarted": 1,
    "problemsCompleted": 1
  },
  "progress": [
    {
      "problemId": "bounded-stack",
      "title": "Bounded stack",
      "language": "go",
      "levelsPassed": 3,
      "totalLevels": 3,
      "completed": true,
      "attempts": 5,
      "lastAttemptAt": "2026-11-22T16:30:00.000Z"
    }
  ],
  "attempts": [
    {
      "problemId": "bounded-stack",
      "language": "go",
      "level": 3,
      "passed": true,
      "durationMs": 412,
      "createdAt": "2026-11-22T16:30:00.000Z",
      "imported": false
    }
  ]
}
```

This deployment is for trusted, invited users. The backend mounts the host Docker socket to launch isolated test containers; that socket grants control of the host Docker daemon. Language servers run in the backend container, and this is not a hardened public code-execution service. Restrict the hostname with Cloudflare Access for your group. Runner containers have networking disabled and do not join the Cloudflared network.

```sh
docker compose logs -f backend
docker compose down            # stop; retain workspace and data volumes
docker compose up -d --build   # rebuild and restart after updating the checkout
```

## Development checks

```sh
npm test                 # catalog and runner/API checks
npm run build            # TypeScript checking and production bundle
npx playwright install chromium
npm run test:e2e         # real browser workspace checks
npm run test:lsp         # installed language-server checks
PRACTICE_DOCKER_CONTEXT=orbstack npm run test:docker # real container checks
```

`shared/` contains the exercise catalog, portable starter/test generation, and recommended roadmap. `server/` owns workspace storage, the JSON-RPC language-server bridge, and test runners. `src/` contains the React interface and Monaco integration. New case modules keep Go prompts/starters/tests alongside their portable Python/TypeScript/Java API and test commands; register their exports in `shared/problems.ts` and `shared/languages.ts`, and add their recommended position to `shared/roadmap.ts`.
