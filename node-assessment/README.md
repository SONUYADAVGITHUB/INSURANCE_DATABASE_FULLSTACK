# Node.js Technical Assessment

Policy data import (via worker threads), search, aggregation, a CPU-aware
restart supervisor, and a scheduled message insert API.

## Stack

- Node.js + Express
- MongoDB + Mongoose
- `worker_threads` (file import)
- `multer` (file upload)
- `xlsx` (reads both `.csv` and `.xlsx`)
- `pidusage` (CPU monitoring for the restart supervisor)
- `ws` (WebSocket server for the live CPU% feed)
- `cors` (allows the Angular dev server to call this API from a different origin)

## Fixed after real-world testing

A few things only surfaced once this was actually run against a live
MongoDB and a real Angular frontend (this sandbox has neither):

- **`MissingSchemaError: Schema hasn't been registered for model "Category"` /
  `"Carrier"`.** `policy.controller.js` only directly `require`s `Policy`
  and `User`, but `.populate()` on `category_id`, `company_id`, `agent_id`,
  and `account_id` needs *those* models registered with Mongoose too - and
  nothing in the main process ever required them (only the upload worker
  did, in its own separate thread/registry). Fixed by adding
  `src/models/index.js`, a barrel file that requires all six models, itself
  required once at the top of `app.js` before anything else runs.
- **CORS.** The Angular dev server (`localhost:4200`) and this API
  (`localhost:3000`) are different origins, so the browser blocked the
  aggregate response even though the API was returning it correctly. Added
  the `cors` package, applied via `CORS_ORIGIN` in `.env`.

## Setup

```bash
npm install
cp .env.example .env   # then edit MONGO_URI if needed
npm start              # plain server, no CPU-based restart
# or
npm run supervise      # runs the server under the CPU restart supervisor (Task 2.1)
```

Server listens on `PORT` (default `3000`). MongoDB must already be
running and reachable at `MONGO_URI`.

> **Note on testing in this environment:** this project was built and
> syntax-checked (`node --check` on every file) but not run end-to-end
> against a live MongoDB instance, since this sandbox has no MongoDB
> server available. Please run it against your own MongoDB (local or
> Atlas) before reviewing — happy to jump on a call if anything doesn't
> behave as documented here.

---

## Collections

| Collection | Fields |
|---|---|
| **Agent** | `name` |
| **User** | `firstname`, `dob`, `address`, `city`, `phone`, `state`, `zip`, `email`, `gender`, `userType` |
| **Account** | `account_name`, `account_type` |
| **Category** (LOB) | `category_name` |
| **Carrier** | `company_name` |
| **Policy** | `policy_number`, `policy_start_date`, `policy_end_date`, `user_id` (ref), `category_id` (ref), `company_id` (ref), `agent_id` (ref, optional), `account_id` (ref, optional), `premium_amount_written`, `premium_amount`, `policy_type`, `policy_mode`, `producer`, `csr`, `primary`, `applicant_id`, `agency_id`, `has_active_client_policy` |
| **ScheduledMessage** | `message`, `day`, `time`, `scheduledFor` (UTC), `status`, `insertedAt` |

### Where the extra spreadsheet columns went, and why

The brief named a specific set of required fields per collection.
Columns not on that list were kept (per instruction) rather than
dropped, placed on whichever model they describe:

- `premium_amount_written`, `premium_amount`, `policy_type`, `policy_mode`
  → **Policy Info**. These are values of the policy itself.
- `producer`, `csr` → **Policy Info**, as plain strings. These name the
  people who handled *this* policy transaction — distinct from `agent`,
  which already has its own collection. Rather than invent a new
  "Staff" collection for two loosely-defined columns, they're kept as
  passthrough strings on the policy that references them.
- `primary`, `Applicant ID` (→ `applicant_id`), `agency_id`,
  `hasActive ClientPolicy` (→ `has_active_client_policy`) → **Policy
  Info**, as passthrough fields. All describe the specific
  policy/application row rather than the user, category, or carrier.
