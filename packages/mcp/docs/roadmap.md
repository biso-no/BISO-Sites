# Roadmap

Ordered by value over effort. Every entry names the specific thing that blocks
it, not a general "needs work".

---

## Tier 1 — unblocked, just not built

### 1.1 Content updates for news and events

Reads and drafts exist; `update` does not. An update has to rewrite the linked
`content_translations` rows and their permissions together with the parent, or a
published item ends up with a stale translation that is still publicly readable.

**Blocker:** none technical. Needs the same nested-write shape `createNews` uses
(`buildNestedTranslations`), plus a test that a partial update cannot leave the
parent and its translations disagreeing about publication.

### 1.2 Exact M365 user lookup (read only)

`GraphUserService` in `@repo/connectors/azure` is complete and framework-free —
no Next import, credentials passed to the constructor. `getUser`,
`getUserGroups`, `getUserLicenseDetails` and
`getAuthenticationMethodsSummary` are all read-only.

This would also fix the finding that `getM365UserProfile` resolves a specific
person through a fuzzy search truncated to one row.

**Blocker:** `AZURE_GRAPH_*` credentials in this process, and a projection
decision. `/api/admin/users` returns `temporaryPassword` in its response body;
any port must not, and `SENSITIVE_COLUMNS` needs Graph-shaped entries.

### 1.3 Umami analytics summary

`apps/admin/src/lib/umami/client.ts` is a plain HTTP client.

**Blocker:** `UMAMI_API_URL` / `UMAMI_USERNAME` / `UMAMI_PASSWORD` here, and a
decision about whether analytics belongs in an MCP surface at all.

### 1.4 Student services reads

`funding_programs`, `large_event`, `departures` are simple public tables.

**Blocker:** none. Deferred on value, not difficulty — `biso_public_search`
already covers most of what a student would ask.

### 1.5 Event launch review

A composite over event + linked product + ticket configuration + locale coverage.

**Blocker:** product reads exist but `webshop_products.linked_event_id` joins
are not modelled yet. Roughly a day once 1.1 lands.

---

## Tier 2 — needs a design decision first

### 2.1 Streamable HTTP transport

`createBisoMcpServer` is already transport-agnostic, so the server work is small.
The authentication work is not.

**Blockers, all four required:**

1. **Per-request identity.** The principal is resolved once at startup from one
   credential. HTTP needs one per request, from the `Authorization` header, with
   `resolvePrincipal` moving into the request path and a short cache keyed by
   token fingerprint.
2. **Per-session registration.** Registration depends on the principal, so it
   becomes per-session rather than per-process.
3. **Origin validation, loopback binding, CORS** matching
   `apps/api/src/lib/allowed-origins.ts`.
4. **Rate limiting.** `apps/api` has none. An HTTP MCP endpoint should not
   inherit that.

**Explicitly not shipping the transport without all four.** A privileged MCP
server on an unauthenticated HTTP port is worse than no HTTP transport.

### 2.2 Page document translation

`translatePageDocument` preserves structure correctly and is well tested.

**Blockers:** it lives in `apps/admin/src/lib/`, so it must move to a package
first; and it is a model call, which would make the first tool in this server to
require `OPENAI_API_KEY`. That needs an explicit decision about whether this
server should call models at all when its client already has one.

### 2.3 Membership verification and benefit reveal

**Blocker:** `computeMembershipStatus` reaches 24SevenOffice through
`@repo/shared/utils/membership`, which imports `@repo/api/server` — the Next
coupling this package avoids. Needs the same additive treatment `@repo/api` got,
or a `db`-injecting variant.

### 2.4 Expense status and diagnostics

Genuinely useful: "where did my reimbursement stop" is a common question.

**Blockers:** `expense.bank_account` is payout data and
`expense_approvals.token_hash` is a bearer credential (both already in
`SENSITIVE_COLUMNS`, so the projection is half-designed); and the module is
gated by `expenses_module` / `expenses_ledger_posting`, the latter off by
default, so the tool must report "the workflow is off" distinctly from "your
expense is stuck".

