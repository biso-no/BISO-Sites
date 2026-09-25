# Repository audit and capability matrix

Inspected on branch `claude/biso-mcp-server-package-cfu6ck` at commit
`333165b901a72158c1afe5c5973812d1114b6493`. Every claim below was verified by
reading the code at that commit; where a claim could not be verified it says so.

---

## 1. What exists

### Applications

| App | Port | Auth | AI |
|---|---|---|---|
| `web` | 3000 | Appwrite session cookie `a_session_biso_web`, lazy anonymous sessions, no middleware | One import: `screenApplication` in `actions/jobs.ts:571` |
| `admin` | 3001 | Cookie `a_session_biso_admin`, roles from Appwrite teams synced from Azure AD | The admin assistant, page-editor copilot, translation, recruitment, IT remediation |
| `api` | 3003 | Appwrite JWT via `Authorization: Bearer`, plus `CRON_SECRET` and provider signatures | Expense OCR and summary |
| `docs` | 3002 | Public | None |

### Packages

`@repo/api` (Appwrite access + generated types), `@repo/editor` (in-house block
editor), `@repo/ui`, `@repo/ai`, `@repo/connectors` (Azure/Graph, SharePoint,
24SevenOffice/Finago, Teams bot, Tickster, SMTP), `@repo/payment` (Vipps,
Stripe), `@repo/i18n`, `@repo/shared`, `@repo/tours`, `@repo/wp-import`,
`@repo/typescript-config`.

### Schema

`packages/api/appwrite.config.json`: 2 databases (`app`, `24so`), **91 tables**,
4 buckets (`media`, `documents`, `expenses`, `resumes`), 21 messaging topics, 1
function (`scheduled-dispatch`, `*/5 * * * *`).

---

## 2. Every active AI entry point

Twelve, complete. Nothing else in the repo calls a model.

| # | Location | What it does | Model |
|---|---|---|---|
| 1 | `apps/admin/src/app/api/assistant/route.ts` | The admin assistant: a 12-step tool loop over ~20 tools | `gpt-5.6-terra` |
| 2 | `apps/admin/src/app/api/page-editor/ai/chat/route.ts` | Page-editor copilot | `gpt-5.6-terra` |
| 3 | `apps/admin/src/app/api/translate-page/route.ts` | Translates a PageDoc; **persists nothing** | `gpt-5.6-luna` |
| 4 | `apps/admin/(portal)/_actions/jobs.ts` | Job translation draft, section suggestion | `gpt-5.6-luna` |
| 5 | `apps/admin/(portal)/_actions/events.ts` | Event translation draft | `gpt-5.6-luna` |
| 6 | `apps/admin/(portal)/_actions/announcements.ts` | Announcement translation draft | `gpt-5.6-luna` |
| 7 | `apps/admin/(portal)/_actions/it-remediation.ts` | Department resolution over licensed M365 users | fast tier |
| 8 | `apps/admin/(portal)/jobs/[id]/applications/_actions/recruitment-ai.ts` | Bulk email drafts, comparison synthesis, recruitment assistant | balanced |
| 9 | `apps/admin/src/lib/content-translation.server.ts` | The shared field translator | `gpt-5.6-luna` |
| 10 | `apps/api/src/app/api/expenses/ocr/route.ts` | Receipt and bank-statement extraction | balanced |
| 11 | `apps/api/src/app/api/expenses/summary/route.ts` | Expense summary | fast |
| 12 | `apps/web/src/app/actions/jobs.ts:571` | Applicant screening, inside `after()` | balanced |

Plus `packages/i18n/scripts/translate.ts`, a build-time script.

### There is no retrieval assistant

- `packages/ai/src/utils/vector-store.types.ts` defines `IVectorStore`. **Nothing
  implements it.** Its only consumer is a `export *` in `utils/index.ts`.
- `PINECONE_API_KEY` / `PINECONE_INDEX_NAME` are in `turbo.json` and
  `.env.example` and have **zero references** in any `.ts`/`.tsx` file outside
  `apps/docs`, which documents Pinecone as if it were live.
- `job_applications.embedding_status` and `candidate_profiles.embedding_status`
  are written `PENDING` on create (`apps/web/src/app/actions/jobs.ts:485,518`)
  and **nothing ever advances them**. `jobs.embedding_id` is never written.
- `packages/ai/src/config.ts` exports `createAIConfig`, `adminAssistantConfig`
  and `publicAssistantConfig`. **All three have zero callers.**

The screener uses `generateObject` over resume text. No embeddings, no vector
search, no RAG.

---

## 3. Verification of the earlier review

All findings reproduce at `333165b`.

| Claim | Verdict | Evidence |
|---|---|---|
| `AssistantActionDeps` is a loose function record | **Confirmed** | `packages/ai/src/assistant/types.ts:55` |
| `searchContent` declares `limit`; the adapter drops it | **Confirmed** | schema at `tools/read.ts:34`; adapter destructures `{domain, query, status}` at `route.ts:456` |
| Several domains ignore the search term | **Confirmed** | `news`, `pages`, `documents` never receive `query`; `benefits` is called with `q: ""` (`route.ts:472`) |
| Result shapes differ | **Confirmed** | `shop`/`benefits` return `.rows`; the rest return the raw action result |
| Generic schemas advertise operations the adapters lack | **Confirmed** | `documents` is in the create/update schemas, absent from both switches; `benefits` is in the delete schema, absent from that switch |
| `getM365UserProfile` delegates to a fuzzy search | **Confirmed** | `route.ts:635` — `searchM365Users({ query: userId, limit: 1 })` |
| `navigate`/`fillForm`/`showDraftPreview`/`confirmAction`/`requestApproval` are client-resolved | **Confirmed** | `tools/client-tools.ts` — none has an `execute` |
| Page-editor tools are advisory | **Confirmed** | all 8 `execute` bodies return canned strings; `generate_copy` returns a literal placeholder; `list_blocks` returns *"Use the page context in your system prompt instead."* |
| Approval execution is publish-only | **Confirmed** | `buildApprovalPublishPlan` throws unless `<domain>.publish` over 6 domains |
| Integration health checks configuration presence only | **Confirmed** | `checkIntegrationHealth((key) => Boolean(process.env[key]?.trim()))` |
| Flags default payment/accounting capabilities off | **Confirmed** | `payments_stripe`, `shop_ledger_posting`, `expenses_ledger_posting` all `defaultEnabled: false` |
| Vector-store types do not prove a retrieval assistant | **Confirmed** — see §2 | |

### One correction

> *"`packages/api/server.ts` imports `next/headers`; passing a JWT does not remove the module-level Next dependency."*

The import-graph statement is right; the practical consequence is milder than
implied. Probed empirically under Bun 1.3.11:

```
OK    @repo/api/server: keys=createAdminClient,createPublicClient,createSessionClient,…
OK    @repo/api/page-builder: keys=PAGE_LOCALES,getPage,…
OK    createSessionClient(jwt) returned: account,db,teams,storage,functions,messaging
FAIL  createSessionClient() no-jwt: `cookies` was called outside a request scope.
```

The module **does** import in a plain Bun process, and the JWT path works. Only
the cookie path fails. This package still avoids it, for three reasons that are
choices rather than necessities: it drags the whole Next runtime into a stdio
process; `"use server"` has real semantics under other loaders and bundlers; and
`createAdminClient()` reads its key from module scope with no way to inject
credentials or hold two configurations. Hence `packages/api/runtime.ts`.

### Two findings the earlier review did not cover

**1. The assistant's capability map contradicts the portal's nav rules.**
`buildAssistantCapabilities` (`authz.ts:45`) gives any department member
`domains.jobs: "write"`, so `buildAssistantTools` registers the content tools for
them. But `NAV_ACCESS["portal.jobs"]` is `[GLOBAL_ADMIN, HR]`, and
`toRecruitmentAdminScope` returns an empty scope for anyone who is neither, so
`listJobs` short-circuits to an empty list. Not a leak — the backend fails closed
— but the assistant advertises vacancy tools that can never work for most staff.
This package gates recruitment on the recruitment policy instead, so the tools
are simply not registered.

**2. `pages` and `page_translations` have row security disabled with a
table-level `read("any")` grant.** Every page draft, including
`draft_document`, is readable by an anonymous Appwrite client. `page-builder.ts`
builds row permissions as if row security were on, which suggests intent to
enable it. Out of scope to change here (it is an Appwrite schema change, and
`appwrite.config.json` is generated), but it directly shapes the design: page
visibility is enforced in application code in this package and never delegated
to row security. Tests pin that. Recorded in [`roadmap.md`](./roadmap.md).

---

## 4. Capability matrix

`Status`: **Reusable** (works today, reused) · **App-coupled** (works, but
inside an app) · **Partial** · **Schema-only** · **New**.
`Decision`: **Implemented** · **Deferred** · **Excluded**.

### Identity and discovery

