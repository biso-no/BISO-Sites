# Big events — Stage 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organizers can create a big event in admin, import participants from whatever spreadsheet they have (rooms included), see who is reachable, link participants to their BI accounts, and send connect emails that students complete on the website.

**Architecture:** Five new service-only Appwrite tables. Pure import logic lives in `apps/admin/src/lib/big-events/import/`; logic shared by admin, api and web (linking, connect tokens, email layout, delivery queue) lives in `packages/shared/big-events/`. Admin pages under `(portal)/big-events` use the admin client after explicit access checks (D2). Emails go through a delivery queue processed by an apps/api cron route, which admin also "kicks" right after enqueueing. Students connect on apps/web at `/connect/[token]`.

**Tech Stack:** Next.js 16 (admin, web, api), Appwrite TablesDB via `@repo/api`, bun:test (admin), vitest (shared, web, api), `ai` + `@repo/ai/models` (`generateObject`), nodemailer via `@repo/connectors/email`, new dep `read-excel-file`.

**Spec:** `docs/superpowers/specs/2026-11-24-big-events-design.md` (D1–D4, D13 retention, Constraints). Mockup: `docs/superpowers/specs/2026-11-24-big-events/event-screen.html`.

**Not in this stage (spec items moved later):** linking a big event to `events` rows (D1) moves to Stage 4, where the event page shows them; groups other than rooms, buses and publishing (D5) are Stage 2; messages (D6–D9) Stage 3; the web big event page and api "my view" (D8, D12) Stage 4; the app (D11) Stage 5; check-in (D10) and retiring the old Groups page (D13) Stage 6. Until Stage 4 the "connected" page offers only "Open in the app" and the store buttons.

## Global Constraints

- Bun only (`bun@1.3.1`); new shared versions go in the root `package.json` `catalog` and are referenced as `"catalog:"`.
- All data access through `@repo/api` / `@repo/api/server`; never import `appwrite`/`node-appwrite` directly.
- New tables are added by editing `packages/api/appwrite.config.json` (owner pushes, then regenerates types). Do not hand-edit `packages/api/types/appwrite.ts`; type new rows with local interfaces (`… extends Models.Row`).
- Every new table: `"$permissions": []`, `"rowSecurity": false`, `"databaseId": "app"`. Only server code reads them, after an access check (spec D13).
- **Never create Appwrite accounts or team memberships from ticket emails** (spec "Facts").
- **Only BI-linked accounts** (`app.user.student_id` set) may be linked to a participant, by any route (spec D4).
- **No participant names, emails or phones reach an AI model.** Column detection sends header names + value shapes only (spec D3).
- Email alone never identifies a participant (spec D3 "Re-import updates").
- Connect and help links stay **outside `/app/`** (spec D4).
- Admin UI copy never shows IDs, "segment", "topic" or column codes; every admin string lives in `packages/i18n/messages/{en,no}/adminPortal.json` under `bigEvents`; web strings in a new `bigEvents` namespace.
- `"use server"` files export only `async function`s; shared constants/helpers go in plain modules. After touching one, run `bun run build --filter=admin` (or `--filter=web`).
- Admin server actions: `requireAuth()`, access check, `logAuditEvent()` on mutations, `revalidatePath()`.
- New runtime env vars documented in each app's `.env.example`; build-time ones also in `turbo.json#tasks.build.env`.
- Connect reminder: once, **4 days** after the first connect email. Retention: **30 days** after `ends_at`.
- Do not push, deploy, push the Appwrite schema or write production data.

## Review Focus

