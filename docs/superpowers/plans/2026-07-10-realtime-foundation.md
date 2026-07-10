# Realtime Foundation + Live Admin Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a shared Appwrite Realtime module in `@repo/api` and use it to make the admin inbox live: sidebar badge, approvals/submissions lists, and toasts update in real time.

**Architecture:** Approach A ("realtime as refetch signal") per the approved spec at `docs/superpowers/specs/2026-07-10-realtime-foundation-design.md`. A client-only `@repo/api/realtime` module wraps the `appwrite@26.x` `Realtime` class (singleton over the existing `clientSideClient`). An admin server action bridges the httpOnly session cookie to the browser client. An `InboxRealtimeProvider` in the portal layout subscribes to `approval_requests` + `form_submissions` row events; events trigger a debounced re-run of the existing `getInboxCounts()` server action (badge via context) and `router.refresh()` on inbox pages. Payloads are used only for toasts.

**Tech Stack:** Bun 1.3.1 workspaces, Next.js 16 App Router (RSC + server actions), `appwrite@26.1.0` (browser SDK), sonner (toasts), next-intl, vitest (`packages/api`), `bun:test` (admin pure logic).

## Global Constraints

- Package manager is **Bun only** — never npm/pnpm. Workspace deps use `catalog:`.
- All Appwrite access goes through `@repo/api`; app code never imports `appwrite`/`node-appwrite` directly.
- `"use server"` files may export **only async functions** (type exports OK). `bun run check-types` does NOT catch violations — only `bun run build --filter=admin` does. Run the build after touching any server-action file.
- Run `bun x ultracite fix` before every commit (lefthook enforces it).
- Commits are authored as the repo owner (MHeien, default git config). **No Co-Authored-By trailers.**
- Admin session cookie: httpOnly, name from `process.env.APPWRITE_SESSION_COOKIE` (admin sets `a_session_biso_admin`). Never log its value.
- Database id is `app`. Tables: `approval_requests`, `form_submissions`.
- Toast strings must exist in **both** `packages/i18n/messages/en/adminPortal.json` and `packages/i18n/messages/no/adminPortal.json`.
- Graceful degradation: if the WebSocket cannot connect, behavior must equal today's (server-rendered counts). No user-facing errors; at most one `console.warn`.

---

### Task 1: `@repo/api/realtime` module

**Files:**
- Create: `packages/api/realtime.ts`
- Create: `packages/api/realtime.test.ts`
- Modify: `packages/api/package.json` (add `"./realtime"` export)

**Interfaces:**
- Consumes: `clientSideClient` from `packages/api/client.ts`; `Realtime`, `Channel` from `appwrite`.
- Produces (used by Task 4):
  - `setRealtimeSession(secret: string): void`
  - `getRealtime(): Realtime`
  - `tableRowsChannel(databaseId: string, tableId: string): string`
  - `useRealtimeChannels(options: { channels: string[]; enabled?: boolean; onEvent: (event: RealtimeResponseEvent<Record<string, unknown>>) => void }): void`
  - `manageRealtimeSubscription(realtime: RealtimeLike, channels: string[], onEvent, onError?): RealtimeSubscriptionHandle` (exported for tests)
  - Re-exports: `Channel` (runtime), `RealtimeResponseEvent` (type)

- [ ] **Step 1: Write the failing test**

