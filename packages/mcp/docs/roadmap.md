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

---

## Schema changes (separate future tasks)

These are Appwrite schema changes. `appwrite.config.json` is generated, so they
are made in Appwrite and regenerated — **not** by editing the file.

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

### S4. A shared proposal store for multi-process deployments

`createProposalRegistry` makes a proposal token single-use, but the registry is
per-process and in-memory — the same property `serverSecret` has. That is exact
for the stdio deployment, which is one process per user. A Streamable HTTP
deployment behind more than one worker would need a shared store (Redis, or an
Appwrite row keyed by token) before the single-use guarantee holds across the
fleet. See [architecture.md](./architecture.md).

### S5. A proposal or approval record for non-publish actions

The approval queue executes `<domain>.publish` and nothing else. Extending it to
updates or archives needs both a schema decision and an execution path — and,
more importantly, a decision about whether an approval queue should be a general
mutation queue at all.

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