### 2.5 Announcement drafting

Draft and schedule are tractable. **Sending is `restricted` and stays out.**

**Blocker:** audience resolution spans topics, segments and broadcast, and a
delivery preview that under-counts is worse than none.

---

## Tier 3 — needs infrastructure that does not exist

### 3.1 Source-grounded document Q&A

**There is no retrieval infrastructure in this repository.** `IVectorStore` has
no implementation, `PINECONE_*` has no code references outside the docs app,
`embedding_status` is written `PENDING` and never advanced, and `jobs.embedding_id`
is never written. `apps/docs` documents Pinecone as if it were live; it is not.

Building this is a project: an embedding pipeline, an index, permission
filtering **at retrieval time** (not after), a re-index strategy, and a cost
model. Also `SharePointDocument.content` is declared and never populated — there
is no text extraction either.

**Recommendation:** do not add a document-Q&A tool that silently degrades to
keyword search. Either build retrieval properly or keep saying it does not exist.

### 3.2 Privileged M365 mutations

25 operations exist in `it-users.ts`: create, alias, group, licence, MFA reset,
password reset, session revoke, deactivate.

**Blocker:** these are the `restricted` tier. They need a real approval record
and a present human, and `resetM365Password` produces a credential that must
never reach a model's context. Not a scheduling question — a policy one.

### 3.3 Payment, refund and accounting execution

**Blockers, specific:**

- `postLedgerTransaction` sends **no idempotency key and does no dedupe
  pre-check**. A retry posts a second voucher. Fix idempotency in
  `@repo/connectors` first.
- The double-refund guard is an atomic `refund_lock` in
  `@repo/shared/utils/order-refunds`. Any second implementation is a second
  thing to get wrong.
- `payments_stripe` and `shop_ledger_posting` default OFF, which is a
  deliberate signal about readiness.

### 3.4 Bulk event operations

CSV import and auto-assign write many rows. A partial failure leaves a
half-populated segment.

**Blocker:** the admin action owns the recovery semantics. Porting them means
duplicating the recovery path too.

### 3.5 Settle what `listRows(...).total` actually counts

`apps/web/src/lib/data/queries.ts` states that on the Appwrite release this repo
is on, `total` reports the size of the whole table rather than of the filtered
result, and its `countRows` helper stopped reading it for that reason. The claim
could not be confirmed against Appwrite's published release notes, and the repo
has not adopted it everywhere — `apps/admin` still reads `.total` in some thirty
places, and `queryEvents` still returns it two functions above the warning.

This package has already been made independent of the answer wherever a count
could be taken from rows within a bounded request: `inboxCounts`, the event
audience counts, and three truncation flags (see audit §18). What still depends
on it is the `total` that accompanies a page of rows in `discovery.ts`,
`approvals.ts`, `recruitment.ts`, `content.ts`, `commerce.ts` and
`operations.submissions`, because making those independent means counting whole
result sets — an unbounded scan per listing.

**Blocker:** settling it needs one query against a real Appwrite instance —
a filtered `listRows` on a table with many non-matching rows, comparing `total`
to `rows.length`. That is a live backend query, which was outside the
boundaries of the session that built this package.

**If confirmed:** the listing totals need a bounded `countRows`-style pass with
an explicit "more than N" ceiling, and the same fix belongs in `apps/admin`,
which has the bug in more places than this package ever did.

**If refuted:** the counts changed here stay correct either way, but the comment
in `apps/web` should be corrected so the next reader does not inherit it.

### 3.6 Decide whether campus leadership reaches national events here

Since `ad20cd1`, `apps/admin` wraps its events surface — and only that surface —
in `withNationalEventScope`, adding the National campus to a campus admin's
managed campuses so campus leadership, which includes each campus's head of PR,
can list, create, edit, publish and delete national events. This package does
not follow, and `identity/scope.ts` says why: the rule lives in an app rather
than in a shared package or the row permissions, and the event tools here read
`event_attendees` and `segment_members` with the service key because those
tables have `rowSecurity: false`, which makes this package's campus check the
only thing scoping them. Widening on the strength of an app-local rule would
hand a campus admin another scope's attendee list on the service key's
authority.

