# scheduled-dispatch (Appwrite Function)

A small cron function that drives the app's **secret-gated** background endpoints
on a schedule. The actual work lives in the Next.js apps (single source of truth);
this function just fans out HTTP pings with the shared `CRON_SECRET`.

It currently drives:

| Endpoint env var | What it does | Where |
|---|---|---|
| `ANNOUNCEMENTS_DISPATCH_URL` | sends scheduled announcements whose time has passed | `apps/admin` → `POST /api/announcements/dispatch` |
| `TICKSTER_SYNC_URL` (optional) | pulls Tickster purchasers into `event_attendees` | `apps/api` → `POST /api/tickster/sync` |
| `DEPARTURES_SYNC_URL` (optional) | refreshes Entur departures | `apps/api` → `POST /api/departures/sync` |
| `RESERVATIONS_CLEANUP_URL` (optional) | deletes expired webshop cart reservations so held stock is released | `apps/web` → `POST /api/cron/cleanup-reservations` |

Only configured URLs are pinged; leave the optional ones unset to skip them.
For reservation cleanup, run the schedule every 10-15 minutes (it matches the
10-minute cart hold, so freed stock surfaces quickly).

## Environment variables

- `CRON_SECRET` — must match the secret the endpoints check (admin uses `CRON_SECRET`;
  `tickster/sync` accepts `TICKSTER_SYNC_SECRET`, `departures/sync` accepts
  `ENTUR_SYNC_SECRET` — set those to the same value, or front them with `CRON_SECRET`).
- `ANNOUNCEMENTS_DISPATCH_URL` — full URL to the admin dispatch route.
- `TICKSTER_SYNC_URL`, `DEPARTURES_SYNC_URL` — optional.
- `CRON_TIMEOUT_MS` — optional per-request timeout (default 60000).

## Source & build

The handler is **TypeScript** (`src/main.ts`). Appwrite compiles it during the
deployment build via the `commands` below (`tsc` → `dist/main.js`), so the
function's `entrypoint` is the compiled `dist/main.js`. `typescript` and
`@types/node` are dev-only; the runtime itself uses the Node global `fetch`
(Node 18+) and needs no production dependencies. `dist/` and `node_modules/` are
git-ignored — Appwrite builds them on deploy.

Build locally with `npm install && npm run build` from this directory.

## Deploy

This is the repo's first Appwrite Function, so the shared
`packages/api/appwrite.config.json` does not yet declare a `functions` array.
**Verify the `runtime` string against your Appwrite version** (`appwrite init function`
shows the valid runtimes, e.g. `node-22`) before pushing, then add:

```jsonc
// packages/api/appwrite.config.json (top level, alongside "tables")
"functions": [
  {
    "$id": "scheduled-dispatch",
    "name": "Scheduled Dispatch",
    "runtime": "node-22",
    "entrypoint": "dist/main.js",
    "commands": "npm install && npm run build",
    "path": "functions/scheduled-dispatch",
    "execute": [],
    "events": [],
    "schedule": "*/5 * * * *",
    "timeout": 30,
    "enabled": true,
    "logging": true,
    "scopes": []
  }
]
```

Then `appwrite push functions` (or `appwrite push` / deploy via console) and set the
env vars on the function. The `*/5 * * * *` schedule runs every 5 minutes; tune as needed.
