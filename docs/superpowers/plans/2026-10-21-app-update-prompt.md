# App Update Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BISO can set, per platform, a minimum app version (older versions are blocked) and a recommended version (older versions get a popup they can skip). The app updates in place: Google Play's in-app update on Android, the App Store sheet on iOS.

**Architecture:**
- The settings live in a new Appwrite table `app_versions`, one row per platform.
- Global admins edit them in a new admin Settings tab.
- The API app adds them to the existing `GET /api/config` response.
- The Flutter app decides on each fresh config whether to show nothing, a popup or a block. The block is an overlay above the router, so launch-time providers keep running under it.

**Tech Stack:**
- Sites: Next.js 16, Appwrite via `@repo/api`, Vitest (`apps/api`, `packages/*`), `bun test` (`apps/admin`), next-intl.
- Flutter: Riverpod 2, `package_info_plus`, `shared_preferences`, `url_launcher`, new `in_app_update` (Android), StoreKit `SKStoreProductViewController` (iOS method channel).

**Spec:** `docs/superpowers/specs/2026-10-21-app-update-prompt-design.md` (in BISO-Sites)

**Repos and worktrees:**
- Sites tasks (1–5) run in `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/app-update-prompt`, branch `feat/app-update-prompt`.
- Flutter tasks (6–11) run in `/Users/markus/Documents/dev/BISO-Flutter/.claude/worktrees/app-update-prompt`, branch `feat/app-update-prompt`.
- Never touch the main checkouts. `feat/benefits-studio` belongs to another session, and Flutter `main` has uncommitted files that aren't ours.

## Global Constraints

- **Platforms** are exactly `ios` and `android`. Any other platform never sees a prompt.
- **Version strings** are `major.minor.patch`, digits only (`/^\d+\.\d+\.\d+$/`). Build numbers are never compared. Segments compare numerically (2.10.0 > 2.9.0).
- **Empty** minimum or recommended means that check is off for that platform.
- **Validation:** if both values are set, recommended ≥ minimum.
- **Store identifiers:**
  - App Store item `6468173379`; fallback URL `https://apps.apple.com/app/id6468173379`.
  - Android package `com.biso.no`; fallback `market://details?id=com.biso.no`, then `https://play.google.com/store/apps/details?id=com.biso.no`.
- **iOS live-version lookup:** `https://itunes.apple.com/lookup?bundleId=com.biso.no&country=no`.
- **Recommended popup snooze:** 3 days per dismissed version. A higher recommended version resets the snooze.
- **Resume re-check:** re-fetch the config on resume at most once an hour.
- **Only a fresh answer prompts.** Prompts come only from a network response fetched in this app session. A cached answer, a fetch failure, or `AppConfigUnavailableException` never creates a prompt. A prompt already decided in this session stays until a fresh answer changes it.
- **Failing open:** anything unparseable (installed version, server value or response shape) means no prompt.
- **The endpoint:** `GET /api/config` must keep answering 200 with `features` even if `app_versions` is missing or unreadable. Keep `Cache-Control: public, max-age=0, s-maxage=15`.
- **Table permissions:** `app_versions` mirrors `payment_settings`: CRUD for `team:sg-app-dept-operationsunit`, no `read("any")`, `rowSecurity: false`, database `app`.
- **Copy:** the app's copy is fixed in l10n, Norwegian and English, with no admin-written text. The admin copy targets non-technical admins.
- **Sites rules:** Bun only. Never import `appwrite`/`node-appwrite` in app code. Never hand-edit `packages/api/types/appwrite.ts`. `bun run check-types` and `bun x ultracite check` must pass.
- **Flutter checks:** `flutter analyze` must be clean and `flutter test` must pass. There's no Android SDK on this Mac. CI's `flutter build apk --debug` is the Android build check.

## Review Focus

1. **The required block over a payment return.** When a block appears on a launch that resolves a payment completed while the app was evicted, `checkoutControllerProvider` and `membershipCheckoutControllerProvider` must still run. Test: Task 11's widget test asserts the router child is still mounted under the overlay.
2. **An already-open app going offline.** A required decision made from a fresh answer must stay up when the hourly resume re-fetch falls back to the cache. A cached "fine" must never lift it. Test in Task 9.
3. **Odd installed versions.** `PackageInfo.version` might be `2.2.9-beta`, or empty on a broken build. That must never block anyone. Test in Task 8.
4. **Recommended dismissed, then a newer version recommended.** The snooze for 2.4.0 must not hide 2.4.1. Test in Task 8.
5. **An admin typing a minimum higher than the App Store's live iOS version.** The iOS row must show the warning, Save must still work, and a failed lookup must hide the warning instead of showing "unknown". Tested in Task 4 (lookup → `null`) and Task 5 (`shouldWarnAboveStore`).

---

## Sites (BISO-Sites worktree)

### Task 1: Shared version rules

**Files:**
- Create: `packages/shared/utils/app-versions.ts`
- Test: `packages/shared/utils/app-versions.test.ts`

**Interfaces:**
- Produces (imported as `@repo/shared/utils/app-versions`):
  - `APP_PLATFORMS = ["ios", "android"] as const`
  - `type AppPlatform = (typeof APP_PLATFORMS)[number]`
  - `interface AppVersionPolicy { minimum: string | null; recommended: string | null }`
  - `type AppVersionsConfig = Record<AppPlatform, AppVersionPolicy>`
  - `EMPTY_APP_VERSIONS: AppVersionsConfig` (all null)
  - `interface AppVersionsRow { platform: AppPlatform; minimum_version: string | null; recommended_version: string | null }`. This is the row shape until types are regenerated, like `PaymentSettingsRow`.
  - `isVersionString(value: string): boolean`
  - `compareVersions(a: string, b: string): number`. Negative, zero or positive. Only called with valid strings.
  - `type AppVersionError = "invalidMinimum" | "invalidRecommended" | "recommendedBelowMinimum"`
  - `validateAppVersionPolicy(input: { minimum: string; recommended: string }): { policy: AppVersionPolicy } | { error: AppVersionError }`. Trims both values; an empty value becomes `null`.
  - `policyFromRow(row: AppVersionsRow | null): AppVersionPolicy`. A stored value that fails `isVersionString` becomes `null`.