- `city` → **User**. It's part of the person's address.
- `account_type` → **Account**. It describes the account, not the user
  or the policy.

### References on Policy Info

Required: `user_id`, `category_id`, `company_id`.
Optional (added for traceability, not enforced as required):
`agent_id`, `account_id`.

### Deduplication

`Agent.name`, `Account.account_name`, `Category.category_name`, and
`Carrier.company_name` each have a **unique index**, and the import
worker does a find-or-create (`findOneAndUpdate` with `upsert: true`)
per unique value, caching the resulting `ObjectId` in memory so a name
repeated across hundreds of rows only touches the database once and
every policy referencing it reuses the same document.

`User` is deduplicated on **`email`** (unique + sparse index), since the
sample data has one email per person. If a row has no email, the import
falls back to an in-memory-only composite key (`firstname` + `dob` +
`phone`) so repeats of the same person still reuse one document within
a single import run — this fallback is **not** enforced at the database
level, so two separate imports could still create duplicate emailless
users. Flagging this as a known gap rather than solving it with a
composite unique index, since blank names/DOBs/phones would make that
index collide in the opposite direction.

---

## API

### 1. Upload — `POST /api/upload`

`multipart/form-data`, field name `file`, accepts `.csv`, `.xlsx`, `.xls`.

```bash
curl -F "file=@data-sheet.csv" http://localhost:3000/api/upload
```

Parsing, dedup lookups, and inserts all happen inside a single
`worker_thread` (`src/workers/uploadWorker.js`), so the main event loop
/ HTTP server stays responsive while a large file is processed. One
worker handling the whole file was confirmed as sufficient — no
chunking/parallel workers.

The HTTP request stays open until the import finishes and returns a
summary. For much larger files this could instead return a job id
immediately with a separate status-polling route, but that wasn't
required here.

Response:
```json
{
  "message": "Import complete",
  "summary": {
    "totalRows": 1197,
    "policiesInserted": 1195,
    "rowsSkipped": 2,
    "agents": 42,
    "users": 980,
    "accounts": 610,
    "categories": 8,
    "carriers": 15
  }
}
```

### 2. Search by user — `GET /api/policies/search`

Matches the user's `firstname` (case-insensitive, exact match).
`email` is an **additional, optional** filter — it narrows results but
is never used to replace the firstname match.

```bash
curl "http://localhost:3000/api/policies/search?firstname=Alex"
curl "http://localhost:3000/api/policies/search?firstname=Alex&email=madler@yahoo.ca"
```

Returns the matching user(s) plus their policies, with `category_id`,
`company_id`, `agent_id`, and `account_id` populated.

### 3. Aggregated policy info per user

```bash
# every user
curl "http://localhost:3000/api/policies/aggregate"

# a single user
curl "http://localhost:3000/api/policies/aggregate/<userId>"
```

For each user: `policyCount`, `premiumTotal` (sum of `premium_amount`),
and the `policies` array (policy number, dates, premium, category name,
carrier name). Additional breakdowns (e.g. active vs. expired) weren't
added since the brief said this shape was acceptable.

---

## Task 2.1 — CPU-aware restart

```bash
npm run supervise
```

`supervisor.js` forks `server.js` as a **child process** and samples
its CPU usage every `CPU_SAMPLE_INTERVAL_MS` (default 2000ms) using
`pidusage`. A Node process can't cleanly restart itself from inside its
own event loop, so a small parent/child pair is used instead of trying
to self-restart — this also means it works standalone, without needing
PM2 or another process manager.

**Sustained-window approach:** the server is only restarted once its
CPU usage has been at or above `CPU_RESTART_THRESHOLD` (default `70`%)
for `CPU_SUSTAINED_SAMPLES` (default `5`) **consecutive** samples — so
a brief spike (e.g. one heavy request) doesn't trigger a restart, only
sustained load does. All three are configurable via `.env`.

