# member-roster-sync (Appwrite Function)

Rebuilds `app.member_roster` — the paid-member register shown on the admin
`/members` page — from 24SevenOffice. Display only: live membership checks do
not read this table.

## How it works

1. Active plans = `memberships` rows whose `expiryDate` (ISO or `DD.MM.YYYY`)
   is today or later.
2. `CompanyService.GetCustomerCategoryTree` (~70s, unpaginated, ~60k pairs)
   → customers holding an active plan's category; latest-expiring plan wins.
3. `GetCompanies` (1000 ids/call) → name and email. About 15% of tree
   customers have no company record; they keep the name from their invoice.
4. `InvoiceService.GetInvoices` (1000 customers/call) → campus from the
   invoice's UserDefinedDimension `TypeId` 101 (value = campus `$id`).
   Missing or unknown → `campus_id` null, visible to global admins only.
5. Upsert all rows with a new run id, then delete rows from older runs.
   Zero members from 24SO aborts the run before any write.

Overlapping runs exit immediately. Failures return HTTP 500 and are logged,
which the admin page shows as "Last refresh failed".

## Console setup (not in code)

- Runtime: Bun. Root directory: repository root. Entrypoint:
  `functions/member-roster-sync/src/main.ts`. Build command: `bun install`.
- Schedule: nightly, e.g. `0 3 * * *`. Timeout: at least 600s (a production
  run is roughly 2 minutes).
- Execute access: none. The admin app starts runs with the server API key.
- Variables: `APPWRITE_API_KEY`, `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`,
  `TFSO_APP_ID`, `TFSO_USERNAME`, `TFSO_PASSWORD`.
- Set the admin app's `MEMBER_ROSTER_FUNCTION_ID` to this function's id.

## Running locally

```bash
bun --env-file=apps/admin/.env.local -e '
const { default: main } = await import("./functions/member-roster-sync/src/main.ts");
await main({ log: console.log, error: console.error, res: { json: (d, s) => console.log(s ?? 200, d) } });
'
```

This writes to whichever Appwrite project the env file points at.