Create `packages/api/realtime.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  manageRealtimeSubscription,
  type RealtimeLike,
  type RealtimeResponseEvent,
} from "./realtime";

type Subscription = Awaited<ReturnType<RealtimeLike["subscribe"]>>;
type RowEvent = RealtimeResponseEvent<Record<string, unknown>>;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createFakeRealtime() {
  const calls: { channels: string[] }[] = [];
  const unsubscribeCalls: number[] = [];
  const updateCalls: { channels?: string[] }[] = [];
  const deferred = createDeferred<Subscription>();
  let capturedCallback: ((event: RowEvent) => void) | null = null;

  const subscription: Subscription = {
    unsubscribe: () => {
      unsubscribeCalls.push(Date.now());
      return Promise.resolve();
    },
    update: (changes: { channels?: string[] }) => {
      updateCalls.push(changes);
      return Promise.resolve();
    },
  };

  const realtime: RealtimeLike = {
    subscribe: (channels, callback) => {
      calls.push({ channels: [...channels] });
      capturedCallback = callback;
      return deferred.promise;
    },
  };

  return {
    calls,
    deferred,
    // Fills the RealtimeResponseEvent fields tests don't care about.
    emit: (event: Pick<RowEvent, "events" | "channels" | "payload">) =>
      capturedCallback?.({ ...event, subscriptions: [], timestamp: "" }),
    realtime,
    subscription,
    unsubscribeCalls,
    updateCalls,
  };
}

describe("manageRealtimeSubscription", () => {
  it("subscribes with the given channels and forwards events", async () => {
    const fake = createFakeRealtime();
    const received: unknown[] = [];
    manageRealtimeSubscription(fake.realtime, ["ch.a", "ch.b"], (event) =>
      received.push(event)
    );

    expect(fake.calls).toEqual([{ channels: ["ch.a", "ch.b"] }]);

    fake.deferred.resolve(fake.subscription);
    await fake.deferred.promise;
    fake.emit({ events: ["x.create"], channels: ["ch.a"], payload: { id: 1 } });

    expect(received).toHaveLength(1);
  });

  it("unsubscribes on dispose after subscribe resolves", async () => {
    const fake = createFakeRealtime();
    const handle = manageRealtimeSubscription(fake.realtime, ["ch.a"], () => {
      /* noop */
    });
    fake.deferred.resolve(fake.subscription);
    await fake.deferred.promise;

    handle.dispose();

    expect(fake.unsubscribeCalls).toHaveLength(1);
  });

  it("unsubscribes when disposed before subscribe resolves and drops events", async () => {
    const fake = createFakeRealtime();
    const received: unknown[] = [];
    const handle = manageRealtimeSubscription(fake.realtime, ["ch.a"], (event) =>
      received.push(event)
    );

    handle.dispose();
    fake.deferred.resolve(fake.subscription);
    // allow the .then chain inside the manager to run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fake.unsubscribeCalls).toHaveLength(1);
    fake.emit({ events: ["x.create"], channels: ["ch.a"], payload: {} });
    expect(received).toHaveLength(0);
  });

  it("reports subscribe failures through onError", async () => {
    const fake = createFakeRealtime();
    const errors: unknown[] = [];
    manageRealtimeSubscription(
      fake.realtime,
      ["ch.a"],
      () => {
        /* noop */
      },
      (error) => errors.push(error)
    );

    fake.deferred.reject(new Error("boom"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(errors).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/heien/Documents/Dev/BISO-Sites/packages/api && bun run test -- realtime.test.ts`
Expected: FAIL — `realtime.ts` does not exist / `manageRealtimeSubscription` not exported.

- [ ] **Step 3: Write the implementation**

Create `packages/api/realtime.ts`:

```ts
"use client";

import type { RealtimeResponseEvent } from "appwrite";
import { Channel, Realtime } from "appwrite";
import { useEffect, useRef } from "react";
import { clientSideClient } from "./client";

// Re-exports so app code never imports `appwrite` directly.
export { Channel } from "appwrite";
export type { RealtimeResponseEvent } from "appwrite";

/**
 * Structural subset of the SDK `Realtime` class used by the subscription
 * manager. Lets unit tests inject a fake without a WebSocket.
 */
export interface RealtimeLike {
  subscribe(
    channels: string[],
    callback: (event: RealtimeResponseEvent<Record<string, unknown>>) => void
  ): Promise<{
    unsubscribe: () => Promise<void>;
    update: (changes: { channels?: string[] }) => Promise<void>;
  }>;
}

export interface RealtimeSubscriptionHandle {
  dispose: () => void;
}

let currentSessionSecret: string | null = null;

/**
 * Authenticate the shared browser client for realtime. Idempotent — safe to
 * call on every provider mount. Required whenever the Appwrite session is not
 * available under the standard `a_session_<project>` cookie name (admin's
 * custom httpOnly cookie, and all localhost dev).
 */
export function setRealtimeSession(secret: string): void {
  if (!secret || secret === currentSessionSecret) {
    return;
  }
  currentSessionSecret = secret;
  clientSideClient.setSession(secret);
}

let realtimeInstance: Realtime | null = null;

/** Lazy singleton — one WebSocket per tab, shared by all subscriptions. */
export function getRealtime(): Realtime {
  if (!realtimeInstance) {
    realtimeInstance = new Realtime(clientSideClient);
  }
  return realtimeInstance;
}

/** Channel string for all row events of one table, e.g. shop orders. */
export function tableRowsChannel(databaseId: string, tableId: string): string {
  return Channel.tablesdb(databaseId).table(tableId).row().toString();
}

/**
 * Subscription lifecycle manager. Handles the async subscribe/dispose race:
 * disposing before the subscribe promise settles must still tear down the
 * server-side subscription and stop event delivery.
 */
export function manageRealtimeSubscription(
  realtime: RealtimeLike,
  channels: string[],
  onEvent: (event: RealtimeResponseEvent<Record<string, unknown>>) => void,
  onError?: (error: unknown) => void
): RealtimeSubscriptionHandle {
  let disposed = false;
  let active: Awaited<ReturnType<RealtimeLike["subscribe"]>> | null = null;

  realtime
    .subscribe(channels, (event) => {
      if (!disposed) {
        onEvent(event);
      }
    })
    .then((subscription) => {
      if (disposed) {
        subscription.unsubscribe().catch(() => {
          /* connection already gone — nothing to clean up */
        });
        return;
      }
      active = subscription;
    })
    .catch((error) => {
      if (!disposed) {
        onError?.(error);
      }
    });

  return {
    dispose: () => {
      disposed = true;
      active?.unsubscribe().catch(() => {
        /* connection already gone — nothing to clean up */
      });
      active = null;
    },
  };
}

/**
 * Subscribe to realtime channels for the lifetime of the component.
 * `onEvent` identity changes never resubscribe (kept in a ref); channel
 * array contents are compared by value.
 */
export function useRealtimeChannels(options: {
  channels: string[];
  enabled?: boolean;
  onEvent: (event: RealtimeResponseEvent<Record<string, unknown>>) => void;
}): void {
  const { channels, enabled = true, onEvent } = options;
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const channelsKey = channels.join("|");

  useEffect(() => {
    if (!enabled || channelsKey.length === 0) {
      return;
    }
    const handle = manageRealtimeSubscription(
      getRealtime(),
      channelsKey.split("|"),
      (event) => onEventRef.current(event),
      (error) => {
        // Degrade silently to request/response behavior (spec §4).
        console.warn("[realtime] subscription failed", error);
      }
    );
    return () => handle.dispose();
  }, [channelsKey, enabled]);
}
```

- [ ] **Step 4: Add the package export**

In `packages/api/package.json`, add to the `exports` map after the `"./client"` line:

