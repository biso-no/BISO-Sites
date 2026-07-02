import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  buildTurnoverProfilePatch,
  computeRetentionStopAt,
  postRetentionWebhook,
  RETENTION_RUN_DAYS,
  resetUserMfaMethods,
} from "./turnover";

describe("buildTurnoverProfilePatch", () => {
  test("sets display/given/surname and leaves the login address untouched", () => {
    const patch = buildTurnoverProfilePatch("  Ada ", " Lovelace ");
    expect(patch).toEqual({
      displayName: "Ada Lovelace",
      givenName: "Ada",
      surname: "Lovelace",
    });
    expect(patch).not.toHaveProperty("userPrincipalName");
    expect(patch).not.toHaveProperty("mail");
  });
});

describe("computeRetentionStopAt", () => {
  test("adds the 7-day retention window", () => {
    const from = Date.parse("2026-07-02T00:00:00.000Z");
    expect(computeRetentionStopAt(from)).toBe("2026-07-09T00:00:00.000Z");
    expect(RETENTION_RUN_DAYS).toBe(7);
  });
});

describe("resetUserMfaMethods", () => {
  test("removes every non-password method and reports the types", async () => {
    const deleted: string[] = [];
    const graph = {
      listAuthenticationMethods: mock(() =>
        Promise.resolve([
          {
            id: "m1",
            odataType:
              "#microsoft.graph.microsoftAuthenticatorAuthenticationMethod",
            type: "authenticator",
          },
          {
            id: "m2",
            odataType: "#microsoft.graph.passwordAuthenticationMethod",
            type: "password",
          },
          {
            id: "m3",
            odataType: "#microsoft.graph.phoneAuthenticationMethod",
            type: "phone",
          },
        ])
      ),
      deleteAuthenticationMethod: mock((_u: string, id: string) => {
        deleted.push(id);
        return Promise.resolve();
      }),
    } as never;

    const result = await resetUserMfaMethods(graph, "user-1");

    expect(result.removedCount).toBe(2);
    expect(result.removedTypes).toEqual(["authenticator", "phone"]);
    expect(deleted).toEqual(["m1", "m3"]);
  });
});

describe("postRetentionWebhook", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("returns ok on a 2xx response", async () => {
    globalThis.fetch = mock(
      async () => new Response(null, { status: 202 })
    ) as unknown as typeof fetch;
    const result = await postRetentionWebhook("https://automation/start", {
      action: "start",
      userId: "u1",
      userUpn: "role@biso.no",
      retentionDays: 7,
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
  });

  test("returns not-ok with the status on a failure response", async () => {
    globalThis.fetch = mock(
      async () => new Response("boom", { status: 500 })
    ) as unknown as typeof fetch;
    const result = await postRetentionWebhook("https://automation/stop", {
      action: "stop",
      userId: "u1",
      userUpn: "role@biso.no",
      retentionDays: 7,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
  });

  test("never throws when fetch rejects", async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error("network down"))
    ) as unknown as typeof fetch;
    const result = await postRetentionWebhook("https://automation/start", {
      action: "start",
      userId: "u1",
      userUpn: "role@biso.no",
      retentionDays: 7,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("network down");
  });
});