| Capability | Source | Status | Scope | Effects | Decision |
|---|---|---|---|---|---|
| Current principal + effective capabilities | `admin/lib/authorization.ts#getUserAuthContext`, `shared/utils/team-roles` | App-coupled (pure helpers reusable) | self | read | **Implemented** — `biso_whoami`; derivation ported, pure helpers imported |
| Campus / department lookup | `_actions/lookups.ts`, `departments` table | Reusable | public | read | **Implemented** — `biso_list_campuses`, `biso_list_departments` |
| Exact entity resolution | — | New (the assistant's M365 equivalent is a fuzzy search) | public | read | **Implemented** — `biso_resolve_department` refuses ambiguity with candidates |
| Feature-flag state | `shared/utils/feature-flags` (catalogue) + table | Reusable | staff | read | **Implemented** — `biso_list_feature_flags`. Toggling **excluded**: turning a flag on to make a tool work is the opposite of respecting it |
| Permission explanation | derived | New | self | read | **Implemented** — `biso_explain_permission` |

### Public discovery

| Capability | Source | Status | Decision |
|---|---|---|---|
| Events / news / vacancies / pages / units / benefits / documents | `web/src/lib/data/public-content.ts`, `queries.ts` | Reusable (patterns) | **Implemented** — `biso_public_search`, on the anonymous client |
| Published page read | `page-builder#getPage` | App-coupled | **Implemented** — `biso_public_get_page`, published document only |
| Member-only benefit codes | `campus_benefits.redemption_*` | Reusable | **Excluded from public** — codes are what a membership buys; the projection omits them |

### Content operations

Per-domain support. Every gap carries a reason; `biso_list_capabilities` returns
this at runtime and `content-registry.test.ts` asserts no gap is unexplained.

| Domain | Table | search | get | create draft | update | publish | unpublish | archive | delete |
|---|---|---|---|---|---|---|---|---|---|
| jobs | `jobs` | ✅ | ✅ | ❌ rubric/questions/template belong to the recruitment studio | ❌ | ❌ scheduled-publish + translation-permission sequence | ❌ | ❌ | ❌ cascades to applications |
| events | `events` | ✅ | ✅ | ✅ | ❌ pricing/capacity/tickets/segments move together | ✅ | ✅ | ❌ `cancelled` is user-visible with messaging consequences | ❌ cascades |
| news | `news` | ✅ | ✅ | ✅ | ❌ must rewrite translation rows + permissions together | ✅ | ✅ | ❌ no such status | ❌ orphans translations |
| benefits | `campus_benefits` | ✅ | ✅ | ❌ partner + redemption config | ❌ | ✅ | ✅ | ✅ | ❌ **the assistant advertises this and has no adapter case** |
| products | `webshop_products` | ✅ | ✅ | ❌ sales type, pricing, stock, custom fields | ❌ | ❌ needs `assertProductBookable` + service key | ❌ | ❌ | ❌ affects order history |
| documents | `documents` | ✅ | ✅ | ❌ **row is SharePoint metadata; needs an upload first — the assistant advertises this with no adapter** | ❌ | ✅ | ✅ | ❌ no such status | ❌ orphans the file |
| pages | `pages` | ✅ | ✅ | → `biso_page_*` | → | → | → | ❌ | ❌ |

### Pages and the block editor

| Capability | Source | Status | Decision |
|---|---|---|---|
| Load page/locale document | `page-builder#getPageEditorById` | App-coupled | **Implemented** — real `PageDoc`, real blocks |
| Block schema and variants | `editor/src/blocks/*/index.tsx` | App-coupled (React) | **Implemented** — restated as data with a compile-time exhaustiveness proof against `BlockType` |
| Insert / remove / reorder / set prop / set variant | `editor/src/editor/operations.ts` | Reusable (pure) | **Implemented** — the editor's own functions, via a new additive export |
| Brand accents | `editor/src/theme/presets.ts` | Reusable | **Implemented** — off-brand hex refused, not written |
| Feed binding | `editor/src/editor/page-feeds.ts` | Reusable | **Implemented** (read) — reported in the block catalogue |
| Draft save + publish | `page-builder#savePageDraft/publishPage` | App-coupled | **Implemented** — same permission and copy semantics, revision-checked |
| Translate a page document | `admin/lib/page-document-translation.ts` | App-coupled | **Deferred** — the translator is a model call behind an app module; see roadmap |

### Approvals, commerce, events, recruitment, communications, IT, operations

| Domain | Capability | Status | Decision |
|---|---|---|---|
| Approvals | Pending queue, detail | Reusable | **Implemented** |
| Approvals | File a publish request | Reusable | **Implemented** — restricted to the 6 executable domains |
| Approvals | Approve / reject | App-coupled | **Excluded** — `approveRequest` also *executes* the publish; doing that from a model-driven tool means publishing for an approver who clicked nothing |
| Commerce | Order search + detail + state diagnostics | Reusable | **Implemented** |
| Commerce | Refunds | App-coupled | **Excluded** — the double-refund guard is an atomic `refund_lock` in `shared/utils/order-refunds`; a second implementation is a second thing to get wrong |
| Commerce | Finago posting / reversal | Reusable, flag-gated off | **Excluded** — `postLedgerTransaction` has **no idempotency key and no dedupe pre-check**; a retry posts a second voucher |
| Events | Segments, attendee counts, audience preview | Reusable | **Implemented** (read) |
| Events | CSV import, auto-assign, message segment | App-coupled | **Deferred / excluded** — bulk writes with partial-failure semantics; messaging is `restricted` |
| Recruitment | Vacancy list/detail, applications with screening scores | Reusable | **Implemented** (read, HR-gated) |
| Recruitment | Review/stage changes, emails, interviews, booking | App-coupled | **Deferred** — hiring decisions and outbound mail stay with humans |
| Communications | Announcements, audience, send | App-coupled | **Deferred** — sending is `restricted` |
| IT / M365 | 25 operations in `it-users.ts` | App-coupled | **Deferred** — read diagnostics are viable; `/api/admin/users` returns `temporaryPassword` in its body, so any port must not |
| Operations | Inbox counts, submissions | Reusable | **Implemented** — submissions return field **names** only |
| Operations | Integration configuration | Reusable | **Implemented** — named `configuration`, never `health`; nothing is contacted |
| Operations | Umami analytics | App-coupled | **Deferred** — an HTTP client + credentials this process does not have |
| Expenses | Status, OCR, approval chain | App-coupled | **Deferred** — `expense.bank_account` is payout data; `expense_approvals.token_hash` is a bearer credential; both are in the redaction list already |
| Membership | Verification, benefits, reveal | App-coupled | **Deferred** — `computeMembershipStatus` reaches 24SO through `@repo/shared` behind `@repo/api/server` |
| Student services | Funding programs, large events, departures | Reusable (read) | **Deferred** — real tables, low marginal value over public search |
| **Varsling** | `varsling_settings` | Configuration-only | **Excluded, deliberately** — there is **no reports table**; the only data is recipient routing (campus, role name, email). Recipient addresses are in `SENSITIVE_COLUMNS` and never returned |
| WordPress import | `packages/wp-import` | Operator script | **Excluded** — a migration tool, not a product capability |

### Composite workflows

| Workflow | Decision |
|---|---|
| Campus briefing | **Implemented** — `biso_campus_briefing`, deterministic, source-linked |
| Content quality audit | **Implemented** — `biso_content_quality_audit`, explicit about what it does **not** check (translation quality, accessibility, link resolution) |
| Event launch review | **Deferred** — needs product/ticket linkage reads this release does not have |
| Member support explanation | **Deferred** — needs membership verification |
| Recruitment preparation | **Deferred** — reads exist; scheduling does not |
| Semester handover review | **Deferred** — needs M365 reads |
| Expense/payment exception triage | **Partial** — `biso_get_order` does the payment half |
| Cross-campus campaign | **Deferred** — needs announcements |
| Permission explanation | **Implemented** — `biso_explain_permission` |
| Source-grounded document Q&A | **Deferred** — no retrieval infrastructure exists (§2); building one is a project, not a tool |

---

## 5. Every existing AI tool, accounted for

| Assistant tool | Decision |
|---|---|
| `searchContent` | **Reimplemented** as `biso_content_search`, with `limit`, uniform text search, one shape, reported scope |
| `getContent` | **Reimplemented** as `biso_content_get`, with revision and out-of-scope → `not_found` |
| `getDashboardStats` | **Adapted** into `biso_campus_briefing` |
| `listPendingApprovals` | **Reimplemented** as `biso_list_pending_approvals` |
| `approveRequest` / `rejectRequest` | **Excluded** — see above |
| `draftBilingualContent` | **Excluded** — the MCP client's own model already has the context; a second model call would be redundant |
| `createContent` | **Narrowed** to `biso_content_create_draft` for news and events, with typed fields instead of `z.record(z.string(), z.unknown())` |
| `updateContent` | **Deferred** — see the matrix |
| `publishContent` | **Reimplemented** as `biso_content_set_lifecycle` with a per-domain support check |
| `deleteContent` | **Excluded** this release |
| `searchOrders` / `getOrderSummary` | **Reimplemented** with diagnostics |
| `lookupCustomer` | **Deferred** — `user` rows carry `bank_account`/`swift`; needs a narrower projection than the assistant's |
| `searchM365Users` / `createM365User` / `getM365UserProfile` | **Deferred** — creation is `restricted`; exact lookup is a roadmap item |
| `getFeatureFlags` | **Reimplemented** |
| `toggleFeatureFlag` | **Excluded** — deliberately |
| `getInboxCounts` | **Reimplemented**, with a note for non-approvers |
| `getOpsHealth` | **Reimplemented** as `biso_integration_configuration`, renamed for accuracy |
| `getAnalyticsSummary` | **Deferred** |
| `navigate` / `fillForm` / `showDraftPreview` | **Mapped to links and proposals** — these need a browser |
| `confirmAction` | **Replaced by host elicitation** — a model calling a confirmation tool confirms nothing |
| `requestApproval` | **Reimplemented** as `biso_request_approval`, writing a real `approval_requests` row |
| Page-editor `insert_block`/`remove_block`/`set_prop`/`set_variant`/`apply_accent`/`bind_collection` | **Reimplemented** as real document edits with per-edit outcomes |
| Page-editor `generate_copy` | **Excluded** — it returns a placeholder string that can be written into a live page |
| Page-editor `list_blocks` | **Reimplemented** as `biso_page_load`, which actually reads blocks |

---

## 6. Defects found in this package by review, and fixed

An automated review of the first revision (`da0e362`) raised nine issues. All
nine were verified against primary sources before any change — the Appwrite
schema, the `apps/admin` code they touch, and, where the claim was about SDK
timing, the SDK source and a probe. Seven reproduced as stated, one reproduced
with a different impact than reported, and one was a paging defect that also
revealed a missing cursor.

| # | Area | Verified as | Fix |
|---|---|---|---|
| 1 | `identity/resolve.ts` | **Confirmed.** `Query.equal("Name", …)` never matches a campus-prefixed department, so every ordinary department member resolved to zero scope | Campus-exact matcher in `identity/department-names.ts` |
| 2 | `services/commerce.ts` | **Confirmed.** `orders` grants `read("team:sg-app-dept-operationsunit")` at table level, so `getOrder` returned any campus's buyer name, e-mail, totals and line items by id, while `searchOrders` scoped correctly | `canReadRow` before returning; `not_found`, never `forbidden` |
| 3 | `services/pages.ts` | **Confirmed.** A published page short-circuited the ownership check, and `load()` prefers the draft, so out-of-scope staff could read unreleased edits | Published pages expose their *published* document only; `documentSource` says which |
| 4 | `services/content.ts` | **Confirmed as written, but not in its stated impact.** Translation ACLs were not updated with the parent's lifecycle. They are inert today because `content_translations` grants `read("any")` at table level, so nothing was actually unreadable or exposed | Sync them anyway, publish-safe ordering; see [roadmap S1](./roadmap.md) |
| 5 | `runtime/mutation.ts` | **Confirmed.** A proposal token is a pure MAC and was never consumed, so an additive mutation could be replayed into duplicate rows inside its 10-minute life | `createProposalRegistry`; the token is spent *before* the write |
| 6 | `services/events.ts` | **Confirmed.** `event_attendees` grants no read to user credentials, and `segment_members` silently undercounts | Post-authorization counts go through the service key; tools unregistered without one |
| 7 | `server.ts` | **Confirmed, and reproduced.** Client capabilities are assigned in the SDK's `_oninitialize`, which runs after `connect()` resolves — so `confirm` mode was permanently proposal-only | Capability read at call time, not sampled |
| 8 | `runtime/register.ts` | **Confirmed.** A propose-only call was audited as `ok`, and the auditor persists exactly those | `ToolEffect` on the envelope; only `executed` persists |
| 9 | `services/pages.ts` | **Confirmed, and broader.** Appwrite pages before the visibility filter, so visible rows behind a window of invisible drafts were unreachable — and the handler emitted no cursor at all | Forward scan with a raw-offset cursor; real `pagination` in the result |

Two further defects were found by the tests written for these fixes rather than
by the review: a folded name key that matched two different units once
whitespace was deleted (fixed by preferring a case-preserving key), and a
proposal registry that pruned a malformed expiry immediately, which would have
turned an unparseable field into a replay bypass.

**Finding 4 is worth stating precisely**, because the review's framing was
wrong in a way that matters: it reported that publishing left content
"unreadable". It does not. Appwrite grants access on the union of table and row
permissions, and `content_translations` — like `news`, `events`, `documents`,
`pages` and `webshop_products` — carries a table-level `read("any")`. Row
permissions on those tables are inert for reads today. The fix is still right,
because it keeps MCP-published rows identical to portal-published rows, which is
what makes tightening the table grant a schema change rather than a data
migration. But nothing was broken for readers, and nothing was exposed that was
not already exposed.


---

## 7. Second review round, and what it found

A second automated review of `afca6ec` raised nine further issues. All nine
reproduced. One of them — reads writing `audit_logs` rows — was a gap in the
previous round's own fix.

| # | Area | Verified as | Fix |
|---|---|---|---|
| 1 | `runtime/redact.ts` | **Confirmed, and it broke a written promise.** `campus_benefits.redemption_value` had no redaction rule and matches no generic secret-name pattern, so a member-only redemption code reached model context — while the registry, `docs/audit.md` and `docs/tools.md` all stated it never would | Explicit `campus_benefits` rule |
| 2 | `domains/approvals.ts` | **Confirmed.** `assertRecruitmentGate` guards the three content handlers but not `biso_request_approval`, so a non-HR department member could file a persisted `jobs.publish` request. The portal's executor checks the *approver's* publish access, never the requester's role | Gate applied before the row is read |
| 3 | `runtime/register.ts` | **Confirmed.** `Promise.race` abandons but cannot cancel, so a mutation could succeed after the caller was told it timed out | Only reads race a timer; a mutation's backend timeout reports `external_uncertain` |
| 4 | `services/approvals.ts` | **Confirmed, with a different fix than proposed.** The portal writes the status change with the *approver's* session client, and `campus_benefits`/`news` grant no table-level update at all | `APPROVAL_EXECUTION_NOTES`, surfaced as a warning at filing time |
| 5 | `runtime/register.ts` | **Confirmed — a gap in the previous round's fix.** Only the `proposed` case was classified; a read still mapped to `ok`, which the auditor persists | `effect: "read"` mapped separately, with tier as a safety net |
| 6 | `services/discovery.ts` | **Confirmed.** A vacancy stays `published` past its deadline, so public discovery offered jobs the site no longer lists | The `isRecruitmentVacancyOpen` predicate, expressed as a query so `total` stays truthful |
| 7 | `domains/workflows.ts` | **Confirmed.** Newest-first plus a limit discards exactly the drafts a staleness check looks for | Oldest-first probe, plus explicit truncation reporting |
| 8 | `services/recruitment.ts` | **Confirmed.** A campus-scoped HR caller's `campusId` was ignored, so a Bergen request returned Oslo vacancies presented as filtered | The requested campus narrows the managed set, or is refused |
| 9 | `services/content.ts` | **Confirmed — a dead ternary.** `preferred.length > 0 ? result.rows : result.rows`, with `preferred` computed and discarded | Use `preferred`, keeping the no-match fallback |

### A defect in the test harness itself

Writing the vacancy tests exposed something worse than any single finding: the
in-memory backend **failed open on filters it could not express**.

- `Query.or` nests plain objects, not JSON strings. `applyOr` parsed only
  strings, so any object-nested `or` matched every row.
- `matches()` returned `true` for any query with no `values`, and
  `Query.isNull` has none — so an `or` containing one matched everything.

Both meant a filter could silently vanish from a test while the test still
passed. Any assertion that relied on an `or` — including the commerce
scope tests from the previous round — was weaker than it looked. The fake now
handles both nesting shapes, handles value-less operators, and **throws** on a
nested query it cannot interpret rather than matching. A test harness used to
assert authorization boundaries must fail closed like the thing it tests.


---

## 8. Third review round

A third review, requested manually on `c1b194a`, raised five more. All five
reproduced, and three are the *same defect classes* as earlier rounds reached
through a different door — which is the useful signal in them.

| # | Area | Verified as | Fix |
|---|---|---|---|
| 1 | `services/discovery.ts` | **Confirmed, and public-facing.** `saveDraft` writes the draft's `meta.title`/`meta.description` into the translation row's top-level columns while leaving `is_published` true, and both public search and `biso_public_get_page` read those columns — so an anonymous caller saw unreleased copy. `getPublicPage` was internally inconsistent: it took care to read *blocks* from `puck_document` and then took metadata from the row | `publishedMeta()` derives both from `puck_document.meta`, falling back to the columns only for pages published before `meta` existed |
| 2 | `domains/pages.ts` | **Confirmed — the fixed page-load leak, second door.** `loadFullDoc` prefers `draft_document` with no scope check, so an out-of-scope caller's *proposal* reported the draft's block ids, types and count before `saveDraft` could refuse | The edit refuses up front when `load` gave only the published document; the helper now documents that it is not a gate |
| 3 | `domains/approvals.ts` | **Confirmed.** `content.get` bypasses `canReadRow` for published rows — right for reading, wrong as the only gate on filing. Any staff principal could file a publish request for another campus's article, and the portal's executor checks the approver's scope, never the requester's | `assertWriteAccess` before filing: an approval says "I could edit this but cannot publish it" |
| 4 | `services/discovery.ts` | **Confirmed — the fixed `page_list` paging bug, in the public path.** `limit`/`offset` applied before the published-translation filter, `total: rows.length`, no cursor | Forward scan with a raw-offset cursor |
| 5 | `domains/workflows.ts` | **Confirmed.** `listVacancies` defaults to most-recently-updated, and the deadline filter ran after the limit — so a vacancy closing tomorrow that nobody had edited lately was dropped, and the briefing reported nothing urgent | An `order: "deadline"` probe, ascending and excluding null deadlines |

### A second harness gap

Fixing #5 exposed the same class of problem as round two: **the in-memory
backend ignored `orderAsc`/`orderDesc` entirely.** Rows came back in insertion
order, so no test could distinguish a correct ordering from a wrong one — which
means the ordering fix from round two (`order: "oldest"` for stale drafts) was
never actually verified by its tests either. The fake now sorts, with missing
values last in both directions so they cannot displace a real one.

That is twice now that a defect in the harness was worth more than the finding
that uncovered it. Both had the same shape: **the fake silently did nothing
where the real backend does something**, so the assertion passed without
testing anything. Both are now loud instead — an unparseable nested query
throws, and ordering is applied.

### Consolidation

Rounds two and three each produced a forward-scanning listing, and the two
loops were nearly identical. They are now one generic `scanForward` in
`runtime/scan.ts`, used by both the staff page listing and public page search,
with the "advance by rows examined, not rows accepted" rule stated once.

---

## 9. Fourth review round

A fourth review of `2383c8b` raised six. All six reproduced. The P1 is the
sharpest kind of finding — a fix from round one that defeated itself.

| # | Area | Verified as | Fix |
|---|---|---|---|
| 1 | `domains/content.ts` | **Confirmed, and it undid round one's own fix.** `proposeOrExecute` rebuilds the proposal on the execute path so the token binds to the current call's values — and rebuilding mints a fresh expiry, hence a fresh token the single-use registry has never seen. That token was returned with the result. For `create_draft` / `request_approval` (null revision, `ID.unique()`) echoing it back writes a second row: the registry was intact and the response walked around it | `asApplied()` — the executed result keeps targets, payload, diff and the *spent* expiry, and omits the credential |
| 2 | `services/content-registry.ts` | **Confirmed.** `eventProblems` tests `row.fields.member_price`, which `events.summaryColumns` never projected, so it read `undefined` for every row — and the audit flagged "no member price set" on every paid, non-member-only event | `member_price` added to the projection |
| 3 | `domains/workflows.ts` | **Confirmed.** The briefing threaded `campusId` into its event, draft and vacancy probes but not into `inboxCounts`, then labelled the whole result `campusFilter: <one campus>` | `inboxCounts(principal, { campusId })`, applied on top of the principal's scope, never instead of it |
| 4 | `domains/workflows.ts` | **Confirmed — round three's vacancy ordering bug, one probe over.** Upcoming events were taken newest-*edited* first and filtered to the horizon afterwards, so an imminent event nobody had touched fell out of the window | `order: "date"` (ascending on the domain's own date column) plus `updatedSince: now`, with the same truncation warning the vacancy probe uses |
| 5 | `services/discovery.ts` | **Confirmed — the forward-scan bug, third door.** Public unit search read one fixed 100-row window, filtered it by `isPublicUnit` locally, sliced by `offset`, and reported `total: visible.length`. Units past the first 100 alphabetical rows were unreachable at any offset | `scanForward` with a raw cursor and `total: null`, matching page search |
| 6 | `services/discovery.ts` | **Confirmed.** `resolveBenefitCampusIds(null)` answers "national only" — correct for the member portal, which always has a campus in hand. Applied unconditionally to an *optional* search filter it silently hid every campus benefit when no campus was named, unlike every other public kind | The campus predicate applies only when a campus was requested |

