# Member Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give active BISO members a live, scannable membership pass (web, Google Wallet, Apple Wallet) that staff and guest scanners verify against Finago, and fix the member portal's fake membership data.

**Architecture:** Pure signing/verification lives in `@repo/shared/utils/member-pass` (HMAC codes per 30 s slot, TOTP for Google Wallet, static signed code for Apple Wallet). `apps/web` issues a 10-minute batch of codes to members through `GET /api/member-pass` and renders `<MemberPass>` on the profile page and member portal. `apps/admin` verifies scans (staff page + revocable guest links), checks Finago live, and logs scans for duplicate detection. `apps/api` prunes old scan data, driven by the `scheduled-dispatch` Appwrite Function.

**Tech Stack:** Next.js 16 (App Router), React 19, Bun 1.3.1 workspaces, Appwrite TablesDB via `@repo/api`, `node:crypto`, `qrcode` 1.5.4, `qr-scanner` 1.4.2, `passkit-generator` 3.6.0, vitest (shared/web/api), `bun test` (admin), next-intl.

**Spec:** `docs/superpowers/specs/2026-09-17-member-pass-design.md`

## Global Constraints

- Package manager: Bun only (`bun add <pkg> --filter=<app>`). Never npm/pnpm.
- Never import `appwrite` / `node-appwrite` in app code; use `@repo/api`, `@repo/api/server`.
- Do not edit `packages/api/appwrite.config.json` or `packages/api/types/appwrite.ts`; use local row types until the user regenerates them.
- Before writing Next.js code, read the relevant guide under `apps/<app>/node_modules/next/dist/docs/` (Next 16 has breaking changes).
- `MEMBER_PASS_SECRET` and all wallet credentials are server-only; never referenced from a `"use client"` file or a module a client file imports. Client components may only import from `@repo/shared/utils/member-pass-slots` and `@/lib/member-pass/types`.
- Slot length 30 s; accepted slot drift ±1; batch size 20 codes; duplicate window 10 minutes; guest link max 48 h, default 6 h; scan rows kept 90 days; expired links kept 30 days.
- Codes carry only the Appwrite user id. Scan results never include student number or email.
- Google Wallet TOTP key is encoded **Base16 (hex)**; algorithm `TOTP_SHA1`, 6 digits, `periodMillis: "30000"`.
- New server actions return `{ success: true; data } | { success: false; error }`.
- Tests: `packages/shared` → `bun x vitest run <path>` from `packages/shared`; `apps/web` → `bun x vitest run <path>` from `apps/web`; `apps/api` → `NODE_ENV=test bun x vitest run <path>` from `apps/api`; `apps/admin` → `bun test <path>` from `apps/admin` (`bun:test`, `mock.module`).
- Type-check after every task that touches a package: `bun run check-types --filter=<pkg>` from the repo root. `next build` ignores type errors.
- Format before each commit: `bun x ultracite fix <changed paths>`.
- Every commit message ends with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- Work on branch `feat/member-pass`.

## Manual prerequisites (user, can run in parallel with Tasks 1–11)

1. In the Appwrite console, database `app`, create table `member_pass_scanner_links` with columns `label` string(120) required, `campus_id` string(36) nullable, `token_hash` string(64) required, `expires_at` datetime required, `revoked_at` datetime nullable, `created_by` string(36) required; unique index on `token_hash`; index on `expires_at`. No permissions.
2. Create table `member_pass_scans` with columns `member_user_id` string(36) required, `result` enum (`valid`,`duplicate`,`check_id`,`denied`,`unavailable`) required, `reason` string(40) nullable, `code_kind` enum (`web`,`google`,`apple`) nullable, `scanner_user_id` string(36) nullable, `scanner_link_id` string(36) nullable; index on (`member_user_id`, `$createdAt`); index on `$createdAt`. No permissions.
3. Generate a secret: `openssl rand -base64 32`. Set `MEMBER_PASS_SECRET` to the same value on web and admin (local `.env.local` and Appwrite Sites).
4. Wallet credentials (only needed for Tasks 17–18 to work at runtime): Apple Pass Type ID certificate + WWDR G4 certificate (PEM, base64-encoded into env); Google Pay & Wallet Console issuer id + service account JSON key (base64-encoded).
5. After Task 20 is merged: set `MEMBER_PASS_CLEANUP_URL=https://api.biso.no/api/cron/cleanup-member-pass` on the `scheduled-dispatch` function.

## File map

| File | Responsibility |
|---|---|
| `packages/shared/utils/membership-dates.ts` | Date normalization + `osloToday` (pure) |
| `packages/shared/utils/membership-plans.ts` | + `describeMembershipTerm` |
| `packages/shared/utils/membership-status.ts` | + `pickCurrentMembership` |
| `packages/shared/utils/member-pass-slots.ts` | Client-safe slot math and constants |
| `packages/shared/utils/member-pass.ts` | Server-only signing, verification, TOTP, day color, secret reader |
| `apps/web/src/lib/member-pass/types.ts` | Client-safe response types |
| `apps/web/src/lib/member-pass/state.ts` | Pure status → pass state/holder mapping |
| `apps/web/src/lib/member-pass/resolve.ts` | Server: current user → resolved pass |
| `apps/web/src/lib/member-pass/wallet-config.ts` | Reads wallet env |
| `apps/web/src/lib/member-pass/apple-pass.ts` | Builds `.pkpass` |
| `apps/web/src/lib/member-pass/google-pass.ts` | Builds Google object + save JWT |
| `apps/web/src/app/api/member-pass/route.ts` (+ `apple/`, `google/`) | Routes |
| `apps/web/src/components/member-pass/*` | Pass UI |
| `apps/admin/src/lib/member-pass/*` | Scan types, store, verify, guest links, rate limit, membership lookup |
| `apps/admin/src/components/member-pass-scanner/*` | Scanner UI |
| `apps/admin/src/app/(portal)/members/scan/**` | Staff scanner + link management |
| `apps/admin/src/app/(scan)/scan/[token]/**` | Guest scanner |
| `apps/api/src/app/api/cron/cleanup-member-pass/route.ts` | Retention |
| `functions/scheduled-dispatch/*` | New target |

---
## Phase 0 — Membership data groundwork

### Task 1: Commit the membership date fix

The working tree already contains `normalizeMembershipDate` and its wiring (verified live: customer 1715738 → `isMember: true`).

**Files:**
- Already modified: `packages/shared/utils/membership-dates.ts`, `membership-dates.test.ts`, `membership-status.ts`, `membership-status.test.ts`, `membership-plans.ts`, `membership-plans.test.ts`

- [ ] **Step 1: Run the tests**

Run (from `packages/shared`): `bun x vitest run utils/membership`
Expected: all pass (6 files).

- [ ] **Step 2: Type-check**

Run (repo root): `bun run check-types --filter=@repo/shared`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/utils/membership-dates.ts packages/shared/utils/membership-dates.test.ts packages/shared/utils/membership-status.ts packages/shared/utils/membership-status.test.ts packages/shared/utils/membership-plans.ts packages/shared/utils/membership-plans.test.ts
git commit -m "Read DD.MM.YYYY membership dates

Curated memberships rows store dates as DD.MM.YYYY, which the expiry
check treated as unreadable, so every held membership counted as expired.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

### Task 2: Membership term, current membership, and a pure `osloToday`

**Files:**
- Modify: `packages/shared/utils/membership-dates.ts` (add `osloToday`)
- Modify: `packages/shared/utils/membership-status.ts` (import + re-export `osloToday`; add `pickCurrentMembership`)
- Modify: `packages/shared/utils/membership-plans.ts` (add `MembershipTerm`, `describeMembershipTerm`)
- Test: `packages/shared/utils/membership-dates.test.ts`, `membership-status.test.ts`, `membership-plans.test.ts`

**Interfaces:**
- Produces:
  - `osloToday(now?: Date): string` from `@repo/shared/utils/membership-dates` (still re-exported from `membership-status`)
  - `pickCurrentMembership(memberships: MembershipInfo[]): MembershipInfo | null` from `@repo/shared/utils/membership-status`
  - `interface MembershipTerm { duration: MembershipDuration; fromYear: number; season: "spring" | "fall" | null; toYear: number }`
  - `describeMembershipTerm(startDate: string, expiryDate: string): MembershipTerm | null` from `@repo/shared/utils/membership-plans`

- [ ] **Step 1: Write the failing tests**

Append to `packages/shared/utils/membership-dates.test.ts`:

```ts
import { osloToday } from "./membership-dates";

describe("osloToday", () => {
  it("formats the Oslo calendar date as YYYY-MM-DD", () => {
    expect(osloToday(new Date("2026-01-01T23:30:00Z"))).toBe("2026-01-02");
    expect(osloToday(new Date("2026-06-30T21:30:00Z"))).toBe("2026-06-30");
  });
});
```

(Merge the import into the existing import line from `./membership-dates`.)

Append to `packages/shared/utils/membership-plans.test.ts` (add `describeMembershipTerm` to the import list):

```ts
describe("describeMembershipTerm", () => {
  it("describes a fall semester", () => {
    expect(describeMembershipTerm("01.07.2026", "31.12.2026")).toEqual({
      duration: "semester",
      fromYear: 2026,
      season: "fall",
      toYear: 2026,
    });
  });

  it("describes a spring semester", () => {
    expect(describeMembershipTerm("2027-01-01", "2027-06-30")).toEqual({
      duration: "semester",
      fromYear: 2027,
      season: "spring",
      toYear: 2027,
    });
  });

  it("describes multi-semester terms by year span without a season", () => {
    expect(describeMembershipTerm("01.07.2026", "01.07.2027")).toEqual({
      duration: "year",
      fromYear: 2026,
      season: null,
      toYear: 2027,
    });
    expect(describeMembershipTerm("01.07.2026", "01.07.2029")).toMatchObject({
      duration: "three_years",
      toYear: 2029,
    });
  });

  it("returns null for unreadable dates", () => {
    expect(describeMembershipTerm("soon", "2026-12-31")).toBeNull();
  });
});
```

Append to `packages/shared/utils/membership-status.test.ts` (add `pickCurrentMembership` to the import list):

```ts
describe("pickCurrentMembership", () => {
  const info = (id: string, expiryDate: string) => ({
    category: "1",
    expiryDate,
    id,
    name: id,
    startDate: "2026-07-01",
  });

  it("returns the membership that runs longest", () => {
    expect(
      pickCurrentMembership([
        info("semester", "2026-12-31"),
        info("three-years", "2029-07-01"),
        info("year", "2027-07-01"),
      ])?.id
    ).toBe("three-years");
  });

  it("returns null for no memberships", () => {
    expect(pickCurrentMembership([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `packages/shared`): `bun x vitest run utils/membership`
Expected: FAIL — `osloToday`, `describeMembershipTerm`, `pickCurrentMembership` not exported.

- [ ] **Step 3: Implement**

In `packages/shared/utils/membership-dates.ts`, append:

```ts
const osloDateFormat = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Oslo",
  year: "numeric",
});

/** Today's calendar date in Oslo, as `YYYY-MM-DD`. */
export function osloToday(now: Date = new Date()): string {
  return osloDateFormat.format(now);
}
```

In `packages/shared/utils/membership-status.ts`:
- Delete the local `osloDateFormat` constant and the local `osloToday` function (including its doc comment).
- Change the import to `import { normalizeMembershipDate, osloToday } from "./membership-dates";`
- Add below the imports: `export { osloToday } from "./membership-dates";`
- Append:

```ts
/**
 * The membership a member holds for longest — what the pass and the portal
 * show when Finago reports more than one held category.
 */
export function pickCurrentMembership(
  memberships: MembershipInfo[]
): MembershipInfo | null {
  let current: MembershipInfo | null = null;
  for (const membership of memberships) {
    if (!current || membership.expiryDate > current.expiryDate) {
      current = membership;
    }
  }
  return current;
}
```

(`MembershipInfo.expiryDate` is already ISO after Task 1, so string comparison orders correctly.)

In `packages/shared/utils/membership-plans.ts`, after `deriveAccrualMonths`, add:

```ts
export interface MembershipTerm {
  duration: MembershipDuration;
  fromYear: number;
  /** Set only for single-semester memberships. */
  season: "spring" | "fall" | null;
  toYear: number;
}

const LAST_SPRING_MONTH = 6;

/**
 * What a membership covers, for display: "Fall 2026" for a semester,
 * "2026–2027" otherwise. Labels are localized by the caller.
 */
export function describeMembershipTerm(
  startDate: string,
  expiryDate: string
): MembershipTerm | null {
  const start = normalizeMembershipDate(startDate);
  const expiry = normalizeMembershipDate(expiryDate);
  if (!(start && expiry)) {
    return null;
  }
  const accrualMonths = deriveAccrualMonths(start, expiry);
  if (accrualMonths === null) {
    return null;
  }
  const duration = DURATION_BY_ACCRUAL[accrualMonths];
  const expiryMonth = Number(expiry.slice(5, 7));
  return {
    duration,
    fromYear: Number(start.slice(0, 4)),
    season:
      duration === "semester"
        ? expiryMonth <= LAST_SPRING_MONTH
          ? "spring"
          : "fall"
        : null,
    toYear: Number(expiry.slice(0, 4)),
  };
}
```

If Biome flags the nested ternary, replace it with a `let season` + `if` block.

- [ ] **Step 4: Run tests to verify they pass**

Run (from `packages/shared`): `bun x vitest run utils/membership`
Expected: PASS.

- [ ] **Step 5: Type-check, format, commit**

```bash
bun run check-types --filter=@repo/shared
bun x ultracite fix packages/shared/utils
git add packages/shared/utils
git commit -m "Describe membership terms and pick the current membership

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
## Phase 1 — Pass codes (shared)

### Task 3: Client-safe slot math

**Files:**
- Create: `packages/shared/utils/member-pass-slots.ts`
- Test: `packages/shared/utils/member-pass-slots.test.ts`

**Interfaces:**
- Produces (all from `@repo/shared/utils/member-pass-slots`, no Node imports):
  - `MEMBER_PASS_SLOT_SECONDS = 30`, `MEMBER_PASS_SLOT_TOLERANCE = 1`, `MEMBER_PASS_BATCH_SIZE = 20`, `MEMBER_PASS_REFETCH_BELOW = 4`
  - `interface MemberPassCode { code: string; slot: number }`
  - `passSlot(nowMs: number): number`
  - `slotSecondsLeft(nowMs: number): number` (1–30)
  - `selectCurrentCode(codes: MemberPassCode[], slot: number): MemberPassCode | null`
  - `codesRemaining(codes: MemberPassCode[], slot: number): number` (codes with `slot >= current`)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  codesRemaining,
  passSlot,
  selectCurrentCode,
  slotSecondsLeft,
} from "./member-pass-slots";

const codes = [100, 101, 102].map((slot) => ({ code: `c${slot}`, slot }));

