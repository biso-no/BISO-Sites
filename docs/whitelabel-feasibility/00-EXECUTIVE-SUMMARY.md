# Whitelabel Feasibility — Executive Summary

> Exploration of turning BISO-Sites into a whitelabeled multi-tenant SaaS.
> Analysis only — no implementation plan. Findings grounded in code with
> `file:line` evidence across six investigation areas:
>
> 1. `01-hardcoded-inventory.md` — hardcoded vs. configurable map
> 2. `02-identity-auth.md` — Azure AD/M365, Appwrite auth, roles
> 3. `03-payments.md` — Vipps/Stripe/Finago portability
> 4. `04-data-model-tenancy.md` — schema, permissions, **the A/B decision**
> 5. `05-content-i18n-branding.md` — content types, locales, theming
> 6. `06-effort-classification.md` — consolidated severity matrix

## Is it feasible?

**Yes — the bones are better than a purpose-built single-org app usually
has.** Several subsystems were built abstraction-first and are genuinely
whitelabel-ready today: the block-editor CMS (data-driven registry, shared
web/admin rendering, JSON documents), the payment core (provider-abstracted
Vipps/Stripe with DB-managed per-provider credentials — the in-repo prototype
for how all tenant config should work), the connectors layer (fully
parameterized, no hardcoded tenant IDs), the theming token architecture, the
feature-flag system, and cookie-based locale routing. Appwrite being
self-hosted with a complete declarative schema (`appwrite.config.json`, 83
tables) makes per-tenant provisioning realistic.

**But it is not a rebranding exercise.** `biso` appears as a literal in 229
TS/TSX files; there is no central org-config object anywhere; and two
structural assumptions are welded through all three apps.

## The two unconditional blockers

1. **BISO's org structure is compile-time code.** The five campuses with
   fixed numeric IDs 1–5, the "National" magic string, governance bodies, and
   the two-tier role model (globaladmin/campusadmin derived from Azure AD
   group *names* like `SG-App-Campus-Oslo` and `Ledelsen Oslo`) are hardcoded
   in at least five independent locations across `apps/web`, `apps/admin`,
   `apps/api`, and `packages/shared` — and the campus IDs double as database
   foreign keys. Every content collection *requires* `campus_id`. A tenant
   with different geography — or no campus concept — breaks role derivation,
   content scoping, expense routing, and board rendering simultaneously.

2. **Admin auth assumes Microsoft.** The admin app's only login path is
   Azure OAuth, and Microsoft Graph group-sync sits on the critical login
   path. An org without M365 cannot sign in at all. (The public web app, by
   contrast, is multi-provider and close to portable.)

Everything else on the blocker list is either severable for a given tenant
(Vipps is Nordic-only but optional; Finago accounting fails soft when
unconfigured; membership verification is cleanly abstracted behind one
function call) or narrow (the `"NOK"` currency enum is a hard validation
today but a mechanical fix).

## Rough shape of the effort

- **~17 findings already portable** — the assets above.
- **~24 moderate findings** that collapse into essentially one program:
  *build a tenant-config layer* (org identity, domains, mailboxes, branding
  palette/assets/fonts, cookie domain, locale sets, email templates,
  allow-lists) and migrate ~229 files of literals into it. High volume,
  mechanical, low individual risk.
- **~10 blockers**, of which two are unconditional (org-structure model,
  admin auth) and three exist only under shared-infra tenancy.

## The single biggest fork in the road

**Fork-per-tenant (A) vs. shared-infra row-level multi-tenancy (B).** This is
laid out in full in `04-data-model-tenancy.md`; the facts in brief:

- **There is no tenant dimension today**: 0/83 tables carry an org
  discriminator; 189 DB call sites pass IDs directly with no query-layer
  chokepoint (~147 have no scoping filter at all); ~24 collections are
  `read("any")` at collection level, which overrides row permissions.
- **Appwrite's grain favors A**: auth providers, users, teams, and keys are
  project-scoped. Model A gets hard isolation free and lets per-tenant IdPs
  use platform features; Model B fights the platform on identity and puts
  isolation correctness on application discipline at every one of 189 call
  sites, with no RLS safety net.
- **B's migration is a strict superset of A's.** All the org-config and
  branding extraction is needed either way; B adds the org_id backfill,
  re-permissioning, query-layer rework, per-tenant credential storage, and
  shared-user-pool redesign on top. A can evolve toward B later; the reverse
  investment doesn't recover.
- **The cost curves cross with tenant count.** A: cheap first tenants,
  linear ops cost (N deployments, N upgrade runs). B: large upfront program,
  near-zero marginal tenant cost.

**Decision inputs that are business questions, not code questions:** expected
tenant count, and whether prospective tenants (student unions and similar
orgs) prefer hard data isolation — many would. A middle path exists and is
what the current env-driven architecture most naturally becomes: **shared
codebase, Appwrite-project-per-tenant, one multi-tenant control plane** —
fork-model isolation without fork-model code divergence.

## Bottom line

Feasible, with real assets to build on. The work is one large mechanical
program (tenant-config extraction), two genuine redesigns (org-structure
model, admin auth/roles), and one architecture decision (A vs. B) that
should be made deliberately — on tenant-count and isolation-expectation
grounds — before any of the redesign work starts, because it determines how
the org model, credentials, and provisioning are shaped.