1. **Spreadsheet cells that aren't text** — phone numbers stored as numbers (`91234567`, `4791234567`), ticket refs as numbers, dates as Date objects. Expect all cells converted to trimmed strings without scientific notation or lost digits. → Task 2 test `cellToString keeps long digit runs`.
2. **Tickster's real layout** — two title rows above the header (header on row 3) and blank or summary rows ("Totalt", empty name) below the data. Expect the header found and those rows skipped with a reason. → Task 2 `findHeaderRow` + Task 4 `skips rows without a name`.
3. **The same person twice in one file** (duplicate export rows) — expect one participant, not two, and the preview to say so. → Task 4 `dedupes identical people within one file`.
4. **Norwegian names in different casing and spacing** (`"ØYVIND  ås"` vs `"Øyvind Ås"`) — expect the same identity. → Task 3 `normalizeName`.
5. **Someone opens a connect link meant for another person** (the buyer taps a roommate's link) — expect a confirmation naming the ticket holder before anything is linked, refusal when the ticket is linked to another account, refusal when this account already holds another ticket in the big event. → Task 9 `linking.test.ts` + Task 12 page states and action tests.

---

## File map

**Shared (`packages/shared/big-events/`)** — add `"./big-events/*": "./big-events/*.ts"` to `packages/shared/package.json` `exports`.
- `tables.ts` — table ids + enum value lists.
- `types.ts` — row interfaces.
- `phone.ts` — `normalizePhone`.
- `connect-token.ts` — token derive/hash.
- `linking.ts` — server-only: find BI accounts by email, link/unlink rules.
- `email-layout.ts` — shared HTML/text email layout.
- `connect-email.ts` — connect / reminder email content (no + en).
- `delivery-queue.ts` — server-only: enqueue + process batch.
- `schema.test.ts` and a `*.test.ts` next to each module.

**Admin (`apps/admin/src/`)**
- `lib/big-events/access.ts` — D2 rules (pure).
- `lib/big-events/import/{cells,header-row,field-aliases,value-shape,normalize,plan-import}.ts` — pure import logic.
- `lib/big-events/import/parse-file.server.ts` — xlsx/csv/paste → `string[][]`.
- `lib/big-events/import/ai-mapping.server.ts` — AI fallback.
- `lib/big-events/reach.server.ts` — push-target lookup.
- `lib/big-events/kick-deliveries.ts` — POST to the api processor.
- `app/(portal)/_actions/big-events.ts`, `big-event-participants.ts`, `big-event-import.ts`, `big-event-linking.ts`.
- `app/(portal)/big-events/page.tsx`, `new/page.tsx`, `[id]/layout.tsx`, `[id]/page.tsx`, `[id]/participants/page.tsx`, `[id]/participants/import/page.tsx`, `[id]/settings/page.tsx`, `_components/*`.
- Modify: `lib/roles.ts`, `lib/nav-tree.ts`, `lib/nav-tree.test.ts`.

**API (`apps/api/src/app/api/cron/`)** — `big-event-deliveries/route.ts`, `cleanup-big-events/route.ts` (+ tests).

**Web (`apps/web/src/app/`)** — `(public)/connect/[token]/page.tsx`, `(public)/connect/help/page.tsx`, `actions/big-event-connect.ts`, `_components` beside them.

**Other** — `functions/scheduled-dispatch/*`, `apps/docs/content/docs/guide/big-events/*`, `packages/i18n/messages/*`, `.env.example` files.

---

### Task 1: Schema, table ids and row types

**Files:**
- Modify: `packages/api/appwrite.config.json` (append 5 entries to `"tables"`, same object shape as `member_pass_scanners`)
- Modify: `packages/shared/package.json` (`exports`)
- Create: `packages/shared/big-events/tables.ts`, `packages/shared/big-events/types.ts`
- Test: `packages/shared/big-events/schema.test.ts`

**Interfaces — Produces:**
- `BIG_EVENT_TABLES = { events: "big_events", participants: "big_event_participants", groups: "big_event_groups", groupMembers: "big_event_group_members", deliveries: "big_event_deliveries" } as const`
- `BIG_EVENT_STATUSES = ["draft","published","archived"] as const`; `GROUP_KINDS = ["bus","room","buddy","team","other"] as const`; `LINK_METHODS = ["email","connect","manual"] as const`; `DELIVERY_KINDS = ["connect","connect_reminder","message"] as const`; `DELIVERY_CHANNELS = ["email","push","sms"] as const`; `DELIVERY_STATUSES = ["pending","sending","sent","failed","skipped"] as const`; `GROUP_LEGS = ["out","home"] as const`; `SUGGESTION_REASONS = ["phone","name"] as const`; each with a matching union type (`BigEventStatus`, `GroupKind`, …).
- Row interfaces (all `extends Models.Row`, optional columns typed `T | null`): `BigEventRow`, `BigEventParticipantRow`, `BigEventGroupRow`, `BigEventGroupMemberRow`, `BigEventDeliveryRow` with exactly the columns below.

Columns (string sizes in brackets; `req` = required; everything else `required: false`, `default: null` unless given):

| Table | Columns | Indexes |
|---|---|---|
| `big_events` | `name_no`[200] req, `name_en`[200], `slug`[120] req, `campus_id`[8] req, `department_id`[36], `starts_at` datetime req, `ends_at` datetime req, `place_name`[200], `place_address`[300], `hero_image_url`[1000], `status` enum(statuses) default `"draft"`, `travel_enabled` boolean default `false`, `group_checkin_enabled` boolean default `false`, `created_by`[36] | `slug_unique` unique [slug]; key [campus_id]; key [department_id]; key [status] |
| `big_event_participants` | `big_event_id`[36] req, `first_name`[100] req, `last_name`[100], `ticket_email`[320], `phone`[32], `campus_id`[8], `ticket_ref`[64], `ticket_category`[200], `room_size` integer (min 1, max 20), `last_import_id`[36], `user_id`[36], `linked_at` datetime, `link_method` enum(link methods), `connect_nonce`[64], `connect_token_hash`[64], `connect_sent_at` datetime, `connect_reminded_at` datetime, `membership_valid` boolean, `membership_checked_at` datetime, `suggested_user_id`[36], `suggested_reason` enum(reasons), `dismissed_user_id`[36] | key [big_event_id]; key [big_event_id,user_id]; key [big_event_id,ticket_email]; key [big_event_id,campus_id]; key [connect_token_hash] |
| `big_event_groups` | `big_event_id`[36] req, `kind` enum(kinds) req, `name`[200] req, `campus_id`[8], `capacity` integer (min 1, max 200), `contact_name`[120], `contact_phone`[32], `contact_user_id`[36], `note`[2000], `room_number`[40], `source_key`[200], `booking_participant_id`[36] | key [big_event_id]; key [big_event_id,kind]; key [big_event_id,source_key] |
| `big_event_group_members` | `big_event_id`[36] req, `group_id`[36] req, `participant_id`[36] req, `leg` enum(legs), `pinned` boolean default `false`, `assigned_at` datetime | key [big_event_id]; key [group_id]; key [participant_id] |
| `big_event_deliveries` | `big_event_id`[36] req, `kind` enum(delivery kinds) req, `channel` enum(channels) req, `to_address`[320], `participant_ids`[36] **array**, `message_id`[36], `status` enum(statuses) default `"pending"`, `attempts` integer default `0`, `last_error`[500], `claimed_by`[36], `claimed_at` datetime, `sent_at` datetime, `scheduled_for` datetime | key [status,scheduled_for]; key [big_event_id]; key [message_id] |

- [ ] **Step 1: Write the failing test** `packages/shared/big-events/schema.test.ts` (vitest, read the config like `utils/notification-topics-config.test.ts`):
  - `it("defines every big event table service-only")`: for each value of `BIG_EVENT_TABLES`, the table exists with `databaseId === "app"`, `$permissions` equal `[]`, `rowSecurity === false`.
  - `it("matches the enum lists")`: `big_events.status.elements` equals `BIG_EVENT_STATUSES`; same for `kind`, `link_method`, `channel`, `status` (deliveries), `leg`, `suggested_reason`.
  - `it("has the columns the row types use")`: a `const EXPECTED_COLUMNS: Record<string, string[]>` listing the keys from the table above; assert the set of column keys equals it per table.
  - `it("indexes slug uniquely")`: `big_events` has an index of `type: "unique"` on `["slug"]`.
- [ ] **Step 2:** Run `cd packages/shared && bunx vitest run big-events/schema.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Write `tables.ts`, `types.ts`, add the `exports` entry, and append the five table objects to `appwrite.config.json` (copy key order and field set from `member_pass_scanners`; enums use `"format": "enum", "elements": [...]`; integers carry `"min"`/`"max"`; indexes `"status": "available"`, `"orders": []` per column).
- [ ] **Step 4:** Run the test → PASS. Run `bun --filter=@repo/shared check-types` → no errors.
- [ ] **Step 5: Commit** `feat(big-events): schema, table ids and row types`

---

### Task 2: Reading spreadsheets (cells, header row, field aliases, value shapes)

**Files:**
- Create: `apps/admin/src/lib/big-events/import/cells.ts`, `header-row.ts`, `field-aliases.ts`, `value-shape.ts`, `parse-file.server.ts`
- Test: one `*.test.ts` beside each (bun:test)
- Modify: root `package.json` catalog (`"read-excel-file"`: latest 5.x), `apps/admin/package.json` (`"read-excel-file": "catalog:"`)

**Interfaces — Produces:**
- `type ImportField = "first_name" | "last_name" | "full_name" | "email" | "phone" | "campus" | "ticket_ref" | "ticket_category" | "group" | "ignore"`
- `cellToString(value: unknown): string` — `null/undefined → ""`; numbers → integer digits without exponent (`Number.isSafeInteger` → `String`, else `toLocaleString("fullwide", { useGrouping: false })`); `Date → ISO date`; trims.
- `findHeaderRow(rows: string[][]): number` — first index among the first 10 rows whose cells match ≥ 2 known aliases; else the first row with ≥ 2 non-empty cells; `-1` for an empty sheet.
- `FIELD_ALIASES: Record<Exclude<ImportField,"ignore">, readonly string[]>` and `matchHeader(header: string): ImportField | null` (case-, accent-, punctuation-insensitive). Must include Tickster's headers: `Navn`→first_name, `Etternavn`→last_name, `E-post`→email, `Mobilnr`→phone, `Ref.nr.`→ticket_ref, `Billettkategori`→ticket_category; plus English/Norwegian variants (`First name`, `Fornavn`, `Last name`, `Name`/`Fullt navn`→full_name, `Email`/`Epost`, `Phone`/`Mobil`/`Telefon`, `Campus`, `Order`/`Ordrenr`/`Reference`, `Ticket type`/`Billettype`, `Room`/`Rom`, `Bus`/`Buss`, `Group`/`Gruppe`, `Faddergruppe`). **Note** Tickster's `Navn` is the first name because `Etternavn` follows; `matchHeaders(headers: string[]): (ImportField|null)[]` resolves `Navn` to `full_name` when no last-name column exists.
- `describeValueShape(values: string[]): string` — one short phrase from ≤ 20 non-empty values, built only from character classes, e.g. `"text@domain"`, `"+47 and 8 digits"`, `"8 digits"`, `"one or two capitalized words"`, `"text with a city name and a number"`, `"number 1–4"`, `"empty"`; never echoes a value.
- `parseImportFile(input: { kind: "xlsx"; data: ArrayBuffer } | { kind: "csv" | "paste"; text: string }): Promise<string[][]>` — xlsx via `read-excel-file/node` (first sheet; Tickster's sheet is "Kjøperliste"); CSV auto-detects `;` vs `,`, quoted fields; paste splits on tabs. Every cell through `cellToString`.

- [ ] **Step 1: Write the failing tests:**
  - `cells.test.ts`: `cellToString(91234567) === "91234567"`; `cellToString(4791234567) === "4791234567"`; `cellToString(1.2e21)` has no `"e"`; `cellToString(new Date("2026-10-01T00:00:00Z")) === "2026-10-01"`; `cellToString("  a ")==="a"` — test name `keeps long digit runs`.
  - `header-row.test.ts`: rows `[["Kjøperliste"],[""],["Navn","Etternavn","E-post","Mobilnr"],["Ola","N","o@x.no","912"]]` → `2`; `[]` → `-1`; rows with no alias but a 3-cell first row → `0`.
  - `field-aliases.test.ts`: `matchHeaders(["Navn","Etternavn","E-post","Mobilnr","Ref.nr.","Billettkategori"])` → `["first_name","last_name","email","phone","ticket_ref","ticket_category"]`; `matchHeaders(["Navn","E-post"])[0] === "full_name"`; `matchHeader("Rom") === "group"`; `matchHeader("Kjøp fullført") === null`.
  - `value-shape.test.ts`: emails → `"text@domain"`; `["+4791234567"]` → contains `"8 digits"`; result for `["Ola Nordmann"]` does not contain `"Ola"`; `[]` → `"empty"`.
  - `parse-file.server.test.ts`: CSV `"a;b\n1;\"x;y\""` → `[["a","b"],["1","x;y"]]`; paste `"a\tb\n1\t2"` → `[["a","b"],["1","2"]]`. (xlsx path covered by a fixture: create `apps/admin/src/lib/big-events/import/__fixtures__/tickster-purchasers.xlsx` with 2 title rows, the header on row 3 and 3 data rows incl. a numeric phone; assert row 2 is the header and the phone is `"91234567"`.)
- [ ] **Step 2:** `cd apps/admin && bun test src/lib/big-events/import` → FAIL.
- [ ] **Step 3:** Implement the five modules with the signatures above. `bun add read-excel-file --filter=admin` then convert to `catalog:`.
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5: Commit** `feat(big-events): read spreadsheets and recognise columns`

---

### Task 3: Normalizers (phone, names, campus, room size)

**Files:**
- Create: `packages/shared/big-events/phone.ts` (+ test, vitest)
- Create: `apps/admin/src/lib/big-events/import/normalize.ts` (+ test, bun:test)

**Interfaces — Produces:**
- `normalizePhone(raw: string | null | undefined): string | null` — strips spaces/dashes/parens; `00` → `+`; 8 digits → `+47` + digits; `47` + 8 digits → `+47…`; already `+` → kept; anything else with < 8 digits → `null`.
- `phoneVariants(normalized: string): string[]` — the formats a profile may hold for a `+47` number: `["+4791234567","4791234567","91234567","+47 91234567","+47 912 34 567","912 34 567"]` (used for suggestion lookups, Task 9).
- `normalizeName(value: string): string` — NFC, lowercase (locale `nb`), collapse whitespace, trim. Keeps `æøå`.
- `splitFullName(full: string): { first: string; last: string | null }` — last word is the last name.
- `parseCampus(text: string | null | undefined): string | null` — finds `oslo|bergen|trondheim|stavanger` (case-insensitive, word boundary) → `"1"|"2"|"3"|"4"` via `CAMPUS_NAME_TO_ID` from `apps/admin/src/lib/campus-constants.ts` (import it; do not duplicate ids).
- `parseRoomSize(text: string | null | undefined): number | null` — `"4-Person"`, `"4 person"`, `"4-personsrom"`, `"Enkeltrom"`→1, `"Dobbeltrom"`→2; else `null`.
- `normalizeEmail(raw): string | null` — trim + lowercase; `null` without `@`.

- [ ] **Step 1: Write failing tests** with these cases: `normalizePhone("912 34 567")==="+4791234567"`; `("+47 91234567")`; `("004791234567")`; `("4791234567")`; `("123")===null`. `normalizeName("ØYVIND  ås ")===normalizeName("Øyvind Ås")` (test name `normalizeName treats casing and spacing as the same`). `splitFullName("Ola Johan Nordmann")` → `{first:"Ola Johan", last:"Nordmann"}`. `parseCampus("1 x Bergen - BISO - 4-Person")==="2"`; `parseCampus("BISO")===null`. `parseRoomSize("1 x Bergen - BISO - 4-Person")===4`.
- [ ] **Step 2:** Run (`packages/shared`: `bunx vitest run big-events/phone.test.ts`; admin: `bun test src/lib/big-events/import/normalize.test.ts`) → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5: Commit** `feat(big-events): normalise phones, names, campus and room size`

---

### Task 4: Import planning (identity, rooms, placement)

The heart of D3, pure and exhaustively tested.

**Files:**
- Create: `apps/admin/src/lib/big-events/import/plan-import.ts`
- Test: `apps/admin/src/lib/big-events/import/plan-import.test.ts`

**Interfaces — Consumes:** Task 1 row types; Task 2 `ImportField`; Task 3 normalizers.
**Produces:**
```ts
export interface ImportMapping { columns: ImportField[] } // one per header cell
export interface ImportOptions {
  defaultCampusId: string | null;          // used when no campus column/category
  groupKind: GroupKind | null;             // what the "group" column means
  roomBookings: boolean;                   // "Each row is a room booking"
}
export interface ParsedPerson { rowNumber: number; firstName: string; lastName: string | null;
  email: string | null; phone: string | null; campusId: string | null; ticketRef: string | null;
  ticketCategory: string | null; roomSize: number | null; groupValue: string | null }
export interface ImportPlan {
  create: ParsedPerson[];
  update: { participantId: string; person: ParsedPerson; changes: Partial<BigEventParticipantRow> }[];
  duplicatesInFile: number;
  skipped: { rowNumber: number; reason: "no_name" | "no_contact" }[];
  missingFromFile: string[];                       // existing participant ids not seen
  newGroups: { key: string; kind: GroupKind; name: string; campusId: string | null; capacity: number | null; bookingRowNumber: number | null }[];
  placements: { person: ParsedPerson | { participantId: string }; groupKey: string; rule: "group_column" | "booking" | "order_number" | "buyer_contact" }[];
  unplaced: ParsedPerson[];                        // land in "Not in a room yet"
  overfullRooms: string[];                         // group keys
  noCampus: number;
}
export function parsePeople(rows: string[][], headerRow: number, mapping: ImportMapping, options: ImportOptions): { people: ParsedPerson[]; skipped: ImportPlan["skipped"]; duplicatesInFile: number }
export function planImport(input: { people: ParsedPerson[]; skipped: ImportPlan["skipped"]; duplicatesInFile: number;
  options: ImportOptions; existing: BigEventParticipantRow[]; groups: BigEventGroupRow[]; members: BigEventGroupMemberRow[] }): ImportPlan
export function sameIdentity(a: { firstName: string; lastName: string | null; email: string | null; phone: string | null; ticketRef: string | null }, b: same shape): boolean
```
Rules (spec D3), to implement exactly:
- **Skip** a row with no first name (`no_name`, includes "Totalt"-style summary rows where only a total cell is filled) or with neither email nor phone (`no_contact`).
- **Campus:** campus column → `parseCampus`; else `parseCampus(ticketCategory)`; else `options.defaultCampusId`; else `null` (counted in `noCampus`).
- **Room size:** `parseRoomSize(ticketCategory)`.
- **Identity (`sameIdentity`):** same normalized full name AND (same email OR same phone), or same `ticketRef` AND same normalized full name. Email alone never matches.
- **Duplicates in the file:** people with the same identity collapse into one (first wins, later rows fill empty fields), counted in `duplicatesInFile`.
- **Update:** an existing participant matching by identity → `update` with only the fields the new row has and that differ; never touches `user_id`, `linked_at`, `link_method`.
- **missingFromFile:** existing participant ids matched by no person.
- **Group column** (`groupKind` set), spec rule 1: for each distinct non-empty value, when `groupKind === "room"` first look for an existing room whose `source_key` is `booking:<value>` (the value is a Payment 1 order number); otherwise use a group keyed `col:<normalized value>` (reuse an existing one with that `source_key`, else create it). Each person is placed with rule `group_column`.
- **Room bookings** (`roomBookings` true and no group column): each person → a room keyed `booking:<ticketRef ?? "row" + rowNumber>`, name = buyer full name (the UI prefixes the kind, e.g. "Room · Ola Nordmann"), capacity = `roomSize`, the buyer placed with rule `booking`; reuse an existing room with that `source_key`.
- **Placing into existing rooms** (no group column and not room bookings), spec rules 2–3: for every created/updated person not already in a room, try in order: **order number** — another person in this file or an existing participant with the same `ticketRef` is in a room (existing membership, or a placement earlier in this plan) → that room, rule `order_number`; **buyer contact** — a room whose `booking_participant_id` participant has the same email or phone → that room, rule `buyer_contact`. Otherwise → `unplaced`.
- **Overfull:** after placements, any room whose members + placements exceed `capacity` → `overfullRooms`.

- [ ] **Step 1: Write failing tests** (names are the assertions):
  - `skips rows without a name` (a trailing `["","","","","Totalt","12"]` row → `skipped[0].reason==="no_name"`).
  - `dedupes identical people within one file` (two identical rows → `create.length===1`, `duplicatesInFile===1`).
  - `does not treat a shared email as one person` (Ola and Kari with the same email → 2 creates).
  - `matches an existing participant by name and phone after the email changed` → `update.length===1`, no create.
  - `never clears an account link on update` (existing row with `user_id` → `changes` has no `user_id` key).
  - `room bookings create one room per booking with open places` (Payment 1 fixture `1 x Bergen - BISO - 4-Person` → `newGroups[0]` `{kind:"room", capacity:4, campusId:"2"}`, buyer placed `booking`).
  - `places a Payment 2 traveller by order number`, `places by the buyer's email`, `leaves unknown travellers unplaced`, `a room column holding a Payment 1 order number fills that booking's room`.
  - `flags a room with more people than places`.
  - `uses the default campus when the file has none` and `counts people with no campus`.
  - `reuses an existing room on re-import` (existing group with `source_key: "booking:A-1"` → no new group).
- [ ] **Step 2:** `bun test src/lib/big-events/import/plan-import.test.ts` → FAIL.
- [ ] **Step 3:** Implement `parsePeople`, `sameIdentity`, `planImport`.
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5: Commit** `feat(big-events): plan imports with identities and rooms`

---

### Task 5: AI fallback for unrecognised columns

**Files:**
- Create: `apps/admin/src/lib/big-events/import/ai-mapping.server.ts`
- Test: `apps/admin/src/lib/big-events/import/ai-mapping.server.test.ts`

**Interfaces — Consumes:** `describeValueShape`, `ImportField`.
**Produces:** `suggestColumnsWithAi(columns: { index: number; header: string; shape: string }[]): Promise<Record<number, ImportField>>` — `import "server-only"`; `generateObject({ model: fastModel, reasoning: "low", schema, prompt })` wrapped in `traceAiCall({ functionId: "admin.big-events.column-mapping", model: fastModel, operation: "generate_object" }, …)` exactly as `apps/admin/src/lib/content-translation.server.ts` does. The zod schema is `z.object({ columns: z.array(z.object({ index: z.number().int(), field: z.enum([...ImportField values]) })) })`. Returns `{}` on any error (the admin then picks by hand). Only called for columns `matchHeaders` left `null`.

- [ ] **Step 1: Failing tests** (bun:test, `mock.module("ai", …)` capturing the `generateObject` argument; `mock.module("@repo/observability/ai", () => ({ traceAiCall: (_m, fn) => fn() }))`):
  - `sends header names and shapes only`: call with `{ index: 3, header: "Kolonne D", shape: "text@domain" }`; assert the captured `prompt` contains `"Kolonne D"` and `"text@domain"`, and the test asserts the module's exported signature takes no row values (type-level: the input type has only `index/header/shape`).
  - `maps the model's answer to fields`: model returns `{ columns: [{ index: 3, field: "email" }] }` → `{ 3: "email" }`.
  - `returns nothing when the model fails` → `{}`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(big-events): AI column suggestions from headers and value shapes`

---

### Task 6: Access rules, nav entry and labels

**Files:**
- Create: `apps/admin/src/lib/big-events/access.ts` (+ `access.test.ts`)
- Modify: `apps/admin/src/lib/roles.ts` (add `"portal.bigEvents": [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, DEPARTMENT_ROLE]`), `apps/admin/src/lib/nav-tree.ts` (leaf `bigEvents` → `/big-events`, icon `Mountain` from lucide, inside the `content` group right after `events`), `apps/admin/src/lib/nav-tree.test.ts` (department member now sees `["pages","news","events","bigEvents"]`), `packages/i18n/messages/{en,no}/adminPortal.json` (nav label `"bigEvents": "Big events"` / `"Store arrangementer"`, plus a `bigEvents` section filled by later tasks)

**Interfaces — Consumes:** `UserAuthContext`, `NATIONAL_CAMPUS_ID` (`apps/admin/src/lib/event-scope.ts`), `BigEventRow`.
**Produces:**
```ts
export type BigEventAccess = { level: "full" } | { level: "campus"; campusIds: string[] } | null;
export function bigEventAccess(ctx: UserAuthContext, event: Pick<BigEventRow, "campus_id" | "department_id">): BigEventAccess
export function canCreateBigEvent(ctx: UserAuthContext, campusId: string): boolean
export function canEditBigEventSettings(access: BigEventAccess): boolean // full only
export function visibleBigEventFilters(ctx: UserAuthContext): string[]   // Query strings for listRows
export function participantCampusFilter(access: BigEventAccess): string[] // [] for full; Query.equal("campus_id", ids) for campus
export function canSeeParticipant(access: BigEventAccess, participant: Pick<BigEventParticipantRow, "campus_id">): boolean
```
Rules (spec D2):
- Global admin → `full` on every big event; may create anywhere.
- Owning department member (`event.department_id ∈ ctx.resolvedDepartmentIds`) → `full`.
- Campus admin with `event.campus_id ∈ ctx.managedCampusIds` (a campus big event) → `full`.
- Campus admin and `event.campus_id === NATIONAL_CAMPUS_ID` → `{ level: "campus", campusIds: ctx.managedCampusIds }`.
- Anyone else → `null`. `full` wins when several apply.
- `canCreateBigEvent`: global admin any campus; campus admin only for a managed campus that is not National.
- `visibleBigEventFilters`: global admin → `[]` (or `[Query.equal("campus_id",[ctx.activeCampusId])]` when set); otherwise `[Query.or([...])]` of `campus_id ∈ managed ∪ {National}` (campus admins) and `department_id ∈ resolvedDepartmentIds` (department members); a user with neither → `[NO_MATCH_FILTER]` (from `lib/utils/authorization.ts`).
- `canSeeParticipant` with `campus` level: only `campus_id ∈ campusIds`; a participant with `campus_id === null` → `false`.

- [ ] **Step 1: Failing tests** (bun:test, build contexts like `composer.test.ts`'s `baseCtx`): one test per rule above, plus `a Bergen campus admin sees only Bergen participants in Winter Games` and `nobody but full access sees a participant without a campus`.
- [ ] **Step 2:** Run `bun test src/lib/big-events/access.test.ts src/lib/nav-tree.test.ts` → FAIL.
- [ ] **Step 3:** Implement; add the nav key, leaf, test update and labels.
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5: Commit** `feat(big-events): access rules and admin nav entry`

---

### Task 7: Big events list, create and settings

**Files:**
- Create: `apps/admin/src/app/(portal)/_actions/big-events.ts` (+ `big-events.test.ts`)
- Create: `apps/admin/src/app/(portal)/big-events/page.tsx`, `new/page.tsx`, `[id]/layout.tsx`, `[id]/page.tsx` (redirects to `participants`), `[id]/settings/page.tsx`, `_components/big-event-list.tsx`, `_components/big-event-form.tsx`, `_components/big-event-tabs.tsx`
- Create: `apps/admin/src/lib/big-events/slug.ts` (`slugifyBigEventName(name: string): string`, ASCII, `æ→ae ø→o å→a`, max 120) + test

**Interfaces — Consumes:** Task 6 access functions; Task 1 types/tables.
**Produces (server actions, `"use server"`):**
- `listBigEvents(): Promise<BigEventListItem[]>` — `BigEventListItem = BigEventRow & { participantCount: number; linkedCount: number; access: "full" | "campus" }`, ordered by `starts_at` desc, filtered by `visibleBigEventFilters`, then `bigEventAccess` per row (drop `null`). Counts for `campus` level only include their campuses.
- `getBigEvent(id: string): Promise<{ event: BigEventRow; access: Exclude<BigEventAccess, null> } | null>` — `null` when missing or no access. Later tasks call this first in every action.
- `createBigEvent(values: BigEventFormValues): Promise<{ id: string }>` — validates with a zod schema `bigEventFormSchema` in a plain module `apps/admin/src/lib/big-events/form-schema.ts` (`name_no` 1–200 req, `name_en` ≤200, `campus_id` ∈ "1".."5", `department_id` optional, `starts_at` < `ends_at` ISO, place fields ≤ limits, `hero_image_url` url or empty, `travel_enabled`, `group_checkin_enabled`); requires `canCreateBigEvent`; generates a unique slug (append `-2`, `-3` on collision); `status: "draft"`; `created_by: ctx.userId`; audit `big_event.create`.
- `updateBigEvent(id: string, values: BigEventFormValues & { status: BigEventStatus }): Promise<void>` — requires `canEditBigEventSettings`; `campus_id` change only by global admins; audit `big_event.update`.
- All reads/writes with `createAdminClient()` after the access check.

UI:
- List page: `requireNavAccess("portal.bigEvents")`; `StudioPageHeader` "Big events" with "New big event" (`StudioLinkButton`, shown when the user can create for any campus); one `StudioCard` per event: name, campus label, dates (`d. MMM yyyy`, `nb` locale when the admin locale is `no`), `StudioStatusPill` (Draft/Published/Archived), "142 participants · 37 connected". Empty state via `EmptyState` explaining what a big event is in one sentence.
- Form (shared by new + settings): Norwegian name, English name, campus (select; National shown only to global admins), board (`DepartmentCombobox`, filtered to the chosen campus), start/end (date + time), place, hero image (`ImageUploadField`), switches "Travel (buses)" and "Check-in for other groups" with one-line help, status (settings only). Plain labels from `adminPortal.bigEvents.form.*`.
- `[id]/layout.tsx`: `getBigEvent` (or `notFound()`), header with name + status pill + dates, tabs **Participants · Settings** (Settings hidden unless `full`). Later stages add tabs here.

- [ ] **Step 1: Failing tests** (`big-events.test.ts`, bun:test, mocks as in `composer.test.ts`): `campus admin cannot create a national big event`; `department member sees only their board's big events` (assert the `listRows` queries include the department filter); `creating picks a free slug` (`winter-games-2027` taken → `winter-games-2027-2`); `update refuses campus-level access`; `campus change needs a global admin`. Plus `slug.test.ts`: `slugifyBigEventName("Fadderullan Bergen 2027 – Ø")==="fadderullan-bergen-2027-o"`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement actions, schema module and pages. **Step 4:** Tests → PASS; `bun --filter=admin check-types`; `bun run build --filter=admin` compiles.
- [ ] **Step 5: Commit** `feat(big-events): list, create and settings in admin`

---

### Task 8: Participants tab (list, reach, membership, add/edit/remove)

**Files:**
- Create: `apps/admin/src/app/(portal)/_actions/big-event-participants.ts` (+ test)
- Create: `apps/admin/src/lib/big-events/reach.server.ts` (+ test)
- Create: `apps/admin/src/app/(portal)/big-events/[id]/participants/page.tsx`, `_components/participant-table.tsx`, `_components/participant-dialog.tsx`, `_components/reach-summary.tsx`

**Interfaces — Consumes:** `getBigEvent`, access helpers, `normalizePhone`, `normalizeEmail`, `sanitizeStudentNumber` (`@repo/shared/utils/bi-student`), `getScanMembershipStatus(studentNumber)` (`apps/admin/src/lib/member-pass/membership-lookup.ts`).
**Produces:**
- `getPushReach(userIds: string[]): Promise<Set<string>>` (`reach.server.ts`) — `users.get(id)` per id, concurrency 8, `targets.some(t => t.providerType === "push")`; per-id results cached with `unstable_cache` (`revalidate: 300`, tag `big-event-reach`); failures count as no push.
- `type ReachPile = "push" | "app_no_push" | "email"` and `reachPile(p: { user_id: string | null }, push: Set<string>): ReachPile` — linked + push → `push`; linked without push → `app_no_push`; unlinked → `email`. (Pure; export from `apps/admin/src/lib/big-events/reach.ts`.)
- `listParticipants(bigEventId: string): Promise<{ rows: ParticipantListItem[]; counts: Record<ReachPile, number>; noCampus: number }>` — all participants visible to the caller (`participantCampusFilter`, paginate 100 at a time until done), each `ParticipantListItem = BigEventParticipantRow & { pile: ReachPile; roomName: string | null; accountName: string | null; accountEmail: string | null }`.
- `addParticipant(bigEventId, values: ParticipantFormValues)`, `updateParticipant(id, values)`, `removeParticipants(ids: string[])` — `full` or the participant's campus within `campus` access; remove deletes memberships too; audit `big_event.participant.{add,update,remove}`.
- `checkMemberships(bigEventId: string): Promise<{ checked: number; invalid: number }>` — for linked participants, read `app.user.student_id`, `sanitizeStudentNumber`, `getScanMembershipStatus`; write `membership_valid` + `membership_checked_at`; concurrency 4; a lookup error leaves the old value.
- `exportParticipantsCsv(bigEventId: string, pile: ReachPile | "all"): Promise<string>` — columns first name, last name, email, phone, campus, room; reuse the escaping in `apps/admin/src/lib/orders-csv.ts`.

UI: reach summary on top ("In the app with notifications: 81 · In the app without notifications: 12 · Not in the app yet: 49") — each a filter chip; campus filter (only for `full`); search by name/email; table: name, campus, room, status ("Connected"/"Connect email sent 3 Dec"/"Not connected"), membership badge ("No valid membership" in claret when `membership_valid === false`), row menu (Edit, Remove, Link/Unlink from Task 9, Send again from Task 10). Toolbar: Import (Task 9 page), Add person, Check memberships, Copy emails (clipboard of the filtered pile), Download CSV. "Not in a room yet (N)" filter when any rooms exist.

- [ ] **Step 1: Failing tests:** `reach.test.ts` (`reachPile` three cases); `reach.server.test.ts` (`counts only users with a push target`, mock `users.get`); action tests `campus access lists only own-campus participants` (query includes `Query.equal("campus_id",["2"])`), `remove deletes the person's group memberships`, `membership check marks an invalid membership` (mock lookup → `isMember:false` → `membership_valid:false`), `csv export escapes commas`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Tests → PASS; check-types; admin build.
- [ ] **Step 5: Commit** `feat(big-events): participants tab with reach and membership`

---

### Task 9: Import wizard and linking

**Files:**
- Create: `apps/admin/src/app/(portal)/_actions/big-event-import.ts` (+ test)
- Create: `apps/admin/src/app/(portal)/_actions/big-event-linking.ts` (+ test)
- Create: `packages/shared/big-events/linking.ts` (+ test, vitest)
- Create: `apps/admin/src/app/(portal)/big-events/[id]/participants/import/page.tsx`, `_components/import-wizard.tsx`, `_components/column-mapping.tsx`, `_components/import-preview.tsx`, `_components/link-account-dialog.tsx`

**Interfaces — Consumes:** Tasks 2–5, 8; `searchPeople` pattern (`_actions/composer.ts:144`).
**Produces:**
- Shared `linking.ts` (`import "server-only"`):
  - `findBiLinkedAccountsByEmail(db, emails: string[]): Promise<Map<string, string>>` — `app.user` rows `Query.equal("email", chunk)` (chunks of 100), keep rows with a non-empty `student_id`, key by lowercased email → user id.
  - `type LinkRefusal = "not_bi_linked" | "linked_to_other" | "account_has_ticket"`
  - `linkParticipant(db, { participant: BigEventParticipantRow; userId: string; method: LinkMethod; now?: Date }): Promise<{ ok: true } | { ok: false; reason: LinkRefusal }>` — refuses when the user row has no `student_id`; when the participant is linked to another user; when another participant of the same big event has this `user_id`. Linking the same user again → `ok`. Writes `user_id`, `linked_at`, `link_method`, clears `suggested_user_id`/`suggested_reason`.
  - `unlinkParticipant(db, participantId: string): Promise<void>`.
- Import actions (each re-receives the file as `FormData` field `file` or `paste`, stateless):
  - `readImportFile(bigEventId: string, form: FormData): Promise<ImportColumns>` — `ImportColumns = { headerRow: number; headers: string[]; mapping: ImportField[]; sample: string[][]; rowCount: number; detected: { roomSizes: boolean; campus: boolean; group: boolean } }`; `mapping` from `matchHeaders`, then `suggestColumnsWithAi` for the gaps; `sample` = first 5 data rows (shown to the admin only).
  - `previewImport(bigEventId, form, mapping: ImportMapping, options: ImportOptions): Promise<ImportPreview>` — runs `parsePeople` + `planImport` against the caller-visible participants/groups/members and returns counts + the first 20 unplaced names + the missing list.
  - `applyImport(bigEventId, form, mapping, options): Promise<ImportResult>` — recomputes the plan (never trusts a client plan), creates `last_import_id = ID.unique()`, writes creates/updates (`ticket_email` normalized, `phone` normalized), new groups, memberships (no `leg` for rooms), sets `last_import_id` on every seen participant, then **links by email** with `findBiLinkedAccountsByEmail` + `linkParticipant(method: "email")`, then runs `findSuggestions` for the new unlinked ones (cap 200). Campus access: rows whose campus isn't the caller's are skipped and counted (`outsideYourCampus`). Audit `big_event.import` with counts only (no personal data in the audit payload).
- Linking actions:
  - `searchAccountsForLink(bigEventId, query: string): Promise<LinkCandidate[]>` — like `searchPeople` but only BI-linked rows; `LinkCandidate = { id; name; email; campusName; hasTicketHere: boolean }`.
  - `linkParticipantManually(participantId, userId)` → `linkParticipant(method:"manual")`, maps refusals to plain messages (`adminPortal.bigEvents.link.refused.*`); `unlinkParticipantAction(participantId)`.
  - `findSuggestions(bigEventId, participantIds?: string[]): Promise<{ suggested: number }>` — for unlinked participants without a suggestion: phone match (`Query.equal("phone", phoneVariants(p.phone))` on `app.user`, BI-linked only) → reason `phone`; else name match (`Query.contains("name", fullName)`, BI-linked, same `campus_id` when known, exactly one hit) → reason `name`; skip the user in `dismissed_user_id`; concurrency 5.
  - `acceptSuggestion(participantId)`, `dismissSuggestion(participantId)` (moves the id into `dismissed_user_id`).

Wizard UI (three steps on one page, client component holding the `File`): **1 Upload** (drop zone for .xlsx/.csv + "Or paste rows" textarea; "We only read the file, nothing is saved until you confirm"). **2 Check the columns**: one row per header: header text, two sample values, plain sentence from the field ("Looks like the email address"), dropdown to change (`Ignore this column` included); options shown when relevant: campus fallback select (when no campus found), "What is in column X?" Room/Bus/Buddy group/Team (when a group column is mapped), checkbox "Each row is a room booking (we'll keep open places for the roommates)" (on by default when room sizes are found and no group column). **3 Check and save**: "142 new · 230 updated · 3 already on the list but not in this file · 2 rows skipped" + expandable lists, rooms "38 new rooms", "12 people not in a room yet", warnings (overfull rooms, no campus, outside your campus). Save → back to Participants with a toast "Saved. 37 people were connected automatically."

Participant row additions: "Possible match: Kari Nordmann (kari@bi.no) · same phone" with **Link** / **Not them**; "Link account" opens `link-account-dialog` (search ≥ 2 chars); linked rows show the account email and "Unlink".

- [ ] **Step 1: Failing tests:**
  - `linking.test.ts`: `refuses an account without BI`; `refuses a ticket linked to someone else`; `refuses a second ticket for the same account in one big event`; `linking the same account twice is fine`; `findBiLinkedAccountsByEmail ignores accounts without a student number`.
  - `big-event-import.test.ts`: `apply recomputes the plan on the server` (client sends nothing but mapping/options; assert writes match the fixture); `apply links tickets bought with a BI email`; `apply never sends personal data to the AI` (spy on `suggestColumnsWithAi` input: only `index/header/shape`); `campus access skips other campuses' rows`.
  - `big-event-linking.test.ts`: `phone suggestion only proposes BI-linked accounts`; `a dismissed account is not suggested again`; `name suggestion needs exactly one hit`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement shared linking, actions, wizard and row additions. **Step 4:** Tests → PASS; check-types (admin + shared); admin build.
- [ ] **Step 5: Commit** `feat(big-events): import wizard and account linking`

---

### Task 10: Connect tokens, email layout and the delivery queue

**Files:**
- Create: `packages/shared/big-events/connect-token.ts`, `email-layout.ts`, `connect-email.ts`, `delivery-queue.ts` (+ tests, vitest)
- Create: `apps/admin/src/lib/big-events/kick-deliveries.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/big-event-participants.ts` (add the send actions), participants UI (buttons)

**Interfaces — Produces:**
- `connect-token.ts`:
  - `deriveConnectToken(secret: string, participantId: string, nonce: string): string` — base64url HMAC-SHA256 of `${participantId}:${nonce}`.
  - `hashConnectToken(token: string): string` — hex SHA-256.
  - `newConnectNonce(): string` — 16 random bytes hex.
  - The secret is env `BIG_EVENTS_CONNECT_SECRET` (apps/api only). Same participant + nonce → same token, so a reminder carries the same link as the first email.
- `email-layout.ts`: `renderEmail(input: { preheader: string; sections: { lang: "no" | "en"; heading: string; paragraphs: string[]; button?: { label: string; url: string } }[]; footer: string }): { html: string; text: string }` — inline-styled table layout (BISO navy `#001731`, white card, max width 560px), escapes all text, a hairline between language sections, text version mirrors it.
- `connect-email.ts`: `buildConnectEmail(input: { eventNameNo: string; eventNameEn: string | null; people: { firstName: string; lastName: string | null; url: string }[]; reminder: boolean; helpUrl: string }): { subject: string; html: string; text: string }`.
  - Subject: `"Koble billetten din til BISO · Connect your ticket – {eventNameNo}"`; reminder prefix `"Påminnelse: "`.
  - Norwegian first, then English. One person: button "Koble billetten min" / "Connect my ticket". Several people: one line per person "{First Last}: [Koble til]" plus "Send hver lenke til personen den gjelder." / "Send each link to the person it belongs to."
  - Body copy (fixed; no other wording): NO "Du er med på {event}! Koble billetten til BISO-kontoen din, så får du bussen, rommet ditt og alle oppdateringer på ett sted. Logg inn med BI-kontoen din." EN "You're going to {event}! Connect your ticket to your BISO account to get your bus, your room and every update in one place. Sign in with your BI account." Footer: "Fikk du ikke e-posten, eller gjelder den ikke deg? {helpUrl}" / "Wrong person, or lost the email? {helpUrl}".
- `delivery-queue.ts` (`import "server-only"`):
  - `enqueueConnectEmails(db, { bigEventId: string; participants: BigEventParticipantRow[]; kind: "connect" | "connect_reminder"; now?: Date }): Promise<{ queued: number; addresses: number }>` — only unlinked participants with a `ticket_email`; groups by `ticket_email`; one `pending` delivery per address with `participant_ids`; skips an address that already has a `pending`/`sending` delivery of the same kind for the same participants.
  - `processDeliveries(deps: { db; sendEmail: typeof import("@repo/connectors/email").sendEmail; secret: string; webBase: string; now?: () => Date; sleep?: (ms: number) => Promise<void> }, opts: { budgetMs: number; perMinute: number; runId: string }): Promise<{ sent: number; failed: number; remaining: number }>` — loop: list `status = "pending"` and (`scheduled_for` null or ≤ now), oldest first, limit 10; claim each (`status:"sending", claimed_by: runId, claimed_at`), re-read, skip unless `claimed_by === runId`; for `connect`/`connect_reminder`: load the participants, give each without `connect_nonce` a nonce + `connect_token_hash`, build URLs `${webBase}/connect/${token}` and help URL `${webBase}/connect/help`, `buildConnectEmail`, `sendEmail({ to, subject, html, text })`; mark `sent` + `sent_at`, set participants' `connect_sent_at` (first send) or `connect_reminded_at` (reminder); on error `attempts+1`, back to `pending` (or `failed` at 3 attempts) with `last_error` (message only, max 500). Waits `60000 / perMinute` ms between sends; stops when the budget is spent. Rows stuck in `sending` for > 10 minutes go back to `pending`. `message` kind is ignored here (Stage 3).
  - `enqueueDueReminders(db, now?: Date): Promise<number>` — participants with `connect_sent_at ≤ now − 4 days`, `connect_reminded_at` null, `user_id` null, in a big event that is `published` and not ended → `enqueueConnectEmails(kind: "connect_reminder")`.
- Admin:
  - `kickDeliveries(): Promise<void>` (`kick-deliveries.ts`, plain module) — `fetch(`${NEXT_PUBLIC_API_BASE_URL}/api/cron/big-event-deliveries`, { method: "POST", headers: { "x-cron-secret": CRON_SECRET } })` without awaiting the body, errors swallowed (logged); the cron still picks it up.
  - Actions `sendConnectEmails(bigEventId: string, participantIds?: string[]): Promise<{ queued: number }>` (all unlinked with email when ids omitted; caller must have access to each participant; refuses when the big event is `draft`) and the UI: toolbar "Send connect emails (49)", row menu "Send again". A `draft` big event shows "Publish the big event before sending connect emails" next to a disabled button.

- [ ] **Step 1: Failing tests:** `connect-token.test.ts` (`same participant and nonce give the same token`; `hash is 64 hex chars`; `different nonce, different token`). `connect-email.test.ts` (`norwegian comes before english`; `lists every person sharing an address`; `escapes names` — `<b>` in a name appears as `&lt;b&gt;`; `reminder subject starts with Påminnelse`). `delivery-queue.test.ts` (fake db): `one email per address for people sharing it`; `does not queue linked participants`; `a claimed row taken by another run is skipped`; `a failed send is retried then marked failed after 3 attempts`; `respects the per-minute pace` (inject `sleep`, assert called with `2400` for `perMinute: 25`); `reminder keeps the original link` (nonce untouched → same URL); `stuck sending rows are released after 10 minutes`; `enqueueDueReminders waits 4 days`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Tests → PASS; check-types; admin build.
- [ ] **Step 5: Commit** `feat(big-events): connect emails through a throttled delivery queue`

---

### Task 11: API cron routes (deliveries, reminders, retention) and dispatch targets

**Files:**
- Create: `apps/api/src/app/api/cron/big-event-deliveries/route.ts` (+ `route.test.ts`, vitest)
- Create: `apps/api/src/app/api/cron/cleanup-big-events/route.ts` (+ `route.test.ts`)
- Modify: `functions/scheduled-dispatch/src/main.ts` (`TARGET_ENV_VARS` += `BIG_EVENT_DELIVERIES_URL`, `BIG_EVENTS_CLEANUP_URL`; header comment; `TARGET_TIMEOUT_DEFAULTS.BIG_EVENT_DELIVERIES_URL = 60_000`), `functions/scheduled-dispatch/README.md`, `functions/scheduled-dispatch/.env.example`, `apps/docs/content/docs/developers/keep-it-running/scheduled-jobs.mdx`
- Modify: `apps/api/.env.example` (`BIG_EVENTS_CONNECT_SECRET`, `BIG_EVENTS_EMAILS_PER_MINUTE` default 25), `apps/admin/.env.example` (note that `NEXT_PUBLIC_API_BASE_URL` + `CRON_SECRET` are used to kick deliveries)

**Interfaces — Consumes:** Task 10; `webBaseUrl()` (`apps/api/src/lib/public-urls.ts`); `sendEmail`, `isSmtpConfigured`; the CRON_SECRET check from `api/cron/cleanup-member-pass/route.ts` (copy `readBearerToken`/`hasValidCronSecret`).
**Produces:**
- `POST /api/cron/big-event-deliveries` — 500 `not_configured` without `CRON_SECRET`, `BIG_EVENTS_CONNECT_SECRET` or a web base URL; 401 on a bad secret; 200 `{ skipped: "smtp_not_configured" }` when `!isSmtpConfigured()`. Otherwise `enqueueDueReminders`, then `processDeliveries({ budgetMs: 45_000, perMinute: Number(env) || 25, runId: crypto.randomUUID() })`; when `remaining > 0`, fire one follow-up `fetch` to its own URL (same secret header) without awaiting, so a large batch keeps flowing between cron runs. `maxDuration = 60`. Returns the counts.
- `POST /api/cron/cleanup-big-events` — for big events with `ends_at ≤ now − 30 days`: delete their participants, group memberships and deliveries in batches (`Query.limit(100)`, ≤ 10 batches per table per run, like `cleanup-member-pass`); keeps `big_events` and `big_event_groups` rows. Returns `{ participantsDeleted, membersDeleted, deliveriesDeleted }`.

- [ ] **Step 1: Failing tests** (vitest, mocks as in `cleanup-member-pass/route.test.ts`): deliveries route `rejects a wrong secret`, `skips when SMTP is not configured`, `processes and re-kicks when work remains` (mock `processDeliveries` → `remaining: 3`, assert `fetch` called with the route URL and `x-cron-secret`); cleanup route `deletes participants 30 days after the end` and `leaves a big event that ended 29 days ago alone`.
- [ ] **Step 2:** `cd apps/api && NODE_ENV=test bunx vitest run src/app/api/cron/big-event-deliveries src/app/api/cron/cleanup-big-events` → FAIL.
- [ ] **Step 3:** Implement routes, dispatch targets and docs rows.
- [ ] **Step 4:** Tests → PASS; `bun --filter=api check-types`; `bun --filter=scheduled-dispatch test` if the function has tests (else its type check).
- [ ] **Step 5: Commit** `feat(big-events): delivery, reminder and retention cron routes`

---

### Task 12: Web connect page and "Didn't get the email?"

**Files:**
- Create: `apps/web/src/app/(public)/connect/[token]/page.tsx`, `apps/web/src/app/(public)/connect/[token]/connect-states.tsx` (client), `apps/web/src/app/(public)/connect/help/page.tsx`, `apps/web/src/app/(public)/connect/help/help-form.tsx` (client)
- Create: `apps/web/src/app/actions/big-event-connect.ts` (`"use server"`) (+ test)
- Create: `packages/i18n/messages/{en,no}/bigEvents.json`; register the namespace in `packages/i18n/messages/{en,no}.ts`, `messages/index.ts` `messageNamespaces`, `types.ts`

**Interfaces — Consumes:** `hashConnectToken`, `linkParticipant`, `enqueueConnectEmails`, `getLoggedInUser()` (`apps/web/src/lib/actions/user.ts`), `NeedsBiSignInState` / `SignedOutState` patterns (`apps/web/src/app/(public)/membership/join/gate-states.tsx`), `createRateLimiter` + `clientKeyFromHeaders` (`apps/web/src/lib/rate-limit.ts`).
**Produces:**
- `resolveConnectToken(token: string): Promise<ConnectView>` (server-only helper in the page module or `apps/web/src/lib/big-events/connect.ts`) — `ConnectView = { state: "invalid" } | { state: "ended" } | { state: "signed_out"; eventName } | { state: "needs_bi"; eventName } | { state: "confirm"; eventName; holderName; accountEmail } | { state: "connected"; eventName; slug } | { state: "linked_to_other" } | { state: "account_has_ticket"; eventName }`. Looks up the participant by `connect_token_hash`; the big event must be `published` and not ended. Uses the admin client (server-only).
- `connectTicket(token: string): Promise<{ ok: true } | { ok: false; reason: LinkRefusal | "invalid" }>` — server action: re-resolves, requires a signed-in BI-linked user, `linkParticipant(method:"connect")`, `revalidatePath`.
- `requestConnectLink(email: string): Promise<{ ok: true }>` — always `{ ok: true }` (no enumeration); rate limit `createRateLimiter({ limit: 5, windowMs: 3_600_000 })` per client key and a second limiter per normalized email (`limit: 3`); when the email matches unlinked participants (`ticket_email`) of published, not-ended big events → `enqueueConnectEmails(kind:"connect")` for each big event, then a fire-and-forget POST to `${NEXT_PUBLIC_API_BASE_URL}/api/cron/big-event-deliveries` with `CRON_SECRET`.

Page states (copy in `bigEvents.json`, both languages, plain):
- `confirm`: "Connect {holderName}'s ticket for {eventName} to your account ({accountEmail})?" + button "Connect my ticket" + small "Not {holderName}? Don't connect, send the link to the right person." **The page never links on GET** (email scanners open links); only the button does.
- `connected`: "You're connected! Your bus, room and updates will show in the BISO app." + "Open in the app" (link to `/app/big-events/{slug}`) + App Store / Google Play buttons (reuse the store links/components the site already uses for the app, search `apps.apple.com` in apps/web).
- `signed_out`: "Sign in with your BI account to connect your ticket" (BI sign-in, `redirectTo` = this path).
- `needs_bi`: reuse `NeedsBiSignInState` with `returnTo` = this path.
- `linked_to_other`: "This ticket is already connected to another account. Contact the organizers."
- `account_has_ticket`: "Your account already has a ticket for {eventName}."
- `invalid` / `ended`: "This link doesn't work anymore." + link to `/connect/help`.
- Help page: one email field, "Send me a new link", always answers "If that address is on a list, we've sent a link. Check your inbox and spam folder."

- [ ] **Step 1: Failing tests** (`apps/web/src/app/actions/big-event-connect.test.ts`, vitest; mock `@repo/api/server`, `@/lib/actions/user`, `next/headers`): `does not link without a signed-in BI account`; `links on confirm`; `reports a ticket linked to someone else`; `help answers the same whether or not the address exists`; `help is rate limited per address`. Plus a page-state unit test for `resolveConnectToken`: `an unknown token is invalid`, `a draft big event's token is invalid`, `an ended big event's token is ended`.
- [ ] **Step 2:** `cd apps/web && bunx vitest run src/app/actions/big-event-connect.test.ts` → FAIL.
- [ ] **Step 3:** Implement pages, actions, messages and namespace registration.
- [ ] **Step 4:** Tests → PASS; `bun --filter=web check-types`; `bun run build --filter=web`.
- [ ] **Step 5: Commit** `feat(big-events): connect tickets on the website`

---

### Task 13: Staff guide page and final verification

**Files:**
- Create: `apps/docs/content/docs/guide/big-events/index.mdx`, `apps/docs/content/docs/guide/big-events/import-and-connect.mdx`, `apps/docs/content/docs/guide/big-events/meta.json` (`{ "title": "Big events", "pages": ["index", "import-and-connect"] }`)
- Modify: `apps/docs/content/docs/guide/meta.json` (add `"big-events"` after `"events"`)

Content (follow `apps/docs/CLAUDE.md`): `who:` global admins, the owning board, campus admins (own campus). `covers:` `apps/admin/src/app/(portal)/big-events/**`, `apps/admin/src/app/(portal)/_actions/big-event*.ts`, `apps/admin/src/lib/big-events/**`, `packages/shared/big-events/**`, `apps/web/src/app/(public)/connect/**`, `apps/api/src/app/api/cron/big-event-deliveries/**`, `apps/api/src/app/api/cron/cleanup-big-events/**`. Explain: what a big event is; create one; import (any file, check the columns, room bookings with open places, "Not in a room yet"); the three reach lists; connect emails (website, shared emails, reminder after 4 days, "Didn't get the email?"); linking by hand and possible matches; membership warning; personal data deleted 30 days after the end.

- [ ] **Step 1:** Write the pages.
- [ ] **Step 2:** Run the full verification and expect zero errors / all tests passing (except the two known pre-existing failures noted in the event-RSVP memory: `benefits-schema` `campus_benefits read("any")` and admin `content-translation`):
  - `bun install` (worktree must have its own `node_modules`)
  - `bun run check-types`
  - `bun run lint`
  - `cd apps/admin && bun test src` · `cd packages/shared && bunx vitest run` · `cd apps/api && NODE_ENV=test bunx vitest run` · `cd apps/web && bunx vitest run`
  - `bun run build --filter=admin --filter=web --filter=api --filter=docs`
- [ ] **Step 3:** `bun x ultracite fix`, re-run lint.
- [ ] **Step 4: Commit** `docs(big-events): staff guide for big events`

---

## Owner steps after Stage 1 (go-live list, not for the builder)

- Push the five tables (`appwrite push tables`) and regenerate types.
- Set `BIG_EVENTS_CONNECT_SECRET` (random 32+ bytes) and optionally `BIG_EVENTS_EMAILS_PER_MINUTE` on the api deployment; confirm SMTP is configured on api and web and its sending limit.
- Add `BIG_EVENT_DELIVERIES_URL` and `BIG_EVENTS_CLEANUP_URL` to the `scheduled-dispatch` function in the Appwrite console.
- Deploy admin, web and api together.