describe("member pass slots", () => {
  it("numbers 30-second slots from the epoch", () => {
    expect(passSlot(0)).toBe(0);
    expect(passSlot(29_999)).toBe(0);
    expect(passSlot(30_000)).toBe(1);
  });

  it("counts the whole seconds left in a slot", () => {
    expect(slotSecondsLeft(30_000)).toBe(30);
    expect(slotSecondsLeft(59_001)).toBe(1);
  });

  it("selects the code for the current slot", () => {
    expect(selectCurrentCode(codes, 101)?.code).toBe("c101");
    expect(selectCurrentCode(codes, 99)).toBeNull();
    expect(selectCurrentCode(codes, 103)).toBeNull();
  });

  it("counts codes still usable from the current slot", () => {
    expect(codesRemaining(codes, 101)).toBe(2);
    expect(codesRemaining(codes, 103)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `packages/shared`): `bun x vitest run utils/member-pass-slots.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
/**
 * Slot arithmetic for member pass codes. Deliberately free of Node imports:
 * the browser pass component uses it to pick the code to show.
 */

export const MEMBER_PASS_SLOT_SECONDS = 30;
/** Slots either side of "now" a scanner still accepts (clock drift). */
export const MEMBER_PASS_SLOT_TOLERANCE = 1;
/** Codes issued per fetch: ten minutes. */
export const MEMBER_PASS_BATCH_SIZE = 20;
/** The client refetches once fewer codes than this remain. */
export const MEMBER_PASS_REFETCH_BELOW = 4;

const SLOT_MS = MEMBER_PASS_SLOT_SECONDS * 1000;

export interface MemberPassCode {
  code: string;
  slot: number;
}

export function passSlot(nowMs: number): number {
  return Math.floor(nowMs / SLOT_MS);
}

export function slotSecondsLeft(nowMs: number): number {
  const elapsed = nowMs - passSlot(nowMs) * SLOT_MS;
  return Math.ceil((SLOT_MS - elapsed) / 1000);
}

export function selectCurrentCode(
  codes: MemberPassCode[],
  slot: number
): MemberPassCode | null {
  return codes.find((code) => code.slot === slot) ?? null;
}

export function codesRemaining(codes: MemberPassCode[], slot: number): number {
  return codes.filter((code) => code.slot >= slot).length;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun x vitest run utils/member-pass-slots.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix packages/shared/utils/member-pass-slots.ts packages/shared/utils/member-pass-slots.test.ts
git add packages/shared/utils/member-pass-slots.ts packages/shared/utils/member-pass-slots.test.ts
git commit -m "Add member pass slot math

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

### Task 4: Signing and verifying pass codes

**Files:**
- Create: `packages/shared/utils/member-pass.ts`
- Test: `packages/shared/utils/member-pass.test.ts`

**Interfaces:**
- Consumes: Task 3 constants and `passSlot`; `osloToday` from `./membership-dates` (Task 2).
- Produces (from `@repo/shared/utils/member-pass`, server-only):
  - `MEMBER_PASS_SECRET_ENV = "MEMBER_PASS_SECRET"`
  - `readMemberPassSecret(env?: Record<string, string | undefined>): string | null` (null unless trimmed value ≥ 32 chars)
  - `type MemberPassCodeKind = "web" | "google" | "apple"`
  - `type MemberPassVerifyResult = { ok: true; kind: "web" | "google"; userId: string; slot: number } | { ok: true; kind: "apple"; userId: string; expiry: string } | { ok: false; reason: "malformed" | "bad_signature" | "stale" | "expired" }` (`expiry` is `YYYY-MM-DD`)
  - `signWebPassCode(userId: string, slot: number, secret: string): string`
  - `issueWebPassCodes(userId: string, nowMs: number, secret: string): MemberPassCode[]` (20 codes from the current slot)
  - `signAppleWalletCode(userId: string, expiryDate: string, secret: string): string` (`expiryDate` is `YYYY-MM-DD`)
  - `googleWalletTotpKeyHex(userId: string, secret: string): string` (40 hex chars)
  - `googleWalletCodePattern(userId: string): string` → `g1.<userId>.{totp_value_0}`
  - `totp(key: Buffer, counter: number, digits?: number): string`
  - `verifyMemberPassCode(code: string, secret: string, now: Date): MemberPassVerifyResult`
  - `interface DayColor { hex: string; name: DayColorName }`, `type DayColorName` (12 names below), `dayColor(now: Date, secret: string): DayColor`
  - `DUPLICATE_SCAN_WINDOW_MS = 600_000`, `isRecentDuplicate(previousScanAt: Date | null, now: Date): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  dayColor,
  googleWalletCodePattern,
  googleWalletTotpKeyHex,
  isRecentDuplicate,
  issueWebPassCodes,
  readMemberPassSecret,
  signAppleWalletCode,
  signWebPassCode,
  totp,
  verifyMemberPassCode,
} from "./member-pass";
import { passSlot } from "./member-pass-slots";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const OTHER_SECRET = "another-secret-that-is-at-least-32-characters";
const USER = "6aa3847618da8122d12c";
const NOW = new Date("2026-09-17T10:00:00Z");
const SLOT = passSlot(NOW.getTime());

describe("readMemberPassSecret", () => {
  it("accepts only a long enough secret", () => {
    expect(readMemberPassSecret({ MEMBER_PASS_SECRET: ` ${SECRET} ` })).toBe(
      SECRET
    );
    expect(readMemberPassSecret({ MEMBER_PASS_SECRET: "short" })).toBeNull();
    expect(readMemberPassSecret({})).toBeNull();
  });
});

describe("web pass codes", () => {
  it("verifies a code for the current slot", () => {
    const code = signWebPassCode(USER, SLOT, SECRET);
    expect(code.startsWith(`v1.${USER}.${SLOT}.`)).toBe(true);
    expect(verifyMemberPassCode(code, SECRET, NOW)).toEqual({
      kind: "web",
      ok: true,
      slot: SLOT,
      userId: USER,
    });
  });

  it("accepts one slot of drift either way and no more", () => {
    for (const offset of [-1, 1]) {
      const code = signWebPassCode(USER, SLOT + offset, SECRET);
      expect(verifyMemberPassCode(code, SECRET, NOW).ok).toBe(true);
    }
    for (const offset of [-2, 2]) {
      const code = signWebPassCode(USER, SLOT + offset, SECRET);
      expect(verifyMemberPassCode(code, SECRET, NOW)).toEqual({
        ok: false,
        reason: "stale",
      });
    }
  });

  it("rejects a tampered or foreign code", () => {
    const code = signWebPassCode(USER, SLOT, SECRET);
    const swapped = code.replace(USER, "someoneelse0000000000");
    expect(verifyMemberPassCode(swapped, SECRET, NOW)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
    expect(verifyMemberPassCode(code, OTHER_SECRET, NOW)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("handles user ids containing dots", () => {
    const code = signWebPassCode("a.b.c", SLOT, SECRET);
    expect(verifyMemberPassCode(code, SECRET, NOW)).toMatchObject({
      ok: true,
      userId: "a.b.c",
    });
  });

  it("rejects malformed input", () => {
    for (const input of ["", "hello", "v1.x", "v9.a.1.sig", "https://x.no"]) {
      expect(verifyMemberPassCode(input, SECRET, NOW)).toEqual({
        ok: false,
        reason: "malformed",
      });
    }
  });

  it("issues twenty consecutive codes from the current slot", () => {
    const codes = issueWebPassCodes(USER, NOW.getTime(), SECRET);
    expect(codes).toHaveLength(20);
    expect(codes[0]?.slot).toBe(SLOT);
    expect(codes[19]?.slot).toBe(SLOT + 19);
    expect(codes[0]?.code).toBe(signWebPassCode(USER, SLOT, SECRET));
  });
});

describe("totp", () => {
  // RFC 6238 appendix B, SHA-1, 8 digits.
  const key = Buffer.from("12345678901234567890");
  it.each([
    [59, "94287082"],
    [1_111_111_109, "07081804"],
    [1_234_567_890, "89005924"],
    [2_000_000_000, "69279037"],
  ])("matches the RFC vector at T=%i", (seconds, expected) => {
    expect(totp(key, Math.floor(seconds / 30), 8)).toBe(expected);
  });
});

describe("google wallet codes", () => {
  it("derives a stable 20-byte hex key per user", () => {
    const key = googleWalletTotpKeyHex(USER, SECRET);
    expect(key).toMatch(/^[0-9a-f]{40}$/);
    expect(googleWalletTotpKeyHex(USER, SECRET)).toBe(key);
    expect(googleWalletTotpKeyHex("other", SECRET)).not.toBe(key);
  });

  it("verifies the value Google Wallet would render", () => {
    const key = Buffer.from(googleWalletTotpKeyHex(USER, SECRET), "hex");
    const value = totp(key, SLOT);
    const code = googleWalletCodePattern(USER).replace("{totp_value_0}", value);
    expect(verifyMemberPassCode(code, SECRET, NOW)).toEqual({
      kind: "google",
      ok: true,
      slot: SLOT,
      userId: USER,
    });
  });

  it("rejects an old TOTP value", () => {
    const key = Buffer.from(googleWalletTotpKeyHex(USER, SECRET), "hex");
    const code = `g1.${USER}.${totp(key, SLOT - 3)}`;
    expect(verifyMemberPassCode(code, SECRET, NOW)).toEqual({
      ok: false,
      reason: "stale",
    });
  });
});

describe("apple wallet codes", () => {
  it("verifies until the end of the expiry day in Oslo", () => {
    const code = signAppleWalletCode(USER, "2026-12-31", SECRET);
    expect(code.startsWith(`a1.${USER}.20261231.`)).toBe(true);
    expect(verifyMemberPassCode(code, SECRET, NOW)).toEqual({
      expiry: "2026-12-31",
      kind: "apple",
      ok: true,
      userId: USER,
    });
    expect(
      verifyMemberPassCode(code, SECRET, new Date("2026-12-31T22:30:00Z"))
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a forged expiry", () => {
    const code = signAppleWalletCode(USER, "2026-12-31", SECRET);
    const forged = code.replace("20261231", "20301231");
    expect(verifyMemberPassCode(forged, SECRET, NOW)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });
});

describe("dayColor", () => {
  it("is stable within an Oslo day and varies across days", () => {
    const morning = dayColor(new Date("2026-09-17T05:00:00Z"), SECRET);
    const evening = dayColor(new Date("2026-09-17T21:00:00Z"), SECRET);
    expect(evening).toEqual(morning);
    const names = new Set(
      Array.from({ length: 30 }, (_, day) =>
        dayColor(new Date(Date.UTC(2026, 8, day + 1, 12)), SECRET).name
      )
    );
    expect(names.size).toBeGreaterThan(3);
    expect(morning.hex).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe("isRecentDuplicate", () => {
  it("flags scans within ten minutes", () => {
    expect(isRecentDuplicate(null, NOW)).toBe(false);
    expect(
      isRecentDuplicate(new Date(NOW.getTime() - 9 * 60 * 1000), NOW)
    ).toBe(true);
    expect(
      isRecentDuplicate(new Date(NOW.getTime() - 11 * 60 * 1000), NOW)
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `packages/shared`): `bun x vitest run utils/member-pass.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/shared/utils/member-pass.ts`**

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  MEMBER_PASS_BATCH_SIZE,
  MEMBER_PASS_SLOT_TOLERANCE,
  type MemberPassCode,
  passSlot,
} from "./member-pass-slots";
import { osloToday } from "./membership-dates";

/**
 * Member pass codes. Server-only: every function here needs the secret.
 *
 *   v1.<userId>.<slot>.<sig>      web pass, one code per 30 s slot
 *   g1.<userId>.<totp>            Google Wallet rotating barcode
 *   a1.<userId>.<YYYYMMDD>.<sig>  Apple Wallet (static; Wallet cannot rotate)
 *
 * Codes carry only the Appwrite user id. They are not URLs, so a phone
 * camera shows opaque text.
 */

export const MEMBER_PASS_SECRET_ENV = "MEMBER_PASS_SECRET";
const MIN_SECRET_LENGTH = 32;
const SIGNATURE_BYTES = 16;
const GOOGLE_TOTP_KEY_BYTES = 20;
const GOOGLE_TOTP_DIGITS = 6;
export const DUPLICATE_SCAN_WINDOW_MS = 10 * 60 * 1000;

const USER_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;
const SLOT_RE = /^\d{1,12}$/;
const COMPACT_DATE_RE = /^(\d{4})(\d{2})(\d{2})$/;
const TOTP_RE = /^\d{6}$/;
const DASH_RE = /-/g;

export type MemberPassCodeKind = "web" | "google" | "apple";

export type MemberPassVerifyResult =
  | { kind: "web" | "google"; ok: true; slot: number; userId: string }
  | { expiry: string; kind: "apple"; ok: true; userId: string }
  | {
      ok: false;
      reason: "malformed" | "bad_signature" | "stale" | "expired";
    };

export function readMemberPassSecret(
  env: Record<string, string | undefined> = process.env
): string | null {
  const value = env[MEMBER_PASS_SECRET_ENV]?.trim();
  return value && value.length >= MIN_SECRET_LENGTH ? value : null;
}

function signature(secret: string, payload: string): string {
  return createHmac("sha256", secret)
    .update(payload)
    .digest()
    .subarray(0, SIGNATURE_BYTES)
    .toString("base64url");
}

function signaturesMatch(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function signWebPassCode(
  userId: string,
  slot: number,
  secret: string
): string {
  const payload = `v1.${userId}.${slot}`;
  return `${payload}.${signature(secret, payload)}`;
}

export function issueWebPassCodes(
  userId: string,
  nowMs: number,
  secret: string
): MemberPassCode[] {
  const first = passSlot(nowMs);
  return Array.from({ length: MEMBER_PASS_BATCH_SIZE }, (_, index) => {
    const slot = first + index;
    return { code: signWebPassCode(userId, slot, secret), slot };
  });
}

export function signAppleWalletCode(
  userId: string,
  expiryDate: string,
  secret: string
): string {
  const payload = `a1.${userId}.${expiryDate.replace(DASH_RE, "")}`;
  return `${payload}.${signature(secret, payload)}`;
}

export function googleWalletTotpKeyHex(userId: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`g1-totp.${userId}`)
    .digest()
    .subarray(0, GOOGLE_TOTP_KEY_BYTES)
    .toString("hex");
}

export function googleWalletCodePattern(userId: string): string {
  return `g1.${userId}.{totp_value_0}`;
}

const DYNAMIC_TRUNCATION_MASK = 0x0f;
const SIGN_BIT_MASK = 0x7f;

/** RFC 6238 TOTP (HMAC-SHA1) for an explicit time-step counter. */
export function totp(key: Buffer, counter: number, digits = 6): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hash = createHmac("sha1", key).update(message).digest();
  const offset = (hash.at(-1) ?? 0) & DYNAMIC_TRUNCATION_MASK;
  const binary =
    (((hash[offset] ?? 0) & SIGN_BIT_MASK) << 24) |
    ((hash[offset + 1] ?? 0) << 16) |
    ((hash[offset + 2] ?? 0) << 8) |
    (hash[offset + 3] ?? 0);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

const MALFORMED = { ok: false, reason: "malformed" } as const;
const BAD_SIGNATURE = { ok: false, reason: "bad_signature" } as const;
const STALE = { ok: false, reason: "stale" } as const;

function withinTolerance(slot: number, current: number): boolean {
  return Math.abs(slot - current) <= MEMBER_PASS_SLOT_TOLERANCE;
}

function verifyWeb(
  parts: string[],
  secret: string,
  current: number
): MemberPassVerifyResult {
  const sig = parts.at(-1) ?? "";
  const slotText = parts.at(-2) ?? "";
  const userId = parts.slice(1, -2).join(".");
  if (!(SLOT_RE.test(slotText) && USER_ID_RE.test(userId))) {
    return MALFORMED;
  }
  const slot = Number(slotText);
  if (!signaturesMatch(signature(secret, `v1.${userId}.${slot}`), sig)) {
    return BAD_SIGNATURE;
  }
  if (!withinTolerance(slot, current)) {
    return STALE;
  }
  return { kind: "web", ok: true, slot, userId };
}

function verifyGoogle(
  parts: string[],
  secret: string,
  current: number
): MemberPassVerifyResult {
  const value = parts.at(-1) ?? "";
  const userId = parts.slice(1, -1).join(".");
  if (!(TOTP_RE.test(value) && USER_ID_RE.test(userId))) {
    return MALFORMED;
  }
  const key = Buffer.from(googleWalletTotpKeyHex(userId, secret), "hex");
  for (
    let slot = current - MEMBER_PASS_SLOT_TOLERANCE;
    slot <= current + MEMBER_PASS_SLOT_TOLERANCE;
    slot += 1
  ) {
    if (signaturesMatch(totp(key, slot, GOOGLE_TOTP_DIGITS), value)) {
      return { kind: "google", ok: true, slot, userId };
    }
  }
  // A TOTP value cannot distinguish "wrong key" from "old step"; both are
  // reported as stale so a scanner tells the holder to refresh.
  return STALE;
}

function verifyApple(
  parts: string[],
  secret: string,
  now: Date
): MemberPassVerifyResult {
  const sig = parts.at(-1) ?? "";
  const compact = parts.at(-2) ?? "";
  const userId = parts.slice(1, -2).join(".");
  const date = COMPACT_DATE_RE.exec(compact);
  if (!(date && USER_ID_RE.test(userId))) {
    return MALFORMED;
  }
  if (!signaturesMatch(signature(secret, `a1.${userId}.${compact}`), sig)) {
    return BAD_SIGNATURE;
  }
  const expiry = `${date[1]}-${date[2]}-${date[3]}`;
  if (expiry < osloToday(now)) {
    return { ok: false, reason: "expired" };
  }
  return { expiry, kind: "apple", ok: true, userId };
}

const MIN_PARTS: Record<string, number> = { a1: 4, g1: 3, v1: 4 };

export function verifyMemberPassCode(
  code: string,
  secret: string,
  now: Date
): MemberPassVerifyResult {
  const parts = code.trim().split(".");
  const prefix = parts[0] ?? "";
  const minParts = MIN_PARTS[prefix];
  if (minParts === undefined || parts.length < minParts) {
    return MALFORMED;
  }
  const current = passSlot(now.getTime());
  if (prefix === "v1") {
    return verifyWeb(parts, secret, current);
  }
  if (prefix === "g1") {
    return verifyGoogle(parts, secret, current);
  }
  return verifyApple(parts, secret, now);
}

export const DAY_COLORS = [
  { hex: "#E5484D", name: "red" },
  { hex: "#F76B15", name: "orange" },
  { hex: "#FFC53D", name: "yellow" },
  { hex: "#7CB518", name: "lime" },
  { hex: "#30A46C", name: "green" },
  { hex: "#12A594", name: "teal" },
  { hex: "#00A2C7", name: "cyan" },
  { hex: "#0090FF", name: "blue" },
  { hex: "#3E63DD", name: "indigo" },
  { hex: "#8E4EC6", name: "purple" },
  { hex: "#D6409F", name: "pink" },
  { hex: "#AD7F58", name: "brown" },
] as const;

export type DayColorName = (typeof DAY_COLORS)[number]["name"];

export interface DayColor {
  hex: string;
  name: DayColorName;
}

/**
 * Today's pass color. Shown on every pass and every scanner so a guard can
 * spot a copy made on another day. Unpredictable without the secret.
 */
export function dayColor(now: Date, secret: string): DayColor {
  const digest = createHmac("sha256", secret)
    .update(`day.${osloToday(now)}`)
    .digest();
  const color = DAY_COLORS[digest.readUInt32BE(0) % DAY_COLORS.length];
  return { hex: color?.hex ?? DAY_COLORS[0].hex, name: color?.name ?? "red" };
}

export function isRecentDuplicate(
  previousScanAt: Date | null,
  now: Date
): boolean {
  if (!previousScanAt) {
    return false;
  }
  return now.getTime() - previousScanAt.getTime() < DUPLICATE_SCAN_WINDOW_MS;
}
```

Note: `verifyMemberPassCode` checks `"https://x.no"` → prefix `https://x` → not in `MIN_PARTS` → malformed. `"v1.x"` has 2 parts → malformed. `"v9.a.1.sig"` → unknown prefix → malformed.

- [ ] **Step 4: Run to verify it passes**

Run: `bun x vitest run utils/member-pass.test.ts` → PASS. If the RFC vector for T=2000000000 fails, re-check `writeBigUInt64BE` and the mask order before touching the test (the vectors are normative).

- [ ] **Step 5: Type-check, format, commit**

```bash
bun run check-types --filter=@repo/shared
bun x ultracite fix packages/shared/utils/member-pass.ts packages/shared/utils/member-pass.test.ts
git add packages/shared/utils/member-pass.ts packages/shared/utils/member-pass.test.ts
git commit -m "Sign and verify member pass codes

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

### Task 5: Register the new environment variables

**Files:**
- Modify: `turbo.json` (`tasks.build.env`, keep alphabetical order)
- Modify: `apps/web/.env.example`, `apps/admin/.env.example`

- [ ] **Step 1: Add to `turbo.json` `tasks.build.env`** (alphabetical positions):

```
"APPLE_PASS_CERT",
"APPLE_PASS_KEY",
"APPLE_PASS_KEY_PASSPHRASE",
"APPLE_PASS_TYPE_ID",
"APPLE_TEAM_ID",
"APPLE_WWDR_CERT",
"GOOGLE_WALLET_ISSUER_ID",
"GOOGLE_WALLET_SERVICE_ACCOUNT",
"MEMBER_PASS_SECRET",
```

- [ ] **Step 2: Append to `apps/web/.env.example`**

```bash
# Member pass. Server-only. Same value as apps/admin. `openssl rand -base64 32`
MEMBER_PASS_SECRET=

# Apple Wallet (optional; the button is hidden until all are set).
# PEM files, each base64-encoded onto one line: `base64 -i cert.pem`
APPLE_PASS_TYPE_ID=pass.no.biso.member
APPLE_TEAM_ID=4JQ6VWVRGY
APPLE_PASS_CERT=
APPLE_PASS_KEY=
APPLE_PASS_KEY_PASSPHRASE=
APPLE_WWDR_CERT=

# Google Wallet (optional; the button is hidden until both are set).
# Service account JSON key, base64-encoded onto one line.
GOOGLE_WALLET_ISSUER_ID=
GOOGLE_WALLET_SERVICE_ACCOUNT=
```

- [ ] **Step 3: Append to `apps/admin/.env.example`**

```bash
# Member pass scanner. Server-only. Same value as apps/web.
MEMBER_PASS_SECRET=
```

- [ ] **Step 4: Verify turbo still parses**

Run (repo root): `bun x turbo run check-types --filter=@repo/shared --dry-run=json > /dev/null && echo ok`
Expected: `ok`.

- [ ] **Step 5: Commit**

```bash
git add turbo.json apps/web/.env.example apps/admin/.env.example
git commit -m "Declare member pass environment variables

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
## Phase 2 — Web pass

### Task 6: `GET /api/member-pass`

**Files:**
- Create: `apps/web/src/lib/member-pass/types.ts`
- Create: `apps/web/src/lib/member-pass/state.ts`
- Test: `apps/web/src/lib/member-pass/state.test.ts`
- Create: `apps/web/src/lib/member-pass/wallet-config.ts`
- Test: `apps/web/src/lib/member-pass/wallet-config.test.ts`
- Create: `apps/web/src/lib/member-pass/resolve.ts`
- Create: `apps/web/src/app/api/member-pass/route.ts`
- Test: `apps/web/src/app/api/member-pass/route.test.ts`

**Interfaces:**
- Consumes: `getMembershipStatus()` (`@/lib/actions/membership`), `getLoggedInUser()` (`@/lib/actions/user`), `pickCurrentMembership`, `describeMembershipTerm`, `issueWebPassCodes`, `dayColor`, `readMemberPassSecret`.
- Produces:
  - `types.ts` (client-safe):
    ```ts
    export type MemberPassState = "active" | "no_bi_identity" | "not_member" | "expired" | "unavailable";
    export interface MemberPassHolder { expiryDate: string; membershipName: string; name: string; startDate: string; term: MembershipTerm | null }
    export interface MemberPassDayColor { hex: string; name: string }
    export interface MemberPassWallets { apple: boolean; google: boolean }
    export type MemberPassResponse =
      | { codes: MemberPassCode[]; dayColor: MemberPassDayColor; holder: MemberPassHolder; serverNow: number; state: "active"; wallets: MemberPassWallets }
      | { state: Exclude<MemberPassState, "active"> };
    ```
  - `state.ts`: `memberPassStateFor(status: MembershipStatus): MemberPassState`; `buildHolder(name: string, status: MembershipStatus): MemberPassHolder | null`
  - `wallet-config.ts`: `interface AppleWalletConfig { passTypeId; teamId; signerCert; signerKey; signerKeyPassphrase?: string; wwdr }` (all PEM strings decoded), `readAppleWalletConfig(env?): AppleWalletConfig | null`; `interface GoogleWalletConfig { clientEmail; issuerId; privateKey }`, `readGoogleWalletConfig(env?): GoogleWalletConfig | null`
  - `resolve.ts`: `type ResolvedMemberPass = { state: "unauthenticated" } | { state: Exclude<MemberPassState, "active"> } | { holder: MemberPassHolder; state: "active"; userId: string }`; `resolveMemberPass(): Promise<ResolvedMemberPass>`

- [ ] **Step 1: Read the Next 16 route handler guide**

Run: `ls apps/web/node_modules/next/dist/docs/` and read the route handlers page. Note how `GET` handlers and `Response` headers work in this version.

- [ ] **Step 2: Write the failing tests**

`apps/web/src/lib/member-pass/state.test.ts`:

```ts
import type { MembershipStatus } from "@repo/shared/utils/membership-status";
import { describe, expect, it } from "vitest";
import { buildHolder, memberPassStateFor } from "./state";

function status(overrides: Partial<MembershipStatus>): MembershipStatus {
  return {
    checkedAt: 0,
    expiredMemberships: [],
    finagoCategoryIds: [],
    isMember: false,
    memberships: [],
    ...overrides,
  };
}

const semester = {
  category: "113176",
  expiryDate: "2026-12-31",
  id: "54",
  name: "Semester",
  startDate: "2026-07-01",
};

describe("memberPassStateFor", () => {
  it.each([
    [{ isMember: true, memberships: [semester] }, "active"],
    [{ reason: "no_student_id" }, "no_bi_identity"],
    [{ reason: "invalid_student_id" }, "no_bi_identity"],
    [{ reason: "finago_error" }, "unavailable"],
    [{ reason: "unexpected_error" }, "unavailable"],
    [{ reason: "expired" }, "expired"],
    [{ reason: "no_categories" }, "not_member"],
    [{}, "not_member"],
  ] as const)("maps %o to %s", (overrides, expected) => {
    expect(memberPassStateFor(status(overrides))).toBe(expected);
  });
});

describe("buildHolder", () => {
  it("describes the longest-running membership", () => {
    const year = {
      ...semester,
      expiryDate: "2027-07-01",
      id: "71",
      name: "1 Year",
    };
    expect(
      buildHolder("Markus Heien", status({ isMember: true, memberships: [semester, year] }))
    ).toEqual({
      expiryDate: "2027-07-01",
      membershipName: "1 Year",
      name: "Markus Heien",
      startDate: "2026-07-01",
      term: { duration: "year", fromYear: 2026, season: null, toYear: 2027 },
    });
  });

  it("returns null without a membership", () => {
    expect(buildHolder("X", status({}))).toBeNull();
  });
});
```

`apps/web/src/lib/member-pass/wallet-config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readAppleWalletConfig, readGoogleWalletConfig } from "./wallet-config";

const b64 = (value: string) => Buffer.from(value).toString("base64");

describe("readAppleWalletConfig", () => {
  const env = {
    APPLE_PASS_CERT: b64("CERT"),
    APPLE_PASS_KEY: b64("KEY"),
    APPLE_PASS_KEY_PASSPHRASE: "pw",
    APPLE_PASS_TYPE_ID: "pass.no.biso.member",
    APPLE_TEAM_ID: "4JQ6VWVRGY",
    APPLE_WWDR_CERT: b64("WWDR"),
  };

  it("decodes the PEM values", () => {
    expect(readAppleWalletConfig(env)).toEqual({
      passTypeId: "pass.no.biso.member",
      signerCert: "CERT",
      signerKey: "KEY",
      signerKeyPassphrase: "pw",
      teamId: "4JQ6VWVRGY",
      wwdr: "WWDR",
    });
  });

  it("is null when any required value is missing", () => {
    expect(readAppleWalletConfig({ ...env, APPLE_WWDR_CERT: "" })).toBeNull();
  });
});

describe("readGoogleWalletConfig", () => {
  it("reads the service account JSON", () => {
    const account = b64(
      JSON.stringify({ client_email: "wallet@x.iam", private_key: "PK" })
    );
    expect(
      readGoogleWalletConfig({
        GOOGLE_WALLET_ISSUER_ID: "338800000000",
        GOOGLE_WALLET_SERVICE_ACCOUNT: account,
      })
    ).toEqual({ clientEmail: "wallet@x.iam", issuerId: "338800000000", privateKey: "PK" });
  });

  it("is null for missing or unreadable values", () => {
    expect(readGoogleWalletConfig({ GOOGLE_WALLET_ISSUER_ID: "1" })).toBeNull();
    expect(
      readGoogleWalletConfig({
        GOOGLE_WALLET_ISSUER_ID: "1",
        GOOGLE_WALLET_SERVICE_ACCOUNT: b64("not json"),
      })
    ).toBeNull();
  });
});
```

`apps/web/src/app/api/member-pass/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveMemberPass = vi.hoisted(() => vi.fn());
const readAppleWalletConfig = vi.hoisted(() => vi.fn(() => null));
const readGoogleWalletConfig = vi.hoisted(() => vi.fn(() => ({})));

vi.mock("@/lib/member-pass/resolve", () => ({ resolveMemberPass }));
vi.mock("@/lib/member-pass/wallet-config", () => ({
  readAppleWalletConfig,
  readGoogleWalletConfig,
}));

import { GET } from "./route";

const HOLDER = {
  expiryDate: "2026-12-31",
  membershipName: "Semester",
  name: "Markus Heien",
  startDate: "2026-07-01",
  term: { duration: "semester", fromYear: 2026, season: "fall", toYear: 2026 },
};

describe("GET /api/member-pass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MEMBER_PASS_SECRET", "test-secret-that-is-at-least-32-characters-long");
  });

  it("rejects anonymous visitors", async () => {
    resolveMemberPass.mockResolvedValue({ state: "unauthenticated" });
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("gives non-members a state and no codes", async () => {
    resolveMemberPass.mockResolvedValue({ state: "not_member" });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: "not_member" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("gives members twenty codes, the day color and wallet flags", async () => {
    resolveMemberPass.mockResolvedValue({
      holder: HOLDER,
      state: "active",
      userId: "user-1",
    });
    const response = await GET();
    const body = await response.json();
    expect(body.state).toBe("active");
    expect(body.holder).toEqual(HOLDER);
    expect(body.codes).toHaveLength(20);
    expect(body.codes[0].code).toMatch(/^v1\.user-1\.\d+\./);
    expect(body.dayColor.hex).toMatch(/^#/);
    expect(body.wallets).toEqual({ apple: false, google: true });
    expect(typeof body.serverNow).toBe("number");
  });

  it("reports unavailable when the secret is missing", async () => {
    vi.stubEnv("MEMBER_PASS_SECRET", "");
    resolveMemberPass.mockResolvedValue({
      holder: HOLDER,
      state: "active",
      userId: "user-1",
    });
    const response = await GET();
    expect(await response.json()).toEqual({ state: "unavailable" });
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run (from `apps/web`): `bun x vitest run src/lib/member-pass src/app/api/member-pass`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement**

`apps/web/src/lib/member-pass/types.ts`:

```ts
import type { MemberPassCode } from "@repo/shared/utils/member-pass-slots";
import type { MembershipTerm } from "@repo/shared/utils/membership-plans";

/**
 * Wire types for `GET /api/member-pass`. Client-safe: type-only imports.
 */

export type MemberPassState =
  | "active"
  | "no_bi_identity"
  | "not_member"
  | "expired"
  | "unavailable";

export interface MemberPassHolder {
  expiryDate: string;
  membershipName: string;
  name: string;
  startDate: string;
  term: MembershipTerm | null;
}

export interface MemberPassDayColor {
  hex: string;
  name: string;
}

export interface MemberPassWallets {
  apple: boolean;
  google: boolean;
}

export type MemberPassResponse =
  | {
      codes: MemberPassCode[];
      dayColor: MemberPassDayColor;
      holder: MemberPassHolder;
      serverNow: number;
      state: "active";
      wallets: MemberPassWallets;
    }
  | { state: Exclude<MemberPassState, "active"> };
```

`apps/web/src/lib/member-pass/state.ts`:

```ts
import { describeMembershipTerm } from "@repo/shared/utils/membership-plans";
import {
  type MembershipStatus,
  pickCurrentMembership,
} from "@repo/shared/utils/membership-status";
import type { MemberPassHolder, MemberPassState } from "./types";

const NOT_LINKED_REASONS = new Set(["no_student_id", "invalid_student_id"]);
const TRANSIENT_REASONS = new Set(["finago_error", "unexpected_error"]);

export function memberPassStateFor(status: MembershipStatus): MemberPassState {
  if (status.isMember) {
    return "active";
  }
  const reason = status.reason ?? "";
  if (NOT_LINKED_REASONS.has(reason)) {
    return "no_bi_identity";
  }
  if (TRANSIENT_REASONS.has(reason)) {
    return "unavailable";
  }
  if (reason === "expired") {
    return "expired";
  }
  return "not_member";
}

export function buildHolder(
  name: string,
  status: MembershipStatus
): MemberPassHolder | null {
  const current = pickCurrentMembership(status.memberships);
  if (!current) {
    return null;
  }
  return {
    expiryDate: current.expiryDate,
    membershipName: current.name,
    name,
    startDate: current.startDate,
    term: describeMembershipTerm(current.startDate, current.expiryDate),
  };
}
```

`apps/web/src/lib/member-pass/wallet-config.ts`:

```ts
import "server-only";

type Env = Record<string, string | undefined>;

export interface AppleWalletConfig {
  passTypeId: string;
  signerCert: string;
  signerKey: string;
  signerKeyPassphrase?: string;
  teamId: string;
  wwdr: string;
}

export interface GoogleWalletConfig {
  clientEmail: string;
  issuerId: string;
  privateKey: string;
}

function decodeBase64(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  const decoded = Buffer.from(trimmed, "base64").toString("utf8");
  return decoded || null;
}

export function readAppleWalletConfig(
  env: Env = process.env
): AppleWalletConfig | null {
  const passTypeId = env.APPLE_PASS_TYPE_ID?.trim();
  const teamId = env.APPLE_TEAM_ID?.trim();
  const signerCert = decodeBase64(env.APPLE_PASS_CERT);
  const signerKey = decodeBase64(env.APPLE_PASS_KEY);
  const wwdr = decodeBase64(env.APPLE_WWDR_CERT);
  if (!(passTypeId && teamId && signerCert && signerKey && wwdr)) {
    return null;
  }
  const passphrase = env.APPLE_PASS_KEY_PASSPHRASE?.trim();
  return {
    passTypeId,
    signerCert,
    signerKey,
    teamId,
    wwdr,
    ...(passphrase ? { signerKeyPassphrase: passphrase } : {}),
  };
}

export function readGoogleWalletConfig(
  env: Env = process.env
): GoogleWalletConfig | null {
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID?.trim();
  const json = decodeBase64(env.GOOGLE_WALLET_SERVICE_ACCOUNT);
  if (!(issuerId && json)) {
    return null;
  }
  try {
    const parsed = JSON.parse(json) as {
      client_email?: unknown;
      private_key?: unknown;
    };
    if (
      typeof parsed.client_email !== "string" ||
      typeof parsed.private_key !== "string"
    ) {
      return null;
    }
    return {
      clientEmail: parsed.client_email,
      issuerId,
      privateKey: parsed.private_key,
    };
  } catch {
    return null;
  }
}
```

If `server-only` is not resolvable in vitest, add `vi.mock("server-only", () => ({}))` to `wallet-config.test.ts` (the API app's tests do the same).

`apps/web/src/lib/member-pass/resolve.ts`:

```ts
import "server-only";
import { getMembershipStatus } from "@/lib/actions/membership";
import { getLoggedInUser } from "@/lib/actions/user";
import { buildHolder, memberPassStateFor } from "./state";
import type { MemberPassHolder, MemberPassState } from "./types";

export type ResolvedMemberPass =
  | { state: "unauthenticated" }
  | { state: Exclude<MemberPassState, "active"> }
  | { holder: MemberPassHolder; state: "active"; userId: string };

/** The signed-in user's pass, gated on a live membership check. */
export async function resolveMemberPass(): Promise<ResolvedMemberPass> {
  const userData = await getLoggedInUser();
  if (!userData) {
    return { state: "unauthenticated" };
  }
  const status = await getMembershipStatus();
  const state = memberPassStateFor(status);
  if (state !== "active") {
    return { state };
  }
  const name =
    userData.profile?.name?.trim() || userData.user.name?.trim() || "";
  const holder = buildHolder(name, status);
  if (!holder) {
    return { state: "unavailable" };
  }
  return { holder, state: "active", userId: userData.user.$id };
}
```

`apps/web/src/app/api/member-pass/route.ts`:

```ts
import {
  dayColor,
  issueWebPassCodes,
  readMemberPassSecret,
} from "@repo/shared/utils/member-pass";
import { NextResponse } from "next/server";
import { resolveMemberPass } from "@/lib/member-pass/resolve";
import type { MemberPassResponse } from "@/lib/member-pass/types";
import {
  readAppleWalletConfig,
  readGoogleWalletConfig,
} from "@/lib/member-pass/wallet-config";

const NO_STORE = { "Cache-Control": "private, no-store" };

function json(body: MemberPassResponse) {
  return NextResponse.json(body, { headers: NO_STORE });
}

/**
 * The signed-in member's pass: ten minutes of rotating codes, issued only
 * after a live membership check. Non-members get their state and no codes.
 */
export async function GET() {
  const resolved = await resolveMemberPass();
  if (resolved.state === "unauthenticated") {
    return NextResponse.json(
      { error: "not_authenticated" },
      { headers: NO_STORE, status: 401 }
    );
  }
  if (resolved.state !== "active") {
    return json({ state: resolved.state });
  }

  const secret = readMemberPassSecret();
  if (!secret) {
    console.error("[Member Pass] MEMBER_PASS_SECRET is not configured");
    return json({ state: "unavailable" });
  }

  const now = Date.now();
  return json({
    codes: issueWebPassCodes(resolved.userId, now, secret),
    dayColor: dayColor(new Date(now), secret),
    holder: resolved.holder,
    serverNow: now,
    state: "active",
    wallets: {
      apple: readAppleWalletConfig() !== null,
      google: readGoogleWalletConfig() !== null,
    },
  });
}
```

- [ ] **Step 5: Run to verify they pass**

Run (from `apps/web`): `bun x vitest run src/lib/member-pass src/app/api/member-pass` → PASS.

- [ ] **Step 6: Type-check, format, commit**

```bash
bun run check-types --filter=web
bun x ultracite fix apps/web/src/lib/member-pass apps/web/src/app/api/member-pass
git add apps/web/src/lib/member-pass apps/web/src/app/api/member-pass
git commit -m "Issue member pass codes to verified members

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
### Task 7: `memberPass` translations

**Files:**
- Create: `packages/i18n/messages/en/memberPass.json`, `packages/i18n/messages/no/memberPass.json`
- Modify: `packages/i18n/messages/en.ts`, `packages/i18n/messages/no.ts` (import + add to the default export)
- Modify: `packages/i18n/types.ts` (add `| "memberPass"` to `MessageNamespace`)
- Modify: `packages/i18n/messages/index.ts` (add `"memberPass"` next to `"memberPortal"`)

**Interfaces:**
- Produces: namespace `memberPass` with the keys below (used by Tasks 8–10 and 17–18).

- [ ] **Step 1: Create `packages/i18n/messages/en/memberPass.json`**

```json
{
  "member": "Member",
  "live": "Live",
  "validUntil": "Valid until {date}",
  "refreshesIn": "New code in {seconds}s",
  "tapToShow": "Tap to show staff",
  "close": "Close",
  "showToStaff": "Show this screen to staff. The code changes every 30 seconds.",
  "todaysColor": "Today's color",
  "term": {
    "semester": "{season, select, spring {Spring} other {Fall}} {year}",
    "span": "{from}–{to}"
  },
  "duration": {
    "semester": "Semester",
    "year": "1 year",
    "three_years": "3 years"
  },
  "colors": {
    "red": "Red",
    "orange": "Orange",
    "yellow": "Yellow",
    "lime": "Lime",
    "green": "Green",
    "teal": "Teal",
    "cyan": "Cyan",
    "blue": "Blue",
    "indigo": "Indigo",
    "purple": "Purple",
    "pink": "Pink",
    "brown": "Brown"
  },
  "states": {
    "loading": "Checking your membership…",
    "noBiIdentity": {
      "title": "Link your BI Student account",
      "description": "We verify your membership through your BI student account.",
      "action": "Link BI Student"
    },
    "notMember": {
      "title": "No active membership",
      "description": "Become a member to get your pass, discounts and member prices.",
      "action": "Become a member"
    },
    "expired": {
      "title": "Your membership has ended",
      "description": "Renew to get your pass back.",
      "action": "Renew membership"
    },
    "unavailable": {
      "title": "Can't verify right now",
      "description": "We couldn't reach the membership register. Try again in a moment.",
      "action": "Try again"
    },
    "offline": {
      "title": "Reconnect to refresh your pass",
      "description": "Your pass needs a connection at least every ten minutes."
    }
  },
  "wallet": {
    "apple": "Add to Apple Wallet",
    "google": "Add to Google Wallet"
  }
}
```

- [ ] **Step 2: Create `packages/i18n/messages/no/memberPass.json`**

```json
{
  "member": "Medlem",
  "live": "Live",
  "validUntil": "Gyldig til {date}",
  "refreshesIn": "Ny kode om {seconds}s",
  "tapToShow": "Trykk for å vise frem",
  "close": "Lukk",
  "showToStaff": "Vis denne skjermen til personalet. Koden endres hvert 30. sekund.",
  "todaysColor": "Dagens farge",
  "term": {
    "semester": "{season, select, spring {Vår} other {Høst}} {year}",
    "span": "{from}–{to}"
  },
  "duration": {
    "semester": "Semester",
    "year": "1 år",
    "three_years": "3 år"
  },
  "colors": {
    "red": "Rød",
    "orange": "Oransje",
    "yellow": "Gul",
    "lime": "Limegrønn",
    "green": "Grønn",
    "teal": "Blågrønn",
    "cyan": "Turkis",
    "blue": "Blå",
    "indigo": "Indigo",
    "purple": "Lilla",
    "pink": "Rosa",
    "brown": "Brun"
  },
  "states": {
    "loading": "Sjekker medlemskapet ditt…",
    "noBiIdentity": {
      "title": "Koble til BI Student-kontoen din",
      "description": "Vi bekrefter medlemskapet ditt via BI-studentkontoen din.",
      "action": "Koble til BI Student"
    },
    "notMember": {
      "title": "Ingen aktivt medlemskap",
      "description": "Bli medlem for å få medlemskortet, rabatter og medlemspriser.",
      "action": "Bli medlem"
    },
    "expired": {
      "title": "Medlemskapet ditt har utløpt",
      "description": "Forny for å få medlemskortet tilbake.",
      "action": "Forny medlemskap"
    },
    "unavailable": {
      "title": "Kan ikke bekrefte akkurat nå",
      "description": "Vi fikk ikke kontakt med medlemsregisteret. Prøv igjen om litt.",
      "action": "Prøv igjen"
    },
    "offline": {
      "title": "Koble til nettet for å oppdatere kortet",
      "description": "Medlemskortet trenger nett minst hvert tiende minutt."
    }
  },
  "wallet": {
    "apple": "Legg til i Apple Wallet",
    "google": "Legg til i Google Wallet"
  }
}
```

- [ ] **Step 3: Register the namespace**

In `en.ts`: `import memberPass from "./en/memberPass.json";` and add `memberPass,` to the default export object (next to `memberPortal`). Same in `no.ts` with `./no/memberPass.json`. Add `| "memberPass"` after `| "memberPortal"` in `types.ts`, and `"memberPass",` after `"memberPortal",` in `messages/index.ts`.

- [ ] **Step 4: Verify**

Run (repo root): `bun run check-types --filter=@repo/i18n --filter=web`
Expected: no errors. Then `grep -c '"' packages/i18n/messages/en/memberPass.json packages/i18n/messages/no/memberPass.json` — the two counts must match (same key set).

- [ ] **Step 5: Commit**

```bash
git add packages/i18n
git commit -m "Add member pass translations

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

### Task 8: `<MemberPass>` component

**Files:**
- Modify: `apps/web/package.json` via `bun add qrcode --filter=web` and `bun add -d @types/qrcode --filter=web`
- Create: `apps/web/src/components/member-pass/qr-code.tsx`
- Create: `apps/web/src/components/member-pass/qr-path.ts`
- Test: `apps/web/src/components/member-pass/qr-path.test.ts`
- Create: `apps/web/src/components/member-pass/use-member-pass.ts`
- Create: `apps/web/src/components/member-pass/member-pass-card.tsx`
- Create: `apps/web/src/components/member-pass/member-pass.tsx`
- Create: `apps/web/src/components/member-pass/member-pass.css`

**Interfaces:**
- Consumes: `MemberPassResponse` etc. (Task 6 `types.ts`), slot helpers (Task 3), namespace `memberPass` (Task 7).
- Produces:
  - `qrPath(text: string): { path: string; size: number }` — SVG path (`M x y h1v1h-1z` per dark module) for a QR code with error correction `M`.
  - `<QrCode value: string; className?: string; label: string />`
  - `useMemberPass(): { data: MemberPassResponse | null; loading: boolean; now: number; offline: boolean; current: MemberPassCode | null; secondsLeft: number; refresh: () => void }`
  - `<MemberPassCard pass: Extract<MemberPassResponse, { state: "active" }>; current: MemberPassCode | null; now: number; secondsLeft: number; offline: boolean />`
  - `<MemberPass />` — default-free named export; self-contained (fetches, renders every state).

- [ ] **Step 1: Install dependencies**

```bash
bun add qrcode --filter=web
bun add -d @types/qrcode --filter=web
```

- [ ] **Step 2: Write the failing test** (`qr-path.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { qrPath } from "./qr-path";

describe("qrPath", () => {
  it("draws one unit square per dark module", () => {
    const { path, size } = qrPath("v1.user-1.59000000.abcdefghijklmnopqrstuv");
    expect(size).toBeGreaterThanOrEqual(21);
    expect(path.startsWith("M")).toBe(true);
    const squares = path.match(/M/g)?.length ?? 0;
    expect(squares).toBeGreaterThan(size);
    expect(squares).toBeLessThan(size * size);
  });

  it("is deterministic", () => {
    expect(qrPath("abc")).toEqual(qrPath("abc"));
  });
});
```

Run (from `apps/web`): `bun x vitest run src/components/member-pass` → FAIL (module not found).

- [ ] **Step 3: Implement `qr-path.ts` and `qr-code.tsx`**

`qr-path.ts`:

```ts
import QRCode from "qrcode";

/**
 * Renders a QR code as a single SVG path so the pass never needs
 * `dangerouslySetInnerHTML`.
 */
export function qrPath(text: string): { path: string; size: number } {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const { size } = modules;
  const parts: string[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (modules.get(row, col)) {
        parts.push(`M${col} ${row}h1v1h-1z`);
      }
    }
  }
  return { path: parts.join(""), size };
}
```

If `@types/qrcode` does not declare `modules.get`, type the call as `(modules as unknown as { get: (r: number, c: number) => number; size: number })` in one local `const`.

`qr-code.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { qrPath } from "./qr-path";

const QUIET_ZONE = 2;

export function QrCode({
  className,
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string;
}) {
  const { path, size } = useMemo(() => qrPath(value), [value]);
  const box = size + QUIET_ZONE * 2;
  return (
    <svg
      aria-label={label}
      className={className}
      role="img"
      shapeRendering="crispEdges"
      viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${box} ${box}`}
    >
      <title>{label}</title>
      <rect
        fill="#fff"
        height={box}
        width={box}
        x={-QUIET_ZONE}
        y={-QUIET_ZONE}
      />
      <path d={path} fill="#000" />
    </svg>
  );
}
```

Run: `bun x vitest run src/components/member-pass` → PASS.

- [ ] **Step 4: Implement `use-member-pass.ts`**

```ts
"use client";

import {
  codesRemaining,
  MEMBER_PASS_REFETCH_BELOW,
  type MemberPassCode,
  passSlot,
  selectCurrentCode,
  slotSecondsLeft,
} from "@repo/shared/utils/member-pass-slots";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MemberPassResponse } from "@/lib/member-pass/types";

const TICK_MS = 1000;

/**
 * Loads the member pass and keeps the visible code in step with the clock.
 * Codes live only in component state — never in storage.
 */
export function useMemberPass() {
  const [data, setData] = useState<MemberPassResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const drift = useRef(0);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    try {
      const response = await fetch("/api/member-pass", { cache: "no-store" });
      if (!response.ok) {
        setData({ state: "unavailable" });
        return;
      }
      const body = (await response.json()) as MemberPassResponse;
      if (body.state === "active") {
        drift.current = body.serverNow - Date.now();
      }
      setData(body);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        load();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", load);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", load);
    };
  }, [load]);

  const correctedNow = now + drift.current;
  const slot = passSlot(correctedNow);
  const codes: MemberPassCode[] = data?.state === "active" ? data.codes : [];
  const remaining = codesRemaining(codes, slot);

  useEffect(() => {
    if (data?.state === "active" && remaining < MEMBER_PASS_REFETCH_BELOW) {
      load();
    }
  }, [data, remaining, load]);

  return {
    current: selectCurrentCode(codes, slot),
    data,
    loading,
    now: correctedNow,
    offline,
    refresh: load,
    secondsLeft: slotSecondsLeft(correctedNow),
  };
}
```

- [ ] **Step 5: Implement `member-pass.css`**

```css
@keyframes member-pass-holo {
  from {
    background-position: 0% 50%;
  }
  to {
    background-position: 200% 50%;
  }
}

@keyframes member-pass-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.8);
  }
}

.member-pass-holo {
  animation: member-pass-holo 4s linear infinite;
  background-image: linear-gradient(
    110deg,
    #ff6ec4,
    #7873f5,
    #4ade80,
    #facc15,
    #ff6ec4,
    #7873f5
  );
  background-size: 200% 100%;
}

.member-pass-live-dot {
  animation: member-pass-pulse 1.2s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  /* Slowed, not stopped: the motion is what tells a live pass from a still. */
  .member-pass-holo {
    animation-duration: 20s;
  }
  .member-pass-live-dot {
    animation-duration: 4s;
  }
}
```

- [ ] **Step 6: Implement `member-pass-card.tsx`**

```tsx
"use client";

import type { MemberPassCode } from "@repo/shared/utils/member-pass-slots";
import { Button } from "@repo/ui/components/ui/button";
import { Smartphone, Wallet, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { MemberPassHolder, MemberPassResponse } from "@/lib/member-pass/types";
import { QrCode } from "./qr-code";
import "./member-pass.css";

type ActivePass = Extract<MemberPassResponse, { state: "active" }>;

interface MemberPassCardProps {
  current: MemberPassCode | null;
  now: number;
  offline: boolean;
  pass: ActivePass;
  secondsLeft: number;
}

const SLOT_SECONDS = 30;
const RING_RADIUS = 16;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function useTermLabel(holder: MemberPassHolder): string {
  const t = useTranslations("memberPass");
  const { term } = holder;
  if (!term) {
    return holder.membershipName;
  }
  if (term.season) {
    return t("term.semester", { season: term.season, year: term.fromYear });
  }
  return t("term.span", { from: term.fromYear, to: term.toYear });
}

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!(active && "wakeLock" in navigator)) {
      return;
    }
    let sentinel: WakeLockSentinel | null = null;
    navigator.wakeLock
      .request("screen")
      .then((lock) => {
        sentinel = lock;
      })
      .catch(() => undefined);
    return () => {
      sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}

function CountdownRing({ secondsLeft }: { secondsLeft: number }) {
  const offset = RING_CIRCUMFERENCE * (1 - secondsLeft / SLOT_SECONDS);
  return (
    <svg aria-hidden="true" className="h-10 w-10 -rotate-90" viewBox="0 0 40 40">
      <circle cx="20" cy="20" fill="none" r={RING_RADIUS} stroke="currentColor" strokeOpacity={0.2} strokeWidth={4} />
      <circle
        cx="20"
        cy="20"
        fill="none"
        r={RING_RADIUS}
        stroke="currentColor"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={offset}
        strokeLinecap="round"
        strokeWidth={4}
      />
    </svg>
  );
}

function PassBody({
  current,
  now,
  offline,
  pass,
  secondsLeft,
}: MemberPassCardProps) {
  const t = useTranslations("memberPass");
  const format = useFormatter();
  const termLabel = useTermLabel(pass.holder);
  const clock = format.dateTime(new Date(now), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Oslo",
  });
  const validUntil = format.dateTime(new Date(`${pass.holder.expiryDate}T12:00:00Z`), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="overflow-hidden rounded-3xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to text-white shadow-xl">
      <div className="flex items-start justify-between px-6 pt-6">
        <div>
          <p className="font-semibold text-sm text-white/70 tracking-widest">BISO</p>
          <p className="font-black text-4xl uppercase tracking-tight">{t("member")}</p>
        </div>
        <p className="rounded-full bg-white/15 px-3 py-1 font-semibold text-sm">{termLabel}</p>
      </div>

      <div className="member-pass-holo mt-5 h-3" />

      <div className="flex items-center justify-between px-6 pt-5">
        <p className="truncate font-semibold text-2xl">{pass.holder.name}</p>
        <p className="flex items-center gap-2 font-mono text-lg tabular-nums">
          <span className="member-pass-live-dot inline-block h-2.5 w-2.5 rounded-full bg-green-400" />
          <span className="sr-only">{t("live")}</span>
          {clock}
        </p>
      </div>

      <div
        className="mx-6 mt-4 flex items-center justify-between rounded-xl px-4 py-3 font-bold text-lg"
        style={{ backgroundColor: pass.dayColor.hex }}
      >
        <span className="text-white/90 text-xs uppercase tracking-widest">{t("todaysColor")}</span>
        <span className="uppercase tracking-wider">{t(`colors.${pass.dayColor.name}` as "colors.red")}</span>
      </div>

      <div className="flex items-center gap-5 p-6">
        <div className="w-40 shrink-0 overflow-hidden rounded-xl bg-white p-2">
          {current && !offline ? (
            <QrCode className="h-full w-full" label={t("showToStaff")} value={current.code} />
          ) : (
            <div className="flex aspect-square items-center justify-center p-2 text-center text-black text-xs">
              {t("states.offline.title")}
            </div>
          )}
        </div>
        <div className="space-y-3">
          <p className="text-sm text-white/80">{t("validUntil", { date: validUntil })}</p>
          <div className="flex items-center gap-2 text-sm text-white/80">
            <CountdownRing secondsLeft={secondsLeft} />
            {t("refreshesIn", { seconds: secondsLeft })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MemberPassCard(props: MemberPassCardProps) {
  const t = useTranslations("memberPass");
  const [presenting, setPresenting] = useState(false);
  useWakeLock(presenting);
  const { wallets } = props.pass;

  return (
    <div className="space-y-3">
      <button
        aria-label={t("tapToShow")}
        className="block w-full text-left"
        onClick={() => setPresenting(true)}
        type="button"
      >
        <PassBody {...props} />
      </button>
      <p className="text-center text-muted-foreground text-xs">{t("tapToShow")}</p>

      {wallets.apple || wallets.google ? (
        <div className="flex flex-wrap justify-center gap-2">
          {wallets.apple ? (
            <Button asChild size="sm" variant="outline">
              <a href="/api/member-pass/apple">
                <Wallet className="mr-2 h-4 w-4" />
                {t("wallet.apple")}
              </a>
            </Button>
          ) : null}
          {wallets.google ? (
            <Button asChild size="sm" variant="outline">
              <a href="/api/member-pass/google">
                <Smartphone className="mr-2 h-4 w-4" />
                {t("wallet.google")}
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}

      {presenting ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black p-4"
          role="dialog"
        >
          <div className="w-full max-w-md">
            <PassBody {...props} />
          </div>
          <p className="max-w-md text-center text-sm text-white/70">{t("showToStaff")}</p>
          <Button onClick={() => setPresenting(false)} variant="secondary">
            <X className="mr-2 h-4 w-4" />
            {t("close")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
```

If `WakeLockSentinel` is not in the DOM lib types, declare `type WakeLockSentinel = { release: () => Promise<void> }` locally and access `navigator.wakeLock` through a narrow cast.

- [ ] **Step 7: Implement `member-pass.tsx`**

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { CircleAlert, Link2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { MemberPassCard } from "./member-pass-card";
import { useMemberPass } from "./use-member-pass";

function StateCard({
  action,
  description,
  icon,
  title,
}: {
  action?: ReactNode;
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 border border-primary/10 p-6 text-center">
      <div className="rounded-full bg-primary/10 p-3 text-primary-80">{icon}</div>
      <p className="font-semibold text-lg text-primary-100">{title}</p>
      <p className="max-w-sm text-primary-60 text-sm">{description}</p>
      {action}
    </Card>
  );
}

/** The signed-in member's live pass, or the next step toward one. */
export function MemberPass({ linkHref = "/profile#linked" }: { linkHref?: string }) {
  const t = useTranslations("memberPass");
  const pass = useMemberPass();

  if (pass.loading && !pass.data) {
    return (
      <StateCard
        description=""
        icon={<Loader2 className="h-6 w-6 animate-spin" />}
        title={t("states.loading")}
      />
    );
  }

  const data = pass.data;
  if (data?.state === "active") {
    return (
      <MemberPassCard
        current={pass.current}
        now={pass.now}
        offline={pass.offline && !pass.current}
        pass={data}
        secondsLeft={pass.secondsLeft}
      />
    );
  }

  if (data?.state === "no_bi_identity") {
    return (
      <StateCard
        action={
          <Button asChild>
            <Link href={linkHref}>{t("states.noBiIdentity.action")}</Link>
          </Button>
        }
        description={t("states.noBiIdentity.description")}
        icon={<Link2 className="h-6 w-6" />}
        title={t("states.noBiIdentity.title")}
      />
    );
  }

  if (data?.state === "not_member" || data?.state === "expired") {
    const key = data.state === "expired" ? "expired" : "notMember";
    return (
      <StateCard
        action={
          <Button asChild>
            <Link href="/membership/join">{t(`states.${key}.action`)}</Link>
          </Button>
        }
        description={t(`states.${key}.description`)}
        icon={<Sparkles className="h-6 w-6" />}
        title={t(`states.${key}.title`)}
      />
    );
  }

  return (
    <StateCard
      action={
        <Button onClick={pass.refresh} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("states.unavailable.action")}
        </Button>
      }
      description={t("states.unavailable.description")}
      icon={<CircleAlert className="h-6 w-6" />}
      title={t("states.unavailable.title")}
    />
  );
}
```

Check where the profile page's "Linked Accounts" tab lives (`src/components/profile/profile-tabs.tsx`) and set the default `linkHref` to the anchor/query that opens it; if there is none, use `/profile`.

- [ ] **Step 8: Type-check, lint, test**

```bash
bun run check-types --filter=web
cd apps/web && bun x vitest run src/components/member-pass && bun run lint
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
bun x ultracite fix apps/web/src/components/member-pass
git add apps/web/package.json bun.lock apps/web/src/components/member-pass
git commit -m "Add the live member pass component

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
### Task 9: Pass on the profile page

**Files:**
- Modify: `apps/web/src/app/(protected)/profile/page.tsx`
- Delete (if unused after the change): `apps/web/src/components/profile/membership-status-card.tsx`

**Interfaces:**
- Consumes: `<MemberPass />` (Task 8).

- [ ] **Step 1: Replace the status card**

In `page.tsx`:
- Remove the imports of `MembershipCheckResult`, `MembershipStatusCard`, and `checkMembership`.
- Remove `let membership …`, `let hasBIIdentity …`, and the `hasBIIdentity` / `checkMembership()` block. Keep `identitiesResp = await listIdentities();` (ProfileTabs uses it).
- Add `import { MemberPass } from "@/components/member-pass/member-pass";`
- Replace the `{/* Membership status up-front */}` block with:

```tsx
      {/* Membership pass up-front */}
      <div className="mx-auto mb-6 max-w-md">
        <MemberPass />
      </div>
```

- [ ] **Step 2: Remove the dead component**

Run (from repo root): `grep -rn "membership-status-card\|MembershipCheckResult" apps/web/src`
If nothing references it any more, `git rm apps/web/src/components/profile/membership-status-card.tsx`. If something still does, leave the file.

- [ ] **Step 3: Verify**

```bash
bun run check-types --filter=web
cd apps/web && bun run lint
```

Then start the app (`bun run dev --filter=web`), sign in as the linked test account, open `/profile`, and confirm: the pass renders, the clock ticks, the QR changes when the countdown hits 0, tapping opens the full-screen view, and removing the Finago category + reload shows "No active membership" (the membership cache is 10 minutes; use `/api/membership?refresh=true` first).

- [ ] **Step 4: Commit**

```bash
bun x ultracite fix "apps/web/src/app/(protected)/profile/page.tsx"
git add -A "apps/web/src/app/(protected)/profile" apps/web/src/components/profile
git commit -m "Show the member pass on the profile page

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

### Task 10: Member portal uses real membership data and shows the pass

**Files:**
- Create: `apps/web/src/lib/member-portal-membership.ts`
- Test: `apps/web/src/lib/member-portal-membership.test.ts`
- Modify: `apps/web/src/app/(public)/member/page.tsx`
- Modify: `apps/web/src/app/(public)/member/member-portal-content.tsx`
- Modify: `apps/web/src/components/member-portal/member-portal-tabs.tsx`
- Modify: `apps/web/src/components/member-portal/tabs/home-tab.tsx`
- Replace: `apps/web/src/components/member-portal/tabs/membership-tab.tsx`
- Delete: `apps/web/src/components/member-portal/shared/membership-card.tsx`
- Modify: `packages/i18n/messages/en/memberPortal.json`, `packages/i18n/messages/no/memberPortal.json` (`membership` section)

**Interfaces:**
- Consumes: `getMembershipStatus()`, `pickCurrentMembership`, `describeMembershipTerm`, `getPurchasableMembershipPlans()`, `MembershipPlan`, `<MemberPass />`.
- Produces (`@/lib/member-portal-membership`):
  ```ts
  export interface CurrentMembershipView { daysRemaining: number; duration: MembershipDuration | null; expiryDate: string; name: string; startDate: string; termDays: number }
  export interface PlanView { duration: MembershipDuration; expiryDate: string; id: string; price: number }
  export function toCurrentMembershipView(status: MembershipStatus, now?: Date): CurrentMembershipView | null
  export function upgradePlans(plans: MembershipPlan[], current: CurrentMembershipView | null): PlanView[]
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { toCurrentMembershipView, upgradePlans } from "./member-portal-membership";

const base = {
  checkedAt: 0,
  expiredMemberships: [],
  finagoCategoryIds: [113_176],
  isMember: true,
};

const semester = {
  category: "113176",
  expiryDate: "2026-12-31",
  id: "54",
  name: "Semester",
  startDate: "2026-07-01",
};

const plan = (id: string, duration: "semester" | "year" | "three_years", expiryDate: string) => ({
  accrualMonths: 6 as const,
  categoryId: 1,
  duration,
  expiryDate,
  id,
  name: id,
  price: 100,
  productId: 1,
  startDate: "2026-07-01",
});

describe("toCurrentMembershipView", () => {
  it("reports a fall semester as a semester, not a year", () => {
    const view = toCurrentMembershipView(
      { ...base, memberships: [semester] },
      new Date("2026-09-17T10:00:00Z")
    );
    expect(view).toEqual({
      daysRemaining: 105,
      duration: "semester",
      expiryDate: "2026-12-31",
      name: "Semester",
      startDate: "2026-07-01",
      termDays: 183,
    });
  });

  it("is null for non-members", () => {
    expect(
      toCurrentMembershipView({ ...base, isMember: false, memberships: [] })
    ).toBeNull();
  });
});

describe("upgradePlans", () => {
  const plans = [
    plan("54", "semester", "2026-12-31"),
    plan("71", "year", "2027-07-01"),
    plan("82", "three_years", "2029-07-01"),
  ];

  it("offers only plans that run past the current membership", () => {
    const current = toCurrentMembershipView(
      { ...base, memberships: [semester] },
      new Date("2026-09-17T10:00:00Z")
    );
    expect(upgradePlans(plans, current).map((p) => p.id)).toEqual(["71", "82"]);
  });

  it("offers every plan to non-members", () => {
    expect(upgradePlans(plans, null)).toHaveLength(3);
  });
});
```

Run (from `apps/web`): `bun x vitest run src/lib/member-portal-membership.test.ts` → FAIL.

Day math: 2026-09-17 → 2026-12-31 is 105 days; 2026-07-01 → 2026-12-31 is 183 days.

- [ ] **Step 2: Implement `apps/web/src/lib/member-portal-membership.ts`**

```ts
import {
  describeMembershipTerm,
  type MembershipDuration,
  type MembershipPlan,
} from "@repo/shared/utils/membership-plans";
import {
  type MembershipStatus,
  osloToday,
  pickCurrentMembership,
} from "@repo/shared/utils/membership-status";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CurrentMembershipView {
  daysRemaining: number;
  duration: MembershipDuration | null;
  expiryDate: string;
  name: string;
  startDate: string;
  termDays: number;
}

export interface PlanView {
  duration: MembershipDuration;
  expiryDate: string;
  id: string;
  price: number;
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS
  );
}

export function toCurrentMembershipView(
  status: MembershipStatus,
  now: Date = new Date()
): CurrentMembershipView | null {
  if (!status.isMember) {
    return null;
  }
  const current = pickCurrentMembership(status.memberships);
  if (!current) {
    return null;
  }
  return {
    daysRemaining: Math.max(0, daysBetween(osloToday(now), current.expiryDate)),
    duration:
      describeMembershipTerm(current.startDate, current.expiryDate)?.duration ??
      null,
    expiryDate: current.expiryDate,
    name: current.name,
    startDate: current.startDate,
    termDays: Math.max(1, daysBetween(current.startDate, current.expiryDate)),
  };
}

export function upgradePlans(
  plans: MembershipPlan[],
  current: CurrentMembershipView | null
): PlanView[] {
  return plans
    .filter((plan) => !current || plan.expiryDate > current.expiryDate)
    .map(({ duration, expiryDate, id, price }) => ({
      duration,
      expiryDate,
      id,
      price,
    }));
}
```

Run the test → PASS.

- [ ] **Step 3: `member/page.tsx` — use the fixed membership check**

Replace the local `MembershipStatus` interface, `verifyMembershipStatus` import, and the `membershipStatus` block with:

```tsx
import { getMembershipStatus } from "@/lib/actions/membership";
import type { MembershipStatus } from "@/lib/actions/membership";
// …
  let membershipStatus: MembershipStatus | null = null;
  if (userData) {
    // …keep the existing hasBIIdentity block…
    if (hasBIIdentity) {
      membershipStatus = await getMembershipStatus();
    }
  }
```

Pass `membership={membershipStatus}` to `MemberPortalContent`. (`MembershipStatus` is already re-exported as a type from `@/lib/actions/membership`.) Leave `verifyMembershipStatus` in `src/app/actions/member-portal.ts` only if something else imports it (`grep -rn verifyMembershipStatus apps/web/src`); otherwise delete it and its `checkMembership` import.

- [ ] **Step 4: `member-portal-content.tsx` — real values**

- Delete the local `MembershipInfo` / `MembershipStatus` interfaces; import `type MembershipStatus` from `@/lib/actions/membership`; change the prop to `membership: MembershipStatus | null`.
- Add imports: `getPurchasableMembershipPlans` from `@repo/shared/utils/membership-catalog`; `toCurrentMembershipView`, `upgradePlans` from `@/lib/member-portal-membership`.
- Add `getPurchasableMembershipPlans().catch(() => [])` to the existing `Promise.all` that loads benefits (4th entry, `plans`).
- Replace the block from `const isMember = membership.active;` through the `startDate`/`daysRemaining` calculation with:

```tsx
  const current = membership ? toCurrentMembershipView(membership) : null;
  const isMember = current !== null;
  const tDuration = await getTranslations("memberPass.duration");
  const membershipType = current?.duration
    ? tDuration(current.duration)
    : (current?.name ?? "");
  const expiryDate = current?.expiryDate ?? "";
  const startDate = current?.startDate ?? "";
  const daysRemaining = current?.daysRemaining ?? 0;
  const termDays = current?.termDays ?? 1;
  const offeredPlans = upgradePlans(plans, current);
```

- Pass to `MemberPortalTabs`: add `termDays={termDays}`, `current={current}`, `plans={offeredPlans}`. Remove `biEmail`/`studentId` only if Task 10 Step 6 leaves them unused by `ProfileTab` (it still uses `biEmail`; keep it). Stop defaulting `studentId` to `"S000000"`: use `profile?.student_id || user?.profile?.student_id || ""`.

- [ ] **Step 5: `member-portal-tabs.tsx` — pass real data through**

- Add props `current: CurrentMembershipView | null`, `plans: PlanView[]`, `termDays: number` (types from `@/lib/member-portal-membership`); remove `studentId` from the props if no remaining child uses it.
- Pass `termDays` to `HomeTab`.
- Replace the `<MembershipTab … />` element with:

```tsx
      <MembershipTab
        current={current}
        hasBIIdentity={hasBIIdentity}
        isMember={isMember}
        plans={plans}
      />
```

- [ ] **Step 6: `home-tab.tsx` — progress from the real term, pass on top**

- Add `termDays: number` to `HomeTabProps` and thread it into `MemberOverview`.
- Replace `Math.min(100, (daysRemaining / 365) * 100)` with `Math.min(100, (daysRemaining / termDays) * 100)`.
- In `HomeTab`, inside the `isMember` branch, render the pass above the overview:

```tsx
      {isMember ? (
        <>
          <div className="mx-auto max-w-md">
            <MemberPass />
          </div>
          <MemberOverview /* existing props */ termDays={termDays} />
        </>
      ) : (
```

  with `import { MemberPass } from "@/components/member-pass/member-pass";`.
- The two `toLocaleDateString("en-US", …)` calls for `startDate`/`expiryDate` now receive `YYYY-MM-DD`; switch them to `useFormatter().dateTime(new Date(\`${date}T12:00:00Z\`), { day: "numeric", month: "short", year: "numeric" })` so they follow the UI locale.

- [ ] **Step 7: Replace `membership-tab.tsx`**

```tsx
"use client";

import {
  membershipPriceFormatter,
  POPULAR_MEMBERSHIP_DURATION,
} from "@repo/shared/utils/membership-plans";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { TabsContent } from "@repo/ui/components/ui/tabs";
import { Check } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { MemberPass } from "@/components/member-pass/member-pass";
import type {
  CurrentMembershipView,
  PlanView,
} from "@/lib/member-portal-membership";
import { LockedContentOverlay } from "../shared/locked-content-overlay";

interface MembershipTabProps {
  current: CurrentMembershipView | null;
  hasBIIdentity: boolean;
  isMember: boolean;
  plans: PlanView[];
}

function useDate() {
  const format = useFormatter();
  return (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
}

function Stat({ label, value, hint }: { hint?: string; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-section p-6 dark:bg-inverted">
      <div className="mb-1 text-muted-foreground text-sm">{label}</div>
      <div className="font-semibold text-foreground text-lg">{value}</div>
      {hint ? <div className="text-muted-foreground text-sm">{hint}</div> : null}
    </div>
  );
}

export function MembershipTab({
  current,
  hasBIIdentity,
  isMember,
  plans,
}: MembershipTabProps) {
  const t = useTranslations("memberPortal.membership");
  const tPass = useTranslations("memberPass");
  const formatDate = useDate();

  const content = (
    <Card className="border-0 p-8 shadow-lg dark:bg-inverted/50 dark:backdrop-blur-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="mb-2 font-bold text-foreground text-xl">{t("title")}</h3>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        {current ? (
          <Badge className="border-green-200 bg-green-100 px-4 py-2 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
            <Check className="mr-2 h-4 w-4" />
            {t("active")}
          </Badge>
        ) : null}
      </div>

      {current ? (
        <div className="mb-8 grid gap-6 md:grid-cols-3">
          <Stat
            label={t("currentPlan")}
            value={
              current.duration
                ? tPass(`duration.${current.duration}`)
                : current.name
            }
          />
          <Stat label={t("startDate")} value={formatDate(current.startDate)} />
          <Stat
            hint={t("daysRemaining", { days: current.daysRemaining })}
            label={t("validUntil")}
            value={formatDate(current.expiryDate)}
          />
        </div>
      ) : null}

      <h3 className="mb-4 font-semibold text-foreground text-lg">{t("yourPass")}</h3>
      <div className="mx-auto max-w-md">
        <MemberPass />
      </div>

      <Separator className="my-8" />

      <h3 className="mb-2 font-semibold text-foreground text-lg">{t("extendTitle")}</h3>
      <p className="mb-6 text-muted-foreground">{t("extendDescription")}</p>
      {plans.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noUpgrades")}</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-3">
          {plans.map((plan) => (
            <Card className="flex flex-col items-center gap-2 border-2 p-6 text-center" key={plan.id}>
              {plan.duration === POPULAR_MEMBERSHIP_DURATION ? (
                <Badge className="bg-brand text-white">{t("popular")}</Badge>
              ) : null}
              <h4 className="font-semibold text-foreground text-lg">
                {tPass(`duration.${plan.duration}`)}
              </h4>
              <p className="font-bold text-2xl text-foreground">
                {membershipPriceFormatter.format(plan.price)}
              </p>
              <p className="text-muted-foreground text-sm">
                {t("validUntilDate", { date: formatDate(plan.expiryDate) })}
              </p>
              <Button asChild className="mt-2 w-full">
                <Link href="/membership/join">{t("choosePlan")}</Link>
              </Button>
            </Card>
          ))}
        </div>
      )}
    </Card>
  );

  return (
    <TabsContent className="space-y-8" value="membership">
      {isMember ? (
        content
      ) : (
        <LockedContentOverlay hasBIIdentity={hasBIIdentity}>{content}</LockedContentOverlay>
      )}
    </TabsContent>
  );
}
```

Then `git rm apps/web/src/components/member-portal/shared/membership-card.tsx` after confirming `grep -rn "membership-card\"" apps/web/src` returns only the removed import.

- [ ] **Step 8: Update the `memberPortal.membership` translations**

In both `en/memberPortal.json` and `no/memberPortal.json`, set the `membership` object to exactly these keys (keep `title`, `description`, `active`, `currentPlan`, `validUntil` values as they are; add the rest):

en:
```json
"startDate": "Started",
"daysRemaining": "{days, plural, one {# day left} other {# days left}}",
"yourPass": "Your membership pass",
"extendTitle": "Extend your membership",
"extendDescription": "Buy a longer plan before this one runs out.",
"noUpgrades": "You already hold the longest plan on sale.",
"popular": "Popular",
"validUntilDate": "Valid until {date}",
"choosePlan": "Choose plan"
```

no:
```json
"startDate": "Startet",
"daysRemaining": "{days, plural, one {# dag igjen} other {# dager igjen}}",
"yourPass": "Medlemskortet ditt",
"extendTitle": "Forleng medlemskapet",
"extendDescription": "Kjøp en lengre plan før denne går ut.",
"noUpgrades": "Du har allerede den lengste planen som selges.",
"popular": "Populær",
"validUntilDate": "Gyldig til {date}",
"choosePlan": "Velg plan"
```

Remove from both files: `nextBillingDate`, `autoRenewal`, `enabled`, `disabled`, `enable`, `disable`, `upgradeMembership`, `upgradeDescription`, `currentPlanBadge`, `monthlyPrice`, `savePercent`, `proTip`, `proTipDescription`, `digitalCard`, `bisoMember`, `studentId`, `useCard`, `addToAppleWallet`, `addToGooglePay`, `shareCard` — but first run `grep -rn "memberPortal.membership" apps/web/src` and keep any key still referenced elsewhere.

- [ ] **Step 9: Verify**

```bash
bun run check-types --filter=web --filter=@repo/i18n
cd apps/web && bun x vitest run && bun run lint
```

Browser: `/member` as the linked account with the fall 2026 category → home tab shows the pass and "Semester"; membership tab shows Semester, started 1 July 2026, valid until 31 December 2026, and offers only the 1-year and 3-year plans at 550 kr and 1 350 kr.

- [ ] **Step 10: Commit**

```bash
bun x ultracite fix apps/web/src packages/i18n/messages
git add -A apps/web/src packages/i18n/messages
git commit -m "Show real membership data and the pass in the member portal

The portal always said \"Year\" and invented prices, start dates and an
auto-renew toggle. It now reads the live Finago result and the plan table.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
## Phase 3 — Admin scanner

Admin tests run with `bun test` (`bun:test`). Do not import `server-only` in `apps/admin/src/lib/member-pass/*` (it throws under `bun test`); these modules are only imported by server actions and server components.

### Task 11: Scan types and the scan/link store

**Files:**
- Create: `apps/admin/src/lib/member-pass/types.ts`
- Create: `apps/admin/src/lib/member-pass/store.ts`
- Test: `apps/admin/src/lib/member-pass/store.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // types.ts
  export type ScanResult = "valid" | "duplicate" | "check_id" | "denied" | "unavailable";
  export type ScanDenialReason = "bad_code" | "stale" | "expired" | "not_member" | "not_linked";
  export type Scanner = { kind: "staff"; userId: string } | { kind: "guest"; linkId: string };
  export interface ScanOutcome { expiryDate?: string; membershipName?: string; name?: string; reason?: ScanDenialReason; result: ScanResult; secondsSincePrevious?: number }
  export interface MemberPassScanRow { $createdAt: string; $id: string; code_kind: MemberPassCodeKind | null; member_user_id: string; reason: string | null; result: ScanResult; scanner_link_id: string | null; scanner_user_id: string | null }
  export interface ScannerLinkRow { $createdAt: string; $id: string; campus_id: string | null; created_by: string; expires_at: string; label: string; revoked_at: string | null; token_hash: string }
  export const COUNTED_SCAN_RESULTS: ScanResult[] = ["valid", "duplicate", "check_id"];
  // store.ts
  export type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];
  export const MEMBER_PASS_DB = "app"; export const SCANS_TABLE = "member_pass_scans"; export const LINKS_TABLE = "member_pass_scanner_links";
  export function findLatestCountedScan(db: AdminDb, memberUserId: string, since: Date): Promise<MemberPassScanRow | null>
  export function recordScan(db: AdminDb, scan: { codeKind: MemberPassCodeKind | null; memberUserId: string; reason: string | null; result: ScanResult; scanner: Scanner }): Promise<void>
  export function findLinkByTokenHash(db: AdminDb, tokenHash: string): Promise<ScannerLinkRow | null>
  export function createLinkRow(db: AdminDb, link: { campusId: string | null; createdBy: string; expiresAt: Date; label: string; tokenHash: string }): Promise<ScannerLinkRow>
  export function revokeLinkRow(db: AdminDb, linkId: string, now: Date): Promise<void>
  export function listLiveLinks(db: AdminDb, now: Date, campusIds: string[] | null): Promise<ScannerLinkRow[]>
  export function getLinkRow(db: AdminDb, linkId: string): Promise<ScannerLinkRow | null>
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";

const db = {
  createRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
};

const {
  createLinkRow,
  findLatestCountedScan,
  findLinkByTokenHash,
  listLiveLinks,
  recordScan,
  revokeLinkRow,
} = await import("./store");

// biome-ignore lint/suspicious/noExplicitAny: test double for the proxied TablesDB
const adminDb = db as any;

describe("member pass store", () => {
  beforeEach(() => {
    for (const fn of Object.values(db)) {
      fn.mockReset();
    }
  });

  test("finds the latest counted scan since a time", async () => {
    db.listRows.mockResolvedValue({ rows: [{ $id: "s1" }], total: 1 });
    const since = new Date("2026-09-17T09:50:00Z");
    expect(await findLatestCountedScan(adminDb, "u1", since)).toEqual({ $id: "s1" });
    expect(db.listRows).toHaveBeenCalledWith("app", "member_pass_scans", [
      Query.equal("member_user_id", "u1"),
      Query.equal("result", ["valid", "duplicate", "check_id"]),
      Query.greaterThan("$createdAt", since.toISOString()),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ]);
  });

  test("records a guest scan without a staff user", async () => {
    db.createRow.mockResolvedValue({});
    await recordScan(adminDb, {
      codeKind: "web",
      memberUserId: "u1",
      reason: null,
      result: "valid",
      scanner: { kind: "guest", linkId: "l1" },
    });
    const [, table, , data, permissions] = db.createRow.mock.calls[0] ?? [];
    expect(table).toBe("member_pass_scans");
    expect(data).toEqual({
      code_kind: "web",
      member_user_id: "u1",
      reason: null,
      result: "valid",
      scanner_link_id: "l1",
      scanner_user_id: null,
    });
    expect(permissions).toEqual([]);
  });

  test("looks a link up by token hash", async () => {
    db.listRows.mockResolvedValue({ rows: [], total: 0 });
    expect(await findLinkByTokenHash(adminDb, "abc")).toBeNull();
    expect(db.listRows).toHaveBeenCalledWith("app", "member_pass_scanner_links", [
      Query.equal("token_hash", "abc"),
      Query.limit(1),
    ]);
  });

  test("creates, revokes and lists links", async () => {
    db.createRow.mockResolvedValue({ $id: "l1" });
    const expiresAt = new Date("2026-09-17T22:00:00Z");
    await createLinkRow(adminDb, {
      campusId: "1",
      createdBy: "staff-1",
      expiresAt,
      label: "Fadderuke",
      tokenHash: "h",
    });
    expect(db.createRow.mock.calls[0]?.[3]).toEqual({
      campus_id: "1",
      created_by: "staff-1",
      expires_at: expiresAt.toISOString(),
      label: "Fadderuke",
      revoked_at: null,
      token_hash: "h",
    });

    const now = new Date("2026-09-17T12:00:00Z");
    await revokeLinkRow(adminDb, "l1", now);
    expect(db.updateRow).toHaveBeenCalledWith("app", "member_pass_scanner_links", "l1", {
      revoked_at: now.toISOString(),
    });

    db.listRows.mockResolvedValue({ rows: [], total: 0 });
    await listLiveLinks(adminDb, now, ["1", "2"]);
    expect(db.listRows).toHaveBeenLastCalledWith("app", "member_pass_scanner_links", [
      Query.greaterThan("expires_at", now.toISOString()),
      Query.isNull("revoked_at"),
      Query.orderAsc("expires_at"),
      Query.limit(100),
      Query.equal("campus_id", ["1", "2"]),
    ]);
  });
});
```

Run (from `apps/admin`): `bun test src/lib/member-pass/store.test.ts` → FAIL (module not found).

- [ ] **Step 2: Implement `types.ts`**

```ts
import type { MemberPassCodeKind } from "@repo/shared/utils/member-pass";

export type ScanResult =
  | "valid"
  | "duplicate"
  | "check_id"
  | "denied"
  | "unavailable";

export type ScanDenialReason =
  | "bad_code"
  | "stale"
  | "expired"
  | "not_member"
  | "not_linked";

export type Scanner =
  | { kind: "staff"; userId: string }
  | { kind: "guest"; linkId: string };

/** What a scanner screen shows. Never carries student number or email. */
export interface ScanOutcome {
  expiryDate?: string;
  membershipName?: string;
  name?: string;
  reason?: ScanDenialReason;
  result: ScanResult;
  secondsSincePrevious?: number;
}

// Local row types until packages/api/types/appwrite.ts is regenerated with
// the member pass tables.
export interface MemberPassScanRow {
  $createdAt: string;
  $id: string;
  code_kind: MemberPassCodeKind | null;
  member_user_id: string;
  reason: string | null;
  result: ScanResult;
  scanner_link_id: string | null;
  scanner_user_id: string | null;
}

export interface ScannerLinkRow {
  $createdAt: string;
  $id: string;
  campus_id: string | null;
  created_by: string;
  expires_at: string;
  label: string;
  revoked_at: string | null;
  token_hash: string;
}

/** Results that mean "this pass was presented and let through". */
export const COUNTED_SCAN_RESULTS: ScanResult[] = [
  "valid",
  "duplicate",
  "check_id",
];
```

- [ ] **Step 3: Implement `store.ts`**

```ts
import { ID, Query } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import type { MemberPassCodeKind } from "@repo/shared/utils/member-pass";
import {
  COUNTED_SCAN_RESULTS,
  type MemberPassScanRow,
  type ScannerLinkRow,
  type Scanner,
  type ScanResult,
} from "./types";

export type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

export const MEMBER_PASS_DB = "app";
export const SCANS_TABLE = "member_pass_scans";
export const LINKS_TABLE = "member_pass_scanner_links";
const MAX_LINKS_LISTED = 100;

// No row permissions: both tables are read and written with the service key only.
const NO_PERMISSIONS: string[] = [];

export async function findLatestCountedScan(
  db: AdminDb,
  memberUserId: string,
  since: Date
): Promise<MemberPassScanRow | null> {
  const { rows } = await db.listRows<MemberPassScanRow>(MEMBER_PASS_DB, SCANS_TABLE, [
    Query.equal("member_user_id", memberUserId),
    Query.equal("result", COUNTED_SCAN_RESULTS),
    Query.greaterThan("$createdAt", since.toISOString()),
    Query.orderDesc("$createdAt"),
    Query.limit(1),
  ]);
  return rows[0] ?? null;
}

export async function recordScan(
  db: AdminDb,
  scan: {
    codeKind: MemberPassCodeKind | null;
    memberUserId: string;
    reason: string | null;
    result: ScanResult;
    scanner: Scanner;
  }
): Promise<void> {
  await db.createRow(
    MEMBER_PASS_DB,
    SCANS_TABLE,
    ID.unique(),
    {
      code_kind: scan.codeKind,
      member_user_id: scan.memberUserId,
      reason: scan.reason,
      result: scan.result,
      scanner_link_id: scan.scanner.kind === "guest" ? scan.scanner.linkId : null,
      scanner_user_id: scan.scanner.kind === "staff" ? scan.scanner.userId : null,
    },
    NO_PERMISSIONS
  );
}

export async function findLinkByTokenHash(
  db: AdminDb,
  tokenHash: string
): Promise<ScannerLinkRow | null> {
  const { rows } = await db.listRows<ScannerLinkRow>(MEMBER_PASS_DB, LINKS_TABLE, [
    Query.equal("token_hash", tokenHash),
    Query.limit(1),
  ]);
  return rows[0] ?? null;
}

export async function getLinkRow(
  db: AdminDb,
  linkId: string
): Promise<ScannerLinkRow | null> {
  return (await db
    .getRow<ScannerLinkRow>(MEMBER_PASS_DB, LINKS_TABLE, linkId)
    .catch(() => null)) as ScannerLinkRow | null;
}

export async function createLinkRow(
  db: AdminDb,
  link: {
    campusId: string | null;
    createdBy: string;
    expiresAt: Date;
    label: string;
    tokenHash: string;
  }
): Promise<ScannerLinkRow> {
  return (await db.createRow(
    MEMBER_PASS_DB,
    LINKS_TABLE,
    ID.unique(),
    {
      campus_id: link.campusId,
      created_by: link.createdBy,
      expires_at: link.expiresAt.toISOString(),
      label: link.label,
      revoked_at: null,
      token_hash: link.tokenHash,
    },
    NO_PERMISSIONS
  )) as unknown as ScannerLinkRow;
}

export async function revokeLinkRow(
  db: AdminDb,
  linkId: string,
  now: Date
): Promise<void> {
  await db.updateRow(MEMBER_PASS_DB, LINKS_TABLE, linkId, {
    revoked_at: now.toISOString(),
  });
}

/** Unexpired, unrevoked links; `campusIds === null` means every campus. */
export async function listLiveLinks(
  db: AdminDb,
  now: Date,
  campusIds: string[] | null
): Promise<ScannerLinkRow[]> {
  const queries = [
    Query.greaterThan("expires_at", now.toISOString()),
    Query.isNull("revoked_at"),
    Query.orderAsc("expires_at"),
    Query.limit(MAX_LINKS_LISTED),
  ];
  if (campusIds) {
    queries.push(Query.equal("campus_id", campusIds));
  }
  const { rows } = await db.listRows<ScannerLinkRow>(MEMBER_PASS_DB, LINKS_TABLE, queries);
  return rows;
}
```

If the TablesDB typings reject the untyped row shape on `createRow`/`updateRow`/`getRow` generics (the local types are not `Models.Row`), follow the existing workaround in `apps/web/src/lib/actions/bi-identity.ts`: omit the generic on `createRow` and cast the result.

- [ ] **Step 4: Run to verify it passes**

Run (from `apps/admin`): `bun test src/lib/member-pass/store.test.ts` → PASS.

- [ ] **Step 5: Type-check, format, commit**

```bash
bun run check-types --filter=admin
bun x ultracite fix apps/admin/src/lib/member-pass
git add apps/admin/src/lib/member-pass
git commit -m "Add the member pass scan and scanner link store

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

### Task 12: Guest link tokens and scan rate limiting

**Files:**
- Create: `apps/admin/src/lib/member-pass/guest-links.ts`
- Create: `apps/admin/src/lib/member-pass/rate-limit.ts`
- Test: `apps/admin/src/lib/member-pass/guest-links.test.ts`, `rate-limit.test.ts`

**Interfaces:**
- Produces:
  - `GUEST_LINK_DEFAULT_HOURS = 6`, `GUEST_LINK_MAX_HOURS = 48`
  - `generateGuestToken(): string` (43-char base64url, 32 random bytes)
  - `hashGuestToken(token: string): string` (64-char hex SHA-256)
  - `isLinkUsable(link: Pick<ScannerLinkRow, "expires_at" | "revoked_at"> | null, now: Date): boolean`
  - `resolveLinkExpiry(requested: Date | null, now: Date): Date | null` (null default → now + 6 h; ≤ now → null; > 48 h → capped at now + 48 h)
  - `createRateLimiter(options: { limit: number; windowMs: number }): (key: string, nowMs?: number) => boolean` (true = allowed)

- [ ] **Step 1: Write the failing tests**

`guest-links.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  generateGuestToken,
  hashGuestToken,
  isLinkUsable,
  resolveLinkExpiry,
} from "./guest-links";

const NOW = new Date("2026-09-17T12:00:00Z");
const HOUR = 60 * 60 * 1000;

describe("guest link tokens", () => {
  test("are long, url-safe and unique", () => {
    const a = generateGuestToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateGuestToken()).not.toBe(a);
  });

  test("hash to stable hex", () => {
    expect(hashGuestToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});

describe("isLinkUsable", () => {
  test("requires an unexpired, unrevoked link", () => {
    const future = new Date(NOW.getTime() + HOUR).toISOString();
    const past = new Date(NOW.getTime() - 1).toISOString();
    expect(isLinkUsable({ expires_at: future, revoked_at: null }, NOW)).toBe(true);
    expect(isLinkUsable({ expires_at: past, revoked_at: null }, NOW)).toBe(false);
    expect(isLinkUsable({ expires_at: future, revoked_at: past }, NOW)).toBe(false);
    expect(isLinkUsable(null, NOW)).toBe(false);
  });
});

describe("resolveLinkExpiry", () => {
  test("defaults to six hours", () => {
    expect(resolveLinkExpiry(null, NOW)?.getTime()).toBe(NOW.getTime() + 6 * HOUR);
  });

  test("rejects the past and caps at 48 hours", () => {
    expect(resolveLinkExpiry(new Date(NOW.getTime() - HOUR), NOW)).toBeNull();
    expect(
      resolveLinkExpiry(new Date(NOW.getTime() + 72 * HOUR), NOW)?.getTime()
    ).toBe(NOW.getTime() + 48 * HOUR);
    expect(
      resolveLinkExpiry(new Date(NOW.getTime() + 3 * HOUR), NOW)?.getTime()
    ).toBe(NOW.getTime() + 3 * HOUR);
  });
});
```

`rate-limit.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  test("allows up to the limit per key within the window", () => {
    const allow = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(allow("a", 0)).toBe(true);
    expect(allow("a", 100)).toBe(true);
    expect(allow("a", 200)).toBe(false);
    expect(allow("b", 200)).toBe(true);
    expect(allow("a", 1101)).toBe(true);
  });
});
```

Run (from `apps/admin`): `bun test src/lib/member-pass` → the two new files FAIL.

- [ ] **Step 2: Implement `guest-links.ts`**

```ts
import { createHash, randomBytes } from "node:crypto";
import type { ScannerLinkRow } from "./types";

export const GUEST_LINK_DEFAULT_HOURS = 6;
export const GUEST_LINK_MAX_HOURS = 48;
const HOUR_MS = 60 * 60 * 1000;
const TOKEN_BYTES = 32;

export function generateGuestToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Only the hash is stored, so a leaked table cannot open a scanner. */
export function hashGuestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isLinkUsable(
  link: Pick<ScannerLinkRow, "expires_at" | "revoked_at"> | null,
  now: Date
): boolean {
  if (!link || link.revoked_at) {
    return false;
  }
  return Date.parse(link.expires_at) > now.getTime();
}

export function resolveLinkExpiry(requested: Date | null, now: Date): Date | null {
  const nowMs = now.getTime();
  if (!requested) {
    return new Date(nowMs + GUEST_LINK_DEFAULT_HOURS * HOUR_MS);
  }
  const requestedMs = requested.getTime();
  if (!Number.isFinite(requestedMs) || requestedMs <= nowMs) {
    return null;
  }
  return new Date(Math.min(requestedMs, nowMs + GUEST_LINK_MAX_HOURS * HOUR_MS));
}
```

- [ ] **Step 3: Implement `rate-limit.ts`**

```ts
/**
 * In-memory sliding-window limiter. Per server instance only — enough to stop
 * a leaked guest link being used to hammer Finago, not a global quota.
 */
export function createRateLimiter({
  limit,
  windowMs,
}: {
  limit: number;
  windowMs: number;
}): (key: string, nowMs?: number) => boolean {
  const hits = new Map<string, number[]>();
  return (key, nowMs = Date.now()) => {
    const recent = (hits.get(key) ?? []).filter((at) => nowMs - at < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(nowMs);
    hits.set(key, recent);
    return true;
  };
}
```

- [ ] **Step 4: Run to verify they pass**

Run (from `apps/admin`): `bun test src/lib/member-pass` → PASS.

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix apps/admin/src/lib/member-pass
git add apps/admin/src/lib/member-pass
git commit -m "Add guest scanner link tokens and a scan rate limiter

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

### Task 13: `verifyScan`

**Files:**
- Create: `apps/admin/src/lib/member-pass/membership-lookup.ts`
- Create: `apps/admin/src/lib/member-pass/verify-scan.ts`
- Test: `apps/admin/src/lib/member-pass/verify-scan.test.ts`

**Interfaces:**
- Consumes: Task 4 (`verifyMemberPassCode`, `isRecentDuplicate`, `DUPLICATE_SCAN_WINDOW_MS`), Task 11 store, `computeMembershipStatus`, `MembershipComputationError`, `pickCurrentMembership`, `sanitizeStudentNumber`.
- Produces:
  - `getScanMembershipStatus(studentNumber: number): Promise<MembershipStatus>` (60 s `unstable_cache`, throws `MembershipComputationError` on transient failure)
  - `interface ScanLog { latestSince: (memberUserId: string, since: Date) => Promise<{ $createdAt: string } | null>; record: (entry: RecordScanInput) => Promise<void> }` where `RecordScanInput` is the second parameter of `recordScan`
  - `scanLogFor(db: AdminDb): ScanLog`
  - `interface VerifyScanDeps { db: AdminDb; getStatus: (studentNumber: number) => Promise<MembershipStatus>; now: Date; scans: ScanLog; secret: string }`
  - `verifyScan(code: string, scanner: Scanner, deps: VerifyScanDeps): Promise<ScanOutcome>`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { signAppleWalletCode, signWebPassCode } from "@repo/shared/utils/member-pass";
import { passSlot } from "@repo/shared/utils/member-pass-slots";
import { MembershipComputationError } from "@repo/shared/utils/membership-status";

// Injected rather than `mock.module("./store")`: bun module mocks leak into
// other test files in the same run (store.test.ts imports the real module).
import { verifyScan } from "./verify-scan";

const findLatestCountedScan = mock();
const recordScan = mock();
const scans = { latestSince: findLatestCountedScan, record: recordScan };

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const NOW = new Date("2026-09-17T10:00:00Z");
const USER = "member-1";
const STAFF = { kind: "staff", userId: "staff-1" } as const;
const getRow = mock();
// biome-ignore lint/suspicious/noExplicitAny: test double
const db = { getRow } as any;
const getStatus = mock();
const deps = { db, getStatus, now: NOW, scans, secret: SECRET };
const code = () => signWebPassCode(USER, passSlot(NOW.getTime()), SECRET);

const ACTIVE = {
  checkedAt: 0,
  finagoCategoryIds: [113_176],
  isMember: true,
  memberships: [
    { category: "113176", expiryDate: "2026-12-31", id: "54", name: "Semester", startDate: "2026-07-01" },
  ],
};

describe("verifyScan", () => {
  beforeEach(() => {
    for (const fn of [findLatestCountedScan, recordScan, getRow, getStatus]) {
      fn.mockReset();
    }
    getRow.mockResolvedValue({ $id: USER, name: "Markus Heien", student_id: "s1715738" });
    getStatus.mockResolvedValue(ACTIVE);
    findLatestCountedScan.mockResolvedValue(null);
    recordScan.mockResolvedValue(undefined);
  });

  test("lets a live member through", async () => {
    const outcome = await verifyScan(code(), STAFF, deps);
    expect(outcome).toEqual({
      expiryDate: "2026-12-31",
      membershipName: "Semester",
      name: "Markus Heien",
      result: "valid",
    });
    expect(getStatus).toHaveBeenCalledWith(1_715_738);
    expect(recordScan.mock.calls[0]?.[0]).toMatchObject({
      codeKind: "web",
      memberUserId: USER,
      result: "valid",
      scanner: STAFF,
    });
    expect(JSON.stringify(outcome)).not.toContain("1715738");
  });

  test("denies a forged code without touching Finago or the log", async () => {
    const outcome = await verifyScan("v1.member-1.1.AAAAAAAAAAAAAAAAAAAAAA", STAFF, deps);
    expect(outcome).toEqual({ reason: "bad_code", result: "denied" });
    expect(getStatus).not.toHaveBeenCalled();
    expect(recordScan).not.toHaveBeenCalled();
  });

  test("denies a stale code", async () => {
    const old = signWebPassCode(USER, passSlot(NOW.getTime()) - 5, SECRET);
    expect(await verifyScan(old, STAFF, deps)).toEqual({ reason: "stale", result: "denied" });
  });

  test("denies an account with no linked student", async () => {
    getRow.mockResolvedValue({ $id: USER, name: "X", student_id: null });
    expect(await verifyScan(code(), STAFF, deps)).toMatchObject({
      reason: "not_linked",
      result: "denied",
    });
    expect(recordScan.mock.calls[0]?.[0]).toMatchObject({ reason: "not_linked", result: "denied" });
  });

  test("denies a lapsed member with the right reason", async () => {
    getStatus.mockResolvedValue({ ...ACTIVE, isMember: false, memberships: [], reason: "expired" });
    expect(await verifyScan(code(), STAFF, deps)).toMatchObject({ reason: "expired", result: "denied", name: "Markus Heien" });
    getStatus.mockResolvedValue({ ...ACTIVE, isMember: false, memberships: [], reason: "no_categories" });
    expect(await verifyScan(code(), STAFF, deps)).toMatchObject({ reason: "not_member", result: "denied" });
  });

  test("reports unavailable when Finago fails", async () => {
    getStatus.mockRejectedValue(new MembershipComputationError("finago_error"));
    expect(await verifyScan(code(), STAFF, deps)).toEqual({ result: "unavailable" });
  });

  test("flags a second scan within ten minutes", async () => {
    findLatestCountedScan.mockResolvedValue({
      $createdAt: new Date(NOW.getTime() - 40_000).toISOString(),
    });
    expect(await verifyScan(code(), STAFF, deps)).toMatchObject({
      result: "duplicate",
      secondsSincePrevious: 40,
    });
    const [, since] = findLatestCountedScan.mock.calls[0] ?? [];
    expect(since).toEqual(new Date(NOW.getTime() - 10 * 60 * 1000));
  });

  test("asks for ID on an Apple Wallet code, but duplicate wins", async () => {
    const apple = signAppleWalletCode(USER, "2026-12-31", SECRET);
    expect(await verifyScan(apple, STAFF, deps)).toMatchObject({ result: "check_id" });
    findLatestCountedScan.mockResolvedValue({
      $createdAt: new Date(NOW.getTime() - 5000).toISOString(),
    });
    expect(await verifyScan(apple, STAFF, deps)).toMatchObject({ result: "duplicate" });
  });

  test("still answers when the scan log cannot be written", async () => {
    recordScan.mockRejectedValue(new Error("down"));
    findLatestCountedScan.mockRejectedValue(new Error("down"));
    expect(await verifyScan(code(), STAFF, deps)).toMatchObject({ result: "valid" });
  });
});
```

Run (from `apps/admin`): `bun test src/lib/member-pass/verify-scan.test.ts` → FAIL.

- [ ] **Step 2: Implement `membership-lookup.ts`**

```ts
import {
  computeMembershipStatus,
  type MembershipStatus,
  membershipCacheTag,
} from "@repo/shared/utils/membership-status";
import { unstable_cache } from "next/cache";

// Short: a door queue re-checks the same member rarely, and a cancelled
// membership must stop working quickly.
const SCAN_STATUS_TTL_SECONDS = 60;

/**
 * Live Finago membership for a scan. Transient failures throw
 * `MembershipComputationError`, which `unstable_cache` does not store.
 */
export function getScanMembershipStatus(
  studentNumber: number
): Promise<MembershipStatus> {
  const tag = membershipCacheTag(studentNumber);
  return unstable_cache(
    () => computeMembershipStatus(studentNumber),
    ["member-pass-scan", tag],
    { revalidate: SCAN_STATUS_TTL_SECONDS, tags: [tag] }
  )();
}
```

- [ ] **Step 3: Implement `verify-scan.ts`**

```ts
import type { Users } from "@repo/api/types/appwrite";
import { sanitizeStudentNumber } from "@repo/shared/utils/bi-student";
import {
  DUPLICATE_SCAN_WINDOW_MS,
  type MemberPassCodeKind,
  verifyMemberPassCode,
} from "@repo/shared/utils/member-pass";
import {
  type MembershipStatus,
  pickCurrentMembership,
} from "@repo/shared/utils/membership-status";
import { type AdminDb, findLatestCountedScan, recordScan } from "./store";

type RecordScanInput = Parameters<typeof recordScan>[1];

export interface ScanLog {
  latestSince: (
    memberUserId: string,
    since: Date
  ) => Promise<{ $createdAt: string } | null>;
  record: (entry: RecordScanInput) => Promise<void>;
}

export function scanLogFor(db: AdminDb): ScanLog {
  return {
    latestSince: (memberUserId, since) =>
      findLatestCountedScan(db, memberUserId, since),
    record: (entry) => recordScan(db, entry),
  };
}
import type {
  ScanDenialReason,
  Scanner,
  ScanOutcome,
  ScanResult,
} from "./types";

export interface VerifyScanDeps {
  db: AdminDb;
  getStatus: (studentNumber: number) => Promise<MembershipStatus>;
  now: Date;
  scans: ScanLog;
  secret: string;
}

const CODE_REASONS: Record<string, ScanDenialReason> = {
  bad_signature: "bad_code",
  expired: "expired",
  malformed: "bad_code",
  stale: "stale",
};

async function log(
  deps: VerifyScanDeps,
  entry: {
    codeKind: MemberPassCodeKind;
    memberUserId: string;
    reason: ScanDenialReason | null;
    result: ScanResult;
    scanner: Scanner;
  }
) {
  try {
    await deps.scans.record(entry);
  } catch (error) {
    console.error("[Member Pass] Could not record scan:", error);
  }
}

async function previousScanAt(deps: VerifyScanDeps, userId: string): Promise<Date | null> {
  try {
    const since = new Date(deps.now.getTime() - DUPLICATE_SCAN_WINDOW_MS);
    const latest = await deps.scans.latestSince(userId, since);
    return latest ? new Date(latest.$createdAt) : null;
  } catch (error) {
    console.error("[Member Pass] Duplicate check failed:", error);
    return null;
  }
}

/**
 * Checks a scanned code end to end: signature and time, the member's linked
 * student number, a live Finago lookup, and the recent-scan log.
 */
export async function verifyScan(
  code: string,
  scanner: Scanner,
  deps: VerifyScanDeps
): Promise<ScanOutcome> {
  const parsed = verifyMemberPassCode(code, deps.secret, deps.now);
  if (!parsed.ok) {
    return { reason: CODE_REASONS[parsed.reason] ?? "bad_code", result: "denied" };
  }
  const { kind, userId } = parsed;

  const profile = (await deps.db
    .getRow<Users>("app", "user", userId)
    .catch(() => null)) as Users | null;
  const studentNumber = sanitizeStudentNumber(profile?.student_id);
  const name = profile?.name?.trim() || undefined;
  if (studentNumber === null) {
    await log(deps, { codeKind: kind, memberUserId: userId, reason: "not_linked", result: "denied", scanner });
    return { name, reason: "not_linked", result: "denied" };
  }

  let status: MembershipStatus;
  try {
    status = await deps.getStatus(studentNumber);
  } catch (error) {
    console.error("[Member Pass] Membership lookup failed:", error);
    await log(deps, { codeKind: kind, memberUserId: userId, reason: null, result: "unavailable", scanner });
    return { result: "unavailable" };
  }

  if (!status.isMember) {
    const reason: ScanDenialReason = status.reason === "expired" ? "expired" : "not_member";
    await log(deps, { codeKind: kind, memberUserId: userId, reason, result: "denied", scanner });
    return { name, reason, result: "denied" };
  }

  const current = pickCurrentMembership(status.memberships);
  const previous = await previousScanAt(deps, userId);
  let result: ScanResult = "valid";
  if (previous) {
    result = "duplicate";
  } else if (kind === "apple") {
    result = "check_id";
  }
  await log(deps, { codeKind: kind, memberUserId: userId, reason: null, result, scanner });

  return {
    expiryDate: current?.expiryDate,
    membershipName: current?.name,
    name,
    result,
    ...(previous
      ? { secondsSincePrevious: Math.round((deps.now.getTime() - previous.getTime()) / 1000) }
      : {}),
  };
}
```

The "valid" test uses `toEqual` with no `secondsSincePrevious` key — the conditional spread keeps it absent. Undefined optional fields (`expiryDate`, etc.) are ignored by `toEqual`.

- [ ] **Step 4: Run to verify it passes**

Run (from `apps/admin`): `bun test src/lib/member-pass` → PASS.

- [ ] **Step 5: Type-check, format, commit**

```bash
bun run check-types --filter=admin
bun x ultracite fix apps/admin/src/lib/member-pass
git add apps/admin/src/lib/member-pass
git commit -m "Verify scanned member passes against Finago

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
### Task 14: Scanner server actions

**Files:**
- Create: `apps/admin/src/app/(portal)/_actions/member-pass.ts`
- Test: `apps/admin/src/app/(portal)/_actions/member-pass.test.ts`

**Interfaces:**
- Consumes: `requireNavAccess("portal.members")`, `UserAuthContext`, Tasks 11–13.
- Produces (all `"use server"`):
  ```ts
  type ActionResult<T> = { data: T; success: true } | { error: string; success: false };
  export interface ScannerLinkView { campusId: string | null; expiresAt: string; id: string; label: string }
  export async function getScannerDayColor(): Promise<ActionResult<DayColor>>
  export async function scanMemberPass(code: string): Promise<ActionResult<ScanOutcome>>
  export async function listScannerLinks(): Promise<ActionResult<ScannerLinkView[]>>
  export async function createScannerLink(input: { campusId: string | null; expiresAt: string | null; label: string }): Promise<ActionResult<{ link: ScannerLinkView; url: string }>>
  export async function revokeScannerLink(linkId: string): Promise<ActionResult<null>>
  ```
  Errors: `"not_configured"` (no secret), `"invalid_label"`, `"invalid_expiry"`, `"forbidden_campus"`, `"not_found"`, `"failed"`.
  Campus rule: global admins may use any campus or `null`; everyone else must pass a `campusId` in `ctx.managedCampusIds`, and only sees/revokes links for those campuses.

- [ ] **Step 1: Write the failing test**

Only modules no other test imports are mocked here (`@/lib/authorization`, `@repo/api/server`, `next/headers`, `membership-lookup`); the store and `verifyScan` run for real against a fake `db`, because `bun test` module mocks leak into other files in the same run.

```ts
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { signWebPassCode } from "@repo/shared/utils/member-pass";
import { passSlot } from "@repo/shared/utils/member-pass-slots";
import type { UserAuthContext } from "@/lib/authorization";

const SECRET = "test-secret-that-is-at-least-32-characters-long";

const baseCtx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: [],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: "staff@biso.no",
  managedCampuses: ["Oslo"],
  managedCampusIds: ["1"],
  name: "Staff",
  resolvedCampusIds: ["1"],
  resolvedDepartmentIds: [],
  roles: ["campusadmin"],
  userId: "staff-1",
};
let ctx: UserAuthContext = baseCtx;

const db = {
  createRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
};
const getScanMembershipStatus = mock();

mock.module("@/lib/authorization", () => ({
  requireNavAccess: mock(async () => ctx),
}));
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
}));
mock.module("next/headers", () => ({
  headers: mock(
    async () =>
      new Headers({ host: "admin.biso.no", "x-forwarded-proto": "https" })
  ),
}));
mock.module("@/lib/member-pass/membership-lookup", () => ({
  getScanMembershipStatus,
}));

const actions = await import("./member-pass");

describe("member pass actions", () => {
  beforeEach(() => {
    ctx = baseCtx;
    process.env.MEMBER_PASS_SECRET = SECRET;
    for (const fn of [...Object.values(db), getScanMembershipStatus]) {
      fn.mockReset();
    }
    db.createRow.mockImplementation(async (_db, _table, id, data) => ({
      $id: id,
      ...data,
    }));
    db.listRows.mockResolvedValue({ rows: [], total: 0 });
  });

  test("scans as the signed-in staff member", async () => {
    db.getRow.mockResolvedValue({ $id: "m1", name: "M", student_id: "s1" });
    getScanMembershipStatus.mockResolvedValue({
      checkedAt: 0,
      finagoCategoryIds: [1],
      isMember: true,
      memberships: [
        { category: "1", expiryDate: "2099-12-31", id: "54", name: "Semester", startDate: "2099-07-01" },
      ],
    });
    const code = signWebPassCode("m1", passSlot(Date.now()), SECRET);
    const result = await actions.scanMemberPass(` ${code} `);
    expect(result).toEqual({
      data: {
        expiryDate: "2099-12-31",
        membershipName: "Semester",
        name: "M",
        result: "valid",
      },
      success: true,
    });
    expect(db.createRow.mock.calls[0]?.[3]).toMatchObject({
      member_user_id: "m1",
      scanner_user_id: "staff-1",
    });
  });

  test("refuses to scan without a secret", async () => {
    process.env.MEMBER_PASS_SECRET = "";
    expect(await actions.scanMemberPass("code")).toEqual({
      error: "not_configured",
      success: false,
    });
  });

  test("creates a link for a managed campus and returns its url once", async () => {
    const result = await actions.createScannerLink({
      campusId: "1",
      expiresAt: null,
      label: "  Fadderuke  ",
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.url).toMatch(
      /^https:\/\/admin\.biso\.no\/scan\/[A-Za-z0-9_-]{43}$/
    );
    expect(result.data.link).toMatchObject({ campusId: "1", label: "Fadderuke" });
    const stored = db.createRow.mock.calls[0]?.[3];
    expect(stored.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.data.url).not.toContain(stored.token_hash);
  });

  test("blocks campus admins from other campuses and from campus-less links", async () => {
    for (const campusId of ["2", null]) {
      expect(
        await actions.createScannerLink({ campusId, expiresAt: null, label: "X" })
      ).toEqual({ error: "forbidden_campus", success: false });
    }
  });

  test("validates label and expiry", async () => {
    expect(
      await actions.createScannerLink({ campusId: "1", expiresAt: null, label: " " })
    ).toEqual({ error: "invalid_label", success: false });
    expect(
      await actions.createScannerLink({
        campusId: "1",
        expiresAt: "2000-01-01T00:00:00Z",
        label: "X",
      })
    ).toEqual({ error: "invalid_expiry", success: false });
  });

  test("scopes the link list by campus for campus admins only", async () => {
    await actions.listScannerLinks();
    expect(JSON.stringify(db.listRows.mock.calls[0]?.[2])).toContain("campus_id");
    ctx = { ...baseCtx, roles: ["globaladmin"] };
    await actions.listScannerLinks();
    expect(JSON.stringify(db.listRows.mock.calls[1]?.[2])).not.toContain("campus_id");
  });

  test("revokes only links the caller may manage", async () => {
    db.getRow.mockResolvedValue({ $id: "l1", campus_id: "2" });
    expect(await actions.revokeScannerLink("l1")).toEqual({
      error: "forbidden_campus",
      success: false,
    });
    db.getRow.mockResolvedValue({ $id: "l1", campus_id: "1" });
    expect(await actions.revokeScannerLink("l1")).toEqual({ data: null, success: true });
    expect(db.updateRow).toHaveBeenCalledTimes(1);
    db.getRow.mockRejectedValue(new Error("not found"));
    expect(await actions.revokeScannerLink("nope")).toEqual({
      error: "not_found",
      success: false,
    });
  });
});
```

Run (from `apps/admin`): `bun test "src/app/(portal)/_actions/member-pass.test.ts"` → FAIL.

- [ ] **Step 2: Implement `member-pass.ts`**

```ts
"use server";

import { createAdminClient } from "@repo/api/server";
import {
  type DayColor,
  dayColor,
  readMemberPassSecret,
} from "@repo/shared/utils/member-pass";
import { headers } from "next/headers";
import { requireNavAccess, type UserAuthContext } from "@/lib/authorization";
import {
  generateGuestToken,
  hashGuestToken,
  resolveLinkExpiry,
} from "@/lib/member-pass/guest-links";
import { getScanMembershipStatus } from "@/lib/member-pass/membership-lookup";
import {
  createLinkRow,
  getLinkRow,
  listLiveLinks,
  revokeLinkRow,
} from "@/lib/member-pass/store";
import type { ScannerLinkRow, ScanOutcome } from "@/lib/member-pass/types";
import { scanLogFor, verifyScan } from "@/lib/member-pass/verify-scan";
import { ROLES } from "@/lib/roles";

type ActionResult<T> =
  | { data: T; success: true }
  | { error: string; success: false };

export interface ScannerLinkView {
  campusId: string | null;
  expiresAt: string;
  id: string;
  label: string;
}

const NAV_KEY = "portal.members";
const MAX_LABEL_LENGTH = 120;

const fail = (error: string) => ({ error, success: false }) as const;

function isGlobalAdmin(ctx: UserAuthContext): boolean {
  return ctx.roles.includes(ROLES.GLOBAL_ADMIN);
}

function mayManageCampus(ctx: UserAuthContext, campusId: string | null): boolean {
  if (isGlobalAdmin(ctx)) {
    return true;
  }
  return campusId !== null && ctx.managedCampusIds.includes(campusId);
}

function toView(row: ScannerLinkRow): ScannerLinkView {
  return {
    campusId: row.campus_id,
    expiresAt: row.expires_at,
    id: row.$id,
    label: row.label,
  };
}

async function originFromRequest(): Promise<string> {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "admin.biso.no";
  const proto = list.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function getScannerDayColor(): Promise<ActionResult<DayColor>> {
  await requireNavAccess(NAV_KEY);
  const secret = readMemberPassSecret();
  if (!secret) {
    return fail("not_configured");
  }
  return { data: dayColor(new Date(), secret), success: true };
}

export async function scanMemberPass(
  code: string
): Promise<ActionResult<ScanOutcome>> {
  const ctx = await requireNavAccess(NAV_KEY);
  const secret = readMemberPassSecret();
  if (!secret) {
    return fail("not_configured");
  }
  try {
    const { db } = await createAdminClient();
    const outcome = await verifyScan(
      code.trim(),
      { kind: "staff", userId: ctx.userId },
      {
        db,
        getStatus: getScanMembershipStatus,
        now: new Date(),
        scans: scanLogFor(db),
        secret,
      }
    );
    return { data: outcome, success: true };
  } catch (error) {
    console.error("[Member Pass] Staff scan failed:", error);
    return fail("failed");
  }
}

export async function listScannerLinks(): Promise<ActionResult<ScannerLinkView[]>> {
  const ctx = await requireNavAccess(NAV_KEY);
  try {
    const { db } = await createAdminClient();
    const rows = await listLiveLinks(
      db,
      new Date(),
      isGlobalAdmin(ctx) ? null : ctx.managedCampusIds
    );
    return { data: rows.map(toView), success: true };
  } catch (error) {
    console.error("[Member Pass] Listing scanner links failed:", error);
    return fail("failed");
  }
}

export async function createScannerLink(input: {
  campusId: string | null;
  expiresAt: string | null;
  label: string;
}): Promise<ActionResult<{ link: ScannerLinkView; url: string }>> {
  const ctx = await requireNavAccess(NAV_KEY);
  const label = input.label.trim();
  if (!label || label.length > MAX_LABEL_LENGTH) {
    return fail("invalid_label");
  }
  if (!mayManageCampus(ctx, input.campusId)) {
    return fail("forbidden_campus");
  }
  const now = new Date();
  const expiresAt = resolveLinkExpiry(
    input.expiresAt ? new Date(input.expiresAt) : null,
    now
  );
  if (!expiresAt) {
    return fail("invalid_expiry");
  }

  try {
    const token = generateGuestToken();
    const { db } = await createAdminClient();
    const row = await createLinkRow(db, {
      campusId: input.campusId,
      createdBy: ctx.userId,
      expiresAt,
      label,
      tokenHash: hashGuestToken(token),
    });
    return {
      data: {
        link: toView(row),
        url: `${await originFromRequest()}/scan/${token}`,
      },
      success: true,
    };
  } catch (error) {
    console.error("[Member Pass] Creating a scanner link failed:", error);
    return fail("failed");
  }
}

export async function revokeScannerLink(
  linkId: string
): Promise<ActionResult<null>> {
  const ctx = await requireNavAccess(NAV_KEY);
  try {
    const { db } = await createAdminClient();
    const link = await getLinkRow(db, linkId);
    if (!link) {
      return fail("not_found");
    }
    if (!mayManageCampus(ctx, link.campus_id)) {
      return fail("forbidden_campus");
    }
    await revokeLinkRow(db, linkId, new Date());
    return { data: null, success: true };
  } catch (error) {
    console.error("[Member Pass] Revoking a scanner link failed:", error);
    return fail("failed");
  }
}
```

`"use server"` files may only export async functions — the exported `ScannerLinkView` interface is type-only and erased, which Next allows. Keep `fail`/helpers unexported.

- [ ] **Step 3: Run to verify it passes**

Run (from `apps/admin`): `bun test src/lib/member-pass "src/app/(portal)/_actions/member-pass.test.ts"` → all PASS together.

- [ ] **Step 4: Type-check, format, commit**

```bash
bun run check-types --filter=admin
bun x ultracite fix "apps/admin/src/app/(portal)/_actions/member-pass.ts" "apps/admin/src/app/(portal)/_actions/member-pass.test.ts"
git add "apps/admin/src/app/(portal)/_actions/member-pass.ts" "apps/admin/src/app/(portal)/_actions/member-pass.test.ts"
git commit -m "Add member pass scan and scanner link actions

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
### Task 15: Scanner screen and staff pages

**Files:**
- Modify: `apps/admin/package.json` via `bun add qr-scanner --filter=admin`
- Create: `apps/admin/src/components/member-pass-scanner/scan-tone.ts`
- Test: `apps/admin/src/components/member-pass-scanner/scan-tone.test.ts`
- Create: `apps/admin/src/components/member-pass-scanner/scanner-screen.tsx`
- Create: `apps/admin/src/app/(portal)/members/scan/page.tsx`
- Create: `apps/admin/src/app/(portal)/members/scan/links/page.tsx`
- Create: `apps/admin/src/app/(portal)/members/scan/links/_components/scanner-links-client.tsx`
- Modify: `apps/admin/src/app/(portal)/members/page.tsx` (header buttons)
- Modify: `packages/i18n/messages/en/adminPortal.json`, `packages/i18n/messages/no/adminPortal.json` (new `memberPass` section)

**Interfaces:**
- Consumes: Task 14 actions; `ScanOutcome`; `DayColor`.
- Produces:
  - `type ScanTone = "green" | "orange" | "amber" | "red" | "grey"`; `scanTone(outcome: ScanOutcome): ScanTone`; `SCAN_TONE_CLASSES: Record<ScanTone, string>`
  - `<ScannerScreen dayColor: DayColor | null; onScan: (code: string) => Promise<{ data: ScanOutcome; success: true } | { error: string; success: false }>; subtitle?: string; title: string />`
  - Routes: `/members/scan` (staff scanner), `/members/scan/links` (link management)

- [ ] **Step 1: Install**

```bash
bun add qr-scanner --filter=admin
```

- [ ] **Step 2: Write the failing test** (`scan-tone.test.ts`)

```ts
import { describe, expect, test } from "bun:test";
import { scanTone } from "./scan-tone";

describe("scanTone", () => {
  test.each([
    [{ result: "valid" }, "green"],
    [{ result: "duplicate" }, "orange"],
    [{ result: "check_id" }, "amber"],
    [{ reason: "stale", result: "denied" }, "red"],
    [{ result: "unavailable" }, "grey"],
  ] as const)("%o → %s", (outcome, tone) => {
    expect(scanTone(outcome)).toBe(tone);
  });
});
```

Run (from `apps/admin`): `bun test src/components/member-pass-scanner` → FAIL.

- [ ] **Step 3: Implement `scan-tone.ts`**

```ts
import type { ScanOutcome } from "@/lib/member-pass/types";

export type ScanTone = "green" | "orange" | "amber" | "red" | "grey";

const TONES: Record<ScanOutcome["result"], ScanTone> = {
  check_id: "amber",
  denied: "red",
  duplicate: "orange",
  unavailable: "grey",
  valid: "green",
};

export function scanTone(outcome: ScanOutcome): ScanTone {
  return TONES[outcome.result];
}

export const SCAN_TONE_CLASSES: Record<ScanTone, string> = {
  amber: "bg-amber-500 text-black",
  green: "bg-green-600 text-white",
  grey: "bg-zinc-600 text-white",
  orange: "bg-orange-500 text-black",
  red: "bg-red-600 text-white",
};
```

Run the test → PASS.

- [ ] **Step 4: Add the admin translations**

Add a top-level `memberPass` object to `packages/i18n/messages/en/adminPortal.json`:

```json
"memberPass": {
  "scanTitle": "Scan member passes",
  "scanDescription": "Point the camera at a member's pass.",
  "openScanner": "Scan passes",
  "manageLinks": "Guest scanner links",
  "todaysColor": "Today's color",
  "cameraError": "Camera unavailable. Allow camera access and reload.",
  "starting": "Starting camera…",
  "notConfigured": "Pass scanning is not configured.",
  "tapToContinue": "Tap to scan the next pass",
  "results": {
    "valid": "Valid member",
    "duplicate": "Already scanned {seconds}s ago",
    "check_id": "Wallet pass — check ID",
    "unavailable": "Couldn't check — try again",
    "denied": "Not valid"
  },
  "reasons": {
    "bad_code": "Not a BISO pass",
    "stale": "Old code — ask them to open the pass again",
    "expired": "Membership has ended",
    "not_member": "Not a member",
    "not_linked": "No linked student account"
  },
  "validUntil": "Valid until {date}",
  "links": {
    "title": "Guest scanner links",
    "description": "Give event security a scanner without an account. Links expire automatically and can be revoked.",
    "label": "Label",
    "labelPlaceholder": "e.g. Fadderuke – door 1",
    "campus": "Campus",
    "allCampuses": "All campuses",
    "expiresAt": "Valid until",
    "create": "Create link",
    "created": "Link created — copy it now, it is shown only once.",
    "copy": "Copy link",
    "copied": "Copied",
    "active": "Active links",
    "none": "No active links.",
    "revoke": "Revoke",
    "revoked": "Link revoked",
    "expires": "Expires {date}",
    "errors": {
      "invalid_label": "Enter a label.",
      "invalid_expiry": "Choose a time in the future (max 48 hours).",
      "forbidden_campus": "You can only create links for your own campus.",
      "not_found": "That link no longer exists.",
      "failed": "Something went wrong. Try again.",
      "not_configured": "Pass scanning is not configured."
    }
  },
  "guest": {
    "invalidTitle": "This scanner link is not valid",
    "invalidDescription": "It has expired or been revoked. Ask BISO staff for a new link.",
    "rateLimited": "Too many scans — wait a moment."
  }
}
```

Add the same structure to `no/adminPortal.json`:

```json
"memberPass": {
  "scanTitle": "Skann medlemskort",
  "scanDescription": "Hold kameraet mot medlemskortet.",
  "openScanner": "Skann medlemskort",
  "manageLinks": "Gjesteskanner-lenker",
  "todaysColor": "Dagens farge",
  "cameraError": "Kameraet er utilgjengelig. Gi tilgang til kameraet og last inn på nytt.",
  "starting": "Starter kamera…",
  "notConfigured": "Skanning av medlemskort er ikke satt opp.",
  "tapToContinue": "Trykk for å skanne neste kort",
  "results": {
    "valid": "Gyldig medlem",
    "duplicate": "Allerede skannet for {seconds}s siden",
    "check_id": "Wallet-kort — sjekk legitimasjon",
    "unavailable": "Kunne ikke sjekke — prøv igjen",
    "denied": "Ikke gyldig"
  },
  "reasons": {
    "bad_code": "Ikke et BISO-kort",
    "stale": "Gammel kode — be personen åpne kortet på nytt",
    "expired": "Medlemskapet har utløpt",
    "not_member": "Ikke medlem",
    "not_linked": "Ingen tilkoblet studentkonto"
  },
  "validUntil": "Gyldig til {date}",
  "links": {
    "title": "Gjesteskanner-lenker",
    "description": "Gi vakter en skanner uten konto. Lenkene utløper automatisk og kan trekkes tilbake.",
    "label": "Navn",
    "labelPlaceholder": "f.eks. Fadderuke – dør 1",
    "campus": "Campus",
    "allCampuses": "Alle campuser",
    "expiresAt": "Gyldig til",
    "create": "Lag lenke",
    "created": "Lenken er laget — kopier den nå, den vises bare én gang.",
    "copy": "Kopier lenke",
    "copied": "Kopiert",
    "active": "Aktive lenker",
    "none": "Ingen aktive lenker.",
    "revoke": "Trekk tilbake",
    "revoked": "Lenken er trukket tilbake",
    "expires": "Utløper {date}",
    "errors": {
      "invalid_label": "Skriv inn et navn.",
      "invalid_expiry": "Velg et tidspunkt fram i tid (maks 48 timer).",
      "forbidden_campus": "Du kan bare lage lenker for din egen campus.",
      "not_found": "Lenken finnes ikke lenger.",
      "failed": "Noe gikk galt. Prøv igjen.",
      "not_configured": "Skanning av medlemskort er ikke satt opp."
    }
  },
  "guest": {
    "invalidTitle": "Denne skannerlenken er ikke gyldig",
    "invalidDescription": "Den har utløpt eller blitt trukket tilbake. Be BISO om en ny lenke.",
    "rateLimited": "For mange skanninger — vent litt."
  }
}
```

Also add `"colors"` to both `memberPass` sections by copying the `colors` object from `packages/i18n/messages/<locale>/memberPass.json` (Task 7) so the scanner can name the day color.

- [ ] **Step 5: Implement `scanner-screen.tsx`**

```tsx
"use client";

import type { DayColor } from "@repo/shared/utils/member-pass";
import { AlertTriangle, CheckCircle2, CircleSlash, Loader2, RotateCw, ShieldAlert } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanOutcome } from "@/lib/member-pass/types";
import { SCAN_TONE_CLASSES, type ScanTone, scanTone } from "./scan-tone";

type ScanAction = (
  code: string
) => Promise<{ data: ScanOutcome; success: true } | { error: string; success: false }>;

interface ScannerScreenProps {
  dayColor: DayColor | null;
  onScan: ScanAction;
  subtitle?: string;
  title: string;
}

const RESULT_DISMISS_MS = 3000;
const SAME_CODE_COOLDOWN_MS = 4000;
const VIBRATION: Record<ScanTone, number[]> = {
  amber: [80, 60, 80],
  green: [120],
  grey: [40, 40, 40],
  orange: [80, 60, 80],
  red: [300],
};

const ICONS: Record<ScanTone, typeof CheckCircle2> = {
  amber: ShieldAlert,
  green: CheckCircle2,
  grey: RotateCw,
  orange: AlertTriangle,
  red: CircleSlash,
};

type QrScannerInstance = { destroy: () => void; start: () => Promise<void> };

export function ScannerScreen({ dayColor, onScan, subtitle, title }: ScannerScreenProps) {
  const t = useTranslations("adminPortal.memberPass");
  const format = useFormatter();
  const video = useRef<HTMLVideoElement>(null);
  const busy = useRef(false);
  const lastCode = useRef<{ at: number; code: string } | null>(null);
  const [cameraState, setCameraState] = useState<"starting" | "ready" | "error">("starting");
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCode = useCallback(
    async (code: string) => {
      const now = Date.now();
      const recent = lastCode.current;
      if (busy.current || (recent && recent.code === code && now - recent.at < SAME_CODE_COOLDOWN_MS)) {
        return;
      }
      busy.current = true;
      lastCode.current = { at: now, code };
      try {
        const response = await onScan(code);
        if (response.success) {
          setOutcome(response.data);
          navigator.vibrate?.(VIBRATION[scanTone(response.data)]);
        } else {
          setError(response.error);
        }
      } catch {
        setOutcome({ result: "unavailable" });
      } finally {
        busy.current = false;
      }
    },
    [onScan]
  );

  useEffect(() => {
    if (!(outcome || error)) {
      return;
    }
    const timer = setTimeout(() => {
      setOutcome(null);
      setError(null);
    }, RESULT_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [outcome, error]);

  useEffect(() => {
    let scanner: QrScannerInstance | null = null;
    let cancelled = false;
    (async () => {
      const element = video.current;
      if (!element) {
        return;
      }
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (cancelled) {
          return;
        }
        const instance = new QrScanner(element, (result) => handleCode(result.data), {
          highlightScanRegion: true,
          preferredCamera: "environment",
          returnDetailedScanResult: true,
        });
        scanner = instance;
        await instance.start();
        if (!cancelled) {
          setCameraState("ready");
        }
      } catch {
        if (!cancelled) {
          setCameraState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
      scanner?.destroy();
    };
  }, [handleCode]);

  const tone = outcome ? scanTone(outcome) : null;
  const Icon = tone ? ICONS[tone] : null;

  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] flex-col overflow-hidden rounded-2xl bg-black text-white">
      <div className="z-10 flex items-center justify-between gap-3 bg-black/70 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{title}</p>
          {subtitle ? <p className="truncate text-sm text-white/60">{subtitle}</p> : null}
        </div>
        {dayColor ? (
          <div className="flex items-center gap-2 rounded-full px-3 py-1 font-bold text-sm uppercase" style={{ backgroundColor: dayColor.hex }}>
            <span className="sr-only">{t("todaysColor")}</span>
            {t(`colors.${dayColor.name}` as "colors.red")}
          </div>
        ) : null}
      </div>

      <video className="absolute inset-0 h-full w-full object-cover" muted playsInline ref={video} />

      {cameraState !== "ready" ? (
        <div className="z-10 m-auto flex flex-col items-center gap-3 p-6 text-center">
          {cameraState === "starting" ? <Loader2 className="h-8 w-8 animate-spin" /> : <AlertTriangle className="h-8 w-8" />}
          <p>{cameraState === "starting" ? t("starting") : t("cameraError")}</p>
        </div>
      ) : null}

      {outcome && tone && Icon ? (
        <button
          className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 p-6 text-center ${SCAN_TONE_CLASSES[tone]}`}
          onClick={() => setOutcome(null)}
          type="button"
        >
          <Icon className="h-24 w-24" />
          <p className="font-black text-3xl uppercase">
            {t(`results.${outcome.result}`, { seconds: outcome.secondsSincePrevious ?? 0 })}
          </p>
          {outcome.name ? <p className="font-bold text-4xl">{outcome.name}</p> : null}
          {outcome.reason ? <p className="text-xl">{t(`reasons.${outcome.reason}`)}</p> : null}
          {outcome.membershipName ? <p className="text-xl">{outcome.membershipName}</p> : null}
          {outcome.expiryDate ? (
            <p className="text-lg opacity-80">
              {t("validUntil", {
                date: format.dateTime(new Date(`${outcome.expiryDate}T12:00:00Z`), {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
              })}
            </p>
          ) : null}
          <p className="mt-6 text-sm opacity-70">{t("tapToContinue")}</p>
        </button>
      ) : null}

      {error ? (
        <div className="absolute inset-x-4 bottom-4 z-20 rounded-xl bg-red-600 p-4 text-center font-semibold">
          {error === "rate_limited" ? t("guest.rateLimited") : t(`links.errors.${error}` as "links.errors.failed")}
        </div>
      ) : null}
    </div>
  );
}
```

Check the `qr-scanner` typings: the callback receives `QrScanner.ScanResult` (`{ data: string }`) when `returnDetailedScanResult: true`. Read `apps/admin/node_modules/qr-scanner/types/qr-scanner.d.ts` if the options object doesn't type-check.

- [ ] **Step 6: Staff scanner page** `apps/admin/src/app/(portal)/members/scan/page.tsx`

```tsx
import { getTranslations } from "next-intl/server";
import { ScannerScreen } from "@/components/member-pass-scanner/scanner-screen";
import { requireNavAccess } from "@/lib/authorization";
import { getScannerDayColor, scanMemberPass } from "../../_actions/member-pass";

export default async function MemberPassScanPage() {
  await requireNavAccess("portal.members");
  const t = await getTranslations("adminPortal.memberPass");
  const color = await getScannerDayColor();
  if (!color.success) {
    return <p className="p-6 text-center text-muted-foreground">{t("notConfigured")}</p>;
  }
  return (
    <ScannerScreen
      dayColor={color.data}
      onScan={scanMemberPass}
      subtitle={t("scanDescription")}
      title={t("scanTitle")}
    />
  );
}
```

- [ ] **Step 7: Link management page and client**

`apps/admin/src/app/(portal)/members/scan/links/page.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { CAMPUS_ID_TO_NAME } from "@/lib/campus-constants";
import { ROLES } from "@/lib/roles";
import { listScannerLinks } from "../../../_actions/member-pass";
import { PageHeader } from "../../../_components/page-header";
import { ScannerLinksClient } from "./_components/scanner-links-client";

export default async function ScannerLinksPage() {
  const ctx = await requireNavAccess("portal.members");
  const t = await getTranslations("adminPortal.memberPass.links");
  const links = await listScannerLinks();
  const isGlobal = ctx.roles.includes(ROLES.GLOBAL_ADMIN);
  const campusIds = isGlobal ? Object.keys(CAMPUS_ID_TO_NAME) : ctx.managedCampusIds;
  const campuses = campusIds.map((id) => ({ id, name: CAMPUS_ID_TO_NAME[id] ?? id }));

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")} />
      <ScannerLinksClient
        allowAllCampuses={isGlobal}
        campuses={campuses}
        initialLinks={links.success ? links.data : []}
      />
    </div>
  );
}
```

`apps/admin/src/app/(portal)/members/scan/links/_components/scanner-links-client.tsx`:

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Copy } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createScannerLink,
  revokeScannerLink,
  type ScannerLinkView,
} from "../../../../_actions/member-pass";

const DEFAULT_HOURS = 6;
const HOUR_MS = 60 * 60 * 1000;

function toLocalInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function ScannerLinksClient({
  allowAllCampuses,
  campuses,
  initialLinks,
}: {
  allowAllCampuses: boolean;
  campuses: { id: string; name: string }[];
  initialLinks: ScannerLinkView[];
}) {
  const t = useTranslations("adminPortal.memberPass.links");
  const format = useFormatter();
  const ids = { campus: useId(), expires: useId(), label: useId() };
  const [links, setLinks] = useState(initialLinks);
  const [label, setLabel] = useState("");
  const [campusId, setCampusId] = useState(allowAllCampuses ? "" : (campuses[0]?.id ?? ""));
  const [expiresAt, setExpiresAt] = useState(() => toLocalInputValue(new Date(Date.now() + DEFAULT_HOURS * HOUR_MS)));
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const create = () =>
    startTransition(async () => {
      const result = await createScannerLink({
        campusId: campusId || null,
        expiresAt: new Date(expiresAt).toISOString(),
        label,
      });
      if (!result.success) {
        toast.error(t(`errors.${result.error}` as "errors.failed"));
        return;
      }
      setLinks((current) => [...current, result.data.link]);
      setCreatedUrl(result.data.url);
      setLabel("");
      toast.success(t("created"));
    });

  const revoke = (id: string) =>
    startTransition(async () => {
      const result = await revokeScannerLink(id);
      if (!result.success) {
        toast.error(t(`errors.${result.error}` as "errors.failed"));
        return;
      }
      setLinks((current) => current.filter((link) => link.id !== id));
      toast.success(t("revoked"));
    });

  const copy = async () => {
    if (createdUrl) {
      await navigator.clipboard.writeText(createdUrl);
      toast.success(t("copied"));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="space-y-4 p-6">
        <div className="space-y-2">
          <Label htmlFor={ids.label}>{t("label")}</Label>
          <Input id={ids.label} maxLength={120} onChange={(event) => setLabel(event.target.value)} placeholder={t("labelPlaceholder")} value={label} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={ids.campus}>{t("campus")}</Label>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            id={ids.campus}
            onChange={(event) => setCampusId(event.target.value)}
            value={campusId}
          >
            {allowAllCampuses ? <option value="">{t("allCampuses")}</option> : null}
            {campuses.map((campus) => (
              <option key={campus.id} value={campus.id}>
                {campus.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={ids.expires}>{t("expiresAt")}</Label>
          <Input id={ids.expires} onChange={(event) => setExpiresAt(event.target.value)} type="datetime-local" value={expiresAt} />
        </div>
        <Button disabled={pending} onClick={create}>
          {t("create")}
        </Button>

        {createdUrl ? (
          <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:bg-amber-950/30">
            <p>{t("created")}</p>
            <p className="break-all font-mono">{createdUrl}</p>
            <Button onClick={copy} size="sm" variant="outline">
              <Copy className="mr-2 h-4 w-4" />
              {t("copy")}
            </Button>
          </div>
        ) : null}
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="font-semibold">{t("active")}</h2>
        {links.length === 0 ? <p className="text-muted-foreground text-sm">{t("none")}</p> : null}
        {links.map((link) => (
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3" key={link.id}>
            <div className="min-w-0">
              <p className="truncate font-medium">{link.label}</p>
              <p className="text-muted-foreground text-xs">
                {t("expires", {
                  date: format.dateTime(new Date(link.expiresAt), { dateStyle: "medium", timeStyle: "short" }),
                })}
              </p>
            </div>
            <Button disabled={pending} onClick={() => revoke(link.id)} size="sm" variant="destructive">
              {t("revoke")}
            </Button>
          </div>
        ))}
      </Card>
    </div>
  );
}
```

The guest-link QR in the spec is out of this task's scope (link text + copy is enough for handing over); if wanted later, reuse a QR renderer in admin.

Confirm `@repo/ui/components/ui/input` and `label` exist (`ls packages/ui/components/ui`); `CAMPUS_ID_TO_NAME` is exported from `apps/admin/src/lib/campus-constants.ts` (it is used by `members.ts`).

- [ ] **Step 8: Entry points on the members page**

In `apps/admin/src/app/(portal)/members/page.tsx`, pass children to `PageHeader`:

```tsx
      <PageHeader description={t("description")} title={t("title")}>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/members/scan/links">{tPass("manageLinks")}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/members/scan">
              <ScanLine className="mr-2 h-4 w-4" />
              {tPass("openScanner")}
            </Link>
          </Button>
        </div>
      </PageHeader>
```

with `const tPass = await getTranslations("adminPortal.memberPass");` and imports `Button` (`@repo/ui/components/ui/button`), `Link` (`next/link`), `ScanLine` (`lucide-react`).

- [ ] **Step 9: Verify**

```bash
bun run check-types --filter=admin --filter=@repo/i18n
cd apps/admin && bun test src/components/member-pass-scanner src/lib/member-pass && bun run lint
```

Browser (phone on the same network, or Chrome DevTools device mode with a webcam): sign in to admin, open `/members` → "Scan passes"; scan the web pass from Task 9 → green with name; scan again → orange "Already scanned"; wait 2 minutes and scan a screenshot of an old code → red "Old code". Create a link on `/members/scan/links` → URL shown once; revoke it → disappears.

- [ ] **Step 10: Commit**

```bash
bun x ultracite fix apps/admin/src packages/i18n/messages
git add apps/admin/package.json bun.lock apps/admin/src packages/i18n/messages
git commit -m "Add the member pass scanner and guest link management

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
### Task 16: Guest scanner

The spec describes a route handler; a server action bound to the token performs the same checks and plugs straight into `<ScannerScreen onScan>`, so this task uses one.

**Files:**
- Create: `apps/admin/src/app/(scan)/scan/actions.ts`
- Test: `apps/admin/src/app/(scan)/scan/actions.test.ts`
- Create: `apps/admin/src/app/(scan)/scan/[token]/page.tsx`

**Interfaces:**
- Consumes: Tasks 11–13, 15.
- Produces:
  - `resolveGuestLink(token: string): Promise<ScannerLinkRow | null>` (usable link or null)
  - `scanWithGuestLink(token: string, code: string): Promise<{ data: ScanOutcome; success: true } | { error: "invalid_link" | "rate_limited" | "not_configured" | "failed"; success: false }>`
  - Route `/scan/<token>` — public, no admin session required.
  - Rate limit: 60 scans per link per minute.

- [ ] **Step 1: Read the guide on route groups and dynamic params** in `apps/admin/node_modules/next/dist/docs/` (Next 16 passes `params` as a Promise).

- [ ] **Step 2: Write the failing test**

```ts
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { signWebPassCode } from "@repo/shared/utils/member-pass";
import { passSlot } from "@repo/shared/utils/member-pass-slots";
import { hashGuestToken } from "@/lib/member-pass/guest-links";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const TOKEN = "guest-token";
const db = { createRow: mock(), getRow: mock(), listRows: mock() };
const getScanMembershipStatus = mock();

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
}));
mock.module("@/lib/member-pass/membership-lookup", () => ({
  getScanMembershipStatus,
}));

const { resolveGuestLink, scanWithGuestLink } = await import("./actions");

const liveLink = {
  $id: "link-1",
  expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  revoked_at: null,
  token_hash: hashGuestToken(TOKEN),
};

describe("guest scanner", () => {
  beforeEach(() => {
    process.env.MEMBER_PASS_SECRET = SECRET;
    for (const fn of [...Object.values(db), getScanMembershipStatus]) {
      fn.mockReset();
    }
    db.listRows.mockImplementation(async (_db, table) =>
      table === "member_pass_scanner_links"
        ? { rows: [liveLink], total: 1 }
        : { rows: [], total: 0 }
    );
    db.createRow.mockResolvedValue({});
    db.getRow.mockResolvedValue({ $id: "m1", name: "M", student_id: "s1" });
    getScanMembershipStatus.mockResolvedValue({
      checkedAt: 0,
      finagoCategoryIds: [1],
      isMember: true,
      memberships: [
        { category: "1", expiryDate: "2099-12-31", id: "54", name: "Semester", startDate: "2099-07-01" },
      ],
    });
  });

  test("looks the link up by the hash of its token", async () => {
    expect(await resolveGuestLink(TOKEN)).toMatchObject({ $id: "link-1" });
    expect(JSON.stringify(db.listRows.mock.calls[0]?.[2])).toContain(hashGuestToken(TOKEN));
  });

  test("scans on behalf of the link", async () => {
    const code = signWebPassCode("m1", passSlot(Date.now()), SECRET);
    const result = await scanWithGuestLink(TOKEN, code);
    expect(result).toMatchObject({ data: { name: "M", result: "valid" }, success: true });
    const scanRow = db.createRow.mock.calls.find((call) => call[1] === "member_pass_scans")?.[3];
    expect(scanRow).toMatchObject({ scanner_link_id: "link-1", scanner_user_id: null });
  });

  test("refuses revoked or expired links", async () => {
    for (const link of [
      { ...liveLink, revoked_at: new Date().toISOString() },
      { ...liveLink, expires_at: new Date(Date.now() - 1000).toISOString() },
    ]) {
      db.listRows.mockResolvedValue({ rows: [link], total: 1 });
      expect(await scanWithGuestLink(TOKEN, "code")).toEqual({
        error: "invalid_link",
        success: false,
      });
    }
  });

  test("rate limits a busy link", async () => {
    db.listRows.mockImplementation(async (_db, table) =>
      table === "member_pass_scanner_links"
        ? { rows: [{ ...liveLink, $id: "busy-link" }], total: 1 }
        : { rows: [], total: 0 }
    );
    let last: unknown;
    for (let i = 0; i < 61; i += 1) {
      last = await scanWithGuestLink(TOKEN, "v1.bad");
    }
    expect(last).toEqual({ error: "rate_limited", success: false });
  });
});
```

Run (from `apps/admin`): `bun test "src/app/(scan)/scan/actions.test.ts"` → FAIL.

- [ ] **Step 3: Implement `actions.ts`**

```ts
"use server";

import { createAdminClient } from "@repo/api/server";
import { readMemberPassSecret } from "@repo/shared/utils/member-pass";
import { hashGuestToken, isLinkUsable } from "@/lib/member-pass/guest-links";
import { getScanMembershipStatus } from "@/lib/member-pass/membership-lookup";
import { createRateLimiter } from "@/lib/member-pass/rate-limit";
import { findLinkByTokenHash } from "@/lib/member-pass/store";
import type { ScannerLinkRow, ScanOutcome } from "@/lib/member-pass/types";
import { scanLogFor, verifyScan } from "@/lib/member-pass/verify-scan";

const MAX_TOKEN_LENGTH = 128;
const allowScan = createRateLimiter({ limit: 60, windowMs: 60 * 1000 });

type GuestScanResult =
  | { data: ScanOutcome; success: true }
  | {
      error: "invalid_link" | "rate_limited" | "not_configured" | "failed";
      success: false;
    };

export async function resolveGuestLink(
  token: string
): Promise<ScannerLinkRow | null> {
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return null;
  }
  const { db } = await createAdminClient();
  const link = await findLinkByTokenHash(db, hashGuestToken(token));
  return isLinkUsable(link, new Date()) ? link : null;
}

/**
 * A scan from a guest scanner link. The link is re-checked on every scan so
 * revoking it takes effect immediately.
 */
export async function scanWithGuestLink(
  token: string,
  code: string
): Promise<GuestScanResult> {
  const secret = readMemberPassSecret();
  if (!secret) {
    return { error: "not_configured", success: false };
  }
  try {
    const link = await resolveGuestLink(token);
    if (!link) {
      return { error: "invalid_link", success: false };
    }
    if (!allowScan(link.$id)) {
      return { error: "rate_limited", success: false };
    }
    const { db } = await createAdminClient();
    const outcome = await verifyScan(
      code.trim(),
      { kind: "guest", linkId: link.$id },
      {
        db,
        getStatus: getScanMembershipStatus,
        now: new Date(),
        scans: scanLogFor(db),
        secret,
      }
    );
    return { data: outcome, success: true };
  } catch (error) {
    console.error("[Member Pass] Guest scan failed:", error);
    return { error: "failed", success: false };
  }
}
```

`"use server"` modules may only export async functions; `allowScan` stays module-private.

- [ ] **Step 4: Implement the page** `apps/admin/src/app/(scan)/scan/[token]/page.tsx`

```tsx
import { readMemberPassSecret, dayColor } from "@repo/shared/utils/member-pass";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ScannerScreen } from "@/components/member-pass-scanner/scanner-screen";
import { resolveGuestLink, scanWithGuestLink } from "../actions";

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { follow: false, index: false },
  title: "BISO scanner",
};

export default async function GuestScannerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations("adminPortal.memberPass");
  const secret = readMemberPassSecret();
  const link = secret ? await resolveGuestLink(token).catch(() => null) : null;

  if (!(secret && link)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
        <h1 className="font-bold text-2xl">{t("guest.invalidTitle")}</h1>
        <p className="text-muted-foreground">{t("guest.invalidDescription")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-black p-2">
      <ScannerScreen
        dayColor={dayColor(new Date(), secret)}
        onScan={scanWithGuestLink.bind(null, token)}
        subtitle={t("scanDescription")}
        title={link.label}
      />
    </div>
  );
}
```

`referrer: "no-referrer"` keeps the token out of Referer headers. Confirm the admin root layout and `providers.tsx` don't redirect anonymous visitors (they don't today; only `(portal)`/`(protected)`/`(editor)` layouts gate). If `Metadata` in Next 16 does not accept `referrer`, drop it and add `<meta name="referrer" content="no-referrer" />` via the metadata `other` field.

- [ ] **Step 5: Verify**

```bash
cd apps/admin && bun test "src/app/(scan)" src/lib/member-pass "src/app/(portal)/_actions/member-pass.test.ts"
cd ../.. && bun run check-types --filter=admin
```

Browser: open a created link in a private window (no admin session) → scanner loads with the link's label; scanning works; revoke the link in another window → next scan shows the "not valid link" error, and a reload shows the invalid page.

- [ ] **Step 6: Commit**

```bash
bun x ultracite fix "apps/admin/src/app/(scan)"
git add "apps/admin/src/app/(scan)"
git commit -m "Add the guest member pass scanner

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

`invalid_link` needs a message in the scanner's error banner: add `"invalid_link": "This scanner link is no longer valid."` / `"Denne skannerlenken er ikke lenger gyldig."` to `adminPortal.memberPass.links.errors` in both locales as part of this commit.

---
## Phase 4 — Wallets

### Task 17: Apple Wallet pass

**Files:**
- Modify: `apps/web/package.json` via `bun add passkit-generator --filter=web`
- Modify: `apps/web/next.config.ts` (add `passkit-generator` to `serverExternalPackages` if the build complains about bundling it)
- Create: `apps/web/src/lib/member-pass/apple-pass.ts`
- Test: `apps/web/src/lib/member-pass/apple-pass.test.ts`
- Create: `apps/web/src/app/api/member-pass/apple/route.ts`
- Test: `apps/web/src/app/api/member-pass/apple/route.test.ts`

**Interfaces:**
- Consumes: `resolveMemberPass` (Task 6), `readAppleWalletConfig` (Task 6), `signAppleWalletCode` (Task 4).
- Produces:
  - `WALLET_COLORS = { background: "#00172F", foreground: "#FFFFFF", label: "#7FD1F5" }` (from `apple-pass.ts`; reused by Task 18). Confirm the navy against BISO's brand guide and adjust in one place.
  - `interface WalletPassLabels { member: string; membership: string; validUntil: string }`
  - `applePassFields(holder: MemberPassHolder, labels: WalletPassLabels, termLabel: string)` → `{ auxiliary: PassField[]; primary: PassField[]; secondary: PassField[] }` where `PassField = { key: string; label: string; value: string }`
  - `buildAppleWalletPass(input: { code: string; config: AppleWalletConfig; fields: ReturnType<typeof applePassFields>; icon: Buffer; expiryDate: string; userId: string }): Promise<Buffer>`
  - `GET /api/member-pass/apple` → `application/vnd.apple.pkpass` attachment; 401 anonymous; 403 non-member; 404 when not configured.

- [ ] **Step 1: Install and read the library API**

```bash
bun add passkit-generator --filter=web
```

Read `apps/web/node_modules/passkit-generator/README.md` and the typings in `apps/web/node_modules/passkit-generator/lib/` for: `new PKPass(buffers, certificates, props)`, `pass.type = "generic"`, `pass.primaryFields` / `secondaryFields` / `auxiliaryFields` (arrays you `push` into), `pass.setBarcodes({ format, message, messageEncoding })`, `pass.setExpirationDate(date)`, `pass.getAsBuffer()`. If a name differs in 3.6.0, use the library's name — the shapes below are the intent.

- [ ] **Step 2: Write the failing tests**

`apple-pass.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("passkit-generator", () => ({ PKPass: class {} }));

import { applePassFields } from "./apple-pass";

describe("applePassFields", () => {
  it("lays out the member, term and expiry", () => {
    expect(
      applePassFields(
        {
          expiryDate: "2026-12-31",
          membershipName: "Semester",
          name: "Markus Heien",
          startDate: "2026-07-01",
          term: null,
        },
        { member: "Member", membership: "Membership", validUntil: "Valid until" },
        "Fall 2026"
      )
    ).toEqual({
      auxiliary: [{ key: "expiry", label: "Valid until", value: "2026-12-31" }],
      primary: [{ key: "name", label: "Member", value: "Markus Heien" }],
      secondary: [{ key: "term", label: "Membership", value: "Fall 2026" }],
    });
  });
});
```

`apple/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveMemberPass = vi.hoisted(() => vi.fn());
const readAppleWalletConfig = vi.hoisted(() => vi.fn());
const buildAppleWalletPass = vi.hoisted(() => vi.fn(async () => Buffer.from("PKPASS")));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/member-pass/resolve", () => ({ resolveMemberPass }));
vi.mock("@/lib/member-pass/wallet-config", () => ({ readAppleWalletConfig }));
vi.mock("@/lib/member-pass/apple-pass", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/member-pass/apple-pass")>()),
  buildAppleWalletPass,
  loadWalletIcon: vi.fn(async () => Buffer.from("PNG")),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

import { GET } from "./route";

const ACTIVE = {
  holder: {
    expiryDate: "2026-12-31",
    membershipName: "Semester",
    name: "Markus Heien",
    startDate: "2026-07-01",
    term: { duration: "semester", fromYear: 2026, season: "fall", toYear: 2026 },
  },
  state: "active",
  userId: "user-1",
};

describe("GET /api/member-pass/apple", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MEMBER_PASS_SECRET", "test-secret-that-is-at-least-32-characters-long");
    readAppleWalletConfig.mockReturnValue({ passTypeId: "p", signerCert: "c", signerKey: "k", teamId: "t", wwdr: "w" });
  });

  it("is 404 when Apple Wallet is not configured", async () => {
    readAppleWalletConfig.mockReturnValue(null);
    expect((await GET()).status).toBe(404);
  });

  it("is 401 for anonymous visitors and 403 for non-members", async () => {
    resolveMemberPass.mockResolvedValue({ state: "unauthenticated" });
    expect((await GET()).status).toBe(401);
    resolveMemberPass.mockResolvedValue({ state: "not_member" });
    expect((await GET()).status).toBe(403);
  });

  it("returns a signed pass for members", async () => {
    resolveMemberPass.mockResolvedValue(ACTIVE);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/vnd.apple.pkpass");
    expect(response.headers.get("content-disposition")).toContain("biso-membership.pkpass");
    const input = buildAppleWalletPass.mock.calls[0]?.[0];
    expect(input.code).toMatch(/^a1\.user-1\.20261231\./);
    expect(input.expiryDate).toBe("2026-12-31");
  });
});
```

Run (from `apps/web`): `bun x vitest run src/lib/member-pass/apple-pass.test.ts src/app/api/member-pass/apple` → FAIL.

- [ ] **Step 3: Implement `apple-pass.ts`**

```ts
import "server-only";
import { PKPass } from "passkit-generator";
import type { MemberPassHolder } from "./types";
import type { AppleWalletConfig } from "./wallet-config";

export const WALLET_COLORS = {
  background: "#00172F",
  foreground: "#FFFFFF",
  label: "#7FD1F5",
} as const;

export interface WalletPassLabels {
  member: string;
  membership: string;
  validUntil: string;
}

interface PassField {
  key: string;
  label: string;
  value: string;
}

export function applePassFields(
  holder: MemberPassHolder,
  labels: WalletPassLabels,
  termLabel: string
): { auxiliary: PassField[]; primary: PassField[]; secondary: PassField[] } {
  return {
    auxiliary: [{ key: "expiry", label: labels.validUntil, value: holder.expiryDate }],
    primary: [{ key: "name", label: labels.member, value: holder.name }],
    secondary: [{ key: "term", label: labels.membership, value: termLabel }],
  };
}

function hexToRgb(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
}

let cachedIcon: Buffer | null = null;

/**
 * The pass icon, fetched once from the public site. Standalone output does
 * not trace `public/`, so reading it from disk is not reliable.
 */
export async function loadWalletIcon(baseUrl: string): Promise<Buffer> {
  if (cachedIcon) {
    return cachedIcon;
  }
  const response = await fetch(`${baseUrl}/apple-touch-icon.png`);
  if (!response.ok) {
    throw new Error(`Wallet icon fetch failed: ${response.status}`);
  }
  cachedIcon = Buffer.from(await response.arrayBuffer());
  return cachedIcon;
}

export async function buildAppleWalletPass(input: {
  code: string;
  config: AppleWalletConfig;
  expiryDate: string;
  fields: ReturnType<typeof applePassFields>;
  icon: Buffer;
  userId: string;
}): Promise<Buffer> {
  const { config } = input;
  const pass = new PKPass(
    {
      "icon.png": input.icon,
      "icon@2x.png": input.icon,
      "logo.png": input.icon,
    },
    {
      signerCert: config.signerCert,
      signerKey: config.signerKey,
      signerKeyPassphrase: config.signerKeyPassphrase,
      wwdr: config.wwdr,
    },
    {
      backgroundColor: hexToRgb(WALLET_COLORS.background),
      description: "BISO membership",
      foregroundColor: hexToRgb(WALLET_COLORS.foreground),
      formatVersion: 1,
      labelColor: hexToRgb(WALLET_COLORS.label),
      logoText: "BISO",
      organizationName: "BI Student Organisation",
      passTypeIdentifier: config.passTypeId,
      // Stable per member so re-adding replaces the pass instead of stacking.
      serialNumber: `member-${input.userId}`,
      teamIdentifier: config.teamId,
    }
  );
  pass.type = "generic";
  pass.primaryFields.push(...input.fields.primary);
  pass.secondaryFields.push(...input.fields.secondary);
  pass.auxiliaryFields.push(...input.fields.auxiliary);
  pass.setBarcodes({
    format: "PKBarcodeFormatQR",
    message: input.code,
    messageEncoding: "iso-8859-1",
  });
  // Wallet greys the pass out after this moment: end of the expiry day, Oslo.
  pass.setExpirationDate(new Date(`${input.expiryDate}T23:59:59+01:00`));
  return pass.getAsBuffer();
}
```

- [ ] **Step 4: Implement the route** `apps/web/src/app/api/member-pass/apple/route.ts`

```ts
import {
  readMemberPassSecret,
  signAppleWalletCode,
} from "@repo/shared/utils/member-pass";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import {
  applePassFields,
  buildAppleWalletPass,
  loadWalletIcon,
} from "@/lib/member-pass/apple-pass";
import { resolveMemberPass } from "@/lib/member-pass/resolve";
import { termLabel } from "@/lib/member-pass/term-label";
import { readAppleWalletConfig } from "@/lib/member-pass/wallet-config";

const NO_STORE = { "Cache-Control": "private, no-store" };

function error(status: number, code: string) {
  return NextResponse.json({ error: code }, { headers: NO_STORE, status });
}

export async function GET() {
  const config = readAppleWalletConfig();
  const secret = readMemberPassSecret();
  if (!(config && secret)) {
    return error(404, "not_configured");
  }
  const resolved = await resolveMemberPass();
  if (resolved.state === "unauthenticated") {
    return error(401, "not_authenticated");
  }
  if (resolved.state !== "active") {
    return error(403, resolved.state);
  }

  try {
    const t = await getTranslations("memberPass");
    const { holder, userId } = resolved;
    const pass = await buildAppleWalletPass({
      code: signAppleWalletCode(userId, holder.expiryDate, secret),
      config,
      expiryDate: holder.expiryDate,
      fields: applePassFields(
        holder,
        { member: t("member"), membership: t("walletLabels.membership"), validUntil: t("walletLabels.validUntil") },
        termLabel(t, holder)
      ),
      icon: await loadWalletIcon(process.env.NEXT_PUBLIC_BASE_URL ?? "https://biso.no"),
      userId,
    });
    return new Response(new Uint8Array(pass), {
      headers: {
        ...NO_STORE,
        "Content-Disposition": 'attachment; filename="biso-membership.pkpass"',
        "Content-Type": "application/vnd.apple.pkpass",
      },
    });
  } catch (cause) {
    console.error("[Member Pass] Apple Wallet pass failed:", cause);
    return error(500, "failed");
  }
}
```

Create `apps/web/src/lib/member-pass/term-label.ts` (shared with Task 18 and, optionally, the card's `useTermLabel`):

```ts
import type { MemberPassHolder } from "./types";

type Translate = (key: string, values?: Record<string, string | number>) => string;

export function termLabel(t: Translate, holder: MemberPassHolder): string {
  const { term } = holder;
  if (!term) {
    return holder.membershipName;
  }
  if (term.season) {
    return t("term.semester", { season: term.season, year: term.fromYear });
  }
  return t("term.span", { from: term.fromYear, to: term.toYear });
}
```

Add `"walletLabels": { "membership": "Membership", "validUntil": "Valid until" }` to `en/memberPass.json` and `"walletLabels": { "membership": "Medlemskap", "validUntil": "Gyldig til" }` to `no/memberPass.json`. The route test's `getTranslations` mock returns keys, so the label values are not asserted.

- [ ] **Step 5: Run to verify they pass**

Run (from `apps/web`): `bun x vitest run src/lib/member-pass src/app/api/member-pass` → PASS.

- [ ] **Step 6: Type-check, build check, commit**

```bash
bun run check-types --filter=web
bun run build --filter=web
```

If the build fails on `passkit-generator` (native/optional deps), add it to `serverExternalPackages` in `apps/web/next.config.ts` and rebuild.

```bash
bun x ultracite fix apps/web/src/lib/member-pass apps/web/src/app/api/member-pass packages/i18n/messages
git add apps/web/package.json bun.lock apps/web/next.config.ts apps/web/src/lib/member-pass apps/web/src/app/api/member-pass packages/i18n/messages
git commit -m "Offer the member pass in Apple Wallet

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Manual check once certificates exist: open `/api/member-pass/apple` in Safari on an iPhone → "Add" sheet appears; the pass shows name, term and expiry; scanning it in the admin scanner shows amber "Wallet pass — check ID".

### Task 18: Google Wallet pass

**Files:**
- Create: `apps/web/src/lib/member-pass/google-pass.ts`
- Test: `apps/web/src/lib/member-pass/google-pass.test.ts`
- Create: `apps/web/src/app/api/member-pass/google/route.ts`
- Test: `apps/web/src/app/api/member-pass/google/route.test.ts`

**Interfaces:**
- Consumes: Task 6 (`resolveMemberPass`, `readGoogleWalletConfig`), Task 4 (`googleWalletTotpKeyHex`, `googleWalletCodePattern`), Task 17 (`WALLET_COLORS`, `termLabel`).
- Produces:
  - `googleClassId(issuerId: string): string` → `<issuerId>.biso-membership`
  - `googleObjectId(issuerId: string, userId: string): string` → `<issuerId>.member-<userId with chars outside [A-Za-z0-9._-] replaced by "_">`
  - `buildGoogleWalletObject(input: { holder: MemberPassHolder; issuerId: string; logoUrl: string; termLabel: string; totpKeyHex: string; userId: string; labels: { member: string; validUntil: string } }): Record<string, unknown>`
  - `signGoogleSaveJwt(input: { config: GoogleWalletConfig; genericObject: Record<string, unknown>; now: Date; origins: string[] }): string`
  - `GET /api/member-pass/google` → 302 to `https://pay.google.com/gp/v/save/<jwt>`; 401 / 403 / 404 as in Task 17.

- [ ] **Step 1: Write the failing tests**

`google-pass.test.ts`:

```ts
import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildGoogleWalletObject,
  googleObjectId,
  signGoogleSaveJwt,
} from "./google-pass";

const HOLDER = {
  expiryDate: "2026-12-31",
  membershipName: "Semester",
  name: "Markus Heien",
  startDate: "2026-07-01",
  term: null,
};

describe("buildGoogleWalletObject", () => {
  const object = buildGoogleWalletObject({
    holder: HOLDER,
    issuerId: "3388",
    labels: { member: "Member", validUntil: "Valid until" },
    logoUrl: "https://biso.no/apple-touch-icon.png",
    termLabel: "Fall 2026",
    totpKeyHex: "ab".repeat(20),
    userId: "user-1",
  });

  it("uses a rotating TOTP barcode with a hex key", () => {
    expect(object.rotatingBarcode).toEqual({
      totpDetails: {
        algorithm: "TOTP_SHA1",
        parameters: [{ key: "ab".repeat(20), valueLength: 6 }],
        periodMillis: "30000",
      },
      type: "QR_CODE",
      valuePattern: "g1.user-1.{totp_value_0}",
    });
  });

  it("identifies and bounds the pass", () => {
    expect(object.id).toBe("3388.member-user-1");
    expect(object.classId).toBe("3388.biso-membership");
    expect(object.state).toBe("ACTIVE");
    expect(object.validTimeInterval).toEqual({
      end: { date: "2026-12-31T23:59:59Z" },
      start: { date: "2026-07-01T00:00:00Z" },
    });
  });

  it("sanitizes ids", () => {
    expect(googleObjectId("1", "a b/c")).toBe("1.member-a_b_c");
  });
});

describe("signGoogleSaveJwt", () => {
  it("produces an RS256 JWT Google can verify", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwt = signGoogleSaveJwt({
      config: {
        clientEmail: "wallet@x.iam.gserviceaccount.com",
        issuerId: "3388",
        privateKey: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
      },
      genericObject: { id: "3388.member-user-1" },
      now: new Date("2026-09-17T10:00:00Z"),
      origins: ["https://biso.no"],
    });
    const [header, payload, signature] = jwt.split(".");
    expect(JSON.parse(Buffer.from(header ?? "", "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    const claims = JSON.parse(Buffer.from(payload ?? "", "base64url").toString());
    expect(claims).toMatchObject({
      aud: "google",
      iat: 1_789_639_200,
      iss: "wallet@x.iam.gserviceaccount.com",
      origins: ["https://biso.no"],
      typ: "savetowallet",
    });
    expect(claims.payload.genericObjects).toEqual([{ id: "3388.member-user-1" }]);
    expect(claims.payload.genericClasses).toEqual([{ id: "3388.biso-membership" }]);
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${payload}`);
    expect(verifier.verify(publicKey, Buffer.from(signature ?? "", "base64url"))).toBe(true);
  });
});
```

Epoch check: `Date.parse("2026-09-17T10:00:00Z") / 1000` = 1789639200.

`google/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveMemberPass = vi.hoisted(() => vi.fn());
const readGoogleWalletConfig = vi.hoisted(() => vi.fn());
const signGoogleSaveJwt = vi.hoisted(() => vi.fn(() => "header.payload.sig"));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/member-pass/resolve", () => ({ resolveMemberPass }));
vi.mock("@/lib/member-pass/wallet-config", () => ({ readGoogleWalletConfig }));
vi.mock("@/lib/member-pass/google-pass", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/member-pass/google-pass")>()),
  signGoogleSaveJwt,
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

import { GET } from "./route";

describe("GET /api/member-pass/google", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MEMBER_PASS_SECRET", "test-secret-that-is-at-least-32-characters-long");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://biso.no");
    readGoogleWalletConfig.mockReturnValue({ clientEmail: "e", issuerId: "3388", privateKey: "k" });
  });

  it("is 404 when Google Wallet is not configured", async () => {
    readGoogleWalletConfig.mockReturnValue(null);
    expect((await GET()).status).toBe(404);
  });

  it("is 403 for non-members", async () => {
    resolveMemberPass.mockResolvedValue({ state: "expired" });
    expect((await GET()).status).toBe(403);
  });

  it("redirects members to the save link", async () => {
    resolveMemberPass.mockResolvedValue({
      holder: { expiryDate: "2026-12-31", membershipName: "Semester", name: "M", startDate: "2026-07-01", term: null },
      state: "active",
      userId: "user-1",
    });
    const response = await GET();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://pay.google.com/gp/v/save/header.payload.sig");
    const input = signGoogleSaveJwt.mock.calls[0]?.[0];
    expect(input.origins).toEqual(["https://biso.no"]);
    expect(input.genericObject.rotatingBarcode.totpDetails.parameters[0].key).toMatch(/^[0-9a-f]{40}$/);
  });
});
```

Run (from `apps/web`): `bun x vitest run src/lib/member-pass/google-pass.test.ts src/app/api/member-pass/google` → FAIL.

- [ ] **Step 2: Implement `google-pass.ts`**

```ts
import "server-only";
import { createSign } from "node:crypto";
import { googleWalletCodePattern } from "@repo/shared/utils/member-pass";
import { WALLET_COLORS } from "./apple-pass";
import type { MemberPassHolder } from "./types";
import type { GoogleWalletConfig } from "./wallet-config";

const ID_UNSAFE_RE = /[^A-Za-z0-9._-]/g;
const TOTP_PERIOD_MS = "30000";
const TOTP_DIGITS = 6;

export function googleClassId(issuerId: string): string {
  return `${issuerId}.biso-membership`;
}

export function googleObjectId(issuerId: string, userId: string): string {
  return `${issuerId}.member-${userId.replace(ID_UNSAFE_RE, "_")}`;
}

function localized(value: string) {
  return { defaultValue: { language: "en-US", value } };
}

export function buildGoogleWalletObject(input: {
  holder: MemberPassHolder;
  issuerId: string;
  labels: { member: string; validUntil: string };
  logoUrl: string;
  termLabel: string;
  totpKeyHex: string;
  userId: string;
}): Record<string, unknown> {
  const { holder } = input;
  return {
    cardTitle: localized("BISO"),
    classId: googleClassId(input.issuerId),
    header: localized(holder.name),
    hexBackgroundColor: WALLET_COLORS.background,
    id: googleObjectId(input.issuerId, input.userId),
    logo: { sourceUri: { uri: input.logoUrl } },
    rotatingBarcode: {
      totpDetails: {
        algorithm: "TOTP_SHA1",
        parameters: [{ key: input.totpKeyHex, valueLength: TOTP_DIGITS }],
        periodMillis: TOTP_PERIOD_MS,
      },
      type: "QR_CODE",
      valuePattern: googleWalletCodePattern(input.userId),
    },
    state: "ACTIVE",
    subheader: localized(input.labels.member),
    textModulesData: [
      { body: input.termLabel, header: input.labels.member, id: "term" },
      { body: holder.expiryDate, header: input.labels.validUntil, id: "expiry" },
    ],
    // Display window only (whole days, UTC); the scanner's live Finago check
    // is what decides whether the pass is honoured.
    validTimeInterval: {
      end: { date: `${holder.expiryDate}T23:59:59Z` },
      start: { date: `${holder.startDate}T00:00:00Z` },
    },
  };
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/** A "Save to Google Wallet" JWT carrying the class and this member's object. */
export function signGoogleSaveJwt(input: {
  config: GoogleWalletConfig;
  genericObject: Record<string, unknown>;
  now: Date;
  origins: string[];
}): string {
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const payload = base64UrlJson({
    aud: "google",
    iat: Math.floor(input.now.getTime() / 1000),
    iss: input.config.clientEmail,
    origins: input.origins,
    payload: {
      genericClasses: [{ id: googleClassId(input.config.issuerId) }],
      genericObjects: [input.genericObject],
    },
    typ: "savetowallet",
  });
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(input.config.privateKey).toString("base64url");
  return `${header}.${payload}.${signature}`;
}
```

- [ ] **Step 3: Implement the route** `apps/web/src/app/api/member-pass/google/route.ts`

```ts
import {
  googleWalletTotpKeyHex,
  readMemberPassSecret,
} from "@repo/shared/utils/member-pass";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import {
  buildGoogleWalletObject,
  signGoogleSaveJwt,
} from "@/lib/member-pass/google-pass";
import { resolveMemberPass } from "@/lib/member-pass/resolve";
import { termLabel } from "@/lib/member-pass/term-label";
import { readGoogleWalletConfig } from "@/lib/member-pass/wallet-config";

const NO_STORE = { "Cache-Control": "private, no-store" };
const SAVE_URL = "https://pay.google.com/gp/v/save/";

function error(status: number, code: string) {
  return NextResponse.json({ error: code }, { headers: NO_STORE, status });
}

export async function GET() {
  const config = readGoogleWalletConfig();
  const secret = readMemberPassSecret();
  if (!(config && secret)) {
    return error(404, "not_configured");
  }
  const resolved = await resolveMemberPass();
  if (resolved.state === "unauthenticated") {
    return error(401, "not_authenticated");
  }
  if (resolved.state !== "active") {
    return error(403, resolved.state);
  }

  try {
    const t = await getTranslations("memberPass");
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://biso.no";
    const { holder, userId } = resolved;
    const jwt = signGoogleSaveJwt({
      config,
      genericObject: buildGoogleWalletObject({
        holder,
        issuerId: config.issuerId,
        labels: { member: t("member"), validUntil: t("walletLabels.validUntil") },
        logoUrl: `${baseUrl}/apple-touch-icon.png`,
        termLabel: termLabel(t, holder),
        totpKeyHex: googleWalletTotpKeyHex(userId, secret),
        userId,
      }),
      now: new Date(),
      origins: [baseUrl],
    });
    return NextResponse.redirect(`${SAVE_URL}${jwt}`, { headers: NO_STORE, status: 302 });
  } catch (cause) {
    console.error("[Member Pass] Google Wallet link failed:", cause);
    return error(500, "failed");
  }
}
```

- [ ] **Step 4: Run to verify they pass**

Run (from `apps/web`): `bun x vitest run src/lib/member-pass src/app/api/member-pass` → PASS.

- [ ] **Step 5: Type-check, commit**

```bash
bun run check-types --filter=web
bun x ultracite fix apps/web/src/lib/member-pass apps/web/src/app/api/member-pass
git add apps/web/src/lib/member-pass apps/web/src/app/api/member-pass
git commit -m "Offer the member pass in Google Wallet

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Manual check once credentials exist: in the Google Pay & Wallet Console confirm the issuer can use rotating barcodes on generic passes (request access if prompted; keep `GOOGLE_WALLET_*` unset until approved so the button stays hidden). Then on Android open `/api/member-pass/google` → save → the pass shows a changing QR; scanning it in admin shows green.

---
## Phase 5 — Retention

### Task 19: `POST /api/cron/cleanup-member-pass` (apps/api)

**Files:**
- Create: `apps/api/src/app/api/cron/cleanup-member-pass/route.ts`
- Test: `apps/api/src/app/api/cron/cleanup-member-pass/route.test.ts`

**Interfaces:**
- Consumes: `safeSecretCompare` (`@repo/shared/utils/secrets`), `createAdminClient`.
- Produces: `POST` → `200 { scansDeleted, linksDeleted }`; `401` wrong/missing secret; `500` when `CRON_SECRET` is unset. Deletes `member_pass_scans` with `$createdAt` older than 90 days and `member_pass_scanner_links` with `expires_at` older than 30 days, 100 rows per batch, at most 10 batches per table per run.

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const listRows = vi.hoisted(() => vi.fn());
const deleteRow = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: { deleteRow, listRows } })),
}));

import { POST } from "./route";

const SECRET = "cron-secret-value";
const request = (headers: Record<string, string> = {}) =>
  new Request("https://api.biso.no/api/cron/cleanup-member-pass", {
    headers,
    method: "POST",
  });

describe("POST /api/cron/cleanup-member-pass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T00:00:00Z"));
    vi.stubEnv("CRON_SECRET", SECRET);
    deleteRow.mockResolvedValue(undefined);
  });

  it("requires the cron secret", async () => {
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request({ "x-cron-secret": "wrong" }))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await POST(request({ "x-cron-secret": SECRET }))).status).toBe(500);
  });

  it("deletes old scans and long-expired links in batches", async () => {
    const batch = (prefix: string, count: number) => ({
      rows: Array.from({ length: count }, (_, i) => ({ $id: `${prefix}${i}` })),
      total: count,
    });
    listRows
      .mockResolvedValueOnce(batch("s", 100))
      .mockResolvedValueOnce(batch("s", 3))
      .mockResolvedValueOnce(batch("l", 2));

    const response = await POST(request({ authorization: `Bearer ${SECRET}` }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ linksDeleted: 2, scansDeleted: 103 });

    expect(JSON.stringify(listRows.mock.calls[0])).toContain("member_pass_scans");
    expect(JSON.stringify(listRows.mock.calls[0]?.[2])).toContain("2026-06-19T00:00:00.000Z");
    expect(JSON.stringify(listRows.mock.calls[2])).toContain("member_pass_scanner_links");
    expect(JSON.stringify(listRows.mock.calls[2]?.[2])).toContain("2026-08-18T00:00:00.000Z");
    expect(deleteRow).toHaveBeenCalledTimes(105);
  });

  it("stops after ten batches per table", async () => {
    listRows.mockResolvedValue({
      rows: Array.from({ length: 100 }, (_, i) => ({ $id: `x${i}` })),
      total: 100,
    });
    const body = await (await POST(request({ "x-cron-secret": SECRET }))).json();
    expect(body).toEqual({ linksDeleted: 1000, scansDeleted: 1000 });
  });
});
```

Date check: 2026-09-17 minus 90 days = 2026-06-19; minus 30 days = 2026-08-18.

Run (from `apps/api`): `NODE_ENV=test bun x vitest run src/app/api/cron/cleanup-member-pass` → FAIL.

- [ ] **Step 2: Implement the route**

```ts
import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { NextResponse } from "next/server";

/**
 * Member pass retention. Driven by the `scheduled-dispatch` Appwrite Function
 * (`MEMBER_PASS_CLEANUP_URL`), which sends `x-cron-secret`; can also be hit
 * manually with `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Deletes scan-log rows after 90 days and scanner links 30 days after they
 * expired. Bounded per run; the next run picks up whatever is left.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const SCAN_RETENTION_DAYS = 90;
const LINK_RETENTION_DAYS = 30;
const BATCH_SIZE = 100;
const MAX_BATCHES = 10;

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

function hasValidCronSecret(request: Request, secret: string): boolean {
  return [readBearerToken(request), request.headers.get("x-cron-secret")].some(
    (candidate) => safeSecretCompare(candidate, secret)
  );
}

async function deleteOlderThan(
  db: AdminDb,
  table: string,
  column: string,
  cutoff: Date
): Promise<number> {
  let deleted = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const { rows } = await db.listRows("app", table, [
      Query.lessThan(column, cutoff.toISOString()),
      Query.limit(BATCH_SIZE),
      Query.select(["$id"]),
    ]);
    for (const row of rows) {
      await db.deleteRow("app", table, row.$id);
      deleted += 1;
    }
    if (rows.length < BATCH_SIZE) {
      break;
    }
  }
  return deleted;
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[Member Pass Cleanup] CRON_SECRET is not configured");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }
  if (!hasValidCronSecret(request, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const { db } = await createAdminClient();
  const scansDeleted = await deleteOlderThan(
    db,
    "member_pass_scans",
    "$createdAt",
    new Date(now - SCAN_RETENTION_DAYS * DAY_MS)
  );
  const linksDeleted = await deleteOlderThan(
    db,
    "member_pass_scanner_links",
    "expires_at",
    new Date(now - LINK_RETENTION_DAYS * DAY_MS)
  );

  console.log(
    `[Member Pass Cleanup] Deleted ${scansDeleted} scans and ${linksDeleted} links`
  );
  return NextResponse.json({ linksDeleted, scansDeleted });
}
```

Check how `reconcile-orders` behaves outside production when `CRON_SECRET` is unset (the web cron allows unauthenticated local calls); this route deliberately always requires it, matching the test.

- [ ] **Step 3: Run to verify it passes**

Run (from `apps/api`): `NODE_ENV=test bun x vitest run src/app/api/cron/cleanup-member-pass` → PASS.

- [ ] **Step 4: Type-check, commit**

```bash
bun run check-types --filter=api
bun x ultracite fix apps/api/src/app/api/cron/cleanup-member-pass
git add apps/api/src/app/api/cron/cleanup-member-pass
git commit -m "Prune old member pass scans and scanner links

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

### Task 20: Drive the cleanup from `scheduled-dispatch`

**Files:**
- Modify: `functions/scheduled-dispatch/src/main.ts` (doc comment list + `TARGET_ENV_VARS`)
- Modify: `functions/scheduled-dispatch/README.md` (targets table, variables list, secret-model table)
- Modify: `functions/scheduled-dispatch/.env.example`

- [ ] **Step 1: `main.ts`**

In the header comment's list of URL variables, after `EXPENSES_POST_PENDING_URL`, add:

```
 *   MEMBER_PASS_CLEANUP_URL     e.g. https://api.biso.no/api/cron/cleanup-member-pass
```

Append `"MEMBER_PASS_CLEANUP_URL",` as the last entry of `TARGET_ENV_VARS`.

- [ ] **Step 2: `README.md`**

Add a row to the "It currently drives" table:

```
| `MEMBER_PASS_CLEANUP_URL` (optional) | deletes member pass scan logs older than 90 days and scanner links expired more than 30 days ago | `apps/api` → `POST /api/cron/cleanup-member-pass` |
```

Add `MEMBER_PASS_CLEANUP_URL` to the optional variables bullet list, and a row `| \`cleanup-member-pass\` (api) | \`CRON_SECRET\` |` to the secret-model table.

- [ ] **Step 3: `.env.example`** — append before the `CRON_TIMEOUT_MS` block:

```bash
# Deletes old member pass scan logs and expired scanner links (apps/api).
# Authorizes with CRON_SECRET (same value as above) set on apps/api.
# MEMBER_PASS_CLEANUP_URL=https://api.biso.no/api/cron/cleanup-member-pass
```

- [ ] **Step 4: Verify and commit**

```bash
cd functions/scheduled-dispatch && bun run check-types && cd ../..
git add functions/scheduled-dispatch
git commit -m "Dispatch the member pass cleanup on schedule

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

After merge, the user sets `MEMBER_PASS_CLEANUP_URL` on the function in the Appwrite console (prerequisite 5).

---

## Phase 6 — Wrap-up

### Task 21: Regenerated types and end-to-end verification

**Files:**
- Modify (only after the user has created the tables and regenerated `packages/api/types/appwrite.ts`): `apps/admin/src/lib/member-pass/types.ts`

- [ ] **Step 1: Swap in generated row types (if available)**

If `packages/api/types/appwrite.ts` now exports types for `member_pass_scans` and `member_pass_scanner_links`, replace the local `MemberPassScanRow` / `ScannerLinkRow` interface bodies with aliases to the generated types (keep the exported names so nothing else changes), and remove the "local row types" comment. If not yet regenerated, skip this step and leave a note in the PR description.

- [ ] **Step 2: Full checks**

```bash
bun run check-types
bun run lint
(cd packages/shared && bun x vitest run)
(cd apps/web && bun x vitest run)
(cd apps/api && NODE_ENV=test bun x vitest run)
(cd apps/admin && bun test ./src)
(cd functions/scheduled-dispatch && bun run check-types)
```

Expected: all green. Report any failure with its output; do not claim completion otherwise.

- [ ] **Step 3: End-to-end walkthrough (deployed preview or local with the real Appwrite project)**

1. Linked member with the fall 2026 category: `/profile` and `/member` show the pass, "Fall 2026", valid until 31 Dec 2026; the QR changes every 30 s; the day color matches the admin scanner's top bar.
2. Admin `/members/scan`: scan → green with name; scan again → orange; screenshot from 2+ minutes ago → red "Old code".
3. Remove the Finago category, call `/api/membership?refresh=true` as the member, wait ≥ 60 s (scanner cache) → scan → red "Not a member"; the pass shows "No active membership" after reload.
4. Guest link: create, open in a private window, scan → green; revoke → next scan errors.
5. Wallets (only if credentials are configured): add to Apple Wallet → amber on scan; add to Google Wallet → green on scan.
6. `curl -X POST https://<api-host>/api/cron/cleanup-member-pass -H "x-cron-secret: $CRON_SECRET"` → `200 {"linksDeleted":…, "scansDeleted":…}`.

- [ ] **Step 4: Commit (if Step 1 changed anything)**

```bash
git add apps/admin/src/lib/member-pass/types.ts
git commit -m "Use generated row types for member pass tables

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Then use superpowers:finishing-a-development-branch.
