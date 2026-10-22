# Benefits Studio, Stage 3 (Partners page: deal partners and website logos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the read-only "API Beta" partners page with a two-tab page. On the first tab the committee manages the companies behind student deals: add, edit, end, restart and delete them. On the second tab it manages the logos shown on the website: add, edit, reorder and remove them.

**Architecture:**
- **Deal partners:** server actions extend `_actions/benefit-partners.ts` (`benefit_partners` table).
- **Website logos:** a new `_actions/site-logos.ts` (`partners` table, the "sponsor" logos the home page, `/about` and the page-builder block read).
- **Shared rules:** both reuse stage 2's `benefit-access.ts` and the `reorderIds` helper. Pure modules group and order the data and carry tests.
- **UI:** `/benefits/partners` is a server page with `?tab=deals|logos`. Client components follow the board's look and use Radix `Sheet` panels and `AlertDialog` confirmations.

**Tech Stack:** Next.js 16, React 19, next-intl, Radix (`@repo/ui`), `@dnd-kit`, sonner, `bun:test`.

**Spec:** `docs/superpowers/specs/2026-10-21-benefits-studio-design.md` (D5, D9). Approved mockup: `.superpowers/brainstorm/62147-1792614825/content/partners-page.html`. Stage 2 (on this branch) supplies the board, panel, access helpers, `listBenefitPartners` and `createBenefitPartner`.

## Global Constraints

- Bun only. Admin tests: `cd apps/admin && bun test <path>` (`bun:test`). bun's `mock.module` is process-wide, so when mocking shared modules, spread the real exports (pattern: `apps/admin/src/lib/authorization.test.ts`), and run the **full** admin suite before committing.
- `"use server"` files export only async functions. Plain modules hold the helpers. Verify with `bun run build --filter=admin`.
- Edit rights (D5): editing, ending, restarting or deleting a partner or logo needs `canEditBenefitCampus(benefitAccessFor(ctx), <its campus>)`. Global admins and benefits editors have it on `1`–`5`. Campus admins have it on their campuses and see `5` read-only. Expected refusals return `{ error }` and never throw.
- Deal partners (`benefit_partners`):
  - Permissions are `['read("any")']`.
  - "End" sets `is_active: false`; "restart" sets `true`. Neither changes any deal's `status`. Visibility follows stage 1's `benefitDisplayState`, so ended partners' deals show as `ended`.
  - "Delete for good" deletes the partner, every deal linked to it (its `campus_benefits` rows), and those deals' `benefit_codes` rows.
- Website logos (`partners`):
  - Columns: `name` (≤128, required), `url` (https, optional), `level` (`national` when `campus_id === "5"`, else `campus`), `image_url` (https, required), `campus_id` (`"1"`–`"5"`), `campus` (relationship = `campus_id`), `sort_order`.
  - The table has `rowSecurity: false` and table-level `read("any")`, so writes pass no row permissions.
  - The admin client is used for every write.
- A partner's campus may change only to `"5"`, or when every linked deal is on the new campus. Otherwise return `{ error: "This partner has offers on another campus" }`. (Ruling: this keeps spec D5's rule that a deal's partner is on its campus or national.)
- Copy: i18n keys under `adminPortal.benefits.partnersPage.*` in `packages/i18n/messages/{no,en}/adminPortal.json`. Norwegian is fixed in Task 4.
- Look: `STUDIO` tokens and studio primitives, matching the mockup. Non-technical users. No IDs or raw enum values on screen.
- Run `bun x ultracite fix <changed files>` before each commit. Never write to production.

## Review Focus

- **A campus admin ends or deletes a national partner** (`campus_id "5"`), which would hide deals on every campus. The action refuses (Task 1 test).
- **Deleting a partner with deals:** the confirmation names the deals, and the action deletes the deals and their code rows. A deal on a campus the caller can't edit blocks the whole delete with `{ error }` before any write (Task 1 test).
- **Restarting brings back exactly what was live.** Deal statuses are never touched by end or restart (Task 1 test asserts no `campus_benefits` writes).
- **Logo ordering survives add and remove.** A new logo goes last. Reorder writes only the changed `sort_order`s, and is refused across groups (Task 2 tests).
- **A logo without an image can't be saved.** The site's logo wall would render a broken image (Task 2 validation test).

