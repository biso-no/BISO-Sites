# Whitelabel Feasibility — Data Model & Tenancy Architecture

> Investigation area 4 of 6. Analysis only — no code changes proposed here.
> This is the load-bearing area: the fork-vs-shared-infra decision documented
> at the end determines everything downstream. Per the audit brief, tradeoffs
> are laid out without a default pick.
>
> Portability tags: **portable** (a) · **moderate** (b) · **blocker** (c).

## Verdict for this area

**There is no tenant concept anywhere in the platform.** A grep for any
`org|tenant` column across all 83 tables in
`packages/api/appwrite.config.json` (9,463 lines) returns zero results. The
only scoping dimension is **campus** — an intra-org partition of exactly five
hardcoded values, one level *below* where a tenant would sit. The backend is
one self-hosted Appwrite instance (`appwrite.biso.no`), one project, two
databases (`app` = everything; `24so` = Finago integration state), 4 buckets,
1 function.

The campus mechanics are a useful *template* for a tenant discriminator (a
denormalized string ID on ~29 tables + per-row team permissions), but they
are not reusable as the tenant key: all five campuses share one user pool,
one set of org-wide teams, one ledger, one M365 tenant, one Vipps merchant.

---

## Findings

### TEN-01 · blocker · schema-wide · No tenant discriminator on any of 83 tables
**Current state:** two databases — `app` (81 tables) and `24so` (2 tables,
Finago auth/departments only, used by
`packages/connectors/src/24sevenoffice/auth.ts:21`). No `org_id`/`tenant_id`
column exists anywhere. Campus scoping exists in two coexisting flavors:
- `campus_id` — plain **string** column storing `"1"`…`"5"` on **29 tables**
  (orders, events, jobs, departments, user, webshop_products, news, pages,
  documents, form_submissions, expense_approvals, …).
- `campus` — an Appwrite **relationship** to the `campus` table on ~10 tables
  (events, jobs, departments, user, pages, …).
Many tables carry **both** (denormalized string for `Query.equal` filtering +
relationship for populated reads) — a dual representation that multiplies
migration surface for either tenancy model.
**Evidence:** `packages/api/appwrite.config.json`; only 5 campus rows exist,
enumerated in code (`apps/admin/src/lib/campus-constants.ts:14-20`).

### TEN-02 · blocker · schema-wide · Permission model can't express tenant read-isolation without re-permissioning
**Current state:** collection-level `$permissions` patterns across the 83
tables: **30 tables have empty `$permissions`** (rely purely on per-row
`rowSecurity`), **16 are `read("any")`-only**, and ~24 in total grant
`read("any")` at collection level — which **overrides row-level permissions
for reads**. Team-scoped patterns use org-wide teams:
`team:sg-app-dept-operationsunit` (70 references), `team:sg-app-dept-hr`
(11), `team:finance` (4), `label:globaladmin` (4). `rowSecurity` is enabled
on 55 tables, off on 28.
**What works in our favor:** document-level permissions ARE in active use and
prove row-scoped isolation is expressible — `buildPageRowPermissions()`
(`packages/api/page-builder.ts:61-94`) composes per-row perms from
`Role.team(OPERATIONS_UNIT_TEAM)` + the row's campus team
(`sg-app-campus-<name>`) + dept team; ~35 `Role.team(…)` call sites across
~20 files follow the same pattern.
**Why blocker (for shared infra):** the ~24 `read("any")` collections and the
org-wide team names would all need re-permissioning to a per-tenant team
scheme before row-level isolation holds.

### TEN-03 · blocker · code-wide · 189 DB call sites, no query chokepoint
**Current state:** **189 read/write call sites**
(`listRows/getRow/createRow/updateRow/upsertRow/deleteRow`) — 115 in
`apps/admin`, 30 in `apps/api`, 21 in `apps/web`, 15 in `packages/shared`, 8
elsewhere. Only **42 queries filter by campus** at all; **~147 sites carry no
scoping filter** and return org-wide data (safe today only because the org
IS the deployment). The `db` object is a thin serialization proxy
(`packages/api/server.ts:15-45`) — it does **not** intercept queries, so
there is no single place to inject a tenant filter; each call site passes
`(databaseId, tableId, queries)` directly.
**Implication:** shared-infra tenancy requires touching essentially all 189
sites (or first building a query-layer chokepoint and migrating call sites
onto it).

### TEN-04 · moderate · code-wide · IDs are literal and scattered, not centralized
**Current state:** databaseId `"app"` hardcoded at ~106 call sites, and
re-declared as a local `const DATABASE_ID = "app"` in ≥8 files
(`recruitment-workspace.ts:53`, `approvals.ts:43`, `interviews.ts:49`,
`team-provisioning.ts:8`, …); some paths honor `APPWRITE_DATABASE_ID ?? "app"`
while others hardcode — inconsistent. Collection IDs are inline string
literals throughout (`"user"`×12, `"expense"`×11, `"cart_reservations"`×11,
`"jobs"`×9, …); only orders/webshop_products are env-driven. Team IDs are
literals or string-templated from campus/dept names
(`page-builder.ts:38-47`). **No central constants/collections module
exists.** Project/endpoint default to `"biso"`/`appwrite.biso.no`
(`server.ts:45-52`) — already flagged in `PRODUCTION_READINESS_REVIEW.md:133`.
**Managed version:** a single ID/config module is prerequisite work for
*either* tenancy architecture.

