# Whitelabel Feasibility — Effort/Risk Classification Rollup

> Investigation area 6 of 6. Consolidates every finding from areas 1–5 into a
> single effort-tagged matrix. Analysis only — no implementation plan here.
>
> Tags: **(a) portable** — already generic/config-driven, little or no work ·
> **(b) moderate** — extraction/abstraction, no architecture change ·
> **(c) blocker** — fundamental redesign or fork decision required.
> "×A/×B" marks findings whose severity depends on the tenancy model chosen
> (A = fork-per-tenant, B = shared-infra; see `04-data-model-tenancy.md`).

## The blocker list (what actually gates whitelabeling)

| # | Finding | Area | Why it's structural |
|---|---------|------|---------------------|
| 1 | **No tenant dimension exists** — 0/83 tables have an org discriminator; 189 DB call sites, no query chokepoint; ~24 collections `read("any")` (TEN-01/02/03) | Tenancy | Blocker for shared-infra (B); largely dissolved by fork model (A) |
| 2 | **Five-campus org model in code** — IDs 1–5 + city names + "National" magic string + governance bodies duplicated across ≥5 locations in 3 apps (INV-05/06, CNT-01) | Inventory/Content | Blocks ANY tenant whose org shape differs — independent of A/B choice |
| 3 | **Admin auth is Microsoft-only + BISO taxonomy** — sole login path is Azure OAuth; roles derived from `SG-App-*` group names + hardcoded campus/team constants, duplicated in admin and api (AUTH-03/04, INV-08) | Identity | Non-M365 orgs cannot log in; role model is BISO's org chart |
| 4 | **Finance is Norway-shaped** — Finago/24SO is the only ledger sink (fails soft); expense approval chain hardcodes BISO's routing incl. literal person mailboxes; ERP dept-number ranges map to campuses (PAY-06, admin §3) | Payments | Severable for tenants that skip accounting; blocker for tenants that need it |
| 5 | **NOK closed enum at checkout boundary** (PAY-03) | Payments | Hard validation today; narrow, mechanical fix |
| 6 | **Membership verification bound to BI/Finago** — external `verify_biso_membership` function + "BI Student" OIDC + 24SO categories + `@bi.no` email construction (AUTH-08, PAY-07, INV-07) | Identity/Payments | Provider is org-specific by nature; abstraction boundary already clean |

Items 2 and 3 are the only blockers that are **unconditional** — they bite
every prospective tenant regardless of tenancy model or feature selection.
Item 1 is the architectural fork in the road. Items 4–6 are severable or
narrow.

## Full matrix by area

### Area 1 — Hardcoded inventory (`01-hardcoded-inventory.md`)

| Finding | Tag |
|---|---|
| INV-01 Web org-identity strings (~93 files, no central org config) | b |
| INV-02 Admin `STUDIO` tokens + editor-package brand strings | b |
| INV-03 BISO copy inside i18n bundles | b |
| INV-04 Image/CORS allow-lists, `?project=biso` URLs | b |
| INV-05 Campus IDs 1–5 + city list in ≥5 locations | **c** |
| INV-06 "National" magic string, hardcoded governance bodies | **c** |
| INV-07 `@bi.no` email + BI OIDC assumptions | **c** |
| INV-08 Two-tier role model + `NAV_ACCESS` in code | **c** |
| INV-09 Norwegian student-union flows as fixed routes | b/c |
| INV-10 Block-editor CMS pipeline | a |
| INV-11 Translated content CRUD + scoping mechanism | a |
| INV-12 Feature-flag system | a |
| INV-13 Submissions inbox, audit log, settings | a |
| INV-14 API config endpoint, cron/webhook auth | a |

### Area 2 — Identity & auth (`02-identity-auth.md`)