---

### Task 1: Deal partner management actions

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/benefit-partners.ts`, `apps/admin/src/app/(portal)/_actions/benefit-partners.test.ts`

**Interfaces:**
- Consumes: `benefitAccessFor`, `canEditBenefitCampus` (`@/lib/benefit-access`); `BoardPartner` type and table conventions from `_actions/benefits.ts`; `isRowNotFound` as `benefits.ts` uses it.
- Produces:

```ts
export interface PartnerDeal { $id: string; campus_id: string; partner_id: string | null; publish_end: string | null; publish_start: string | null; section: string | null; status: string; title_en: string; title_nb: string }
export interface PartnerWithDeals extends BoardPartner { deals: PartnerDeal[]; description_en: string | null; description_nb: string | null; editable: boolean; website_url: string | null }
export interface PartnersPageData { editableCampusIds: string[]; partners: PartnerWithDeals[]; visibleCampusIds: string[] }
export async function loadPartnersPage(): Promise<PartnersPageData>; // visible partners (campus_id in visibleCampusIds) with their deals (campus_benefits where partner_id in ids, limit 500), name asc
export async function updateBenefitPartner(id: string, input: { campus_id: string; description_en?: string | null; description_nb?: string | null; logo_url?: string | null; name: string; website_url?: string | null }): Promise<{ data: BoardPartner } | { error: string }>;
export async function endBenefitPartner(id: string): Promise<{ data: { hiddenDeals: number } } | { error: string }>; // hiddenDeals = linked deals whose status is published
export async function restartBenefitPartner(id: string): Promise<{ data: true } | { error: string }>;
export async function deleteBenefitPartner(id: string): Promise<{ data: { deletedDeals: number } } | { error: string }>;
```

Behaviour:
- Validation in `updateBenefitPartner` is the same as `createBenefitPartner`'s: name, website and logo. A missing partner returns `{ error: "Partner not found" }`.
- **Update:** the caller needs write on both the stored and the new campus, and the campus-change rule from Global Constraints applies.
- **End and restart:** the caller needs write on the partner's campus. They update only `is_active`, then log `benefit_partner_ended` or `benefit_partner_restarted` and call `revalidatePath("/benefits")` and `revalidatePath("/benefits/partners")`.
- **Delete:**
  - Load the linked deals.
  - The caller needs write on the partner's campus **and** on every deal's campus; otherwise return `{ error: "Unauthorized: no write access to this campus" }` before any write.
  - For each deal, delete its code row (ignore a 404) and then the deal. Then delete the partner.
  - Log `benefit_partner_deleted` with `{ deletedDeals }` and revalidate both paths.

- [ ] **Step 1: Write the failing tests.**
  - `loadPartnersPage` for a campus admin of "2" returns only partners on "2" and "5". Each is marked `editable`: true on "2", false on "5". Each partner's `deals` are attached.
  - `updateBenefitPartner`:
    - Renaming as a campus admin of "2" works.
    - Moving a "2" partner with a deal on "2" to "3", as a benefits editor, returns the campus-change error.
    - Moving it to "5" works.
  - `endBenefitPartner`:
    - On a "5" partner as a campus admin, it is refused with no writes.
    - As an editor, it sets `is_active: false`, returns `hiddenDeals` equal to the number of published deals, and makes no `campus_benefits` writes.
  - `restartBenefitPartner` sets `is_active: true` and makes no `campus_benefits` writes.
  - `deleteBenefitPartner`:
    - With deals on "2" and "3", as a campus admin of "2", it is refused with no writes.
    - As an editor, it deletes the code rows, then the deals, then the partner, in that order, and returns `deletedDeals`.
- [ ] **Step 2: Run them to verify failure.** `cd apps/admin && bun test "src/app/(portal)/_actions/benefit-partners.test.ts"`
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the file, the full admin suite (0 fail) and `bun --filter=admin check-types`.**
- [ ] **Step 5: Commit.** `git commit -m "feat(admin): edit, end, restart and delete benefit partners"`

---

### Task 2: Website logo actions

**Files:**
- Create: `apps/admin/src/app/(portal)/_actions/site-logos.ts`, `apps/admin/src/app/(portal)/_actions/site-logos.test.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/benefits.ts` (remove the old `listPartners` once Task 5 no longer uses it; update its pagination test)
- Modify: `packages/api/appwrite.config.json` and `packages/api/benefits-schema.test.ts`. On the `partners` table, add the key index `idx_level_campus_sort` on `["level","campus_id","sort_order"]`, ASC. Appwrite needs an index to filter and order by these columns. Edit the config textually, keeping 4-space indentation, and pin the index in the schema test. The owner pushes it.

**Interfaces:**
- Produces:

```ts
export interface SiteLogo { campus_id: string; id: string; image_url: string; name: string; sort_order: number; url: string | null }
export interface SiteLogoGroup { campusId: string; editable: boolean; logos: SiteLogo[] }
export async function loadSiteLogos(): Promise<SiteLogoGroup[]>; // one group per visible campus, "5" first then 1–4; logos by sort_order asc then $createdAt
export async function saveSiteLogo(input: { campus_id: string; id?: string; image_url: string; name: string; url?: string | null }): Promise<{ data: SiteLogo } | { error: string }>;
export async function deleteSiteLogo(id: string): Promise<{ data: true } | { error: string }>;
export async function reorderSiteLogos(campusId: string, orderedIds: string[]): Promise<{ data: true } | { error: string }>;
```

Behaviour:
- Write checks use `canEditBenefitCampus` on the logo's campus. Update checks both the stored and the new campus.
- Validation:
  - name: trimmed, 1–128 characters, else `{ error: "Add the company's name" }`.
  - `image_url`: https required, else `{ error: "Upload a logo" }`.
  - `url`: null, blank, or https, else `{ error: "The link must start with https://" }`.
- **Create:** `ID.unique()`, `level` derived from the campus, the `campus` relationship, `sort_order` = the group's max + 1.
- **Moving campus** puts the logo at the end of the new group.
- **Reorder:**
  - The IDs must be exactly the rows of that campus, else `{ error: "Reorder list is out of date" }`.
  - It writes only changed `sort_order`s.
- Audit events are `site_logo_saved`, `site_logo_deleted` and `site_logos_reordered`. Each write calls `revalidatePath("/benefits/partners")`. Website freshness is stage 4.

- [ ] **Step 1: Write the failing tests.**
  - Groups come back in the order `"5","1","2","3","4"`, filtered to visible campuses, with `editable` correct.
  - Create:
    - It derives `level: "national"` for "5" and `level: "campus"` for "2".
    - It sets `campus` and `campus_id`.
    - It puts the new logo last.
  - Each validation error: missing image, `http` link, blank name.
  - A campus admin of "2" saving or deleting on "5" is refused.
  - Reorder writes only the changed rows and is refused for a stale list.
- [ ] **Step 2: Run them to verify failure.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the full admin suite and check-types.**
- [ ] **Step 5: Commit.** `git commit -m "feat(admin): manage website partner logos"`

---

### Task 3: Partners page state (pure)

**Files:**
- Create: `apps/admin/src/app/(portal)/benefits/partners/_lib/partners-state.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: `PartnerWithDeals`, `PartnerDeal`, `SiteLogo`, `SiteLogoGroup` types; `benefitDisplayState`.
- Produces:

```ts
export interface PartnerCard { dealStates: { deal: PartnerDeal; state: BenefitDisplayState }[]; ended: boolean; partner: PartnerWithDeals }
export function buildPartnerCards(partners: PartnerWithDeals[], filter: { campusId: string | "all"; showEnded: boolean }, now: Date): PartnerCard[];
export function publishedDealCount(partner: PartnerWithDeals): number;
export function moveLogo(group: SiteLogoGroup, activeId: string, overId: string): SiteLogoGroup; // uses reorderIds from benefits/_lib/board
```

Rules for `buildPartnerCards`:
- `campusId "all"` keeps every partner; otherwise only partners with that `campus_id`.
- `showEnded: false` hides partners with `is_active === false`.
- Sorted by name (`localeCompare` with `"nb"`).
- Deal states come from `benefitDisplayState(deal, {is_active: partner.is_active}, now)`, sorted by title.

- [ ] **Step 1: Write the failing tests.**
  - The campus filter.
  - Ended partners are hidden by default and shown with `showEnded`.
  - A deal of an ended partner has state `ended`.
  - `publishedDealCount` counts only published deals.
  - `moveLogo` reorders and keeps the other logos.
- [ ] **Steps 2–4:** run the tests to see them fail, implement, then run them to see them pass.
- [ ] **Step 5: Commit.** `git commit -m "feat(admin): pure state for the partners page"`