CPU% here is the **server process's** CPU usage (not total system CPU),
reported the same way `top`/`htop` show it — i.e. it can exceed 100% on
a multi-core box if the process uses more than one core.

**Checking it via HTTP:** `GET /api/system/status` returns the server's
own self-reported CPU%, `restartThreshold`, `sustainedSamplesRequired`,
and how many consecutive over-threshold samples it's currently seen
(`sustainedStreak`), plus a `nearRestart` boolean once that streak would
trigger a restart. This is sampled independently, inside the server
process itself (`services/cpuMonitor.js`) — it's for dashboards/UIs to
poll, and never triggers a restart on its own; the supervisor's own
external sampling via `pidusage` is what actually decides to restart.
The two can report slightly different numbers since they sample on
separate intervals from different vantage points.

```bash
curl http://localhost:3000/api/system/status
```

**Live updates:** connect to `ws://localhost:3000/ws/system` for a push feed
of the same payload, broadcast on every sample tick
(`CPU_SAMPLE_INTERVAL_MS`) instead of having to poll. The frontend's sidebar
CPU pill uses this instead of `GET /api/system/status`.

## Task 2.2 — Scheduled message insert

```bash
# list jobs (optionally ?status=pending|inserted|failed)
curl "http://localhost:3000/api/messages"

# schedule one
curl -X POST http://localhost:3000/api/messages/schedule \
  -H "Content-Type: application/json" \
  -d '{"message": "Renewal reminder", "day": "2026-09-10", "time": "14:30"}'
```

- `day`: `YYYY-MM-DD`, `time`: 24-hour `HH:mm`.
- **Timezone assumption: both are treated as UTC.** `2026-09-10` /
  `14:30` resolves to `2026-09-10T14:30:00.000Z`. This wasn't specified
  in the brief; UTC was the preferred default.
- The scheduled time must be in the future, or the request is rejected
  with `400`.

**How the insert happens:** a job document is written immediately with
`status: "pending"` (needed to give the caller a confirmation response
and to survive a restart — see below), and an in-process `setTimeout`
is set for the delay until `scheduledFor`. When it fires, the same
document is updated to `status: "inserted"` with an `insertedAt`
timestamp — that update *is* the "insert the message at that time" the
brief describes; the pending record beforehand is bookkeeping, not the
final write.

**Persistence across restarts (bonus, not required):** on boot, the
server re-queries for any job still `status: "pending"` and
re-schedules its timer (`services/scheduler.js`). Anything already
overdue fires immediately. A full job queue (e.g. `agenda`/`bull`) would
be more robust for high volumes or multi-instance deployments, but
wasn't necessary for this assessment's scope.

---

## Environment variables

See `.env.example` for the full list with defaults (Mongo URI, port,
CPU threshold/interval/sustained-sample-count, schedule timezone note).

## Project layout

```
server.js              # starts Express + Mongo connection + scheduler rehydration
supervisor.js           # Task 2.1: forks server.js, restarts on sustained high CPU
src/
  app.js                # Express app, route mounting, error handler
  config/
    db.js               # Mongo connection helper (used by main process and worker)
    upload.js            # multer disk storage config
  models/                # Agent, User, Account, Category, Carrier, Policy, ScheduledMessage
    index.js              # requires every model once, fixes populate() MissingSchemaError
  workers/
    uploadWorker.js       # Task 1.1: parses file, dedupes refs, batch-inserts Policies
  controllers/
    upload.controller.js
    policy.controller.js  # Task 1.2 (search) and 1.3 (aggregate)
    schedule.controller.js # Task 2.2 (create + list)
  routes/
  services/
    scheduler.js          # Task 2.2 timers + restart-time rehydration
    cpuMonitor.js          # Task 2.1: self-reported CPU%, backs GET /api/system/status + WS feed
    wsServer.js            # live CPU% push over ws://.../ws/system
  utils/
    parseFile.js          # reads .csv/.xlsx into row objects
    asyncHandler.js        # forwards async controller errors to Express
```