- [ ] **Step 1: Write the failing tests**

```ts
describe("isVersionString", () => {
  it("accepts major.minor.patch", () => {
    expect(isVersionString("2.4.0")).toBe(true);
    expect(isVersionString("10.0.12")).toBe(true);
  });
  it("rejects anything else", () => {
    for (const v of ["2.4", "2.4.0+93", "v2.4.0", "2.4.0-beta", "", " 2.4.0"]) {
      expect(isVersionString(v)).toBe(false);
    }
  });
});

describe("compareVersions", () => {
  it("compares segments numerically", () => {
    expect(compareVersions("2.10.0", "2.9.0")).toBeGreaterThan(0);
    expect(compareVersions("2.2.9", "2.3.0")).toBeLessThan(0);
    expect(compareVersions("2.4.0", "2.4.0")).toBe(0);
  });
});

describe("validateAppVersionPolicy", () => {
  it("turns blanks into null", () => {
    expect(validateAppVersionPolicy({ minimum: " ", recommended: "" })).toEqual({
      policy: { minimum: null, recommended: null },
    });
  });
  it("trims and accepts recommended >= minimum", () => {
    expect(validateAppVersionPolicy({ minimum: " 2.4.0 ", recommended: "2.4.1" })).toEqual({
      policy: { minimum: "2.4.0", recommended: "2.4.1" },
    });
  });
  it("names the bad field", () => {
    expect(validateAppVersionPolicy({ minimum: "2.4", recommended: "" })).toEqual({ error: "invalidMinimum" });
    expect(validateAppVersionPolicy({ minimum: "", recommended: "x" })).toEqual({ error: "invalidRecommended" });
  });
  it("rejects recommended below minimum", () => {
    expect(validateAppVersionPolicy({ minimum: "2.4.0", recommended: "2.3.9" })).toEqual({
      error: "recommendedBelowMinimum",
    });
  });
});

describe("policyFromRow", () => {
  it("drops stored values that are not versions", () => {
    expect(
      policyFromRow({ platform: "ios", minimum_version: "2.4.0", recommended_version: "soon" })
    ).toEqual({ minimum: "2.4.0", recommended: null });
    expect(policyFromRow(null)).toEqual({ minimum: null, recommended: null });
  });
});
```

- [ ] **Step 2: Run and see it fail.** `cd packages/shared && bun run test -- app-versions`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `packages/shared/utils/app-versions.ts` with the signatures above. Use a top-level regex constant.
- [ ] **Step 4: Run and see it pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git add packages/shared/utils/app-versions*` then `git commit -m "feat(shared): version rules for app update prompts"`.

### Task 2: `app_versions` Appwrite table

**Files:**
- Modify: `packages/api/appwrite.config.json`. Add a table entry right after `payment_settings` (around line 3347, where its `"indexes": []` closes).
- Test: `packages/api/appwrite-config-permissions.test.ts`

**Interfaces:**
- Produces: table `app_versions` in database `app`. The row `$id` equals the platform (`"ios"` / `"android"`), like `payment_settings` keys rows by provider.
  - Columns:
    - `platform`: enum `["ios","android"]`, required.
    - `minimum_version`: string, size 32, optional, `encrypt: false`.
    - `recommended_version`: string, size 32, optional, `encrypt: false`.
  - Index: `{ "key": "platform_unique", "type": "unique", "columns": ["platform"], "orders": ["ASC"] }`.

- [ ] **Step 1: Write the failing test.** Add a `describe("app versions table")` block.

```ts
test("app_versions is Operations Unit only, like payment_settings", () => {
  const config = loadAppwriteConfig();
  const table = config.tables.find((t) => t.$id === "app_versions");
  const payments = config.tables.find((t) => t.$id === "payment_settings");
  expect(table?.databaseId).toBe("app");
  expect(table?.rowSecurity).toBe(false);
  expect([...(table?.$permissions ?? [])].sort()).toEqual([...(payments?.$permissions ?? [])].sort());
  expect(table?.$permissions.join(" ")).not.toContain('read("any")');
});
```

- [ ] **Step 2: Run and see it fail.** `cd packages/api && bun run test -- appwrite-config-permissions`. Expected: FAIL, `table` is undefined.
- [ ] **Step 3: Add the table entry.** Mirror the `payment_settings` entry's key order and column shape exactly: `"enabled": true`, `"name": "App versions"`, and the enum column with `"format": "enum"` plus `"elements"`.
- [ ] **Step 4: Run all `packages/api` tests.** `cd packages/api && bun run test`. Expected: PASS. The existing permission and config tests also scan every table.
- [ ] **Step 5: Commit.** `git commit -m "feat(api): app_versions table for app update prompts"`.
- [ ] **Step 6: Tell the user** to push the table to Appwrite and regenerate `packages/api/types/appwrite.ts`. Later tasks don't wait for this, because they use `AppVersionsRow` from Task 1.

### Task 3: `versions` in `GET /api/config`

**Files:**
- Create: `apps/api/src/lib/app-versions.ts`
- Test: `apps/api/src/lib/app-versions.test.ts`
- Modify: `apps/api/src/app/api/config/route.ts`
- Modify (test): `apps/api/src/app/api/config/route.test.ts`

**Interfaces:**
- Consumes: Task 1 (`APP_PLATFORMS`, `AppVersionsConfig`, `AppVersionsRow`, `EMPTY_APP_VERSIONS`, `policyFromRow`).
- Produces:
  - `readAppVersions(): Promise<AppVersionsConfig>`. Reads both rows with `createAdminClient()` and `db.getRow<AppVersionsRow & Models.Row>("app", "app_versions", platform)`. Each platform fails independently. Any error, missing table included, gives that platform `{ minimum: null, recommended: null }`. It never throws.
  - The response JSON gains `versions: { ios: { minimum, recommended }, android: { minimum, recommended } }`.

- [ ] **Step 1: Write the failing tests** in `app-versions.test.ts`. Use `vi.hoisted` + `vi.mock("@repo/api/server", …)` the way `route.test.ts` mocks feature flags.

```ts
it("reads each platform's row", async () => {
  getRow.mockImplementation(async (_db, _t, id) =>
    id === "ios"
      ? { platform: "ios", minimum_version: "2.4.0", recommended_version: null }
      : { platform: "android", minimum_version: "2.4.0", recommended_version: "2.4.1" });
  expect(await readAppVersions()).toEqual({
    ios: { minimum: "2.4.0", recommended: null },
    android: { minimum: "2.4.0", recommended: "2.4.1" },
  });
});

