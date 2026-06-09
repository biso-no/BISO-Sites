# M365 Department Remediation + 24SO Data Health — Design

**Date:** 2026-06-09
**App:** `apps/admin` (IT section)
**Status:** Approved design, pending implementation plan

## Context

The admin IT page lists licensed `@biso.no` Microsoft 365 users. A user's
**department** is the freeform Entra `department` attribute and their **campus** is
`officeLocation`. Because `department` is freeform text, it has drifted badly: a
first pass (exact, case-sensitive match against the canonical 24SevenOffice
department list stored in Appwrite `departments`) flagged **1109 of 1977** users.

Manual correction of 1100+ accounts is infeasible. We need a remediation tool. Key
domain facts learned during design:

- **24SO is the source of truth for department *names*, not membership.** 24SO only
  holds the list of departments (for accounting). There is no person→department
  registry to sync from. Going forward, admins will assign departments via a
  selector in the app (not freeform), so this is a one-time-ish cleanup of existing
  drift plus an ongoing audit.
- **Canonical names are truncated/abbreviated (~50 chars).** Both 24SO and the
  Appwrite `Name` column (size 50) store abbreviated names, e.g. M365 has
  `OSL DIGI-KOMM - Digital kommunikasjon og markedsføring` while the canonical value
  is `OSL DIGI-KOMM - Digital kommunikasjon og markedsf.`. **Exact matching is
  therefore wrong** — it flags correctly-assigned users.
- **Campus is encoded as a name prefix:** `OSL` (Oslo), `BRG` (Bergen),
  `TRD` (Trondheim), `STV` (Stavanger); national departments have no prefix. A small
  number of campus departments also lack the prefix — handle gracefully via the
  canonical `campus_id` fallback.
- **Closed departments use a `- nedlagt` suffix.** When a department is closed it is
  renamed (e.g. `OSL DataAnalytisk Utvalg` → `OSL DataAnalytisk Utvalg - nedlagt`).
  Users still sitting on the old name are effectively former members and should be
  surfaced separately, **not** auto-remediated.
- **Some canonical names have trailing spaces** (a data-quality defect in 24SO). The
  user wants these **marked** so they can be fixed in 24SO afterwards.

## Decisions (confirmed with user)

- **Write target:** overwrite the M365 `department` to the **exact canonical 24SO
  string** (even when truncated), so M365 matches 24SO character-for-character.
- **Closed (`nedlagt`) users:** shown in their own tab, **not audited/remediated**.
- **Apply model:** **auto-apply the safe tier** (deterministic matches), gated behind
  a single explicit "Apply safe fixes" action with a dry-run summary — no per-user
  review. Only fuzzy/ambiguous groups need human sign-off.
- **Scope:** **M365 only.** Do not update the Appwrite `user` table in this work.
- **Matching:** **hybrid** — deterministic rules gate auto-apply; string similarity
  powers review suggestions and ambiguity guards (see below).

## Architecture overview

Four cooperating pieces:

1. A **pure matching/classification engine** (no I/O, unit-tested).
2. **Server actions** that assemble inputs, run the engine, and apply writes.
3. A **Graph `$batch` update** method on `GraphUserService`.
4. **UI**: a remediation hub + a read-only 24SO data-health report.

The exact-match-only audit shipped earlier (`auditM365UserDepartments` +
`audit/page.tsx` + `audit-list-client.tsx`) is **superseded** by this richer engine
and reworked, not kept in parallel.

---

## 1. Matching & classification engine (pure, testable)

**Location:** `apps/admin/src/lib/it/department-matching.ts` (+ colocated
`department-matching.test.ts`, vitest — matches existing admin test convention).

**Inputs:** the distinct M365 department string, the user's `officeLocation`, and the
canonical department set (`{ name, campusId, campusPrefix, isClosed }[]`) derived
from `loadItLookupOptions()` plus campus list.

**Normalization helpers:**
- `extractCampusPrefix(name)` → `"OSL" | "BRG" | "TRD" | "STV" | null`.
- `normalizeForCompare(name)` → lowercased, campus prefix token removed, Norwegian
  diacritics folded (`ø→o`, `æ→ae`, `å→a`), whitespace collapsed, trailing
  punctuation/space stripped. Used for similarity only.
- `dice(a, b)` → Dice coefficient over character bigrams of the normalized strings,
  0–1. ~15 lines, no dependency.

**Per distinct value, classify into one tier (first match wins):**

1. **Closed** — value matches (exact-trim, or value is a prefix of) a canonical
   department whose name contains `nedlagt`. → *Closed tab.*
2. **Safe – exact** — the value, compared case-insensitively with whitespace
   collapsed, equals exactly one active canonical name. Covers case/whitespace-only
   drift; the write still uses the canonical's exact casing. (If it already equals the
   canonical character-for-character, only `officeLocation` needs fixing.)
3. **Safe – truncation/prefix** — an active canonical name (trailing `.`/space
   stripped) is a prefix of the trimmed value, **and** campus prefix agrees (or value
   has no prefix and canonical campus resolves via `campus_id`), **and** the canonical
   is ≥ ~20 chars (guards short-name collisions), **and** exactly one canonical
   qualifies. Demoted to *Needs review* if a second canonical is within a small
   similarity margin of the best (near-tie guard).
