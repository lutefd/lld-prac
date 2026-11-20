# Workbench

A local low-level design practice app inspired by the test-taking layout of CodeSignal. Monaco, real language servers, collapsible requirements, progressive exercises, and test output. No AI autocomplete or AI service integrations.

![Workbench local LLD practice workspace](docs/workbench.png)

## Run locally

Requirements: **Node.js 24+**, **Go 1.22+**, and **Python 3.10+**. Go is the default language; Python and TypeScript are available for every exercise.

```sh
npm install
go install golang.org/x/tools/gopls@latest
npm run dev
```

Open [127.0.0.1:5173](http://127.0.0.1:5173). Ensure `$(go env GOPATH)/bin` is on your `PATH` before starting the app. Pyright and the TypeScript language server are installed by npm. The editor, workers, and fonts are bundled locally; practice needs no network after installation.

For a production build:

```sh
npm run build
npm start
```

Open [127.0.0.1:4173](http://127.0.0.1:4173). Both modes also start the API on port 3001 and bind to the loopback interface.

## Practice

Use the **Language** selector and sun/moon theme toggle in the roadmap or workspace header to customize the app. Language follows your browser preference (Portuguese uses pt-BR; other languages fall back to English), with explicit English and Português (Brasil) options. Theme follows the system appearance by default, until you choose light or dark with the toggle. Both choices are saved in this browser. Exercise descriptions, requirements, roadmap, and interface are localized; source code, API names, examples, and test output stay in English.

- The app opens on the **Practice roadmap**, with a recommended order, language-specific progress, and a shortcut to the next unfinished exercise. Start with the stack and queue, use vending machine as the medium bridge, then dependency planner as the hard bridge. Return to the roadmap at `/` from any exercise.
- Each exercise has a bookmarkable URL, such as `/practice/ride-dispatch`. Roadmap and library links can be copied or opened in new tabs. Reloading or using browser back/forward preserves the exercise selected by the URL; language, drafts, and progress stay saved locally.
- Open the exercise library from the **workbench.** logo or back arrow. Filter by ride-hailing, banking, fundamentals, commerce, collaboration, or infrastructure.
- Implement the current level in `implementation.go`, `implementation.py`, or `implementation.ts`.
- Use normal language completions, hover information, signatures, definitions, and diagnostics from gopls, Pyright, or the TypeScript language server. Inline AI suggestions are disabled.
- Use **+ New file** in Explorer to create additional `.go`, `.py`, or `.ts` source files, including paths such as `helpers/pricing.go`. Switch files in Explorer; extra files are saved with the selected exercise and language.
- Add personal tests to the sandbox or create your own test files: `*_test.go`, `test_*.py` / `*_test.py`, or `*.test.ts` / `*_test.ts`. Nested test files run too. Supplied tests are read only; Go test names do not need a special prefix.
- You can switch programming languages while a run is queued or executing. Your draft is preserved for each language; the previous browser request is abandoned and cannot update the new workspace. An already executing server-side test finishes within its time limit.
- Click **Run tests** or press **⌘ Enter / Ctrl Enter**. The console shows the actual runner output, including your test logs, errors, assertion failures, and hidden check results.
- Passing the cumulative checks unlocks the next level. Later-level test files are excluded from the execution snapshot until their level is selected.
- Drag the dividers to resize requirements, the file explorer, and the console. Each pane can be collapsed and restored; sizes and visibility are remembered in this browser. Focus a divider and use arrow keys to resize (Shift for larger steps), or double-click it to reset the size. Run tests automatically reopens a collapsed console. The practice timer is optional and can be paused.

Use the expand icon next to the language selector to enter **focus mode**. It hides the branding bar and shrinks the toolbar while keeping the language selector and Run tests available. The same button exits focus mode; this preference is remembered too.

Drafts and unlocked levels are saved in browser local storage separately for each exercise and language. Runtime workspace files live under ignored `.practice/workspaces/`. Reset affects only the selected exercise and language. Browser data clearing removes drafts and progress.

The prompts use Go-style contracts as a common specification. Python and TypeScript starters retain PascalCase method and constructor factory names; follow their supplied type signatures and tests for return representations.

## Exercises

All 35 exercises have three progressive levels and starters/tests for all three languages, including visible examples, hidden edge checks, and an editable sandbox. Eleven easy exercises provide a gradual ramp before the medium and hard bridges on the roadmap.

| Domain         | Exercises                                                                                                                                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ride-hailing   | Ride dispatch, Fare calculator, Trip lifecycle, Driver availability, Parking lot, Multi-level parking garage, Seat booking, Parcel locker                                                                                              |
| Banking        | Wallet ledger, Account transfers, Card limits, Transaction history                                                                                                                                                                     |
| Fundamentals   | Bounded stack, FIFO queue, Score tracker, Contact directory, Shopping cart, Thermostat, Vending machine, Library lending, In-memory filesystem, Inventory reservations, LRU cache, Rate limiter, Dependency planner, Delayed job queue |
| Commerce       | Coupon registry, Restaurant orders, Auction house                                                                                                                                                                                      |
| Collaboration  | Task checklist, Support ticket router, Meeting room scheduler                                                                                                                                                                          |
| Infrastructure | Feature flag registry, Pub/sub broker, TTL key-value store                                                                                                                                                                             |

These are original practice scenarios spanning ride-hailing, banking, commerce, collaboration, infrastructure, and core data structures. They cover common interview design patterns and are not official questions from any company.

## Test execution

Native execution is the default. Each run uses a temporary snapshot, captures stdout/stderr, enforces a time/output limit, and cleans up afterward. It executes code with your local account's permissions; this is a personal practice tool for code you trust, not a hosted judge for untrusted submissions.

| Language   | Runner                                                             |
| ---------- | ------------------------------------------------------------------ |
| Go         | `go test -v -count=1 -timeout=12s ./...`                           |
| Python     | Python unittest with selected level checks and all user test files |
| TypeScript | Node 24 native type stripping with `node --test`                   |

The TypeScript runner executes TypeScript without an intermediate compile step. Its language server provides type diagnostics; test execution itself does not type-check. Use type-strippable syntax in solutions (avoid enums and constructor parameter properties).

Hidden test source is omitted from the editor and exercise metadata API. This public repository includes the test definitions, so “hidden” means concealed during practice, not an anti-cheating security boundary.

### Docker option

With a running Docker-compatible daemon, pre-pull the language images:

```sh
docker pull golang:1.26-alpine
docker pull python:3.14-alpine
docker pull node:24-alpine
PRACTICE_DOCKER_CONTEXT=orbstack PRACTICE_RUNNER=docker npm run dev
```

Set `PRACTICE_DOCKER_CONTEXT` to your Docker context name, or omit it to use your normal Docker connection. An explicit context is useful when `DOCKER_HOST` still points to another engine.

To use the faster Go image outside Compose, build it with `docker build -f deploy/go-runner.Dockerfile -t workbench-go-runner:1.26 .` and set `PRACTICE_GO_IMAGE=workbench-go-runner:1.26` when starting the API. Without this setting, standalone Docker mode uses the stock Go image.

Docker runs use a read-only workspace and root filesystem, a writable temporary filesystem, no network, CPU/memory/process limits, dropped capabilities, and a timeout. Language servers still run locally. Container images must be available before starting a run. A missing daemon or image is reported in the console; Docker mode does not silently fall back to native execution.

## Deploy on a laptop with Cloudflared

The Compose setup serves the built frontend with nginx and forwards `/api/` to a private backend. Only the frontend joins your existing Cloudflared Docker network; neither service publishes a host port. The backend and frontend also share a private app network. The laptop needs Linux, Docker Engine, and Docker Compose; Node, Go, and Python are included in the images. Browser requests use relative `/api/...` URLs in both modes: local development uses Vite’s proxy to `127.0.0.1:3001`, while Docker uses nginx’s proxy to `backend:3001`. `npm run dev` and `npm start` continue to work without Docker.

```sh
cp .env.example .env
# Edit .env: set CLOUDFLARED_NETWORK to your existing network name,
# and PRACTICE_ALLOWED_ORIGINS to your exact public URL.
sudo mkdir -p /var/lib/workbench/runs
docker pull golang:1.26-alpine
docker pull python:3.14-alpine
docker pull node:24-alpine
docker compose up -d --build
```

In your existing Cloudflared tunnel, point the public hostname at **`http://workbench:80`**. Keep the original HTTP Host header (do not override it to `workbench`). Cloudflared must already be attached to the network named by `CLOUDFLARED_NETWORK`; Compose deliberately reuses that external network. Set `PRACTICE_ALLOWED_ORIGINS` to the browser origin, such as `https://practice.example.com`, without a trailing slash. It accepts comma-separated origins. TLS terminates at Cloudflare.

The backend defaults to 20 workspaces, two concurrent test runs, and ten waiting runs. A workspace can have only one queued or running submission. Queue waits expire after 60 seconds; execution has its own 60-second timeout after a slot opens (`PRACTICE_TEST_TIMEOUT_MS`). This includes container startup and compilation. Compose builds a `workbench-go-runner:1.26` image with precompiled standard-library dependencies. Each Go run references that immutable cache from its own disposable cache directory, avoiding repeated standard-library compilation without sharing writable state between submissions. Native execution keeps its 20-second default unless this setting is provided. Limits can be changed in `.env`, then applied with `docker compose up -d`. Waiting runs live in memory and are lost on restart. Language servers suspend after five minutes without editor activity; workspaces expire after an hour of inactivity, and their server files are deleted. Browser drafts and progress remain in local storage.

`PRACTICE_RUN_ROOT` must be an absolute Linux host directory mounted at the **same absolute path** inside the backend: test containers are siblings launched by the host daemon and bind-mount snapshots from that path. If changing it, create the new directory before starting Compose. Workspace files use a separate named volume. Do not run multiple backend replicas against these directories.

This deployment is for trusted, invited users. The backend mounts the host Docker socket to launch isolated test containers; that socket grants control of the host Docker daemon. Language servers run in the backend container, and this is not a hardened public code-execution service. Restrict the hostname with Cloudflare Access for your group. Runner containers have networking disabled and do not join the Cloudflared network.

```sh
docker compose logs -f backend
docker compose down            # stop; retain workspace volume
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

`shared/` contains the exercise catalog, portable starter/test generation, and recommended roadmap. `server/` owns workspace storage, the JSON-RPC language-server bridge, and test runners. `src/` contains the React interface and Monaco integration. New case modules keep Go prompts/starters/tests alongside their Python/TypeScript API and test commands; register their exports in `shared/problems.ts` and `shared/languages.ts`, and add their recommended position to `shared/roadmap.ts`.
