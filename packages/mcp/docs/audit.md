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
