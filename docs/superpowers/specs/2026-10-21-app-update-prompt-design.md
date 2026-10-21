# App update prompt: required and recommended updates for the student app — design

## Why

When BISO ships a new version of the student app (BISO-Flutter), people on
older versions should be told to update, and when an old version can no
longer work properly (a changed API, a broken flow), they should be stopped
until they do. The previous TypeScript app had this; the Flutter app does
not, and nothing in the current builds can reach an old install remotely.

The rule must be managed by BISO, stored in Appwrite and served through the
API app (`apps/api`), not hard-coded in a release.

Updating should happen from inside the app where the platform allows it,
instead of a button that throws the student out to a store app.

## Success looks like

- BISO releases 2.4.0. Once it is live in both stores, a global admin opens
  **Settings → App versions** in admin, sets iOS and Android *minimum
  version* to 2.4.0 and saves.
- A student on 2.3.2 opens the app. A full-screen "Update required" screen
  covers everything. There is no way past it.
  - **Android:** they tap *Update*, Google Play's own update screen appears
    inside the app, Play downloads and installs 2.4.0 and the app restarts on
    it.
  - **iOS:** they tap *Update* and the BISO App Store page opens as a sheet
    on top of the app, where they tap Apple's *Update* button. The app never
    closes.
- With a *recommended version* set instead, the student sees a dismissible
  popup ("A new version is available" — *Update* / *Not now*). After *Not
  now* it does not come back for 3 days.
- A student who is offline, or whose app cannot reach the API, is never
  blocked by this feature.

## Important expectation

Only builds that contain this feature can be prompted. Every install older
than the first release with it (for example the 2.2.4 currently live in the
App Store) will never see a prompt. The first release with this feature is the
floor; from then on every older version can be reached.

## Goals

- Two thresholds, set **per platform** (iOS, Android):
  - **Minimum version.** Anything below it is blocked by a full-screen,
    undismissable screen.
  - **Recommended version.** Anything below it (but at or above the minimum)
    gets a dismissible popup.
  - Either can be left empty, which turns that check off for that platform.
- Per-platform because App Store review usually lags Google Play. A shared
  number would block iPhone users before the update exists for them.
- Update from inside the app:
  - **Android:** Google Play In-App Updates, *immediate* flow (Play's
    full-screen update UI, Play installs, the app restarts). Used for both
    required and recommended; the student already chose to update by tapping
    the button.
  - **iOS:** `SKStoreProductViewController` (StoreKit) showing App Store item
    **6468173379** (BI Student Organization) as an in-app sheet.
- An **App versions** tab in admin Settings, next to Feature flags and
  Payments, for setting the four numbers.
- The rule travels in the existing `GET /api/config` response the app already
  fetches at launch. No new endpoint.

## Non-goals

- Admin-written messages or release notes in the prompt. The copy is fixed in
  the app's l10n (Norwegian and English). *(my call)*
- Detecting new versions automatically from the stores. BISO sets the
  numbers by hand.
- Targeting by campus, user or anything else than platform and version.
- Web, desktop or any platform other than iOS and Android. Other platforms
  never see a prompt.
- Comparing build numbers. Every release bumps the version name (2.2.8 →
  2.2.9), so only `major.minor.patch` is compared. *(my call)*

## Anti-goals (a failure even if it technically works)

- **Blocking someone who can't fix it.** That covers offline use, a failed
  config fetch, an unparseable version string, and a platform the feature
  doesn't support. All of these must let the student through.
- **Blocking before the update exists in their store.** The per-platform
  split is the main guard. The admin also helps (see the admin section).
- **Nagging.** The recommended popup must respect the 3-day snooze and must
  not stack on top of another launch prompt (the topics prompt).
- **Stopping work the app does in the background at launch.** The block
  screen sits on top of the app. The launch-time providers in `BisoApp` must
  still run under it: checkout recovery, membership checkout, auth and topic
  reconciliation. Otherwise a payment completed just before the block appears
  would go unresolved.
- **A dead end.** If the in-app update can't run (Play can't find the update,
  the app was sideloaded, the StoreKit sheet fails to load), the student must
  still get to the store page. The fallback is the Play Store listing via
  `market://details?id=com.biso.no` (https URL if that fails) or
  `https://apps.apple.com/app/id6468173379`.

## How it works

### Data (Appwrite)

New table in database `app`, added to `packages/api/appwrite.config.json` (the
user pushes it and regenerates types afterwards). Suggested id
`app_versions`. One row per platform:

