# Member roster from 24SevenOffice — design

## Goal

`/members` in the admin app lists BISO's **paid members** as registered in
24SevenOffice (Finago), including people with no BISO account. Today it lists
Appwrite users, which is wrong.

24SO only exposes the member register through the SOAP
`CompanyService.GetCustomerCategoryTree` call: unpaginated, ~72s, and it returns
only `(categoryId, companyId)` pairs. So the roster is synced into Appwrite by
an Appwrite Function and the page reads that snapshot.

The roster is **display only**. Live membership checks (door scanner, web)
keep using their existing per-person lookups.

## Decisions

- **Who is listed:** current members only — customers holding a membership
  category whose plan (`memberships` row) has not expired.
- **Campus:** derived from the member's membership invoice `DepartmentId`,
  reverse-mapped through `CAMPUS_INVOICE_DEPARTMENT_IDS`
  (`packages/shared/utils/finago-membership-invoice.ts`, the same map the
  invoice writer uses). Unmapped/missing → `campus_id = null` ("Unknown campus").
- **Visibility:** campus admins see rows whose `campus_id` is in their managed
  campuses; global admins see everything (including National and unknown), or
  their active-campus filter.
- **Refresh:** nightly schedule plus a "Refresh now" button. Schedule,
  execution timeout and deployment are managed in the Appwrite console; the
  function config is pulled into `appwrite.config.json` afterwards by the user.
- **No sync-state table:** run status comes from Appwrite's own execution
  records (`functions.listExecutions`); failures are in the function logs.

## Components

### 1. `@repo/connectors/24sevenoffice` changes

- **Per-call SOAP request timeout.** `client.ts` bounds every call at 15s
  (`TFSO_SOAP_TIMEOUT_MS`), which aborts the ~72s tree call. Add an optional
  per-call timeout (the cached client is shared per service, so the timeout is
  applied per request, not by rebuilding the client). `getCustomerCategoryTree`
  accepts it; other callers are unchanged.
- **`getCompaniesByIds`** switches from one-call-per-id to batches of up to
  1000 via `CompanySearchParams.CompanyIds`, returning `Id`, `Name`,
  `EmailAddresses`. It has no current callers.
- **New `getMembershipInvoices(customerIds, productIds)`**: batched
  `InvoiceService.GetInvoices` by `CustomerIds`, requesting `CustomerId`,
  `DepartmentId`, `DateInvoiced` and `InvoiceRows.ProductId`; returns
  `{ customerId, departmentId, productId, invoicedAt }` for rows whose
  `ProductId` is in `productIds`.

### 2. Appwrite Function `functions/member-roster-sync/`

Workspace package (Bun runtime) depending on `@repo/connectors`, `@repo/api`
and `@repo/shared` (`workspace:*`). Verified: both `@repo/connectors/24sevenoffice`
and `@repo/api/server` load under plain Bun outside Next.js.

Environment: the same vars the apps use for `createAdminClient()` and the
existing 24SO credentials. The 24SO session is shared via the existing
`24so.auth_tokens` cache.

- `src/roster.ts` — pure logic, unit-tested with `bun test`:
  - pick active plans from `memberships` rows (by `expiryDate`), keyed by
    category id
  - fold tree pairs into one entry per customer, keeping the plan with the
    latest expiry when a customer holds several
  - pick each customer's latest matching invoice and reverse-map its
    department to a campus id
- `src/main.ts` — orchestration:
  1. **Overlap guard:** list this function's executions; if another is
     `processing`, log and exit.
  2. Load active plans from `memberships`.
  3. `getCustomerCategoryTree` (long timeout); fold to members.
  4. **Empty guard:** zero members → throw; the previous roster is untouched.
  5. Names/emails via batched `getCompaniesByIds`.
  6. Campus via batched `getMembershipInvoices`.
  7. Upsert all rows with this run's id, then delete rows with an older
     `sync_run_id` (paginated).
  8. Respond with `{ members, unknownCampus, removed, durationMs }`.

  All progress goes through `context.log`, errors through `context.error`; an
  error anywhere before step 7 leaves the previous roster intact.

### 3. Table `app.member_roster`

Added to `packages/api/appwrite.config.json` for the user to push; types
regenerated afterwards. Row security off, no client permissions — admin reads
through the server client.

| column | type | notes |
|---|---|---|
| `company_id` | integer, required | 24SO customer id; also the row `$id` |
| `name` | string | fulltext index |
| `email` | string, optional | primary email |
| `campus_id` | string, optional | null = unknown campus; key index |
| `membership_id` | string, required | product id of the latest active plan |
| `membership_name` | string, required | |
| `expiry_date` | string, required | |
| `invoiced_at` | datetime, optional | |
| `sync_run_id` | string, required | key index |

### 4. Admin `/members` page

- `listMembers` reads `member_roster` with
  `applyScopeQueries(ctx, { departmentField: null })`, search on name/email,
  ordered by name, paginated (50/page with total).
- Columns: name, email, campus (name from the `campus` table, "Unknown" when
  null), plan, expiry. The active/inactive filter goes away (everyone listed is
  current).
- Header shows "Last refreshed …" from the latest `completed` execution, and
  "Last refresh failed …" if a newer `failed` one exists.
- "Refresh now" (global admins only): a server action calls
  `functions.createExecution(id, { async: true })`. Disabled with
  "Refreshing…" while an execution is `waiting`/`processing`.
- Scanner, scan links and scan access pages under `/members` are unchanged.
- The `/members/[userId]` detail page and `getMemberDetail` are removed: roster
  rows aren't Appwrite users, so nothing links there anymore.
- New function id is read from an admin env var
  (`MEMBER_ROSTER_FUNCTION_ID`), added to `turbo.json` if needed at build.

## Open items to verify during implementation

- `GetInvoices` returns `DepartmentId` and `InvoiceRows.ProductId`, and the
  batch limit for `CustomerIds`. If `DepartmentId` isn't available, campus is
  left null and this is reported back rather than guessed.
- `GetCompanies` honours `CompanyIds` batches of 1000 in practice.

## Testing

- `bun test` for `roster.ts` (plan selection, multi-plan fold, department →
  campus mapping, unknown campus).
- Existing connector tests keep passing; add tests for the batch helpers'
  response parsing.
- `bun run check-types` repo-wide.
- Manual: run the function once from the console against production 24SO and
  check counts against Postman.
