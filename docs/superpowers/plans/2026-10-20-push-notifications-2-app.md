# Push Notifications — Plan 2: App (BISO-Flutter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app subscribes each phone to exactly one language's channels, and that language follows the phone unless the student picks one. It saves that language to the profile. Tapping a notification opens the exact event, news article, job or announcement. News exists in the app. The notification screen becomes the approved "Smart inbox", and Android shows notifications while the app is open.

**Architecture:** All work is in `/Users/markus/Documents/dev/BISO-Flutter` on a new branch `feat/push-notifications` cut from `main` (`0f41cee`). The only exception is the last task, which is in BISO-Sites. The topic taxonomy gains a language dimension that mirrors `@repo/shared/utils/notification-topics` from Plan 1. Reconcile takes the effective language from the existing `localeProvider`, now device-aware. Events and news get full detail screens with id-or-slug lookups, following the jobs pattern (`JobService.getJob` / `jobDetailProvider` / `JobDetailScreen`). The inbox reads Plan 1's new `announcements` columns. Android uses `flutter_local_notifications` for foreground messages.

**Tech Stack:** Flutter, Riverpod 2 (StateNotifier style), go_router 16, appwrite 26 (TablesDB), firebase_messaging 16, flutter_html 3 (`PremiumHtmlRenderer`), ARB l10n (`AppLocalizations`).