```json
    "./client": "./client.ts",
    "./realtime": "./realtime.ts",
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/heien/Documents/Dev/BISO-Sites/packages/api && bun run test -- realtime.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Type-check the package**

Run: `cd /Users/heien/Documents/Dev/BISO-Sites && bun run check-types --filter=@repo/api`
Expected: exit 0. If `RealtimeResponseEvent` or `Channel` fail to import from `appwrite`, check `node_modules/.bun/appwrite@26.1.0/node_modules/appwrite/types/index.d.ts` for the exact export names and adjust the import — do not loosen types to `any`.

- [ ] **Step 7: Commit**

```bash
cd /Users/heien/Documents/Dev/BISO-Sites
bun x ultracite fix packages/api/realtime.ts packages/api/realtime.test.ts
git add packages/api/realtime.ts packages/api/realtime.test.ts packages/api/package.json
git commit -m "Add @repo/api/realtime: shared Appwrite realtime module"
```

---

### Task 2: Mount sonner `<Toaster>` in admin (pre-existing bug fix)

Many admin components call `toast(...)` from sonner, but **no `<Toaster>` is mounted anywhere in the app** — every toast is currently a silent no-op. Task 4's toasts need this, and it fixes all existing call sites.

**Files:**
- Modify: `apps/admin/src/app/providers.tsx`

**Interfaces:**
- Produces: a mounted sonner `<Toaster>` — `toast(...)` calls anywhere in admin render.

- [ ] **Step 1: Add the Toaster**

Replace the full contents of `apps/admin/src/app/providers.tsx` with:

```tsx
"use client";
import { ThemeProvider } from "@repo/ui/components/theme-provider";
import { TooltipProvider } from "@repo/ui/components/ui/tooltip";
import { Toaster } from "sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        {children}
        <Toaster closeButton position="top-right" richColors />
      </TooltipProvider>
    </ThemeProvider>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/heien/Documents/Dev/BISO-Sites && bun --filter=admin check-types`
Expected: exit 0. (`sonner` is already a direct dependency of `apps/admin` — `apps/admin/package.json:42`.)

- [ ] **Step 3: Commit**

```bash
cd /Users/heien/Documents/Dev/BISO-Sites
bun x ultracite fix apps/admin/src/app/providers.tsx
git add apps/admin/src/app/providers.tsx
git commit -m "Fix: mount sonner Toaster in admin — toasts were silent no-ops"
```

---

### Task 3: Event helpers + admin session bridge

**Files:**
- Create: `apps/admin/src/lib/inbox-realtime.ts` (pure helpers, plain module)
- Create: `apps/admin/src/lib/inbox-realtime.test.ts` (bun:test)
- Create: `apps/admin/src/app/(portal)/_actions/realtime.ts` (server action)

**Interfaces:**
- Consumes: `getUserAuthContext()` from `@/lib/authorization` (returns `UserAuthContext | null`); `cookies()` from `next/headers`.
- Produces (used by Task 4):
  - `isCreateEvent(events: string[]): boolean`
  - `eventTouchesTable(events: string[], tableId: string): boolean`
  - `shouldNotifyForCampus(payloadCampusId: string | null, activeCampusId: string | null): boolean`
  - `getRealtimeSessionSecret(): Promise<string | null>` (server action)

- [ ] **Step 1: Write the failing tests**

Create `apps/admin/src/lib/inbox-realtime.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import {
  eventTouchesTable,
  isCreateEvent,
  shouldNotifyForCampus,
} from "./inbox-realtime";

describe("isCreateEvent", () => {
  it("detects create events", () => {
    expect(
      isCreateEvent([
        "databases.app.tables.approval_requests.rows.abc.create",
      ])
    ).toBe(true);
  });

  it("rejects update/delete events", () => {
    expect(
      isCreateEvent(["databases.app.tables.approval_requests.rows.abc.update"])
    ).toBe(false);
  });
});

describe("eventTouchesTable", () => {
  it("matches the table segment exactly", () => {
    const events = ["databases.app.tables.approval_requests.rows.abc.create"];
    expect(eventTouchesTable(events, "approval_requests")).toBe(true);
    expect(eventTouchesTable(events, "form_submissions")).toBe(false);
  });
});

