# Benefits Studio, Stage 5 (API endpoints and the mobile app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The BISO app shows the same benefits as the website. The campus screen lists every section. The member pass screen gets a "Dine fordeler" list, where members reveal codes and links, and non-members see the deal with a "Bli medlem" prompt.

**Architecture:**
- **Two API endpoints** in `apps/api`. The app fetches both lists through the API, so the visibility and ordering rules live once, in TypeScript. Ruling: the spec allowed either an SDK or an API route for listing, and this avoids a Dart copy of the rules.
  - `GET /api/benefits?campus=<id>` returns `PublicBenefit[]` from stage 4's shared model. The JWT is optional.
  - `POST /api/benefits/<id>/reveal` (JWT required) calls stage 4's `revealBenefitCode`, with membership from `resolveMemberPassForRequest`.
- **Flutter app:** a hand-written model, an API client in the existing `MemberPassApiClient` style, Riverpod providers, a reworked campus benefits section, and a new member-pass benefits section with a detail sheet.

**Tech Stack:** Next.js route handlers + Vitest (`apps/api`); Flutter 3.47.2 / Dart 3.13, Riverpod 2.6, go_router 16, `http` + `MockClient`, the Biso design system (`lib/presentation/widgets/biso/biso.dart`).

**Spec:** `docs/superpowers/specs/2026-10-21-benefits-studio-design.md` (D3, D11). Recon: `.superpowers/sdd/stage-5-recon.md`.

## Global Constraints

- **Sites side.** `apps/api` conventions:
  - Each route has a local `json(body, origin, status)` helper with `Cache-Control: private, no-store` and `applyCorsHeaders`.
  - Each route exports `dynamic = "force-dynamic"` and an `OPTIONS` handler that returns `corsPreflightResponse`.
  - Error bodies are `{ error: "<snake_token>" }` matching `^[a-z_]{1,40}$`.
  - Tests are Vitest with hoisted mocks (`server-only`, `@/lib/auth`, `@repo/api/server`, `@/lib/member-pass/resolve`).
  - Run them with `cd apps/api && bun run test` and `bun run typecheck`.
- **Reveal status codes:**
  - 401 `not_authenticated` when there is no Bearer token or it is invalid.
  - 403 `not_member`.
  - 404 `not_found`.
  - 409 `no_code`.
  - 503 `membership_unavailable`.
  - 429 `rate_limited`, at 30 per minute per user via `createRateLimiter`.
  - 200 `{ value }` on success.
- **Membership mapping** from `resolveMemberPassForRequest(req)`:
  - `active` → `"active"`.
  - `not_member`, `expired`, `no_bi_identity` → `"inactive"`.
  - `unavailable` → `"unavailable"`.
  - `unauthenticated` → 401.
- **Listing** uses the admin client to read published rows (`Query.select(BENEFIT_PUBLIC_COLUMNS…)`) and partners, then `publicBenefitsFromRows` → `benefitsForCampus(campus)`. It must never include `redemption_value`. An invalid `campus` value is treated as national-only.
- **Flutter repository: never touch the main checkout.** `/Users/markus/Documents/dev/BISO-Flutter` has the owner's uncommitted changes. All work happens in a worktree:
  `git -C /Users/markus/Documents/dev/BISO-Flutter worktree add /Users/markus/Documents/dev/BISO-Flutter-benefits -b feat/benefits-in-app main`.
  Then run `flutter pub get` there. Never stage `lib/types/*` or `appwrite.config.json`. Leave the other session's `.claude/worktrees/*` alone.
- **Flutter conventions:**
  - Copy is in `lib/generated/l10n/app_en.arb` + `app_no.arb`. Run `flutter gen-l10n` and commit the generated files.
  - Icons come from `CupertinoIcons` only; `design_rules_test.dart` bans `Icons.`. Add new UI files to its `migratedFiles`.
  - Use `showBisoSheet` for sheets and the Biso widgets for rows, sections, empty states, errors and skeletons.
  - Run `flutter test` and `flutter analyze` (0 issues).
- **Norwegian copy (app):**

