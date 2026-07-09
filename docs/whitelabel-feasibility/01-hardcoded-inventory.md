# Whitelabel Feasibility — Hardcoded vs. Configurable Inventory

> Investigation area 1 of 6. Analysis only — no code changes proposed here.
> Covers `apps/web`, `apps/admin`, `apps/api` plus branding surfaces in
> `packages/ui`, `packages/editor`, `packages/i18n`, `packages/shared`.
>
> Portability tags: **portable** (a — already generic/config-driven),
> **moderate** (b — needs extraction to config/DB, no architecture change),
> **blocker** (c — structural assumption; redesign or fork decision required).

## Verdict for this area

The **content plane is already SaaS-shaped** — pages (block editor), events,
news, jobs, products, projects, partners, documents, funding programs,
campuses, and departments are all Appwrite-driven, translated via a generic
`content_translations` model, and rendered through a catch-all CMS route. The
**chrome/identity/theme plane is code**: ~229 files across apps and packages
carry a `biso` literal; there is no central "org profile" object anywhere.
And the **org-structure spine is a hard blocker**: the five-campus model with
fixed numeric IDs 1–5 and BISO's governance bodies is baked into TypeScript
constants, enums, and magic-string matching in at least five independent
locations across three apps.

**Scale (grep-evidenced):**
- `biso` literal: **229 TS/TSX files** across `apps/` + `packages/`.
- `apps/web/src`: `BISO` in **73 files**; `biso.no` × 52; `campus`/`Campus`
  **817 occurrences across 80 files** — the most pervasive domain concept.
- `apps/admin/src`: `BISO|biso` **147 occurrences / 60 files**;
  `biso.no|@biso|biso-members|SG-App` **117 / 44 files**.
- Campus city names (`Oslo|Bergen|Trondheim|Stavanger|National`):
  **114 occurrences across 31 files** in `apps/admin/src` alone.

---

## Findings — org identity & chrome (all moderate)

### INV-01 · moderate · `apps/web` · Org identity is literal strings in ~93 files, no central config
**Current state:** name, legal identity, address, contact emails, and socials
are inline: root metadata "BI Student Organisation"
(`apps/web/src/app/layout.tsx:11-27`); footer with logo path, address
"Nydalsveien 37, 0484 Oslo", `contact@biso.no`, Facebook/Instagram/LinkedIn
URLs (`src/components/layout/footer.tsx:23-88,126`); the entire privacy-policy
legal text inline with 26 BISO literals (`(public)/privacy/page.tsx:42-427`);
terms/press/contact pages; ~40 page `<title>` tags suffixed `| BISO`;
feature mailboxes scattered (`news@biso.no`, `events@biso.no`, `jobs@biso.no`,
`au.finance@biso.no` — `news-info-section.tsx:87`, `event-info-cards.tsx:239`,
`jobs-list-client.tsx:396`, `bi-fondet/page.tsx:80,157`); invite route origin
`https://app.biso.no` (`(auth)/auth/invite/route.ts:55`); Umami analytics
domain + website-id inline (`layout.tsx:55-59`).
**Managed version:** a single org-config source (DB row or env-backed object):
name, legal name, address, domains, mailboxes, socials, analytics. High
volume (~93 files) but mechanical.

### INV-02 · moderate · `apps/admin`, `packages/editor` · Admin/editor brand strings centralized but static
**Current state:** brand palette constant `STUDIO` with BISO claret/gold hex +
font stacks used by nearly every admin component
(`apps/admin/src/app/(portal)/_components/studio.tsx:9-30`); "BISO Studio"
wordmark (`(portal)/sidebar.tsx:113`); login links to `biso.no/contact`,
`biso.no/privacy` (`components/login.tsx:83-124`). The shared editor package
hardcodes `team@biso.no`, "My BISO", BISO logo, "Publish to biso.no"
(`packages/editor/src/editor/operations.ts:83-84,278`, `store.ts:84`,
`topbar/index.tsx:51,63,95`), and the AI copilot system prompt describes
"BISO, a Norwegian BI business school student organisation"
(`editor/ai/prompt.ts:2`).
**Managed version:** theme/branding injection into `STUDIO` and editor topbar;
tenant-aware copilot prompt. Centralization makes this cheaper than web.

### INV-03 · moderate · `packages/i18n` · Message bundles carry BISO copy
**Current state:** i18n infrastructure is fully externalized (next-intl,
`packages/i18n/messages/{en,no}/*.json`), but the *content* is BISO-branded:
`en/about.json` (27 BISO literals), `shop.json` (19), `memberPortal.json`
(15), `partner.json` (12), `home.json` (11); admin bundles include "Ask BISO
Assistant", `@biso.no` placeholders, "BISO recruitment studio"
(`en/adminPortal.json:46,135,246,407-409,922`).
**Managed version:** per-tenant message-bundle overlays, or scrubbing org
names out of copy into interpolated variables. Infra is ready (a); content is
the work (b).

