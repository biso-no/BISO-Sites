# Benefits studio: one place for every benefit, partners and logos — design

## Why

The Branding Committee asked (October 2026) whether there is a maximum number
of member benefits, because a benefit they added in admin "doesn't show up",
and how to edit the benefits "fetched from the old site". Both have the same
cause: the site has two unrelated benefit systems.

- The lists on `/membership`, `/students` and the campus page come from text
  arrays on `campus_data` (copied from the old WordPress site). Nothing in
  admin can edit them; only the Appwrite console can.
- Benefits created in admin (`campus_benefits`) only render in the member
  portal (`/member`), filtered by the visitor's profile campus.

Campuses gain and lose partners and deals during the year. The committee must
be able to add, edit, end and delete **every** benefit shown anywhere (website
and app) without a developer. The committee is **not technical**: the admin
must feel obvious, look good, and never show IDs, enum values or jargon.

## Success looks like

- A Bergen campus admin opens **Fordeler**, picks Bergen, presses "+ Legg til"
  under Medlemsfordeler, fills in "20 % hos Løft studios", picks the partner,
  chooses "Rabattkode", types `LOFT20` and publishes, all in under two
  minutes. Within a minute it is on Bergen's campus page, in the member
  portal and in the app next to the member pass. Non-members see the deal but
  never the code.
- A Bergen committee member (a Bergen campus admin) ends the Dogtails
  partnership with one click.
  Both Dogtails deals disappear from the site and the app. Months later they
  restart it and the same deals are back as they were.
- The Fadderullan deal has an end date. It disappears by itself after
  fadderuken, stays greyed out on the board, and next August the editor
  changes the dates and it is live again.
- A new sponsor logo uploaded on the Logoer tab shows on the home page within
  a couple of minutes.
- The committee leader rewrites the "Bli med" bullets on the home page and
  the bullets on the membership plan cards, in Norwegian, and the English
  versions follow automatically.
- After the switch, no benefit text on the website or in the app comes from
  `campus_data`, and nobody needs the Appwrite console or a developer to
  change a benefit or a sentence about what membership gives.

## Non-goals

- Visual redesign of the website pages. The campus page and member portal
  layouts are fine; `/membership` and `/students` keep their layouts. Only
  their data source changes.
- A benefits analytics page (the unused `benefitsAnalytics` nav key).
- Push notifications when a benefit is published. Possible follow-up on top
  of the push work (`docs/superpowers/specs/2026-10-20-push-notifications-design.md`).
- Dropping the old `campus_data` benefit columns. They stop being read; a
  later cleanup can remove them.