### A third harness gap, and the last of that class

Finding #2 could not be reproduced by any test, because **the fake ignored
`Query.select` and returned whole rows.** A column the query never asked for
reads as `undefined` against Appwrite and as the stored value here — so a test
would pass on code that cannot work in production. It is exactly the shape of
the previous two gaps: the fake silently did nothing where the real backend
does something.

The fake now projects. Two simplifications are deliberate and both narrow
rather than widen: `$`-prefixed system attributes are always kept (which of
them a projection returns varies by Appwrite version, and none is a domain
column), and a nested selection prunes its relationship to the selected
sub-attributes while `relation.*` keeps it whole.

Making it project broke nothing else — 270 tests passed unchanged — which is
itself the answer to "is any other projection wrong?". Between this, `or`,
value-less operators and ordering, the fake now models every query feature this
package actually uses.

### What the four rounds have in common

Five of the six findings here are a defect class this package had already fixed
somewhere else: a forward-scan listing, a date-ordered probe, a campus filter
that labels more than it filters, a credential handed back, a projection that
did not match its reader. The fix each time was to move the rule into one
place — `scanForward`, `orderQuery`, `asApplied` — rather than to patch the
call site. The remaining copies are the ones worth looking for next.

---

## 10. Fifth review round

A fifth review of `957eadb` raised five. All five reproduced. Three are earlier
defect classes reached through a further door, and one is a regression this
package introduced in round three.

| # | Area | Verified as | Fix |
|---|---|---|---|
| 1 | `services/content.ts` | **Confirmed — round three's `isPublished` bypass, third door.** `content.get` waves any published row past `canReadRow`, and `SENSITIVE_COLUMNS` had no `jobs` entry, so `raw` carried `screening_rubric`, `interview_template` and `custom_questions`. A campus-scoped HR principal passes `assertRecruitmentGate`, `jobs` grants table-level `read("any")`, and the scoped `getVacancy` reports only `hasRubric` — so this was the one path that returned another campus's grading criteria | `SENSITIVE_COLUMNS.jobs`, which closes it on every path and for the caller's own campus too, since no tool here is meant to return a rubric. The `isPublished` shortcut now documents that `raw` is what carries the weight |
| 2 | `services/pages.ts` | **Confirmed — round three's published-metadata finding, staff door.** `load` selected the published *blocks* for an out-of-scope caller and then took `title`/`description` from the translation row's columns, which `saveDraft` overwrites with the draft's meta | `publishedHeadline()`, applied whenever the caller is limited to the published document |
| 3 | `domains/pages.ts` | **Confirmed — a regression from round three's own fix.** `documentSource === "published"` was read as "out of scope", but it is also what an authorized owner sees when the locale has no parseable draft — a legacy row, or a draft `parseDoc` fell back from. That owner was refused with "outside your scope" and could not create or repair the draft | `PageDocumentView.canSeeDraft` carries the authorization decision; `documentSource` goes back to describing which document was served. The load warning now distinguishes the two cases |
| 4 | `domains/content.ts` | **Confirmed.** In `confirm` mode the token is verified and consumed before an elicitation that has no deadline of its own, so a dialog left open past the ten-minute TTL still executed on accept. An update's revision re-read catches the drift; a create has no revision to catch it with | `assertNotExpired()` extracted from `verifyProposalToken` and called again after the person accepts |
| 5 | `services/discovery.ts` | **Confirmed, and wider than reported.** The finding named `events`; `benefits`, `units` and `documents` drop the term silently too, and only `pages` applies one — as a slug `contains`. The tool documents that `notes` says when a term was not applied | One `TEXT_SEARCH_NOTE` table covering all seven kinds, replacing two ad-hoc warnings, so a new kind cannot inherit "say nothing" |

### Testing the confirmation window

Finding #4 needed a test that could not be written by passing a stale expiry:
`verifyProposalToken` refuses that *before* the confirmation, so such a test
passes whether or not the second check exists — which is exactly what the first
attempt did. The real path only opens when time passes *during* the
elicitation, so the test advances the clock with `setSystemTime` from inside
the elicitation handler and restores it afterwards. Reverting the fix now fails
it.

That is worth recording because it is the same trap as the harness gaps in
rounds two, three and four, one level up: an assertion that passes for a reason
other than the one it claims. A regression test is only evidence if it has been
watched to fail.

---

## 11. Sixth review round

A sixth review of `025ac7a` raised three, all P2. One is a follow-on gap in the
round-five fix, which is the most useful kind of finding a review can produce.

| # | Area | Verified as | Fix |
|---|---|---|---|
| 1 | `services/discovery.ts` | **Confirmed.** `searchPages` took `refs.find((item) => item.is_published)` — the first published translation in relationship order, whatever its locale — and its parameter type did not even accept a locale, though the dispatcher's input carried one. `getPublicPage` preferred the requested locale, `pickTranslation` preferred requested → `no` → first, and page search agreed with neither | One `pickPublishedTranslation(refs, locale)` used by both page paths, so they cannot drift again |
| 2 | `services/content.ts` | **Confirmed as an inconsistency; the stated symptom not reproduced — see below.** `get` read `row[spec.translations.relationship]` from a `getRow` with no projection at all, while every other relationship reader in this repository names the relationship explicitly, including its own sibling `search` through `selectFor` | `detailSelect(spec)` — `*` plus the scope relations and `<relationship>.*` |
| 3 | `domains/pages.ts` | **Confirmed — a follow-on gap in round five's own fix.** `loadFullDoc` chose `draft_document ?? puck_document` *before* parsing, so a non-null but malformed draft won and a raw `JSON.parse` threw an uncaught `SyntaxError`. Round five had just authorized the owner to edit the published fallback in exactly that case, so the owner passed the new guard and hit this instead — unable to repair the one row the fix existed for | Parse before choosing, through the service's own `parseDoc`, so both readers apply the same "unusable means absent" rule |

### What could not be verified, and what was done instead

The finding on #2 states that Appwrite does not expand relationship rows by
default. That is a claim about server behaviour, and nothing available offline
settles it — so it is **not** asserted here. What the repository does settle is
narrower and enough: every projection that needs a relationship names it
alongside `*` (`NEWS_RELATIONSHIP_SELECT`, `EVENT_RELATIONSHIP_SELECT`,
`PRODUCT_RELATIONSHIP_SELECT`, `JOB_SELECT`, `readPageRow`, `getPublicPage`),
which would be redundant if `*` already covered it. `content.get` was the only
reader that named nothing while reading the children all the same.

So the fake now models the part that has evidence — a bare `*` keeps plain
columns but not relationships, which must be named — and not the part that does
not. That direction is deliberate: being stricter than the real backend causes a
loud false failure, never a silent pass, and a test that reverts `detailSelect`
to `["*"]` now fails.

This is the fourth harness gap in five rounds, and the second in two: `getRow`
ignored its queries entirely, so no projection on a single-row read could be
tested at all. Between `or`, value-less operators, ordering, `listRows`
projection and now `getRow` projection, the fake models every query feature
this package uses.

---

## 12. Seventh review round

A seventh review of `d0b9f26`, requested manually, raised four. All four
reproduced. The P1 is the first finding in this PR that is a security
vulnerability in the ordinary sense rather than an authorization gap.

| # | Area | Verified as | Fix |
|---|---|---|---|
| 1 | `domains/pages.ts` / `services/pages.ts` | **Confirmed, reproduced directly.** `set_prop` takes any dot path, and `@repo/editor`'s `setProp` walks it with `node[key]` — so `__proto__.x` resolves to the real `Object.prototype` and writes onto it. `applyEdits` deep-copies through `JSON.parse`, which does not help, because that copy's prototype *is* `Object.prototype`. It runs before `proposeOrExecute`, so it lands in the default propose-only mode with no confirmation and no write, and the tool reports the edit as applied | `unsafePathSegment` refuses `__proto__`, `constructor` and `prototype`, in the **service** as well as the schema, so a second caller cannot reintroduce it. The editor's own `setProp` is roadmap S7 |
| 2 | `services/events.ts` | **Confirmed.** `assignedCount` counted `segment_members` rows. The table is unique on `(segment_id, user_id)` only, and the admin auto-assign path dedupes within one segment `kind` and not across the event — so a person in a bus segment and a workshop segment is two rows and one attendee. `unassignedCount = attendeeCount - assignedCount` could therefore report nobody left while attendees were unassigned | Count distinct identities (`attendee_id`, else `user_id`), projecting only those two columns, with a `MEMBER_SCAN_CEILING` and a note when it truncates |
| 3 | `services/pages.ts` | **Confirmed — the malformed-draft class, in the publication path.** `setPublished` guarded on `!draft_document`, then wrote `puck_document: draft_document` verbatim. An unparseable draft replaced a working public page with one the site renders as no blocks, and unpublishing cannot undo it because the released document is already gone | `assertPublishableDraft` parses before overwriting; the released document is left untouched |
| 4 | `domains/pages.ts` | **Confirmed.** `set_meta` accepted `key: "slug"` and reported it applied, but `saveDraft` writes only the translation row — never `pages.slug`, which is the routing key and carries `page_slug_unique` | `slug` removed from the enum, with the reason in the schema |

### Why the slug edit was removed rather than implemented

The canonical `savePageDraft` does write `meta.slug` to the parent row, so
"just do what it does" looks like the obvious fix. It is not, for two reasons
that only show up in the surrounding code: that path carries a
`resolveUniquePageSlug` / `slugConflict` policy for the unique index, and
`apps/admin` layers `assertUnitPageNamespace` on top because a slug can move a
page into or out of the `units/<campus>/<slug>` address space.

More decisively, `pages.save_draft` is a `draft`-tier operation, defined in
`runtime/mutation.ts` as "reversible by editing again". Changing a live page's
public address is not: inbound links break the moment it is published, and
editing the slug back does not unbreak anything that has already been followed.
An operation whose consequences do not match its tier does not belong in that
tier, so the honest move is to not advertise it — which is the same rule the
content registry applies to every operation it declines.

---

## 13. Eighth review round

An eighth review of `d1beb0e` raised six. All six reproduced. **Two are
follow-ups on fixes from the two previous rounds**, and one of those was masked
by a test whose fixture was not realistic — which is the more useful half of the
finding.

| # | Area | Verified as | Fix |
|---|---|---|---|
| 1 | `server.ts` | **Confirmed.** `resolvePrincipal` runs once at construction and every handler closes over the result. A stdio server lives as long as the host that spawned it, so a membership revoked meanwhile still authorizes — and because a mutation executes through the service-key client, Appwrite never sees the caller's identity on the write and cannot apply the revocation itself. The application-side check is the only one | `identity/refresh.ts`: a 60-second TTL for reads, which the caller's own credential still gates, and a **forced** re-resolve before anything that can reach the elevated client. A forced refresh that fails throws rather than falling back to remembered roles |
| 2 | `services/events.ts` | **Confirmed — a gap in round seven's own fix.** `attendee_id ?? user_id` looked like the more specific identity. It is the less reliable one: the admin auto-assign path writes both columns, the manual path writes only `user_id`, and the schema marks `user_id` required and `attendee_id` optional. One person assigned by each path is two identities, and the inflated count is back | Key on `user_id` — the column both paths write, and the one the `(segment_id, user_id)` unique index already uses |
| 3 | `runtime/register.ts` | **Confirmed — a gap in round two's fix.** `uncertainIfMutationTimedOut` keyed on the tool's *tier*, but a mutating handler reads before it writes, and in propose mode never writes at all. A timeout from `content.get` was reported as `external_uncertain`: "the write may have been applied, do not retry" — both halves false | The reclassification moved into `proposeOrExecute`, around the `execute()` call, which is the only place that knows a write was dispatched. The tier heuristic is deleted rather than patched |
| 4 | `domains/pages.ts` | **Confirmed — round five's guard, one tool over.** `biso_page_publish` loads the page (which deliberately hands an out-of-scope caller the published view) and went straight to `proposeOrExecute`. The proposal was reported executable, and in `confirm` mode a person would be shown a confirmation, for a change `setPublished` refuses only once the token comes back | `assertPublishAccess` before the proposal exists, matching `biso_page_edit_blocks` |
| 5 | `services/approvals.ts` | **Confirmed, and the code comment asserted the opposite.** It claimed row security returns "exactly the rows their approver-team membership permits". `createApprovalRequest` grants `read`+`update` to the approver team and the Operations Unit, then `read` to the requester — so a requester saw their own pending rows under a heading that said they were theirs to decide | Filter on `approver_team_id` against the principal's verified team memberships, with no filter for the Operations Unit because it genuinely holds `update` on every row |
| 6 | `services/content-registry.ts` | **Confirmed.** `pages` declared `search`/`get` supported, but the content service decodes only `content_translations` and inline columns — no projection, no title, no locales. And the generic path applies only `scopeQueries`, while `pages.list` applies a per-row visibility rule because `pages` has row security off with `read("any")` | Both marked unsupported, pointing at `biso_page_list` / `biso_page_load`. A second, thinner, less-guarded door is worse than no second door |

### The test that hid finding #2

Round seven's regression test seeded `user_id` **and** `attendee_id` on both
rows. Real rows do not look like that: the two assignment paths in `apps/admin`
write different column sets, and it is precisely the mix that breaks a
`attendee_id`-first identity. The test asserted the right property against data
that could not exercise it.

This is the same failure mode as the four harness gaps, one level in: there the
fake could not express what the backend does, here the fixture could not express
what the data does. Reverting a fix and watching its test fail — which is the
standing rule in this PR — does not catch it, because the test fails for the
revert *and* passes for the wrong fixture. The fixture now models the two paths
separately, and reverting to `attendee_id`-first fails it.

---

## 14. Ninth review round

A ninth review of `d5380e3`, triggered manually after the reviewer's usage
limit lapsed, raised three. All three reproduced. **Two are follow-ups on
round-eight fixes** — the same shape as round eight's own follow-ups: the fix
landed on the path the finding named, and the sibling path kept the old
behaviour.

