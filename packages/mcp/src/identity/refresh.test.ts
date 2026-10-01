/**
 * Keeping the principal current.
 *
 * The roles this package authorizes against come from team memberships read at
 * startup. A mutation is then executed through the service-key client, so
 * Appwrite never sees the caller's identity on the write and cannot apply a
 * revocation itself — the application-side check is the only one, and a stale
 * one authorizes work the organisation has already withdrawn.
 */

import { describe, expect, test } from "bun:test";
import { createFakeBackend, GLOBAL_ADMIN, MEMBER_ONLY } from "../testing/index";
import type { Principal } from "./principal";
import { createPrincipalCache, PRINCIPAL_TTL_MS } from "./refresh";

const SILENT = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => SILENT,
} as never;

/**
 * A backend whose account/teams calls answer as a chosen principal, so a
 * revocation can be simulated by swapping what they answer.
 */
function backendFor(teams: () => string[]) {
  const backend = createFakeBackend({ tables: {} });
  return {
    ...backend,
    hasUserCredential: true,
    user: {
      ...backend.user,
      account: { get: () => Promise.resolve({ $id: "u-1", email: "a@b.no" }) },
      teams: {
        list: () =>
          Promise.resolve({
            teams: teams().map((name) => ({ $id: name, name })),
          }),
      },
    },
  } as never;
}

describe("principal refresh", () => {
  test("an injected principal is never re-resolved", async () => {
    // The override is a caller-supplied identity. Re-resolving it would
    // silently replace it with a different one.
    const cache = createPrincipalCache({
      clients: backendFor(() => []),
      initial: GLOBAL_ADMIN(),
      logger: SILENT,
      fixed: true,
    });

    const refreshed = await cache.refresh({ force: true });

    expect(refreshed.roles).toContain("globaladmin");
  });

  test("a read reuses the cached principal inside the TTL", async () => {
    let calls = 0;
    const cache = createPrincipalCache({
      clients: backendFor(() => {
        calls += 1;
        return [];
      }),
      initial: MEMBER_ONLY(),
      logger: SILENT,
      now: () => 1000,
    });

    await cache.refresh();
    await cache.refresh();

    expect(calls).toBe(0);
  });

  test("a mutating call re-resolves even inside the TTL", async () => {
    let calls = 0;
    const cache = createPrincipalCache({
      clients: backendFor(() => {
        calls += 1;
        return [];
      }),
      initial: MEMBER_ONLY(),
      logger: SILENT,
      now: () => 1000,
    });

    await cache.refresh({ force: true });

    expect(calls).toBe(1);
  });

  test("a revoked membership stops authorizing", async () => {
    let memberships = ["SG-App-Dept-OperationsUnit", "SG-App-Campus-National"];
    const cache = createPrincipalCache({
      clients: backendFor(() => memberships),
      initial: GLOBAL_ADMIN(),
      logger: SILENT,
    });

    memberships = [];
    const after = await cache.refresh({ force: true });

    expect(after.roles).not.toContain("globaladmin");
  });

  test("a forced refresh that fails throws rather than trusting the old roles", async () => {
    const cache = createPrincipalCache({
      clients: backendFor(() => {
        throw new Error("network");
      }),
      initial: GLOBAL_ADMIN(),
      logger: SILENT,
    });

    await expect(cache.refresh({ force: true })).rejects.toThrow();
  });

  test("an unforced refresh that fails keeps the cached principal", async () => {
    // The caller's own credential still gates whatever a read returns, so a
    // transient blip should not fail the call.
    const cache = createPrincipalCache({
      clients: backendFor(() => {
        throw new Error("network");
      }),
      initial: GLOBAL_ADMIN(),
      logger: SILENT,
      now: (() => {
        let t = 0;
        return () => {
          t += PRINCIPAL_TTL_MS + 1;
          return t;
        };
      })(),
    });

    const kept: Principal = await cache.refresh();

    expect(kept.roles).toContain("globaladmin");
  });
});