- Page headings, section titles and section descriptions (e.g. "Eksklusive
  fordeler og rabatter for BISO-medlemmer"), FAQ text and hero stats. These
  stay in i18n. Only the bullet lists in D13 become editable.
- The contradictory **member** counts ("10,000+" vs "over 9,000").
- Partner self-service ("API Beta", "invitation"). Removed, not built.

## Anti-goals (would make this a failure even if it "works")

- After migration, the same benefit shows twice on a page.
- A redemption code or member link is visible to a non-member, anywhere:
  rendered HTML, client props, the public Appwrite API, or the app.
- Saving a live benefit takes it off the site without the editor clearly
  choosing that.
- A page shows empty benefit sections during the switch-over.
- Someone outside the agreed editor roles changes a benefit, or a campus
  admin changes another campus's benefits.
- The admin exposes IDs, raw enum values, table names or untranslated keys.

## Current state (recon, 2026-10-21)

**Live data (prod, read-only checks)**
- `campus_data` rows `1`–`4` (Oslo, Bergen, Trondheim, Stavanger) hold the
  `_nb`/`_en` lists, index-aligned, last updated 2026-09-18. There is **no row
  `5`**, so the "national" sections on `/membership` are empty today. The
  old non-suffixed columns (`studentBenefits` etc.) are **empty** on all rows.
- `campus_benefits`: 21 rows. 10 national (`campus_id 5`), 5 Oslo, 2 Bergen,
  3 Trondheim, one Oslo draft titled "los t". All published rows carry
  `read("team:biso-members")`, a team that **does not exist**. Visibility
  works only because the table also grants `read("any")` (rowSecurity on),
  which also makes drafts and the 2 stored `redemption_value`s public.
  `created_by` is empty on every row.
- `partners` (sponsor logos) and `benefit_partners`: **0 rows each**.
- The Branding Committee is department row `1012` ("Branding Committee") on
  campus `5`. Campuses 2–4 have a "Markedsutvalget" department; Oslo's is
  inactive ("nedlagt").
- Appwrite has 15 teams synced from Azure (`sg-app-campus-*`,
  `sg-app-dept-*`); there is no Branding Committee team. The owner confirmed
  the committee's members sit in each campus's management (so they are campus
  admins via `Ledelsen{City}` + `Campus-{City}`), except the leader
  (`pr@biso.no`), who has no Appwrite account yet. Hence the override in D5.
- Existing rows store the partner as free text (`partner_name`);
  `partner_id` is never written.

**Website (`apps/web`)**
- Readers of `campus_data` lists: `/campus` "For studenter" tab
  (`(public)/campus/components/students/students-tab.tsx`, no national merge)
  and "For bedrifter" tab (`partners-tab.tsx`, `businessBenefits_*`);
  `/students` (`students-page-client.tsx`, `.slice(0, 4)` per card, falls
  back to national); `/membership` (`membership-page-client.tsx`, national
  row + active campus row). Fetched by `getCampusData`
  (`app/actions/campus.ts`) and `getGlobalMembershipBenefits`
  (`app/actions/membership.ts`).
- Member portal: `getMemberPortalBenefits` / `getFeaturedBenefits`
  (`app/actions/member-portal.ts`), campus from `profile.campus_id`
  (`(public)/member/member-portal-content.tsx`), not the campus switcher
  cookie. `getFeaturedBenefits` results are thrown away; home tab uses
  `benefits.slice(0, 3)`. No reader enforces `publish_start`/`publish_end`.
- Code leak: full rows including `redemption_value` reach client components;
  `BenefitCard` seeds state from it before reveal
  (`components/member-portal/shared/benefit-card.tsx`); `revealBenefit` does
  not check membership.
- Portal category chips (Food & Drink, Entertainment, Career, Health &
  Fitness, Software, Travel, Education) do not match admin's (Career,
  Lifestyle, Education, Health, Finance, Other).
- Sponsor logos (`partners`): home page via `cachedPartners`
  (`lib/data/public-content.ts`, cached for hours), `/about` via
  `getPartners`, page-builder partners block via
  `packages/shared/utils/page-feeds.ts`. Nothing reads campus-level logos.
  There is **no cross-app cache invalidation** today; admin's
  `revalidatePath` only affects admin.
- Hardcoded partner counts disagree ("50+" in the portal, "150+" on
  `/membership`). Nav links to `/membership#fordeler`, which has no anchor.

**Admin (`apps/admin`)**
- `/benefits` list (card grid), `/benefits/[id]` editor
  (`_components/benefit-editor-client.tsx`), `/benefits/partners` (read-only
  list of the sponsor table with an "API Beta" badge).
- Editor defects: no delete (`_deleteBenefit` unexported); "Save Draft"
  forces `draft` (silently unpublishes live items), "Archived" can't be
  saved; no inputs for teaser, featured, members-only, publish window, order,
  terms, partner logo; the uploaded `image_url` is never rendered on the web.
- Actions: `_actions/benefits.ts` (create/update with ownership checks,
  audit, auto-translation into `content_translations` with
  `content_type = "memberBenefit"`), schema in `_actions/schemas.ts`.
- Access: `portal.benefits` = globaladmin, campusadmin, department role;
  `portal.benefitsPartners` = globaladmin, campusadmin (`lib/roles.ts`).
  `UserAuthContext.resolvedDepartmentIds` carries department row IDs.
- Other writers: the admin assistant (`app/api/assistant/route.ts`,
  `packages/ai` tools) creates and updates benefits; approvals list a
  benefits publish domain (`_actions/approval-execution.ts`).
- Reusable pieces: `studio.tsx` primitives and `STUDIO` palette,
  `image-upload-field.tsx`, `content-translation-controls.tsx`
  (`AutoTranslateControl`, `TranslationReviewCard`), composer
  `ui.tsx` (`LocaleTabs`, `FieldLabel`, `Pill`), news-studio's pure state
  module pattern with tests.
- `packages/api/content-permission-cutover.ts` would strip table-level
  permissions from `campus_benefits`; it has not run live.

**App (`BISO-Flutter`)**
- Campus detail reads only the old, empty `campus_data` columns
  (`lib/data/services/campus_service.dart`,
  `lib/presentation/screens/explore/campus_detail_screen.dart`), so it shows
  no benefits today. Old installed versions therefore lose nothing when the
  data moves.
