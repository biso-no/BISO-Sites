# content-notifier (Appwrite Function)

Sends the automatic push notification when an event, news item or job goes
live. One lock row per item in `app.content_notifications` records the state
(`pending`, `sent`, `cancelled`, `skipped`); `sent` is final.

## How it works

Two kinds of execution reach this one function:

1. **Appwrite events** on `events`, `news` and `jobs` rows (create and
   update). The function re-reads the row and moves its lock: create it
   (pending, due after `NOTIFY_DELAY_MINUTES`, held through the night),
   cancel it when the item stops being eligible, reopen it when it becomes
   eligible again.
2. **A dispatch pass**, from the schedule or an HTTP ping. It re-checks every
   pending lock that is due, groups the items still eligible by channel, writes
   one announcement per channel (two or more items become one grouped
   notification), marks the locks `sent`, then pushes.

### Single-runner assumption

The dispatch pass has no claim step, so two passes at once could push the same
item twice. The design relies on one dispatcher:

- `scheduled-dispatch` pings this function every 5 minutes
  (`CONTENT_NOTIFIER_URL`). Appwrite caps a domain (sync) execution at about
  30s, far below the 5-minute interval, so pings do not pile up. Function
  timeout can stay 120s.
- Locks are marked `sent` before the push, so any failure or crash sends at
  most once, never twice.
- A best-effort overlap guard lists this function's `http`/`schedule`
  executions that are `waiting` or `processing` (created within 15 minutes)
  and, if another exists, answers `200 {"ok":true,"skipped":"already-running"}`
  without dispatching. Appwrite stores sync/domain executions only after they
  finish, so it cannot see an in-flight HTTP ping; it mainly covers scheduled
  runs. Event executions never block a pass. The current execution is
  identified by `x-appwrite-execution-id`; without it the function counts
  itself and skips when more than one dispatch execution is running.
- Appwrite event executions and HTTP pings both target this one function. Do
  not add a second schedule or a second copy of the function.

## Console setup (not in code)

- Runtime: Bun. **Root directory: the repository root**, not this folder (the
  function depends on `@repo/*` workspace packages and the root `catalog`).
- Build command:

  ```bash
  bun install --filter content-notifier && bun run --cwd functions/content-notifier bundle && rm -rf node_modules
  ```

- Entrypoint: `functions/content-notifier/dist/main.js`.
- Events (Settings → Events):
  - `tablesdb.app.tables.events.rows.*.create`
  - `tablesdb.app.tables.events.rows.*.update`
  - `tablesdb.app.tables.news.rows.*.create`
  - `tablesdb.app.tables.news.rows.*.update`
  - `tablesdb.app.tables.jobs.rows.*.create`
  - `tablesdb.app.tables.jobs.rows.*.update`

  Deploy check: edit a news row and confirm a non-400 `event` execution
  appears. If none fires, the database is legacy-type: subscribe to
  `databases.app.tables.{events,news,jobs}.rows.*.{create,update}` instead
  (the function accepts both forms, and `collections`/`documents` too).
- Execute access: `any`. This is needed for the HTTP ping through the
  function's domain; the ping must carry `CRON_SECRET` (`x-cron-secret` or
  `Authorization: Bearer`), otherwise it answers 401.
- Scopes: `rows.read`, `rows.write`, `messages.write`, `execution.read` (the
  overlap guard lists this function's executions; Appwrite's scope name is
  singular).
- Timeout: 120s. No schedule: the ping drives dispatch.
- Variables: `CRON_SECRET`; optional `NOTIFY_DELAY_MINUTES` (default 3).
  Do **not** set `APPWRITE_*` variables.
- Give the function a domain and set it as `CONTENT_NOTIFIER_URL` on
  `scheduled-dispatch`.
- Keep execution logging on.