---

### Task 4: Copy

**Files:** `packages/i18n/messages/{no,en}/adminPortal.json` under `benefits.partnersPage`. Delete `benefits.partners.*` keys only if nothing uses them after Task 5.

| Key | Norwegian |
|---|---|
| `title` | Partnere |
| `eyebrow` | Fordeler |
| `tabDeals` | Tilbudspartnere |
| `tabLogos` | Logoer på nettsiden |
| `newPartner` | + Ny partner |
| `newLogo` | + Ny logo |
| `filterAll` | Alle |
| `showEnded` | Vis avsluttede |
| `newDeal` | + Nytt tilbud |
| `edit` | Endre |
| `noDeals` | Ingen tilbud ennå |
| `ended` | Avsluttet |
| `emptyDeals` | Ingen partnere her ennå. Trykk «+ Ny partner» for å legge til den første. |
| `partnerPanelNew` / `partnerPanelEdit` | Ny partner / Endre partner |
| `name` / `website` / `logo` / `campus` / `description` | Navn / Nettside / Logo / Campus / Kort beskrivelse |
| `save` / `cancel` / `close` | Lagre / Avbryt / Lukk |
| `endAction` | Avslutt samarbeid |
| `endTitle` | Avslutte samarbeidet med {name}? |
| `endBody` | {count, plural, =0 {Ingen tilbud forsvinner fra nettsiden.} one {Det ene tilbudet deres forsvinner fra nettsiden med en gang.} other {De # tilbudene deres forsvinner fra nettsiden med en gang.}} Partneren og tilbudene blir liggende under «Vis avsluttede», så dere kan starte opp igjen senere. |
| `restartAction` | Start samarbeidet igjen |
| `deleteAction` | Slett for godt |
| `deleteTitle` | Slette {name} for godt? |
| `deleteBody` | Dette sletter også disse tilbudene, og det kan ikke angres: |
| `logosIntro` | Vises på forsiden, «Om oss» og på sider der noen har lagt inn en partnerblokk. Dra for å endre rekkefølgen. |
| `logosNational` | Hele BISO — slik ser det ut på forsiden |
| `logoAdd` | + Legg til |
| `logoPanelNew` / `logoPanelEdit` | Ny logo / Endre logo |
| `logoLink` | Lenke |
| `logoRemove` | Fjern logo |
| `logoRemoveTitle` | Fjerne {name} fra nettsiden? |
| `logoHint` | Klikk en logo for å bytte bilde, navn eller lenke — eller fjerne den. |
| `saved` / `endedToast` / `restartedToast` / `deletedToast` / `failed` | Lagret / Samarbeidet er avsluttet / Samarbeidet er i gang igjen / Slettet / Kunne ikke lagre. Prøv igjen. |
| `readOnly` | Bare administratorer kan endre partnere for hele BISO. |

- [ ] **Step 1: Add the keys** to both files, verbatim. English is a plain translation with the same ICU placeholders and plural branches.
- [ ] **Step 2: Check key parity** with a python script (expect no difference), and check the ICU syntax by rendering `endBody` with next-intl's `createTranslator`, or by the same means other tests use.
- [ ] **Step 3: Commit.** `git commit -m "feat(i18n): copy for the partners page"`

---

### Task 5: Deal partners tab

**Files:**
- Modify (rewrite): `apps/admin/src/app/(portal)/benefits/partners/page.tsx` (server; `requireNavAccess("portal.benefitsPartners")`; `?tab=deals|logos`, default deals; `?campus=` filter; `?ended=1`)
- Create: `apps/admin/src/app/(portal)/benefits/partners/_components/partners-page.tsx`, `partner-card.tsx`, `partner-sheet.tsx`, `partner-end-dialog.tsx`, `partner-delete-dialog.tsx` (+ `partners-page.test.tsx`)
- Modify: the stage 2 benefit panel so `/benefits/new?partner=<id>` preselects that partner (if stage 2 did not already add it)

Behaviour (mockup tab 1):
- Header: eyebrow, title, and `+ Ny partner`. Tabs link to `?tab=`.
- Filter chips: `Alle` plus each visible campus (Hele BISO last), and a `Vis avsluttede` toggle.
- **Card per partner:**
  - Logo (or initials), name, website host and campus name.
  - Deals listed with the stage 2 state pill.
  - `+ Nytt tilbud` links to `/benefits/new?campus=<partner campus>&section=member&partner=<id>` (only when editable). `Endre` opens the sheet.
  - Ended partners render at 55% opacity with an `Avsluttet` pill.
- **Sheet:**
  - Fields: name, website, logo (`ImageUploadField`), campus select (editable campuses only) and short description (nb; en under a disclosure).
  - Footer: `Lagre`. For an active partner, `Avslutt samarbeid` opens the end dialog. For an ended partner, `Start samarbeidet igjen`. A secondary red `Slett for godt` opens the delete dialog, which lists every deal title.
- Read-only partners open the sheet disabled, with the `readOnly` note.
- Results are toasted, followed by `router.refresh()`.

- [ ] **Step 1: Write the failing component tests.**
  - The cards render names and deal pills.
  - An ended partner is hidden until "Vis avsluttede" is on.
  - The end dialog text pluralizes for 0, 1 and 3 deals.
  - The delete dialog lists the deal titles.
  - Read-only shows no `+ Nytt tilbud`.
- [ ] **Steps 2–4:** run the tests to see them fail, implement, then run them with the full admin suite and check-types.
- [ ] **Step 5: Commit.** `git commit -m "feat(admin): manage deal partners on the partners page"`

---

### Task 6: Website logos tab

**Files:**
- Create: `apps/admin/src/app/(portal)/benefits/partners/_components/logo-wall.tsx`, `logo-sheet.tsx` (+ `logo-wall.test.tsx`)
- Modify: `partners-page.tsx` (render the logos tab)

Behaviour (mockup tab 2):
- An intro line.
- The "Hele BISO" group first, titled `logosNational`, then one block per visible campus.
- Each group is a 5-column grid of logo tiles showing the image and the name below.
- An editable group has drag handles (`@dnd-kit` rect sorting) and a dashed `+ Legg til` tile.
- Clicking a tile opens the sheet: name, link, logo upload (required) and campus (editable campuses), plus `Fjern logo` with a confirm.
- Reorder is optimistic → `reorderSiteLogos`. On an error it reverts with a toast.

- [ ] **Step 1: Write the failing component tests.**
  - The groups render in order: Hele BISO first.
  - Tiles show the names.
  - A read-only group has no add tile.
  - Saving without an image shows "Last opp en logo" (the `no` copy of the error) and doesn't call the action.
- [ ] **Steps 2–4:** run the tests to see them fail, implement, then run them with the full admin suite and check-types.
- [ ] **Step 5: Commit.** `git commit -m "feat(admin): manage website partner logos"`

---

### Task 7: Verification

- [ ] Run each of these and confirm it exits 0:
  - `cd apps/admin && bun test ./src`
  - `bun run check-types`
  - `bun run build --filter=admin`
  - ultracite on the changed files
- [ ] Grep checks:
  - `rg "API Beta|invitation" apps/admin/src` finds nothing.
  - The old `listPartners` is gone, or is unused and deleted.
- [ ] Owner notes for the go-live doc:
  - Logos added here appear on the home page only after stage 4 adds ordering and freshness to the website readers.
  - Campus logos appear on the campus "For bedrifter" tab in stage 4.