- Member pass screen: `lib/presentation/screens/profile/member_pass_screen.dart`,
  data via `member_pass_api_client.dart` → `apps/api` `/api/member-pass`.

## Decisions

### D1. One table for every benefit, with a section

All benefits live in `campus_benefits`. A new required enum column `section`
says which group it belongs to:

| `section` | Norwegian label | Shape | Shown on |
|---|---|---|---|
| `member` | Medlemsfordeler | Rich: title, short text, partner (optional), how to redeem, code/link, category, terms, dates, image, featured | Member portal, campus page "For studenter", `/membership`, `/students`, app (member pass + campus) |
| `career` | Karrierefordeler | One line (title only, optional dates) | Campus page "For studenter", `/membership`, `/students`, app campus |
| `social` | Sosialt nettverk | One line | same |
| `safety` | Trygghet og støtte | One line | same |
| `business` | For bedrifter | One line | Campus page "For bedrifter" tab, `/membership`, `/students`, app campus |

Each row has a `campus_id` (`1`–`4`, or `5` for "Hele BISO"). Every reader
shows a campus's own rows plus the national ones, as
`resolveBenefitCampusIds` already does. Viewing "all campuses" shows national
only.

`description_*` and `category` become optional (one-line sections have
neither). The old `kind` column stops being used. Ordering within a section
uses `sort_order`.

### D2. Visibility rules, in one shared function

A benefit is visible to students when all hold:
- `status = published`
- `publish_start` is empty or in the past, and `publish_end` is empty or in
  the future
- it has no partner, or its partner exists and is active
  (`benefit_partners.is_active`); a `partner_id` that points at a missing
  partner counts as **not** visible

This rule lives once in `@repo/shared` (pure, tested) and is mirrored in Dart
for the app. Board labels derive from it: **Synlig** (visible), **Utkast**
(draft), **Planlagt** (published, starts later), **Utløpt** (published, ended),
**Avsluttet** (partner ended), **Skjult** (archived). Ending a partner never
rewrites its deals' status, so restarting restores exactly what was live.

### D3. Codes and member links are private

Move `redemption_value` out of `campus_benefits` into a new table
`benefit_codes` (`benefit_id` unique, `value`), with **no** row or table read
permissions. Admin writes it through the admin client. The two existing
values migrate there and are cleared from `campus_benefits`.

Codes and member links are **always** members-only. There is no editor
toggle to open a code to non-members; `is_member_only` is no longer edited
and readers ignore it. Logged-out visitors and logged-in non-members get the
same treatment: they see the deal and a "Bli medlem" prompt.

Revealing goes through the server only: the web server action and a new
`apps/api` endpoint (for the app) both call one shared reveal function that
checks active membership (reuse the membership gate / status logic in
`packages/shared/utils/membership-gate.ts` and `apps/api`'s membership
status), records `benefit_reveals` / `benefit_interactions` as today, and
returns the value. Client components never receive a value they haven't
revealed.

Redemption types shown to editors: "Vis medlemskortet" (`onsite`),
"Rabattkode" (`code`), "Lenke" (`link`), "Ingen" (`none`). `qr` is not offered.
Link URLs are treated like codes (members only).

### D4. Row permissions

- Published rows (`campus_benefits`): `read("any")`. Drafts and archived rows:
  no read. Stop emitting `read("team:biso-members")`; members-only access to
  codes is D3, not a row permission.
- Remove table-level `read("any")` from `campus_benefits` so drafts become
  private (the existing cutover script for this one table, or the schema
  push). Must happen **after** all published rows carry `read("any")`.
- `benefit_partners` and `partners` stay publicly readable.

### D5. Who can edit

| Who | Can manage |
|---|---|
| Global admins | Every campus, Hele BISO, membership texts (D13) |
| Benefits editors: named people, today only the Branding Committee leader (`pr@biso.no`) | Every campus, Hele BISO, membership texts (D13) |
| Campus admins (this includes the Branding Committee's members, who sit in each campus's management) | Their managed campuses only (not Hele BISO, not D13) |
| Everyone else, including Markedsutvalget and other departments | Nothing (no Fordeler nav item) |

The **benefits editor** override gives global-admin reach inside Fordeler
(benefits, partners, logos, membership texts) and nowhere else in admin. The
leader may have no other admin role, so the override alone must let them sign
in and see Fordeler. IT must be able to add or remove people later without a
code change; the mechanism is the builder's choice (no user labels, per
`apps/admin/CLAUDE.md`). Note: `pr@biso.no` has no Appwrite account yet, so
it has never signed in to admin; the override must match on the address
they sign in with.