it("answers nulls for a platform whose row is missing", async () => {
  getRow.mockImplementation(async (_db, _t, id) => {
    if (id === "ios") throw new Error("Row with the requested ID not found.");
    return { platform: "android", minimum_version: "2.4.0", recommended_version: null };
  });
  expect((await readAppVersions()).ios).toEqual({ minimum: null, recommended: null });
});

it("never throws when the table does not exist", async () => {
  getRow.mockRejectedValue(new Error("Table not found"));
  expect(await readAppVersions()).toEqual(EMPTY_APP_VERSIONS);
});
```

- [ ] **Step 2: Extend `route.test.ts`.** Mock `@/lib/app-versions`, then assert:
  - `body.versions` equals the mocked value;
  - when `readAppVersions` resolves to `EMPTY_APP_VERSIONS`, `body.features` is still present and the status is 200;
  - the existing `cache-control` assertion still holds.
- [ ] **Step 3: Run and see it fail.** `cd apps/api && bun run test -- config app-versions`. Expected: FAIL.
- [ ] **Step 4: Implement.** Write `readAppVersions` in `apps/api/src/lib/app-versions.ts`. In `route.ts`, await it next to `isFeatureEnabled` (use `Promise.all`) and add `versions` to the JSON. Extend the route's doc comment with one sentence on `versions`.
- [ ] **Step 5: Run and see it pass,** then run `bun run check-types --filter=api`. Expected: PASS, no type errors.
- [ ] **Step 6: Commit.** `git commit -m "feat(api): report app version rules in /api/config"`.

### Task 4: Admin server actions for app versions

**Files:**
- Create: `apps/admin/src/app/(portal)/settings/app-versions/actions.ts`
- Test: `apps/admin/src/app/(portal)/settings/app-versions/actions.test.ts`

**Interfaces:**
- Consumes: Task 1 (`APP_PLATFORMS`, `AppPlatform`, `AppVersionPolicy`, `AppVersionError`, `AppVersionsRow`, `validateAppVersionPolicy`, `policyFromRow`).
- Produces (`"use server"`):
  - `interface AppVersionsView { policies: Record<AppPlatform, AppVersionPolicy>; appStoreVersion: string | null }`
  - `getAppVersionsView(): Promise<AppVersionsView>`. Gated to global admins; reads with the session client. `appStoreVersion` comes from `fetchAppStoreVersion()`.
  - `fetchAppStoreVersion(): Promise<string | null>`. Fetches the iTunes lookup URL with `{ next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) }`. Returns `results[0].version` when it passes `isVersionString`, otherwise `null`. It never throws.
  - `saveAppVersionPolicy(platform: AppPlatform, input: { minimum: string; recommended: string }): Promise<{ data: AppVersionPolicy } | { error: AppVersionError | string }>`. Steps:
    1. Gate to global admins.
    2. Validate.
    3. `db.upsertRow("app", "app_versions", platform, { platform, minimum_version, recommended_version })`.
    4. `logAuditEvent(ctx, "app_versions.update", { resourceId: platform, resourceType: "app_versions", payload: policy })`.
    5. `revalidatePath("/settings/app-versions")`.
  - Gate: `requireAppVersionsAccess()`, the same as `requirePaymentAccess` in `settings/payments/actions.ts`. Redirect when signed out, throw `Forbidden` for anyone who isn't `globaladmin`. Rethrow redirect errors, the way the payments and feature-flag actions do.

- [ ] **Step 1: Write the failing tests** with `bun:test`. Copy the mock setup from `apps/admin/src/app/(portal)/shop/accounting/actions.test.ts`, using `roles: ["globaladmin"]`, and mock `global.fetch` for the lookup.

```ts
test("saves a valid policy keyed by platform and audits it", async () => {
  const result = await saveAppVersionPolicy("ios", { minimum: "2.4.0", recommended: "" });
  expect(result).toEqual({ data: { minimum: "2.4.0", recommended: null } });
  expect(db.upsertRow).toHaveBeenCalledWith("app", "app_versions", "ios", {
    platform: "ios", minimum_version: "2.4.0", recommended_version: null,
  });
  expect(logAuditEvent).toHaveBeenCalledWith(ctx, "app_versions.update", expect.objectContaining({ resourceId: "ios" }));
});

test("refuses an invalid policy without writing", async () => {
  expect(await saveAppVersionPolicy("android", { minimum: "2.4.0", recommended: "2.3.0" }))
    .toEqual({ error: "recommendedBelowMinimum" });
  expect(db.upsertRow).not.toHaveBeenCalled();
});

test("refuses non-global-admins", async () => {
  ctx.roles = ["campusadmin"];
  const result = await saveAppVersionPolicy("ios", { minimum: "2.4.0", recommended: "" });
  expect("error" in result && result.error).toContain("Forbidden");
});

test("reads the live App Store version", async () => {
  fetchMock.mockResolvedValue(Response.json({ results: [{ version: "2.2.4" }] }));
  expect(await fetchAppStoreVersion()).toBe("2.2.4");
});

test("hides the App Store version when the lookup fails", async () => {
  fetchMock.mockRejectedValue(new Error("offline"));
  expect(await fetchAppStoreVersion()).toBeNull();
});

test("treats a missing row as an empty policy", async () => {
  db.getRow.mockRejectedValue(rowNotFound());
  expect((await getAppVersionsView()).policies.android).toEqual({ minimum: null, recommended: null });
});
```

- [ ] **Step 2: Run and see it fail.** `cd apps/admin && bun test "src/app/(portal)/settings/app-versions"`. Expected: FAIL.
- [ ] **Step 3: Implement** `actions.ts` with the signatures above.
- [ ] **Step 4: Run and see it pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(admin): actions for app version rules"`.