| # | Area | Verified as | Fix |
|---|---|---|---|
| 1 | `runtime/register.ts` | **Confirmed — the other half of round eight's #1.** Every call now re-resolves the principal, but `tool.profiles` was still consulted only in `registerModules`, against the startup snapshot, and the SDK keeps a registered tool callable for the life of the connection. The sharp case is `biso_integration_configuration`: its handler takes no `principal` at all, because registration was assumed to be the gate, so nothing downstream would catch the revocation. *The stated impact was slightly wide* — `INTEGRATION_REQUIREMENTS` is a hard-coded constant in this package, so the integration and variable **names** are already public; what leaks is the configured/missing state of this process's environment | `assertProfileAllowed(tool, principal)` in `invokeTool`, immediately after the refresh. Reads still carry the 60-second TTL by design; mutations force the refresh and see a revocation at once |
| 2 | `services/content.ts` | **Confirmed.** There *was* a truncation warning, but it fires on the id count (`MAX_ID_BATCH`, 90) while the truncation happens in the scan (`TRANSLATION_SCAN_LIMIT`, 200) — and the locale filter sits between them. 250 matching translations, 80 of them in the requested locale inside the first window, and 80 ids is reported as the complete answer | `idsMatchingText` returns `{ ids, truncated }`, with `truncated` from `result.total > result.rows.length`, and `applyTextFilter` warns on it independently. Not paged: scanning forward would issue up to `total / 200` queries on an unbounded term and still cap at 90 ids, so it buys a differently-arbitrary 90 rather than completeness |
| 3 | `services/operations.ts` | **Confirmed — the other half of round eight's #5.** `listPending` was filtered onto the decider's grant; the count behind `biso_inbox_counts` still read row visibility alone. `approval_requests` has `"$permissions": []` with `rowSecurity: true`, so visibility *is* row security — which grants the requester read on their own rows. A campus admin's own request, routed to another team, was counted as awaiting their decision | `approverTeamsFor` moves to `identity/scope.ts` so both paths share one definition, Operations Unit override included. `inboxCounts` applies it, short-circuiting to `0` for an approver with no teams rather than issuing an unfiltered query |

### What these two follow-ups have in common

Round eight fixed *a* stale-identity gap and *an* approver-filter gap. Both
fixes were correct and both were incomplete, because each concern had a second
call site that the finding did not name: a second place the profile mattered,
and a second query over the same table. Verifying a finding proves the reported
path is broken; it says nothing about the paths beside it. The check that would
have caught both is to grep for the other readers of the same thing before
calling a fix done — which is now how these two are fixed, by giving each
concern one definition instead of two.

---

## 15. Tenth review round

A tenth review of `84d5f49` raised two, one P1. Both reproduced, and both are
the *third* instance of a pattern this PR keeps hitting: a rule that was
correct for the case it was written for, and silent for the case beside it.

| # | Area | Verified as | Fix |
|---|---|---|---|
| 1 | `domains/content.ts` | **Confirmed (P1) — the second half of round eight's #3.** That round moved the uncertain-outcome classification into `executeAndClassify`, where a write is known to have been dispatched, and had it upgrade `timeout`. But `fromAppwriteError` only reaches `timeout` for a 504 or an `appwrite_timeout`; a connection reset after the request went out has **no HTTP status at all**, so it falls through to the `internal` catch-all. A write that may well have landed was reported as a plain failure, which invites exactly the duplicate the proposal registry exists to prevent | `fromAppwriteError` tags the status-less case `transport: true` (a 5xx keeps its `status`), `isTransportFailure` reads that, and `executeAndClassify` upgrades both it and `timeout`. A 5xx deliberately stays a failure: the backend answered, and "do not retry" is wrong advice about a write that definitively did not happen |
| 2 | `services/content.ts` | **Confirmed.** `content.get` waves a published row past the campus check — right for published content — and then returned `stripSensitive(table, row)`, a **denylist**. So an out-of-scope caller received every column nobody had thought to name. Verified against the schema: `events.online_url`, `events.contact_email`, `events.external_id` and `webshop_products.finago_account_number` all exist, and all have **zero references in `apps/web`** — `online_url` is written and shown only in the admin event studio, `finago_account_number` only by the checkout and Finago accounting code | The raw row is withheld entirely when publication rather than scope authorized the read. Such a caller still gets `fields` (the curated per-domain projection), translations, links and dates — everything a public reader sees — plus a warning saying why |

### Denylist, allowlist, and which question is being asked

Finding #2 is not "four columns were missed". A denylist can only ever strip
what someone thought to name, so the list was always going to trail the schema
— and `appwrite.config.json` is generated, so columns arrive without anyone
revisiting `SENSITIVE_COLUMNS`. The test that covered this previously asserted
`auto_screen` **did** come back to an out-of-scope reader, which is the same
defect written down as an expectation.

Both rules are kept, because they answer different questions:

- `SENSITIVE_COLUMNS` — "may a model see this column *at all*?" It applies to
  the caller's own rows too; a screening rubric is inappropriate for the campus
  that owns the vacancy.
- Withholding the raw row — "does this caller have any claim on this row?"
  Publication is a statement about the *content*, not consent to expose the
  record around it.

The same reasoning names the limit of the fix, which is worth stating rather
than leaving implied: the underlying `read("any")` table grants mean Appwrite
still serves those columns to anyone who asks it directly. This package no
longer hands them to a model; it cannot stop the API. That remains roadmap S1.

---

## 16. Eleventh review round

An eleventh review of `bfbc833` raised four, all P2. All four reproduced.
Three are one defect wearing three hats: **a warning that exists is discarded,
contradicted, or never asked for.**

| # | Area | Verified as | Fix |
|---|---|---|---|
| 1 | `domains/approvals.ts` | **Confirmed.** The redundancy guard ("you can publish this yourself") used `canPublishForCampus`, which recognised only global and campus admins. The publication path uses `assertPublishAccess`, which delegates to `assertWriteAccess` and admits the department that owns the row. Settled against the primary source: `apps/admin/src/lib/utils/authorization.ts:202` delegates identically, so the **port is faithful and `canPublishForCampus` was the invented policy** — with exactly one caller, deciding the one question where the disagreement showed | `canPublish` replaces it, implemented by asking `assertPublishAccess` and catching. Tightening the gate instead would have diverged from `apps/admin`, which `identity/scope.test.ts` exists to prevent |
| 2 | `domains/workflows.ts` | **Confirmed.** The briefing summary keyed on `findings.length === 0` alone. Every collector answers a failure by pushing a warning and returning no findings, so "no findings" means either "nothing needs attention" or "nothing could be read" — and during an outage the briefing said the first | `briefingSummary` takes `incomplete: warnings.length > 0` and, when the briefing is short of data, says so instead of giving an all-clear. A caveat is appended to the non-empty case too |
| 3 | `domains/workflows.ts` | **Confirmed.** On a full page the audit **replaced** `found.warnings` with its truncation notice. `content.search` reports a dropped status filter and a short translation scan that way, so a mistyped status vanished on exactly the queries large enough to truncate | Appended rather than substituted |
| 4 | `domains/workflows.ts` | **Confirmed.** `inboxCounts` does not throw when one of its two queries fails — it resolves with that count as `0` and a non-null `note`. The collector's `catch` therefore never ran, and a campus whose pending approvals could not be read was indistinguishable from one with none | The note is pushed onto `warnings` before the findings are built, which also feeds #2 |

### A result is not just its data

Every one of #2, #3 and #4 is the same mistake: treating the *value* a function
returned as its whole answer, when the function also returned a statement about
how complete that value is. A zero, an empty list and a 50-row page all look
like ordinary results; `warnings` and `note` are what say otherwise.

That is worth naming because it is the third distinct pattern this PR has
produced at scale, after "the sibling call site" (rounds nine and ten) and
"the denylist that trails the schema" (round ten). Two of these findings were
in code written to *report* partial failure — `noteFailure` and the
allSettled in `inboxCounts` both exist precisely for this — and the reporting
still did not reach the caller, because the last step dropped it.

Finding #1 is a fourth appearance of an earlier one: a test (`canPublishForCampus
> only global admins and the campus's own admins`) that had written the invented
policy down as its expectation, exactly as round ten's `auto_screen` case had.
It is replaced by two: the real rule, and a case-for-case comparison against
`assertPublishAccess` itself, so the predicate and the gate cannot disagree
again without failing.

---

## 17. Twelfth review round

A twelfth review of `2f10647` raised three, one P1 — and the P1 is the
consequence of round eleven's own fix. All three reproduced.

| # | Area | Verified as | Fix |
|---|---|---|---|
| 1 | `domains/approvals.ts` | **Confirmed (P1) — caused by round eleven.** `canPublish` delegates to `assertPublishAccess`, which delegates to the `assertWriteAccess` call on the line above it. So every principal reaching the guard gets `true` and `biso_request_approval` always threw: the tool was unreachable. Checked against the portal: `createApprovalRequest` in `apps/admin` calls `requireAuth()` and **nothing else** — no write check, no publish check, no redundancy guard. The whole notion of refusing a "redundant" request was invented here | The refusal is removed. `assertWriteAccess` stays — deliberately stricter than the portal, because the portal's executor checks the approver's scope and never the requester's — and the "you could publish this yourself" observation becomes a warning on the result. The stale remediation hint in `biso_explain_permission`, which pointed a refused publish at a tool that would also refuse it, is removed |
| 2 | `domains/identity.ts` | **Confirmed.** The department branch of the explainer returned `allowed: true` on department membership alone. `assertWriteAccess` checks the campus **first**, and a department id is not a campus claim — so the explainer answered yes for a row the operation refuses. The campus-admin branch directly above it already mirrored the gate | The campus check added, phrased as what it is: department membership does not carry across campuses |
| 3 | `services/operations.ts` | **Confirmed.** `isApprover = isGlobalAdmin \|\| isCampusAdmin` returned zero early. `deriveRoles` grants `globaladmin` only for National **and** Operations Unit, so an Operations Unit member without the National campus team is neither — while `approverTeamsFor` treats them as the all-requests override and `listPending` shows them every row. The inbox and its count disagreed about the same rows | Approval eligibility comes from `approverTeamsFor`; the campus/global check stays for submissions, which are routed by campus scope and have no approver column |

### Two rounds on one invented rule

Findings #1 here and #1 last round are the same mistake seen from both sides.
The package had a rule — *an approval request means you could edit this but not
publish it* — that reads as an obvious description of what an approval queue is
for, and is not true of this organisation: `assertPublishAccess` delegates to
`assertWriteAccess`, so the two sets are identical.

Round eleven caught the predicate being wrong and corrected it. Correcting it
made the rule's emptiness visible: with the right predicate the guard refuses
everyone. The lesson is not "check the predicate" — it is that **a rule nobody
in the repo wrote should be suspected before it is refined.** The first fix
refined it; the second deleted it, which is what should have happened in round
eleven had the guard been traced back to `apps/admin` rather than only to the
gate it disagreed with.

`docs/roadmap.md` **S8** records the underlying product question — whether
publishing should be a permission distinct from editing — because that, not any
code here, is what would give the approval queue the meaning its name implies.

### A test that locked in a wrong fix

Round eleven's regression test asserted the refusal. It was written one round
ago, verified to fail without its fix, and was still wrong — because the fix it
protected was wrong. That is the third time a test has encoded a defect rather
than caught it (`auto_screen`, `canPublishForCampus`, and now this), and the
first where the test was written *by this PR, in the immediately preceding
round*.

"Revert the fix and watch the test fail" cannot catch this: the test fails for
the revert exactly as designed. What catches it is asking whether the behaviour
being locked in exists anywhere in the repo outside the change that introduced
it.

## 17b. Thirteenth review round

A thirteenth review of `c974360` raised three P2s. All three reproduced, and
two of them are this PR's own earlier fixes reaching only part of their
subject — the ninth and tenth occurrences of that pattern.

| # | Area | Verified as | Fix |
|---|---|---|---|
| 1 | `runtime/register.ts` | **Confirmed.** The dispatcher forces a principal refresh for mutations and not for reads, and the comment justifying that says the caller's own credential still gates a read. Two reads break that premise: `biso_event_segments` and `biso_event_audience` read `event_attendees` and `segment_members` through `requireElevated` — the service key belongs to no user, so Appwrite applies no revocation — and `biso_integration_configuration`'s handler takes no principal at all, which the file's own comment already said. A revoked role stayed usable on those for the 60s TTL, and indefinitely if an unforced refresh failed and fell back to cache | `privilegedRead` on the tool definition, forced exactly as a mutation is. Marked on those three. `biso_page_list_block_types` also takes no principal and is deliberately **not** marked, with the reason recorded: forcing costs availability (a forced refresh that fails throws) and its static block catalogue is this package's own schema, not BISO's data |
| 2 | `identity/scope.ts` | **Confirmed — and it inverts round twelve's #3.** `approveRequest` and `rejectRequest` in `apps/admin/src/app/(portal)/_actions/approvals.ts` refuse anyone without `globaladmin` or `campusadmin` before touching the row. Deciding exists nowhere else — this package has no decide tool on purpose — so that gate is the whole policy. An Operations Unit member holding neither role has `update` on every request row and can decide none of them, yet `approverTeamsFor` handed them the all-requests override | The portal's role gate runs first in `approverTeamsFor`; the Operations Unit override then applies only to people it admits. `listPending` and `inboxCounts` both follow, since they share that function |
| 3 | `domains/content.ts` | **Confirmed.** `assertPublishAccess` delegates to `assertWriteAccess`, which admits the department that owns the row — a correction this PR already made to the *predicate* in round eleven. Three separate texts went on telling the model that only campus and global admins can publish, and sent a department member to file an approval request for something they may do themselves. The review named two; `domains/pages.ts` carried it too, and `setPublished` passes `departmentId` exactly as the content path does | One `PUBLISH_SCOPE_NOTE`, declared beside the gate it describes and consumed by all three texts, so restating it is no longer possible. A test asserts the sentence and the gate agree |

### The fourth test that had written the defect down

Finding #2 did not just contradict a fix; it contradicted a **test**. Round
twelve's #3 was a disagreement between the approvals count and the approvals
list about the same rows, and the fix settled it — on the side neither surface
could act on. The test added to lock that in asserted `approvals: 2` and two
rows for exactly the person the portal refuses.

That is the fourth time a test in this PR has recorded the defect as its
expectation, and it is the same lesson in a new place: reverting a fix cannot
catch it, because the test fails for the revert precisely as designed. What
catches it is the question round eleven already produced — *does this rule exist
in the repo outside the change that introduced it?* Here the answer was eleven
lines of `approvals.ts` that nobody had read, and the disagreement the round
twelve fix was resolving had a right answer available the whole time.

The test is now inverted, with the old expectation named in it, and a second
test pins the case it must not take with it: an Operations Unit member who *is*
a global admin still decides everything.

## 17c. Fourteenth review round

A fourteenth review of `13dcfc9` raised eight — one P1 — the largest round
since the third. All eight reproduced.

