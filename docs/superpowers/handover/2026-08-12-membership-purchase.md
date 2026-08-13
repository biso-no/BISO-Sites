# Membership purchase — handover

Branch: `feat/membership-purchase` (18 implementation tasks + this verification
task). Spec: `docs/superpowers/specs/2026-08-12-membership-purchase-design.md`.
Working ledger for the build (task-by-task review history, now deleted with the
gitignored `.superpowers/` workspace): `.superpowers/sdd/2026-08-12-membership-purchase/progress.md`.

This file is the durable record of what a human still has to do, what was
deliberately left unfinished, what's pre-existing and unrelated, and why the
build reads the way it does in a few non-obvious places.

## Owner actions before this can work in production

The flow is **inert** until these are done — it fails closed at every gate, so
nothing breaks silently, but nobody can buy a membership either.

1. **Create the BI-tenant Azure app registration.** Set `BI_AZURE_TENANT_ID`,
   `BI_AZURE_CLIENT_ID`, `BI_AZURE_CLIENT_SECRET` in both `apps/web` and
   `apps/api` environments.
2. **Grant `User.Read.All`** (application permission, admin consent) in BI's
   tenant. Confirm `employeeId` is populated for students — the whole
   Finago-customer-id scheme is built on it.
3. **Push the schema.** `appwrite push tables` for the five new columns, then
   regenerate types: `appwrite types -l ts ./types`. **Until this runs, the
   flow fails at the first write** (the columns don't exist yet).
   `bun scripts/verify-membership-schema.mjs` validates the full column specs
   (type/size/min/max/default), not just key presence — run it after the push
   to confirm before smoke-testing.
4. **Set `price` and `canPurchase`** on the three `memberships` rows. The
   catalog is empty until then, and the purchase page shows
   `no_plans_available` for every visitor, member or not.
5. **Verify a Finago test customer's invoice is indistinguishable** from one
   BI's own app produces. Check specifically: `ProductId` (not `ProductNo`),
   `DepartmentId`, both user-defined dimension pairs, and the derived accrual
   period. This is the one step no amount of unit testing substitutes for —
   it's checking against Finago's actual interpretation, not our code's.
6. **Manual browser smoke of all six gate states** — no subagent could do
   this. In both English and Norwegian: signed out, needs BI link, needs
   directory record (BI link succeeded but no student record found),
   already member, no plans available, eligible (through to checkout).

## Known follow-ups

Carried from the build ledger, grouped by theme. Every line below was
explicitly deferred during review — not fixed, not forgotten. File/line
references are current as of commit `e5be008d` (last pre-task-19 commit);
line numbers may drift.

### Ready-to-apply, trivial fixes
These are small enough that a reviewer flagged the fix inline; nobody has
applied them because they're cosmetic/non-blocking, not because they're hard.

- `scripts/verify-membership-schema.mjs:62` — missing-table error message has
  a different format than the missing-column error message. Cosmetic only.
- `apps/web/src/lib/membership-catalog.ts:10` — comment says "newest expiry
  first"; the actual sort is `accrualMonths` ascending. Code is correct, the
  comment is wrong.
- `packages/connectors/src/azure/bi-directory.ts:76` — `user.employeeId ?? null`
  doesn't catch an empty-string `employeeId`, which would then become the
  Finago customer number. Suggested fix: `user.employeeId?.trim() || null`.
- Task 14's action-layer doc comment lists the precondition check order
  differently from the order the code actually checks them in
  (`apps/web/src/app/actions/membership-purchase.ts`).
- `packages/shared/utils/membership-fulfilment.ts:55` and `:166` — redundant
  `as { product_type?: string }` casts; `ParsedOrderItem` already types those
  fields.
- Norwegian copy polish in `membership.join.needsBiLink.linkFailed`: the
  closing clause "hvis det fortsetter å mislykkes" calques English "keeps
  failing" — "mislykkes"/"fortsetter" appear nowhere else in the `no` bundle,
  and neuter "det" mismatches common-gender "koblingen". Reviewer's suggested
  replacement: **"kontakt oss hvis koblingen fortsatt ikke fungerer."** The
  rest of that string block was independently judged genuinely idiomatic.

### Purchase-eligibility hot path — `apps/web/src/lib/membership-gate.ts`
These three came out of the same Task 13 review pass and all sit inside the
function that decides whether a user can buy a membership and at what price —
surfaced separately from the general test-gap list below because of *where*
they live, not because any one of them is individually severe.

- `offeredPlans` aliases `input.plans` by reference when `currentExpiry` is
  `null`. A future caller that mutates the returned array in place would
  mutate its own catalog input.
- `filter(Boolean)` only screens an empty-string `expiryDate` — a malformed
  non-empty value (e.g. `"N/A"`) would sort alongside valid ISO strings and
  could end up selected as `currentExpiry`.
- `isMember: true` with every membership on the account carrying an empty
  `expiryDate` silently yields the full catalog instead of surfacing an
  error.

### Operational items — worth a follow-up ticket
- **Orphaned PENDING membership orders never get reconciled.** The reconcile
  cron skips orders with no `payment_session_id`; an orphaned membership
  order (e.g. abandoned before a Vipps session was created) sits PENDING
  forever. Cosmetic, not financial — no membership is granted, no charge is
  made — but it will inflate the admin Shop dashboard's pending-order count
  over time.
- **`/membership/join` only reads the `linked` / `oidc_failed` return-leg
  params**, not the newer `?cancelled=true` / `?error=payment_failed` ones
  that `/api/checkout/return` now sends for membership orders. A buyer who
  cancels or fails payment lands back on the join page with no
  acknowledgement of what happened (better than the shop cart flow's
  behaviour, but still silent). Needs a follow-up.
- Two membership-order classifiers exist and can drift independently:
  `isMembershipOrder` (used by fulfilment) checks `product_type`;
  `/shop/order/[orderId]`'s `resolvePurchaseType` checks a `/member/i` regex
  on the order title. Pre-existing pattern, not introduced by this branch,
  but membership orders now depend on the first one being right.
- `finago_transaction_id` on an order row now carries three possible meanings
  behind one truthy check: a real Finago transaction id, a "shop ledger
  posting done" sentinel, and (new, this branch) a "membership order,
  permanently excluded" sentinel. Any future admin/reporting UI that reads
  this column as a real id must special-case both sentinels.
- `PickupInfoCard` renders unconditionally for any paid order, so a
  membership-only buyer currently sees pickup info that doesn't apply to
  them. Pre-existing UX gap, not membership-specific, but membership orders
  now hit it too.

### Dead code and cleanup candidates
- `MembershipSyncResult` interface in
  `packages/connectors/src/24sevenoffice/types.ts:151` is now fully dead
  (zero repo references). Left in place because `types.ts` was outside this
  branch's file list — a candidate for a future `knip` pass.

### Undocumented edge-case behaviour
- `resolveCampusHint`'s substring match can false-positive, and the first
  match wins with no tie-break. Judged acceptable because the hint is
  non-authoritative and user-overridable (the user can correct the campus
  before purchasing) — but that reasoning isn't written down anywhere near
  the code itself.

### Test/coverage gaps
- `packages/shared/utils/bi-student.test.ts` — `sanitizeStudentNumber(undefined)`
  branch is untested.
- Tie-breaking at the exact midpoint of `deriveAccrualMonths`'s nearest-match
  snapping (`months === 24` → snaps to 12) is undocumented and untested.
  (The snapping behaviour itself is intentional — see Design decisions below.)
- Task 3's own build report (`task-3-report.md:42`, an ephemeral file inside
  the now-deleted `.superpowers/` workspace) overstated its test coverage,
  claiming "all rejection paths tested" when coverage was actually scoped to
  `toMembershipPlan` only. Noted here purely so the discrepancy isn't lost
  along with the report it was found in — nothing to action against live code.
