# Whitelabel Feasibility — Content Types, i18n & Branding/Theming

> Investigation area 5 of 6. Analysis only — no code changes proposed here.
> Portability tags: **portable** (a) · **moderate** (b) · **blocker** (c).

## Verdict for this area

**The block editor is the platform's strongest whitelabel asset** — a
data-driven block registry shared between web (render) and admin (edit),
JSON-blob page documents, per-page accent theming, and ~26 of 35 blocks fully
generic. The theming token layer and cookie-based (non-path) locale routing
are also structurally favorable. The blockers are the required
campus/department axis baked into every content collection's schema, and the
`["no","en"]` locale pair threaded through code *and DB enums*. The biggest
latent opportunity: a well-designed schema-driven CMS
(`content_templates`/`content_entries`) already exists in the database schema
— completely unwired to any app code.

---

## Findings — content types

### CNT-01 · blocker (coupling) / moderate (columns) · schema · Fixed content collections require campus/department
**Current state:** every content collection carries a **required**
`campus_id` plus a `department` relationship: `events` (36 cols, incl.
`member_only`, `member_price`, `pricing_mode`), `jobs` (15 cols, incl.
`interview_template`, `screening_rubric`), `webshop_products` (21 cols, incl.
`finago_account_number`), `news`, `products` (separate marketplace
collection), `pages`. The campus+department pair is load-bearing: it drives
row ACLs, list scoping, and team ownership — not just a tag. Rendering/editing
splits: web actions (`apps/web/src/app/actions/events.ts` etc.) + editor
blocks; admin studio editors
(`(portal)/events/[id]/_components/event-studio-editor.tsx`,
`job-studio-editor.tsx`, `shop-studio-editor.tsx`).
**Managed version:** org-unit scoping must become optional/configurable per
tenant; member-pricing and `finago_*` columns are nullable and per-tenant
ignorable (moderate).