| # | Area | Verified as | Fix |
|---|---|---|---|
| 1 | `domains/content.ts` | **Confirmed (P1).** In `confirm` mode the handler *waits*: the dispatcher's forced refresh runs before it, and the elicitation then sits open for as long as the person takes, up to the proposal's ten minutes. A revocation landing in that window is invisible, and the write executes through the elevated client, so Appwrite cannot apply it either. The fifth member of the stale-principal family, and the only window the previous four left open | `assertUnchangedAuthority` compares an `authorityFingerprint` (sorted, so re-resolve order cannot trip it) before and after the dialog, in the one funnel all five mutating tools share. Comparing the whole authority rather than re-running each domain's predicate needs no per-call-site knowledge, so it cannot be threaded through four call sites and forgotten at the fifth; a *widened* grant is refused too, because what the person accepted was authorized by the memberships of that moment |
| 2 | `domains/content.ts` | **Confirmed.** The registry withdraws reads for `pages` — "every operation, reads included" — but the generic handlers called only `assertRecruitmentGate`, so `domain: "pages"` dispatched anyway and the generic service, which neither projects nor decodes `page_translations`, returned a null title and no translations. The withdrawal was advertised and not enforced | `assertDomainSupports(domain, "search" \| "get")` at both handlers, so the registry's own sentence is what the caller gets |
| 3 | `services/pages.ts` | **Confirmed.** Two rows, two requests, no transaction. The locale update copies the draft and sets `is_published` *before* the page update runs; if the second fails the locale is public now — certainly when the page is already published through another locale — while the caller is told the operation failed. Unpublishing has the mirror problem | The committed half is reported, not compensated: a compensating write can fail the same way and this package does not promise rollback. The underlying code is kept, so a permission error still reads as one, and `remedy` names the step that finishes or undoes it |
| 4 | `resources/index.ts` | **Confirmed.** Resource reads never pass through `invokeTool`, so nothing refreshed the identity resource: it described the startup principal for the life of the process while `biso_whoami` and every authorization check used the current one — the server disagreeing with itself about who the caller is | The resource resolves the principal itself, unforced, matching the read it is: the TTL applies and a failed refresh serves the cached identity rather than making the resource unreadable |
| 5 | `services/discovery.ts` | **Confirmed against the public site.** `listPublishedDocuments` in `apps/web` runs two queries and merges them, and says why in its own comment: national documents are shown "regardless of campus filter", because their visibility comes from `scope`. Filtering on `campus_id` alone hid every statute and organisation-wide policy from a campus-scoped search — documents the same signed-out visitor sees on the site | `Query.or` of `scope = national` and the requested campus. Still a filter: another campus's bylaws stay out |
| 6 | `services/recruitment.ts` | **Confirmed.** `order: "deadline"` excluded null deadlines — a fix from an earlier round — but not *past* ones. A vacancy stays `published` after its deadline, so ascending order puts the oldest expired rows first and they fill the briefing's whole window; the workflow filters them out locally and reports nothing closing soon while a vacancy closes this week | A lower bound on `application_deadline` in the query, before the limit. The same fix, one step further along than last time |
| 7 | `services/discovery.ts` | **Confirmed.** Unit links were built by hand as `/units/<campus-id>/<slug>`, but the public route resolves the *segment*: `campusSegmentToId("2")` is null, so `/units/2/fadderullan` 404s. `@repo/shared/utils/unit-urls` is the repo's single definition of the convention and backs every other producer | `unitCanonicalPath`, the same helper the rest of the repo uses |
| 8 | `server.ts` | **Confirmed.** `loadConfig(options.env)` parses the record an embedded caller supplies, but `createServices` was called without it, so `createOperationsService` fell back to the host's ambient `process.env`. `biso_integration_configuration` therefore answered about the host's variables — wrong for the caller, and a disclosure of variables that have nothing to do with this server | The record is threaded through `createServices`. Omitting it still defaults to `process.env`, so the standalone binary is unchanged |

### A third expired fixture, found by its own fix

Finding #6's lower bound immediately failed `recruitment.test.ts`, whose
"closes tomorrow" vacancy was dated `2026-09-17` — in the past by the time the
fix landed. The sweep after the eighth base move had looked at that fixture and
judged it safe, correctly: the test asserted *ordering*, and `2026-09-17 <
2027-01-01` holds whatever the date is. Adding a bound against the real clock is
what made its literals matter.

So the rule learned there needs widening, and this is where it is written down:
a fixture is clock-dependent not when it is compared against `now` today, but
when it *could* be. Both deadline fixtures are now relative to `Date.now()`,
which is how they should have been written in the first place.

## 17d. Fifteenth review round

A fifteenth review of `d8c2bd5` raised nine — three P1 — the largest round of
the PR. Eight reproduced and are fixed. One is an assertion about Appwrite that
the repository contradicts; it is recorded rather than acted on.

| # | Area | Verified as | Fix |
|---|---|---|---|
| 1 | `services/pages.ts` | **Confirmed (P1).** `pageVisibility` treats any `status === "published"` row as readable by anyone, without consulting `visibility`. `pageRowPermissions` — mirroring `buildPageRowPermissions` — grants a published `visibility: "authenticated"` page a read for the `biso-members` team alone, and a staff principal is derived from campus and department teams, which prove nothing about membership. This table has row security off and a table-level `read("any")`, as `list`'s own comment says, so this check is the only audience boundary | The `published-only` branch requires membership for a member-only page. `Principal` gains `isMember`, read from the raw teams because `parseTeamMemberships` drops `biso-members` on purpose. A second test pins that a real member still gets in |
| 2 | `services/pages.ts` | **Confirmed (P1).** `load` served `puck_document` to a published-only caller without checking `translation.is_published`. Unpublishing a locale writes only `is_published: false` and leaves the document in place, so after another locale republishes the parent row, the withdrawn copy came back. `apps/web`'s page route asks `translation.is_published` before it renders anything | A published-only caller needs a released locale, not merely a stored document |
| 3 | `services/approvals.ts` | **Observation true, consequence not established.** There is no index covering `approver_team_id`. But the claim that Appwrite therefore *fails* the query is contradicted by the repo: `apps/admin`'s own approvals inbox filters the same table on `campus_id`, which is equally unindexed. Settling it needs appwrite.io, which is unreachable from here | None. Roadmap **S0** records what a real instance must be asked, and that an index is worth adding either way |
| 4 | `runtime/register.ts` | **Confirmed, and wider than reported.** Round fourteen forced a refresh for reads with no second gate, on the premise that an ordinary read *has* one — Appwrite applying the caller's credential. That premise is false for every table carrying a table-level `read("any")`, which is `events`, `news`, `jobs`, `documents`, `pages`, `page_translations`, `content_translations`, `campus_benefits` and `webshop_products`. The review asked for the two page tools; marking only those would have been arbitrary | The default is inverted. Every staff-only read now re-resolves memberships, and `unprivilegedRead` takes a *reason* rather than a boolean, so an exemption has to be argued. One exemption: the static block catalogue. `privilegedRead` is gone — nothing has to be remembered any more |
| 5 | `services/discovery.ts` | **Confirmed against the canonical rule.** `campusScopeIds` in `apps/web/src/lib/campus-scope.ts` returns `[campus, "5"]` so National content "rides along with whichever campus is selected rather than disappearing behind the filter". The events, news and vacancy branches each used a bare equality filter. This is round fourteen's documents finding reaching only documents | `publicCampusScope`, ported with the citation, on exactly the three tables the canonical rule names. Units and pages keep a plain filter, and the comment says why so the next reader does not have to re-derive it |
| 6 | `services/discovery.ts` | **Confirmed.** `buildEventQueries` in `apps/web` keeps collection parents and standalone events and excludes rows with a `collection_id`, defensive empty-string arm included. Without it a collection's contents came back as independent results | The same predicate, before pagination |
| 7 | `services/pages.ts` | **Confirmed, and the bug is in the editor.** `insertBlock` computes `findIndex(...) + 1`, so an unknown anchor becomes index 0 and the block lands at the *top* — its own `idx < 0` guard is unreachable. The wrapper then reported "inserted after <id>" | The anchor is validated here before inserting, matching what `remove` already does. The editor's dead guard is not this package's to fix |
| 8 | `services/content.ts` | **Confirmed.** The twin of round fourteen's page-publish partial, in the path that fix did not touch. Unpublishing narrows the parent first — the right order, and it stays — but a failure in the translation sync afterwards left the item genuinely unpublished, its proposal token spent, while the caller was told nothing happened | `partialStatusFailure`, the same shape as the page path: keep the code, state what committed, name a repeatable remedy, compensate nothing. Publishing is unaffected and a test pins that, since its order commits nothing before the failure |
| 9 | `domains/identity.ts` | **Confirmed.** `biso_explain_permission` is registered for every profile so a member can ask what they may do; the generic content tools are staff-only. For `search` and `get` the explainer returned `allowed: true` to anyone authenticated, describing tools absent from the caller's own session | The profile requirement is part of the decision. Third time this explainer has disagreed with the gate it explains |

### The premise, not the site

Findings #4 and #5 are the same lesson from opposite directions, and it is
sharper than "check the neighbours". Both fixes in round fourteen were correct
*at the site they touched* and rested on a premise that was never true
elsewhere: that an ordinary read is gated twice, and that the national
ride-along was a documents rule. Checking neighbouring call sites would not
have found either — what finds them is asking what the fix assumed and whether
that assumption holds anywhere else.

So the two fixes here are shaped to make the question unnecessary next time.
The refresh default is inverted, so a new staff read is covered without anyone
remembering; and the campus rule is a named function carrying the citation,
applied to exactly the tables its source names.

## 17e. Sixteenth review round

A sixteenth review of `6e2cc25` — the first since the quota gap, and the first
to see the ninth base move's work — raised four, one P1. Three reproduced and
are fixed. The fourth describes real behaviour whose cause is the repository's
own, and is recorded rather than diverged from.

| # | Area | Verified as | Fix |
|---|---|---|---|
| 1 | `runtime/result.ts` | **Confirmed in part (P1).** `buildPagination` derived `hasMore` from `offset + count < total`. When a page comes back empty, `consumed` is still `offset`, so the cursor handed back is the one just followed and a client told to "follow `nextCursor` until it is null" loops on it forever. The review reaches that through the disputed reading of `listRows(...).total` — under which a filtered query reports the whole table and the comparison stays true after the last matching row. The *second* half of the finding, "treat these totals as unknown", would require settling that dispute, which roadmap 3.5 says cannot be settled from here | An empty page yields no cursor. That is right under **both** readings — rows deleted between two requests leave a filtered `total` stale in exactly the same way — so the guard takes no position. A walk of the pessimistic reading (five matching rows, nine hundred in the table) is pinned as a test, asserting on each step that the cursor *moved* |
| 2 | `runtime/register.ts` | **Confirmed.** The persisted `audit_logs` row carried `action: tool.name` and `payload: { tier }` — nothing else. `logAuditEvent` in `apps/admin` writes a specific action with the row's id and type (`page_unpublished`, `page`, the page id), so publishing one article and unpublishing another produced two indistinguishable MCP rows next to portal rows that say exactly what happened. The proposal already carried both | The mutation gate reports `{ action, targets }` to the dispatcher, which writes the dotted action plus the primary target's id and table, with the full target list and the tool's name in the payload. Reported at the one chokepoint every executable mutation passes through, so a tool cannot forget to describe itself |
| 3 | `services/pages.ts` | **Confirmed — round fifteen's finding #1, one function over.** That round taught the *load* path that a published `visibility: "authenticated"` page is granted to the members team alone. `list` had its own predicate, which returned true for any published row. A summary carries the slug, the owning campus and department and both links, so a member-only page's whole identity went to staff callers the load path refuses | One `pageAccess`, with `pageVisibility` and the list predicate as thin callers. Three tests: refused to a non-member, served to a member, and still listed for its own campus |
| 4 | `services/pages.ts` | **Behaviour confirmed; the premise is the repo's, not this package's.** Unpublishing one locale does draft the parent row, and listings gate on that, so a still-published sibling locale drops out of the sitemap and every public listing while keeping its URL. But `unpublishPage` in `@repo/api/page-builder` writes exactly that, unconditionally, and `apps/admin`'s own unpublish button calls it with no sibling check. The rule the review cites describes how `pages.status` *becomes* published, and the publish path does match it — unpublish is the asymmetric half | None in the code path. Diverging would mean the same action leaves different state depending on which surface did it. `biso_page_publish` now states the effect in its description **and** in the confirmation a person is shown, the port carries its citation, and roadmap **S9** carries the product question with the surface-by-surface cost |

### A fix is not a rule until it has one home

Finding #3 is the fifteenth time in this PR that a fix reached the site a
review named and stopped there, and this time it is sharper than usual: the
member-only gate was added to `pageVisibility` one round earlier, correctly,
while nine lines away `list` kept its own copy of the older rule. Two functions
answering the same question is the whole failure mode — the fix cannot reach
both because there is nothing that says they are the same question.

So the repair is not "add the check to `list` too". It is one `pageAccess` with
two thin callers, one that throws and one that skips, which is the same move as
round fifteen's `publicCampusScope` and `PUBLISH_SCOPE_NOTE`: where a rule was
being restated, it becomes a definition.

### Declining half a finding is not declining it

Finding #1 arrives wrapped in the `listRows(...).total` dispute, which this PR
has deliberately refused to settle for four rounds — Appwrite's release notes
carry no such entry and the repository has not adopted its own rule. The
tempting readings are both wrong: accept the whole thing and take a side on an
unsettled question, or dismiss the whole thing because its premise is
unsettled.

The useful question is narrower — *what is true under both readings?* An empty
page is the end of what an offset can yield whichever way `total` is counted,
and a cursor that does not advance is a defect with or without the dispute. So
the loop is closed and the dispute is left open, which is also what makes the
fix cheap enough to be obviously correct.

## 17f. Seventeenth review round

A seventeenth review of `4476bab` raised four, one P1. All four reproduced and
are fixed — and two of them were named "fresh evidence after" a round-sixteen
fix, which is exactly what they were.

| # | Area | Verified as | Fix |
|---|---|---|---|
| 1 | `services/discovery.ts` | **Confirmed (P1), and a test of this PR's own was concealing it.** `publishedMeta` fell back to `page_translations.title`/`.description` when the released document carried no `meta` — the same columns `saveDraft` overwrites from the draft, which the function's own comment says two lines above. So a legacy published page served its *draft's* headline to anonymous callers | `releasedHeadline`, which has no fallback: a document that does not state a title is reported as not stating one, and the caller still has the slug. See below for the test, and for what `apps/web` does |
| 2 | `runtime/register.ts` | **Confirmed.** Round fifteen inverted the refresh default but kept deriving the exemption from `!tool.profiles.includes("public")` — a property of the tool's *audience*. `biso_whoami`, `biso_list_capabilities` and `biso_explain_permission` are open to everyone and are entirely about the caller's own authority, so an authenticated caller heard revoked roles read back from cache for the whole TTL while mutations in the same session forced a refresh and refused that same authority | The exemption is a property of the caller: anonymous callers have no memberships to go stale, everyone else forces. The two genuinely principal-independent tools — public search and public page, both answering from the anonymous client — say so with an `unprivilegedRead` reason |
| 3 | `domains/content.ts` | **Confirmed — round sixteen's own fix, one step short.** `noteMutation` reported the proposal's targets, and a create names its target `"(new)"` because the row does not exist yet. That placeholder is what reached `audit_logs.resource_id`, so the activity row still could not name the draft whose creation it was logging | `withCreatedIds` re-reports the targets after the write, swapping the placeholder for the returned `$id`. Central, in `proposeOrExecute`, so no call site can forget it; the placeholder is now one exported constant rather than a literal in two files |
| 4 | `domains/pages.ts` | **Confirmed, and it is the `__proto__` finding's other half.** `setProp` creates an array when the *next* path segment parses as a number, then assigns `node[index]` — so `props.items.4294967294` builds an array of 4,294,967,295 slots, and saving the page serialises it. The schema refused prototype-bearing segments and nothing else | `propPathProblem` bounds what a path may *create*: at most 12 segments, 64 characters each, and no array index above 999. Checked in the schema and again in `applySetProp`, because `applyEdits` runs before the proposal gate — in propose mode too |

