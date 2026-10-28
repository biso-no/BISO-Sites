# Event RSVP: "Going / Maybe / Not going" on the website and in the app — design

## Why

BISO's departments and clubs host events, and students have asked for a way to
say they are coming, the way Spond and Connect work. Two things come out of it:

- **Students** see how many others are going, which tells them whether an
  event is worth turning up to.
- **Organisers** get an idea of the turnout, and a list of who said they're
  coming.

Today there is nothing like this. `apps/web/src/lib/types/event.ts` says so
outright ("BISO has no in-house sign-up flow yet"), the admin dashboard's
"registered" figure is a hardcoded 0, and the app only has the external ticket
button.

The user asked for it on both the website and the Flutter app and handed every
product decision to me. Every decision below marked *(my call)* is one I made.

## Success looks like

- A club publishes a free drop-in event. On `/events/<slug>` a signed-in
  student sees **Are you going?** with three buttons, *Going*, *Maybe* and
  *Not going*, and taps *Going*. The button lights up at once and the line
  under it changes from "4 going" to "5 going".
- The same student opens the event in the app. *Going* is already selected
  there. They tap *Maybe*; the website shows "4 going · 1 maybe" after a
  reload.
- Tapping the selected answer again takes the answer back (no answer).
- A visitor who isn't signed in sees the count and a *Sign in to respond*
  button that brings them back to the event after sign-in.
- The organiser opens the event's **Logistics** page in admin and sees an
  **RSVPs** panel: "5 going · 1 maybe · 2 not going" and a table of names,
  emails, answers and when they answered.

## Goals

- Three answers: `going`, `maybe`, `not_going`. Tapping the current answer
  again clears it. *(my call: the user first described Going / Not going, then
  added Maybe, then wondered about a single Join button. Going is the join
  button; Maybe and Not going cost one row of buttons and match the Spond
  model they pointed to.)*
- Public count: "{n} going" and "{n} maybe", each left out when zero. Nothing
  shows when both are zero. The not-going count is never public. *(my call)*