The result is a real gap, not a tidy one: a campus admin who can edit a
national event in the portal gets "not found" from `biso_event_segments` and
`biso_event_audience` for the same event.

**Blocker:** this is a question for a maintainer, not a fact to look up. Is
campus leadership meant to see the attendee list of a national event, or only
to edit the event record? The portal's widening does not distinguish the two,
because everything it scopes is the event row; here the same widening would
also open the attendee and segment tables, which no backend permission guards.

**If they are:** the rule belongs in `@repo/shared` rather than in
`apps/admin/src/lib`, so both consumers derive it from one place; this package
would then apply it to the event surface only, as admin does, and the pinning
test in `identity/scope.test.ts` inverts.

**If they are not:** admin's widening needs to stop short of the attendee view,
and this package's narrower answer is already correct.

---

## Schema changes (separate future tasks)

These are Appwrite schema changes. `appwrite.config.json` is generated, so they
are made in Appwrite and regenerated — **not** by editing the file.

### S0. An index for the approvals inbox's team filter

`approval_requests` carries one index, `idx_approval_requests_status`. The
approvals inbox here filters on `status` **and** `approver_team_id`, and a
review argued that Appwrite refuses a query on an unindexed attribute, which
would make the inbox and its count fail outright for every campus admin outside
the Operations Unit override.

**Not established, and not asserted either way.** The repo's own admin portal
filters the *same table* on `campus_id` — see the optional
`Query.equal("campus_id", [ctx.activeCampusId])` in
`apps/admin/src/app/(portal)/_actions/approvals.ts` — and `campus_id` has no
index on `approval_requests` either. If the requirement held as stated, the
portal's campus-filtered inbox would be broken in the same way, in a shipped
app. Confirming the rule needs appwrite.io, which is unreachable from this
environment (the same wall the `total` question hit).

**Blocker:** adding an index is a schema change, and the schema is owned by the
Appwrite console and regenerated by the CLI — outside what this package may
edit. It also cannot be tested from here: the fake backend interprets queries
directly and has no notion of indexes, so a test would pass under either
reading.

**What to do:** ask a real instance. Run the inbox as a campus admin who is not
in the Operations Unit. If it errors, add a key index on
`(status, approver_team_id)` in Appwrite and regenerate
`packages/api/appwrite.config.json`; the query here then needs no change. If it
succeeds, the index is still worth adding before the table grows, and the
portal's `campus_id` filter wants one for the same reason.

### S1. Tighten the table-level `read("any")` grants on content

Appwrite grants access on the **union** of table and row permissions, so a
table-level `read("any")` makes every row readable no matter what its own ACL
says. That grant is on nearly every content table:

| Table | `rowSecurity` | Table-level read |
|---|---|---|
| `pages`, `page_translations` | `false` | `read("any")` |
| `webshop_products` | `false` | `read("any")` |
| `news`, `events`, `documents` | `true` | `read("any")` |
| `content_translations` | `true` | `read("any")` |
| `jobs` | `true` | `read("any")` + two teams |

The consequence is that **row permissions on these tables do nothing for read
today**. A draft's empty ACL does not hide it; a published row's `read("any")`
adds nothing. Every draft — including `pages.draft_document` — is readable by an
anonymous client, and `buildContentRowPermissions` returning `[]` for a draft is
defence in depth rather than the control it looks like.

This package therefore enforces content visibility in application code and never
delegates it to row security (`services/content.ts`, `services/pages.ts`), while
still writing the row permissions the portal writes, so the two agree.

**Impact:** `apps/web`'s public reads would need verifying against the tighter
rules, and this package could then rely on row security instead of filtering.

**Risk if done carelessly:** turning this on without backfilling permissions on
existing rows makes every page and article vanish from the public site.