### TEN-05 · moderate · storage · Buckets partially org-assumed, with config/code drift
**Current state:** 4 buckets in config — `media` (read any, write ops-unit),
`documents` (read any, write national+ops teams), `expenses` and `resumes`
(per-file permissions). Code references two buckets **absent from config**:
`avatars` (`apps/web/.../member-portal.ts:315`) and `content` (hardcoded
public URLs with `?project=biso` in `about-section.tsx:125`,
`department-hero.tsx:17`, `packages/ui/lib/placeholder-images.ts:2`).
**Managed version:** reconcile config/code drift; tenant-scoped buckets or
per-tenant prefixes; kill literal asset URLs.

### TEN-06 · moderate · `functions/` · Single cron dispatcher assumes one org
**Current state:** one Appwrite Function, `scheduled-dispatch` (bun runtime,
`*/5 * * * *`) — a pure fan-out that pings secret-gated cron endpoints in the
Next.js apps. Target URLs default to `admin.biso.no`/`api.biso.no`/`biso.no`
(`functions/scheduled-dispatch/src/main.ts` + `.env.example`); auth is one
shared `CRON_SECRET`. Targets (announcements, Tickster, Entur, cart cleanup,
Vipps reconcile, M365 retention, expense posting) each assume one org's
integrations.
**Managed version:** fork model — one function per deployment, works today.
Shared infra — per-tenant target/secret fan-out, restructure needed.

### TEN-07 · portable · platform · Self-hosted Appwrite makes project-per-tenant cheap
**Current state:** self-hosted (not Cloud), so new isolated projects carry no
per-project platform cost. `appwrite.config.json` is a complete declarative
schema (83 tables + buckets + function) enabling repeatable provisioning;
team topology provisioning code already exists
(`apps/admin/src/lib/team-provisioning.ts`). Appwrite's isolation primitives:
projects (hard isolation — separate users/teams/keys/auth), databases, teams,
labels, buckets. **Appwrite has no native row-level tenancy** (no RLS
equivalent beyond per-document permissions).

### TEN-08 · moderate · auth plumbing · Single project baked into cookie names and session model
**Current state:** cookie names `a_session_biso` / `a_session_biso_admin` are
literal at multiple sites (`apps/web/.../oauth/route.ts:28`,
`apps/admin/src/instrumentation.ts:14`, `user.ts:180`); one Appwrite project
= one auth/user namespace. Session duration 1 year, sessionsLimit 10.
**Implication:** shared infra means a shared user pool — cross-tenant user
identity, invites, and per-tenant session cookies all need design work. Fork
model sidesteps this entirely (per-project user pools).

### TEN-09 · portable-as-template · schema · Campus is a proto-tenant *pattern*, not a tenant
**Current state:** campus already scopes content (29 tables), roles
(per-campus teams `sg-app-campus-{city}`, management teams
`sg-app-dept-ledelsen{city}`), and finance routing
(`resolveApproverTeamId()` — `campus-constants.ts:69-83`). But all five
campuses share one org: one user pool, org-wide departments (Operations
Unit/HR/Finance span campuses), one ledger, one M365 tenant, one Vipps
merchant. `National=5` is an "all-campus" pseudo-scope.
**Implication:** a tenant is "an org that *has* campuses." The `campus_id`
string-discriminator pattern and the per-row team-permission pattern are
proven templates for how `org_id` scoping *would* look — but campus cannot be
repurposed as the tenant key, and a whitelabel org model must additionally
make the campus dimension itself optional/configurable (see INV-05/06).

---

## THE DECISION POINT: Fork-per-tenant (A) vs shared-infra multi-tenancy (B)

Both are laid out against the evidence above; no default pick.

### Model A — Fork/deploy-per-tenant (one Appwrite project + app deployment per org)

**What the codebase makes cheap:**
- Self-hosted Appwrite → new isolated project is native; no per-project cost
  (TEN-07). Hard isolation (users, teams, keys, data, auth providers) for
  free — no permission rework (TEN-02 irrelevant), no query rework (TEN-03
  irrelevant: all 189 call sites work unchanged).
- Top-level config is already env-parameterized (endpoint, project, API key,
  `CRON_SECRET`, all integration secrets) → a tenant ≈ a new `.env` + a
  project seeded from `appwrite.config.json`.
- Per-tenant integrations (Azure app registration, Vipps merchant, Finago
  org, SharePoint) map naturally onto per-deployment env — exactly how the
  code reads them today (AUTH-07, PAY-02).
- Appwrite-project-level OAuth provider config aligns with per-tenant IdP
  needs (AUTH-03 remediation is simpler here).

