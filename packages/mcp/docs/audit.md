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