### CNT-02 · moderate (opportunity) · schema · A schema-driven CMS exists — as dead schema
**Current state:** `content_templates` (family enum: `page|policy|article`),
`content_template_versions` (`field_schema` JSON, `layout_document`,
`bindings`, `preview_seed_data`), `content_entries` (`kind`, `template_id`,
`scope`: `global|campus|department`, `visibility`), `content_entry_locales`
(`field_values` JSON, `locale`, `translation_status`). This is a versioned,
localized, schema-per-template CMS — exactly the primitive
"org-configurable content types" needs. **But it is unwired:** grep for these
table names across all app code returns only the auto-generated types file
and a review doc. No code creates, edits, or renders these rows. Its enums
are BISO-fixed (`family`, `scope`, `locale` = no/en).
**Managed version:** building this out (and de-BISO'ing its enums) is the
natural path to per-tenant content types — but it is greenfield work today,
not a refactor.

### CNT-03 · portable · `packages/editor` · Block editor architecture is genuinely generic
**Current state:** self-registering registry —
`registerBlock(def)`/`getBlock()`/`allBlocks()`
(`packages/editor/src/blocks/registry.ts`), 35 blocks registered by
side-effect import (`blocks/index.ts`). Uniform contract: `{ type, label,
category, Render, Inspector, PaletteThumb, empty(), schema?, aiHint?,
variants? }` (`blocks/types.ts:17-33`). **Web renders through the same
registry** via a web-safe barrel
(`apps/web/.../[...slug]/_components/rendered-page.tsx:4-5`,
`packages/editor/src/render/index.ts`) — one block implementation, two
consumers. Documents persist as JSON blobs
(`page_translations.draft_document`/`puck_document`,
`page-builder.ts:172-185`). Per-page accent theming already works
(`rendered-page.tsx:35-37` sets `--accent` from `doc.meta.accentColor`).
~26/35 blocks fully generic (hero, text, quote, callout, layout, media, cta,
faq, forms, …). No hardcoded membership-CTA-with-pricing block exists.

### CNT-04 · moderate/blocker · `packages/editor` · BISO-coupled blocks and editor defaults
**Current state:** a "Pull from BISO" category (`registry.ts:64-73`);
`campusSelector` hardcodes the four campuses as a literal array
(`blocks/campusSelector/render.tsx:6-11`) — **(c)**; `events`/`jobs`/`news`
feed blocks resolve data from `doc.meta.department` with store default
`department: "biso"` (`editor/store.ts:84`) and BISO `/api/pages/*` endpoints
(`blocks/events/render.tsx:15-31`) — **(b)**; `departmentGrid`, `partners`,
`productGrid`, `profileHeader` bound to BISO collections — **(b)**. Editor
theme bakes BISO hues into the type system: `HUE_COLORS`
(claret/gold/leaf/sky) + `DEPARTMENT_ACCENTS` keyed by BISO dept slugs
(`theme/presets.ts:3-21`); `TeamMember.hue` is a fixed union type. A second,
separate rich-text editor (`packages/ui/components/editor/`, Plate.js) has
BISO-content-type mention plugins (news/events/jobs/products) — **(b)**.
**Managed version:** data-source blocks parameterized by tenant config;
palette moved from type unions to config.

---

## Findings — i18n

### I18N-01 · moderate · everywhere · Locales hardcoded to `["no","en"]` through code AND DB enums
**Current state:** `SUPPORTED_LOCALES = ["no","en"]`, `DEFAULT_LOCALE = "no"`
(`packages/i18n/config.ts:1-5`); `loadMessages` is a literal switch
(`messages/index.ts:3-10`); `PAGE_LOCALES = ["no","en"]` + `locale="no"`
defaults (`packages/api/page-builder.ts:115,311,409,509`);
`EditorLocale = "no"|"en"` (`packages/editor/src/editor/types.ts`); **DB
enums** hardcode locales on `content_entries.source_locale`,
`content_entry_locales.locale`, `page_translations.locale` — adding a locale
is a schema migration.
**Managed version:** per-tenant locale sets; locale columns as strings (BCP
47) instead of enums; dynamic message loading. next-intl itself supports
arbitrary locales — the constraint is self-imposed.

### I18N-02 · moderate · `packages/i18n` · Static build-time bundles, no tenant override layer
**Current state:** 32 namespaces × 2 locales as JSON compiled into static
`en.ts`/`no.ts` exports. Changing copy requires a rebuild. Namespaces encode
BISO's domain (`varsling`, `businessHotspot`, `fundingProgram`,
`membership`). BISO-branded copy inside bundles quantified in INV-03.
**Managed version:** runtime message-merge layer (tenant overrides over base
bundle) + org name/taxonomy as interpolated variables.

### I18N-03 · portable · both apps · Cookie-based locale routing is tenant-friendly
**Current state:** no `[locale]` path segment, no middleware; locale resolves
from the `NEXT_LOCALE` cookie (`apps/web/src/i18n/request.ts:6`) or admin
user prefs. Locale is orthogonal to routing — per-tenant domains won't
collide with locale paths.

### I18N-04 · portable · components · Hardcoded-string hygiene is strong
**Current state:** only ~11 stray Norwegian strings outside message bundles
across web+admin+ui components ("Les mer" ×1, "Søk" ×3, "Medlem" ×2, …).
Exception: the editor package isn't wired to next-intl at all (hardcoded
English UI strings, e.g. campusSelector "Choose your campus") — small
cleanup. Email bodies are the real string problem (BRD-04).

---

## Findings — branding/theming

### BRD-01 · portable (foundation) / moderate (values) · `packages/ui`, apps · Token architecture is right; values are static
**Current state:** `packages/ui/styles/globals.css` maps Tailwind utilities →
CSS vars via `@theme inline`, including a full `--brand-*` family (:70-95),
with the comment "The actual color VALUES are defined by each app." Values
live in per-app static CSS: BISO blue/navy/yellow oklch+hex in
`apps/web/src/app/styles.css:54-264` (incl. raw brand rgba re-hardcoded in
utility classes :172-264) and `apps/admin/src/app/styles.css` (316 lines).
Dark mode via next-themes + `.dark` token blocks — generic.
**Managed version:** runtime-injected `:root` values from tenant config
(e.g. a `<style>` block in `layout.tsx`); deduplicate the two per-app value
files. Because usage is token-based, re-theming then propagates without
component rewrites — for the tokenized share.