Applies to benefits, partners, logos and membership texts, enforced
server-side in every action (create, update, delete, reorder, end/restart
partner, logo CRUD, text edits) and in the board's campus tabs.

Partners have a campus too (`1`–`4`, or `5` for partners active across
BISO). Editing, ending, restarting or deleting a partner needs edit rights on
the **partner's** campus. A deal may link to a partner on its own campus or a
national one, so a campus admin can use a national partner (e.g. Rekom) but
cannot end it. Ending a campus partner can therefore only hide deals on that
campus.

Benefits stop being tied to departments (no department picker). The admin
assistant's benefit tools must obey the same rule.

### D6. Admin: the board (`/benefits`)

Approved mockup: "Board per campus, grouped by type".
- Header "Medlemsfordeler" with buttons "Partnere" and "+ Ny fordel".
- Campus tabs: the campuses the user may edit, plus "Hele BISO" (shown
  read-only to campus admins, so they can see what is already national).
  Remember the last tab.
- Summary strip: synlige på nettsiden / utkast / utløper innen 30 dager.
- Five sections in website order. Medlemsfordeler as cards (logo, title,
  partner · category, status pill); the one-line sections as rows. Each
  section has its own "+ Legg til". Expired, ended and hidden items stay,
  greyed, at the end of their section.
- Drag to reorder within a section. On a campus tab, the campus's own rows
  come first and the national rows follow under a quiet "Fra Hele BISO"
  divider (read-only there), which is exactly the order students see (D10).
- Empty states say what to do in plain Norwegian.

### D7. Admin: the panel (create and edit)

Approved mockup: "A panel slides in over the board". Opening `/benefits/[id]`
directly (assistant, command palette, approvals, old links) shows the board
with that panel open. `/benefits/new` (or equivalent) opens an empty panel.

Medlemsfordeler panel, top to bottom:
1. Live preview "Slik ser studentene det", matching the real web card.
2. "Hva er tilbudet?" (title), "Fortell litt mer" (short text, optional).
3. "Hvilken partner?" picker with logos and "+ Ny partner" inline; "Ingen
   partner (BISO)" allowed.
4. "Hvordan får studentene rabatten?" segmented choice (D3), with the code or
   link field when needed, labelled "vises bare for medlemmer".
5. "Hvor lenge gjelder det?": "Til vi tar det bort" or "Fra … til …".
6. "Flere valg" (collapsed): kategori, vilkår, bilde, "Vis først" (featured),
   English text.
7. Footer buttons depend on state: draft → "Lagre utkast" / "Publiser";
   live → "Lagre endringer" / "Skjul fra nettsiden"; plus "Slett" with a
   plain confirmation.

One-line sections: "Hva får studentene?" (or "Hva får bedriftene?"), the
English line, optional dates, and the same footer.

English is auto-translated (existing `AutoTranslateControl` /
`scheduleBenefitTranslation` machinery) and always editable. Saving never
changes the live/hidden state unless the button says so. Validation and save
errors are short, plain Norwegian. All new strings live in the admin i18n
bundles (no and en).

### D8. Categories: one shared list

Defined once in `@repo/shared` with nb/en labels and used by admin, the
member portal chips and the app: Mat og drikke, Trening og helse, Uteliv,
Shopping, Reise, Programvare, Arrangementer, Annet. Existing rows map to it
during migration.

### D9. Admin: partners page (`/benefits/partners`), two tabs

Approved mockup "Partners: one page, two tabs".

**Tilbudspartnere** (`benefit_partners`): card per partner with logo, name,
website, campus, and its deals with status pills; "+ Nytt tilbud" opens the
benefit panel pre-filled with that partner; "Endre" opens a small partner
panel (navn, logo upload, nettside, campus, kort beskrivelse). Filters:
campus and "Vis avsluttede". "Avslutt samarbeid" asks for confirmation,
states how many deals will disappear, and sets `is_active = false`;
"Start samarbeidet igjen" reverses it. "Slett for godt" is available but
secondary: its confirmation lists the partner's deals by title and deletes
them (and their codes) together with the partner. Benefits link to partners
by ID; partner name and logo are read from the partner, not copied. The
benefit panel's partner picker shows partners on the benefit's campus plus
national ones (D5).

**Logoer på nettsiden** (`partners`): a preview laid out like the home page
logo wall, "Hele BISO" first, then one block per campus. "+ Legg til" (logo
upload, name, link), click a logo to change or remove it, drag to reorder.
Needs a `sort_order` column on `partners`. National logos feed the home page,
`/about` and the page-builder block, as today. Campus logos are new on the
website: show them on that campus's "For bedrifter" tab.