### S2. An MCP audit discriminator

`audit_logs` has no column distinguishing an action taken through MCP. This
package writes `via: "mcp"` inside the JSON `payload`, which works but is not
queryable. A `source` column would let staff filter.

### S3. Fix `resolveDepartmentIds` in `apps/admin`

`apps/admin/src/lib/authorization.ts:78` resolves team-derived department names
with `Query.equal("Name", departmentNames)`. The team name is a
whitespace-deleted derivation of the stored name, and stored names are
campus-prefixed (`"OSL Fadderullan"`), so the round trip is lossy:

```
"OSL Fadderullan" → SG-App-Dept-OSLFadderullan → "OSLFadderullan"   ✗ no match
"Operations Unit" → SG-App-Dept-OperationsUnit → "Operations Unit"  ✓
```

Equality therefore resolves nothing for ordinary campus departments, and by the
fail-closed rule those members get no scope at all. It goes unnoticed because
the names that *do* match — the unprefixed national ones — belong to global
admins, who bypass scope anyway.

This is an app change and out of scope here. `@repo/mcp` does not inherit it:
`identity/department-names.ts` carries a campus-exact matcher, and
`@repo/mcp/identity` exports it for a future consolidation.

**Risk if done carelessly:** a looser match grants a member scope over a
same-named unit at another campus. The matcher here requires the campus implied
by the name's prefix to equal the row's `campus_id`, and refuses a name that
matches two rows within one campus.

### S9. Decide what unpublishing one locale should do to the page row

`unpublishPage` in `packages/api/page-builder.ts` sets `pages.status` to
`draft` whenever any locale is unpublished, with no check for a sibling. The
editor's unpublish button reaches it through `unpublishPageAction`
(`apps/admin/src/app/(portal)/_actions/pages.ts`), which passes only the id and
the locale, so the portal behaves the same way.

The repo's own model, stated in
`apps/admin/src/app/(portal)/departments/[id]/page.tsx`, is that `pages.status`
"flips to published as soon as any single locale is published" — and the
publish path matches it. Unpublish is the asymmetric half: one locale going
down takes the parent with it.

What that costs, concretely, for a page published in both locales when English
is withdrawn:

| Surface | Gates on | Norwegian after the unpublish |
|---|---|---|
| The page route (`getPage`) | the locale's `is_published` | still served |
| `cachedSitemapPages`, public page listings | `pages.status` | gone |
| `biso_public_search` here | `pages.status`, matching the site | gone |

So the page keeps working for anyone holding its URL and quietly leaves every
listing that would have led someone to it.

**Not corrected in `@repo/mcp`.** `setLocalePublished` follows
`unpublishPage` deliberately: diverging would mean the same action leaves
different state depending on whether a person used the portal or this server,
and which behaviour is right is a product question about the page model, not a
porting decision. `biso_page_publish` states the effect in its description and
in the confirmation a person is shown, so nothing here is silent about it.

**If it is settled as "keep the parent published while any locale is live":**
the change belongs in `unpublishPage`, reading the page's other translations
before writing the parent, and both surfaces inherit it. Note that the parent's
`$permissions` are rewritten in the same call — a parent that stays published
must keep its published permissions, or the row becomes unreadable while its
status still says otherwise.

### S10. `normalizeDoc` serves a saved draft's headline on a published page

`normalizeDoc` in `packages/api/page-builder.ts` overlays the translation row's
columns **over** the document's own `meta`:

```ts
title: translation.title ?? doc.meta.title,
description: translation.description ?? doc.meta.description,
```

`savePageDraft` writes those columns from the *draft*'s meta while
`is_published` stays true. `getPage` — the public catch-all route in
`apps/web` — runs every page through `normalizeDoc`, so any published page with
a draft in progress renders under the draft's headline: its `<h1>`, its
`<title>`, and whatever a link unfurler or a crawler picks up.

The same function also falls back from `puck_document` to `draft_document`
when no published document exists, so a page in that state renders its draft
outright.