### BRD-02 · moderate · apps + `packages/ui` · Large ad-hoc color tail alongside the tokens
**Current state (grep counts):** **963** brand-token class usages (re-theme
for free) vs **747** named Tailwind palette classes (`bg-sky-500` etc. — some
semantic, some ad-hoc brand) and **586 hardcoded hex across 49 files**
(top: `font-color-toolbar-button.tsx` 87 — legitimate picker data;
`job-studio-editor.tsx` 76; syntax-highlight theme 35; studio-editor preset
swatches 16-29 each). Admin's `STUDIO` constant (INV-02) is part of this.
**Managed version:** an audit pass separating legitimate data (pickers,
syntax themes, status colors) from ad-hoc brand usage; migrate the latter to
tokens. A per-tenant re-skin won't be pixel-clean until then.

### BRD-03 · moderate · `public/`, `packages/ui` · Brand assets and fonts are static files
**Current state:** logos, favicons, OG images, the BISO tagline asset, and
the licensed Museo Sans font binary all ship in `apps/web/public/`
(`packages/ui/lib/fonts.ts:3-7` loads `museo_sans_300.otf` via
`localFont`). Logos referenced by static path in ~17 components. Metadata
title suffix `` `${title} | BISO` `` hardcoded in the CMS catch-all
(`[...slug]/page.tsx:26`) and ~40 other titles (INV-01). No manifest/PWA
theme config. The `departments` table already has a `logo` column and
storage buckets exist — the storage primitive for managed assets is present.
**Managed version:** tenant asset config (logo/favicon/OG/font refs to
storage) + a central branding provider replacing static imports.

### BRD-04 · moderate (wide) · apps, `packages/ai` · Transactional email is inline, BISO-branded, partly Norwegian
**Current state:** no template layer exists. Varsling emails hardcode
Norwegian subject/body/footer inline
(`apps/web/src/app/actions/varsling.ts:63-79`); form-submit notification
footer "Sent via BISO page form" (`api/form/submit/route.ts:155`); expense
approval hardcodes `https://web.biso.no` and "BISO member"
(`apps/api/src/lib/expense-approval.ts:42,802`); a static BISO expense HTML
template (`apps/api/public/expense-template.html`); the recruitment-email AI
prompt hardcodes "recruitment communications assistant for BISO, a Norwegian
student union" and signs "Best regards,\nBISO HR"
(`packages/ai/src/server/recruitment-emails.ts:44-53`).
**Managed version:** a per-tenant templated email layer + parameterized AI
prompts. No structural blocker, but many touch points.

---

## Classification rollup

| ID | Portability | Scope |
|---|---|---|
| CNT-01 | **blocker**/moderate | Required campus/department axis on all content schemas |
| CNT-02 | moderate (opportunity) | Schema-driven CMS provisioned but unwired |
| CNT-03 | portable | Block-editor architecture (registry, shared render, JSON docs) |
| CNT-04 | moderate/**blocker** | BISO data-blocks, campusSelector, editor hue types |
| I18N-01 | moderate | `["no","en"]` in code + DB enums |
| I18N-02 | moderate | Static bundles, no tenant override layer |
| I18N-03 | portable | Cookie-based locale, no path/middleware coupling |
| I18N-04 | portable | Minimal stray hardcoded strings (editor pkg excepted) |
| BRD-01 | portable/moderate | Token architecture right; values static + duplicated |
| BRD-02 | moderate | ~1,300-occurrence ad-hoc color tail vs 963 tokenized |
| BRD-03 | moderate | Static brand assets, font binary, `| BISO` titles |
| BRD-04 | moderate | Inline BISO/Norwegian transactional email, AI prompts |