### D10. Website readers

- All five readers in "Current state" switch from `campus_data` to
  `campus_benefits` + D2, via one shared server-side reader. Layouts stay;
  `/students` keeps its 4-per-card limit and link to `/membership`.
- Order everywhere a list mixes campus and national rows (campus page,
  `/students`, portal, app): the campus's own rows first by `sort_order`,
  then national rows by `sort_order`. So a campus's own deals are never
  pushed out of `/students`' four slots by the 10 national rows.
- Campus page "For studenter" adds the national rows; the Medlemsfordeler
  card lists titles and links to the member portal for details and codes.
- Member portal: campus = switcher cookie first, profile campus as fallback.
  Featured benefits (`is_featured`) drive the portal home highlights instead
  of `slice(0, 3)`. Portal cards render partner logo, terms in the visitor's
  language, image, end date.
- `/membership` national sections now have data (no `campus_data` row `5`
  needed). Add the `id="fordeler"` anchor the nav points to.
- Replace hardcoded partner counts with a live count of visible
  Medlemsfordeler, or remove the number where a count can't be shown.
- Freshness: an admin save must be visible on the website within about a
  minute, including the cached home page logos. There is no cross-app
  invalidation today; the builder chooses the mechanism (see "Left to the
  builder").

### D11. App (`BISO-Flutter`)

- Campus detail screen: sections from `campus_benefits` with D2, matching the
  website campus page (campus + national).
- Member pass screen: a "Dine fordeler" list next to the pass showing
  Medlemsfordeler for the student's campus + national. Tapping opens a
  detail sheet; members reveal codes or links through the new `apps/api`
  endpoint (D3); "Vis medlemskortet" deals point at the pass. Non-members see
  the deal and a "Bli medlem" prompt, never the code.
- Language follows the device (nb/en fields), categories from D8.
- Ships in a normal app release. Old installed versions keep showing nothing,
  as they do today.

### D12. Migration from `campus_data`

A one-off script, dry-run by default (like the cutover CLI), that:
1. Creates one-line rows for `careerAdvantages`, `socialNetwork`, `safety`
   and `businessBenefits` on campuses 1–4, pairing `_nb[i]` with `_en[i]`,
   `sort_order = i`, published.
2. For `studentBenefits`, matches each line to an existing `campus_benefits`
   row (same campus or national) and proposes: merge (keep the richer row),
   or create a new `member` row. National lines repeated on several campuses
   (Fadderullan, Rekom, Econa) collapse into one national row.
3. Re-sections existing rows that are really career items (e.g. national
   "Karrieredagene", "Intervju-coaching", "CV-portrett") and maps old
   categories to D8.
4. Creates `benefit_partners` from the free-text `partner_name`s on member
   rows: names normalised (case, spacing, "AS") and near-duplicates merged
   in the review file; each partner's campus is its deals' campus, or `5` if
   its deals span campuses; logo from `partner_logo_url` if any. Links the
   rows by `partner_id`. Rows whose partner is BISO itself get no partner.
5. Moves the 2 `redemption_value`s to `benefit_codes` and sets published
   rows' permissions per D4.
6. Writes a review file (Norwegian titles, campus, partner, proposed action) for the
   owner to approve before the apply run. The "los t" draft is listed for
   deletion, not deleted automatically.

The script runs **before** the website and app switch readers, so no page is
ever empty. `campus_data` columns stay in place, unread.

### D13. Membership texts (editable bullet lists on other pages)

The owner wants the bullet lists that describe membership in general to be
editable too. These "spots", from recon (`apps/web/src`):

| Spot | Where it renders | Today's source |
|---|---|---|
| Forsiden, «Bli med» | `components/home/join-us.tsx` (rendered twice) | `membership.benefits.categories.*.global` |
| Medlemskapskortene | `components/membership/plan-card.tsx` via `member-portal/shared/membership-cta-section.tsx` | `memberPortal.cta.benefits.*` |
| Låst innhold i medlemsportalen | `member-portal/shared/locked-content-overlay.tsx` | `QUICK_BENEFITS`, hardcoded English |
| Velkomstflyten | `components/onboarding/onboarding-flow.tsx` | `onboarding.student.benefits.*` |
| Nettbutikken, medlemsboksen | `components/shop/member-callout-client.tsx` | `shop.member.benefit*` |
| For bedrifter (`/business`) | `(public)/business/business-page-client.tsx` | `partner.benefits.items.*` |
| Business Hotspot | `(public)/business-hotspot/business-hotspot-client.tsx` | `businessHotspot.benefits.*` |

- Each spot is an ordered list of items in Norwegian and English. Each spot
  keeps its current shape: a single line, or a title plus a short text where
  the page shows both today. Icons the design uses stay chosen by the page
  (builder may offer a small fixed icon set if a spot needs one per item).
- Stored in a new table, seeded by the migration from today's i18n strings
  so nothing changes visually on day one. If a read fails or a spot is
  empty, the page falls back to today's i18n text (call-site fallback, per
  `apps/web/CLAUDE.md`).
