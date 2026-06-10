# M365 Department Remediation v2 — AI-driven classification

## Status

Supersedes the classification core of
`2026-06-09-m365-department-remediation-design.md`. The infrastructure built
there (paginated `listLicensedUsers`, `batchUpdateUsers`, the audit page shell,
the apply path, audit logging, the data-health tab) is **kept**. What changes is
**how a user's correct department is decided**: the deterministic Dice/truncation
classifier is replaced by an AI resolver, because the freeform M365 `department`
field is too unreliable to drive auto-apply.

## Problem

The v1 classifier only looks at the freeform `department` string a user typed.
That string drifts (typos, invented names, blanks), so the engine over-assigns:
the "safe" tab proposed putting **29 users** into `Ledelsen Oslo`, a unit that
actually has **6–9** members. The single most authoritative fact about a user —
their role-based email — was ignored.

In M365 each licensed `@biso.no` mailbox is provisioned **per role, not per
person**, and the local-part encodes the role:

| Shape | Example | Meaning |
|-------|---------|---------|
| `role.campus` | `president.oslo`, `controller.oslo` | a management role |
| `function.deptabbrev.campus` | `finance.nu.oslo` (`nu` = Næringslivsutvalget) | a department role |
| name / `firstname.lastname` | `markus`, `adrian.oslo` | a person (often national, or masked for sensitivity) |

**The shape is not deterministically separable.** `president.oslo` (management),
`hr.oslo` (a function, *not* management), and `adrian.oslo` (a person) are all
`x.campus`. Telling them apart requires semantic judgement — which is what the
model provides. Department abbreviations are **ad-hoc** (no registry), so
resolving `nu` → `OSL Næringslivsutvalget` also needs the model.

`Departments.Name` is capped at 50 chars, so some canonical names are stored
truncated — the resolver must tolerate that.

## Goals

- Use the email as the primary signal; judge **every** licensed user against it.
- AI is **fenced**: it may only return a department that exists in the canonical
  list for the resolved campus, or `null`. It can never invent or write an
  off-list department.
- **Auto-apply only when the model is confident**; everything else is held for
  human review or manual assignment.
- Persist the result as a **snapshot** so the page is instant and the ~1800-user
  AI pass is paid only on an explicit "Run analysis", not on every visit.

## Non-goals

- No change to the Appwrite `user` table (M365 is the only write target).
- No change to the apply/write path, audit logging, or campus-derivation safety
  (campus written to M365 is still derived server-side, never trusted from the
  client).
- The `- nedlagt` (closed) handling and the 24SO data-health tab are unchanged.

## Decisions (confirmed with user)