- `packages/shared/utils/membership-plans.test.ts:50` — a comment claims the
  22-month test case is "equidistant from 12 and 36"; it isn't (distances are
  10 vs. 14). The assertion is correct, only the comment's rationale is wrong.
- `packages/24sevenoffice` (connectors) has no test runner by design, so
  `isNotFoundError` has no direct unit test — only exercised indirectly via
  the membership-sync-merge tests.
- Order-level and row-level `UserDefinedDimensions` in the Finago invoice
  builder share the same array/object references. Harmless for
  JSON-serialization-then-POST today; worth knowing if a future change starts
  mutating one copy in place.
- `getCompanies` (24SevenOffice connector, shared by 4 callers) swallows
  search errors and returns `[]`, so a transient lookup failure looks
  identical to "customer not found." Verified this cannot mint a duplicate
  Finago customer (the id is deterministically pinned to `employeeId`) — it's
  a debuggability gap, not a correctness one.
- `MembershipInvoicePayload` only requires `CustomerId` at the type level; a
  future caller that hand-constructs a payload instead of going through
  `buildMembershipInvoiceOrder` would still type-check. (This branch's own
  caller, in Task 17's `fulfilMembershipOrder`, does go through the builder —
  verified in review.)
- `apps/web/src/lib/actions/bi-identity.ts`'s outer catch reports *any*
  unexpected failure — including our own database write failing — as
  `directory_unavailable`, conflating "Azure is down" with "our DB write
  failed." Plan-mandated, not fixed.
- TOCTOU on the `bi_campus_id` read-then-write in `bi-identity.ts`; harmless
  today because a race just re-writes the same value.