describe("shouldNotifyForCampus", () => {
  it("notifies when no campus filter is active", () => {
    expect(shouldNotifyForCampus("1", null)).toBe(true);
  });

  it("notifies when the payload has no campus", () => {
    expect(shouldNotifyForCampus(null, "1")).toBe(true);
  });

  it("notifies on matching campus and suppresses on mismatch", () => {
    expect(shouldNotifyForCampus("1", "1")).toBe(true);
    expect(shouldNotifyForCampus("2", "1")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/heien/Documents/Dev/BISO-Sites && bun test apps/admin/src/lib/inbox-realtime.test.ts`
Expected: FAIL — module `./inbox-realtime` not found.

- [ ] **Step 3: Implement the helpers**

Create `apps/admin/src/lib/inbox-realtime.ts`:

```ts
/**
 * Pure helpers for the inbox realtime provider. Plain module (NOT
 * "use server") so it can export sync functions and constants.
 */

export function isCreateEvent(events: string[]): boolean {
  return events.some((event) => event.endsWith(".create"));
}

export function eventTouchesTable(events: string[], tableId: string): boolean {
  const marker = `.tables.${tableId}.`;
  return events.some((event) => event.includes(marker));
}

/**
 * Cosmetic toast filter for globaladmins scoped to a campus. Counts are
 * always server-computed; this only suppresses irrelevant toasts.
 */
export function shouldNotifyForCampus(
  payloadCampusId: string | null,
  activeCampusId: string | null
): boolean {
  if (!(payloadCampusId && activeCampusId)) {
    return true;
  }
  return payloadCampusId === activeCampusId;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/heien/Documents/Dev/BISO-Sites && bun test apps/admin/src/lib/inbox-realtime.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Implement the session-bridge server action**

Create `apps/admin/src/app/(portal)/_actions/realtime.ts`:

```ts
"use server";

import { cookies } from "next/headers";
import { getUserAuthContext } from "@/lib/authorization";

/**
 * Hand the Appwrite session secret to the browser so the realtime WebSocket
 * can authenticate (the admin cookie is httpOnly with a custom name, so the
 * SDK cannot pick it up itself — spec §2).
 *
 * The secret already lives in the caller's own browser cookie; this only
 * makes it visible to first-party JS, behind the same auth gate. Never log
 * the returned value.
 */
export async function getRealtimeSessionSecret(): Promise<string | null> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return null;
  }
  const cookieStore = await cookies();
  const cookieName =
    process.env.APPWRITE_SESSION_COOKIE || "a_session_biso_admin";
  return cookieStore.get(cookieName)?.value ?? null;
}
```

- [ ] **Step 6: Verify the server action compiles as a real build**

Run: `cd /Users/heien/Documents/Dev/BISO-Sites && bun run build --filter=admin`
Expected: `✓ Compiled` (this is the only gate that enforces the async-only-exports rule). If stale `* 2.*` duplicate artifacts break the build, run `find apps -path '*/.next/*' -name '* [0-9].*' -delete` and retry.

- [ ] **Step 7: Commit**

```bash
cd /Users/heien/Documents/Dev/BISO-Sites
bun x ultracite fix apps/admin/src/lib/inbox-realtime.ts apps/admin/src/lib/inbox-realtime.test.ts "apps/admin/src/app/(portal)/_actions/realtime.ts"
git add apps/admin/src/lib/inbox-realtime.ts apps/admin/src/lib/inbox-realtime.test.ts "apps/admin/src/app/(portal)/_actions/realtime.ts"
git commit -m "Add inbox realtime helpers and session-bridge server action"
```

---

### Task 4: InboxRealtimeProvider + live badge + toasts + i18n

**Files:**
- Create: `apps/admin/src/app/(portal)/_components/inbox-realtime-provider.tsx`
- Modify: `apps/admin/src/app/(portal)/layout.tsx`
- Modify: `apps/admin/src/app/(portal)/sidebar.tsx` (line ~150 badge)
- Modify: `packages/i18n/messages/en/adminPortal.json`
- Modify: `packages/i18n/messages/no/adminPortal.json`

**Interfaces:**
- Consumes (from Tasks 1+3): `setRealtimeSession`, `getRealtime`, `tableRowsChannel`, `useRealtimeChannels`, `RealtimeResponseEvent` from `@repo/api/realtime`; `isCreateEvent`, `eventTouchesTable`, `shouldNotifyForCampus` from `@/lib/inbox-realtime`; `getRealtimeSessionSecret` from `../_actions/realtime`; `getInboxCounts`, `InboxCounts` from `../_actions/inbox`.
- Produces: `InboxRealtimeProvider` component; `useInboxCounts(): InboxCounts | null` hook (consumed by `sidebar.tsx`).

- [ ] **Step 1: Add i18n strings**

In `packages/i18n/messages/en/adminPortal.json`, add a top-level key (alongside `"nav"`, `"sidebar"`, …):

```json
  "inboxRealtime": {
    "newApproval": "New approval request from {email}",
    "newSubmission": "New form submission received",
    "open": "Open"
  }
```

In `packages/i18n/messages/no/adminPortal.json`, add:

```json
  "inboxRealtime": {
    "newApproval": "Ny godkjenningsforespørsel fra {email}",
    "newSubmission": "Nytt skjemasvar mottatt",
    "open": "Åpne"
  }
```

- [ ] **Step 2: Create the provider**

Create `apps/admin/src/app/(portal)/_components/inbox-realtime-provider.tsx`:

```tsx
"use client";

import type { RealtimeResponseEvent } from "@repo/api/realtime";
import {
  getRealtime,
  setRealtimeSession,
  tableRowsChannel,
  useRealtimeChannels,
} from "@repo/api/realtime";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  eventTouchesTable,
  isCreateEvent,
  shouldNotifyForCampus,
} from "@/lib/inbox-realtime";
import type { InboxCounts } from "../_actions/inbox";
import { getInboxCounts } from "../_actions/inbox";
import { getRealtimeSessionSecret } from "../_actions/realtime";

const REFRESH_DEBOUNCE_MS = 500;
const APPROVALS_TABLE = "approval_requests";
const SUBMISSIONS_TABLE = "form_submissions";
const CHANNELS = [
  tableRowsChannel("app", APPROVALS_TABLE),
  tableRowsChannel("app", SUBMISSIONS_TABLE),
];

const InboxCountsContext = createContext<InboxCounts | null>(null);

export function useInboxCounts(): InboxCounts | null {
  return useContext(InboxCountsContext);
}

interface InboxRealtimeProviderProps {
  activeCampusId: string | null;
  children: React.ReactNode;
  initialCounts: InboxCounts;
  isApprover: boolean;
}

export function InboxRealtimeProvider({
  activeCampusId,
  children,
  initialCounts,
  isApprover,
}: InboxRealtimeProviderProps) {
  const t = useTranslations("adminPortal.inboxRealtime");
  const router = useRouter();
  const pathname = usePathname();
  const [counts, setCounts] = useState<InboxCounts>(initialCounts);
  const [sessionReady, setSessionReady] = useState(false);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Collapse event bursts into one refetch; lists on /inbox/* re-render via
  // router.refresh() so all campus/role scoping stays server-side (spec §3).
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) {
      return;
    }
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      getInboxCounts()
        .then(setCounts)
        .catch(() => {
          /* keep last known counts */
        });
      if (pathnameRef.current?.startsWith("/inbox")) {
        router.refresh();
      }
    }, REFRESH_DEBOUNCE_MS);
  }, [router]);

  // Session bridge: authenticate the shared browser client once per mount.
  useEffect(() => {
    if (!isApprover) {
      return;
    }
    let cancelled = false;
    getRealtimeSessionSecret()
      .then((secret) => {
        if (cancelled || !secret) {
          return;
        }
        setRealtimeSession(secret);
        setSessionReady(true);
      })
      .catch(() => {
        /* no session -> no socket; page behaves as before */
      });
    return () => {
      cancelled = true;
    };
  }, [isApprover]);

  // Cover event gaps: refetch once on socket (re)open and when the tab
  // returns to the foreground. onOpen has no unregister; the debounce makes
  // duplicate registrations (StrictMode) harmless.
  useEffect(() => {
    if (!sessionReady) {
      return;
    }
    getRealtime().onOpen(scheduleRefresh);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        scheduleRefresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [sessionReady, scheduleRefresh]);

  const handleEvent = useCallback(
    (event: RealtimeResponseEvent<Record<string, unknown>>) => {
      scheduleRefresh();
      if (!isCreateEvent(event.events)) {
        return;
      }
      const payload = event.payload;
      const payloadCampusId =
        typeof payload.campus_id === "string" ? payload.campus_id : null;
      if (!shouldNotifyForCampus(payloadCampusId, activeCampusId)) {
        return;
      }
      const isApproval = eventTouchesTable(event.events, APPROVALS_TABLE);
      const message = isApproval
        ? t("newApproval", {
            email:
              typeof payload.requester_email === "string"
                ? payload.requester_email
                : "",
          })
        : t("newSubmission");
      const target = isApproval ? "/inbox/approvals" : "/inbox/submissions";
      toast(message, {
        action: { label: t("open"), onClick: () => router.push(target) },
      });
    },
    [activeCampusId, router, scheduleRefresh, t]
  );

  useRealtimeChannels({
    channels: CHANNELS,
    enabled: isApprover && sessionReady,
    onEvent: handleEvent,
  });

  return (
    <InboxCountsContext.Provider value={counts}>
      {children}
    </InboxCountsContext.Provider>
  );
}
```

- [ ] **Step 3: Wire the provider into the portal layout**

In `apps/admin/src/app/(portal)/layout.tsx`, add the import:

```tsx
import { InboxRealtimeProvider } from "./_components/inbox-realtime-provider";
```

and replace the return statement:

```tsx
  return (
    <InboxRealtimeProvider
      activeCampusId={ctx.activeCampusId ?? null}
      initialCounts={inboxCounts}
      isApprover={roles.isGlobalAdmin || roles.isCampusAdmin}
    >
      <AdminShell
        aiCopilotEnabled={aiCopilotEnabled}
        inboxCount={inboxCounts.total}
        roles={roles}
        user={user}
      >
        {children}
      </AdminShell>
    </InboxRealtimeProvider>
  );
```

Note: `roles` comes from `getUserRolesForClient()`; confirm the flag names are `isGlobalAdmin`/`isCampusAdmin` in `src/lib/authorization.ts` (`UserRolesForClient`) — they are used the same way in `getRoleLabel` in this file.

- [ ] **Step 4: Make the sidebar badge live**

In `apps/admin/src/app/(portal)/sidebar.tsx`:

Add the import:

```tsx
import { useInboxCounts } from "./_components/inbox-realtime-provider";
```

Inside the `Sidebar` component body (it is already `"use client"`), read the context near the top:

```tsx
  const liveCounts = useInboxCounts();
  const liveInboxCount = liveCounts?.total ?? inboxCount;
```

Then change the badge line (~line 150):

```tsx
              badge={node.path === "/inbox" ? inboxCount : undefined}
```

to:

```tsx
              badge={node.path === "/inbox" ? liveInboxCount : undefined}
```

- [ ] **Step 5: Type-check and build**

Run: `cd /Users/heien/Documents/Dev/BISO-Sites && bun --filter=admin check-types && bun run build --filter=admin`
Expected: both exit 0.

Contingency: `getInboxCounts` is `cache()`-wrapped in a `"use server"` file and has so far only been called from server components. If the build rejects it as a client-callable action (error mentioning "Server Actions must be async functions" for the `cache(...)` export), do NOT unwrap it — add a plain async pass-through action to `apps/admin/src/app/(portal)/_actions/realtime.ts` instead and call that from the provider:

```ts
export async function fetchInboxCounts(): Promise<InboxCounts> {
  return await getInboxCounts();
}
```

(import `getInboxCounts` and `type InboxCounts` from `./inbox` at the top of the file).

- [ ] **Step 6: Commit**

```bash
cd /Users/heien/Documents/Dev/BISO-Sites
bun x ultracite fix "apps/admin/src/app/(portal)/_components/inbox-realtime-provider.tsx" "apps/admin/src/app/(portal)/layout.tsx" "apps/admin/src/app/(portal)/sidebar.tsx"
git add "apps/admin/src/app/(portal)/_components/inbox-realtime-provider.tsx" "apps/admin/src/app/(portal)/layout.tsx" "apps/admin/src/app/(portal)/sidebar.tsx" packages/i18n/messages/en/adminPortal.json packages/i18n/messages/no/adminPortal.json
git commit -m "Make admin inbox live: realtime badge, list refresh, toasts"
```

---

### Task 5: Full verification pass

**Files:** none created — gates only.

- [ ] **Step 1: Repo-wide gates**

```bash
cd /Users/heien/Documents/Dev/BISO-Sites
bun run check-types
bun run lint --filter=admin --filter=@repo/api
bun run test --filter=@repo/api
bun test apps/admin/src/lib/inbox-realtime.test.ts
bun run build --filter=admin
```

Expected: all exit 0. (If stale `* 2.*` duplicates in `.next` break tsc: `find apps -path '*/.next/*' -name '* [0-9].*' -delete`.)

- [ ] **Step 2: Manual smoke (requires user/owner)**

1. `bun run dev --filter=admin`, log in at `http://localhost:3001` as an approver (globaladmin/campusadmin).
2. DevTools → Network → WS: confirm a WebSocket to `appwrite.biso.no/v1/realtime` is open and receives a `connected` message followed by an `authentication` exchange (session bridge working on localhost).
3. In a second browser/session, create an approval request (e.g. via the AI assistant approval flow or a department-user action that routes to approvals).
4. In the first session, within ~1s: sidebar badge increments, a toast appears; on `/inbox/approvals` the new card appears without manual reload.
5. Confirm graceful degradation: block the WS (DevTools offline for the socket / kill network briefly) — no errors surface, page still works; on reconnect the badge refreshes.

- [ ] **Step 3: Report results**

Report gate output + smoke results honestly. If the WS upgrade fails against `appwrite.biso.no`, flag the infra prerequisite from the spec (proxy must pass `/v1/realtime` upgrades) — that is an owner action, not a code fix.