### Task 5: Admin "App versions" settings tab

**Files:**
- Create: `apps/admin/src/app/(portal)/settings/app-versions/page.tsx`
- Create: `apps/admin/src/app/(portal)/settings/app-versions/_components/app-versions-client.tsx`
- Modify: `apps/admin/src/app/(portal)/settings/_components/settings-subnav.tsx`. Add `{ exact: false, href: "/settings/app-versions", labelKey: "appVersions" }` after `featureFlags`.
- Modify: `packages/i18n/messages/en/adminPortal.json` and `packages/i18n/messages/no/adminPortal.json`. Add `nav.appVersions` and a new `appVersions` block next to `featureFlags`.

**Interfaces:**
- Consumes: Task 4 (`getAppVersionsView`, `saveAppVersionPolicy`, `AppVersionsView`) and Task 1 (`compareVersions`, `isVersionString`).
- Produces: the page at `/settings/app-versions`.

Page shape:
- **Copy the pattern** of `settings/payments/page.tsx`: `requireNavAccess("portal.settings")`, `PageHeader`, and labels passed into a client component.
- **Client styling:** use `STUDIO`, `studioSurface` and `buttonStyle` from `../../../_components/studio`, `useTransition`, and `sonner` toasts, as `payment-settings-client.tsx` does.
- **Two cards, iPhone (iOS) and Android.** Each has *Minimum version* and *Recommended version* inputs and its own Save button.
- **Field help:**
  - minimum: "Older versions are blocked until they update."
  - recommended: "Older versions are asked to update but can skip it."
- **iOS card:**
  - Shows "Live in the App Store: {version}" when `appStoreVersion` isn't null.
  - Shows the warning "This version isn't in the App Store yet. iPhone users would be blocked with nothing to update to." when the typed minimum is a valid version and `compareVersions(minimum, appStoreVersion) > 0`. Save still works.
- **Android card:** a static note: "Set the minimum only after the release is live on Google Play."
- **Errors:** each `AppVersionError` maps to its own label (`errors.invalidMinimum`, `errors.invalidRecommended`, `errors.recommendedBelowMinimum`). Any other string goes to a generic `saveError` toast.

The en copy above is fixed. Write the matching Norwegian.

- [ ] **Step 1: Pull the warning rule into a pure helper and test it.** Put `shouldWarnAboveStore(minimum: string, storeVersion: string | null): boolean` in `app-versions/app-versions-model.ts`, with `app-versions-model.test.ts` (`bun:test`):

```ts
test("warns only for a valid minimum above the live version", () => {
  expect(shouldWarnAboveStore("2.4.0", "2.2.4")).toBe(true);
  expect(shouldWarnAboveStore("2.2.4", "2.2.4")).toBe(false);
  expect(shouldWarnAboveStore("2.4", "2.2.4")).toBe(false);
  expect(shouldWarnAboveStore("2.4.0", null)).toBe(false);
});
```

- [ ] **Step 2: Run and see it fail,** then implement it and see it pass. `cd apps/admin && bun test "src/app/(portal)/settings/app-versions"`.
- [ ] **Step 3: Build the page, client and subnav tab, and add the i18n keys** in both locales.
- [ ] **Step 4: Run the checks.**
  - `bun run check-types --filter=admin` and `bun x ultracite check`. Expected: no errors.
  - `bun run dev --filter=admin`, then open `/settings/app-versions` as a global admin. Save an iOS minimum above the live version and see the warning. Save an invalid value and see the field error.
- [ ] **Step 5: Commit.** `git commit -m "feat(admin): App versions settings tab"`.

---

## Flutter (BISO-Flutter worktree)

### Task 6: Release workflow takes the version from the pubspec

**Files:**
- Modify: `.github/workflows/build.yml`

**Interfaces:**
- Produces: `build-and-deploy-android` exposes job outputs `app_version` (e.g. `2.2.9`) and `build_number` (e.g. `93`), read from `pubspec.yaml`'s `version:` line. `create-github-release` reads them through `needs.build-and-deploy-android.outputs.*`.

- [ ] **Step 1: Remove the stale values.** Delete `APP_VERSION` and `BUILD_NUMBER` from the top-level `env`.
- [ ] **Step 2: Add a step that reads the version.** Put it in `build-and-deploy-android` after checkout, with `id: version`. It writes `app_version` and `build_number` to `$GITHUB_OUTPUT` from `grep '^version:' pubspec.yaml`. It fails the job if the line doesn't match `^[0-9]+\.[0-9]+\.[0-9]+\+[0-9]+$`. Declare the job `outputs`.
- [ ] **Step 3: Use the pubspec version.** Remove `--build-name`/`--build-number` from both `flutter build` steps, so the pubspec drives them. Replace every `env.APP_VERSION` / `env.BUILD_NUMBER` with `steps.version.outputs.*` (inside the job) or `needs.build-and-deploy-android.outputs.*` (in `create-github-release`).
- [ ] **Step 4: Verify.**
  - Run the parse snippet locally against `pubspec.yaml`. Expected: `2.2.9` and `93`.
  - `grep -n 'APP_VERSION\|BUILD_NUMBER\|build-name\|build-number' .github/workflows/build.yml`. Expected: no matches.
  - If `actionlint` is installed, run `actionlint .github/workflows/build.yml` and expect it clean.
- [ ] **Step 5: Commit.** `git commit -m "ci(android): ship the pubspec version instead of a stale 2.0.1"`.

### Task 7: Config carries the version policy and where it came from

**Files:**
- Create: `lib/data/models/update_policy.dart`
- Modify: `lib/data/models/app_config.dart`
- Modify: `lib/data/services/app_config_service.dart`
- Test: `test/data/services/app_config_service_test.dart`