- `?linked=1` on the OAuth return leg is never stripped from the URL, so a
  page refresh re-runs the Graph call and the DB write. Deliberately not
  fixed via `redirect()` because `onboarding/page.tsx` also reads
  `params.linked` to decide whether to bounce to `/profile`, and changing
  that redirect shape risked a regression there not worth taking in a fix
  round.
- `apps/web/src/lib/actions/membership.test.ts` mocks `unstable_cache` as a
  passthrough, so the "transient failures are not cached" guarantee is not
  actually verified by any test — the happy-path, `no_categories`, and
  auth-failure branches all go untested as a result. Pre-existing pattern,
  not a regression introduced by this branch's move of the caching wrapper.
- No dedicated test file exists for
  `packages/shared/utils/membership-status.ts`, unlike its siblings in that
  directory.
- `apps/web`'s `clearBiStudentLink`: the pre-clear `getRow` is
  `.catch(() => null)`. If that read fails while the subsequent `updateRow`
  still succeeds, the membership cache tag is never busted, so `isMember`
  can read stale for up to the 10-minute TTL. Narrow edge case.
- `BiUser` type and `isOidcIdentity` are now duplicated in three places
  (`packages/connectors/src/azure/bi-identity.ts` equivalent, `apps/web`'s
  user actions, `apps/admin`'s user actions). Candidate for consolidation.
- `apps/admin`'s `removeIdentity` (BI-field-clearing-on-unlink logic) has no
  dedicated test; only `apps/web`'s does. The logic is identical in both
  apps but only one side is covered by CI.
- `checkMembership` re-derives `account.get()` + `getRow` instead of reusing
  the request-memoized `getLoggedInUser()` — forced by the frozen shared
  function signature this branch had to preserve, not an oversight.
- `orders.test.ts`'s "no `student_id`" test case is behaviourally identical
  to its non-member case (`orders.ts` delegates entirely to
  `getMembershipStatus`, so there's no distinct branch to exercise). Honestly
  disclosed as proving nothing extra, not a false-coverage claim.
- Only the Vipps timeout path has a test for the 504 branch; Stripe shares
  the identical wiring but isn't separately tested.
- `vippsCheckoutTimeoutMs()` is reused (pre-existing sibling pattern) as the
  deadline for the Stripe path too — works, but the name is misleading for a
  non-Vipps call.
- `Promise.race` in both checkout routes doesn't cancel the underlying
  provider HTTP call on timeout, so a session created just after the
  deadline is leaked provider-side. Same pre-existing pattern as the sibling
  shop-checkout route; not introduced here.
- No test asserts that a failure while writing the fulfilment "stamp" itself
  throws correctly — verified by inspection only.
- `membership-gate.test.ts:79-90` still lacks a `currentExpiry` assertion
  (behaviour verified correct by inspection during review, not by test).
- The `buildDimensions` prototype-key test (added in Task 14's fix round)
  would still pass even if only the outer prototype-key guard were
  hardened, because the outer guard short-circuits before the inner one is
  reached. Both guards are genuinely present in the shipped code — this is a
  test-independence gap only, not a coverage gap.
- `errors.noPlan` copy key in the join wizard is unreachable in practice
  (`planId` defaults to `plans[0]`, and an empty catalog is routed away
  before the wizard ever mounts).
- Page metadata on the join flow is hardcoded English, matching the existing
  convention on sibling pages (`shop/checkout`, `membership`) rather than
  being a membership-specific regression.
- The release/no-release claim contract in
  `packages/shared/utils/membership-fulfilment.ts` (`fulfilMembershipOrder`)
  isn't visible from a single read of the top-level function — it requires
  opening all five helper functions it composes (each documents its own
  contract, and `releaseClaim(` is greppable if you need to audit call
  sites).
- Marker-write ambiguity: if the client throws right after a server-side
  marker write actually succeeded, the code releases the claim while the
  marker may already be persisted, so a later retry sees `already_fulfilled`
  and never retries. This mirrors the identical, pre-existing pattern in
  `packages/shared/utils/finago-order-posting.ts` — not a new risk class.

### Residual risk — assessed and accepted, not a defect
A slow-but-successful membership checkout call, if retried by the buyer, is
bounded by the provider timeout and can at worst leave an orphaned unpayable
PENDING row — never a double charge and never a faked membership (membership
status is Finago-sourced, not derived from local orders, and the idempotency
lookup requires a `payment_link` so an orphan is never handed back to a
retrying buyer). This was independently verified during Task 15's review, not
merely asserted by the implementer.

## Pre-existing issues blocking a repo-wide green build

Task 19's verification gate is intentionally scoped to branch-touched
packages (see Design decisions below) rather than repo-wide, because two
pre-existing failures predate this branch:

1. **`apps/web` lint** — `src/components/jobs/job-application-form.tsx:150`
   (`a11y/noLabelWithoutControl`). `git log <merge-base>..HEAD -- <file>` is
   empty; this branch never touched the file.
2. **`apps/admin` test** —
   `src/app/(portal)/_actions/it-users.test.ts` throws *"This module cannot
   be imported from a Client Component module"* (a `server-only` import
   reaching a client-side test context). Last touched in a commit that is an
   **ancestor of this branch's merge-base** — i.e. it predates
   `feat/membership-purchase` entirely.
   - Ruled out as caused by this branch: `apps/admin/src/lib/actions/user.ts`
     is the **only** admin file this branch changed, and its import list is
     byte-identical to the merge-base version (confirmed by diff). The
     `import "server-only"` guard this branch *did* add lives in
     `packages/connectors/src/azure/bi-directory.ts` — which `apps/admin`
     does not import anywhere in the repo. There is no code path connecting
     this branch's changes to the admin test failure.

Both are real, both are out of scope for this branch, and neither was fixed
or worked around here per explicit owner instruction.

### A third pre-existing issue, found while scoping the Task 19 lint gate
Running `bun x biome lint` over the directories the brief specified
(`apps/web/src/app/(public)/membership`, `apps/web/src/lib`,
`apps/web/src/app/actions`, `apps/api/src/app/api/payment`,
`packages/shared/utils`) surfaces one more error, not previously catalogued:

- `packages/shared/utils/vipps-order-ops.ts:226` —
  `lint/complexity/noExcessiveCognitiveComplexity`, `applyOrderStatusTransition`
  scores 21 against a max of 20.

Confirmed unrelated to this branch: the file is **byte-identical** to its
merge-base version (`git diff <merge-base>..HEAD -- packages/shared/utils/vipps-order-ops.ts`
is empty). It's simply inside one of the directories the brief's lint command
scopes to, because that directory also holds pre-existing shop-checkout code
this branch never touched. Re-running the same lint restricted to only the
39 files this branch actually added or modified across those five paths
produces **zero errors**. Not fixed here — flagging it as a fourth candidate
for the same pre-existing-issues follow-up as the two above, in case whoever
picks that up wants to batch all three.

## Design decisions the owner made during the build

Pulled verbatim (lightly trimmed) from the ledger's `OWNER RULING` entries, in
build order, so the reasoning survives the ledger's deletion:

1. **BI student email validation (Task 2).** A plan-mandated defect was found:
   the original local-part check accepted any `bi.no` address containing a
   digit anywhere, so `ola.nordmann2@bi.no` parsed as student number `2` — a
   fabricated Finago customer id. Owner ruled: tighten local-part validation
   to `^s\d+$` (BI student addresses are always `s` followed by digits, e.g.
   `s123456@bi.no`).
2. **Accrual-period derivation, exact-date snapping (Task 3).** Reject
   unparseable membership-period dates outright, but nearest-match snapping
   of a computed span to the nearest of `{6, 12, 36}` months (e.g. a
   22-month span snapping to 12) is **accepted by design, not a defect** —
   no tolerance guard was added. Reviews from this point forward treated the
   snapping behaviour as intended, not a bug to flag.
3. **BI-identity unlink must clear membership-linked fields (Task 11).** A
   real security regression was found: the rewritten member-pricing check
   gated only on `student_id` being non-null, and the existing "Remove"
   button in Linked Accounts (both `apps/web` and `apps/admin`) never
   cleared it — so removing your BI OIDC identity kept member pricing and
   membership status indefinitely, and a transferred account would keep the
   previous holder's member pricing. Owner ruled: clear `student_id`,
   `bi_employee_id`, `bi_campus_id`, and `bi_linked_at` on unlink, gated on
   the removed identity being specifically the OIDC one — but explicitly
   **do not** add an identity-liveness check to the hot membership-status
   read path (would have added a network round-trip to every membership
   check). Known residual, accepted: if the field-clear write itself fails
   after the identity delete already succeeded, the fields stay stale until
   the next unlink/relink attempt — a direct, accepted consequence of "don't
   fail the user-facing unlink action over a best-effort cleanup write."
4. **Task 19 verification gate scope.** Scope the gate to branch-touched
   packages; hand the two pre-existing failures off as separate follow-up
   work rather than fixing them in this branch. (This is the ruling this
   task itself was executed under — see the two corrections at the top of
   its brief.)

One additional non-owner but load-bearing call, included because it changed
what later tasks had to build: mid-build, the controller found that the
gate's own state model was wrong — an empty catalog caused *non-members* to
be told they were `already_member`. Rather than escalate a straightforward
"telling someone they're already a member when they're not is simply wrong"
fix, a distinct `no_plans_available` state was added directly (owner informed
in-session, not formally ruled on). This is why the join flow renders **six**
gate states, not the five the mid-build task briefs describe: signed out,
needs BI link, needs directory record, already member, no plans available,
eligible.
