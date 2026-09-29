# member-roster-sync (Appwrite Function)

Rebuilds `app.member_roster` — the paid-member register shown on the admin
`/members` page — from 24SevenOffice. Display only: live membership checks do
not read this table.

## How it works

0. Mirror every 24SO membership product into `memberships`: name, category,
   24SO price, and start/expiry dates from the name (spring 1 Jan – 30 Jun,
   fall 1 Jul – 31 Dec). What is for sale is decided from these dates by
   `@repo/shared/utils/membership-seasons`. A catalog failure stops the run.
1. Active plans = `memberships` rows with start ≤ today ≤ expiry (Oslo),
   the same rule as the live membership check.
2. `CompanyService.GetCustomerCategoryTree` (~70s, unpaginated, ~60k pairs)
   → customers holding an active plan's category; latest-expiring plan wins.
3. `GetCompanies` with `ChangedAfter` → every company (~55k, ~12s) with name,
   email and ExternalId. The tree lists some older customers by their
   ExternalId instead of their company id; each tree id resolves to the
   company with that id, else to the company whose ExternalId matches
   (a person found under both is merged).
4. `InvoiceService.GetInvoices` (1000 resolved company ids/call) → campus from the
   invoice's UserDefinedDimension `TypeId` 101 (value = campus `$id`).
   Missing or unknown → `campus_id` null, visible to global admins only.
5. Upsert all rows with a new run id, then delete rows from older runs.
   Zero members from 24SO aborts the run before any write.

Overlapping runs exit immediately. Failures return HTTP 500 and are logged,
which the admin page shows as "Last refresh failed".

## Console setup (not in code)

- Runtime: Bun. **Root directory: the repository root** (empty / `.`), not
  this folder. The function depends on `@repo/*` workspace packages and the
  root `catalog`, which only resolve when the monorepo root is in the build.
- Build command:

  ```bash
  bun install --filter member-roster-sync && bun run --cwd functions/member-roster-sync bundle && rm -rf node_modules
  ```

  This installs only this function's slice of the workspace, bundles it into
  one self-contained file (~2 MB), then drops `node_modules` (~670 MB, mostly
  Next.js via `@repo/api`) so the deployment stays small.
- Entrypoint: `functions/member-roster-sync/dist/main.js`.
- Schedule: nightly, e.g. `0 3 * * *`. Timeout: at least 600s (a production
  run is roughly 2 minutes).
- Execute access: none. The admin app starts runs with the server API key.
- Variables: `TFSO_APP_ID`, `TFSO_USERNAME`, `TFSO_PASSWORD`. Do **not** set
  `APPWRITE_*` variables — Appwrite injects its own and they take precedence.
  The project and endpoint fall back to `biso` / `https://appwrite.biso.no/v1`
  in `@repo/api/server`.
- Scopes (**Settings → Scopes**): `rows.read`, `rows.write` (member_roster,
  memberships, campus, and the `24so.auth_tokens` session cache) and
  `executions.read` (the overlap guard). Appwrite passes a key with exactly
  these scopes in the `x-appwrite-key` header on every execution; `main.ts`
  hands it to `createAdminClient()`. (`APPWRITE_FUNCTION_API_KEY` itself is
  only injected at build time.)
- The admin app's own API key needs `executions.read` and `executions.write`
  for the status line and "Refresh now".
- Keep execution logging on: the admin page reads run status from execution
  records. A skipped run answers 409 and is not shown as a refresh; a
  `processing` record older than 15 minutes is treated as stuck.
- Set the admin app's `MEMBER_ROSTER_FUNCTION_ID` to this function's id.

## Running locally

```bash
bun --env-file=apps/admin/.env.local -e '
const { default: main } = await import("./functions/member-roster-sync/src/main.ts");
await main({ log: console.log, error: console.error, req: { headers: {} }, res: { json: (d, s) => console.log(s ?? 200, d) } });
'
```

This uses `APPWRITE_API_KEY` from the env file and writes to whichever
Appwrite project it points at. A local run has no
function id, so it skips the overlap guard: don't run it while a scheduled or
manual run is in progress, or the two runs can delete each other's rows.
