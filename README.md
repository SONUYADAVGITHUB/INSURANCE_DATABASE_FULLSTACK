
Each folder has its own detailed README — this one is just the map and
the "run both together" instructions.

## What's in here

**Backend** — `node-assessment/`
- Six MongoDB collections (Agent, User, Account, Policy Category/LOB,
  Policy Carrier, Policy Info), populated by parsing a CSV/XLSX file
  inside a `worker_thread` with dedup-on-import.
- `GET /api/policies/search` — find a user's policies by firstname.
- `GET /api/policies/aggregate` — policy count + premium total per user.
- `GET /api/messages` / `POST /api/messages/schedule` — scheduled message
  insert, UTC, persists across restarts.
- `supervisor.js` — forks the server and restarts it after sustained
  (not spiky) CPU usage crosses a configurable threshold.
- `GET /api/system/status` + `ws://.../ws/system` — the server's own
  self-reported CPU%, polled or pushed live.

**Frontend** — `policy-admin-frontend/`
- Angular 18, standalone components, signals for state.
- Screens: Dashboard, Import data, Find a user, Aggregates, Scheduled
  messages, System.
- Dashboard and Import both show a **live CPU panel** (via the backend's
  WebSocket feed) with a running peak tracker — the Import page resets
  the peak the moment an upload starts, so you can watch it spike in
  real time and see exactly how high it went once the import finishes.

## Quick start (both together)

You'll need MongoDB running locally (or an Atlas URI) before either
starts.

```bash
# Terminal 1 — backend
cd node-assessment
npm install
cp .env.example .env        # edit MONGO_URI if needed
npm run supervise           # or: npm start (no CPU-restart supervisor)

# Terminal 2 — frontend
cd policy-admin-frontend
npm install
npm start
```

Then open **http://localhost:4200**. The frontend talks to the backend
at `http://localhost:3000/api` by default (see
`policy-admin-frontend/src/environments/environment.ts` if you need to
point it somewhere else), and to `ws://localhost:3000/ws/system` for the
live CPU feed.

To see the live CPU panel do something interesting: open the **Import**
page, pick a reasonably large CSV/XLSX, and watch the "Current" and
"Peak this upload" numbers while it's parsing.

## Architecture, in one paragraph

The backend is a single Express process. File imports run in a
`worker_thread` so a large spreadsheet doesn't block the HTTP server.
CPU monitoring has two independent halves by design: `supervisor.js`
watches the server process **from outside** via `pidusage` and is the
one that actually restarts it; `cpuMonitor.js` watches the process
**from inside** via `process.cpuUsage()` purely to have something to
report over HTTP/WebSocket. The two can show slightly different numbers
since they sample on separate intervals — that's expected, not a bug.

## Environment variables

See `node-assessment/.env.example` for the full list (Mongo URI, port,
CPU threshold/interval/sustained-sample-count, CORS origin). The one
most likely to need changing is `CORS_ORIGIN`, which must match wherever
the Angular app is actually running (defaults to
`http://localhost:4200`).

## Known gaps

- No auth on either side.
- Not run against a live MongoDB in the environment these were built in
  — both were syntax-checked and build cleanly (`node --check` on every
  backend file, `ng build` for the frontend), but give it a real
  end-to-end run before treating it as final.
- The live CPU feed reconnects on drop with a fixed 3s delay (no
  exponential backoff) — fine for local dev/demo use.

## Full details

- [`node-assessment/README.md`](./node-assessment/README.md) — collections,
  API contracts, every assumption made about the source spreadsheet's
  ambiguous columns, and how the worker-thread import actually works.
- [`policy-admin-frontend/README.md`](./policy-admin-frontend/README.md) —
  design notes, per-screen backend endpoint mapping, and project layout.