4. **Needs review – suggested** — best Dice similarity ≥ ~0.80 with a unique-enough
   winner; campus prefix used to pre-filter candidates when present. Carries the
   suggested canonical + score.
5. **Needs review – no match** — nothing ≥ threshold; admin picks from a selector.

**Campus/office resolution (independent of department text):** once the correct
canonical department is known, the correct campus = its campus (from prefix, falling
back to `campus_id`). If the user's `officeLocation` ≠ that campus's name, the fix
also sets `officeLocation`. A single fix may therefore change department, office, or
both.

**Output per distinct value:** `{ value, tier, suggestedDepartmentName?,
suggestedCampusName?, score?, affectedUserIds[] }`. Auto-apply is **never** performed
on a cross-campus match.

**Why hybrid:** deterministic rules keep the auto tier explainable/trustworthy;
similarity widens recall for near-truncations (`&` vs `og`, mid-word abbreviations,
diacritic typos) as *review suggestions*; the campus-prefix and near-tie guards stop
similarity from causing bad auto-writes.

---

## 2. Server actions

**Location:** new `apps/admin/src/app/(portal)/_actions/it-remediation.ts`
(`"use server"`), or extend `it-users.ts`. Permission-gated with the existing
`requireItPermission` helpers.

- **`getDepartmentRemediationPlan()`** → `it.users.view`. Fetches all licensed users
  via `listLicensedUsers()` and canonical data via `loadItLookupOptions()` (+ campus
  list), groups flagged users by distinct department value, runs the engine, and
  returns `{ safe[], review[], closed[], counts }`. Each group lists its target and
  affected user count/sample.
- **`applyDepartmentFixes(input)`** → `it.users.editProfile`. Accepts a list of
  decisions `{ userIds, department, officeLocation? }` (the admin's accepted safe
  set, or a reviewed group). Writes via the Graph `$batch` method, **audit-logs**
  each change via `logAuditEvent` (reuse the `it.m365.user.update` shape), returns a
  `{ succeeded, failed[] }` summary, and `revalidatePath` the audit. Re-validates that
  the requested department/campus are canonical before writing (reuse
  `validateItLookupValues` logic).
- **`getDepartmentDataHealth()`** → `it.users.view`. Read-only. Returns canonical
  departments with issues: trailing/leading whitespace in `Name`, exact duplicate
  names, and active departments containing `nedlagt`.

---

## 3. Graph `$batch` bulk update

**Location:** `packages/connectors/src/azure/users.ts`.

Add `GraphUserService.batchUpdateUsers(updates: { id: string; patch:
GraphUserProfileUpdate }[]): Promise<{ id: string; error?: string }[]>`:
- Chunk into groups of 20 (Graph `$batch` limit), POST to `/$batch` with each item a
  `PATCH /users/{id}` request.
- Parse per-response status; collect failures (id + message) without aborting the
  whole run. Reuse `normalizeGraphError` for messages.
- ~56 batches for 1100 users; acceptable for an admin-triggered action.

---

## 4. UI

Top tabs (extend `ItUsersTabs`): **Users · Department audit · 24SO data health**.

**Department audit** (`it/users/audit/page.tsx`, reworked) — remediation hub with
three count-labelled segments:
- **Safe fixes (N)** — table grouped `distinct value → canonical target`, showing
  affected-user count and what changes (dept and/or office). One **"Apply all safe
  fixes"** button (dry-run summary first); per-group apply optional. Calls
  `applyDepartmentFixes`.
- **Needs review (N)** — one row per distinct value with the suggested canonical +
  score and a **department selector** to accept/override, then apply that group.
- **Closed / nedlagt (N)** — informational list of users on closed departments; no
  actions.

**24SO data health** (`it/data-health/page.tsx`, new) — read-only table of canonical
department issues with a short "fix these in 24SO" explanation. Writes nothing.

Styling reuses `STUDIO`, `PageHeader`, `EmptyState`, and the existing list-row
patterns. New strings added to `it.users` (and a new `it.dataHealth`) in both
`en` and `no` adminPortal message bundles.

---

## Testing / verification

- **Unit tests (vitest)** for the engine: exact, truncation/prefix (the
  `DIGI-KOMM` case), case/whitespace-only, diacritic typo, `&` vs `og`,
  cross-campus rejection, near-tie demotion, `nedlagt` classification, no-match.
- `bun run check-types` (13/13) and `bun x ultracite check` clean.
- Manual: as a global admin, open **Department audit** — confirm the previously
  false-flagged truncation users now land in **Safe fixes**; run "Apply all safe
  fixes" against a small subset first; verify Graph writes + audit-log entries;
  confirm **Closed** and **24SO data health** populate correctly.

## Out of scope

- Appwrite `user` table sync (M365 only this round).
- Changing the app's user-create flow (already uses a selector).
- Editing `appwrite.config.json` / regenerating types.

## Open items for the plan

- Confirm the admin vitest run command/wiring for the colocated engine test.
- Final thresholds (`≥0.80` review, `≥20` char prefix gate, near-tie margin) — start
  with these, tune against real data during verification.