| column | type | notes |
|---|---|---|
| `platform` | enum `ios`, `android` | required, unique index |
| `minimum_version` | string (size 32) | optional, `major.minor.patch` |
| `recommended_version` | string (size 32) | optional, `major.minor.patch` |

Permissions mirror `payment_settings`: create/read/update/delete for
`team:sg-app-dept-operationsunit`, **no** `read("any")`. The app never reads
the table directly. The API reads it with the admin client.

### API (`apps/api/src/app/api/config/route.ts`)

`GET /api/config` gains a `versions` object alongside `content` and
`features`:

```json
{
  "versions": {
    "ios": { "minimum": "2.4.0", "recommended": null },
    "android": { "minimum": "2.4.0", "recommended": "2.4.1" }
  }
}
```

- Read with `createAdminClient()` from `@repo/api/server`.
- If the table is missing, the read fails or a platform has no row, that
  platform's values are `null`. The endpoint must never fail because of this
  feature, since `features` depends on it too.
- Keep the existing `Cache-Control: public, max-age=0, s-maxage=15`.
- Vitest coverage alongside the existing `route.test.ts`.

### Admin (`apps/admin/src/app/(portal)/settings/app-versions/`)

- New tab in `settings-subnav.tsx` and a page following the Payments and
  Feature flags pattern: `requireNavAccess("portal.settings")` (global
  admins), server actions in `actions.ts`, a client component for the form,
  strings in `@repo/i18n` under `adminPortal`.
- Two rows (iOS, Android), each with *Minimum version* and *Recommended
  version* inputs, plus a one-line explanation of each written for
  non-technical admins. For example, minimum: "Older versions are blocked
  until they update". Recommended: "Older versions are asked to update but
  can skip it".
- Validation, both client and server side:
  - each value is empty or `major.minor.patch` (digits only);
  - if both are set, recommended ≥ minimum.
- Save writes via the session client (upsert per platform) and logs to the
  audit log the way feature-flag changes do.
- **iOS live-version guard** *(my call)*:
  - The page shows the version currently live in the App Store, from Apple's
    public lookup `https://itunes.apple.com/lookup?bundleId=com.biso.no&country=no`.
  - If the iOS minimum entered is higher than that version, the page warns
    before saving: "This version isn't in the App Store yet. iPhone users
    would be blocked with nothing to update to." It's a warning, not a hard
    stop, and if the lookup fails the page just doesn't show it.
  - Android has no comparable public lookup, so its row only gets a static
    reminder to set the minimum after the release is live on Google Play.

### App (BISO-Flutter)

**Config.** Extend `AppConfig` (`lib/data/models/app_config.dart`) with the
policy for the current platform. It's parsed leniently: a missing or bad
`versions` object means no policy, never a block. It reuses
`AppConfigService`'s existing fetch.

**Only a fresh answer can prompt.** *(my call)*
- **The problem:** `AppConfigService` quietly falls back to a cache up to an
  hour old when the network fails. A student who was online a moment ago and
  then opens the app offline at the door would be blocked from their member
  pass, with no way to update.
- **The rule:**
  - Both the required screen and the recommended popup appear only when the
    policy came from a network response fetched in this app session.
  - A cached answer or `AppConfigUnavailableException` gives no prompt.
- **What changes in the code:** the service has to report where its answer
  came from (network or cache). The decision function takes that as an
  input. The expenses switch keeps using cached answers as it does today.
- **A block already showing stays** if the student goes offline
  mid-session. It goes away only when a fresh answer says the version is
  fine, or when the app restarts and can't reach the server.

**Decision.** This is a pure function. Its inputs are the installed version
(`PackageInfo.version` from `package_info_plus`, already a dependency), the
platform policy, whether that policy is fresh, and the snooze state. A policy
that isn't fresh always gives `none`. Otherwise it returns `none`,
`recommended` or `required`:

- `required` when the installed version is below the minimum;
- else `recommended` when it is below the recommended version and not
  snoozed for that version;
- else `none`.

Versions are compared numerically per segment (2.10.0 > 2.9.0). Anything
unparseable, on either side, gives `none`. Unit-tested.

**When it is checked.**
- At launch, through the existing `appConfigProvider`.
- On resume from the background, re-fetching the config at most once an hour,
  so an app left running for days still gets a block. *(my call)*

**Required screen.** A full-screen overlay placed in `MaterialApp.router`'s
`builder`, above the router's child, so every route (login and onboarding
included) is covered while `BisoApp`'s providers keep running. It:
- shows the BISO look, a short explanation and an *Update* button;
- has no close button, and Android back does nothing;
- stays on screen if the student cancels the store sheet or Play's update
  screen.