1. **Approach B with guardrails** — AI-first interpretation; deterministic rules
   do *not* decide the shape (they can't).
2. **Send every user to AI** (no deterministic skip of already-compliant users);
   the email is the source of truth for every record.
3. **Auto-apply when AI is confident** — `high` confidence + on-list department +
   resolved campus → safe (still one-click-with-preview, never silent).
4. **Persist a snapshot in Appwrite**; a "Run / Re-run analysis" control triggers
   the compute. The user will create/push the table from `appwrite.config.json`.
5. Model: `gpt-5-nano` (matches `recruitment-screener.ts`), batched.

## Architecture

### Data flow

```
listLicensedUsers ─┐
                   ├─► extract minimal payload (email local-part, department, officeLocation)
loadCanonicalData ─┘        │
                           ▼
              batch by campus-hint  ──►  resolveDepartments() [AI, gpt-5-nano]
                                              │  per user: {classification, department, campus, confidence, reasoning}
                                              ▼
                          validate (department ∈ campus candidate list?)
                                              │
                                              ▼
                          bucket → safe | review | manual | closed
                                              │
                                              ▼
                          regroup safe/review by resolved target
                                              ▼
                          persist snapshot row (JSON) ──► page renders snapshot
                                                              │ apply
                                                              ▼
                                              batchUpdateUsers (unchanged)
```

### Component 1 — AI resolver (`packages/ai/src/server/department-resolver.ts`)

Mirrors `recruitment-screener.ts`: `import "server-only"`, `generateObject`,
`openai(model)`, zod schema imported from `@repo/shared`.

```ts
resolveDepartments(input: {
  campusLabel: string;                 // "Oslo" | … | "National/unknown"
  candidates: string[];                // canonical department names for this campus
  users: Array<{ ref: string; email: string; department: string; office: string }>;
  model?: string;                      // default "gpt-5-nano"
}): Promise<DepartmentResolution[]>
```

`DepartmentResolution` (zod, in `@repo/shared`):

```ts
{
  ref: string;                                   // echoes input.users[].ref (index key)
  classification: "management" | "department" | "manual";
  department: string | null;                     // must be ∈ candidates (post-validated)
  campus: string | null;                         // "Oslo" | "Bergen" | "Trondheim" | "Stavanger" | null
  confidence: "high" | "medium" | "low";
  reasoning: string;                             // one line, ≤140 chars
}
```

Prompt rules: management → `Ledelsen {Campus}`; department → choose exactly one
`candidate` whose abbreviation matches the email's middle segment(s), tolerating
truncation; a person / national / unplaceable mailbox → `manual` with `null`
department; never output a department outside `candidates`. The server
**re-validates** membership and forces any off-list answer to `review`.

`ref` is a stable opaque key (the user's M365 id) so results map back without
sending the model anything it doesn't need.

### Component 2 — campus batching

Campus hint per user, deterministic, **only to choose a batch + candidate list**
(not to decide the user's fate):
- email last segment is a known campus token (`oslo`/`bergen`/`trondheim`/`stavanger`) → that campus;
- else map `officeLocation` to a campus;
- else the `national/unknown` batch (carries all campuses' candidates; the model
  is told to prefer `manual`).

Each batch is chunked (~30 users/call) and run with bounded concurrency
(e.g. 5). ~1800 users ⇒ roughly 60–70 calls.

### Component 3 — buckets → tabs

| Tab | Condition | UI |
|-----|-----------|----|
| **Safe** | `high` + (management, or department ∈ candidates) + campus resolved | grouped by resolved target; "Apply all safe" one-click, members listed first |
| **Review** | `medium`/`low`, off-list, or `null`-but-not-clearly-manual | grouped by resolved target; per-group department dropdown pre-filled with AI's best guess + reasoning |
| **Manual** *(new)* | `classification = manual` | **per-user** rows; pick department + campus yourself |
| **Closed** | maps to a `- nedlagt` department (unchanged) | informational |

Safe/Review group **by resolved target**, so `Ledelsen Oslo` lists only the
members the model actually placed there — the 29-user inflation cannot recur.

### Component 4 — snapshot persistence

New Appwrite table **`m365_remediation_snapshot`** (database `app`), latest-row-
wins:

| Column | Type | Notes |
|--------|------|-------|
| `generated_at` | datetime | when the analysis ran |
| `generated_by` | string(120) | admin email/id |
| `total_scanned` | integer | summary |
| `safe_count` / `review_count` / `manual_count` / `closed_count` | integer | summary, for at-a-glance |
| `result` | string (large, e.g. 5_000_000) | full plan JSON (groups + per-user rows) |

- `rowSecurity: true`, permissions to the IT/admin team only (the snapshot
  contains every user's email).
- If `result` exceeds the Appwrite row-size limit in practice, fall back to a
  Storage-bucket JSON blob with this row holding the `file_id`. (Estimated
  payload ≈ 450 KB for 1800 users, so a single large string should fit; the
  Storage fallback is the contingency, decided at implementation time.)

Server actions:
- `runDepartmentAnalysis()` — `it.users.editProfile`; computes the plan
  (users + AI) and **upserts** the snapshot row; returns the fresh plan. Runs in
  a route handler / action with raised `maxDuration`.
- `getLatestRemediationSnapshot()` — `it.users.view`; reads the latest row,
  returns the parsed plan + `generatedAt` (or `null` if never run).
- `applyDepartmentFixes(decisions)` — unchanged except it accepts the new group
  shape; still derives campus server-side and audit-logs.

### Component 5 — UI

`remediation-client.tsx` gains the **Manual** tab, a **Run / Re-run analysis**
button, and a "last generated <relative time>" label; empty state when no
snapshot exists yet ("Run analysis to begin"). All strings via `useTranslations`
with ICU args supplied (no pre-fetched label strings). i18n keys added to both
`en` and `no` bundles.

### Retired

`department-matching.ts` keeps the closed-detection + campus helpers
(`isClosedName`, `stripClosedSuffix`, `extractCampusPrefix`,
`buildCampusPrefixToId`). The Dice/truncation auto-tier (`classifyDepartmentValue`
and its similarity machinery) is removed — AI owns classification now. The unit
tests are trimmed to the retained helpers.

## Files

- `packages/ai/src/server/department-resolver.ts` — **new**; export in `packages/ai/package.json`.
- `packages/shared/types/user-management.ts` — resolver schema + result type;
  add `classification`/`confidence`/`reasoning` to groups; add `manual` bucket
  and a snapshot type.
- `apps/admin/src/app/(portal)/_actions/it-remediation.ts` — `runDepartmentAnalysis`,
  `getLatestRemediationSnapshot`; adapt bucketing; keep `applyDepartmentFixes`.
- `apps/admin/src/lib/it/department-matching.ts` — drop the Dice auto-tier; keep helpers.
- `apps/admin/src/lib/it/department-matching.test.ts` — trim to retained helpers.
- `apps/admin/.../it/users/_components/remediation-client.tsx` — Manual tab + Run control.
- `apps/admin/.../it/users/audit/page.tsx` — read snapshot instead of computing live.
- `packages/i18n/messages/{en,no}/adminPortal.json` — new keys.
- `packages/api/appwrite.config.json` — add `m365_remediation_snapshot` (user pushes).

## Edge cases

- **Off-list AI answer** → forced to review (never written).
- **`adrian.oslo` (person, campus token present)** → model returns `manual`;
  lands in the Manual tab, not auto-applied.
- **2-segment non-management `hr.oslo`** → model decides (department/manual);
  not blindly mapped to `Ledelsen`.
- **National/no campus** → `manual`.
- **Closed (`- nedlagt`)** → Closed tab, never auto-applied.
- **Snapshot too large** → Storage-blob fallback.
- **AI/network failure mid-batch** → that batch's users degrade to `review` with
  a reasoning note; analysis still completes and persists.

## Verification

1. `bun --filter=admin check-types`, `bun --filter=admin lint`, `bun x ultracite fix`.
2. `bun run build --filter=admin` (catches the `"use server"` async-only rule —
   `department-resolver.ts` is a plain `server-only` module, the actions file
   exports only async fns).
3. Unit tests: resolver post-validation (off-list → review), bucketing
   (high→safe, medium→review, manual→manual, closed→closed), campus-hint
   batching, retained matching helpers.
4. Manual: Run analysis → confirm `Ledelsen Oslo` shows ≈6–9 real members (not
   29); a `finance.<abbrev>.oslo` user resolves to the right `OSL …` department;
   `adrian.oslo` / `markus` land in Manual; apply writes department + officeLocation
   and the snapshot refreshes.