**What the codebase makes expensive:**
- The ~133 non-env BISO literals (cookie names, `?project=biso` asset URLs,
  biso.no fallbacks, allow-lists) must still be parameterized — fork does NOT
  remove the branding/org-config extraction work (areas 1, 5), it only
  removes the *data-isolation* work.
- Seeding/provisioning automation: campus rows, team topology
  (`sg-app-campus-*`, `sg-app-dept-*`), buckets (incl. the drift in TEN-05),
  the scheduler function, webhook registrations — must become a repeatable
  bootstrap. Pieces exist (`appwrite.config.json`, `team-provisioning.ts`)
  but no end-to-end provisioner does.
- **Operational cost scales linearly with tenants**: N deployments × 4 apps,
  N Appwrite projects, N cron functions, N domains/TLS, N upgrade/migration
  runs. Schema changes must roll out to every fork. This is the classic
  fork-model tax: cheap to start, expensive to operate at ≥ ~10 tenants.
- Version drift risk if tenants customize; needs discipline (single main
  branch, config-only divergence) to stay a "product" rather than N snowflake
  installs.

### Model B — Shared-infra row-level multi-tenancy (org_id on every row, one project)

**What the codebase makes cheap:**
- The `campus_id` pattern is a proven template for a scalar discriminator
  with `Query.equal` scoping (42 live examples).
- The per-row `$permissions` builder (`page-builder.ts:61-94`) proves
  team-scoped row isolation works on this Appwrite version — an org team
  could be composed into row perms exactly like campus teams are.
- One deployment, one schema migration path, one ops surface. SaaS
  economics: marginal tenant cost ≈ zero.

**What the codebase makes expensive (this list is long and structural):**
- Add + backfill `org_id` across ~81 tables; the dual
  `campus_id`/relationship representation doubles the touch points (TEN-01).
- No query chokepoint: tenant filtering must be threaded through ~189 call
  sites, ~147 of which currently have no scoping at all — each unscoped site
  is a potential cross-tenant data leak until fixed (TEN-03). Realistically
  this means first building a tenant-aware data-access layer and migrating
  every call site onto it.
- Re-permission ~24 `read("any")` collections and replace org-wide teams
  (`sg-app-dept-operationsunit` — 70 references) with per-tenant team
  namespaces, touching team-derivation logic across `page-builder.ts`,
  `campus-constants.ts`, `team-provisioning.ts` (TEN-02).
- **Shared user pool**: one project = one auth namespace. Per-tenant OAuth
  providers are *project-level* in Appwrite — so tenant-specific IdPs
  (AUTH-03) fight the platform in shared mode. Cross-tenant identity,
  invites, session cookies all need redesign (TEN-08).
- Integrations are env-shaped (one Vipps merchant, one Finago org, one Azure
  tenant, one `CRON_SECRET`) — per-tenant credentials must move from env to
  tenant-scoped DB rows (the `payment_settings` pattern from PAY-02 is the
  in-repo prototype), and the cron fan-out must be restructured (TEN-06).
- Appwrite provides no RLS-style safety net: isolation correctness rests
  entirely on application discipline at every one of those call sites.

### Facts that frame the choice (not a recommendation)

1. **Appwrite's grain favors A.** Auth providers, users, teams, and API keys
   are project-scoped. Model B fights the platform on identity; Model A uses
   it. A middle path exists — *shared codebase, project-per-tenant, one
   multi-tenant control plane* ("fork-and-configure without the fork") — and
   is what the current env-driven top layer most naturally becomes.
2. **B's migration is strictly a superset of A's.** Everything A requires
   (org-config extraction, branding, provisioning automation, per-tenant
   integrations) B also requires, *plus* the org_id/permissions/query-layer
   rework. A can evolve toward B later; the reverse investment is not
   recoverable.
3. **The cost curves cross with tenant count.** A is cheap for the first few
   tenants and linearly expensive thereafter (ops, upgrades). B is a large
   upfront engineering program (~the full blocker list above) with near-zero
   marginal tenant cost. Expected tenant count and their isolation/compliance
   expectations (student unions may *prefer* hard isolation) are the deciding
   inputs — both are business questions, not code questions.

## Classification rollup

| ID | Portability | Scope |
|---|---|---|
| TEN-01 | **blocker** | No tenant discriminator; dual campus representation |
| TEN-02 | **blocker** (for B) | `read("any")` collections + org-wide teams |
| TEN-03 | **blocker** (for B) | 189 call sites, no query chokepoint |
| TEN-04 | moderate | Scattered literal IDs, no central constants module |
| TEN-05 | moderate | Bucket org assumptions + config/code drift |
| TEN-06 | moderate | Single-org cron dispatcher |
| TEN-07 | portable | Self-hosted Appwrite; declarative schema; provisioning seeds |
| TEN-08 | moderate (A) / blocker (B) | Single project in cookies/session/user pool |
| TEN-09 | portable-as-template | Campus scoping patterns as org_id blueprint |