**Interfaces:**
- Produces:
  - `class UpdatePolicy { const UpdatePolicy({this.minimum, this.recommended}); final String? minimum; final String? recommended; static const none = UpdatePolicy(); factory UpdatePolicy.fromJson(Object? json); }`. Lenient: anything that isn't a map gives `none`, and a non-string field gives `null`. Equatable (the `equatable` package is already a dependency).
  - `enum AppConfigSource { network, cache }`
  - New `AppConfig` fields:
    - `final AppConfigSource source;` (default `AppConfigSource.network`)
    - `final UpdatePolicy iosUpdates;` and `final UpdatePolicy androidUpdates;` (default `UpdatePolicy.none`)
  - `AppConfig.fromJson(Map<String, dynamic> json, {AppConfigSource source = AppConfigSource.network})` parses `json['versions']['ios' | 'android']`.
  - `toJsonString()` stays features-only, so a cached config carries `UpdatePolicy.none` and `source: cache`.
  - `AppConfigService.getConfig()` returns `source: network` from the network and `source: cache` from `_readCache`.
  - Extend `AppConfig`'s doc comment: `source` is *where* the answer came from, not a BISO setting.

- [ ] **Step 1: Write the failing tests** in the existing file, using its `serviceReturning` / `offlineService` helpers.

```dart
test('reads the version policy for each platform from the network', () async {
  final config = await serviceReturning(http.Response(jsonEncode({
    'features': {'departures': true, 'expenses': false, 'marketplace': true},
    'versions': {
      'ios': {'minimum': '2.4.0', 'recommended': null},
      'android': {'minimum': '2.4.0', 'recommended': '2.4.1'},
    },
  }), 200)).getConfig();

  expect(config.source, AppConfigSource.network);
  expect(config.iosUpdates, const UpdatePolicy(minimum: '2.4.0'));
  expect(config.androidUpdates, const UpdatePolicy(minimum: '2.4.0', recommended: '2.4.1'));
});

test('a cached config says it came from the cache and carries no policy', () async {
  await serviceReturning(http.Response(jsonEncode({
    'features': {'departures': true, 'expenses': true, 'marketplace': true},
    'versions': {'ios': {'minimum': '9.9.9'}},
  }), 200)).getConfig();

  final config = await offlineService().getConfig();

  expect(config.source, AppConfigSource.cache);
  expect(config.iosUpdates, UpdatePolicy.none);
});

test('a malformed versions object means no policy', () async {
  final config = await serviceReturning(http.Response(jsonEncode({
    'features': {}, 'versions': {'ios': 'soon', 'android': {'minimum': 240}},
  }), 200)).getConfig();

  expect(config.iosUpdates, UpdatePolicy.none);
  expect(config.androidUpdates.minimum, isNull);
});
```

- [ ] **Step 2: Run and see it fail.** `flutter test test/data/services/app_config_service_test.dart`. Expected: FAIL to compile.
- [ ] **Step 3: Implement** the interfaces above.
- [ ] **Step 4: Run and see it pass.** Same command, plus `flutter analyze`. Expected: PASS, no issues.
- [ ] **Step 5: Commit.** `git commit -m "feat(config): carry the update policy and its source"`.

### Task 8: The update decision

**Files:**
- Create: `lib/core/utils/app_version.dart`
- Create: `lib/data/models/update_decision.dart`
- Test: `test/core/utils/app_version_test.dart` and `test/data/models/update_decision_test.dart`

**Interfaces:**
- Consumes: Task 7 (`UpdatePolicy`, `AppConfigSource`).
- Produces:
  - `class AppVersion implements Comparable<AppVersion>` with `static AppVersion? tryParse(String? value)`. Accepts exactly `major.minor.patch` digits; anything else returns null. It also implements `operator <`.
  - `enum UpdatePrompt { none, recommended, required }`
  - `class UpdateSnooze { const UpdateSnooze({required this.version, required this.dismissedAt}); final String version; final DateTime dismissedAt; }`
  - `const updateSnoozeDuration = Duration(days: 3);`
  - `UpdatePrompt decideUpdate({required String installedVersion, required UpdatePolicy policy, required AppConfigSource source, required UpdateSnooze? snooze, required DateTime now})`. The rules:
    1. `source != network` → `none`.
    2. Installed version unparseable → `none`.
    3. Below a parseable minimum → `required`.
    4. Below a parseable recommended version and not snoozed → `recommended`.
    5. Otherwise `none`.
  - "Snoozed" means `snooze.version == policy.recommended` and `now` is before `dismissedAt + updateSnoozeDuration`.

- [ ] **Step 1: Write the failing tests.**

```dart
// app_version_test.dart
test('parses major.minor.patch only', () {
  expect(AppVersion.tryParse('2.4.0'), isNotNull);
  for (final v in ['2.4', '2.4.0+93', '2.2.9-beta', '', null, 'v2.4.0']) {
    expect(AppVersion.tryParse(v), isNull, reason: '$v');
  }
});
test('compares numerically', () {
  expect(AppVersion.tryParse('2.9.0')! < AppVersion.tryParse('2.10.0')!, isTrue);
});

// update_decision_test.dart
final now = DateTime.utc(2026, 11, 1, 12);
UpdatePrompt decide(String installed, UpdatePolicy policy,
        {AppConfigSource source = AppConfigSource.network, UpdateSnooze? snooze}) =>
    decideUpdate(installedVersion: installed, policy: policy, source: source, snooze: snooze, now: now);

test('below the minimum is required', () {
  expect(decide('2.3.2', const UpdatePolicy(minimum: '2.4.0')), UpdatePrompt.required);
});
test('at the minimum is fine', () {
  expect(decide('2.4.0', const UpdatePolicy(minimum: '2.4.0')), UpdatePrompt.none);
});
test('required wins over a snooze', () {
  expect(decide('2.3.2', const UpdatePolicy(minimum: '2.4.0', recommended: '2.4.0'),
      snooze: UpdateSnooze(version: '2.4.0', dismissedAt: now)), UpdatePrompt.required);
});
test('below the recommended version is recommended', () {
  expect(decide('2.4.0', const UpdatePolicy(recommended: '2.4.1')), UpdatePrompt.recommended);
});
test('a snooze hides the same version for 3 days, then expires', () {
  const policy = UpdatePolicy(recommended: '2.4.1');
  expect(decide('2.4.0', policy,
      snooze: UpdateSnooze(version: '2.4.1', dismissedAt: now.subtract(const Duration(days: 2)))), UpdatePrompt.none);
  expect(decide('2.4.0', policy,
      snooze: UpdateSnooze(version: '2.4.1', dismissedAt: now.subtract(const Duration(days: 3, minutes: 1)))), UpdatePrompt.recommended);
});
test('a snooze for an older recommendation does not hide a newer one', () {
  expect(decide('2.4.0', const UpdatePolicy(recommended: '2.4.2'),
      snooze: UpdateSnooze(version: '2.4.1', dismissedAt: now)), UpdatePrompt.recommended);
});
test('a cached answer never prompts', () {
  expect(decide('1.0.0', const UpdatePolicy(minimum: '2.4.0'), source: AppConfigSource.cache), UpdatePrompt.none);
});
test('an unparseable installed or server version never prompts', () {
  expect(decide('2.2.9-beta', const UpdatePolicy(minimum: '9.0.0')), UpdatePrompt.none);
  expect(decide('', const UpdatePolicy(minimum: '9.0.0')), UpdatePrompt.none);
  expect(decide('2.2.9', const UpdatePolicy(minimum: 'soon')), UpdatePrompt.none);
});
```