### The fallback, the sibling, and the test that hid both

Finding #1's fallback was three lines under a comment explaining why those
columns are unsafe. What let it survive is the test that covered it: it set
the row's `title` column to a benign `"Legacy title"` before asserting the
fallback returned it. The fixture's own value for that column is
`"UNRELEASED TITLE"` — deliberately, because that is what a draft really
leaves there — so the assignment was the only thing making the fallback look
safe. That is the fifth test in this PR to write a defect down as its
expectation, and the first to *edit the fixture* in order to do it.

Then the question that has caught fifteen findings: does the fix reach only
the site the review named? It did not. `publishedHeadline` in
`services/pages.ts` had the identical fallback on the staff `published-only`
path, with its own comment calling the columns "only a fallback" — so an
out-of-scope staff caller got the owning department's unreleased headline the
same way. The review named `discovery.ts`. Both now call one exported
`releasedHeadline`, and the staff path has its own test.

### What `apps/web` does, and why this does not copy it

Verifying #1 turned up something larger than the finding. `normalizeDoc` in
`@repo/api/page-builder` — which `getPage`, the public catch-all route, runs
every page through — does not *fall back* to the row columns. It prefers them:

```ts
title: translation.title ?? doc.meta.title,
```

So the live site shows a saved draft's headline on **any** published page with
edits in progress, not merely on legacy ones. That is an app bug, recorded as
roadmap **S10** with the fix that belongs in `normalizeDoc`.

It is deliberately not copied here, and the reasoning is worth stating because
it cuts against this package's usual rule. "What does the public site show" is
the specification for public discovery — but where the site's answer is itself
a leak, matching it would mean handing a model unreleased copy and letting it
repeat that copy as published. The narrower obligation wins: report what is
released, and record the app's behaviour rather than inheriting it.

## 17g. Eighteenth review round

An eighteenth review of `611e19a` raised three, one P1. All three reproduced
and are fixed. Two are named "fresh evidence after" a round-seventeen fix, and
the P1 is the plainest instance in the whole PR of the rule this package is
supposed to follow.

| # | Area | Verified as | Fix |
|---|---|---|---|
| 1 | `services/content.ts` | **Confirmed (P1), against a rule the repository states outright.** `baseQueries` scoped on the legacy scalars (`campus_id`, `department_id`) while `apps/admin`'s `applyContentRelationshipScopeQueries` scopes on `campus.$id` and `department.$id`, and its companion `getContentOwnership` says why: "relationship values win; `legacyFallback` exposes the scalar columns only for rows that predate the relationship backfill (repair rollout window)". Mid-backfill the two disagree and the scalar is the stale one — and these tables carry a table-level `read("any")`, so Appwrite offers no second gate. Every domain spec already held the relation paths; they were used for the *projection* only | `scopeFieldsFor` prefers the relation, for the scope filter and for the argument narrowing alike, so an argument cannot narrow on one side of a repair-window row while authorization reads the other |
| 2 | `domains/pages.ts` | **Confirmed — round seventeen's fix, one target over.** `biso_page_edit_blocks` named table `page_translations` with the *page's* id. `saveDraft` writes a translation row whose id it only returns afterwards, so the audit row pointed at a row that does not exist; and `withCreatedIds` could not repair it, because it only replaces the placeholder | The target is the page. That is also what `logAuditEvent` records for page actions in `apps/admin`, so the two systems' rows line up, and the locale is already in the label |
| 3 | `resources/index.ts` | **Confirmed.** The identity resource used an unforced refresh, deliberately, so a failed re-resolution served the cache rather than making the resource unreadable. Round seventeen made `biso_whoami` force — so the two disagreed, and the resource presented a cached identity as current. Under a persistent outage it would do so indefinitely | Forced, like `whoami`. But a resource that dies on a backend blip is worse than one honest about its age, so a failed refresh falls back to the cache **and says so** in a `freshness` field. Silently asserting revoked roles was the one option worse than both |

### The second consequence of scoping by the wrong column

Finding #1's security half is the repair window. Its other half is quieter and
was live all the time: `documents` and `campus_benefits` have a `department`
relationship and **no `department_id` column**, so scoping by the scalar left
`departmentField` null — and `scopeQueries` fails closed on a null department
field. A department member therefore saw *none* of their own department's
documents or benefits, and the scope description told them why in a sentence
that was itself wrong: "this collection has no department dimension".

A table without a department *column* is not a table without a department.
That is the whole reason the canonical helper names the relationship.

### Where the same fix does not belong

The other two `scopeQueries` call sites were checked rather than assumed.
`form_submissions` and `orders` carry a `campus_id` scalar and **no campus
relationship at all** — so there the scalar is not the legacy path, it is the
only path, and no repair-window divergence is possible. Both stay as they are.

## 17h. Nineteenth review round

A nineteenth review of `5415df2` — the first head it had seen since the tenth
base move — raised six, two of them P1. All six reproduced and all six are
fixed. Two are the same defect the round before had already named, one file
over each; the theme of the round is that the previous round's two fixes both
stopped at the site that was reported.

| # | Area | Verified as | Fix |
|---|---|---|---|
| 1 | `services/events.ts` | **Confirmed (P1) — round eighteen's P1, one file over.** `assertEventAccess` projected `campus_id`/`department_id` and passed the scalars to `canReadRow`. `events` carries *both* those columns and the `campus`/`department` relationships, so mid-backfill they disagree and the scalar is stale. It matters more here than in a listing: everything past this check runs on the service key over `event_segments`, `segment_members` and `event_attendees`, all `rowSecurity: false`, so this check is the entire boundary. `apps/admin`'s own `event-segments.ts` reads it with `getContentOwnership(event, { legacyFallback: true })` | Project the relationship ids, authorize through the shared `rowOwnership`, and report the canonical campus so the segment fallback agrees with the gate. Pinned in both directions: the stale-scalar campus is refused, the relationship owner is served |
| 2 | `identity/scope.ts` | **Confirmed (P1).** `canReadRow` refuses every campus-bearing row when a principal resolved no campus; `scopeQueries` emitted the department predicate *alone* in that state. The list was therefore the looser of the two gates — a department's drafts at every campus, each of which the single-row check would then refuse. The state is reachable: a department team whose companion campus team is missing still resolves a department | A campus dimension with no campus to match on is no match: `NO_MATCH_FILTER`. And the same guard in `describeScope`, which would otherwise have named the departments in a summary describing a scope the caller did not get |
| 3 | `domains/pages.ts` | **Confirmed — finding #38's guard, one hazard short.** `propPathProblem` bounded prototype keys, depth and array indices, but `setProp` walks from the **block**, not from `block.props`. A first segment of `id` or `type` therefore rewrites the discriminator every later edit is keyed on: a duplicate id breaks `findBlock` and so every subsequent `move`, `remove` and `set_prop`; an arbitrary type renders as `Unknown block` | The first segment may not be `id` or `type`. Only the first — `items.0.id` is ordinary content and stays writable, which the second test pins. `layout` is deliberately not reserved: `layout.padding` is a legitimate edit |
| 4 | `services/events.ts` | **Confirmed.** `loadSegments` capped at 100 and returned a bare array, so segment 101 and its capacity and membership did not look capped, they looked absent. `event_segments` enforces no per-event ceiling, and `apps/admin`'s own list asks for **200** — so the two surfaces disagreed about what exists | The ceiling matches the portal's, and the result carries `truncated` rather than silence. The audience preview says it first, because every count below it is computed over the segments that were read |
| 5 | `services/content-registry.ts` | **Confirmed.** `publishEvent` in `apps/admin` writes the status and then, when the row has `notify_push`, calls `sendEventAnnouncement`. `setStatus` writes status and ACLs. Publishing such an event from here would make it public with the announcement silently dropped — and unrecoverably, since the status is then already `published` and the portal's publish will not re-send it | A `publishPrecondition` on the domain spec, checked against the row the backend just returned, immediately before the write. Refused, not sent and not published quietly. Unpublishing is unaffected; so is an event without the flag |
| 6 | `services/content.ts` | **Confirmed.** `biso_content_search`/`get` admitted HR through `assertRecruitmentGate` and then applied *content* scope. But recruitment scope is not content scope: `toRecruitmentAdminScope` gives HR every vacancy at its campuses with **no** department narrowing, and HR with National every campus. Vacancies are owned by the departments that are hiring, so the content rule hid most of a campus HR user's vacancies and nearly all of an HR+National user's | `jobs` is withdrawn from the generic path — enforced at dispatch by the existing `assertDomainSupports` — and the refusal names the tool that asks the right rule. `getVacancy` already existed with the canonical scope and had no tool; it does now, as `biso_get_vacancy`, so nothing is lost |

### Two fixes that had stopped at the reported site

Findings #1 and #3 are round eighteen's and finding #38's respectively, each
one file or one segment further on. That is sixteen occurrences of this shape
before this round and eighteen after, and it is worth being precise about why
the sweep missed them. Round eighteen's fix was to `scopeFieldsFor`, a helper
in the content service, and the sweep that followed asked "which other domain
specs have this scope shape" — a question scoped to the registry. `events.ts`
does not use the registry at all: it hand-projects the columns it needs. The
search had the right *rule* and the wrong *population*.

So the population that matters for an ownership rule is not "call sites of the
helper" but "reads that authorize on a campus or a department", however they
get there. Under that question the remaining ones were checked: `commerce.ts`
and `operations.ts` read `orders` and `form_submissions`, which carry a
`campus_id` scalar and no campus relationship, so there is no second column to
prefer and nothing to diverge.

### The approval path had the recruitment defect too

Finding #6 named `biso_content_search`. Withdrawing `jobs` there left a second
generic read: `biso_request_approval` accepts `domain: "jobs"`, gates on
`hasRecruitmentAccess` — finding #11's fix — and then called
`content.get(principal, "jobs", id)`, applying content scope to a vacancy for
exactly the population the gate had just admitted. An HR user would have been
refused a vacancy they demonstrably manage, so the tool was unusable for most
of its audience.

The fix is the same rule in the same place rather than a second copy of it:
`readApprovalSubject` reads a vacancy through `recruitment.getVacancy` and
everything else through `content.get`. Its companion is easy to miss —
`assertWriteAccess` runs on the subject immediately afterwards, and for `jobs`
that would re-impose the department narrowing `toRecruitmentAdminScope`
deliberately does not have, one line after the read was fixed. It does not run
for `jobs`; `canManageRecruitmentVacancy`, inside `getVacancy`, is the
requester check for that domain.

The two other internal callers of the generic search were checked and do not
reach jobs: the briefing's staleness probe iterates `["events", "news"]`, and
`biso_content_quality_audit` takes `z.enum(["events", "news", "benefits",
"products"])`.

### Where the precondition is enforced, and where it is not

Finding #5's check runs in `setStatus`, at the write, and not also in the tool
handler that builds the proposal. That is deliberate. `content.get` returns a
projection that does not carry `notify_push`, so a propose-time copy would
need the column widened into the detail shape *and* a second statement of the
rule — and this PR has spent four rounds on rules that had two homes. One
definition in the registry, enforced at the single chokepoint every executable
publish passes through. A proposal for a publish that is later refused costs a
round trip and says exactly why; a rule that drifts costs a defect.

## 17i. Twentieth review round

Four findings on `0a57be0`, all P2, all real. The first review of two heads at
once: the quota that ran out two minutes after round nineteen posted reset
overnight, so this covers both round nineteen's fixes and the eleventh base
move's.

| # | File | Finding | Verdict |
|---|---|---|---|
| 1 | `domains/content.ts` | a caller-supplied campus and department are never checked against **each other** | confirmed against `apps/admin` |
| 2 | `services/pages.ts` | `parseDoc` accepts a document whose `meta` violates `PageDoc`'s own type | confirmed |
| 3 | `services/events.ts` | one segment count per request, awaited in a loop, up to 200 of them | confirmed |
| 4 | `runtime/register.ts` | the `requestId` returned on success cannot find its own audit row | confirmed |

### The pair was never the unit of authorization

`assertWriteAccess` answers two questions — may this principal write at this
campus, and is this department one of theirs — and for a campus or global admin
the department arm **never runs**, because managing the campus returns early.
Nothing in it says the department belongs to the campus. `create_draft` is the
only write in this package that takes both from the caller, so it is the only
one that could be handed `campusId: "1", departmentId: "dept-bergen"` and
create a row whose two ownership relationships disagree — which matters more
now than it once did, because round eighteen made the relationship the
canonical thing scoping reads.

`assertContentOwnership` in `apps/admin/src/lib/content-authorization.ts` is
the repo's answer, and the new `assertWritableOwnership` is its shape: the
cheap scope check first so an out-of-scope request never costs a read, then
re-read the department and compare. Two details are deliberate.

- **Ownership is read through `rowOwnership`,** not through
  `lookups.departments()`. That cache maps `campusId` from `row.campus_id` —
  the legacy scalar. Authorizing on it would have reintroduced exactly what
  round nineteen's first P1 removed from `events.ts`, one file over. The
  admin function reads `campus.$id`; so does this.
- **It runs in the handler, not inside `createDraft`.** A check inside the
  service would run only on execute, so propose mode would mint a proposal for
  an ownership pair that cannot be executed — and a proposal is the thing a
  human is asked to approve.

**Population, checked rather than assumed:** every other `assertWriteAccess`
call in the package takes its campus and department from a row it has already
read — `saveDraft` from the page row, `setStatus` from the content row,
`request_approval` from the subject. There is one caller-supplied pair, and it
is now checked. `campusId` is already `z.string().min(1)`, so admin's other two
rules — a department needs a campus, and content needs a campus — hold
structurally here and need no second statement.

### A document whose `meta` is missing is not a document

`PageDoc.meta` is `PageMeta`, not `PageMeta | null`. `parseDoc` checked only
that `blocks` was an array, so a stored `{"blocks": [], "meta": null}` came
back typed as a valid `PageDoc` — and the readers dereference it:
`@repo/api/page-builder` reads `normalizedDoc.meta.slug` unconditionally when
it publishes, and `readPage` reads `doc.meta.slug` whenever the row's own
`slug` column is empty.

**This is the earlier malformed-draft fix one case short.** Finding #40 stopped
publication of a draft that would not *parse*; this is a draft that parses and
is still not a document. The fix goes in `parseDoc` rather than beside the
publish check so the two agree by construction: `load` treats such a draft as
**absent** and falls back to the published document, which is the path that
lets its owner repair it, and `assertPublishableDraft` refuses to copy it over
a working page. A validity rule with two homes drifts.

