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
   notification), marks the locks `sent`, then pushes. A lock that comes due
   just before 22:00 but is dispatched in the Oslo night waits for 08:00. An
   item with no title in either language goes out under its slug, or is
   cancelled (`no title`) when it has none.

A dispatch pass answers `200 {"announcements","cancelled","failed","sent"}`.
When a re-check, an announcement or lock write, or a push fails, it answers
**500** with the same counts (`failed` > 0) so `scheduled-dispatch` reports
the ping as failed; the execution's error log has the details.

### Single-runner assumption

The dispatch pass has no claim step. The design relies on one dispatcher, with
these guards for when two passes do overlap:

- `scheduled-dispatch` pings this function every 5 minutes
  (`CONTENT_NOTIFIER_URL`). The function timeout is 120s, well under the
  5-minute interval, so a pass has ended before the next ping arrives.
- Locks are marked `sent` before the push, so any failure or crash sends at
  most once, never twice.
- Each group's announcement row id is `auto_` plus the sha256 of its sorted
  lock ids (36 characters). A second pass that builds the same group gets a
  409 on that id, marks the locks `sent` with the existing announcement and
  does not push. Two passes that group differently (an item came due between
  them) are not caught by this; the guards above keep that window small.
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
  - `databases.app.tables.events.rows.*`
  - `databases.app.tables.news.rows.*`
  - `databases.app.tables.jobs.rows.*`

  These match any row event (create, update, upsert, delete). Admin saves use
  upsert, so subscribing to `.create`/`.update` alone misses them. For
  tablesdb-type databases use `tablesdb.app.tables.<table>.rows.*` instead
  (the function accepts both forms, and `collections`/`documents` too).

  Deploy check: save a news row in admin and confirm a non-400 `event`
  execution appears.
- Execute access: `any`. This is needed for the HTTP ping through the
  function's domain; the ping must carry `CRON_SECRET` (`x-cron-secret` or
  `Authorization: Bearer`), otherwise it answers 401.
- Scopes: `rows.read`, `rows.write`, `messages.write`, `executions.read` (the
  overlap guard lists this function's executions; `execution.read` is
  deprecated).
- Timeout: 120s. No schedule: the ping drives dispatch.
- Variables: `CRON_SECRET`; optional `NOTIFY_DELAY_MINUTES` (default 3).
  Do **not** set `APPWRITE_*` variables.
- Give the function a domain and set it as `CONTENT_NOTIFIER_URL` on
  `scheduled-dispatch`.
- Keep execution logging on.

## Go-live order

Follow this order. Skipping a step either pushes twice or notifies students
about old content.

1. **Deploy admin and api from this branch first.** The old admin still pushes
   events directly when they are published; with the function live as well,
   students would get two pushes.
2. **Backfill the launch locks.** From `packages/shared`, run the dry run and
   check the counts, then apply:

   ```bash
   bun run backfill:notification-locks             # dry run, prints counts
   bun run backfill:notification-locks -- --apply
   ```

   This writes a `skipped` lock for everything already published, so an edit
   to old content never notifies.
3. **Create the function** as described under "Console setup": events,
   scopes, variables, domain, and `CONTENT_NOTIFIER_URL` on
   `scheduled-dispatch`. Deploy it.
4. **Re-run the backfill dry run** and expect `Total: would create 0`.
   Anything above 0 was published between steps 2 and 3 and has no lock yet;
   run `-- --apply` again before anyone edits it.