**Spec:** `docs/superpowers/specs/2026-10-20-push-notifications-design.md` (D1, D2, D3, D5 members-only, D10, D11, D13). Plan 1 (merged as BISO-Sites PR #101) supplies the server side.

**Plan 2 of 5.** Before starting, read `BISO-Flutter/CLAUDE.md` (Design system section, Riverpod/go_router conventions, "server writes go through apps/api").

## Global Constraints

- Branch: BISO-Flutter `feat/push-notifications` from `main`. Commits use conventional style (`feat(notifications): …`).
- Verification for every task: `flutter analyze` adds no new issues, and `flutter test <touched test files>` passes. Run the full `flutter test` once at the end of each task.
- UI: screens build on `BisoPage`. Use the widgets in `lib/presentation/widgets/biso/biso.dart`, colours from `BisoPalette.of(context)` and `BisoAccent`, and `CupertinoIcons`. `test/presentation/design_rules_test.dart` must stay green, and new screens are added to its migrated list.
- Copy: no hard-coded user-facing English in new or changed widgets. Add every string to both `lib/generated/l10n/app_en.arb` and `app_no.arb`, then read it via `AppLocalizations.of(context)!`. Fixed copy for this plan is in the table below.
- Topic IDs, exactly these 50 and nothing else:
  - `general_{no,en}`
  - `general_{oslo,bergen,trondheim,stavanger}_{no,en}`
  - `{news,events,jobs,shop}_{oslo,bergen,trondheim,stavanger,national}_{no,en}`

  The literal list must equal the one in BISO-Sites `packages/shared/utils/notification-topics.test.ts`.
- A phone subscribes to:
  - `general_{lang}`
  - `general_{ownSlug}_{lang}`, unless the slug is `national`
  - for each enabled topic, `{topic}_{ownSlug}_{lang}` and `{topic}_national_{lang}`
  
  It never subscribes to both languages.
- Language: an explicit choice (SharedPreferences key `language`) wins. Otherwise use the device's primary locale: language code `nb`, `nn` or `no` gives `no`, anything else gives `en`.
- Language is saved to the server with `PUT /api/profile` `{"locale": "no"|"en"}` (`ProfileApiClient.upsert`), and only when the signed-in user already has a profile row (`authState.hasProfile`). The call must never create a profile row.
- Push data contract (Plan 1). All values are strings:
  - `type` (`"announcement"`), `announcement_id`, `category` (general|trip|urgent|event|news|job), `content_type` (event|news|job|""), `content_id`
  - `deep_link`: `biso://event?id=…` | `biso://news?id=…` | `biso://job?id=…` | `biso://announcement?id=…`
  
  The app routes on `deep_link` first.
- Universal links (already claimed under `/app/*`): `https://biso.no/app/events/<idOrSlug>` and `https://biso.no/app/news/<idOrSlug>`.
- `announcements` columns the app reads:
  - `$id, $createdAt, title_en, title_no, body_en, body_no, category, event_id, deep_link, sent_at, audience_type, audience_value`
  - new: `source, content_type, content_id, content_ids, items, image`
  - Never select `data` (it breaks `Row.fromMap`).
- `items` column contract (written by Plan 3; the app must tolerate null, empty or invalid values): a JSON array string. Each element is `{"type":"event"|"news"|"job","id":string,"title_en":string|null,"title_no":string|null,"image":string|null (URL or media file id),"date":ISO-8601|null,"campus_id":string|null}`. `image` (column) is the thumbnail for single-item rows.
- Broadcast visibility: `audience_value` is `general` or `general_{slug}`. Legacy rows with a null value derive it from `campus_id` (`1`–`4` give `general_{slug}`, anything else gives `general`). A row is visible when it is `general` or `general_{ownSlug}`.
- Inbox shows only rows whose sent time is at or after `authState.user.createdAt` (no filter when that is null).
- Urgent (`category == "urgent"`) unread rows sent in the last 3 days are pinned above everything else.
- Members-only content that the student cannot read shows a "Members only" state with "Become a member" (to `/profile/membership`), never an error.

Fixed copy (EN / NO):

| Key purpose | English | Norwegian |
|---|---|---|
| Inbox title | Notifications | Varsler |
| Filter chips | All · Events · News · Jobs · From BISO | Alle · Arrangementer · Nyheter · Stillinger · Fra BISO |
| Day groups | Today · Yesterday · This week · Earlier | I dag · I går · Denne uken · Tidligere |
| Burst "see all" | See all {count} | Se alle {count} |
| Burst subtitle | {count} new | {count} nye |
| News (Explore entry, list title) | News | Nyheter |
| Home section | Latest news | Siste nytt |
| News JSON fallback button | Read on biso.no | Les på biso.no |
| Members-only title | Members only | Kun for medlemmer |
| Members-only message | This is for BISO members. | Dette er for BISO-medlemmer. |
| Become a member | Become a member | Bli medlem |
| Event not found | This event isn't available | Dette arrangementet er ikke tilgjengelig |
| News not found | This article isn't available | Denne artikkelen er ikke tilgjengelig |

## Review Focus

- A Norwegian phone reports `nb_NO`, not `no`. It must get Norwegian, not English. Pinned in Task 2.
- Switching language must replace every `_en` subscription with `_no` in one diff, so the phone is never left on both languages. Pinned in Task 3.
- A notification for a past event, or one outside the loaded list page, must still open that event (no upcoming-only filter on the lookup). Pinned in Task 5.
- A push that arrives while the app is open on iOS must not be shown twice: iOS already presents it, and only Android uses the local notification. Pinned in Task 10.
- A Bergen student must not see Oslo's "Everyone at Oslo" message, including old rows that only have `campus_id`. Pinned in Task 8.

---

### Task 1: Topic taxonomy with languages

**Files:**
- Modify: `lib/core/constants/notification_topics.dart`
- Modify: `test/core/constants/notification_topics_test.dart`

**Interfaces:**
- Produces:
  - `const List<String> kPushLocales = ['no', 'en'];`
  - `String pushLocaleFor(String languageCode)`: `nb`/`nn`/`no` (any case) give `'no'`, else `'en'`
  - `Set<String> appwriteTopicIdsFor({required Map<String, bool> intent, required String? campusId, required String locale})`. `locale` is `'no'` or `'en'`.
  - `List<String> allPushTopicIds()`: the 50 ids

- [ ] **Step 1: Write the failing tests.** Update the existing `appwriteTopicIdsFor` tests to pass `locale`, then add:

```dart
test('a Bergen student following events gets Bergen and national, in one language', () {
  expect(
    appwriteTopicIdsFor(intent: {'events': true}, campusId: '2', locale: 'no'),
    {'general_no', 'general_bergen_no', 'events_bergen_no', 'events_national_no'},
  );
});
test('a National or campus-less student has no campus everyone channel', () {
  expect(appwriteTopicIdsFor(intent: const {}, campusId: '5', locale: 'en'), {'general_en'});
  expect(appwriteTopicIdsFor(intent: const {}, campusId: null, locale: 'en'), {'general_en'});
});
test('never mixes languages', () {
  final ids = appwriteTopicIdsFor(intent: kDefaultTopicIntent, campusId: '1', locale: 'en');
  expect(ids.every((id) => id.endsWith('_en')), isTrue);
});
test('pushLocaleFor maps Norwegian variants', () {
  for (final c in ['no', 'nb', 'nn', 'NB']) expect(pushLocaleFor(c), 'no');
  for (final c in ['en', 'sv', 'de', '']) expect(pushLocaleFor(c), 'en');
});
test('allPushTopicIds matches the server list exactly', () {
  expect([...allPushTopicIds()]..sort(), <String>[/* the 50 ids, sorted — copy the literal from BISO-Sites packages/shared/utils/notification-topics.test.ts */]);
});
```

- [ ] **Step 2: Run to verify they fail.** Run `flutter test test/core/constants/notification_topics_test.dart`. Expected: FAIL (the `locale` parameter and the new functions don't exist yet).

- [ ] **Step 3: Implement.** Update the library doc to name the language suffix. Callers of `appwriteTopicIdsFor` will not compile until Task 3. In this task, update the single caller in `notification_service.dart` (~line 1086) to pass `locale: 'en'` temporarily, with a `// Task 3 wires the real language` comment that Task 3 removes.

- [ ] **Step 4: Run.** `flutter test test/core/constants/notification_topics_test.dart test/data/services/` passes. `flutter analyze` is clean.

- [ ] **Step 5: Commit.** `feat(notifications): language-suffixed topic ids`

---

### Task 2: Language follows the device unless chosen

**Files:**
- Modify: `lib/providers/ui/locale_provider.dart`
- Create: `test/providers/ui/locale_provider_test.dart`

**Interfaces:**
- Produces:
  - `String appLanguageForDevice(Locale deviceLocale)` (top-level): `'no'` for `nb`/`nn`/`no`, else `'en'`
  - `LocaleNotifier({Locale Function()? deviceLocale, Future<SharedPreferences> Function()? prefs})`. The seams default to `PlatformDispatcher.instance.locale` and `SharedPreferences.getInstance`.
  - `bool get isExplicit`: true when the user has chosen a language
  - `void onDeviceLocaleChanged()`: re-resolves when not explicit
  - Existing `setLocale(String)` marks the choice explicit (writes key `language`).
  - `localeProvider` unchanged (`StateNotifierProvider<LocaleNotifier, Locale>`).

- [ ] **Step 1: Write the failing tests.** The tests use the seams, with no real platform.

```dart
test('a Bokmål phone gets Norwegian', () async { /* deviceLocale nb_NO, no pref → state.languageCode == 'no', isExplicit false */ });
test('an English or Swedish phone gets English', () async { /* en_GB → 'en'; sv_SE → 'en' */ });
test('an explicit choice wins over the phone', () async { /* pref language=en, device nb_NO → 'en', isExplicit true */ });
test('setLocale makes the choice explicit and persists it', () async { /* setLocale('no') → pref 'language' == 'no', isExplicit true */ });
test('follows the phone when it changes, until a choice is made', () async { /* device en → 'en'; device becomes nb; onDeviceLocaleChanged() → 'no'; after setLocale('en'), device nn + onDeviceLocaleChanged() → stays 'en' */ });
```

- [ ] **Step 2: Run to verify they fail.** Run `flutter test test/providers/ui/locale_provider_test.dart`. Expected: FAIL.

- [ ] **Step 3: Implement.** The notifier registers a `WidgetsBindingObserver` whose `didChangeLocales` calls `onDeviceLocaleChanged()`, and removes it in `dispose`. Guard registration so tests that never touch `WidgetsBinding` still work (`WidgetsFlutterBinding.ensureInitialized()` in tests is fine). Keep `Locale('no')`, not `nb`, as the app locale, because `supportedLocales` is `[en, no]`.

- [ ] **Step 4: Run** the new test plus `flutter test test/presentation` (screens read `localeProvider`). Expected: PASS.

- [ ] **Step 5: Commit.** `feat(i18n): follow the phone's language until the student picks one`

---

### Task 3: Reconcile subscribes to the effective language

**Files:**
- Modify: `lib/data/services/notification_service.dart` (`reconcile` ~753, `_reconcileNow` ~974, `_reconcilePermitted` ~1019 desired set ~1086, `requestPermission` ~406, `reconcileIfPermissionNewlyGranted`, token-refresh reconcile ~310)
- Modify: `lib/providers/notification/notification_provider.dart` (`topicReconcileProvider`, `TopicIntentNotifier._commit`, `notificationPermissionResumeProvider`)
- Modify: `test/data/services/notification_service_reconcile_test.dart`, `test/providers/notification/notification_provider_test.dart`

**Interfaces:**
- Consumes: Task 1's `appwriteTopicIdsFor(..., locale:)` and `pushLocaleFor`, plus Task 2's `localeProvider`.
- Produces:
  - `Future<ReconcileOutcome> reconcile({required String? campusId, required String locale})`. `locale` is an app language code and is mapped through `pushLocaleFor`. The service caches `_lastLocale` next to `_lastCampusId` (default `'en'`) for internal re-runs (`requestPermission`, token refresh).
  - `reconcileIfPermissionNewlyGranted({required String? campusId, required String locale})`
  - `topicReconcileProvider` also watches `localeProvider` (`.languageCode`).

- [ ] **Step 1: Write the failing tests** in `notification_service_reconcile_test.dart`, using the existing fake account/messaging seam:

```dart
test('switching language moves every subscription to the other language in one run', () async {
  // device subscribed (store) to general_en, general_oslo_en, events_oslo_en, events_national_en
  // reconcile(campusId: '1', locale: 'no') → createSubscriber for the four _no ids,
  // deleteSubscriber for the four _en ids; store ends with only _no ids
});
test('reconcile maps a Bokmål language code to the Norwegian channels', () async {
  // reconcile(campusId: '2', locale: 'nb') → desired ids end with _no
});
```

In `notification_provider_test.dart`, add: `'changing the app language re-runs reconcile with the new language'`. When the locale override changes from en to no, the fake service records a `reconcile(locale: 'no')` call.

- [ ] **Step 2: Run to verify they fail.** Run `flutter test test/data/services/notification_service_reconcile_test.dart test/providers/notification/notification_provider_test.dart`. Expected: FAIL.

- [ ] **Step 3: Implement.** Remove Task 1's temporary `'en'` and its comment. Update every call site of `reconcile(` and `reconcileIfPermissionNewlyGranted(` (grep `lib/`).

- [ ] **Step 4: Run.** The full `flutter test test/data/services test/providers` passes and `flutter analyze` is clean.

- [ ] **Step 5: Commit.** `feat(notifications): subscribe to the app language's channels`

---

### Task 4: Save the push language to the profile

**Files:**
- Create: `lib/providers/notification/push_language_sync_provider.dart`
- Modify: `lib/main.dart` (watch the new provider next to `topicReconcileProvider`, ~line 173)
- Create: `test/providers/notification/push_language_sync_provider_test.dart`

**Interfaces:**
- Consumes: `ProfileApiClient.upsert(Map<String, dynamic>)` (`lib/data/services/profile_api_client.dart`), `authStateProvider` (`user?.id`, `hasProfile`, `isAuthenticated`), `localeProvider`, `pushLocaleFor`.
- Produces:
  - `final profileApiClientProvider = Provider<ProfileApiClient>((ref) => ProfileApiClient());`. Reuse it if one already exists.
  - `final pushLanguageSyncProvider = FutureProvider<void>(...)`. When authenticated and `hasProfile`, it upserts `{'locale': pushLocaleFor(languageCode)}` unless SharedPreferences key `push_language_synced_<userId>` already equals that value. It writes the key only after a successful upsert. Errors are logged and swallowed, and the next app start or language change retries.

- [ ] **Step 1: Write the failing tests** (a fake `ProfileApiClient` and `SharedPreferences.setMockInitialValues`):

```dart
test('saves the language once per user and language', ...);              // two reads → one upsert({'locale':'no'})
test('saves again after the language changes', ...);                     // no → en → second upsert({'locale':'en'})
test('never writes for a user without a profile row', ...);             // hasProfile false → no upsert
test('retries after a failed save', ...);                                 // first upsert throws → key not written → next run upserts
test('saves a Bokmål app language as no', ...);                          // locale nb → {'locale':'no'}
```

- [ ] **Step 2: Run to verify they fail.** Run `flutter test test/providers/notification/push_language_sync_provider_test.dart`.

- [ ] **Step 3: Implement**, and watch it in `main.dart`.

- [ ] **Step 4: Run.** The test passes and `flutter analyze` is clean.

- [ ] **Step 5: Commit.** `feat(notifications): tell the server which language to push in`

---

### Task 5: Events get their own screen

**Files:**
- Modify: `lib/data/services/event_service.dart` (add lookup)
- Create: `lib/providers/events/events_provider.dart` (`eventServiceProvider` moves here from `events_screen.dart`, plus `eventDetailProvider`)
- Create: `lib/presentation/widgets/event/event_detail_body.dart`. This extracts the content of `_EventDetailSheet` and its private helpers (`_EventLifecycle`, `_lifecycleOf`, `_lifecycleLabel`, `_statusColor`, `_priceLabel`, `_Chip`, `_ticketUri`, `_TicketButton`) from `events_screen.dart`.
- Create: `lib/presentation/screens/events/event_detail_screen.dart`
- Create: `lib/presentation/widgets/members_only_state.dart` (shared with Task 7)
- Modify: `lib/presentation/screens/explore/events_screen.dart` (cards navigate; delete the sheet), `lib/presentation/widgets/home/discovery_sections.dart:38` (carousel opens the tapped event), `lib/main.dart` (route), `lib/data/services/deep_link_service.dart` (`eventRouteFor`, `_handleEventDeepLink`, universal `events` case)
- Tests:
  - `test/data/services/event_service_query_test.dart` (add group)
  - `test/data/services/deep_link_routes_test.dart` (create, or extend the existing `jobRouteFor` test file if there is one)
  - `test/presentation/screens/events/event_detail_screen_test.dart`

**Interfaces:**
- Produces:
  - `static List<String> EventService.buildEventLookupQueries(String idOrSlug)`: `status == published`, `Query.or([Query.equal(r'$id', key), Query.equal('slug', key)])`, `Query.select(['*','translation_refs.*'])`, `Query.limit(1)`. No date window. Mirror `JobService.buildJobLookupQueries`.
  - `Future<EventModel?> EventService.getEvent(String idOrSlug, {String locale = 'no'})`
  - `final eventDetailProvider = FutureProvider.autoDispose.family<EventModel?, String>` (watches `localeProvider`)
  - `class EventDetailBody extends ConsumerWidget { const EventDetailBody({super.key, required this.event}); }`, which renders the same sections as the old sheet, localized. The date is formatted with the app locale, and 'Description' and 'Organized by …' come from l10n.
  - `class EventDetailScreen extends ConsumerWidget { const EventDetailScreen({super.key, required this.idOrSlug}); }`, built on `BisoPage(largeTitle:false, leading: BisoBackButton(... fallbackRoute: '/explore/events'))`. It shows the hero image when `event.images` is non-empty. Its states follow `JobDetailScreen` (loading skeleton, error retry). Not-found shows `MembersOnlyState` when `!hasValidMembershipProvider`, otherwise a `BisoEmptyState` "This event isn't available".
  - `class MembersOnlyState extends StatelessWidget { const MembersOnlyState({super.key, this.title}); }`. It shows the fixed copy and a `FilledButton` that goes to `/profile/membership`.
  - Route: child of `/explore/events`, `GoRoute(path: ':eventId', name: 'event-detail', builder: … EventDetailScreen(idOrSlug: state.pathParameters['eventId']!))`.
  - `String eventRouteFor(String? idOrSlug)` (`@visibleForTesting`, beside `jobRouteFor`): `'/explore/events'` when empty, else `'/explore/events/${Uri.encodeComponent(key)}'`.

- [ ] **Step 1: Write the failing tests:**
  - `buildEventLookupQueries`: matches by id or slug, published only, selects translations, has **no** `end_date`/`start_date` filter ("opens a past event too"), and limit is 1.
  - `eventRouteFor`: `null`/`''`/`'  '` give `/explore/events`, `'abc'` gives `/explore/events/abc`, and `'a b'` is encoded.
  - Widget tests (harness `test/helpers/biso_screen_harness.dart`, `eventDetailProvider` overridden):
    - shows the title and localized 'Description' heading for an event
    - a missing event for a non-member shows "Members only" and "Become a member"
    - a missing event for a member shows "This event isn't available"
    - builds on `BisoPage`

- [ ] **Step 2: Run to verify they fail.** Run `flutter test test/data/services/event_service_query_test.dart test/data/services/deep_link_routes_test.dart test/presentation/screens/events/`.

- [ ] **Step 3: Implement.**
  - `biso://event?id=X` and `https://biso.no/app/events/X` go to `eventRouteFor(X)`.
  - Event cards in `EventsScreen` and `BisoEventCarousel` call `context.push(eventRouteFor(event.id))`.
  - The sheet and `_showEventDetails` are deleted.
  - Add the new screen to the design-rules test's migrated list.

- [ ] **Step 4: Run** all tests listed above, the existing events and home tests, and `flutter analyze`.

- [ ] **Step 5: Commit.** `feat(events): event detail screen opened by notifications and links`

---

### Task 6: News data (model, service, providers)

**Files:**
- Create: `lib/data/models/news_model.dart`, `lib/data/services/news_service.dart`, `lib/providers/news/news_provider.dart`
- Tests: `test/data/models/news_model_test.dart`, `test/data/services/news_service_query_test.dart`

**Interfaces:**
- Produces:
  - `class NewsModel extends Equatable`. Fields: `String id`, `String? slug`, `String title`, `String body` (HTML or ''), `String? shortDescription`, `String? image` (URL via `appwriteImageUrl`), `String campusId`, `String? author`, `DateTime publishedAt` (`$createdAt`), `bool sticky`, and `bool get hasRenderableBody`, which is false when the body is empty or its trimmed value starts with `[` or `{` (Plate JSON).
  - `factory NewsModel.fromAppwriteRow(Map<String, dynamic> row, {String locale = 'no'})` uses `ContentTranslation.listFrom` and `resolveLocalizedContent`, like `EventModel`.
  - `NewsService` (`tableId: 'news'`):
    - `static List<String> buildNewsListQueries({String? campusId, int limit = 20, int offset = 0})`: published; when `campusId` is set and not `'5'`, `Query.equal('campus_id', [campusId, '5'])`, so National rides along as on the web; `'5'` gives `['5']`; select `*` + translations; `orderDesc($createdAt)`; limit and offset.
    - `static List<String> buildNewsLookupQueries(String idOrSlug)` (same shape as events)
    - `Future<List<NewsModel>> listNews({String? campusId, String locale = 'no', int limit = 20, int offset = 0})`
    - `Future<NewsModel?> getNews(String idOrSlug, {String locale = 'no'})`
  - Providers:
    - `newsServiceProvider`
    - `latestNewsProvider = FutureProvider.autoDispose.family<List<NewsModel>, String campusId>` (limit 6)
    - `newsDetailProvider = FutureProvider.autoDispose.family<NewsModel?, String>`
    
    Both watch `localeProvider`.

- [ ] **Step 1: Write the failing tests:**
  - Model: resolves the requested language with fallback; image from a bare file id; `hasRenderableBody` is false for `'[{"type":"p"}]'` and `'{"a":1}'`, and true for `'<p>Hi</p>'`; `publishedAt` comes from `$createdAt`.
  - Queries: published filter; a Bergen list includes National (`campus_id` in `['2','5']`); a National list is `['5']`; ordered newest first; lookup by id or slug with limit 1.

- [ ] **Step 2: Run to verify they fail.** Run `flutter test test/data/models/news_model_test.dart test/data/services/news_service_query_test.dart`.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run.** Tests pass and `flutter analyze` is clean.

- [ ] **Step 5: Commit.** `feat(news): news model, service and providers`

---

### Task 7: News screens, Explore entry, Home section, links

**Files:**
- Create: `lib/presentation/screens/news/news_list_screen.dart`, `lib/presentation/screens/news/news_detail_screen.dart`, `lib/presentation/widgets/home/news_carousel.dart`
- Modify:
  - `lib/main.dart` (routes)
  - `lib/presentation/screens/explore/explore_screen.dart` (entry after Events: `CupertinoIcons.news`, `BisoAccent.violet`)
  - `lib/presentation/screens/home/premium_home_screen.dart` ("Latest news" section after the events section, via `_buildPremiumContentSection<NewsModel>` + `latestNewsProvider`)
  - `lib/data/services/deep_link_service.dart` (`news` host + universal `news` case)
  - ARB files
- Tests: `test/presentation/screens/news/news_screens_test.dart`, `deep_link_routes_test.dart` (extend)

**Interfaces:**
- Consumes: Task 6 providers, plus Task 5's `MembersOnlyState`.
- Produces:
  - Routes: `GoRoute(path: '/news', name: 'news', builder: NewsListScreen)` under `/explore`, with child `GoRoute(path: ':newsId', name: 'news-detail', builder: NewsDetailScreen(idOrSlug: …))`.
  - `String newsRouteFor(String? idOrSlug)`: `'/explore/news'` or `'/explore/news/<encoded>'`.
  - `NewsListScreen`: a `BisoPage` list of articles (image thumbnail, title, date, campus), filtered by `filterCampusProvider`, with pull to refresh.
  - `NewsDetailScreen({required String idOrSlug})`:
    - Hero image, title, author, and date (app locale).
    - The body via `toFullHtml` when `hasRenderableBody`. Otherwise the short description plus a "Read on biso.no" button, which opens `https://biso.no/news/<slug>` (or `/news` when there is no slug) via `url_launcher`.
    - Not-found shows `MembersOnlyState` for non-members, else "This article isn't available".
  - `BisoNewsCarousel({required List<NewsModel> news})`: a horizontal carousel styled like `BisoEventCarousel` that opens the tapped article.

- [ ] **Step 1: Write the failing tests:**
  - `newsRouteFor` cases.
  - `biso://news?id=n1` resolves to `/explore/news/n1`. Test through the route helper the handler uses.
  - Widget tests, providers overridden:
    - the list shows titles
    - detail renders an HTML body
    - detail with a Plate-JSON body shows "Read on biso.no" and not the JSON text
    - a missing article for a non-member shows "Members only"
    - both screens build on `BisoPage`
    - Explore shows a "News" entry that navigates to `/explore/news`

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement.** Add both screens to the design-rules migrated list.

- [ ] **Step 4: Run** the new tests, the existing explore and home tests, and `flutter analyze`.

- [ ] **Step 5: Commit.** `feat(news): news in Explore, on Home, and from notifications`

---

### Task 8: Inbox data: new columns, visibility, ordering, grouping

**Files:**
- Modify: `lib/data/models/app_notification_model.dart`, `lib/data/services/notification_inbox_service.dart`, `lib/providers/notification/notification_provider.dart` (inbox notifier passes `joinedAt`)
- Create: `lib/data/models/inbox_item.dart`, `lib/core/utils/inbox_layout.dart`
- Tests: `test/data/models/app_notification_model_test.dart` (create), `test/data/services/notification_inbox_service_test.dart` (extend), `test/core/utils/inbox_layout_test.dart` (create)

**Interfaces:**
- Produces:
  - `class InboxItem extends Equatable { final String type; final String id; final String? titleEn; final String? titleNo; final String? image; final DateTime? date; final String? campusId; String title(String locale); String get route; }`. `route` uses `eventRouteFor`, `newsRouteFor` or `jobRouteFor`. Also `static List<InboxItem> listFromJson(String? json)`, which returns `[]` on null, empty or invalid input and skips elements with an unknown `type` or no `id`.
  - `AppNotification` gains:
    - `String source` ('manual' default)
    - `String? contentType`, `String? contentId`, `String? image` (URL via `appwriteImageUrl`)
    - `List<InboxItem> items`
    - `String audienceType`, `String? audienceValue`, `String? campusId`
    - `bool get isBurst => items.length > 1`
    - `bool get isUrgent => category == 'urgent'`
    - `InboxFilter get filter`: `events` for content_type or category event, `news` for news, `jobs` for job, else `fromBiso`
  - `enum InboxFilter { all, events, news, jobs, fromBiso }`
  - `@visibleForTesting bool isBroadcastVisible({required String? audienceValue, required String? rowCampusId, required String? campusId})`, per the Global Constraints.
  - `fetchInbox` gains `DateTime? joinedAt`. It selects the new columns and the `campus_id` column, applies `isBroadcastVisible` to broadcast rows, and drops rows sent before `joinedAt`. Topic rows keep using `isTopicAudienceVisible`; their values stay language-neutral, so no change is needed there.
  - `inbox_layout.dart`:
    - `List<AppNotification> pinUrgent(List<AppNotification> items, DateTime now)`: unread urgent rows sent within 3 days go first, newest first, and the rest keep their order.
    - `List<InboxSection> groupByDay(List<AppNotification> items, DateTime now)`, where `InboxSection { InboxDay day; List<AppNotification> items; }` and `enum InboxDay { today, yesterday, thisWeek, earlier }`. "This week" means within the last 7 days, excluding today and yesterday. Pinned urgent rows are excluded from the groups and rendered above them.
    - `List<AppNotification> applyFilter(List<AppNotification>, InboxFilter)`

- [ ] **Step 1: Write the failing tests:**
  - `isBroadcastVisible`:
    - `general` → visible
    - `general_bergen` for campus '2' → visible
    - `general_oslo` for campus '2' → hidden
    - legacy null value with `campus_id` '1' for campus '2' → hidden
    - legacy null with `campus_id` null → visible
    - legacy null with `campus_id` '5' → visible
  - `fetchInbox`:
    - drops a broadcast sent before `joinedAt`
    - keeps one sent after
    - selects `items`/`image`/`content_type` but never `data`
  - `AppNotification.fromAnnouncement` parses `items`:
    - a 3-element JSON gives `isBurst`
    - invalid JSON gives no items
    - `content_type` news gives `filter == InboxFilter.news`
  - `InboxItem.route` for each type.
  - `pinUrgent`:
    - an unread urgent row from 2 days ago is pinned
    - a read one isn't
    - a 4-day-old one isn't
  - `groupByDay` boundaries, using an injected `now`.

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement.** Pass `joinedAt: authState.user?.createdAt` from the inbox notifier.

- [ ] **Step 4: Run** the new and existing inbox tests, and `flutter analyze`.

- [ ] **Step 5: Commit.** `feat(notifications): inbox reads linked content and shows only what you were sent`

---

### Task 9: Smart inbox UI

**Files:**
- Modify: `lib/presentation/screens/notifications/notifications_screen.dart`, `lib/presentation/screens/notifications/announcement_detail_screen.dart`, ARB files
- Tests: `test/presentation/screens/notifications/notifications_design_test.dart` (extend), `test/presentation/screens/notifications/smart_inbox_test.dart` (create)

**Interfaces:**
- Consumes: Task 8's model and helpers, and the approved mockup `docs/superpowers/specs/2026-10-20-push-notifications/app-inbox.html` (option A) in BISO-Sites.
- Produces:
  - `NotificationsScreen`, built on `BisoPage(title: l10n.notificationsTitle)`, with:
    - filter chips (`InboxFilter`, Material `ChoiceChip` styled with `BisoPalette`, as in `marketplace_screen.dart`)
    - pinned urgent rows (error-coloured tile, `CupertinoIcons.exclamationmark_triangle`)
    - then `BisoSection(title: <day label>)` + `BisoListGroup` per `InboxSection`
  - Rows:
    - The leading widget is a 46×46 rounded thumbnail when `image` is set (CachedNetworkImage). Otherwise it is a `BisoIconTile`: blue calendar for events, violet news for news, teal briefcase for jobs, neutral bell for others, and the error colour for urgent.
    - Then title and subtitle, a relative time, and an unread dot.
  - Burst rows show "{count} new" as subtitle and a horizontal strip of up to 3 mini cards (image, title, date), each opening `item.route`, plus a "See all {count}" link to `/announcements/<id>`.
  - Tap behaviour is unchanged: mark read, then the deep link.
  - `AnnouncementDetailScreen`: when the announcement has items, it lists every item as a row (thumbnail, title, date) opening `item.route`.

- [ ] **Step 1: Write the failing widget tests.** Override the inbox provider with fixtures. `NotificationsScreen` takes an optional `DateTime Function()? clock` (default `DateTime.now`) that it passes to `pinUrgent`/`groupByDay`, and the tests inject a fixed clock:
  - shows "Today"/"Earlier" sections in the app language
  - the News chip shows only news rows
  - an unread urgent row appears above the Today section
  - a burst row shows "3 new" and "See all 3"; tapping a mini card navigates to that item's route (go_router test harness)
  - the announcement detail lists a burst's items
  - still builds on BisoPage, and the empty state still shows

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run** the notifications tests and `flutter analyze`.

- [ ] **Step 5: Commit.** `feat(notifications): smart inbox`

---

### Task 10: Android foreground notifications, notification permission, tap routing

**Files:**
- Modify: `pubspec.yaml` (add `flutter_local_notifications`, a current stable version compatible with compileSdk 36 and desugaring 2.1.4, which is already enabled)
- Modify: `android/app/src/main/AndroidManifest.xml`:
  - `<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>`
  - `<meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="biso_default"/>`
- Create: `lib/data/services/local_notification_presenter.dart`
- Modify: `lib/data/services/notification_service.dart` (`_handleForegroundMessage` ~1366, `_handleAnnouncementNotification` ~1415-1454), `lib/main.dart` (initialize presenter)
- Tests: `test/data/services/local_notification_presenter_test.dart`, `test/data/services/notification_service_tap_test.dart` (create)

**Interfaces:**
- Produces:
  - `abstract class LocalNotificationPresenter { Future<void> initialize({required void Function(Map<String, dynamic> data) onTap}); Future<void> show(RemoteMessage message); }` with a `FlutterLocalNotificationsPresenter` implementation:
    - channels `biso_default` (default importance) and `biso_urgent` (high importance), created at initialize
    - `show` picks `biso_urgent` when `data['category'] == 'urgent'`, uses the notification title and body, and puts the payload in `jsonEncode(message.data)`
    - small icon `@mipmap/ic_launcher`
  - `NotificationService` takes an optional `LocalNotificationPresenter` and a `bool Function() isAndroid` seam (default `Platform.isAndroid`). `_handleForegroundMessage` calls `presenter.show` **only on Android** (iOS already presents it), then keeps the existing broadcast to `onForegroundMessage`. The local-notification tap calls the same routing as `_handleNotificationTap`.
  - `_handleAnnouncementNotification`: `deep_link` first (unchanged), then `content_type` + `content_id`, routed via the event, news or job route helpers. Then `announcement_id`, then `/notifications`. The final fallback must go through `DeepLinkService` (queued when there is no navigator context, e.g. on a cold start), not `navigatorKey.currentContext?.go` directly. Add a `queueRoute(String location)` on `DeepLinkService` if needed.

- [ ] **Step 1: Write the failing tests:**
  - `'shows a foreground push on Android'`: the fake presenter records one `show`.
  - `'does not show a foreground push on iOS'`: `isAndroid` returns false, so there are zero `show` calls; the `onForegroundMessage` stream still emits.
  - `'urgent pushes use the urgent channel'`: test the channel picker as a pure function `channelIdFor(Map<String, dynamic> data)`.
  - Tap routing:
    - `{deep_link: 'biso://news?id=n1'}` routes to `/explore/news/n1`
    - `{content_type: 'event', content_id: 'e1', deep_link: ''}` routes to `/explore/events/e1`
    - `{}` with no navigator context queues `/notifications`, and it is replayed by `flushPendingLinks`

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement.** Run `flutter pub get`.

- [ ] **Step 4: Run** the tests and `flutter analyze`, then `flutter build apk --debug` to confirm the manifest and plugin compile.

- [ ] **Step 5: Commit.** `feat(notifications): show pushes in the foreground on Android and route every tap`

- [ ] **Step 6: CHECKPOINT (human).** Ask the user to install a build on an Android 13+ device and an iPhone and confirm:
  1. the permission prompt appears and can be granted on Android
  2. a test push from admin (Topic → Events → their campus) arrives once, in the phone's language
  3. tapping it opens the event
  4. while the app is open, the push shows once on both platforms
  5. changing the app language and sending again arrives in the new language

---

### Task 11 (BISO-Sites): Retire the old topics

**Files:**
- Modify: `packages/api/appwrite.config.json` (remove the 21 topics `{news,events,jobs,shop}_{oslo,bergen,trondheim,stavanger,national}` and `general`)
- Modify: `packages/shared/utils/notification-topics-config.test.ts`

**Interfaces:**
- Consumes: Plan 1's `ALL_PUSH_TOPIC_IDS`.

- [ ] **Step 1:** Run this only after Task 10's checkpoint passes. In BISO-Sites, branch `chore/retire-old-topics` from `main`, after PR #101 is merged.
- [ ] **Step 2: Write the failing test.** `'appwrite.config.json defines exactly the push topics'`: the set of `topics[].$id` equals `new Set(ALL_PUSH_TOPIC_IDS)`. Run `cd packages/shared && bunx vitest run utils/notification-topics-config`. Expected: FAIL (71 vs 50).
- [ ] **Step 3:** Remove the 21 entries.
- [ ] **Step 4:** Run the test again. Expected: PASS.
- [ ] **Step 5:** Commit `chore(api): retire pre-language push topics`.
- [ ] **Step 6: CHECKPOINT (human).** Ask the user to delete those 21 topics in the Appwrite console (the CLI push does not delete topics) and to merge the branch.