Only `meta.slug` is required, because it is the field those readers require. A
draft that has lost its title or its accent colour is repairable; rejecting it
here would make it unloadable instead.

### A fix of mine made the third finding twice as bad

Round nineteen raised `SEGMENT_LIMIT` from 100 to 200 so the package would read
as many segments as the portal does. It did not look at what the loop below the
limit does with them: one `countRows` per segment, awaited one at a time. The
ceiling I raised is the multiplier on a round trip count, so that fix doubled
this defect's worst case from 100 requests to 200 — enough to pass the read
timeout on a large event, after which the caller gets nothing at all while the
abandoned handler goes on issuing the rest (`Promise.race` abandons a read; it
cannot cancel it).

The counts now run in waves of eight through `runtime/concurrency.ts`, which
turns 200 sequential round trips into 25. **Not** collapsed into a single
`Query.equal("segment_id", [...200 ids])` scan, which would be one request:
every segment would then share one `COUNT_CEILING` rather than having its own,
so an event with many populated segments would start reporting floors where it
reports exact counts today. That trade needs the backend's own limit on how
many values `Query.equal` accepts, which cannot be established from here.
Roadmap **S13**.

`inWaves` keeps input order, and that is the contract rather than a
convenience: the caller indexes results against the input array, so a
reordering would report one segment's membership against another's capacity —
a defect that reads as plausible data rather than as a bug.

### The id you are given should be the id you can look up

Handlers mint their own `requestId` with `newRequestId()`, whose doc comment
says why: a result stays self-describing when a service is exercised directly
in a test. But the dispatcher mints a *different* one, and that is the id bound
into the child logger and written into the audit row's payload. `toToolError`
already returns the dispatcher's on the failure path. So the **successful**
mutation — the one whose audit row someone actually wants to find — was the
single case whose `requestId` matched nothing in the log or in `audit_logs`.

`withRequestId` stamps the dispatcher's id onto a successful envelope before
serialization. Only the envelope's own field is replaced; nothing inside `data`
is touched, so a proposal token or a row id that happens to be a UUID is left
alone.

### What the tests prove, and one that proves less

Thirteen new tests across four files. Against the genuine pre-fix files:

- the mismatched-pair call through the **real dispatcher** returns a valid
  proposal pre-fix and `invalid_input` after — the control, a department that
  does belong to the named campus, passes on both sides;
- four of the six `parseDoc` cases fail pre-fix, the other two being controls
  (a slug-bearing `meta` is still accepted, unparseable JSON is still refused);
- the `requestId` correlation test fails pre-fix, and asserts against both the
  audit row's payload and the captured stderr line.

**The `inWaves` tests are not of that kind, and should not be read as if they
were.** Finding #3 is a latency defect, and the fake backend resolves instantly,
so no test here can fail against the sequential loop by timing. What those six
tests guard is the new helper's contract — order preserved, concurrency bounded
and actually used, a rejection propagating rather than yielding a short result —
which is where a future edit could do real damage. The finding itself was
verified by reading the loop and the limit, not by a failing test.

A note on method, from a near-miss: the pre-fix copies were saved as
`/tmp/fixed.$(basename $f)`, and `services/content.ts` and `domains/content.ts`
share a basename, so one silently overwrote the other. The fixed service file
had to be rebuilt from its original plus the patch. Flatten the path.

## 18. Base moves while the PR was open

`main` moved ten times after the audit above was written. A clean textual
merge says the lines do not collide; it says nothing about whether the base
changed a rule this package mirrors. So each move was inspected before being
trusted, and the inspection is recorded here — including for the moves that
changed nothing, because "inert" is a claim that should show its work.

Six of the ten changed something. The seventh changed the most, and not in
the diff: it called into question a backend guarantee this package had been
relying on in eleven places. The ninth is the clearest case of why a clean
merge proves nothing: it did not touch a line this package owns, and it still
made one of its answers wrong. The tenth is the one case of the opposite — it
wrote the repo's version of a rule this package had already reached on its own,
and saying so meant checking every site here against it rather than assuming.

| Base | What moved | Effect here |
|---|---|---|
| `333165b` → `45188bc` | PR #74, plus `appwrite` ^26→^27 and `node-appwrite` ^28→^29 | `packages/mcp` takes `node-appwrite` through the root `catalog:`, so the major bump applied to it without a manifest change. Revalidated against 29.0.0; no source change needed |
| `45188bc` → `d5da221` | `apps/web`, `@repo/i18n`, and `packages/api/server.ts`, which swapped `Date.now()` for `performance.now()` in its request timing | Nothing imports `@repo/api/server` here (`isolation.test.ts` asserts it), but `packages/api/runtime.ts` — added by this PR — documents itself as having *the same* request-timeout and slow-request behaviour as `./server`, and that claim went stale the moment the base landed. `runtime.ts` and `invokeTool` now use monotonic `performance.now()`, rounded, since `durationMs` reaches an `audit_logs` row |
| `d5da221` → `ca9997f` | PR #75, member pass: 143 files, three new tables | Inert here, and checked rather than assumed. All 13 generated types this package imports differ only cosmetically (`}` → `};`, trailing enum commas, one field reordered). All 17 tables it reads are unchanged in `$permissions`, `rowSecurity` **and** column set. The three new tables (`member_pass_scans`, `member_pass_scanners`, `member_pass_scanner_links`) are untouched by this package |
| `ca9997f` → `b11a842` | PR #76, webshop visibility: `webshop_products` gained an `unlisted` column | **Not inert.** See below |
| `b11a842` → `1b6b3d1` | PRs consolidating slug derivation and member pricing into `@repo/shared/utils/{content-slug,member-discount}`, plus admin/web navigation and checkout work | No schema, type, lockfile or `turbo.json` change, and nothing under `packages/shared/utils/*` that this package imports. Both new helpers serve surfaces this package does not implement: it reads `member_price` but never computes a discount, and it requires a slug rather than deriving one. The slug consolidation did make one contract worth asserting — see below |
| `1b6b3d1` → `efffef4` | Admin job search and status counts; the public event card linking to its detail page and showing a point of contact | Inert. Nothing outside `apps/` and `@repo/i18n` moved. Two things were checked rather than waved through — see below |
| `efffef4` → `28f9a3b` | Recruitment retention cleanup, CV anonymisation for AI screening, a derived screening score, and a homepage counter rewrite | **Not inert**, though not for anything in the recruitment half. The counter rewrite carries a claim about `listRows(...).total` that, if true, made eleven counts in this package wrong. See below |
| `28f9a3b` → `ad20cd1` | A shared Europe/Oslo wall-clock helper adopted by ten components, and campus admins gaining National-campus events inside admin's portal | **Not inert.** One rule to follow, one deliberately not followed. See below |
| `ad20cd1` → `d6c1c42` | Members-only vacancies: the ACL that was meant to hide them is gone, and applying is gated on live membership instead | **Not inert.** Nothing under `packages/` moved, and a public answer here still became wrong. See below |
| `d6c1c42` → `0135812` | PR #77: `.catch(() => null)` removed across the apps, and `@repo/api` gains an `errors.ts` keeping "the row does not exist" apart from "the backend failed" | **Inert, and checked rather than assumed.** That is the rule `runtime/errors.ts` already applies. See below |

### `unlisted`: a column the product projection had to carry

PR #76 introduced link-only products. `unlisted` is orthogonal to `status` and
to `member_only`: an unlisted product is published and fully purchasable at its
`/shop/<slug>` link, and `listedProductsOnly()` in
`apps/web/src/lib/data/product-visibility.ts` keeps it out of every public
listing.

The first question was whether this package could leak one into a listing, the
way three earlier findings did. It cannot, and for two independent reasons:
`products` is not one of `PUBLIC_KINDS`, so public discovery never reaches the
table at all; and `biso_content_search` is registered for staff profiles only,
where `scopeQueries` fails closed for a principal with no campus or department
claim. Neither of those is new, and neither depends on the other.

What was wrong is narrower and is the same shape as finding #2 of the fifth
round: the product projection carried `status` and `member_only` but not
`unlisted`, so a staff caller could read a product summary and conclude the
product was publicly discoverable when it was deliberately not. `summaryColumns`
is both the `Query.select` list and the returned field set, so the column was
absent from the answer rather than merely unread — and an absent column comes
back `undefined`, which is indistinguishable from "listed".

`unlisted` is now projected, and the registry note says what it means. The row
is still returned: withholding a link-only product from the staff who own it
would be the opposite defect, and the app's listing filter is the app's.

The behaviour being locked in was checked against the repo outside PR #76's own
change, which is the check that round eleven skipped: `apps/admin`'s product
list renders an `unlisted` badge next to each product
(`shop/_components/product-row.tsx`), so "a staff-facing product summary says
whether a product is link-only" is the admin app's rule, not one invented here.

### The slug contract, asserted rather than assumed

`generateSlug` was extracted because five surfaces had drifted copies that all
silently deleted Norwegian characters (`Høstball` → `hstball`). This package
has no copy to drift: `biso_content_create_draft` requires a `slug` and
validates its shape against `SLUG_PATTERN`.

It does have an obligation, though, and it is easy to miss. The tool's
description now points a caller at the canonical rule, which only helps if
every slug that rule produces is one the validator accepts. A caller told to
fold `Høstball` to `hostball` and then refused by the schema would have nowhere
to go, and the refusal would surface as an unexplained `invalid_input` rather
than as the drift it actually is.

`domains/content-slug.test.ts` states that compatibility over realistic
Norwegian titles, and the documented example is asserted against the real
helper rather than left to a reviewer's memory. Tightening `SLUG_PATTERN` to
reject digits — a plausible edit — fails it, so the test has teeth. The empty
case is stated too: `generateSlug("🎉")` is `""`, which `.min(1)` rejects, so a
title that folds away entirely still forces the caller to supply a slug.

### Two things checked on the sixth move, and why neither changed anything

The admin job search now walks the full in-scope set in batches and filters in
memory. That is a mechanism, not a rule: this package searches vacancies
through Appwrite queries and already reports a truncated scan rather than
implying completeness, which is the property that matters. Nothing to mirror.

The second is closer to the line, and worth writing down because a reviewer may
reasonably ask. `apps/web`'s **public** `getEventBySlug` now projects
`contact_name`, `contact_role` and `contact_email`, so an event's point of
contact is deliberately public. This package's curated event projection does
not carry them, which makes it stricter than the public website for a caller
reading a published event outside their scope.

That was left alone on purpose. `summaryColumns` is a *summary* — it also omits
the title, the description and the image, all of which are unambiguously public
— so a caller is never misled about what an event is, only given less of it.
That is the opposite of the `unlisted` case above, where the omission changed
the meaning of what came back: a product looked discoverable when it was not.
Widening the projection to match a page's field list would be a design change
to this package's read model, made on a base move's authority rather than a
reviewer's, and the one thing this PR has been burned by twice is shipping a
rule nobody asked for.

### The seventh move: a backend guarantee this package had been trusting

The four commits in `efffef4` → `28f9a3b` are mostly recruitment work, and the
recruitment half turned out to be inert. What was not inert was a comment in
`apps/web/src/lib/data/queries.ts`, added alongside a new `countRows` helper:

> Don't read a count off `listRows(...).total`: since the recent Appwrite
> release it reports the size of the whole table, not of the filtered result,
> so every "N matching" figure derived from it silently became the table size.

That release is the one this package already took, through the root `catalog:`,
in the very first base move (`appwrite` ^26→^27, `node-appwrite` ^28→^29). So if
the claim holds, it does not describe a new rule arriving in the base — it
describes a defect this package has been carrying since move 1.

**The claim could not be confirmed, and could not be dismissed.** Appwrite's
published release notes contain no such entry; the threads that discuss `total`
on 1.8.x describe a *different* bug (the new opt-out `total: false` parameter
being ignored by the Node SDK). Meanwhile `apps/admin` still reads `.total` in
some thirty places, and `queryEvents` — two functions above the warning, in the
same file, in the same commit — still returns `response.total` for the events
listing. So the repo has not adopted the rule it states.

That leaves a decision to make without the evidence to settle it. It was made
this way:

**Counting returned rows is correct under either reading.** Only `total` is in
dispute; which rows come back is not, and the repo's own `countRows` rests on
exactly that assumption. So anywhere a count could be taken from rows within a
bounded request, it now is — no side taken, no speculative rewrite.

Two counts were load-bearing and are now taken from rows:

- **`inboxCounts`** (`services/operations.ts`) read `total` off a
  `Query.limit(1)` query, on a comment asserting the old guarantee as settled
  fact. Under the disputed reading it would report the whole of
  `approval_requests` and `form_submissions` — ignoring `status`,
  `approver_team_id` and the campus scope, which would quietly make findings
  #50 and #59 cosmetic. It now counts `$id`-projected rows up to
  `INBOX_COUNT_CEILING` (500) and sets `atLeast` when it fills the window;
  `biso_inbox_counts` and the morning briefing both say "At least" rather than
  rendering a floor as an exact figure.
- **The event audience counts** (`services/events.ts`) had the identical
  `Query.limit(1)` + `total` shape. A whole-table `memberCount` would report
  every segment as full; a whole-table `attendeeCount` would fire a false
  "exceeds capacity" note and corrupt `unassignedCount`. Both now count rows to
  `COUNT_CEILING` (2000), a capped `memberCount` reports `remaining: null`
  rather than a number it cannot stand behind, and the audience notes say which
  figures are floors. Fixing one and leaving its twin is the gap that produced
  eight of the fifty-nine findings, so both moved together.

Three truncation flags changed from `total > rows.length` to "the scan filled
its window" (`identity/resolve.ts`, `services/content.ts`, the assigned-attendee
count in `services/events.ts`). That test is the same answer under either
reading; the old one would have fired on nearly every filtered read.

**What was deliberately left alone**, and why the line is where it is: the
`total` that accompanies a *listing* — in `discovery.ts`, `approvals.ts`,
`recruitment.ts`, `content.ts`, `commerce.ts` and `operations.submissions` —
still comes from `listRows`. Making those independent of `total` means counting
whole result sets, which is an unbounded scan per listing, and this package
refuses unbounded scans elsewhere for good reason. The repo drew the same line:
it applied `countRows` to three standalone homepage figures and left the
listings alone. The briefing's "more may exist" comparisons
(`domains/workflows.ts`) also still read `total`, but they only ever *trigger* a
warning whose number comes from the rows, so under the disputed reading they
over-warn rather than misreport — they fail safe.

So the honest summary is: the counts that state a figure on their own no longer
depend on a guarantee in dispute; the counts attached to a page of rows still
do. Settling it needs a query against a real Appwrite instance, which is
outside this session's boundaries. It is on the roadmap as 3.5.

**The test harness had to be extended to make any of this provable.** The fake
derives `total` from the filtered rows, so code reading `total` and code
counting rows are indistinguishable in it — a regression test for one would
pass against the other. `createFakeBackend` now takes `unfilteredTotal`, which
makes the fake report the whole table as `total`, and the new tests run in that
mode. Verified with teeth: against the pre-fix implementations, three of the
inbox tests and two of the audience tests fail, reporting 8 instead of 1, 2
instead of 0, 600 instead of 500, 5 instead of 2 and 6 instead of 2.