- Counts only, never names, on the website and in the app. Names are visible
  only to staff in admin. *(my call: a public "who's going" list is a privacy
  decision the user hasn't made.)*
- Only signed-in students with a real account can answer: on the web
  `isAuthenticatedAccount`, in the API `isAuthenticatedAppwriteUser`. An
  anonymous web session does not count.
- **Members-only events:** only members can answer. Non-members see the
  count and the existing members-only notice, and no buttons. The server
  enforces it. Clearing an answer is always allowed. *(my call: "Going" to an
  event you can't attend is a false signal.)*
- Answers are open until the event ends (`end_date`, else `start_date`): the
  same moment the website marks an event as past. After that, and on
  cancelled or unpublished events, the RSVP block is not shown and the server
  refuses writes. An event with no date stays open.
- **Ticketed events** (`ticket_url` set) show the RSVP block too, under the
  ticket button, with the hint "Saying you're going doesn't get you a
  ticket." *(my call)*
- Organisers see counts and the full list (name, email, answer, last changed)
  on the event's admin Logistics page. Visibility follows the same campus and
  department scope as the attendee list already on that page.
- The website and the app show the same data. Both go through one shared
  helper in `@repo/shared`.

## Non-goals

- Capacity limits, waitlists or seat reservation. An RSVP is a
  non-binding indication and `capacity` is not enforced against it.
- Reminders or pushes to people who said they're going, and notifying them
  when an event changes. The push infrastructure makes this a good follow-up.
- Counts on event list cards, the home screen or the page-builder events
  block (whose hidden `going` counter stays at 0). The detail page is enough
  for v1. *(my call: per-card counts cost one count per card.)*
- A "my events" list on the profile.
- Live updates. Counts are read when the page or screen loads, and after the
  viewer's own answer.
- Changes to the admin events dashboard's hardcoded "registered" figure.
- Cleaning up the RSVPs of deleted accounts. Account deletion removes only the
  Appwrite user today. Its rows stay and still count, and the admin list shows
  them without a name.

## Anti-goals (a failure even if it works)

- **Exposing who is going to the public.** No user ids, names or rows reach a
  browser or the app except the viewer's own answer.
- **A count that lies.** Appwrite's `listRows().total` currently reports the
  whole table, not the filtered set (see `countRows` in
  `apps/web/src/lib/data/queries.ts`). Counts are counted from the rows.
- **A button that looks saved when it isn't.** A failed save reverts the
  button and says so.
- **An answer on an event someone can't attend:** past, cancelled or
  unpublished events, or members-only events for non-members.

## How

### Data: new table `event_rsvps` (database `app`)

| column | type | notes |
|---|---|---|
| `event_id` | string(50), required | `events.$id` |
| `user_id` | string(50), required | Appwrite user id |
| `status` | enum `going`, `maybe`, `not_going`, required | |

- Indexes: unique `uniq_event_user (event_id, user_id)`, key
  `idx_event_status (event_id, status)`, key `idx_user_id (user_id)`.
- `rowSecurity: true` and table `$permissions: []`. The server writes every
  row with the admin key and gives it `read("user:<id>")`, so a student can
  read their own row and nobody else's, the same way `user_notifications` and
  `benefit_reveals` work.
- Added to `packages/api/appwrite.config.json` by hand, mirroring the
  existing per-user tables. **The user pushes it to Appwrite.** The generated
  types are not hand-edited, so the code uses a local row interface until
  they are regenerated.

### Shared logic: `packages/shared/utils/event-rsvp.ts`

A pure module that takes a small db adapter (the `benefit-reveal-server.ts`
pattern), so the website, the API and the tests share it:

- `readEventRsvp(db, { eventId, userId? })` returns
  `{ counts: { going, maybe }, mine, open }` (`mine` is null without a user or
  an answer). Counting pages through the event's rows, selecting only `status`.
- `setEventRsvp(db, { eventId, userId, status, isMember })`, where `status` is
  `going | maybe | not_going | null` and `isMember` is a lazy
  `() => Promise<boolean>` called only for a members-only event when the new
  status isn't null. It checks the event (must exist, be `published` and not
  ended), then deletes the row (null), updates it, or creates it. A
  create that loses a race to the unique index (409) re-reads and updates.
  The result is either
  `{ ok: true, summary }` or `{ ok: false, reason: "not_found" | "closed" | "members_only" }`.

### Website (`apps/web`)

- **Server actions** in `src/app/actions/event-rsvp.ts`:
  `respondToEvent(eventId, status)` returns the canonical
  `{ success, data?: summary, error? }`. It gates on `isAuthenticatedAccount`
  and gets membership from `getLiveMembershipStatus()`, only when it is asked
  for. The detail page reads the summary server-side for the viewer
  (`getLoggedInUser()`).
- **UI:** an `EventRsvp` client island inside the sticky `ActionCard`
  (`components/events/v2/event-detail-v2.tsx`), after the ticket link and
  before the contact block.
  - It holds a label, a three-button group (`aria-pressed`, the selected one
    `bg-action`) and the count line.
  - The hint shows on ticketed events, and an inline error after a failed
    save.
  - Signed-out visitors see a sign-in link back to the event in place of the
    buttons.
  - The change shows at once (React `useOptimistic` or local state in a
    transition), the server's summary replaces it, and a failure reverts it.
- Redesign rules apply: tokens and `type-*` roles only, no motion, Museo fonts.
- Strings go in `packages/i18n/messages/{en,no}/events.json` under a new `rsvp`
  section.

### API for the app (`apps/api`)

`/api/events/[id]/rsvp`, mirroring the notifications and benefits routes:

- `GET` takes an optional bearer token. With one, `mine` is filled in, and an
  invalid token gives `401 not_authenticated` so the app retries with a fresh
  JWT. It returns `200 { counts, mine, open }`, or `404 not_found` for a
  missing or unpublished event.
- `POST` requires a bearer token for a real account. The body is
  `{ "status": "going" | "maybe" | "not_going" | null }` and it returns
  `200 { counts, mine, open }`. Errors:
  - `400 invalid_request`
  - `401 not_authenticated`
  - `403 members_only`
  - `404 not_found`
  - `409 closed`
  - `429 rate_limited` (30 per minute per user)
  - `503 unavailable`
- Every response carries `Cache-Control: private, no-store` and CORS. The
  event id is checked against the benefits route's id regex.
- Membership on a members-only event comes from the profile's student number
  and the live 24SevenOffice status, which the recruitment route already does
  (`isMemberByProfile`). That function moves to `src/lib` so both routes
  share it.

### App (`BISO-Flutter`)

- `lib/data/services/event_rsvp_api_client.dart`: an `EventRsvpApi` interface
  and an `EventRsvpApiClient`, in the same shape as
  `notifications_api_client.dart` and `benefits_api_client.dart`.
  - It has an injectable `http.Client` and JWT provider, and retries once on
    401 with a fresh JWT.
  - It has a 20 s timeout, and errors come back as a typed exception kind
    (`notDeployed` is a 404 with no error token).
- `lib/providers/events/event_rsvp_provider.dart`: a family `StateNotifier`
  keyed by event id. It watches the signed-in user id, so it reloads after
  sign-in or sign-out.
  - It loads the summary, then `respond(status)` shows the change at once,
    replaces it with the server's summary, and on failure reverts it and
    reports failure for a snackbar.
  - Taps while a save is running are ignored.
- `lib/presentation/widgets/event/event_rsvp_card.dart`: placed in
  `EventDetailBody` after the ticket button. It has a heading, three
  segmented buttons, the count line, the ticket hint and, when signed out,
  a sign-in prompt (`/auth/login`).
  - Members-only events show nothing to non-members, using
    `hasValidMembershipProvider`. The ticket button already explains
    members-only there.
  - It renders nothing while the event is completed or cancelled, while
    loading fails, or while the API isn't deployed.
  - BISO design system: `BisoPalette`, CupertinoIcons, listed in the design
    rules test.
- Strings go in the ARB files (en, no), regenerated with `flutter gen-l10n`.
- Tests use hand-written fakes and `MockClient`, as the repo does. CLAUDE.md
  gets an "Event RSVP" feature section.

### Admin (`apps/admin`)

- `listEventRsvps(eventId)` next to `listAttendees` in
  `_actions/event-segments.ts` reuses `loadScopedEvent`, so it has the same
  scope. It reads all of the event's rows with the admin key and resolves
  names and emails from the `user` table in batches.
- An **RSVPs** `StudioPanel` on `events/[id]/segments` (Logistics), above
  Attendees. It shows the three counts and a table of name, email, answer and
  last changed, sorted going → maybe → not going, then by name. Empty state:
  "No one has answered yet."

## Copy

| key | English | Norwegian |
|---|---|---|
| title | Are you going? | Blir du med? |
| going | Going | Kommer |
| maybe | Maybe | Kanskje |
| notGoing | Not going | Kommer ikke |
| goingCount | {count} going | {count} kommer |
| maybeCount | {count} maybe | {count} kanskje |
| signIn | Sign in to respond | Logg inn for å svare |
| ticketHint | Saying you're going doesn't get you a ticket. | Du får ikke billett ved å svare her. |
| saveFailed | Couldn't save your answer. Try again. | Kunne ikke lagre svaret. Prøv igjen. |

## Release order

1. The user pushes `event_rsvps` to Appwrite (and may regenerate types).
2. `apps/api` and `apps/web` deploy (Sites PR).
3. The app ships (Flutter PR). Older and newer app builds degrade quietly: a
   404 or failed load just hides the card.

## Left to the builder

Component internals, test cases beyond the ones named, the exact admin table
styling (following `attendee-panel.tsx`), and wording of error strings not
listed above (in the same plain voice).