| Key | Norwegian |
|---|---|
| `benefitsYourBenefits` | Dine fordeler |
| `benefitsShowCode` | Vis kode |
| `benefitsOpenLink` | Åpne lenken |
| `benefitsShowCard` | Vis medlemskortet i kassa |
| `benefitsCopy` | Kopier |
| `benefitsCopied` | Kopiert |
| `benefitsMembersOnly` | Koden vises bare for medlemmer. |
| `benefitsBecomeMember` | Bli medlem |
| `benefitsUnavailable` | Vi får ikke sjekket medlemskapet ditt akkurat nå. Prøv igjen om litt. |
| `benefitsNotFound` | Denne fordelen er ikke lenger tilgjengelig. |
| `benefitsEmpty` | Ingen fordeler her ennå. |
| `benefitsValidUntil` | Gjelder til {date} |
| `benefitsTerms` | Vilkår |
| `benefitsShowMore` / `benefitsShowLess` | Vis {count} til / Vis færre |
| `benefitSectionMember` / `Career` / `Social` / `Safety` / `Business` | Medlemsfordeler / Karrierefordeler / Sosialt nettverk / Trygghet og støtte / For bedrifter |

English is a plain translation, with the same placeholders.

## Review Focus

- **The reveal response is the only place a code exists in the app.** It is never cached in a provider beyond the sheet's own state, never logged, and never written to analytics (Task 4 test: the list model has no code field).
- **Membership-check outage:** the app shows `benefitsUnavailable` with a retry option. It never shows "Bli medlem" on an outage (Task 4 widget test).
- **A student with no campus on their profile** sees national benefits only, and the screen doesn't crash (Task 4 test).
- **An expired JWT during reveal** triggers one silent retry, through the client's 401 handling (Task 3 test).
- **The app on an old API without the endpoint (404):** the member pass screen hides the section instead of showing an error (Task 3 + Task 4 tests).

---

### Task 1: Benefit list endpoint (Sites)

**Files:** Create `apps/api/src/app/api/benefits/route.ts` (+ `route.test.ts`), `apps/api/src/lib/benefits/public-benefits.ts` (server reader: admin client → `PublicBenefit[]` for a campus).

- [ ] **Step 1: Write the failing tests:**
  - `GET ?campus=2` returns 200 `{ benefits }`, with Bergen items before national ones and no `redemption_value` anywhere in the JSON.
  - `?campus=x` returns national only.
  - The `cache-control` header is `private, no-store`.
  - `OPTIONS` returns CORS headers.
  - A db failure returns 503 `{ error: "unavailable" }`.
- [ ] **Steps 2–4:** run the tests to see them fail, implement, then run them to see them pass. Run the full api suite and `bun run typecheck`.
- [ ] **Step 5: Commit** in Sites. `git commit -m "feat(api): list public benefits for the app"`

### Task 2: Reveal endpoint (Sites)

**Files:** Create `apps/api/src/app/api/benefits/[id]/reveal/route.ts` (+ test). It uses `revealBenefitCode` with an admin-client `RevealDb` adapter.

- [ ] **Step 1: Write the failing tests:**
  - Each status code in Global Constraints, including the membership mapping for each resolver state and the rate limit.
  - On success the body is exactly `{ value }`.
  - The code value never appears in a logged error. Spy on `console.error`.
- [ ] **Steps 2–5:** run the tests to see them fail, implement, then run them to see them pass. Commit: `git commit -m "feat(api): member-only benefit code reveal for the app"`

### Task 3: Flutter model, API client and providers (worktree)

**Files (in `/Users/markus/Documents/dev/BISO-Flutter-benefits`):**
- Create:
  - `lib/data/models/campus_benefit.dart`: `CampusBenefit`, parsed from `PublicBenefit` JSON. Fields: id, campusId, section enum, title/description/terms (nb, en), category, partner (name, logoUrl, websiteUrl), imageUrl, isFeatured, publishEnd (DateTime?) and redemptionType enum. Unknown values become `none` / `member`. **No code field.**
  - `lib/data/services/benefits_api_client.dart`: `abstract interface class BenefitsApi { Future<List<CampusBenefit>> fetchBenefits({String? campusId}); Future<String> reveal(String benefitId); }`, plus `BenefitsApiClient`, built in the same style as `MemberPassApiClient`: JWT optional for the list, 401 → retry once, a 20 s timeout, error tokens, and a 404 on list → `BenefitsApiException(notDeployed)`.
  - `lib/providers/benefits/benefits_providers.dart`: `benefitsApiProvider`, `campusBenefitsProvider = FutureProvider.family<List<CampusBenefit>, String?>`.
