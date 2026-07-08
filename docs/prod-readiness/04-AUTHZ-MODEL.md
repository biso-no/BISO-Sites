> Reconstructed 2026-07-02 from session memory after the original (uncommitted) files were lost. Wording is reconstructed; finding IDs and severities are preserved.

> **Lossy reconstruction notice:** the original S03 deep-dive document was
> approximately 288 lines. This reconstruction is built from the observation
> records retained in session memory (obs 3564, 3569–3576) plus the session
> summary supplied directly for this reconstruction task. It captures the
> architecture and the confirmed findings faithfully, but will be missing
> some of the original's narrative detail, code excerpts, and possibly
> additional minor observations that weren't captured as discrete memory
> entries. Treat this as the best available substitute, not a byte-for-byte
> recovery.

# Authorization Model — Deep-Dive (S03)

## The chain

```
Azure AD security groups
        │  (SG-App-Campus-*, SG-App-Dept-*, legacy SG-App-Role-* — no longer used)
        ▼
M365 user provisioning
        │  (admin creates users via Graph createUser(); manager assignment optional)
        ▼
Appwrite team creation
        │  (team ID derived from Azure group display name via .toLowerCase())
        ▼
Role derivation
        │  (getUserAuthContext() parses team membership → globaladmin / campusadmin / department roles)
        ▼
Document-level RLS
        (per-row $permissions stamped at create/update time, e.g. buildContentRowPermissions())
```

This is a **hybrid** authorization model: application code derives coarse
roles from Appwrite team membership (which itself mirrors Azure AD security
groups), and campus/department scoping is **attribute-based** — enforced by
app-level query scoping (`applyScopeQueries(ctx, config)`), not by Appwrite
role primitives, because Appwrite's built-in team-role model doesn't
natively express "this department, this campus" the way this domain needs.
Appwrite per-row `$permissions` act as a backstop underneath the app-level
checks.

## Primitives examined

- **`getUserAuthContext()`** (`apps/admin/src/lib/authorization.ts`) — fetches
  the caller's Appwrite team list via `teams.list()`, parses campus/department
  team IDs (Azure AD group GUIDs formatted as `SG-App-Campus-*`,
  `SG-App-Dept-*`), and derives a role: `globaladmin` (member of `National` +
  `OperationsUnit`), `campusadmin` (member of `Ledelsen{City}` +
  `Campus-{City}`), or a plain department role. `SG-App-Role-*` groups
  (finance/hr/pr/controller) are documented in code as no longer used.
  Wrapped in `React.cache()` — one `teams.list()` call per RSC render, shared
  across server-action consumers (see PR-024 for the staleness tradeoff this
  introduces).
- **`requireAuth()`** — redirects unauthenticated users to login.
- **`requireNavAccess(navKey)`** — 404s a user without role access to a nav
  section; access is gated per-role via a `NAV_ACCESS` constant in
  `roles.ts` (e.g. `portal.shop` requires globaladmin/campusadmin,
  `portal.jobs` allows department role, `portal.settings` is
  globaladmin-only).
- **`requireAdminAccess()`** — distinguishes "no session" (→ redirect to
  login) from "session but no team membership" (→ 401 unauthorized) —
  this second case is exactly the failure mode PR-015 produces for newly
  created users.
- **`applyScopeQueries(ctx, config)`** — field-aware query scoping so
  department users only see their department's rows, campus admins see
  their campus, and global admins see everything (with an
  `activeCampusId` switcher for cross-campus viewing). `resolveDepartmentIds()`
  resolves a user's department memberships to Appwrite `Departments` row IDs
  for use in these scoped queries; on lookup failure it fails closed
  (returns `[]`, i.e. no extra access), but silently (PR-028).
- **`assertWriteAccess`** and the row-permission builders
  (`buildContentRowPermissions()`, `buildContentTranslationPermissions()`,
  `buildJobRowPermissions()`, `buildRecruitmentStaffRowPermissions()`) —
  stamp per-row `$permissions` at document creation/update/publish/unpublish.
  These were reviewed and found **correctly scoped**: published-public
  content gets `read(Role.any())`; draft/unpublished content is
  team-scoped-only; write (update/delete) is always scoped to Operations
  Unit + the owning team, never campus-wide. This is the part of the model
  that's working as intended.

## M365 sync flow (`apps/admin/src/lib/m365-sync.ts`)

1. On OAuth callback, if a token is available, call Microsoft Graph
   `transitiveMemberOf` to list the user's Azure AD group membership.