### INV-04 · moderate · `apps/web`, `apps/api` · Infrastructure allow-lists hardcode biso.no
**Current state:** `images.remotePatterns` allow-lists `appwrite.biso.no`,
`biso.no`, `static.tickster.com` (`apps/web/next.config.ts:24-50`); API CORS
allow-list is a literal biso.no set
(`apps/api/src/lib/allowed-origins.ts:1-6`); Appwrite storage URLs with
`?project=biso` inline (`about-section.tsx:125`,
`packages/ui/lib/placeholder-images.ts:2`); Teams bot env example ships real
BISO GUIDs (`apps/api/.env.example:127-134`).
**Managed version:** env/config-driven origin and image-host lists.

---

## Findings — org structure (the blockers)

### INV-05 · blocker · all three apps + `packages/shared` · Five-campus model with fixed numeric IDs baked into code
**Current state:** a `campus` Appwrite table exists and campus rows are
data-driven, but the name↔ID mapping and city list are compile-time constants
that must agree with the table, duplicated independently in at least five
places:
- `CAMPUS_NAME_TO_ID = {Oslo:"1", Bergen:"2", Trondheim:"3", Stavanger:"4",
  National:"5"}` (`apps/admin/src/lib/campus-constants.ts:14-25`) — the
  canonical map, imported everywhere.
- `CAMPUS_CITY_NAMES` / `KNOWN_CAMPUS_NAMES`
  (`packages/shared/utils/team-roles.ts:16-26`) — drives role derivation.
- A second, independent `CAMPUS_MAPPINGS` array with per-campus default
  departments and management-department IDs (Oslo→"2" … National→"1002")
  (`apps/api/src/app/api/campus/[campusId]/[departmentId]/board/route.ts:30-66`).
- Web team tab re-hardcodes `NATIONAL_CAMPUS_ID = "5"` +
  `MANAGEMENT_DEPARTMENT_IDS`
  (`apps/web/src/app/(public)/campus/components/team/team-tab.tsx:20-29`).
- Expense approvers hardcode `OSLO_CAMPUS_ID="1"`, `NATIONAL_CAMPUS_ID="5"`,
  campus email slugs (`packages/shared/utils/expense-approvers.ts:55-70`).
- 24SevenOffice department **number ranges** map to campuses (1–299→Oslo,
  300–599→Bergen, …) (`apps/api/src/app/api/units/sync/route.ts:10-24`).
**Managed version:** org hierarchy as data (org units with types/IDs defined
per tenant), removal of all literal ID/name references. This is a
data-modeling change with a blast radius across all three apps.
**Why blocker:** a tenant with different geography — or no campus concept —
breaks role derivation, content scoping, expense routing, board rendering,
and ERP sync simultaneously.

### INV-06 · blocker · `apps/web` · "National" as magic string + BISO governance bodies hardcoded
**Current state:** the National campus is special-cased by *name matching*:
`Query.notEqual("name","National")` (`apps/web/src/app/actions/campus.ts:95`),
`.filter(c => c.name?.toLowerCase() !== "national")` (`contact/page.tsx:36`,
`fs/new/page.tsx:33`). `NATIONAL_GROUPS` hardcodes BISO's governance bodies —
Operations Unit / Administration / Control Committee / Branding Committee —
as literal UI segments (`team-tab.tsx:41-60,176`). Shop pickup locations bake
the four-city set into a TypeScript union type
(`src/lib/shop/pickup-locations.ts:9-36`).
**Managed version:** an `is_national`-style flag or org-unit-type on campus
rows; governance structure as data.

### INV-07 · blocker · `apps/web` · BI-school identity assumptions
**Current state:** student email constructed as `${studentId}@bi.no`
(`member/member-portal-content.tsx:99`; also `orders.ts:78`,
`membership.ts:246`); "BI Student" OIDC identity assumed for membership;
footer/resources link `bi.no`. Fixed `/about/*` subroutes enumerate
BISO-specific pages (SAIH, bylaws, what-is-biso) (`src/app/sitemap.ts:14-24`).
**Managed version:** per-tenant identity-provider and email-domain config;
about-pages already CMS-capable via the block editor.

### INV-08 · blocker · `apps/admin`, `apps/api`, `packages/shared` · Role/permission structure is BISO's org chart in code
**Current state:** only two first-class roles exist — `globaladmin`,
`campusadmin` (+ `department` pseudo-role)
(`apps/admin/src/lib/roles.ts:17-23`); the entire authorization matrix is a
hardcoded ~40-key `NAV_ACCESS` map (`roles.ts:32-82`). Role derivation:
globaladmin ≙ `National` + `"Operations Unit"` teams; campusadmin ≙
`Ledelsen {City}` + city team — Norwegian word "Ledelsen" hardcoded
(`packages/shared/utils/team-roles.ts:37-100`). HR is an ad-hoc string check
on the `sg-app-dept-hr` team (`apps/admin/src/lib/recruitment.ts:43-101`).
`apps/api/src/lib/admin-auth.ts:45-96` re-implements the same model.
(Full treatment in `02-identity-auth.md`, AUTH-04.)
**Managed version:** per-tenant role definitions + group→role mapping;
`NAV_ACCESS` moved to config (mechanism is already generic key→roles).