- [ ] **Step 2: Run and see it fail.** `flutter test test/core/utils/app_version_test.dart test/data/models/update_decision_test.dart`. Expected: FAIL to compile.
- [ ] **Step 3: Implement** both files.
- [ ] **Step 4: Run and see it pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(update): decide between no prompt, a nudge and a block"`.

### Task 9: Update state across the session

**Files:**
- Create: `lib/data/services/update_snooze_store.dart`
- Create: `lib/providers/config/update_prompt_provider.dart`
- Modify: `lib/providers/config/app_config_provider.dart`. Make `_appConfigServiceProvider` public as `appConfigServiceProvider`, so tests can override it.
- Test: `test/providers/update_prompt_provider_test.dart`

**Interfaces:**
- Consumes: Task 7 (`AppConfig`, `AppConfigSource`, `appConfigProvider`) and Task 8 (`decideUpdate`, `UpdatePrompt`, `UpdateSnooze`).
- Produces:
  - `class UpdateSnoozeStore { Future<UpdateSnooze?> read(); Future<void> write(UpdateSnooze snooze); }`. Uses the `shared_preferences` keys `update_snooze_version` and `update_snooze_at` (epoch ms).
  - `final updateSnoozeStoreProvider = Provider<UpdateSnoozeStore>(...)`
  - `final installedVersionProvider = FutureProvider<String>(...)` returns `PackageInfo.fromPlatform().version`.
  - `final updatePlatformProvider = Provider<TargetPlatform?>(...)` returns `defaultTargetPlatform` when it's `iOS` or `android` and the app isn't on web (`kIsWeb`), else `null`. It's overridable in tests.
  - `final updatePromptProvider = NotifierProvider<UpdatePromptNotifier, UpdatePrompt>(...)`
    - Initial state is `none`.
    - It listens to `appConfigProvider` and recomputes only when a config with `source == network` arrives.
    - A cache answer, an error or a loading state leaves the current state untouched. That's how a block survives going offline mid-session.
    - Null platform → always `none`.
    - `Future<void> snooze()` writes `UpdateSnooze(version: <current recommended>, dismissedAt: now)` and sets the state to `none`.
  - `final appConfigResumeRefreshProvider = Provider<void>(...)`. Uses an `AppLifecycleListener` (disposed in `ref.onDispose`). On `resumed`, it calls `ref.invalidate(appConfigProvider)` only if the last network fetch was at least 1 hour ago. It tracks the time of the last `source == network` value it saw.
  - The clock is injectable: `final updateClockProvider = Provider<DateTime Function()>((_) => DateTime.now);`

- [ ] **Step 1: Write the failing tests.** Use a `ProviderContainer` with overrides of `appConfigServiceProvider` (a fake returning queued `AppConfig`s), `installedVersionProvider`, `updatePlatformProvider` and `updateClockProvider`, plus `SharedPreferences.setMockInitialValues`.

```dart
test('a fresh minimum above the installed version blocks', () async {
  // fake returns network config with androidUpdates: UpdatePolicy(minimum: '2.4.0'); installed '2.3.2'; platform android
  expect(await settle(container), UpdatePrompt.required);
});
test('a cached re-read does not lift a block', () async {
  // first network required, then container.invalidate(appConfigProvider) → fake returns source: cache, policy none
  expect(await settle(container), UpdatePrompt.required);
});
test('a fresh answer that the version is fine lifts the block', () async {
  // network required, then network UpdatePolicy.none
  expect(await settle(container), UpdatePrompt.none);
});
test('a cached answer at launch never prompts', () async {
  // first answer source: cache with minimum '9.9.9'
  expect(await settle(container), UpdatePrompt.none);
});
test('snooze hides the recommendation and is stored', () async {
  // network recommended '2.4.1', installed '2.4.0'
  await container.read(updatePromptProvider.notifier).snooze();
  expect(container.read(updatePromptProvider), UpdatePrompt.none);
  expect((await UpdateSnoozeStore().read())?.version, '2.4.1');
});
test('platforms other than iOS and Android never prompt', () async {
  // updatePlatformProvider → null, network minimum '9.9.9'
  expect(await settle(container), UpdatePrompt.none);
});
```

`settle` is a test helper. It reads the providers and pumps the event queue until `appConfigProvider` has a value.

- [ ] **Step 2: Run and see it fail.** `flutter test test/providers/update_prompt_provider_test.dart`. Expected: FAIL to compile.
- [ ] **Step 3: Implement** the interfaces above.
- [ ] **Step 4: Run and see it pass.** Same command, plus the existing `test/data/services/app_config_service_test.dart`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(update): track the update prompt across the session"`.

### Task 10: The store update action (Dart + native)

