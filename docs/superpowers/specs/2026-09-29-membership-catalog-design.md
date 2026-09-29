# Membership catalog from 24SevenOffice — design

## Problem

`app.memberships` holds three hand-made rows (products 54, 71, 82 — the
fall 2026 semester, 1-year and 3-year plans). Everything that decides
membership joins a student's 24SO categories against this table, so any
category without a row does not count:

- The live check (`computeMembershipStatus`, used by the door scanner, the web
  member portal and `apps/api` `/api/membership`) reports **not a member**.
- The admin member roster omits them.

Read-only check against production on 2026-09-29: categories still valid today
but missing from the table are held by ~1,490 paying members (fall 2024 –
spring 2027: 686; fall 2025 – spring 2028: 575; spring 2026 – fall 2026: 163;
spring 2025 – fall 2027: 35; spring 2024 – fall 2026: 15; spring 2026 – fall
2028: 13).

Purchasability is also manual (`canPurchase`, `status` edited by hand), and
there is no way to buy next season's plan near the end of a season.

## What 24SO already has

Every plan exists as a **product and a category with the same name**, from
2021 through 2032 (62 products), e.g. product 81 / category 113174 "BISO
Membership fall 2025 - spring 2028". Names encode the term:

| Duration | Price | Fall-start name | Spring-start name |
|---|---|---|---|
| Semester | 350 | `fall 2026` | `spring 2027` |
| 1 year | 550 | `fall 2026 and spring 2027` | `spring 2026 - fall 2026` |
| 3 years | 1350 | `fall 2026 - spring 2029` | `spring 2026 - fall 2028` |

`syncMembershipsFrom24SO` (`packages/connectors/src/24sevenoffice/membership-sync.ts`)
already matches products to categories by name and parses dates from names,
but nothing calls it.

## Decisions

- **Seasons:** spring = 1 Jan – 30 Jun, fall = 1 Jul – 31 Dec (fall starts
  1 July, matching the current rows; the old parser used 1 August). A plan runs
  from its first season's start to its last season's end.
- **Membership counts only while `startDate ≤ today ≤ expiryDate`** (Oslo
  date). A student holding only a plan that has not started is not a member
  and gets no benefits until it starts.
- **Sales are automatic from dates.** No admin page, no `canPurchase` toggle.
- **Last-month choice:** in June and December, after picking a duration, the
  buyer chooses between this season's plan (default, ends at month end) and
  next season's plan of the same duration.
- **Prices and names come from 24SO.** UIs keep presenting "BISO Membership"
  with Semester / 1 year / 3 years, labelled by duration.
- The native app consumes `apps/api` `/api/membership`; it needs its own UI
  change for the choice (owned by the app, out of this repo's scope).

## Components

### 1. Catalog sync (in `functions/member-roster-sync`)

Each run, **before** the roster step:

1. Fetch membership products and categories from 24SO; match by name
   (existing logic).
2. Parse `startDate` / `expiryDate` from the product name with the season
   table above; write ISO `YYYY-MM-DD`.
3. Upsert one `memberships` row per product (`$id` = product id, as today):
   `membership_id`, `name` (24SO product name), `category`, `startDate`,
   `expiryDate`, `price` (24SO product price), `status` (= expiry not passed;
   informational only), `canPurchase` (written `false`; no longer read).
4. Rows for products no longer in 24SO are left alone.

A catalog failure fails the run (HTTP 500) before the roster step, keeping the
previous catalog and roster. The existing admin-owned price/`canPurchase`
merge (`mergeMembershipRow`) is replaced by 24SO as the source of truth.

The roster step then reads the fresh catalog, and counts a member only for
plans active today (`startDate ≤ today ≤ expiryDate`).

### 2. Shared membership rules (`@repo/shared`)

- `isMembershipRowActive(start, expiry, now)`: start ≤ Oslo today ≤ expiry;
  unreadable dates are not active.
- `computeMembershipStatus`: stops filtering on `status = true`; classifies
  each held category's row as **active**, **upcoming** (start in the future)
  or **expired**. `isMember` = any active. The result gains
  `upcomingMemberships` (same shape as `memberships`), so the portal and the
  app can show "Your membership starts 1 January".
- Plan selection (pure, date-driven):
  - `currentSeason(today)`: spring (Jan–Jun) or fall (Jul–Dec), with its start
    date; `nextSeason` follows it.
  - For each duration, the **current** plan is the catalog plan starting at
    the current season's start; the **next** plan is the one starting at the
    next season's start.
  - `isLastMonthOfSeason(today)`: June or December.
- `getPurchasableMembershipPlans(now)`: reads the whole catalog and returns,
  per duration, the current plan, plus the next plan in the last month. Each
  plan carries `offer: "current" | "next"`.
- `getMembershipPlanById`: resolves either offer, so checkout accepts the next
  plan's id (and only plans currently on offer).
- `resolveMembershipGate`: the "latest held expiry" includes **active and
  upcoming** memberships, so a student already holding next season's plan is
  not sold it again. Per duration, if the current plan no longer extends what
  they hold, only the next plan is offered (no prompt).

### 3. API (`apps/api` `/api/membership`)

`offeredPlans` entries gain `offer` (`"current" | "next"`); `startDate` and
`expiryDate` are already present. The status part gains
`upcomingMemberships`. Checkout (`membership-checkout`) keeps taking a plan id.

### 4. Web (`apps/web`)

- Join wizard: the duration picker is unchanged. When the chosen duration has
  both offers, show the choice: "This membership ends {date}. Buy for this
  semester, or start next semester from {date}?" — default this semester.
- Member portal: show an upcoming membership ("starts {date}") when the student
  holds one but is not yet a member.

### 5. Invoicing

`AccrualDate` on the membership invoice is the plan's `startDate`, so fall
plans now accrue from 1 July (previously the hand-set row also said 1 July).
A next-season purchase accrues from next season's start.

## Out of scope

- The native app's UI for the choice and for upcoming memberships.
- Showing upcoming members in the admin roster.
- Removing the `canPurchase` column (kept, unused, to avoid a schema change).

## Testing

- Unit tests: name → dates (1 July fall start, multi-term), season and
  last-month detection at the 30 Jun / 1 Jul / 30 Nov / 1 Dec / 31 Dec edges,
  current/next plan selection per duration, the start ≤ today ≤ end rule,
  active/upcoming/expired classification, the gate with upcoming memberships,
  catalog sync upsert shape, API `offer` field.
- Read-only production dry run before merge: catalog rows produced, members per
  category before/after, and the live check for a few real student numbers
  (including one on a 2025 three-year plan) before and after.