This is an app change and out of scope here. `@repo/mcp` does not inherit it:
`releasedHeadline` in `services/pages.ts` reads the released document's `meta`
and has no fallback to the columns at all, and both the public and the
published-only staff paths go through it.

**If it is fixed:** the columns are still the right source for an *editor*
view, which is what they were written for — the fix is to stop preferring them
on the public read, not to stop writing them. Keeping the row columns in sync
with the published document on publish would be the alternative, and is the
larger change.

**Related:** roadmap S9 (what unpublishing one locale does to the page row)
touches the same three surfaces — route, sitemap, listings — and is worth
settling in the same pass.

### S11. A failed department lookup is reported as "no departments"

`resolveDepartmentIds` in `identity/resolve.ts` warns and returns `[]` when the
`departments` read fails:

```ts
} catch (error) {
  logger.warn("Failed to resolve department ids; failing closed", { ... });
  return [];
}
```

Failing closed is right — a lookup outage should cost the caller scope, never
grant it — and it is what `apps/admin/src/lib/authorization.ts:92` does with
the same read, so the port stays faithful. The warning goes to stderr, which is
where diagnostics belong.

What is still wrong by this package's own standard is what the *caller* is
told. `biso_whoami`, `biso_explain_permission` and `biso://identity/principal`
all then describe a principal with no departments, which is indistinguishable
from a principal who genuinely belongs to none. Everywhere else here, a result
that could not be fully computed says so: a briefing probe that fails warns
rather than reporting no findings, a search that drops a filter says which, a
count that lost one of its two queries reports itself incomplete. Scope
resolution is the one place that still answers as though the question had been
answered.

**The fix** is the shape the rest of the package already uses: return the
failure alongside the value rather than in place of it — `{ ids: [], complete:
false }` — and have the three identity surfaces relay it, the same way
`freshness` on the identity resource relays a failed membership refresh. It is
small, and it is deliberately not in this PR: it changes `Principal`, which
every tool reads, and it surfaced from a base-move inspection rather than from
a review, so it goes here rather than into a diff that is waiting on review.

**Related:** roadmap S3 is the other half of the same function — `apps/admin`
cannot match a department team by name at all, because the stored name is
campus-prefixed and the team name has its whitespace deleted.

### S7. `setProp` in `@repo/editor` follows `__proto__`

`packages/editor/src/editor/operations.ts:367` walks a dot path with
`node[key]`:

```ts
for (let i = 0; i < parts.length - 1; i++) {
  const key = parts[i];
  const next = node[key];
  if (next === null || typeof next !== "object") {
    node[key] = Number.isNaN(Number(parts[i + 1])) ? {} : [];
  }
  node = node[key] as Record<string, unknown>;
}
```

`__proto__` is an object, so the guard does not fire and `node` becomes the real
`Object.prototype`. A path of `__proto__.anything` then writes a property onto
every object in the process. A structural deep copy does not help: an object
produced by `JSON.parse` has `Object.prototype` as its prototype.

`@repo/mcp` does not inherit it — `unsafePathSegment` in `services/pages.ts`
refuses `__proto__`, `constructor` and `prototype` before `setProp` is reached,
in the service rather than only in the tool schema, and the export is available
for a shared fix. But the editor's own copilot reaches `setProp` through the
browser store with model-authored paths, so the primitive is still live in
`apps/admin`.

Changing shared editor behaviour is outside this package's scope. The fix there
is the same shape: reject prototype-bearing segments, or traverse own
properties only (`Object.hasOwn`), and freeze the check into a test.

**Risk if left:** a prompt-injected page edit corrupts `Object.prototype` for
the whole Next.js process, which can silently change the result of any later
`if (obj.someFlag)` on an object that does not define the flag.

### S4. Let an approver actually complete a benefits or news publish