**Files:**
- Modify: `pubspec.yaml`. Add `in_app_update: ^5.0.0` (needs Dart ≥ 3.12 and Flutter ≥ 3.44; local Flutter is 3.47.2).
- Modify: `lib/core/constants/app_constants.dart`. Add `appStoreItemId = '6468173379'` and `androidPackageName = 'com.biso.no'`.
- Create: `lib/data/services/app_store_channel.dart`
- Create: `lib/data/services/store_updater.dart`
- Modify: `ios/Runner/AppDelegate.swift`. Add a `biso/app_store` channel next to `biso/wallet`, registered in `didInitializeImplicitFlutterEngine`.
- Test: `test/data/services/store_updater_test.dart` and `test/data/services/app_store_channel_test.dart`

**Interfaces:**
- Produces:
  - `AppStoreChannel` (iOS), shaped like `WalletChannel`. Constructor `const AppStoreChannel([MethodChannel channel = const MethodChannel('biso/app_store')])`. `Future<void> showProductPage(String itemId)` invokes `showProductPage` with `{'itemId': itemId}` and completes when the sheet is dismissed. It throws `PlatformException` with code `load_failed`, `no_presenter` or `busy`.
  - `abstract interface class PlayUpdates { Future<bool> immediateUpdateAvailable(); Future<void> performImmediateUpdate(); }` with `InAppUpdatePlayUpdates` wrapping `InAppUpdate.checkForUpdate()`. "Available" means `updateAvailability == UpdateAvailability.updateAvailable && immediateUpdateAllowed`.
  - `typedef UrlOpener = Future<bool> Function(Uri uri);` (defaults to `launchUrl` with `LaunchMode.externalApplication`).
  - `class StoreUpdater { StoreUpdater({required TargetPlatform platform, PlayUpdates? play, AppStoreChannel? appStore, UrlOpener? openUrl}); Future<void> startUpdate(); }`
    - **Android:** if an immediate update is available, perform it. Otherwise, or on any exception, open `market://details?id=com.biso.no`; if that returns false or throws, open `https://play.google.com/store/apps/details?id=com.biso.no`.
    - **iOS:** `showProductPage('6468173379')`. On `PlatformException` or `MissingPluginException`, open `https://apps.apple.com/app/id6468173379`.
    - It never throws to the UI.
  - `final storeUpdaterProvider = Provider<StoreUpdater>(...)` lives in the same file and uses `defaultTargetPlatform`.
- **Swift:** `handleAppStoreCall` presents `SKStoreProductViewController`. Import `StoreKit` and conform to `SKStoreProductViewControllerDelegate`.
  - Call `loadProduct(withParameters: [SKStoreProductParameterITunesItemIdentifier: NSNumber(value: Int(itemId)!)])`. Validate `itemId`; if it isn't numeric, return `FlutterError(code: "load_failed")`.
  - On load error, return `FlutterError(code: "load_failed")`.
  - Present it from the top-most view controller. If there's none, return `no_presenter`.
  - Complete the result with `nil` in `productViewControllerDidFinish`.
  - A second call while one is pending returns `busy`. Follow the wallet handler's pending-result pattern.

- [ ] **Step 1: Write the failing tests.**

```dart
// store_updater_test.dart: fakes for PlayUpdates and a recording UrlOpener
test('Android runs Play immediate update when one is available', () async {
  final play = FakePlay(available: true);
  await StoreUpdater(platform: TargetPlatform.android, play: play, openUrl: opener).startUpdate();
  expect(play.performed, isTrue);
  expect(opened, isEmpty);
});
test('Android falls back to the Play Store listing when Play has no update', () async {
  await StoreUpdater(platform: TargetPlatform.android, play: FakePlay(available: false), openUrl: opener).startUpdate();
  expect(opened.first, Uri.parse('market://details?id=com.biso.no'));
});
test('Android falls back to the https listing when market: cannot open', () async {
  // opener returns false for market:
  expect(opened.last, Uri.parse('https://play.google.com/store/apps/details?id=com.biso.no'));
});
test('Android falls back when Play throws', () async {
  // FakePlay(available: true, throwOnPerform: true)
  expect(opened.first.scheme, 'market');
});
test('iOS opens the App Store sheet for item 6468173379', () async {
  // AppStoreChannel over a MethodChannel with a mock handler via
  // TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler
  expect(calls.single.arguments, {'itemId': '6468173379'});
  expect(opened, isEmpty);
});
test('iOS falls back to the App Store URL when the sheet fails to load', () async {
  // mock handler throws PlatformException(code: 'load_failed')
  expect(opened.single, Uri.parse('https://apps.apple.com/app/id6468173379'));
});
```

- [ ] **Step 2: Run and see it fail.** `flutter test test/data/services/store_updater_test.dart test/data/services/app_store_channel_test.dart`. Expected: FAIL to compile.
- [ ] **Step 3: Add the dependency** with `flutter pub add in_app_update:^5.0.0`. Then implement the Dart files and the Swift channel.
- [ ] **Step 4: Run and see it pass.** Same tests, plus `flutter analyze`. Expected: PASS, no issues.
- [ ] **Step 5: Check the iOS build.** `flutter build ios --no-codesign --debug`. Expected: it builds. Android is checked by CI's `flutter build apk --debug` on the PR. If `in_app_update` fails against Gradle 8.14.3 / AGP 8.11.1 / Kotlin 2.2.20, replace `InAppUpdatePlayUpdates` with a Kotlin `biso/play_updates` channel in `MainActivity.kt` using `com.google.android.play:app-update`. Keep the `PlayUpdates` interface.
- [ ] **Step 6: Commit.** `git commit -m "feat(update): update in place through Play and the App Store sheet"`.

### Task 11: The prompts on screen

**Files:**
- Create: `lib/presentation/widgets/update_required_overlay.dart`
- Create: `lib/presentation/widgets/update_recommended_dialog.dart`
- Modify: `lib/main.dart`
  - Watch `appConfigResumeRefreshProvider`.
  - Add `builder:` to `MaterialApp.router`.
  - Gate the topics prompt.
  - Show the recommended popup.