- Admin: a third page in Fordeler, **Tekster om medlemskap**, in the same
  look as the board: one card per spot, named in plain words with a short
  note on where it shows and a "Se på nettsiden" link; lines edited in
  place; drag to reorder; "+ Legg til linje"; remove a line; English
  auto-translated and editable. Saving makes the text live (no drafts for
  these).
- Editors: global admins and benefits editors (D5). Campus admins cannot
  edit these, as the pages are national.
- Same freshness requirement as D10.

## Suggested build order

Each stage gets its own implementation plan, as with push notifications.

1. **Foundation:** schema changes (D1, D3, D9 `sort_order`), shared rules
   (D2, D5 constant, D8), shared reader and reveal function, migration script
   with dry-run report. The owner pushes the schema and regenerates types.
2. **Admin board and panel** (D5–D7), including permissions, delete, reorder,
   assistant tool updates.
3. **Partners page** (D9), both tabs.
4. **Website switch** (D10) and code-leak fix (D3/D4), after the migration
   has been reviewed and applied.
5. **API endpoint and app** (D3 endpoint, D11).
6. **Membership texts** (D13): table, seed, admin page, website readers.
   Independent of stages 2–5 once stage 1 is done.

## Left to the builder

- How benefits reference partners (`partner_id` string vs an Appwrite
  relationship) and how readers join them.
- The cross-app freshness mechanism (e.g. a secret-protected revalidate
  route on web that admin calls after saves, or shorter cache lifetimes for
  the affected readers).
- Whether the app lists benefits via the Appwrite SDK or via `apps/api`
  (reveals must go through `apps/api`).
- Whether the admin preview reuses the web card component (moved to a shared
  package) or a faithful copy.
- Drag-and-drop library (the repo already uses `@dnd-kit`).
- How deleted benefits treat existing `benefit_reveals` rows.
- Exact Norwegian microcopy beyond the labels fixed above.

## Calls made (not explicitly agreed, check these)

- The first group is called **Medlemsfordeler** (the website's word), not
  "Partnertilbud" as in the mockup, because it also holds BISO's own perks
  (Fadderullan, member prices); a partner is optional.
- "Arrangementer" added to the shared category list.
- Campus admins see "Hele BISO" read-only on the board.
- Headings, section descriptions, FAQ and hero stats stay as page text;
  only the D13 bullet lists become editable.
- The leader override (D5) reaches all of Fordeler but nothing else in admin.
- Membership texts (D13) save straight to live, without drafts; campus
  admins can't edit them. The Tekster page was not mocked up.
- Campus-level sponsor logos appear on that campus's "For bedrifter" tab.
- Member portal follows the campus switcher, profile campus as fallback.
- `qr` redemption type is not offered.
- Codes and member links are always members-only; no "Bare for medlemmer"
  toggle (D3).
- Partners have a campus; only editors of that campus can end or delete a
  partner; campus deals may use national partners (D5).
- Deleting a partner deletes its deals, after a confirmation that lists them
  (D9).
- Mixed lists show the campus's own rows before national rows (D10).
- The migration creates partners from the existing free-text partner names
  (D12).

## Verification

- `bun run check-types`, `bun run lint`, unit tests for D2, D5, D8, the
  reveal function and the migration matcher; `bun run build --filter=admin`
  (server-action export rule).
- Migration dry run against prod produces a review file with no duplicates
  and no lost lines (counts per campus and section match `campus_data`).
- Browser check as a global admin, a campus admin, a benefits editor with
  no other admin role, and a non-editor: tabs, create, edit live item, reorder, end and restart a
  partner, delete, logo add and reorder.
- Logged-out and non-member checks: no code or member link in page source,
  RSC payload, or a direct Appwrite REST read; drafts not readable.
- App: campus screen and member pass list on a device or simulator, reveal as
  member and as non-member.
