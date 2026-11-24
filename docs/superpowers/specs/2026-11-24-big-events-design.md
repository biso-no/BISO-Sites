# Big events: participants, groups, buses, messages, check-in, event screen — design

Status: draft for owner review, 2026-11-24. Supersedes D14 ("Event groups")
of `2026-10-20-push-notifications-design.md`.

## Intent

From **Sunday 24 to Wednesday 27 January 2027**, BISO hosts **Winter Games**
at Storefjell: students from all
four campuses (Oslo, Bergen, Trondheim, Stavanger) travel by BISO buses from
their campus, stay a few days, and ride home again. Last time, students
picked buses themselves: they boarded full buses to sit with friends or chose
the "party" bus, which caused delays. Organizers also had no single place to
tell participants what they need to know.

We want, for any multi-day happening with a known list of participants (a
**big event**):

1. **One screen** in the app (and a simpler page on the web) holding
   everything a participant needs, edited by organizers in admin. It should
   feel like a travel agency app (the owner's reference: Ving): your bus,
   your room, a countdown, today's programme, the latest updates.
2. **A participant list** imported from whatever spreadsheet organizers
   have, split into **groups** (bus, room, buddy group, team). Buses can be
   filled automatically or by hand.
3. **Messages to participants only** (all, a campus, a bus, a room…):
   push when they have the app, email when they don't, SMS later.
4. **Bus check-in**: someone with scan access scans each student's member
   pass at the bus door and sees right bus / wrong bus; organizers see who
   is missing, on the way there and on the way home.

It must not be tailored to Winter Games only. Each campus runs its own
**Fadderullan** (buddy week, in its own city, no travel) and should be able
to use the same tools with buddy groups.

**The administrators are not technical.** The admin side has to be obvious
to someone who has never heard of a "segment", a "topic" or an ID.

## Facts that shape the design

- **Tickets are sold on Tickster** with whatever email the buyer types,
  usually a private Gmail/Hotmail. Payment 1 (published in the fall) sells
  rooms (1-, 2-, 3- and 4-person); one person buys for the room and
  roommates are not recorded. The Tickster purchasers export lists buyers
  only (sheet "Kjøperliste", header on row 3: Navn, Etternavn, E-post,
  Mobilnr, Ref.nr., Kjøp fullført, Betalingsmåte, Arena, Forestilling,
  Forestillingstid, Billettkategori, Antall billetter, Totalsum…;
  Billettkategori looks like `1 x Bergen - BISO - 4-Person`). Payment 2 opens
  in **January** and will cover **everyone** in every room (owner: every
  ticket holder must be tracked). The hosts may also keep their own Excel
  sheets of participants and groups. Exact formats of Payment 2 and the
  hosts' sheets are unknown until January. **Tickster has no API for
  orders**, so spreadsheets are the only source.
- **Students sign into the app with their BI account** (Appwrite OIDC
  provider, `bi_sign_in_service.dart`, `packages/shared/utils/bi-identity-sync.ts`).
  Appwrite finds or creates the account by the BI email (`…@bi.no`). The BI
  link writes `student_id`, which is what membership status is read from.
  A valid membership is required to participate.
- Therefore **creating Appwrite accounts (or Appwrite team invitations, which
  create accounts) from ticket emails would backfire**: the Gmail account sits
  empty and the student gets a second account at BI sign-in.
- **Appwrite Messaging only reaches accounts** (push and email go to user
  targets). The repo already sends mail to non-accounts over SMTP:
  `sendEmail` in `packages/connectors/src/email/smtp.ts` (exported as
  `@repo/connectors/email`, usable from admin, api and web, one message per
  call, throws if SMTP isn't configured).
- **There is mobile coverage at Storefjell** (owner, 2026-11-24). Check-in
  may require a connection.
- **No SMS provider exists yet.**

## Goals

- An organizer uploads the Tickster export **as it is** and sees, in plain
  words, what each column was understood as; after confirming, the list is
  built. Uploading a newer file updates the list instead of duplicating it.
- Each participant gets linked to their real (BI) account without anyone's
  email being changed and without duplicate accounts.
- Buses are filled with one button (per campus, rooms kept together) and can
  be adjusted by hand; students see their bus only once organizers publish.
- One set of buses covers the round trip; nothing is imported or set up
  twice.
- Any message reaches every chosen participant by push or email, and the
  organizer sees beforehand how ("96 people: 81 get a push, 15 get an
  email").
- At every bus door, a helper scans passes and knows within a second whether
  the person belongs on that bus; the bus leaves knowing who is missing.
- A participant with the app sees one screen that changes over the event:
  before (countdown, bus, room, checklist), during (now/next, today, room,
  important updates), going home (bus home first).
- A participant without the app gets the same information by email and on a
  signed-in web page.

## Non-goals

- Selling tickets or taking payment (Tickster stays).
- Importing participants automatically from the Tickster API. (The unused
  `apps/api/src/lib/tickster-sync.ts` buyer sync stays as it is.)
- Offline check-in.
- Choosing an SMS provider or sending real SMS. (Built up to the send, behind
  a feature switch; see D9.)
- Students choosing or swapping their own bus. Seat numbers.
- The public marketing page for a project (already built with the page
  editor, e.g. the Winter Games project page).
- Changing or retiring the `large_event` table, the app's
  `large_event_screen.dart` or the home hero carousel that reads it.
- A new bottom tab in the app (see D11).
- Ticking the checklist on the web.

## Anti-goals (failure even if it "works")

- An account is created for a ticket email, or a student ends up with two
  accounts.
- A ticket is linked to the wrong person, so someone sees another person's
  bus or room.
- A student can see other participants' email addresses or phone numbers.
  (Roommates' names are fine; see D4.)
- A campus admin sees or messages participants from another campus.
- Personal data of participants (names, emails, phones) is sent to an AI
  model.
- The admin UI shows IDs, column codes, "segments" or "topics", or asks
  organizers to prepare a file in a special format.
- A student gets the same message twice through the same channel, or a
  string of "you've been moved" messages while organizers reshuffle.
- The app shows a bus that is stale or unpublished, so a student goes to the
  wrong bus.

## Approaches considered

**A. Big events as their own area in admin — chosen by the owner.** A new
"Big events" section; each big event (e.g. "Winter Games 2027",
"Fadderullan Bergen 2027") has tabs for participants, groups/buses, the
event page, messages and check-in. It can point at one or more events
(Winter Games is at least two Tickster events: Payment 1 and Payment 2;
Fadderullan is a week of events). The app gets its own screen for
participants; the web gets a read-only signed-in page. Trade-off: a new
admin area with its own access rules, so more to build than B.

**B. Grow the event's Groups page** (`/events/[id]/segments`). Least new
work: event access rules, campus scoping and the app's "Your bus" card exist.
Rejected: organizers would have to pick one Tickster event as "the" Winter
Games event, Fadderullan would need a fake umbrella event, and the screen
would live inside an event screen instead of having its own home.

**C. Appwrite Teams for participants and groups** (one team per big event,
one per bus or room). Raised by the owner. Rejected: team membership needs an
account, so importing would create the empty Gmail accounts; teams can't hold
bus times or meeting points, so own tables are needed anyway; messages still
go person by person.

**Building the participant screen once on the web and showing it in the app
(WebView).** Rejected: it would not feel like a native travel app, sign-in
hand-off and push taps get awkward, and the scanner and pass must be native
anyway. Decided: native app screen + simpler web page.

## Decisions

### D1. The "big event"

A big event has: name (no/en), slug, campus (`"1"`–`"4"`, or `"5"` National),
owning department (the board that runs it: e.g. the Wintergames department on
National, or Fadderullan Bergen), start and end date/time, place name and
address, a hero image, status (Draft / Published / Archived), optional links
to events (`events` rows, informational: shown on the event page and used to
pick defaults), and switches:

- **Travel** (buses, two legs, bus check-in, departure reminders). Winter
  Games on; Fadderullan off.
- **Check-in for other groups** (off by default; lets e.g. Fadderullan take
  attendance per buddy group later). Builder may defer the non-bus case to a
  later stage, but the data model must allow it.

The participant screen is only shown to linked participants while the big
event is Published, from when it's published until 7 days after it ends.
Archived hides it everywhere.

The participant-facing title is the big event's own name. Wording such as
"Your bus" only appears when Travel is on. *(My call: admin calls the area
"Big events"; the owner may rename it.)*

### D2. Who can do what (owner decision: the board plus campus admins)

| | Global admin | Owning department members | Campus admin |
|---|---|---|---|
| See the big event in admin | all | their big events | big events on their campus + all National ones |
| Create a big event | ✓ | – | for their campus |
| Edit settings and the event page content | ✓ | ✓ | campus big events: ✓; National: – |
| See / import / edit participants | all | all | only participants whose campus is theirs |
| Create and fill groups/buses | all | all | groups of their campus |
| Send messages | to anyone in it | to anyone in it | only to their campus's participants |
| Give check-in access | ✓ | ✓ | for their campus's buses |

- Enforced server-side in every action, not only in the UI. Build on
  `getUserAuthContext` (`apps/admin/src/lib/authorization.ts:181`:
  `managedCampusIds`, `resolvedDepartmentIds`) and add a new `NAV_ACCESS` key
  (`apps/admin/src/lib/roles.ts:37`) open to `globaladmin`, `campusadmin`
  and `department`; a department member who owns no big event sees an empty
  state, not a 404.
- **Exception to D12 of the push spec** (which closed notification sending
  to department members): owning department members may send messages to
  their own big event's participants. They still cannot use
  `/communications`.
- A participant with no campus is visible to global admins and the owning
  department only, until someone sets the campus.

### D3. Participant import

Organizers bring the file they already have. **No templates.**

- Accept `.xlsx` and `.csv` upload and rows pasted from a spreadsheet. Pick a
  maintained xlsx parser (not the abandoned npm `xlsx`); builder's call.
- Find the header row (Tickster's export has it on row 3) and map columns
  with known aliases first: English and Norwegian names plus the Tickster
  headers listed above. Fields: first name, last name (or full name), email,
  phone, campus, ticket reference, ticket category, and **a grouping column**
  (room, bus, buddy group…).
- AI fallback for columns the aliases don't recognize: the model gets the
  header names and **the shape of the values only** (e.g. "text@domain",
  "+47 and 8 digits", "two capitalized words", "number 1–4"), never the values
  themselves. Uses `@repo/ai`. *(My call; stricter than D14, which allowed
  five sample rows: participants are not BISO staff, and the admin-assistant
  rule is that their data never reaches a model.)*
- Show the mapping in plain words ("Column C looks like the email address",
  "Column K looks like the ticket type: it contains the campus and the room
  size"). Organizers confirm or change it with dropdowns.
- **Campus** comes from a campus column, else is parsed from the ticket
  category (`1 x Bergen - BISO - 4-Person` → Bergen), else the organizer
  picks one campus for the whole file. Rows whose campus can't be found go to
  a "No campus" list.
- **Room size** is parsed from the ticket category when present
  (`4-Person` → 4) and stored on the participant.
- **Grouping column**: the organizer says what it is ("Room", "Bus", "Buddy
  group", "Team") and groups are created or reused from its values. People
  with the same value end up in the same group.

**Rooms when the files don't say who sleeps where** *(owner: Tickster has
no order API, Payment 2 will list everyone in every room, but its export
format is unknown and may not arrive until shortly before departure. The
owner asked for a way that works on our side. My design:)*

- **A room booking file (Payment 1).** When rows carry a room size and the
  file has no room column, the import offers "Each row is a room booking".
  Each row then creates a room ("Ola Nordmann's room", 4 places) with the
  buyer as its first member and the rest as **open places**. Open places
  count as seats when filling buses (D5), so buses can be planned before the
  roommates' names are known.
- **A file with everyone (Payment 2, or the hosts' sheet).** Each person
  is placed into an existing room using the first rule that works:
  1. a column holding the Payment 1 order number or a room name;
  2. the same order number as someone already in a room (they were bought
     together);
  3. the same email or phone as a room's buyer (the buyer paid for the
     room again).
  A placed person fills an open place and rides on the room's bus. Everyone
  else lands in **"Not in a room yet"**, where organizers drag them into a
  room. Rooms show "3 of 4 named"; a room with more people than places is
  flagged.
- Advice for the owner, not a dependency: if the hosts can set it up,
  Payment 2 should ask each traveller for their own name, email and phone,
  and the Payment 1 order number. Then rule 1 places everyone.

- **Preview before saving**: "142 new · 230 updated · 3 in the list but not
  in this file · 2 rows skipped (no name or email)". Saving applies it.
- **Re-import updates.** A row is the same participant when it has the same
  name and the same email, the same name and the same phone, or the same
  ticket reference and name. **Email alone does not identify a person**: a
  buyer's email may be on several travellers' rows. Matched rows update the
  fields present in the new file and never clear a link to an account.
  People missing from the new file are **not** deleted; they are listed so
  the organizer can remove them.
- The organizer can also add, edit and remove a participant by hand.

### D4. Participants and linking to accounts

A participant row holds what the file said (name, ticket email, phone,
campus, ticket reference, ticket category, room size) plus the link to an
account when known, how it was linked, and the connect-email state.

**Never create Appwrite accounts or team memberships at import.**

**Only BI-linked accounts** (`student_id` set) can ever be linked to a
participant, by any route. The app still offers login-link sign-in, so
Gmail-only accounts exist; linking a ticket to one would hide it from the
student's real BI account. *(My call, after the review.)*

Linking, in order:

1. **Email match** at import or later: ticket email equals the email of a
   BI-linked account (case-insensitive) → linked ("Linked by email"). In
   practice this only catches tickets bought with a `@bi.no` address.
2. **Connect email** (main path, see below).
3. **By hand**: the organizer searches accounts by name or email (reuse the
   composer's people search) and links.

**Suggestions, never automatic:** a normalized phone (default +47) equal to
a profile `phone`, or a similar name on the same campus, is shown as
"Possible match" next to an unlinked person; the organizer confirms with one
click. *(My call, after the review: the profile phone is typed by the
student and never verified, so an automatic phone link could hand someone
another person's bus and room. This replaces the "linked by phone" I
proposed in the conversation.)*

One account can be linked to at most one participant per big event. A
participant can be unlinked by organizers.

**Connect email.** After an import the organizer presses "Send connect
emails". Every unlinked participant with a ticket email gets an email (both
languages: Norwegian first, English below, since there's no account to read
a language from) with a personal link:

`https://biso.no/connect/<token>` (exact path builder's call; it must stay
**outside `/app/`** and not collide with the web's `[...slug]` page route)

- The token is random and single-participant, stored hashed, valid until
  the big event ends.
- **Shared ticket emails.** When several participants have the same ticket
  email, that address gets one email listing each person by name with their
  own link, and "Send each link to the person it belongs to". (One account
  can only hold one participant per big event, so the buyer can't connect
  everyone to themselves by mistake.)
- **Connecting always happens on the web**, on a phone or a laptop. Every
  released app claims all `https://biso.no/app/*` links (iOS associated
  domains, Android `pathPattern="/app/.*"`) and silently ignores paths it
  doesn't know (`_goToLink` in `deep_link_service.dart`), so an `/app/` link
  tapped on a phone with today's app would open the app and do nothing.
  Keeping connect on the web means connect emails can go out before the new
  app version is released. *(My call, after the review.)*
- The page signs the student in with BI (`redirectTo` back to the same path,
  see `apps/web/src/lib/server.ts`), links the participant to that account,
  and then shows "You're connected", the big event's web page link, "Open in
  the app" (an `/app/big-events/<slug>` link, which opens the updated app)
  and store buttons. After that, signing into the app with BI is enough: the
  app shows the big event for the linked account. The app needs no connect
  route.
- Requires a BI-linked account (`student_id` set). If the student is signed
  in on the web without BI, the page asks them to sign in with their BI
  account.
- Refused when the participant is already linked to a different account
  ("This ticket is already connected to another account. Contact the
  organizers."). Opening an already-used link while signed in as the linked
  account just opens the event.
- A reminder goes out automatically to still-unlinked participants
  **4 days** after the first email (*my call*), once. Organizers can press
  "Send again" for one person or all unlinked.
- "Didn't get the email?" on a public web help page (linked from the big
  event's web page and from the app): the student types the email they used
  on the ticket; if it belongs to an
  unlinked participant of a published big event, new links are sent **to that
  address** (all of them, when several people share it). The answer is always the same ("If that address is on a list,
  we've sent a link"). Rate-limited per IP and per address.

**Membership.** For linked participants, show whether their membership is
valid (from the existing membership status in apps/api,
`membership-status-cache.ts` / `/api/membership?view=status`). Participants
without a valid membership are flagged in admin. Warning only; organizers
decide.

**Reach lists.** The participants tab shows three filterable piles:
- In the app with notifications on (account with a push target);
- In the app with notifications off;
- Not in the app yet (unlinked, or linked without the app): they get email.
Each pile can be copied as emails or downloaded.

### D5. Groups and buses

A group belongs to a big event and has a kind (Bus, Room, Buddy group, Team,
Other), a name, a campus, an optional capacity, a contact person (name +
phone, optionally linked to an account), a free note, and for rooms an
optional room number (shown to the room's members once filled in).

**Buses** (only when Travel is on) also have, per leg:
- **Out**: departure time, meeting point (text + optional maps link);
- **Home**: departure time, meeting point, estimated arrival (text).

Membership is per participant (linked or not). For buses, a participant has
an **out bus** and a **home bus**; the home bus defaults to the out bus and
organizers can change it per person.

- **Auto-fill** (one button, per campus or all campuses): fills each campus's
  buses with that campus's participants, spreads them evenly across that
  campus's buses, keeps everyone who shares a room on the same bus (a room's
  open places count as seats, D3), and never moves **pinned** people. When a
  person is later named into a room, they take the room's bus. Rooms that don't fit anywhere stay unassigned with
  a reason. When seats run out: "12 people have no seat. Add a bus." Builder
  picks the algorithm; even spread + rooms together + pins are the rules.
- **By hand**: drag people between buses, or select several and choose a
  bus. Moving by hand pins the person.
- Capacity is a warning, not a hard stop (organizers may knowingly overfill
  by one).
- **Publish**: buses are a draft until an organizer presses "Publish bus
  lists". Before that, participants see no bus anywhere. Publishing sends the
  automatic "You're on Bus 2" message (D7). After publishing, moving someone
  shows a checkbox "Tell {name} about the change" (on by default); the notice
  is queued, and if the same person is moved again before it went out, only
  the latest notice is sent.
- Rooms, buddy groups and teams have no publish step; they show to members
  as soon as they exist. *(My call.)*

### D6. Messages

A Messages tab per big event. Steps mirror the composer's: **Message → Who →
Check & send**.

- **Who** (cards): Everyone in this big event · A campus · Groups (one or
  more buses — choose the leg — rooms, buddy groups) · People not checked in
  on a bus leg · Specific participants. Campus admins only see their campus.
- **Personal details** are inserted with buttons, never typed syntax: first
  name, bus, departure time, meeting point, bus contact, room. Preview shows
  the real text for one person per group. *(My call: in pushes, only
  group-level details (bus, time, meeting point, contact, room) are used, so
  one push per group and language can be sent; first name is used in emails
  and in the in-app/web updates list. If a push contains a first-name
  placeholder, it is dropped from the push text.)*
- **Language**: the organizer writes in one language; the other is filled by
  the existing AI translation (`translateContentFields`,
  `apps/admin/src/lib/content-translation.server.ts`) before Check & send,
  where both are shown and editable. Linked participants get their account
  language (`user.locale`, as `push-dispatch` already does); email to
  unlinked participants carries both.
- **Important**: shown in red and pinned at the top of the participant
  screen until the big event ends or the organizer unpins it; always sent as
  push **and** email.
- **Delivery rule per person** (non-Important):
  push if linked and the account has a push target; otherwise email to the
  ticket email (or the account email if there is no ticket email). Never
  both, except Important.
- **SMS**: see D9.
- **Reach box**, live: "96 people: 81 get a push, 15 get an email" (+ "96 get
  an SMS" when on).
- **Schedule**: send now or at a chosen time (reuse the composer's pattern
  and the 5-minute `scheduled-dispatch` cron).
- Every message appears in the participant screen's **Updates** list (app and
  web) for the people it was sent to.
- **History** per big event: each message with who it went to and delivery
  counts (pushes sent, emails sent, failed), including automatic ones
  labelled "Automatic".

**Sending.** Pushes go through the shared `packages/shared/utils/push-dispatch.ts`
(user audience, per-locale fan-out, `user_notifications` rows so it shows in
the app's notification inbox). Tapping opens the big event screen
(`/app/big-events/<slug>` deep link). Emails and SMS go through a **delivery
queue** (one row per person per channel per message, with status and
attempts) processed in batches by a cron target, throttled to the SMTP
provider's limits. *(Builder: confirm the prod SMTP host and its limits;
Exchange Online SMTP AUTH allows about 30 messages a minute, so 400 emails
take ~15 minutes. SMTP is not configured in the local `.env.local` files.)*
One HTML email layout is shared by connect emails, messages and reminders
(there is no shared template today).

### D7. Automatic messages

Turned on by default when Travel is on; each can be switched off and its
text edited in the big event's settings:

- **Bus lists published** → each person: "You're on {bus}. It leaves {date
  time} from {meeting point}." (out leg; home leg mentioned if it differs).
- **Moved after publishing** → see D5.
- **Departure reminder**, 2 hours before each leg's departure (*my call*),
  to that bus's people for that leg: time, meeting point, "Have your member
  pass ready".

Automatic messages follow the same delivery rule and show in history.

### D8. The event page content (admin) and the participant screen

Approved mockup: `docs/superpowers/specs/2026-11-24-big-events/event-screen.html`
(three moments of one screen; blue = automatic from the participant list,
yellow = written by organizers). Dates and names in it are placeholders.

Building blocks organizers can add (owner picked these six; "Map" dropped,
an info page can hold a venue map picture):

1. **Programme**: items with start, optional end, title, place, short note.
   Drives "Now / Next" and "Today".
2. **Updates**: the messages from D6 (no separate editor).
3. **Before you go checklist**: items with text, ordered. Students tick them
   on their own phone (stored on the device). Optional automatic items "Ticket
   connected to the app" and "Membership valid" are ticked from data.
   *(My call.)*
4. **Practical info pages**: title + rich text, ordered. Use the admin's
   `DescriptionBlockEditor` (headings, lists, paragraphs, images; stored as
   HTML, rendered by the app's `flutter_html`).
5. **Contacts**: name, role, phone, email, "Emergency" flag; tap to call.
   Bus contacts from D5 show automatically on the bus card.
6. **Links**: label + URL buttons (feedback form, Tickster, ski rental…).

Text fields are stored per language using the existing translation approach
(`content_translations` or equivalent; builder's call) with background AI
translation as for events.

Admin shows a phone-sized **preview** of the participant screen next to the
editor, with a "Preview as" picker (a participant or "someone on Bus 2") and
a date/time slider to see before / during / going home.

**Participant screen phases** (app and web):

- **Before** (until start): countdown, your out bus (once published), your
  room, latest update, checklist, tiles for programme / info / contacts /
  links.
- **During** (start → end, "Day 2 of 3"): Important updates on top, Now /
  Next, today's programme, your room (with number if set), tiles.
- **Going home** (the day of your home bus): your home bus first, today's
  programme, updates.
- **After** (until 7 days after end): thanks + links (e.g. feedback); then
  the screen disappears.

What a participant sees about others: roommates' and buddy-group members'
**names**; the bus contact's name and phone; organizer contacts. Nothing
else about other participants.

### D9. SMS behind a switch (owner decision)

- Add a feature flag `big_events_sms` to the catalog
  (`packages/shared/utils/feature-flags.ts`), toggled by global admins on the
  existing Settings → Feature flags page. Off by default.
- When on, Check & send offers "Also send as SMS" (and Important messages
  default to it), with the reach and a cost hint.
- Sending uses an `SmsSender` with no provider wired: queue rows are created
  and marked "Not sent: no SMS provider". Connecting a provider later is a
  small change. (Appwrite Messaging SMS also needs account targets, so the
  provider will likely be called directly, like SMTP.)

### D10. Bus check-in

- **Who can scan**: people given check-in access for a big event (optionally
  limited to some buses), with an expiry (default: the big event's end + 1
  day). Organizers give it by searching an account or by email, like
  `inviteScanner` (`apps/admin/src/app/(portal)/_actions/member-pass-scanners.ts:235`)
  does for member-pass scanning, but in its own grant list scoped to the big
  event. A bus contact linked to an account gets access to their bus
  automatically. *(My call: a separate grant, not `member_pass_scanners`,
  which allows membership checks across a campus.)*
- **App**: the existing scanner gains a mode "Bus check-in" for people with
  such access: pick big event → bus → leg ("Bus 2 · Oslo → Storefjell"). Each
  scan of a member pass goes to a new api endpoint, which reads the user id
  from the pass code (`verifyMemberPassCode`, `packages/shared/utils/member-pass.ts:209`;
  the existing scan route does not return it) and answers:
  - green: "{name}, Bus 2 ✓" and records the check-in;
  - green, already: "{name} is already on board";
  - red: "Wrong bus. {name} is on Bus 4";
  - grey: "Not on the participant list";
  - plus "No bus assigned" and invalid/expired pass cases.
- **No pass** (no app, not linked, no membership): the helper finds the
  person in the bus list and ticks them by hand.
- **Bus list** in the app: "47 of 50 on board", missing people with tap-to-
  call (ticket phone), and undo for a mistaken tick.
- **Home leg**: same flow; the list also flags people who rode out but
  haven't boarded home.
- **Admin**: a live board with every bus and leg ("47/50"), missing names,
  and manual tick. Refresh by polling or realtime (builder's call).
- Every scan and tick is logged with who did it and when.

### D11. App work (BISO-Flutter)

- A **big event screen** per D8 (route and deep link `/app/big-events/<slug>`,
  added to `deep_link_service.dart`), reading one "my view" from apps/api:
  the big event, my participant record, my groups with details (only
  published buses), roommates' names, programme, info, contacts, links and my
  updates. Use the Biso design system.
- A **card pinned to the top of Home** for a participant from publish until
  7 days after the end ("Winter Games · 10 days to go"). *(My call: no new
  bottom tab.)*
- No connect route in the app (connecting happens on the web, D4). A
  signed-in student who isn't on any list sees nothing new; the Profile or
  Home area may link to the web "Didn't get the email?" page (builder's
  call).
- **Bus check-in mode** in the scanner (D10).
- Push taps for big event messages open the big event screen.
- Remove the old "Your bus" card (`your_trip_card.dart`,
  `event_segment_service.dart`, `event_segment_provider.dart`) once the new
  screen ships.
- **Two releases** *(my call, after the review)*:
  1. The participant screen, Home card, deep link and push taps, in the
     stores **before** the bus lists are published (target: 8 January
     2027).
  2. Bus check-in mode, before departure. Only the people scanning need it;
     students only show their member pass, which today's app already has.
     Organizers make sure every helper has updated.
- Emails link to the web page, not to `/app/` paths, for the same reason as
  D4: students on an older app version would land in an app that ignores the
  link. The web page offers "Open in the app".

### D12. Web work (apps/web)

- The connect page (D4), the "Didn't get the email?" page, and the big event
  page, all **outside `/app/`** (e.g. `/connect/[token]`,
  `/big-events/[slug]`; exact paths builder's call, clear of the
  `(public)/[...slug]` route). Connect and the big event page are signed-in
  pages (BI sign-in, `redirectTo` back). The big event page is
  **read-only**: your
  bus (out and home), room, programme (with Now/Next during the event),
  updates, info pages, contacts, links. No checklist ticking, no pass.
- A signed-in student who is not a participant of that big event sees a
  friendly "You're not on the list for this event" with a "Connect your
  ticket" help link.
- Every email links to this web page. It shows an "Open in the app" button
  (`/app/big-events/<slug>`, opened by app versions that know the route).

### D13. Data, API and permissions

- New tables (edit `packages/api/appwrite.config.json`; **the owner pushes**
  and regenerates types): big events, participants, groups, group
  memberships (with leg and pin), messages, deliveries, check-ins, check-in
  grants, and the content items (programme, checklist, info pages, contacts,
  links) or one content table with a type column (builder's call).
- **No client read permissions** on participant, group, membership,
  check-in and delivery tables: the app and web read through apps/api and
  web server code with the admin client, which filters to the signed-in
  user's own view. This keeps other participants' emails and phones out of
  reach. *(My call: the existing `event_segments` is readable by every
  signed-in user and `segment_members` requires an account, so neither fits;
  they are replaced, not extended.)*
- **Retire the old Groups feature**: the `/events/[id]/segments` page, its
  actions in `_actions/event-segments.ts`, and the composer's "Group from an
  event" audience. **Keep the RSVP panel** (`rsvp-panel.tsx`), which lives on
  that page: move it to the event editor or a small "RSVPs" page. Drop
  `event_segments`, `segment_members` and `event_attendees` only after
  confirming they hold no production data worth keeping (the owner pushes
  the schema change). Note `tickster-sync.ts` writes `event_attendees`; leave
  it or retarget it, builder's call, but it must keep compiling.
- **Retention**: 30 days after a big event ends, delete its participants,
  memberships, connect tokens, deliveries and check-ins. Keep the big event,
  its content, its groups (without members) and its messages (without
  recipient lists). Runs from a cron target like `api/cron/cleanup-member-pass`.
  *(Carries over D14's call.)*

## Constraints

- Bun, Turborepo, Ultracite/Biome; `bun run check-types` is required.
- All data access through `@repo/api`; generated types regenerate after the
  owner pushes the schema.
- Admin follows its studio visual language; app follows the Biso design
  system and its `CLAUDE.md`/`AGENTS.md`.
- New env vars go in `turbo.json`.
- Docs: add a staff guide page in `apps/docs` covering big events (its
  `covers` matching the new code).
- **Dates.** Buses leave Sunday 24 January 2027 and come home Wednesday
  27 January. Christmas falls in between. Payment 2 lists may only arrive a
  week or two before departure, so buses must be plannable from Payment 1
  (D3). Targets *(my proposal)*:
  - Stages 1–4 deployed by **18 December 2026**, so connect emails can go to
    Payment 1 buyers before Christmas.
  - App release 1 in the stores by **8 January 2027**.
  - App release 2 (check-in) by **15 January 2027**.
  - Bus lists published around **19–20 January 2027**.

## Suggested build order

Each stage gets its own plan. Stages 1–4 are Sites only; 5 is mostly the app;
6 spans both.

1. **Foundation**: schema; "Big events" admin area (list, create, settings,
   switches, access rules D2); participant import (D3); linking incl.
   connect emails, delivery queue + shared email layout, the web connect and
   "Didn't get the email?" pages, membership flag (D4); retention cron.
2. **Groups and buses** (D5), including publish and change notices.
3. **Messages** (D6, D7, D9).
4. **Event page content** in admin with preview (D8) + the web big event
   page (D12) + the api "my view" endpoint.
5. **App release 1**: big event screen, Home card, deep link, push taps;
   remove the old "Your bus" card (D11).
6. **Check-in** and **app release 2**: grants, api scan endpoint, app scanner
   mode and bus lists, admin live board (D10). Then retire the old Groups
   page (D13).

## Calls I made (check these)

- Admin area name "Big events".
- Rooms: a Payment 1 file creates rooms with open places that hold bus
  seats; later files fill names in by order number, buyer email/phone, or
  by hand from "Not in a room yet".
- Email alone never identifies a participant; a shared ticket email gets
  one email with each person's own link.
- Target dates: Sites stages by 18 Dec, app release 1 by 8 Jan, check-in
  release by 15 Jan, buses published 19–20 Jan.
- Only BI-linked accounts can be linked, by any route.
- Phone and name matches are suggestions the organizer confirms, never
  automatic (changed from "linked by phone" after the review).
- Connecting happens on the web; email links never use `/app/` paths, so
  older app versions can't swallow them; the app has no connect route.
- Two app releases: participant screen first, bus check-in before departure.
- AI column detection sees header names and value shapes only, no values.
- Connect reminder once, 4 days after the first email.
- Departure reminder 2 hours before each leg.
- Push text uses group-level details only; first name only in email and the
  updates list.
- Rooms and buddy groups show to members without a publish step.
- Checklist automatic items ("Ticket connected", "Membership valid").
- No new app tab; a pinned Home card instead.
- Separate check-in grants instead of reusing member-pass scanner grants.
- New tables replace `event_segments` / `segment_members` / `event_attendees`
  rather than extending them; participant data readable only through server
  code.
- Retention: participant data deleted 30 days after the end.

## Left to the builder

- Table and column names, the content table shape, indexes.
- The xlsx library; header-row detection details; alias lists.
- The auto-fill algorithm within the rules in D5.
- Delivery queue mechanics (batch size, retry, throttle), and which cron
  target runs it.
- Realtime vs polling on the admin check-in board.
- Exact admin layout within the studio's visual language; app layout within
  the Biso design system, following the mockup's structure.
- Whether `tickster-sync.ts` is retargeted to participants or left alone.