2. Filter that list for `SG-App-Campus-*` and `SG-App-Dept-*` groups.
3. For each matching group, call `syncTeamMembership()`:
   - Try `teams.createMembership()` first.
   - On `404` (team doesn't exist yet) → create the Appwrite team, then add
     membership.
   - On `409` (user already a member) → call `updateExistingMembership()` to
     refresh roles.
4. Team ID = `azureDisplayName.toLowerCase()` — **no Unicode
   normalization/sanitization** (PR-016). Appwrite team IDs must match
   `^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$`; Norwegian characters (æ/ø/å), spaces,
   or other special characters in a group's display name will break team
   creation or lookup.
5. The OAuth callback (`apps/admin/src/app/(auth)/auth/oauth/route.ts:35–42`)
   calls `syncM365Permissions(userId)` and **swallows any error** — sync
   failures don't crash the sign-in, but they're also invisible to
   operators (PR-022).

This whole flow is triggered on sign-in, reading a user's *existing* Azure
group membership. It never writes to Azure/M365 — it's a one-way mirror from
Azure groups into Appwrite teams.

## The critical gap: user *creation* doesn't feed this flow

`createM365User()` (`apps/admin/src/app/(portal)/_actions/it-users.ts`) is
the *other* half of the picture — the path by which a new BISO staff member
gets an M365 account created in the first place. It calls Graph
`createUser()`, optionally sets a manager, and creates the corresponding
Appwrite `user` row. **No call to Graph's group-membership write endpoint
(`addUserToGroup` or equivalent) was found anywhere in this path.**

Combined with the sync flow above, this means: a newly created user has an
M365 account but is in zero relevant Azure security groups. Their first
admin sign-in runs `syncM365Permissions()`, which reads their (empty)
`transitiveMemberOf` list, creates zero Appwrite team memberships, and
`getUserAuthContext()` derives zero roles. The user is fully provisioned in
Azure AD/M365 and fully authenticated in Appwrite, but has **no
authorization** — a dead end. This is `PR-015`, and it matches a gap the
repo owner already suspected before S03 began ("admin M365 user-creation
reads groups but never assigns them").

## The other critical gap: collection-level permissions are load-bearing when they shouldn't be

Appwrite evaluates access as **collection permissions OR row permissions**
— if the collection grants an operation, row-level `$permissions` for that
operation are never consulted. S03 audited all 82 Appwrite collections and
found **31** grant `create("users")` (any authenticated user, regardless of
team/role) or, on 3 tables (`orders`, `cart_reservations`,
`approval_requests`), `create("any")` (unauthenticated). High-value tables
in the `create("users")` set include `payments`, `expense`, `user`,
`jobs`, `webshop_products`.

This directly undermines the intended model: document-level RLS was meant
to be a **backstop** underneath team/role-gated collection permissions, not
the *sole* enforcement layer. The admin app's own `PERMISSIONS_REVIEW.md`
(Phase 1–2 hardening, see below) fixed *read* isolation for
draft/unpublished content, but Phase 2 never touched collection-level
*create* grants — so this gap predates that hardening and survived it
untouched. This is `PR-017`.

A related architectural observation: `apps/admin/src/lib/team-provisioning.ts`'s
`grantTeamContentAccess()`/`grantTeamRecruitmentAccess()` add
`create("team:sg-app-dept-*")` (or, for HR, `create("team:sg-app-dept-hr")`)
to these same tables — but because the collection already grants
`create("users")`, this team-scoped grant is currently redundant/decorative
rather than the actual gate (`PR-020`). Once `PR-017` is resolved
table-by-table, this provisioning code becomes meaningful again.

## A third gap: the RLS backstop doesn't retract access

Row permissions are stamped **additively** at write time by app code. There
is no corresponding step — anywhere in the sync flow or elsewhere — that
removes an Appwrite team membership no longer backed by an Azure group
membership, or that re-stamps/prunes row permissions on already-created
documents when a user's access should shrink (department transfer, role
change, offboarding). The result is that access, once granted on a
document, persists even after the underlying entitlement is gone (`PR-018`).
This is a design gap, not a one-line bug — closing it likely needs a
reconciliation job or an explicit revoke-on-sync step, and was left for a
follow-up runtime session (S06/S07 in `00-PLAN.md`) rather than S03 itself.

## Prior hardening already in place (`apps/admin/PERMISSIONS_REVIEW.md`)

Before S03, a separate permissions review had already found and fixed four
issues, documented in `apps/admin/PERMISSIONS_REVIEW.md`:

- **Finding A (was high):** unpublished content (events, news, pages,
  webshop_products) was world-readable via collection-level `read("any")`
  despite row security being enabled. Fixed by removing the collection
  grant and stamping per-row read permissions on every
  create/update/publish/unpublish via `buildContentRowPermissions()`.
- **Finding B (was medium):** `listPages`/`getDashboardStats` scoped
  department users by `campus_id` (whole campus) instead of via
  `applyScopeQueries(ctx)` (department-only). Fixed by consolidating all
  page scoping onto `applyScopeQueries()`, fixing the global-admin
  `activeCampusId` switcher, and defaulting `department_id` in
  `savePageEditorDoc` for single-department users.
- **Finding D (was medium, GDPR):** recruitment PII
  (`job_applications`, `candidate_profiles`, `job_interviews`) had
  table-level read/update/delete granted to *all* department teams,
  bypassing campus isolation. Fixed by restricting table grants to
  Operations Unit + HR teams (create-only at the table level) with
  read/update/delete governed per-row via
  `buildRecruitmentStaffRowPermissions()`. `recruitment_booking_tokens` now
  uses row security. (S03 flagged a possible re-opening of this GDPR gap on
  the *create* path specifically — see `PR-021`; Phase 2 addressed reads,
  not collection-level create.)
- **Finding E (operational):** confirmed the literal team IDs referenced in
  permission code (`biso-members`, `sg-app-dept-operationsunit`,
  `sg-app-dept-hr`) exist in the configured Appwrite project as of
  2026-06-18.
- **Finding F (fixed):** removed a dead `UserAuthContext.labels` field that
  was populated but never read.

All Phase 1/2 fixes for A, B, D, F are implemented in code/schema; no
production data backfill was needed (no pre-existing rows). This work is
good evidence the team has already been iterating on this exact area — the
S03 gaps (`PR-015`–`PR-021`) are additional layers of the same problem
space that this prior review didn't cover (creation-time provisioning and
collection-level create grants, rather than read-time exposure).

