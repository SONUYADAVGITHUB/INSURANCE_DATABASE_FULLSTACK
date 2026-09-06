# Policy admin (Angular frontend)

A small internal console for the Task 1/2 backend: import a spreadsheet, look
up a user's policies, review the per-user aggregate, and queue a scheduled
message.

## Design notes

Built as an operations console for an insurance/underwriting backend, not a
marketing page — density and legibility over whitespace. A few deliberate
choices:

- **Type**: Spectral (serif) for the brand mark and section titles only;
  Inter for everything else; JetBrains Mono for every number, ID, and
  timestamp — this is a data-heavy app, so numeric alignment and a clear
  "this is a value, not a label" distinction earn their keep.
- **Color**: ink navy for text, a muted ledger green as the one status/accent
  color (used for the active nav item and healthy states), brass reserved
  for the single primary action per screen (upload, search, schedule), and
  brick red only for error states. Two ramps, not a rainbow.
- **Structure**: flat bordered panels (near-zero radius) rather than
  identical rounded shadow cards — reads more like a ledger sheet than a
  SaaS dashboard.

## Setup

```bash
npm install
npm start        # serves on http://localhost:4200
```

The API base URL is in `src/environments/environment.ts`
(`http://localhost:3000/api` by default) — point it at wherever the Node
backend is running. The backend must already be up with MongoDB connected
and (ideally) a file imported, or most screens will just show their empty
states.

```bash
npm run build     # production build -> dist/policy-admin-frontend
```

> Google Fonts are loaded at runtime via `<link>` in `index.html`. The
> production build has font-inlining turned off (`angular.json` →
> `fonts: false`) since it otherwise fetches fonts.googleapis.com at build
> time, which fails in network-restricted CI/build environments; the fonts
> still load fine in the browser at runtime given normal internet access.

## Screens

| Route | Backend endpoint(s) used |
|---|---|
| `/dashboard` | `GET /api/policies/aggregate` — summary metrics + top users by premium |
| `/import` | `POST /api/upload` — drag/drop or browse a `.csv`/`.xlsx`, shows the worker's import summary |
| `/search` | `GET /api/policies/search?firstname=&email=` — per-user policy tables |
| `/aggregates` | `GET /api/policies/aggregate` — full per-user rollup, filterable, expandable rows |
| `/schedule` | `GET /api/messages`, `POST /api/messages/schedule` — queues a message and lists all scheduled jobs from the database |
| `/system` | live via `ws://.../ws/system` — real-time CPU%, sustained-streak, and restart-threshold readout, also used for the sidebar's CPU pill |

## Project layout

```
src/
  index.html            # Google Fonts <link>, page title
  styles.scss           # design tokens (colors/type/radius) + shared page patterns
  environments/         # apiBaseUrl per environment
  app/
    app.component.*     # sidebar shell + router outlet
    app.routes.ts        # lazy-loaded standalone feature routes
    app.config.ts         # provideRouter, provideHttpClient
    core/
      models/policy.model.ts   # TS interfaces matching backend JSON shapes
      services/
        policy.service.ts       # upload, search, aggregate calls
        schedule.service.ts     # scheduled-message call
    features/
      dashboard/    import/    search/    aggregates/    schedule/
```

## Known gaps / next steps

- No auth — matches the backend, which doesn't have any either.
- Not run against a live backend in this environment (no MongoDB available
  in the sandbox — see the backend README). The app does build cleanly
  (`ng build`, both dev and production configurations) and was reviewed
  carefully, but please click through it against your running API before
  relying on it.
- The live CPU feed on `/system` and the sidebar pill both reconnect
  automatically on drop (fixed 3s delay), but there's no exponential
  backoff — fine for local dev, worth revisiting before any real deployment
  with many concurrent tabs open.