### What else the seventh move touched, and why none of it changed anything

**`packages/api/appwrite.config.json` gained nine lines** — a single index,
`idx_data_retention_until`, on `job_applications`, which this package reads. No
column was added, removed or retyped, `$permissions` and `rowSecurity` are
unchanged, and `packages/api/types/appwrite.ts` did not regenerate, which is
consistent with an index-only change. The recruitment queries here filter on
`job_id` and `status` and order by `screening_score`; none of that is affected.

**A new anonymiser, `packages/shared/utils/screening-anonymizer.ts`**, scrubs
direct identifiers from applicant free text "before it is sent to a model
provider" (GDPR art. 5(1)(c)). An MCP server *is* a model-facing interface, so
this one deserved a real look rather than a glance. It does not reach here:
this package returns no applicant free text at all — no `cover_letter`, no
`candidate_profiles`, no `answers`, no `interviews`, and `ai_screening` is
reduced to a `hasScreening` boolean. The identifiers it does return
(`applicantName`, `applicantEmail`) are structured fields that are the tool's
stated purpose, gated on HR and global admins, and exactly what
`apps/admin`'s own applications view renders. The rule targets unstructured text
a model might mine for protected characteristics; scrubbing a name out of an
HR reviewer's candidate list would break the tool without serving it.

**The retention cleanup cron** deletes applications past `data_retention_until`,
falling back to `$createdAt` + `RECRUITMENT_RETENTION_DAYS` where the value is
absent. The question worth asking was whether this package's passthrough
`dataRetentionUntil` could now mean something it does not say — a null reading
as "never deleted" when the repo would in fact purge the row. It cannot: the
column is `required: true` in the schema and the generated type declares it
non-nullable, so the cron's null branch cannot surface through here. The field's
meaning is unchanged; it merely became consequential.

**`normalized_score` is now derived** by `computeScreeningNormalizedScore`
rather than emitted by the model. This package reads the persisted
`screening_score` column and never the AI output schema, and
`biso_list_applications` describes the ordering without claiming a scale or
bands, so there is no statement here to correct.

### Eighth base move: `28f9a3b → ad20cd1`

Two commits, neither inert. One consolidates a rule this package also has to
state; the other changes what the portal *answers* without changing the module
this package ports.

**`24f727d` — `packages/shared/utils/oslo-time.ts`.** A new shared helper, now
used by ten components across both apps, stating the repo's rule in one place:
BISO's events are entered and shown as Europe/Oslo wall-clock time whatever
zone the process runs in, and stored as UTC ISO instants. This is the same
shape as the fifth move's slug consolidation — a rule this package touches
without owning — and it reaches here twice.

*Filters.* `biso_public_search`'s `from` and `biso_content_search`'s
`updatedSince` were passed to Appwrite as written. A caller asking for events
"from 2026-09-22" means the Oslo day; compared as written that is UTC midnight,
02:00 in Oslo, so an event starting earlier that Oslo morning was dropped from
the day it belongs to. `services/event-time.ts` now resolves a bare
`YYYY-MM-DD` through the shared `osloWallClockToIso` and leaves a full
timestamp alone — it already names an instant, and re-resolving it would move
the caller's boundary by an hour or two. Both call sites were fixed, not just
the one the rule surfaced on: against the pre-fix code the discovery test and
the content test each fail.

*Descriptions.* This package renders nothing and keeps returning the stored
instant, which is exact and self-describing — but an instant rendered without
its zone reads as an event one or two hours before the one BISO scheduled. The
tools whose answer is a time (`biso_public_search`, `biso_campus_briefing`) and
both date filters now say which zone to render in, with the zone taken from
`OSLO_TIME_ZONE` rather than a local copy, and a test asserts that so a future
change to the shared rule cannot leave a stale zone behind here. The generic
content tools make no timing claim and were left alone.

**`ad20cd1` — `withNationalEventScope` in `apps/admin/src/lib/event-scope.ts`.**
Campus admins now also manage National-campus events, within admin's events
surface only. The four helpers this package ports
(`apps/admin/src/lib/utils/authorization.ts`) are unchanged, so the port is
still faithful; what changed is the context admin feeds them.

This package does not follow, and `identity/scope.ts` now says so rather than
leaving the reader to infer parity from "a faithful port". Two reasons. The
rule lives in an app, not in a shared package or the row permissions — and the
`events` table grants no table-level update at all, so nothing in the backend
expresses it either way. And the event tools here read `event_attendees` and
`segment_members` with the service key precisely because those tables have
`rowSecurity: false`, which makes this campus check the only thing scoping
them; widening it would hand a campus admin another scope's attendee list on
the service key's authority, on the strength of a rule read out of a second
app. The consequence is stated plainly rather than hidden: a campus admin who
can edit a national event in the portal is told "not found" when they ask this
server about its audience. Pinned by a test that says it is a decision, and
carried to `roadmap.md` as a question for a maintainer, since settling it means
knowing whether campus leadership is meant to see national attendee lists.

**An expired fixture, found by the same run.** `server.test.ts` pinned the
briefing's "imminent event" to `2026-09-20`, two days out when it was written.
Real time passed it and the test began failing for a reason unrelated to what
it checks. The fixture is now relative to the clock the briefing actually reads
(`Date.now()`), and the repaired test was re-verified to still fail when the
ordering it guards is reverted. It is this package's only clock-dependent
fixture; the sweep that found it checked every other date literal in the suite,
and the rest are compared against each other, not against now.

### Ninth base move: `ad20cd1 → d6c1c42`

One commit, seven files, every one of them in `apps/`. No schema, no generated
types, no lockfile, no root `catalog`, nothing under `packages/`. The merge was
clean and this package's suite passed before a line of it was read — which is
exactly the situation the rest of this section exists to distrust.

**What moved.** `buildJobRowPermissions` used to swap `read("any")` for
`read("team:biso-members")` on a members-only vacancy. It no longer does: a
published vacancy is world-readable whatever its audience, and the membership
requirement moved to *applying*, checked in `submitJobApplication` against
**live**, uncached status so a student who has just paid can apply straight
away. The operational reason is in the commit: `biso-members` is not a team in
the live project, so the grant matched nobody and hid every members-only
vacancy from every student rather than from non-members. The product reason is
in the new code's own comment — seeing a role you could take as a member is
what sells the membership.

**Does this package mint the ACL that was removed?** No, and not by luck.
`services/permissions.ts` ports `buildContentRowPermissions` from
`apps/admin/src/lib/utils.ts`, the *content* rule, which this commit did not
touch. The recruitment rule lives in `apps/admin/src/lib/recruitment.ts`, which
is deliberately not ported: `content-registry.ts` marks `jobs` `search`- and
`get`-only and withdraws every mutating operation on a vacancy with a reason,
so no code path here writes a `jobs` row. `audience` is not even a column on
that table — it lives inside the `metadata` JSON blob.

**Does public discovery now say the wrong thing?** It did. `searchJobs` never
filtered on audience — it filters on published-and-open — so its *result set*
already agreed with the new rule row for row. What disagreed was the flag it
attached. `PublicItem.memberOnly` is documented here as "requires membership to
use, not to see", and before this move no vacancy could be both: a members-only
vacancy was unreadable by the anonymous client these tools run on, so
`memberOnly: false` was true of everything that came back. After the move such
a vacancy *is* returned, and a non-member still cannot apply to it. The flag
now reads `metadata.audience === "members"`, parsed with the repo's own
`parseRecruitmentVacancyMetadata`, which falls back to schema defaults instead
of throwing so one malformed blob cannot take out public search.

That is the same correction the base move made to the site:
`job-application-form.tsx` now shows a "Become a member" card up front rather
than letting a student complete four steps and a CV upload to be refused on
submit. A client told `memberOnly: false` would have steered them into exactly
that. Four tests pin it: the vacancy is still offered publicly, it is flagged,
a public-audience vacancy is not, and a vacancy with no metadata at all is not
— an absent audience means public, never an unexplained membership wall.

**What was checked and left as it was.**

- *`Principal.isMember` still reads Appwrite team membership.* "No such team
  exists in the project" is an observation about the live instance, not a
  repeal of the mechanism. `apps/admin/src/lib/team-health.ts` still lists
  `biso-members` as a **required** core team provisioned by the M365 sync,
  `apps/admin/src/lib/utils.ts` still mints its grant for member-only news,
  events and pages, and `apps/web/src/lib/data/nav-featured.ts` still runs a
  session client precisely so those row permissions surface in a signed-in
  visitor's nav. Following a recruitment change into content would mean
  widening a read gate on the strength of a comment in a recruitment test.
  `pages.ts`'s member-only branch fails closed either way: if the team really
  is absent then nobody is a member, nobody is served a member-only page, and
  that is what the row permissions do on the site too.
- *`computeMembershipStatus` is a different question.* Paid membership, keyed
  on the numeric student id, is what the new apply gate consults — not team
  membership. This package does not implement applying, so it has no reason to
  reach for it, and reaching for it from an anonymous discovery path would
  answer nothing anyway.
- *The staff `jobs` projection still omits `metadata`.* HR reads a vacancy in
  the recruitment studio, where audience is a field on the form. Pulling the
  whole blob in to surface one key would also pull in the contact e-mail and
  the cover-image URLs — a redaction decision, not a consequence of this move.

### Tenth base move: `d6c1c42 → 0135812`

Three commits, 82 files, and the first base move whose subject is this
package's own. PR #77 strips `.catch(() => null)` out of the apps and adds
`packages/api/errors.ts`, whose header states the rule:

> `.catch(() => null)` around a read turns every failure — a timeout, a 401, an
> outage — into "not found", and the caller then answers 404/409/200-empty for
> what was really a 5xx.

`isNotFound` keys on the numeric `code` and nothing else, `orNullIfNotFound`
rethrows everything that is not a 404, and `createSessionJwt` in
`@repo/api/server` now returns `null` only for a 401 — so an outage is no
longer read as a signed-out caller.

**Nothing here changed, and that is the finding rather than the absence of
one.** `fromAppwriteError` already branches on the numeric `code`:
504/`appwrite_timeout` → `timeout`, 401/403 → `forbidden`, 404 → `not_found`,
409 → `stale_revision`, any other 4xx → `invalid_input`, everything else →
`internal` — and *no* numeric status at all is tagged `transport: true`,
because then the reply may have been lost after a write was applied. Same
distinction, reached independently and for the same reason.

Being able to say that required reading every `catch` in the package that
resolves to a benign value instead of rethrowing. There are eleven. Eight were
read directly; the three in `workflows.ts` are the briefing probes that finding
#54 already made report their own failures. They divide into three kinds:

- **Parsing, not calling.** `result.ts` (a malformed cursor restarts at 0),
  `operations.ts` (a malformed submission body has no readable fields),
  `pages.ts` and `approvals.ts` (`JSON.parse` of a stored column), and the
  fake's query reader. None is a backend call, so none can mask one.
- **A refusal is an answer, not a failure.** `canPublish` catches its own
  `DomainError` and rethrows anything else; `server.ts` counts a failed
  elicitation as *not* confirmed. Both fail in the direction that withholds,
  which is the point of them.
- **One that does swallow a read, deliberately.** `resolve.ts` warns and
  returns `[]` when department resolution fails, so a lookup outage costs the
  caller scope rather than granting it. `apps/admin/src/lib/authorization.ts`
  does the identical thing at line 92, so the port stays faithful. What it
  still gets wrong by this package's own standard is the reporting: the caller
  is told "no departments" where the truth is "could not tell". Roadmap **S11**.

No file under `packages/` that this package imports moved. The diff's
`packages/` changes are `member-pass/*`, `finago-*`, `membership-fulfilment`,
`membership-gate`, `order-refunds` and `payment/*`; the import list here holds
none of them. `membership-gate` is the near miss — it exports a new
`isTransientMembershipReason`, which matters wherever paid membership gates an
action, and this package still implements no such surface (base move 9).

The one line both sides edited is `packages/api/package.json`: the base added
`"./errors"`, this branch had added `"./runtime"`, two entries apart in the
same `exports` block. Git merged both, and the merged block was read rather
than trusted.

### Eleventh base move: `0135812 → fcf6904`

One commit, two files, both in `packages/shared`. It rewrites `localizeVacancy`
and states a rule this package had three copies of and all three got wrong:

> A locale row can exist with some fields left blank (e.g. a title and teaser
> but no body), so each blank field falls back to the first other locale that
> has it — otherwise the detail page renders an empty "About this vacancy"
> while the listing shows a teaser.

The rule is about *presentation*, but the fact under it is about *data*: a
`jobs` translation row can be present for a locale and still carry an empty
title. `toRecruitmentTranslation` in the same file writes `title ?? ""`, so
"absent" normalizes to `""` — and `""` is not nullish, so every
`find(locale)?.title ?? next` in this package returned the empty string and
stopped there. A vacancy the site titles "Kommunikasjonsansvarlig" came back
from three of this package's surfaces with no title at all.

**The sweep asked for the population, not the reported site.** Grepping
`translations` across `src` (minus `translation_refs`, which is content, not
recruitment) gives exactly three places that present a vacancy's translated
fields, and all three were wrong:

| Site | Path | What it did |
|---|---|---|
| `services/discovery.ts` `searchJobs` | public | `pickTranslation` picks the locale's row, then `translation?.title ?? null` |
| `services/recruitment.ts` `titleOf` | staff listing | `find("no")?.title ?? translations[0]?.title ?? null` |
| `services/recruitment.ts` `getVacancy` | staff detail | a **byte-identical copy** of `titleOf`'s expression, inline |

The public path now **composes** the shared helper rather than restating it:
`localizeVacancy` runs first, and `pickTranslation`'s own locale → `no` →
first ordering still applies after it, because the helper returns the list
untouched when the locale has no row at all. The two cannot drift.

The staff path cannot use the helper: `VACANCY_SELECT` projects
`translations.locale` and `.title` alone, and `localizeVacancy` reads
`description` and `short_description`. Widening the projection to satisfy a
helper whose other outputs are discarded would be the wrong trade, and casting
a row that genuinely lacks those fields into the helper's parameter type would
be a lie to the type checker. So `titleOf` carries the title-only form of the
rule, cites the shared file as its source — and the inline copy in `getVacancy`
is gone. One definition, two callers. That duplication mattered on its own
terms: a caller who found a vacancy by title in the listing and opened it by id
was being answered from a second copy of the rule.

**Deliberately not extended to events, news or pages.** Their translations are
published per locale, and `pickPublishedTranslation` exists precisely to keep
a fallback inside what is actually released; blending a published locale's text
into an unpublished one is the bug that function prevents. `pickTranslation`
itself is therefore untouched — it still serves both content and jobs, and only
the jobs call site gained the narrowing.

Five regression tests (`services/vacancy-title.test.ts`). Three fail against the
genuine pre-fix files with `Received: ""`; the other two are controls — the
locale's *own* filled field must survive the fallback, and a Norwegian caller
must see no change.

`getRecruitmentVacancyTitle` in `@repo/shared/recruitment` has the same `??`
gap on the same data, and this package does not call it. Out of scope to edit —
roadmap **S12**.