## CRON / webhook / API-auth verification (partial)

- **CRON_SECRET gating:** uses `safeSecretCompare()`
  (`packages/shared/utils/secrets.ts`), which wraps Node's
  `timingSafeEqual()` for constant-time comparison — correctly applied on
  every cron endpoint checked (`cleanup-anon-users`, `post-pending`,
  `departures/sync`, `tickster/sync`), which fail closed in production. One
  endpoint (`cleanup-reservations`, per its own code comment) has a
  non-production bypass whose unreachability in the real production
  runtime needs explicit confirmation rather than assumption (`PR-025`).
- **API JWT enforcement on admin routes**, **document-creation permission
  stamping across 30+ call sites**, and **webhook signature verification**
  (Vipps/Stripe/Bot Framework) were all delegated to sub-agent verification
  passes that were still "in progress" when the last S03 observation was
  recorded. Their conclusions were not captured in retrievable session
  memory (`PR-026`). **These should be treated as unverified, not as
  passing**, until explicitly re-checked in a follow-up session.
- **CORS proxy** (`apps/api/src/proxy.ts`) was confirmed to be
  intentionally CORS-only (handles preflight, applies CORS headers) with no
  auth gate of its own — this matches its documented intent, not a bypass.

## Summary of open findings from this session

See `02-FINDINGS.md` for full detail. Quick index:

| ID | Severity | One-line |
|----|----------|----------|
| PR-015 | blocker | M365 user-creation never assigns Azure security-group membership |
| PR-016 | high | Team-ID derivation has no Unicode sanitization |
| PR-017 | blocker | 31 of 82 collections grant over-permissive `create()` |
| PR-018 | high | RLS backstop is additive-only; stale access persists |
| PR-019 | high | Duplicate `departments` table ID in schema |
| PR-020 | high | Department-team create grants redundant given PR-017 |
| PR-021 | high | Possible re-exposure of recruitment-PII GDPR gap via create() |
| PR-022 | medium | OAuth callback silently swallows M365 sync errors |
| PR-023 | medium | Sync idempotency relies on HTTP-error-code control flow |
| PR-024 | medium | `React.cache()` extends stale-access window |
| PR-025 | medium | One cron endpoint retains a non-prod bypass path |
| PR-026 | low | JWT/webhook/document-creation deep-verification left incomplete |
| PR-027 | low | Legacy `SG-App-Role-*` references not swept |
| PR-028 | low | Silent fail-closed on department-ID resolution |