| Finding | Tag |
|---|---|
| AUTH-01 BISO fallback defaults in `@repo/api` | b |
| AUTH-02 Web multi-provider auth + lazy anon sessions | a |
| AUTH-03 Admin login Microsoft-only | **c** |
| AUTH-04 Role model = BISO taxonomy + Azure group names | **c** |
| AUTH-05 Graph/SharePoint connector layer (parameterized) | a |
| AUTH-06 `.biso.no` cookie domain + boot guard | b |
| AUTH-07 Single Azure tenant per deployment (env) | b ×A / c ×B |
| AUTH-08 Membership check — clean abstraction, BI provider | b |
| AUTH-09 Scattered org-identity fallbacks | b |

### Area 3 — Payments (`03-payments.md`)

| Finding | Tag |
|---|---|
| PAY-01 Provider abstraction (shared params + state machine) | a |
| PAY-02 DB-managed per-provider credentials, test/live | a |
| PAY-03 NOK closed enum + locale-fixed formatters | **c** (narrow) |
| PAY-04 Vipps Nordic-only (severable); Stripe missing refund ops | c-severable / b |
| PAY-05 Provider-agnostic checkout/callback/return | a |
| PAY-06 Finago-only accounting (fails soft) | **c** (severable) |
| PAY-07 Membership status bound to Finago categories | **c** |
| PAY-08 Orphaned WooCommerce proxy | a (delete) |
| PAY-09 No VAT engine | b |

### Area 4 — Data model & tenancy (`04-data-model-tenancy.md`)

| Finding | Tag |
|---|---|
| TEN-01 No tenant discriminator; dual campus representation | **c** ×B / a ×A |
| TEN-02 `read("any")` collections + org-wide teams | **c** ×B / a ×A |
| TEN-03 189 call sites, no query chokepoint | **c** ×B / a ×A |
| TEN-04 Scattered literal IDs, no constants module | b (both models) |
| TEN-05 Bucket org assumptions + config/code drift | b |
| TEN-06 Single-org cron dispatcher | b ×A / c ×B |
| TEN-07 Self-hosted Appwrite, declarative schema, provisioning seeds | a |
| TEN-08 Single project in cookies/session/user pool | b ×A / **c** ×B |
| TEN-09 Campus scoping as org_id blueprint | a (template) |

### Area 5 — Content, i18n, branding (`05-content-i18n-branding.md`)

| Finding | Tag |
|---|---|
| CNT-01 Required campus/department axis on content schemas | **c**/b |
| CNT-02 Schema-driven CMS provisioned but unwired | b (opportunity) |
| CNT-03 Block-editor architecture | a |
| CNT-04 BISO data-blocks, campusSelector, editor hue types | b/**c** |
| I18N-01 `["no","en"]` in code + DB enums | b |
| I18N-02 Static bundles, no tenant override layer | b |
| I18N-03 Cookie-based locale routing | a |
| I18N-04 String hygiene outside bundles | a |
| BRD-01 Token architecture right, values static | a/b |
| BRD-02 Ad-hoc color tail (~1,300 occurrences) | b |
| BRD-03 Static brand assets, font, `| BISO` titles | b |
| BRD-04 Inline BISO/Norwegian email + AI prompts | b |

## Shape of the effort (counts, not plans)

- **Portable (a): 17 findings.** The genuinely strong assets: block-editor
  CMS pipeline, payment core + credentials pattern, connector layer, web
  auth, feature flags, i18n/locale infrastructure, theming token layer,
  campus-scoping mechanics as a template, declarative Appwrite schema.
- **Moderate (b): ~24 findings.** Dominated by one theme: **there is no
  central org-config object** — name, domains, mailboxes, socials, cookie
  domain, brand palette, assets, fonts, email copy, locale sets, allow-lists
  are all inline. Most (b) work collapses into "build a tenant-config layer
  and migrate literals into it." High volume (~229 files reference `biso`),
  low individual risk.
- **Blocker (c): ~10 findings**, but only **two are unconditional**: the
  campus/org-structure model in code and the admin auth/role architecture.
  Three more are tenancy-model-dependent (dissolve under fork model), and
  the rest are severable (Vipps, Finago, membership provider) or narrow
  (NOK enum).