- Tests:
  - `test/data/models/campus_benefit_test.dart` (parsing, unknown enums, no code field)
  - `test/data/services/benefits_api_client_test.dart` (URL and headers, 401 retry, error mapping for each token, 404 → notDeployed, the reveal body `{value}`)
- [ ] **Steps 1–4:** TDD (red, then green). Run `flutter test` and `flutter analyze`.
- [ ] **Step 5: Commit** in the worktree. `git commit -m "feat(benefits): model, API client and providers"`

### Task 4: Member pass "Dine fordeler" (worktree)

**Files:** Create `lib/presentation/widgets/benefits/benefit_list_section.dart`, `benefit_detail_sheet.dart`. Modify `lib/presentation/screens/profile/member_pass_screen.dart` (add a sliver after the pass body). Update the arb files and generated l10n, plus `test/presentation/design_rules_test.dart` `migratedFiles`.

Behaviour:
- **What it shows:** member-section benefits for `UserModel.campusId` (via `authStateProvider`), or national only when that is null.
- **States:**
  - Loading shows `BisoSkeleton.rows()`.
  - Empty shows `benefitsEmpty`.
  - Not deployed (404) hides the whole section.
  - Any other error shows `BisoErrorState` with retry.
- **Rows:** `BisoListRow` with a partner logo or initials tile, the title in the app locale (nb for `no`), and the partner name as subtitle.
- **Tapping a row** opens the `showBisoSheet` detail: the title, description, terms (in a disclosure) and `benefitsValidUntil`, plus the action:
  - **code**, when the pass view is active: `benefitsShowCode` → reveal → show the code large, with a `benefitsCopy` button (clipboard + `benefitsCopied` toast).
  - **link**, when active: `benefitsOpenLink` → reveal → `url_launcher` (or the existing link helper).
  - **onsite**: the `benefitsShowCard` line and a button that opens `showPassPresentation` when active.
  - **Not active:** `benefitsMembersOnly` + `benefitsBecomeMember` → `context.push('/profile/membership')`.
  - **Reveal error:** `not_member` → the members-only state; `membership_unavailable` → `benefitsUnavailable` + retry; `not_found` → `benefitsNotFound`.
- [ ] **Step 1: Write the failing widget tests** (`pumpBisoScreen`, fake `BenefitsApi`, a fake member pass view):
  - Active shows the list; tapping and revealing shows the code; copy writes to the clipboard.
  - A non-member sees "Bli medlem" and no reveal.
  - Unavailable shows the outage text, never "Bli medlem".
  - notDeployed hides the section.
  - A null campus requests `campusId: null`.
- [ ] **Steps 2–4:** run the tests to see them fail, implement, then run them to see them pass. Run `flutter analyze`.
- [ ] **Step 5: Commit.** `git commit -m "feat(benefits): Dine fordeler on the member pass"`

### Task 5: Campus screen sections (worktree)

**Files:** Modify `lib/presentation/screens/explore/campus_detail_screen.dart` and `campus_detail_components.dart`: replace the three `CampusBenefitCard`s that read `campus_data` with five section cards from `campusBenefitsProvider(campusId)`, in section order (member, career, social, safety, business), using the l10n section labels. Each card shows titles, `take(3)` with `benefitsShowMore` / `benefitsShowLess`; this fixes the hardcoded English. Hide empty sections. Remove the dead campus-data benefit fields from `CampusService`/models only if nothing else uses them.

- [ ] **Step 1: Write the failing widget test.** Update `campus_detail_design_test.dart` or add a test:
  - Five sections render with the l10n labels.
  - "Vis 2 til" toggles.
  - An empty section is hidden.
  - A provider error shows `BisoErrorState` in place of the sections, not a crash.
- [ ] **Steps 2–5:** run the test to see it fail, implement, then run it to see it pass. Run `flutter test` and `flutter analyze`, then commit: `git commit -m "feat(benefits): campus screen shows every benefit section"`

### Task 6: Verification

- [ ] Sites: `cd apps/api && bun run test && bun run typecheck`, and `bun run check-types` at the root.
- [ ] Flutter (worktree): `flutter test`, and `flutter analyze` with 0 issues.
- [ ] Append to the go-live doc:
  - Deploy `apps/api` with stage 4.
  - Merge `feat/benefits-in-app` in BISO-Flutter and ship a release.
  - Old app versions keep working; they show no benefits, as today.
