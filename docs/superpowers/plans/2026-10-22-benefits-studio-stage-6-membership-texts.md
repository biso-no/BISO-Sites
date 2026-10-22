# Benefits Studio, Stage 6 (Editable membership texts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Global admins and benefits editors can edit, in admin, the seven bullet lists that describe membership across the website: home "Bli med", plan cards, portal lock, onboarding, shop box, `/business`, and Business Hotspot. Changes show on the site within about a minute.

**Architecture:**
- **Data:** table `membership_texts` (stage 1 schema). One row per item: `spot`, `sort_order`, `title_nb/en`, `body_nb/en`.
- **No seed script.** A spot with no rows shows today's i18n text on the website. The admin page pre-fills an unsaved spot with that same i18n text, so the first save creates its rows. "Tilbakestill" deletes the rows, and the website goes back to its built-in text.
- **Shared pure module** (`packages/shared/utils/membership-texts.ts`): spot metadata, i18n default key paths, and row → item mapping.
- **Website:** cached reader (`cacheTag("membership-texts")`). Each server parent passes items to its client component. Stage 4's revalidate route accepts `membership-texts` already.

**Tech Stack:** as stages 2–4.

**Spec:** `docs/superpowers/specs/2026-10-21-benefits-studio-design.md` (D13). Recon: `.superpowers/sdd/stage-4-6-web-recon.md` §6 (every spot's component, keys and current values).

## Global Constraints

- **Spots, admin labels and shape.** Item fields: `title` = the line or card title; `body` only where the shape is "title + text".

| spot | Admin label (nb) | Website path | Shape | i18n defaults (namespace.key, in order) |
|---|---|---|---|---|
| `home_join` | Forsiden – «Bli med» | `/` | line | `membership.benefits.categories.{social,career,student,safety,business}.global` |
| `plan_card` | Medlemskapskortene | `/member` | line | `memberPortal.cta.benefits.{discounts,events,career,card,priority}` |
| `portal_locked` | Låst innhold i medlemsportalen | `/member` | line | `memberPortal.locked.quickBenefits.{discounts,card,priority,career}` (new keys; see Task 1) |
| `onboarding` | Velkomstflyten | `/onboarding` | line | `onboarding.student.benefits.{membership,events,sso}` |
| `shop_callout` | Nettbutikken – medlemsboksen | `/shop` | line | `shop.member.{benefitDiscounts,benefitEvents,benefitPriority,benefitPartner}` |
| `business` | For bedrifter | `/business` | title + text | `partner.benefits.items.{colleagues,values,match}.{title,description}` |
| `business_hotspot` | Business Hotspot | `/business-hotspot` | line | `businessHotspot.benefits.{access,recruitment,booking,engage,partnership,visibility}` |

- **Limits:** 1–12 items per spot; `title_nb` 1–200 characters, required; `title_en` ≤ 200; `body_*` ≤ 500, only for `business`.
- **Row IDs** are deterministic: `${spot}-${index}`, with underscores in the spot replaced by `-`, e.g. `home-join-0`. Save = upsert indexes `0..n-1`, then delete the spot's rows with index ≥ n.
- **Permissions:** the table has `read("any")` and `rowSecurity: false`, so no row permissions are needed. Writes use the admin client.
- **Who:** `canManageMembershipTexts(ctx)` (stage 2): global admins and benefits editors. Nav key `portal.benefitsTexts` = `[GLOBAL_ADMIN, BENEFITS_EDITOR]`.
- **English:**
  - A blank `title_en` or `body_en` is auto-translated on save through the admin's existing `translateContentFields` (`apps/admin/src/lib/content-translation.server.ts`; read its signature), source `no`.
  - If translation fails, the English falls back to the Norwegian text and the save still succeeds.
  - The editor can always type English directly.
- **Website fallback:** an empty spot (no rows) or a failed read uses the component's current i18n strings. Cached readers throw, and call sites catch.
- **Icons stay in code,** assigned by index with the current icon lists, cycling when there are more items.
- **Prices** mentioned in shop or portal copy (`joinIntro`, `bestValue`, overlay prices) are **not** part of this stage.
- **Commands:** web vitest, admin `bun test`, shared vitest, `bun run check-types`, `bun run build --filter=admin`, ultracite on changed files. Never write to production.

## Review Focus

- **An unsaved spot shows exactly today's text,** on the website (fallback) and in the admin pre-fill, in both languages (Task 2 + Task 4 tests).
- **Removing items** deletes the leftover rows. A shorter list never leaves stale lines on the site (Task 3 test).
- **"Tilbakestill"** returns the website to its built-in text. All rows are deleted (Task 3 test).
- **A campus admin can't open or save the page,** neither through the nav nor through the action (Task 3 test, plus Task 5 nav test).
- **The translation service is down:** the save still succeeds, with Norwegian copied into English (Task 3 test).

---

### Task 1: Move the hardcoded portal lock list into i18n and drop "50+"

**Files:**
- `apps/web/src/components/member-portal/shared/locked-content-overlay.tsx`: `QUICK_BENEFITS` → `t("locked.quickBenefits.<key>")`.
- `packages/i18n/messages/{no,en}/memberPortal.json`:
  - Add `locked.quickBenefits.{discounts,card,priority,career}`. no: "Eksklusive rabatter hos BISOs partnere", "Digitalt medlemskort", "Prioritert tilgang til arrangementer", "Karriereressurser". en: "Exclusive partner discounts", "Digital membership card", "Priority event access", "Career resources".
  - Change `cta.benefits.discounts` to no "Eksklusive rabatter hos BISOs partnere" / en "Exclusive discounts at BISO's partners".

- [ ] TDD where a component test exists. Otherwise, check key parity with a script and add a small render test for the overlay that asserts the Norwegian text. Commit: `git commit -m "fix(web): portal lock benefits are translated"`.

### Task 2: Shared spot model (pure)

**Files:** `packages/shared/utils/membership-texts.ts` (+ test).

```ts
export const MEMBERSHIP_TEXT_SPOTS: readonly ["home_join","plan_card","portal_locked","onboarding","shop_callout","business","business_hotspot"];
export type MembershipTextSpot = (typeof MEMBERSHIP_TEXT_SPOTS)[number];
export interface MembershipTextSpotMeta { defaults: { body?: string; title: string }[]; hasBody: boolean; labelEn: string; labelNb: string; path: string } // defaults = i18n key paths
export const MEMBERSHIP_TEXT_SPOT_META: Record<MembershipTextSpot, MembershipTextSpotMeta>;
export interface MembershipTextItem { body: string | null; title: string }
export interface MembershipTextRowInput { body_en?: string | null; body_nb?: string | null; sort_order?: number | null; spot: string; title_en?: string | null; title_nb: string }
export function membershipTextItems(rows: MembershipTextRowInput[], spot: MembershipTextSpot, locale: "en" | "no"): MembershipTextItem[] | null; // null when the spot has no rows; sorted by sort_order; English falls back to Norwegian
export function resolveDefaultItems(spot: MembershipTextSpot, messages: Record<string, unknown>): MembershipTextItem[]; // walks dotted key paths in a next-intl messages object
export function membershipTextRowId(spot: MembershipTextSpot, index: number): string;
```

- [ ] **Step 1: Write the failing tests.**
  - The metadata matches the table above.
  - `membershipTextItems` returns null for an empty spot, sorts by `sort_order`, and falls back to Norwegian when English is blank.
  - `resolveDefaultItems` against small fake message objects; for `business`, each item has both title and body.
  - `membershipTextRowId("home_join", 2)` is `"home-join-2"`.
  - Every default key path exists in the real `packages/i18n/messages/no/*.json`. Load the files in the test.
- [ ] **Steps 2–5:** run the tests to see them fail, implement, then run them to see them pass. Commit: `git commit -m "feat(shared): membership text spots"`

### Task 3: Admin actions

**Files:** `apps/admin/src/app/(portal)/_actions/membership-texts.ts` (+ test); `apps/admin/src/lib/roles.ts` (`portal.benefitsTexts`).

```ts
export interface MembershipSpotData { hasRows: boolean; items: { body_en: string; body_nb: string; title_en: string; title_nb: string }[]; spot: MembershipTextSpot }
export async function loadMembershipTexts(): Promise<MembershipSpotData[]>; // all 7 spots; spots without rows are pre-filled from the i18n bundles (both locales) via resolveDefaultItems + loadMessages from @repo/i18n
export async function saveMembershipSpot(spot: MembershipTextSpot, items: { body_en?: string; body_nb?: string; title_en?: string; title_nb: string }[]): Promise<{ data: true } | { error: string }>;
export async function resetMembershipSpot(spot: MembershipTextSpot): Promise<{ data: true } | { error: string }>;
```

Every action requires auth plus `canManageMembershipTexts`; otherwise `{ error: "Unauthorized" }`. Save and reset log `membership_texts_saved` / `membership_texts_reset`, call `notifyWebsite(["membership-texts"])`, and `revalidatePath("/benefits/texts")`.

- [ ] **Step 1: Write the failing tests.**
  - A campus admin is refused.
  - `load` pre-fills an empty spot with the real Norwegian defaults and returns rows when they exist.
  - `save`:
    - Upserts `home-join-0..2` and deletes `home-join-3..4` when two items were removed.
    - Auto-translates a blank English title; a translation failure copies the Norwegian.
    - Refuses a body on a line spot (ignore it, or return an error; pick one and test it).
    - Validates the limits.
  - `reset` deletes all of the spot's rows.
  - `notifyWebsite` is called once per successful save and once per reset.
- [ ] **Steps 2–5:** run the tests to see them fail, implement, then run them to see them pass. Run the full admin suite. Commit: `git commit -m "feat(admin): save membership texts"`

### Task 4: Website readers and components

**Files:**
- Create: `apps/web/src/lib/data/membership-texts.ts` (`cachedMembershipTextRows()`: `"use cache"`, `cacheLife("minutes")`, `cacheTag("membership-texts")`, guest client, limit 200, throws; and `getMembershipTextItems(spot, locale)`: not cached, rows → `membershipTextItems`, returns null on a failed read)
- Modify:
  - server parents pass `items` (null → component uses i18n):
    - `(public)/page.tsx` → `JoinUs`
    - `(public)/onboarding/page.tsx` → `OnboardingFlow`
    - `components/shop/product-details-server.tsx` → `MemberCalloutClient`
    - `(public)/business/page.tsx` → `BusinessPageClient` (title + body cards)
    - `(public)/business-hotspot/page.tsx` → client
  - `member-portal-content.tsx` → `MemberPortalTabs` → home, benefits and membership tabs → `MembershipCtaSection` (plan card lines) and `LockedContentOverlay` (portal lock lines). Add only the props needed.
- Tests: a component test per spot that renders items instead of the i18n text when given, and the i18n text when `items` is null. A reader test for the tag, and for `null` on failure at `getMembershipTextItems`.

- [ ] **Steps 1–5:** TDD (red, then green). Run the full web suite and check-types. Commit: `git commit -m "feat(web): membership texts come from admin"`

### Task 5: Admin page "Tekster om medlemskap"

**Files:** `apps/admin/src/app/(portal)/benefits/texts/page.tsx` (server, `requireNavAccess("portal.benefitsTexts")`), `_components/membership-texts-editor.tsx` (+ test); the board header adds a `Tekster` link when the user can manage texts; i18n keys under `adminPortal.benefits.texts.*` (no/en).

- **Layout:** studio look. One card per spot, in table order.
  - **Card header:** the label, a muted "Vises på …" line, a "Se på nettsiden" link (`NEXT_PUBLIC_WEB_BASE_URL` + path, `target=_blank rel=noopener`), and a "Ikke lagret ennå – viser nettsidens standardtekst" pill when `hasRows` is false.
  - **Items:** a list of inputs, one line each, with a textarea under the title for `business`. They are drag-sortable (`@dnd-kit`), with "Fjern" per item and "+ Legg til linje" (disabled at 12). There is an "Engelsk" disclosure per item.
  - **Footer:** `Lagre` (primary, disabled until changed) and `Tilbakestill til standard` (AlertDialog confirm, shown only when `hasRows`). Toasts follow each save.
- **Norwegian copy:**
  - title: "Tekster om medlemskap"
  - description: "Punktlistene som forteller hva medlemskapet gir, rundt om på nettsiden."
  - seenOn: "Vises på {path}"
  - viewOnSite: "Se på nettsiden"
  - notSaved: "Ikke lagret ennå – viser nettsidens standardtekst"
  - addLine: "+ Legg til linje"
  - remove: "Fjern"
  - english: "Engelsk"
  - save: "Lagre"
  - reset: "Tilbakestill til standard"
  - resetTitle: "Tilbakestille «{label}»?"
  - resetBody: "Nettsiden går tilbake til standardteksten. Endringene dine slettes."
  - saved: "Lagret"
  - resetDone: "Tilbakestilt"
  - failed: "Kunne ikke lagre. Prøv igjen."
  - tooMany: "Maks 12 punkter."
- [ ] **Step 1: Write the failing tests.**
  - Seven cards in order.
  - The pre-fill pill on unsaved spots.
  - Adding and removing lines updates the list; "Lagre" calls `saveMembershipSpot` with the ordered items.
  - Reset asks for confirmation.
  - A campus admin gets `notFound`, through `requireNavAccess` with mocked roles.
- [ ] **Steps 2–5:** run the tests to see them fail, implement, then run them with the full admin suite and the build. Commit: `git commit -m "feat(admin): page for membership texts"`

### Task 6: Verification and go-live notes

- [ ] Run every suite, check-types, both builds and ultracite on the changed files.
- [ ] Append to the go-live doc:
  - Nothing to migrate.
  - The page works as soon as stages 1–4 are live.
  - Every spot shows the current text until someone saves it.
