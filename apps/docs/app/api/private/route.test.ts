import { describe, expect, it } from "bun:test";
import type { Viewer } from "@/lib/auth/viewer";
import { createPrivateHandler } from "@/lib/private/handler";
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

  it("rejects unknown, missing and too many names with 400", async () => {
    const { handler, calls } = setup(allowed, okSource);
    const tooMany = Array.from({ length: 21 }, () => "account-owners");
    const names = ["nope", "account-owners,nope", "", "toString", "__proto__"];
    for (const n of names) {
      const res = await handler(request(n));
      expect(res.status).toBe(400);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    }
    // Duplicates collapse, so 21 distinct names are needed to exceed the cap.
    expect((await handler(request(tooMany.join(",")))).status).toBe(200);
    expect(calls.length).toBe(1);
  });

  it("rejects more than 20 distinct names", async () => {
    const { handler } = setup(allowed, okSource);
    const res = await handler(
      new Request(
        `http://docs.test/api/private?names=${Array.from({ length: 21 }, (_, i) => `n${i}`).join(",")}`
      )
    );
    expect(res.status).toBe(400);
  });
});