**Recommended popup.** A dialog with *Update* and *Not now*.
- *Not now* stores the dismissed version and a timestamp in
  `shared_preferences`. The popup is suppressed for 3 days for that version,
  and a higher recommended version resets the snooze.
- It never shows on a launch where the topics prompt (`maybeShowTopicsPrompt`)
  is shown. The builder picks the ordering.

**Update action (platform layer).**
- **Android:** Play In-App Updates, immediate flow.
  - Prefer the `in_app_update` pub package if it builds against the current
    Android toolchain (Gradle 8.14.3, AGP 8.11.1, Kotlin 2.2.20, which are
    Flutter 3.47's floors). Otherwise use a small Kotlin method channel around
    `com.google.android.play:app-update`. `MainActivity.kt` lives under
    `android/app/src/main/kotlin/com/example/bisoflutter/`.
  - If Play reports no update available, or the flow errors, open the Play
    Store listing.
- **iOS:** A method channel (for example `biso/app_store`) in
  `ios/Runner/AppDelegate.swift`, next to the existing `biso/wallet` channel
  and following `lib/data/services/wallet_channel.dart`.
  - It presents `SKStoreProductViewController` loaded with item 6468173379.
    StoreKit is a system framework, so no new pod is needed.
  - If loading the product fails, open `https://apps.apple.com/app/id6468173379`
    with `url_launcher`.
- Both store identifiers live in `AppConstants`.

**Copy.** New strings in `lib/generated/l10n/app_en.arb` and the Norwegian
arb: title, body and buttons for both prompts.

### Android release workflow (in scope)

Android releases are meant to reach Google Play through
`BISO-Flutter/.github/workflows/build.yml` (`build-and-deploy-android`, which
uploads to the internal track). Today that job overrides the version with
stale env values: `--build-name=2.0.1 --build-number=82`. Every Play build
would therefore report 2.0.1, so any minimum version would block all Android
users forever. The fix ships with this feature:

- `pubspec.yaml`'s `version:` (e.g. `2.2.9+93`) becomes the single source.
  Drop the `APP_VERSION` / `BUILD_NUMBER` overrides from both `flutter build`
  steps, or replace them with values read from the pubspec.
- The artifact name and the `create-github-release` job also use
  `APP_VERSION`. They read the version from the pubspec (or from a job output
  of the build job; `GITHUB_ENV` doesn't cross jobs), so release names stay
  correct.
- **Consequence:** Play rejects an upload whose version code it already has,
  so a push to `main` without a version bump fails the upload step. That
  already happens today with the fixed 82. Triggers stay as they are.
  *(my call)*
- iOS isn't built by this workflow and is unaffected.

## Testing

- **Sites:** Vitest for the config route (policy present, table
  missing/failing → nulls, endpoint still 200) and the admin action
  validation. `bun run check-types` and `bun x ultracite check` must pass.
- **Flutter:**
  - unit tests for version comparison and the decision function (including
    unparseable versions, unknown config and snooze expiry);
  - a widget test that the required screen covers the app and can't be
    dismissed;
  - `flutter analyze` clean. CI's `flutter build apk --debug` is the only
    Android build check on this Mac.
- **Native, manual, by the user:**
  - Play In-App Updates only works for an install from Play, so it must be
    tested through Play internal app sharing or the internal track.
  - `SKStoreProductViewController` has no App Store on the simulator, so it
    must be tested on a real iPhone.

## Branches

- Sites: `feat/app-update-prompt` (worktree
  `.claude/worktrees/app-update-prompt`), branched from `main`. Kept separate
  from `feat/benefits-studio`, which another session is working on.
- Flutter: `feat/app-update-prompt` (worktree
  `.claude/worktrees/app-update-prompt` in BISO-Flutter), branched from
  `main`. The uncommitted regenerated types on Flutter `main` are left
  untouched.

## Order

1. Appwrite table in `appwrite.config.json`. The user pushes and regenerates
   types.
2. API `versions` in `/api/config`.
3. Admin App versions tab.
4. Flutter: config parsing and decision logic, then the UI, then the native
   update actions.
5. Flutter: the release workflow version fix. It's independent, and can go
   first.

Steps 2 and 3 can't type-check against the new row type until step 1 is
pushed and the types are regenerated. The builder may use a local interface
until then.

## Left to the builder

- Exact table and column ids, as long as they mirror existing tables.
- Visual design of the screen and popup, within the app's `PremiumTheme`.
- Package vs. hand-written channel on Android (see above).
- Where the decision provider lives (likely `lib/providers/config/`).
- Ordering between the recommended popup and the topics prompt.
