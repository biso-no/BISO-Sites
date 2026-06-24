# scheduled-dispatch (Appwrite Function)

A small cron function that drives the apps' **secret-gated** background endpoints
on a schedule. The actual work lives in the Next.js apps (single source of truth);
this function just fans out HTTP pings (in parallel) carrying the shared
`CRON_SECRET`. It exists because Next.js cron only works on Vercel, and the apps
run on Appwrite Sites.

It currently drives:

| Endpoint env var | What it does | Where |
|---|---|---|
| `ANNOUNCEMENTS_DISPATCH_URL` | sends scheduled announcements whose time has passed | `apps/admin` → `POST /api/announcements/dispatch` |
| `TICKSTER_SYNC_URL` (optional) | pulls Tickster purchasers into `event_attendees` | `apps/api` → `POST /api/tickster/sync` |
| `DEPARTURES_SYNC_URL` (optional) | refreshes Entur departures | `apps/api` → `POST /api/departures/sync` |
| `RESERVATIONS_CLEANUP_URL` (optional) | deletes expired webshop cart reservations so held stock is released | `apps/web` → `POST /api/cron/cleanup-reservations` |

Only configured URLs are pinged; leave the optional ones unset to skip them. The
`*/5 * * * *` schedule (every 5 min) keeps announcements punctual and clears the
10-minute cart holds promptly.

## Environment variables

Set these on the function in the Appwrite console (**Settings → Variables**) — see
`.env.example` for a copy-paste template.

- `CRON_SECRET` — **required.** Sent to every endpoint as the `x-cron-secret`
  header, and also required on HTTP/domain triggers (see Security below).
- `ANNOUNCEMENTS_DISPATCH_URL` — full URL to the admin dispatch route.
- `TICKSTER_SYNC_URL`, `DEPARTURES_SYNC_URL`, `RESERVATIONS_CLEANUP_URL` — optional.
- `CRON_TIMEOUT_MS` — optional **per-request** timeout (default `30000`). This is
  not the execution limit — that's the function's `timeout` (see below).

### Secret model (read before enabling the optional endpoints)

The function sends a single secret (`CRON_SECRET`) as `x-cron-secret`, and **every
endpoint authenticates against `CRON_SECRET`** — admin, web, and both `apps/api`
syncs. So you only set `CRON_SECRET`, the same value, on each app.

| Endpoint | Authenticates against |
|---|---|
| `announcements/dispatch` (admin) | `CRON_SECRET` |
| `cleanup-reservations` (web) | `CRON_SECRET` |
| `tickster/sync` (api) | `CRON_SECRET` (legacy `TICKSTER_SYNC_SECRET` still honored as a fallback) |
| `departures/sync` (api) | `CRON_SECRET` (legacy `ENTUR_SYNC_SECRET` still honored as a fallback) |

If `CRON_SECRET` is unset on the target app you'll get `500`; if it differs from
what the function sends you'll get `401`.

## Security (custom domain `scheduler.biso.no`)

Appwrite treats **domain/HTTP executions as unauthenticated guests**, so anyone
hitting the domain could otherwise force-run the jobs. The handler defends
against this: when `x-appwrite-trigger` is `http`, it requires the caller to
present `CRON_SECRET` (via `x-cron-secret` or `Authorization: Bearer …`) before
pinging anything. **Scheduled** executions are platform-internal and trusted, so
the timer runs without a header.

`execute` is set to `["any"]` so the domain can actually invoke the function
(domain executions need this). The in-function secret gate keeps it safe. If you
**don't** want any manual HTTP trigger, set `"execute": []` in
`appwrite.config.json` — the schedule still runs.

Manual trigger example:

```bash
curl -X POST https://scheduler.biso.no/ -H "x-cron-secret: $CRON_SECRET"
```

## Runtime & source

The handler is **TypeScript** (`src/main.ts`) and runs on the **Bun runtime**
(`bun-1.0`), which executes TypeScript natively — there is **no build step** and
no `dist/`. `commands` is just `bun install` (the runtime needs no production
deps; `typescript`/`@types/node` are dev-only, for local type-checking). Globals
used (`fetch`, `AbortController`, `Buffer`, `process.env`) are all built in.

Locally:

```bash
bun install
bun run check-types          # tsc --noEmit
# optional: run it in a local container (needs Docker + Appwrite CLI)
appwrite run functions --function-id scheduled-dispatch
```

## Observability (logs)

Appwrite does **not** log the request/response by default, so the handler logs
every step through the runtime `log()` / `error()` helpers. View them in the
console under **Functions → scheduled-dispatch → Executions →** *(an execution)*,
split across the **Logs** and **Errors** tabs (requires `logging: true`, which is
set). Every line is prefixed `[scheduled-dispatch]`. A healthy scheduled run logs:

```
[scheduled-dispatch] start trigger=schedule method=POST
[scheduled-dispatch] config secretSet=true timeoutMs=30000 configured=[ANNOUNCEMENTS_DISPATCH_URL, …] skipped=[…]
[scheduled-dispatch] dispatching 1 ping(s): ANNOUNCEMENTS_DISPATCH_URL -> https://admin.biso.no/api/announcements/dispatch
[scheduled-dispatch] OK ANNOUNCEMENTS_DISPATCH_URL https://admin.biso.no/api/announcements/dispatch -> 200 (812ms)
[scheduled-dispatch] done {"durationMs":815,"failed":0,"succeeded":1,"total":1}
```

Things to look for when it "fails on Appwrite":

- **No `start` line** → the deployment never ran your code (build/entrypoint/runtime
  issue), not a logic bug. Check the build logs and `entrypoint`.
- **`CRON_SECRET is not configured`** (Errors) → set the variable on the function.
- **`configured=[]` / `nothing to do`** → no endpoint URL variables are set.
- **`FAIL … -> 401`** → the target's `CRON_SECRET` differs from this function's.
- **`FAIL … -> no-response: request aborted`** → the endpoint exceeded
  `CRON_TIMEOUT_MS`; raise it (and keep the function `timeout` above it).
- **`uncaught error … <stack>`** (Errors) → an unexpected throw; the stack points
  at the cause. The run still returns `500` cleanly instead of crashing opaquely.

The final response is `200` when all pings succeed, `502` when any fail, `401`
for an unauthorized HTTP trigger, and `500` for a config/uncaught error.

## Deploy

The function is deployed via the **Appwrite console** (Git integration), so the
console settings are the source of truth — not this repo. The current setup:

- **Root directory:** repo root
- **Build command:** `cd functions/scheduled-dispatch && bun install`
- **Entrypoint:** `functions/scheduled-dispatch/src/main.ts`
- **Runtime:** `bun-1.0` (runs TypeScript natively — no build step)
- **Schedule:** set this in the console (e.g. `*/5 * * * *`) — a function with an
  empty schedule never fires.
- **Timeout:** the whole-execution limit (Appwrite max 900s). Keep it above
  `CRON_TIMEOUT_MS`. Pings run in parallel, so wall-clock is the slowest single
  endpoint, not the sum.
- **Variables:** `CRON_SECRET` + the endpoint URLs (see above).
- **Scopes:** none needed — the function only makes outbound HTTP calls, never the
  Appwrite SDK.
- **Spec:** the smallest available is plenty (a few HTTP requests).

For reference, the same settings are mirrored in `packages/api/appwrite.config.json`
under `functions[]` (for anyone who deploys via `appwrite push` instead). That
mirror is not authoritative for the console deploy.