- Modify: `lib/presentation/widgets/notification_topics_prompt.dart`. Add a `bool get topicsPromptShownThisSession` (set when the sheet actually opens) and an early return while the update popup is showing.
- Modify: `lib/generated/l10n/app_en.arb` and `lib/generated/l10n/app_no.arb`, then run `flutter gen-l10n`.
- Test: `test/presentation/widgets/update_prompts_test.dart`

**Interfaces:**
- Consumes: Task 9 (`updatePromptProvider`, `UpdatePromptNotifier.snooze()`, `appConfigResumeRefreshProvider`) and Task 10 (`storeUpdaterProvider`, `StoreUpdater.startUpdate()`).
- Produces:
  - `class UpdateRequiredOverlay extends ConsumerWidget { const UpdateRequiredOverlay({super.key, required this.child}); }` returns a `Stack` with `child` first. When `updatePromptProvider == UpdatePrompt.required`, a full-screen layer sits on top:
    - `PremiumTheme` styling, the BISO logo, title, body and an *Update* button that calls `startUpdate()`;
    - no close control;
    - `PopScope(canPop: false)`;
    - a `ModalBarrier`-style absorb, so nothing underneath can be touched;
    - `Semantics(scopesRoute: true, explicitChildNodes: true)`.
  - `Future<void> maybeShowUpdateRecommended(BuildContext context, WidgetRef ref)`. Shows the dialog at most once per session; guard it the way `maybeShowTopicsPrompt` uses `_promptInFlight`. It shows only if `updatePromptProvider == recommended`, the topics prompt hasn't been shown this session and isn't in flight, and the overlay isn't up. *Update* closes the dialog and calls `startUpdate()`. *Not now* closes it and calls `snooze()`.
  - `bool get updateRecommendedShowing` is read by the topics prompt.
  - main.dart:
    - `builder: (context, child) => UpdateRequiredOverlay(child: child ?? const SizedBox.shrink())`.
    - `promptEligible` additionally requires `updatePrompt != UpdatePrompt.required`.
    - The recommended popup runs in the same post-frame callback, *after* `maybeShowTopicsPrompt` is invoked, using `navigatorKey.currentContext`.
  - l10n keys (en):
    - `updateRequiredTitle`: "Time to update"
    - `updateRequiredBody`: "This version of the BISO app is no longer supported. Update to keep using the app."
    - `updateRecommendedTitle`: "A new version is available"
    - `updateRecommendedBody`: "Update the BISO app to get the latest improvements."
    - `updateButton`: "Update"
    - `updateNotNow`: "Not now"
  - l10n keys (no):
    - `updateRequiredTitle`: "På tide å oppdatere"
    - `updateRequiredBody`: "Denne versjonen av BISO-appen støttes ikke lenger. Oppdater for å fortsette å bruke appen."
    - `updateRecommendedTitle`: "En ny versjon er tilgjengelig"
    - `updateRecommendedBody`: "Oppdater BISO-appen for å få de siste forbedringene."
    - `updateButton`: "Oppdater"
    - `updateNotNow`: "Ikke nå"

- [ ] **Step 1: Write the failing widget tests.** Override `updatePromptProvider` with a notifier fixed to a state, and `storeUpdaterProvider` with a recording fake.

```dart
testWidgets('the required overlay covers the app but keeps it mounted', (tester) async {
  await tester.pumpWidget(app(prompt: UpdatePrompt.required, child: const Text('home')));
  expect(find.text('Time to update'), findsOneWidget);
  expect(find.text('home', skipOffstage: false), findsOneWidget); // still mounted underneath
  await tester.tap(find.text('home'), warnIfMissed: false);
  expect(homeTapped, isFalse);
});
testWidgets('back does not dismiss the required overlay', (tester) async {
  await tester.pumpWidget(app(prompt: UpdatePrompt.required, child: const Text('home')));
  await tester.binding.handlePopRoute();
  await tester.pump();
  expect(find.text('Time to update'), findsOneWidget);
});
testWidgets('Update starts the store update', (tester) async {
  await tester.pumpWidget(app(prompt: UpdatePrompt.required, child: const Text('home')));
  await tester.tap(find.text('Update'));
  expect(updater.started, 1);
});
testWidgets('no overlay when no update is required', (tester) async {
  await tester.pumpWidget(app(prompt: UpdatePrompt.none, child: const Text('home')));
  expect(find.text('Time to update'), findsNothing);
});
testWidgets('Not now snoozes the recommendation', (tester) async {
  // pump with prompt recommended, call maybeShowUpdateRecommended, tap 'Not now'
  expect(notifier.snoozed, isTrue);
  expect(find.text('A new version is available'), findsNothing);
});
testWidgets('the recommendation stays away after the topics prompt was shown', (tester) async {
  // mark topics prompt shown this session, call maybeShowUpdateRecommended
  expect(find.text('A new version is available'), findsNothing);
});
```

- [ ] **Step 2: Run and see it fail.** `flutter test test/presentation/widgets/update_prompts_test.dart`. Expected: FAIL to compile.
- [ ] **Step 3: Implement.** Add the l10n strings, run `flutter gen-l10n`, then build both widgets and wire them into `main.dart` and the topics prompt.
- [ ] **Step 4: Run the whole suite.** `flutter test` and `flutter analyze`. Expected: all pass, no issues. Existing topics prompt tests must still pass.
- [ ] **Step 5: Commit.** `git commit -m "feat(update): required screen and recommended popup"`.

---

## Finishing

- [ ] **Sites:** `bun run check-types`, `bun x ultracite check`, `cd apps/api && bun run test`, `cd apps/admin && bun test "src/app/(portal)/settings"`, `cd packages/shared && bun run test`. All must pass. Then open a PR from `feat/app-update-prompt` to `main`.
- [ ] **Flutter:** `flutter test`, `flutter analyze`. Open a PR from `feat/app-update-prompt` to `main` and check that CI's `test-build` (including `flutter build apk --debug`) is green.
- [ ] **Hand to the user to test by hand:**
  - Push `app_versions` and regenerate types.
  - Android: through Play internal app sharing or the internal track, set the Android minimum above the installed version and confirm Play's update screen appears in the app.
  - iOS: on a real iPhone, confirm the App Store sheet opens over the app.
  - Remember that only builds containing this feature can ever be prompted.