### INV-09 · blocker/moderate · `apps/web` · Norwegian student-union flows as fixed routes
**Current state:** varsling (whistleblowing) at `/varsling` + `/safety` with
hardcoded Norwegian email subjects ("BISO Varsling - Ny sak")
(`src/app/actions/varsling.ts:63-79`) — though settings come from a
`varsling_settings` collection and the admin side handles it through the
generic form-submissions inbox (portable). BI-fondet fund at `/bi-fondet` is
fully DB-driven via `getFundingProgramBySlug("bi-fondet")` — only the slug and
fallback email are hardcoded (near-portable). Expense reimbursement (`/fs`,
`/expenses`) is generic UI over BISO's approval chain (see
`03-payments.md`). Flagship project keys (`fadderullan`, `winterGames`,
`karrieredagene`, `inspire`) hardcoded in nav
(`src/components/nav/nav-config.ts:116-121`).
**Managed version:** feature-flag these modules per tenant (flag infra
already exists); make nav config data-driven.

---

## Findings — already portable (the assets)

### INV-10 · portable · `packages/editor`, `apps/web` · Block-editor CMS pipeline
Catch-all `(public)/[...slug]/page.tsx` renders arbitrary CMS pages via
`getPage(slug, locale)` + `PageDoc`; sitemap enumerates published `pages`
rows (`sitemap.ts:52-64`). Draft/publish via `@repo/api/page-builder`. The
editing engine (dnd-kit + immer + zustand, theme tokens, AI copilot) is
schema/theme-driven and org-agnostic apart from the INV-02 strings.

### INV-11 · portable · both apps · Generic translated content CRUD
Pages, news, events, jobs, benefits, shop, communications all follow one
pattern: Appwrite table + `content_translations`/`page_translations`,
`campus_id`/`department_id` scoping via `applyScopeQueries()`
(`apps/admin/src/lib/utils/authorization.ts`), `logAuditEvent()` +
`revalidatePath()`. The *mechanism* is fully generic; only the campus
identity it scopes on is hardcoded (INV-05).

### INV-12 · portable · `packages/shared` · Feature-flag system
Code-defined catalog + DB-override rows in `feature_flags` table with
`mergeFlagStates()` (`packages/shared/utils/feature-flags.ts:121-132`), admin
UI at `(portal)/settings/feature-flags`. This is the natural home for
per-tenant module toggles (payments, recruitment, expenses, varsling…).

### INV-13 · portable · `apps/admin` · Form-submissions inbox, audit log, settings model
Topic/status/campus-scoped generic inbox (`_actions/submissions.ts`) — powers
varsling without special-casing. Generic audit log
(`_actions/audit-log.ts`). Per-user prefs on Appwrite `prefs` (timezone list
hardcodes `Europe/Oslo`/`UTC` — trivial).

### INV-14 · portable · `apps/api` · Config endpoint + generic auth mechanisms
`config/route.ts:7-28` reads `config/app-config.json` (content sources +
feature toggles) — the one genuinely file-config-driven surface. Cron
shared-secret auth (`safeSecretCompare`), payment-webhook signatures, and the
CORS *mechanism* are generic.

---

## Classification rollup

| ID | Portability | Scope |
|---|---|---|
| INV-01 | moderate | Web org identity strings (~93 files) |
| INV-02 | moderate | Admin `STUDIO` tokens + editor-package brand strings |
| INV-03 | moderate | BISO copy inside i18n bundles |
| INV-04 | moderate | Image/CORS allow-lists, `?project=biso` URLs |
| INV-05 | **blocker** | Campus IDs 1–5 + city list in ≥5 independent locations |
| INV-06 | **blocker** | "National" magic string, hardcoded governance bodies |
| INV-07 | **blocker** | `@bi.no` student email + BI OIDC assumptions |
| INV-08 | **blocker** | Two-tier role model + `NAV_ACCESS` in code |
| INV-09 | blocker/moderate | Norwegian student-union flows as fixed routes |
| INV-10 | portable | Block-editor CMS pipeline |
| INV-11 | portable | Translated content CRUD + scoping mechanism |
| INV-12 | portable | Feature-flag system (per-tenant toggle home) |
| INV-13 | portable | Submissions inbox, audit log, settings |
| INV-14 | portable | API config endpoint, cron/webhook auth |