`executeApprovalPublish` in `apps/admin` writes the status change with the
**approver's session client** for every domain except `events` (which routes
through `publishEvent`) and `shop` (which the admin app writes with the admin
client, and says why in a comment). But `campus_benefits` and `news` grant no
table-level `update` at all, and drafts carry no row-level update grant — so no
approver can complete those publishes, and `documents` works only for Operations
Unit.

The admin app already solved this once, for `shop`. The same treatment —
authorize the approver, then write through the admin client — would make the
`benefits`, `documents` and `news` approval paths work. That is an `apps/admin`
change and out of scope here.

Until then `APPROVAL_EXECUTION_NOTES` in `services/approvals.ts` states the
constraint per domain, and `biso_request_approval` returns it as a warning, so a
requester is told at filing time rather than discovering it when the approver's
click fails.

### S5. A shared proposal store for multi-process deployments

`createProposalRegistry` makes a proposal token single-use, but the registry is
per-process and in-memory — the same property `serverSecret` has. That is exact
for the stdio deployment, which is one process per user. A Streamable HTTP
deployment behind more than one worker would need a shared store (Redis, or an
Appwrite row keyed by token) before the single-use guarantee holds across the
fleet. See [architecture.md](./architecture.md).

### S6. A proposal or approval record for non-publish actions

The approval queue executes `<domain>.publish` and nothing else. Extending it to
updates or archives needs both a schema decision and an execution path — and,
more importantly, a decision about whether an approval queue should be a general
mutation queue at all.

### S8. Decide whether publishing is a distinct permission

`assertPublishAccess` delegates to `assertWriteAccess` — in `apps/admin`
(`authorization.ts:202`) and therefore in this package's port. So **no principal
can edit a row but not publish it**, and the organisation has no "draft it, let
someone else release it" state.

That is a policy question, not a bug, and it is the reason the approval queue
reads oddly: `approval_requests` exists, the portal's inbox consumes it, and
`createApprovalRequest` lets any authenticated user file one — but there is no
population for whom filing is *necessary*. Everyone who can file could have
published. Filing is a process choice (a second pair of eyes on something
public), which is a legitimate thing to want and a different thing from what the
table's name suggests.

Two coherent resolutions, both outside this package:

1. **Make publishing a distinct grant** — a `publish` capability held by campus
   management and global admins, with department members able to edit and draft
   only. Then the approval queue means what it looks like it means. This changes
   `apps/admin`'s authorization and every call site that publishes, so it is a
   product decision first.
2. **Keep them identical and rename the concept** — it is a *review request*,
   not an authorization escalation, and the UI should say so.

Until one is chosen, this package mirrors the repo's actual rule and states the
situation in `biso_request_approval`'s result rather than inventing a stricter
policy of its own. An earlier revision did invent one, and two review rounds
were spent on the consequences: first it accepted requests from the people it
meant to refuse, then — with the invented predicate corrected — it refused
everyone and left the tool unreachable.

---

## Staging smoke procedure — NOT RUN

No test in this package has contacted a live backend. Nothing here has been
verified against staging. Before anyone claims it works against real Appwrite:

```bash
export BISO_MCP_APPWRITE_ENDPOINT="https://<staging>/v1"
export BISO_MCP_APPWRITE_PROJECT="<staging-project>"
export BISO_MCP_APPWRITE_JWT="<jwt for a staging test user>"
export BISO_MCP_WRITE_MODE=propose      # start here, always
bun run packages/mcp/scripts/smoke-stdio.ts
```

Then, by hand:

1. `biso_whoami` — do the roles match the test user's real team memberships?
2. `biso_content_search` as a **department member** — are other departments'
   rows genuinely absent, not just filtered client-side?
3. `biso_content_get` with an id from another campus — `not_found`?
4. `biso_page_load` on a real page — do the blocks match the editor?
5. `biso_content_set_lifecycle` in `propose` mode — a proposal, and **zero**
   writes in the Appwrite console?
6. Only then, on a throwaway row, `operator` mode — does it write exactly what
   the diff said?

Use a staging project. Do not point this at production while exercising write
modes.
