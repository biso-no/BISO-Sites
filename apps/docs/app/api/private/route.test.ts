import { describe, expect, it } from "bun:test";
import type { Viewer } from "@/lib/auth/viewer";
import { createPrivateHandler, parseNames } from "@/lib/private/handler";
import type { PrivateValueSource } from "@/lib/private/types";

const SECRET = "value-for-test";

function setup(viewer: Viewer, source: PrivateValueSource | null | Error) {
  const calls: string[][] = [];
  const real: PrivateValueSource | null =
    source instanceof Error || source === null
      ? null
      : {
          get(names) {
            calls.push(names);
            return source.get(names);
          },
        };
  const handler = createPrivateHandler({
    getViewer: async () => viewer,
    getSource: () => {
      if (source instanceof Error) {
        throw source;
      }
      return real;
    },
  });
  return { calls, handler };
}

const okSource: PrivateValueSource = {
  get: async (names) =>
    Object.fromEntries([
      ...names.map((n) => [n, SECRET]),
      ["infisical-url", "not requested"],
    ]),
};

const allowed: Viewer = { signedIn: true, name: "A B", access: "globaladmin" };
const request = (names: string) =>
  new Request(`http://docs.test/api/private?names=${names}`);

describe("GET /api/private", () => {
  it("returns only the requested values to an allowed viewer", async () => {
    const { handler } = setup(allowed, okSource);
    const res = await handler(request("account-owners"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({
      state: "ok",
      values: { "account-owners": SECRET },
    });
  });

  it("says signed-out without touching the source", async () => {
    const { handler, calls } = setup({ signedIn: false }, okSource);
    const res = await handler(request("account-owners"));
    expect(await res.json()).toEqual({ state: "signed-out" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(calls).toEqual([]);
  });

  it("says forbidden without touching the source", async () => {
    const { handler, calls } = setup(
      { signedIn: true, name: "X", access: null },
      okSource
    );
    const res = await handler(request("account-owners"));
    expect(await res.json()).toEqual({ state: "forbidden" });
    expect(calls).toEqual([]);
  });

  it("says unavailable when there is no source, it throws, or config fails", async () => {
    for (const source of [
      null,
      new Error("bad config"),
      {
        get: () => Promise.reject(new Error("down")),
      } as PrivateValueSource,
    ]) {
      const { handler } = setup(allowed, source);
      const res = await handler(request("account-owners"));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ state: "unavailable" });
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    }
  });

  it("rejects unknown and missing names with 400", async () => {
    const { handler, calls } = setup(allowed, okSource);
    for (const n of [
      "nope",
      "account-owners,nope",
      "",
      "toString",
      "__proto__",
    ]) {
      const res = await handler(request(n));
      expect(res.status).toBe(400);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    }
    expect(calls).toEqual([]);
  });

  it("says unavailable when the viewer lookup throws", async () => {
    const handler = createPrivateHandler({
      getViewer: () => Promise.reject(new Error("boom")),
      getSource: () => okSource,
    });
    const res = await handler(request("account-owners"));
    expect(await res.json()).toEqual({ state: "unavailable" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("parseNames", () => {
  const known = (n: string) => n.startsWith("n");
  it("enforces the cap on distinct names", () => {
    expect(parseNames("n1,n2,n3", 3, known) as unknown).toEqual([
      "n1",
      "n2",
      "n3",
    ]);
    expect(parseNames("n1,n2,n3,n4", 3, known) as unknown).toBeNull();
  });
  it("collapses duplicates and rejects empty or unknown", () => {
    expect(parseNames("n1,n1,n1", 1, known) as unknown).toEqual(["n1"]);
    expect(parseNames(",", 3, known) as unknown).toBeNull();
    expect(parseNames("n1,x", 3, known) as unknown).toBeNull();
  });
  it("uses a cap of 20 by default", () => {
    const real = Array.from({ length: 21 }, (_, i) => `n${i}`).join(",");
    expect(parseNames(real, undefined, known) as unknown).toBeNull();
  });
});
